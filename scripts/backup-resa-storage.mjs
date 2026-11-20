#!/usr/bin/env node
/**
 * Copy-only export of every Supabase Storage bucket/object.
 *
 * Required environment:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (local only; never commit or upload this value)
 *   RESA_BACKUP_DIR             (new/empty destination directory)
 *
 * This script never uploads, deletes, updates or overwrites remote objects.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const backupDir = process.env.RESA_BACKUP_DIR
  ? path.resolve(process.env.RESA_BACKUP_DIR)
  : "";

if (!supabaseUrl || !serviceKey || !backupDir) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and RESA_BACKUP_DIR in your local environment.",
  );
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};
const pageSize = 1000;
const manifest = {
  backup_type: "supabase-storage-copy-only",
  project_ref: projectRef,
  started_at: new Date().toISOString(),
  completed_at: null,
  status: "in_progress",
  buckets: [],
  object_count: 0,
  total_bytes: 0,
  objects: [],
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`Storage API ${response.status} for ${url}: ${detail}`);
  }
  return response.json();
}

function safeDestination(bucketRoot, objectKey) {
  const destination = path.resolve(bucketRoot, ...objectKey.split("/"));
  const relative = path.relative(bucketRoot, destination);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe object path rejected: ${objectKey}`);
  }
  return destination;
}

async function listPage(bucket, prefix, offset) {
  return requestJson(
    `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
    {
      method: "POST",
      body: JSON.stringify({
        prefix,
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    },
  );
}

async function listAll(bucket, prefix = "", depth = 0) {
  if (depth > 80) throw new Error(`Storage folder nesting too deep in ${bucket}/${prefix}`);

  const files = [];
  const folders = new Set();
  let offset = 0;

  while (true) {
    const entries = await listPage(bucket, prefix, offset);
    if (!Array.isArray(entries)) {
      throw new Error(`Unexpected Storage listing response for ${bucket}/${prefix}`);
    }

    for (const entry of entries) {
      if (!entry || typeof entry.name !== "string" || entry.name.length === 0) continue;
      if (entry.id == null && entry.metadata == null) {
        folders.add(entry.name);
      } else {
        files.push(entry);
      }
    }

    offset += entries.length;
    if (entries.length < pageSize) break;
  }

  const result = [];
  for (const entry of files) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    result.push({ key, entry });
  }

  for (const folder of folders) {
    const childPrefix = prefix ? `${prefix}/${folder}` : folder;
    result.push(...await listAll(bucket, childPrefix, depth + 1));
  }

  return result;
}

async function downloadObject(bucket, bucketRoot, objectKey, entry) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const url = `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok || !response.body) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`Download failed for ${bucket}/${objectKey} (${response.status}): ${detail}`);
  }

  const destination = safeDestination(bucketRoot, objectKey);
  await mkdir(path.dirname(destination), { recursive: true });

  const hash = createHash("sha256");
  const hashingStream = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body),
    hashingStream,
    createWriteStream(destination, { flags: "wx" }),
  );

  const file = await stat(destination);
  return {
    bucket,
    key: objectKey,
    size_bytes: file.size,
    sha256: hash.digest("hex"),
    content_type: response.headers.get("content-type") ?? entry.metadata?.mimetype ?? null,
    created_at: entry.created_at ?? null,
    updated_at: entry.updated_at ?? null,
  };
}

async function main() {
  await mkdir(backupDir, { recursive: false });
  const bucketRoot = path.join(backupDir, "objects");
  await mkdir(bucketRoot, { recursive: true });

  const buckets = await requestJson(`${supabaseUrl}/storage/v1/bucket`);
  if (!Array.isArray(buckets)) throw new Error("Unexpected Storage bucket listing response.");

  for (const bucket of buckets) {
    if (!bucket || typeof bucket.id !== "string" || !/^[a-zA-Z0-9._-]+$/.test(bucket.id)) {
      throw new Error("Unexpected or unsafe Storage bucket identifier.");
    }

    const bucketPath = path.join(bucketRoot, bucket.id);
    await mkdir(bucketPath, { recursive: true });
    const bucketInfo = {
      id: bucket.id,
      name: bucket.name ?? bucket.id,
      public: Boolean(bucket.public),
      file_size_limit: bucket.file_size_limit ?? null,
      allowed_mime_types: bucket.allowed_mime_types ?? null,
    };
    manifest.buckets.push({ ...bucketInfo, object_count: 0, total_bytes: 0 });

    const entries = await listAll(bucket.id);
    for (const { key, entry } of entries) {
      const record = await downloadObject(bucket.id, bucketPath, key, entry);
      manifest.objects.push(record);
      manifest.object_count += 1;
      manifest.total_bytes += record.size_bytes;
      const bucketRecord = manifest.buckets[manifest.buckets.length - 1];
      bucketRecord.object_count += 1;
      bucketRecord.total_bytes += record.size_bytes;
    }
  }

  manifest.status = "complete";
  manifest.completed_at = new Date().toISOString();
  await writeFile(
    path.join(backupDir, "storage-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx" },
  );

  console.log(JSON.stringify({
    status: manifest.status,
    project_ref: projectRef,
    buckets: manifest.buckets.length,
    objects: manifest.object_count,
    total_bytes: manifest.total_bytes,
    manifest: path.join(backupDir, "storage-manifest.json"),
  }, null, 2));
}

main().catch(async (error) => {
  manifest.status = "failed";
  manifest.completed_at = new Date().toISOString();
  manifest.error = String(error?.message ?? error);
  try {
    await writeFile(
      path.join(backupDir, "storage-manifest.failed.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { flag: "wx" },
    );
  } catch {
    // Preserve the original failure; do not mask it with manifest-write errors.
  }
  console.error(`Storage export failed: ${manifest.error}`);
  process.exitCode = 1;
});
