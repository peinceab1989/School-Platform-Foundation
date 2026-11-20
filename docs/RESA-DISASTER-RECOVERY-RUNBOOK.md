# RESA Digital Campus — Disaster-Recovery Backup and Restore Runbook

**Project:** Supabase `mhwwzzxwpsqwhxrsuwaa` / GitHub `peinceab1989/School-Platform-Foundation`  
**Backup destination:** Dropbox `/RESA MASTER BACKUP/`  
**Policy:** Copy-only. Never delete or reset production records as part of a backup. Keep credentials and signing keys out of Dropbox.

## 1. Important current status

The existing Dropbox backup is **PARTIAL**. It is not yet a verified disaster-recovery backup. It contains selected source and metadata snapshots, but does not yet contain a current full repository bundle, complete database export, all Storage object bytes or a restore-rehearsal report.

Do not describe the backup as complete until every required export is present, checksummed, and restored successfully in an isolated local environment.

## 2. What must be preserved

| Component | Required artifact | Handling |
|---|---|---|
| Git repository | Git bundle with all refs/history, plus current main ZIP | Copy to Dropbox; record main commit SHA |
| PostgreSQL | roles, schema, data and migration history exports | Restricted backup folder; encrypt archive before upload |
| Auth | users/identities export or complete approved database backup containing Auth data | Highly sensitive; encrypt before upload; never paste in chat |
| Storage | every bucket's actual object bytes, bucket settings and object manifest | Copy-only; include SHA-256 per object |
| Edge Functions | source for every deployed function, including local dependencies | Source only; secrets are excluded |
| Project configuration | non-secret project settings, enabled extensions, Realtime publication list, redirect URLs and function names | Record values that are safe to disclose; do not export secret values |
| Frontend | source, lockfile, static assets, redirects/headers and deployment configuration | Include current main commit and build instructions |
| School documents | approved operational documents, crest/logo and handover material | Copy-only; apply school privacy rules |

## 3. Prepare a local secure workstation

1. Use a trusted computer with disk encryption and current security updates.
2. Install Git, Docker Desktop, PostgreSQL client tools and the current Supabase CLI.
3. Create a new local working directory, for example `RESA-DR-2026-11-20`.
4. Do not place database passwords, Supabase access tokens, service-role keys, VAPID private keys, webhook tokens or API secrets inside the backup folder.
5. Do not upload plaintext credential files to Dropbox. Keep credentials in a local password manager or secure environment variables.
6. Verify the project reference before running any export: `mhwwzzxwpsqwhxrsuwaa`.

## 4. GitHub source archive

Run from a trusted local terminal:

```bash
git clone https://github.com/peinceab1989/School-Platform-Foundation.git
cd School-Platform-Foundation
git fetch --all --tags
git bundle create ../RESA-School-Platform-Foundation.bundle --all
git archive --format=zip --output ../RESA-School-Platform-Foundation-main.zip main
git rev-parse main
```

Record the returned main commit SHA in the manifest. Verify the bundle can be listed with `git bundle list-heads ../RESA-School-Platform-Foundation.bundle`. Copy both archives to `01 GitHub Source Code`.

## 5. PostgreSQL logical export

Supabase's current CLI backup guide requires Docker Desktop for `supabase db dump`. Use the direct database connection string from the Supabase Dashboard's Connect panel, or a supported session-pooler string if the network cannot use IPv6. Keep the password local; do not paste it into ChatGPT, GitHub or Dropbox.

The documented logical export consists of three separate files:

