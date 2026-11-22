# RESA encrypted Supabase-to-Dropbox backup

This is a manually triggered, one-way backup workflow. It does not run on pushes or pull requests, does not deploy the portal, and does not modify Supabase. It uploads one GPG AES-256 encrypted archive directly to:

`/RESA MASTER BACKUP/07 Historical Backups/`

## Scope

The encrypted archive contains:
- PostgreSQL application schemas and data, excluding Supabase-managed schemas.
- Auth user records and user metadata from the Supabase Admin API. It does **not** export passwords, sessions, refresh tokens, MFA secrets or password hashes.
- Storage bucket configuration and downloaded Storage object bytes.
- A safe PostgreSQL role inventory (role names and safe attributes only; no role passwords).
- Per-object Storage manifest entries alongside downloaded object bytes, including available object metadata and timestamps.
- A JSON manifest with counts and explicit exclusions.

It does not export Supabase project secrets, API keys, Edge Function secrets, billing settings or provider configuration. Existing GitHub source and Edge Function source backups remain separate.

## Required GitHub Actions secrets

After this workflow has been reviewed and merged into `main`, add these under **Repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
| --- | --- |
| `RESA_DB_URL` | Supabase PostgreSQL connection URI. Prefer the session pooler URI if direct IPv6 connectivity is unavailable. |
| `SUPABASE_URL` | Project HTTPS URL, e.g. `https://<project-ref>.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key. Never place it in source code or chat. |
| `RESA_BACKUP_PASSPHRASE` | A unique, strong passphrase of at least 20 characters. Store it separately in a secure password manager; it is required to decrypt the archive. |
| `DROPBOX_APP_KEY` | Dropbox developer app key. |
| `DROPBOX_APP_SECRET` | Dropbox developer app secret. |
| `DROPBOX_REFRESH_TOKEN` | OAuth refresh token for the Dropbox app. |

### Dropbox app setup

Create a Dropbox API app using **Scoped access** and **Full Dropbox** content access, because the existing backup folder is at the Dropbox account root and an App folder app cannot write there. In the app's **Permissions** tab, enable `files.content.write` and `files.metadata.read` (the latter is needed only to verify the uploaded file's size and content hash); do not enable file content read, sharing, account, team or other scopes. This is a write-only API token, but its write scope can target paths throughout the Dropbox account, so keep the refresh token and app secret private. Complete OAuth code flow with `token_access_type=offline` to obtain a refresh token. Dropbox access tokens are short-lived; the refresh token lets this manually triggered workflow obtain a fresh access token when needed.

## Run procedure

1. Review this workflow and script in the pull request.
2. Merge only after review. The workflow is intentionally not active from a feature branch; GitHub requires a `workflow_dispatch` workflow to exist on the default branch for the Run workflow control.
3. Add all seven secrets above. Do not send them in ChatGPT.
4. Open **Actions → RESA encrypted Supabase backup to Dropbox → Run workflow** and select `main`.
5. Confirm the run reports `status: uploaded` and shows the final Dropbox path and byte counts.
6. Verify the file in Dropbox and preserve the passphrase separately. Do not delete or reset any live data until a restore test is completed.

## Important restore limitations

This is a recovery archive, not a one-click point-in-time restore. A restore requires a compatible Supabase project, restoring the application database dump, recreating Auth users through supported Admin APIs, uploading Storage objects, and reapplying project-level configuration and secrets separately. The archive deliberately excludes credentials and Supabase-managed internals. PostgreSQL ACLs/grants are omitted by the dump flags, so a restore must reapply the correct grants and role memberships. Extension installation, Auth user recreation, Storage upload, Edge Function deployment, project settings and secrets also require separate restore steps. Test restoration in a separate project before relying on it.

## Safety and cost controls

- Manual trigger only; no schedule, push, pull-request or deployment trigger.
- Standard `ubuntu-latest` GitHub-hosted runner on this public repository; no larger runner, paid third-party service, or artifact storage is used.
- The workflow uses read-only repository permissions and uploads only encrypted data.
- Plaintext backup files exist only temporarily on the ephemeral runner and are deleted before upload.
- Never enable step debug logging for this workflow.
- If any required secret is absent or a backup/export/upload fails, the workflow stops and reports failure; it does not change the live project.
