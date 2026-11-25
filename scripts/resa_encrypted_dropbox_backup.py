#!/usr/bin/env python3
"""Create an encrypted RESA Supabase backup and upload it directly to Dropbox.

Secrets are read only from the process environment. Plaintext backup material is
kept in the ephemeral runner workspace, encrypted before upload, and deleted.
This script deliberately does not export password hashes or access tokens.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.parse

import requests

TIMEOUT = (20, 180)
CHUNK = 8 * 1024 * 1024
DROPBOX_SINGLE_UPLOAD_LIMIT = 150 * 1024 * 1024
DROPBOX_DESTINATION_DIR = "/RESA MASTER BACKUP/07 Historical Backups"
MANAGED_SCHEMAS = [
    "auth", "storage", "realtime", "extensions", "graphql", "graphql_public",
    "supabase_migrations", "supabase_functions", "vault", "cron", "net",
    "pgbouncer", "pgsodium",
]


def required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def api_headers(url: str, key: str) -> dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def supabase_request(method: str, url: str, key: str, **kwargs):
    response = requests.request(
        method, url, headers=api_headers(url, key), timeout=TIMEOUT, **kwargs
    )
    response.raise_for_status()
    return response


def export_auth_users(root: pathlib.Path, supabase_url: str, service_key: str) -> int:
    users = []
    page = 1
    while True:
        response = supabase_request(
            "GET",
            f"{supabase_url}/auth/v1/admin/users",
            service_key,
            params={"page": page, "per_page": 1000},
        )
        payload = response.json()
        batch = payload.get("users", []) if isinstance(payload, dict) else []
        # Export only an explicit allowlist. Never persist password hashes,
        # encrypted_password, tokens, MFA factors, recovery codes or sessions,
        # even if the Auth API adds sensitive fields in a future response.
        safe_fields = {
            "id", "aud", "role", "email", "phone", "app_metadata",
            "user_metadata", "created_at", "updated_at", "is_anonymous",
            "is_sso_user", "invited_at", "last_sign_in_at", "confirmed_at",
            "email_confirmed_at", "phone_confirmed_at", "banned_until",
            "deleted_at",
        }
        for user in batch:
            if isinstance(user, dict):
                users.append({key: value for key, value in user.items() if key in safe_fields})
        if len(batch) < 1000:
            break
        page += 1
        if page > 10000:
            raise RuntimeError("Auth export pagination safety limit reached")
    (root / "auth-users.json").write_text(
        json.dumps({"users": users}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(users)


def list_storage_page(
    supabase_url: str, service_key: str, bucket: str, prefix: str, offset: int
):
    url = f"{supabase_url}/storage/v1/object/list/{urllib.parse.quote(bucket, safe='')}"
    body = {
        "prefix": prefix,
        "limit": 1000,
        "offset": offset,
        "sortBy": {"column": "name", "order": "asc"},
    }
    return supabase_request("POST", url, service_key, json=body).json()


def download_storage_file(
    supabase_url: str, service_key: str, bucket: str, object_path: str, target: pathlib.Path
):
    encoded = urllib.parse.quote(object_path, safe="/")
    url = (
        f"{supabase_url}/storage/v1/object/"
        f"{urllib.parse.quote(bucket, safe='')}/{encoded}"
    )
    response = supabase_request("GET", url, service_key, stream=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as output:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                output.write(chunk)


def export_storage(root: pathlib.Path, supabase_url: str, service_key: str):
    buckets = supabase_request(
        "GET", f"{supabase_url}/storage/v1/bucket", service_key
    ).json()
    (root / "storage-buckets.json").write_text(
        json.dumps(buckets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    storage_root = root / "storage-objects"
    file_count = 0
    byte_count = 0
    object_manifest = []

    for bucket_info in buckets:
        bucket = bucket_info["name"]
        seen = set()

        def walk(prefix: str):
            nonlocal file_count, byte_count
            offset = 0
            while True:
                entries = list_storage_page(
                    supabase_url, service_key, bucket, prefix, offset
                )
                if not isinstance(entries, list):
                    raise RuntimeError(f"Unexpected Storage listing for bucket {bucket}")
                if not entries:
                    break
                for item in entries:
                    name = item.get("name")
                    if not name or name in (".", ".."):
                        continue
                    object_path = f"{prefix}{name}" if prefix else name
                    if object_path in seen:
                        continue
                    is_folder = item.get("id") is None and item.get("metadata") is None
                    if is_folder:
                        seen.add(object_path)
                        walk(object_path.rstrip("/") + "/")
                        continue
                    if ".." in pathlib.PurePosixPath(object_path).parts:
                        raise RuntimeError("Unsafe object path encountered")
                    target = storage_root / bucket / pathlib.PurePosixPath(object_path)
                    download_storage_file(
                        supabase_url, service_key, bucket, object_path, target
                    )
                    seen.add(object_path)
                    file_count += 1
                    byte_count += target.stat().st_size
                    object_manifest.append({
                        "bucket": bucket,
                        "path": object_path,
                        "id": item.get("id"),
                        "metadata": item.get("metadata"),
                        "created_at": item.get("created_at"),
                        "updated_at": item.get("updated_at"),
                        "last_accessed_at": item.get("last_accessed_at"),
                        "downloaded_bytes": target.stat().st_size,
                    })
                if len(entries) < 1000:
                    break
                offset += len(entries)
                if offset > 10_000_000:
                    raise RuntimeError("Storage pagination safety limit reached")

        walk("")
    (root / "storage-objects-manifest.json").write_text(
        json.dumps(object_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(buckets), file_count, byte_count


def postgres_environment(db_url: str) -> dict[str, str]:
    parsed = urllib.parse.urlsplit(db_url)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname:
        raise RuntimeError("RESA_DB_URL must be a valid PostgreSQL connection URI")
    query = urllib.parse.parse_qs(parsed.query)
    env = os.environ.copy()
    env.update({
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port or 5432),
        "PGUSER": urllib.parse.unquote(parsed.username or ""),
        "PGPASSWORD": urllib.parse.unquote(parsed.password or ""),
        "PGDATABASE": urllib.parse.unquote(parsed.path.lstrip("/")),
        "PGSSLMODE": query.get("sslmode", ["require"])[0],
        "PGCONNECT_TIMEOUT": "20",
    })
    if not env["PGUSER"] or not env["PGDATABASE"]:
        raise RuntimeError("RESA_DB_URL is missing its PostgreSQL username or database")
    return env


def export_database(root: pathlib.Path, db_url: str):
    pg_env = postgres_environment(db_url)
    dump_file = root / "application-database.dump"
    command = [
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--no-password",
        "--file",
        str(dump_file),
    ]
    for schema in MANAGED_SCHEMAS:
        command.extend(["--exclude-schema", schema])
    try:
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, env=pg_env)
    except subprocess.CalledProcessError:
        # Do not include the command in logs: it contains the database URI.
        raise RuntimeError("PostgreSQL database export failed; connection details suppressed")
    if not dump_file.exists() or dump_file.stat().st_size == 0:
        raise RuntimeError("Database dump is empty; backup stopped")
    # Validate that PostgreSQL can read the custom-format dump before packaging.
    try:
        subprocess.run(
            ["pg_restore", "--list", str(dump_file)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=pg_env,
        )
    except subprocess.CalledProcessError:
        raise RuntimeError("Database dump validation failed; backup stopped")

    # Record role names and safe attributes only; never export role passwords.
    role_sql = (
        "SELECT rolname || E'\\t' || rolsuper || E'\\t' || rolcreatedb || "
        "E'\\t' || rolcreaterole || E'\\t' || rolcanlogin "
        "FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname;"
    )
    roles_file = root / "database-roles.tsv"
    with roles_file.open("w", encoding="utf-8") as output:
        try:
            subprocess.run(
                ["psql", "--no-password", "--tuples-only", "--no-align", "-c", role_sql],
                check=True,
                stdout=output,
                env=pg_env,
            )
        except subprocess.CalledProcessError:
            raise RuntimeError("PostgreSQL role inventory failed; connection details suppressed")
    # Supabase-managed storage schema is excluded from pg_dump, so preserve
    # its Row Level Security policy definitions separately for recovery review.
    storage_policy_sql = """
        SELECT COALESCE(
            json_agg(
                json_build_object(
                    'schema', schemaname,
                    'table', tablename,
                    'policy_name', policyname,
                    'permissive', permissive,
                    'roles', roles,
                    'command', cmd,
                    'using_expression', qual,
                    'with_check_expression', with_check
                )
                ORDER BY tablename, policyname
            ),
            '[]'::json
        )::text
        FROM pg_policies
        WHERE schemaname = 'storage';
    """
    try:
        policy_export = subprocess.run(
            ["psql", "--no-password", "--tuples-only", "--no-align", "-c", storage_policy_sql],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            env=pg_env,
        )
        storage_policies = json.loads(policy_export.stdout.strip() or "[]")
        if not isinstance(storage_policies, list):
            raise ValueError("Storage policy export was not a JSON list")
    except (subprocess.CalledProcessError, json.JSONDecodeError, ValueError):
        raise RuntimeError("Storage RLS policy export failed; backup stopped")
    (root / "storage-policies.json").write_text(
        json.dumps(storage_policies, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return dump_file.stat().st_size, len(storage_policies)


def dropbox_access_token(app_key: str, app_secret: str, refresh_token: str) -> str:
    response = requests.post(
        "https://api.dropbox.com/oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": app_key,
            "client_secret": app_secret,
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Dropbox did not return an access token")
    return token


def dropbox_content_hash(local_file: pathlib.Path) -> str:
    block_hashes = []
    with local_file.open("rb") as source:
        while True:
            block = source.read(4 * 1024 * 1024)
            if not block:
                break
            block_hashes.append(hashlib.sha256(block).digest())
    return hashlib.sha256(b"".join(block_hashes)).hexdigest()


def dropbox_upload(token: str, local_file: pathlib.Path, remote_path: str):
    headers = {"Authorization": f"Bearer {token}"}
    size = local_file.stat().st_size
    if size <= DROPBOX_SINGLE_UPLOAD_LIMIT:
        with local_file.open("rb") as source:
            response = requests.post(
                "https://content.dropboxapi.com/2/files/upload",
                headers={
                    **headers,
                    "Content-Type": "application/octet-stream",
                    "Dropbox-API-Arg": json.dumps({
                        "path": remote_path,
                        "mode": "add",
                        "autorename": True,
                        "mute": True,
                        "strict_conflict": True,
                    }),
                },
                data=source,
                timeout=(30, 600),
            )
        response.raise_for_status()
        return response.json()

    with local_file.open("rb") as source:
        first = source.read(CHUNK)
        started = requests.post(
            "https://content.dropboxapi.com/2/files/upload_session/start",
            headers={**headers, "Content-Type": "application/octet-stream",
                     "Dropbox-API-Arg": json.dumps({"close": False})},
            data=first,
            timeout=(30, 600),
        )
        started.raise_for_status()
        session_id = started.json()["session_id"]
        offset = len(first)
        while offset < size:
            block = source.read(CHUNK)
            if not block:
                break
            if offset + len(block) == size:
                finish = requests.post(
                    "https://content.dropboxapi.com/2/files/upload_session/finish",
                    headers={**headers, "Content-Type": "application/octet-stream",
                             "Dropbox-API-Arg": json.dumps({
                                 "cursor": {"session_id": session_id, "offset": offset},
                                 "commit": {"path": remote_path, "mode": "add",
                                            "autorename": True, "mute": True,
                                            "strict_conflict": True},
                             })},
                    data=block,
                    timeout=(30, 600),
                )
                finish.raise_for_status()
                return finish.json()
            append = requests.post(
                "https://content.dropboxapi.com/2/files/upload_session/append_v2",
                headers={**headers, "Content-Type": "application/octet-stream",
                         "Dropbox-API-Arg": json.dumps({
                             "cursor": {"session_id": session_id, "offset": offset},
                             "close": False,
                         })},
                data=block,
                timeout=(30, 600),
            )
            append.raise_for_status()
            offset += len(block)
    raise RuntimeError("Dropbox upload session did not finish")


def main():
    db_url = required("RESA_DB_URL")
    supabase_url = required("SUPABASE_URL").rstrip("/")
    service_key = required("SUPABASE_SERVICE_ROLE_KEY")
    passphrase = required("RESA_BACKUP_PASSPHRASE")
    # A manually generated short-lived token supports a one-time browser-only run.
    # For repeatable automation, prefer the refresh-token credentials.
    direct_access_token = os.environ.get("DROPBOX_ACCESS_TOKEN", "").strip()
    app_key = os.environ.get("DROPBOX_APP_KEY", "").strip()
    app_secret = os.environ.get("DROPBOX_APP_SECRET", "").strip()
    refresh_token = os.environ.get("DROPBOX_REFRESH_TOKEN", "").strip()
    if not direct_access_token and not all([app_key, app_secret, refresh_token]):
        raise RuntimeError(
            "Provide DROPBOX_ACCESS_TOKEN or all three Dropbox refresh-token credentials"
        )

    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    work = pathlib.Path(tempfile.mkdtemp(prefix="resa-backup-"))
    archive = work / f"RESA-Supabase-Full-{timestamp}.tar.gz"
    encrypted = pathlib.Path(tempfile.gettempdir()) / f"RESA-Supabase-Full-{timestamp}.tar.gz.gpg"

    try:
        db_bytes, storage_policy_count = export_database(work, db_url)
        auth_count = export_auth_users(work, supabase_url, service_key)
        bucket_count, object_count, storage_bytes = export_storage(
            work, supabase_url, service_key
        )
        manifest = {
            "created_at_utc": timestamp,
            "project_url": supabase_url,
            "database_dump_bytes": db_bytes,
            "auth_user_records": auth_count,
            "storage_bucket_count": bucket_count,
            "storage_object_count": object_count,
            "storage_object_bytes": storage_bytes,
            "storage_policy_count": storage_policy_count,
            "included": [
                "application database schemas and data (excluding Supabase-managed schemas)",
                "Auth user records and metadata (no passwords or active tokens)",
                "Storage bucket configuration, downloaded object bytes and storage RLS policy definitions",
                "safe PostgreSQL role inventory (no role passwords)",
            ],
            "not_included": [
                "database role passwords",
                "Auth passwords, sessions, refresh tokens and MFA secrets",
                "Supabase project secrets and API keys",
                "Edge Function deployment secrets",
                "Supabase-managed internal schemas other than the separately exported Storage RLS policies",
            ],
        }
        (work / "backup-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        with tarfile.open(archive, "w:gz") as tar:
            for item in sorted(work.iterdir()):
                if item == archive or item == encrypted:
                    continue
                tar.add(item, arcname=item.name)

        # Encrypt the complete archive before any upload leaves the ephemeral runner.
        encryption = subprocess.run(
            ["gpg", "--batch", "--yes", "--pinentry-mode", "loopback",
             "--passphrase-fd", "0", "--symmetric", "--cipher-algo", "AES256",
             "--output", str(encrypted), str(archive)],
            input=(passphrase + "\n").encode("utf-8"),
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        if encryption.returncode != 0 or not encrypted.exists():
            raise RuntimeError("GPG encryption failed; encrypted backup was not uploaded")
        # Perform a full decrypt-to-null integrity check before removing plaintext.
        integrity = subprocess.run(
            ["gpg", "--batch", "--yes", "--pinentry-mode", "loopback",
             "--passphrase-fd", "0", "--decrypt", "--output", os.devnull,
             str(encrypted)],
            input=(passphrase + "\n").encode("utf-8"),
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if integrity.returncode != 0:
            raise RuntimeError("Encrypted archive integrity check failed; upload stopped")

        # Remove plaintext immediately after encryption and before Dropbox upload.
        archive.unlink(missing_ok=True)
        shutil.rmtree(work, ignore_errors=True)

        token = direct_access_token or dropbox_access_token(app_key, app_secret, refresh_token)
        remote_path = (
            f"{DROPBOX_DESTINATION_DIR}/RESA-Supabase-Full-{timestamp}.tar.gz.gpg"
        )
        expected_hash = dropbox_content_hash(encrypted)
        uploaded = dropbox_upload(token, encrypted, remote_path)
        if uploaded.get("size") != encrypted.stat().st_size:
            raise RuntimeError("Dropbox-reported size differs from encrypted backup size")
        if uploaded.get("content_hash") != expected_hash:
            raise RuntimeError("Dropbox content hash verification failed")
        metadata_response = requests.post(
            "https://api.dropboxapi.com/2/files/get_metadata",
            headers={**{"Authorization": f"Bearer {token}"},
                     "Content-Type": "application/json"},
            json={"path": uploaded["id"]},
            timeout=TIMEOUT,
        )
        metadata_response.raise_for_status()
        verified = metadata_response.json()
        if verified.get("size") != encrypted.stat().st_size or verified.get("content_hash") != expected_hash:
            raise RuntimeError("Dropbox read-after-write verification failed")
        print(json.dumps({
            "status": "uploaded",
            "dropbox_path": uploaded.get("path_display", remote_path),
            "encrypted_bytes": uploaded.get("size"),
            "database_dump_bytes": db_bytes,
            "auth_user_records": auth_count,
            "storage_bucket_count": bucket_count,
            "storage_object_count": object_count,
            "storage_object_bytes": storage_bytes,
            "encryption": "GPG AES-256",
        }, indent=2))
    finally:
        shutil.rmtree(work, ignore_errors=True)
        encrypted.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Avoid dumping environment, request headers, or credential-bearing URLs.
        print(f"RESA backup failed safely: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