```bash
supabase db dump --remote="$RESA_DATABASE_URL" -f roles.sql --role-only
supabase db dump --remote="$RESA_DATABASE_URL" -f schema.sql
supabase db dump --remote="$RESA_DATABASE_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Use the exact database URL only in a local environment variable. Confirm the CLI's printed Target line identifies project `mhwwzzxwpsqwhxrsuwaa` before proceeding. The standard Supabase CLI dump excludes managed `auth` and `storage` schemas and extension-managed schemas; therefore these files alone are not a full Auth or Storage backup.

Also export the migration history needed to reconcile the restored database with source control, following Supabase's migration-history backup instructions. Keep the three dump files and migration-history exports in a restricted local directory; encrypt the complete archive before copying it to Dropbox.

## 6. Auth data

Auth records are sensitive. Supabase documents exporting users from the Auth schema through SQL Editor (for example, `auth.users`) and exporting query results as CSV. For a recoverable Auth migration, verify whether the export includes the associated identities and any required Auth records; a users-only CSV is an inventory, not a full Auth restore.

- Never export password hashes, refresh tokens, MFA secrets or identity tokens to an unencrypted Dropbox file.
- Prefer a supported full project backup/restore path where available; verify what it includes before relying on it.
- If a logical export is required, have an authorised database administrator define and verify the minimum Auth tables and relationships needed for recovery.
- Keep JWT signing secrets, API keys, SMTP credentials and provider client secrets out of the backup archive. Record only the names of required settings and configure fresh/approved values during recovery.
- A restored project may require users to sign in again if JWT signing configuration differs.

## 7. Storage objects

Database backups preserve Storage metadata only in some backup paths; the actual object bytes are separate. The current CLI backup guide provides a Storage-object migration workflow using the Supabase client. For RESA:

1. List every bucket and record its public/private status, file-size limit and allowed MIME types.
2. Recursively list every object, including nested paths.
3. Download each object byte-for-byte to the corresponding bucket/path under `03 Supabase Storage`.
4. Preserve object path, MIME type, size and last-modified metadata where available.
5. Generate a SHA-256 checksum for each downloaded object.
6. Compare the number of source objects with the number of downloaded objects and investigate every mismatch.
7. Do not delete or modify the source objects.

The repository now includes `scripts/backup-resa-storage.mjs`, a native-Node, copy-only exporter that uses the Supabase Storage REST API (no extra package installation required). It lists every bucket, recursively handles folders and pagination, downloads each object to local disk, and writes a `storage-manifest.json` with per-object size and SHA-256. It never uploads, updates or deletes remote objects and never writes the service key to the manifest.

From a trusted local checkout, set these environment variables locally (use a password manager or secure local environment method for the service-role key; do not type the key into a command, paste it into chat, commit it, or put it in Dropbox):

```powershell
$env:SUPABASE_URL = "https://mhwwzzxwpsqwhxrsuwaa.supabase.co"
$env:RESA_BACKUP_DIR = "D:\\RESA-STORAGE-BACKUP-2026-11-20"
# Set SUPABASE_SERVICE_ROLE_KEY in the current local session using your secure secret manager.
node scripts/backup-resa-storage.mjs
```

Use a new destination directory that does not already exist. The script fails on any bucket/list/download error and writes a failed manifest when possible. Review the bucket/object counts and checksums before archiving. Storage object contents may include personal school data: encrypt the archive before copying it to Dropbox. Never commit the service credential or script output containing secret values.

## 8. Edge Functions and configuration

For each deployed function:
- Record function slug, deployed version, status, entrypoint and JWT verification setting.
- Download the function source from the project or the repository and include every imported local dependency.
- Compare deployed source with the corresponding source-control commit.
- Record required environment variable names only.
- Do not export secret values, webhook tokens, VAPID private keys, service-role keys or API credentials.
- Record which functions need redeployment and the intended version/source commit.

Do not deploy all functions during a restore rehearsal. Restore them one by one only after reviewing their dependencies and configuration.

## 9. Checksums and verification

Create a manifest with:
- backup date/time in Africa/Lagos and UTC;
- project reference and main commit SHA;
- file path, byte size and SHA-256 for every artifact;
- Storage bucket/object counts and per-object checksums;
- export command/version and completion status;
- operator and verification date;
- any skipped, inaccessible or failed artifact.

After copying the archive to Dropbox, download a copy to a separate local directory and re-check every SHA-256. A successful upload alone is not verification.

## 10. Isolated restore rehearsal

Use a disposable local Supabase stack or a separately authorised non-production project. Do not restore over the live RESA project.

1. Verify the archive checksums before restore.
2. Start a local Supabase stack with a compatible PostgreSQL version and required extensions.
3. Restore roles and schema first, then data in a controlled transaction using the documented Supabase restore procedure.
4. Reconcile migration history and compare table counts against the source export.
5. Restore Storage buckets/settings and object bytes to the isolated target only.
6. Restore or recreate Edge Functions with test-only secrets and safe webhook endpoints.
7. Test representative administrator, teacher, parent and student sign-in/access paths in the isolated environment.
8. Verify critical records, RLS boundaries, attendance, fees, results, assignments, CBT and messaging data.
9. Record restore duration, errors, missing objects and remediation.
10. Destroy the disposable environment only after the restore evidence has been saved and reviewed.

Never point the production frontend at the test database. Never run destructive restore commands against the live project.

## 11. Final backup acceptance checklist

- [ ] Current Git bundle and main ZIP created; main SHA recorded.
- [ ] Roles, schema, data and migration history exports completed.
- [ ] Auth export scope reviewed and encrypted.
- [ ] Every Storage bucket and object exported; counts match.
- [ ] Edge Function source and local dependencies archived.
- [ ] Non-secret configuration inventory completed.
- [ ] Secret values excluded from Dropbox.
- [ ] Dropbox copy downloaded again and all checksums verified.
- [ ] Isolated restore rehearsal completed successfully.
- [ ] Restore report signed by the technical operator and school representative.

**Until all boxes are checked, status remains PARTIAL — NOT DISASTER-RECOVERY READY.**

## 12. Official Supabase references

- Backup and restore using the CLI: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Database backups: https://supabase.com/docs/guides/platform/backups
- Download Storage objects: https://supabase.com/docs/guides/storage/management/download-objects
- Auth user export and management: https://supabase.com/docs/guides/auth/managing-user-data
