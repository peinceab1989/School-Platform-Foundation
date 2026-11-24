> **Evidence refresh — 24 November 2026, 18:55 UTC:** Main is `029c9290532a658eea4ffcf94d4514f0ca67c32a`; main CI run [#1376](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/45463115882) passed. PR #145's documentation update is merged. Focused client-only [PR #146](https://github.com/peinceab1989/School-Platform-Foundation/pull/146) passes GitHub TypeScript/build and its exact-head Cloudflare branch preview, but remains unmerged pending parent-account and Android device acceptance. PR #138's branding branch preview also passes, but it remains unmerged pending install/push/offline acceptance.
>
> **Production-vs-preview:** the live root `https://school-platform-foundation.pages.dev` still serves `manifest.json` with crest cache version `v=20261110` and service worker cache `resa-offline-v2`. The successful PR #138 branch preview serves `v=20261124` and `resa-offline-v3`. Therefore the branding change is not yet on the production root. The exact Cloudflare production commit remains unverified.
>
> **Fresh migration comparison:** live Supabase reports 127 applied migration versions. The deployable repository root `supabase/migrations/` contains 57 SQL files: 37 exact version matches, 90 live versions without an exact matching root file, and 20 repository-only root versions. The separate `artifacts/school-platform/supabase/migrations/` directory is a workspace copy and must not be included in this production comparison. The corrected staff-classification filename is one of the 37 matches; migration history is still not replay-safe.
>
> **Fresh advisor snapshot:** security findings remain 2 RLS-enabled tables with no policies (service-only/internal intent must be confirmed), 1 extension-in-public warning (`pg_net`), 3 anon-executable and 30 authenticated-executable SECURITY DEFINER functions, and the Free-plan leaked-password-protection warning. The three anon-callable public website RPCs were inspected and appear intentionally scoped to published RESA public content with empty search paths. Performance findings: 58 unindexed foreign keys, 12 auth/RLS init-plan warnings, 411 unused-index findings and 132 multiple-permissive-policy findings. Health advisor returned no findings. Do not blanket-revoke RPC grants or drop indexes without function-by-function/workload review.
>
> **Attendance and AI:** live `resa_acknowledge_attendance_checkpoint` still acknowledges only the alert row; generated reminder messages have no alert FK and are not marked read. Issue #144 tracks the schema-safe fix. Deployed `resa-ai-practice` is ACTIVE v11 and matches repository source; its last-24-hour function log query returned no invocations. Topic-only generation depends on an `OPENAI_API_KEY` secret whose presence was not inspected. Its free fallback selects the longest non-stopword and random word distractors, so it should be treated as a basic cloze drill, not validated curriculum MCQs.
>
> **Recovery:** backup exporter source review confirms the entire `storage` schema is excluded from `pg_dump`; Storage API export does not preserve Storage RLS policies, grants, triggers or functions. `pg_dump --no-owner --no-acl` also omits object ownership/ACLs; the role inventory is not a replayable grants backup. No backup was run and no isolated restore was performed. Issue #143 remains open.
>
> No production database, Auth setting, secret, school record, Dropbox file, or live deployment was changed during this evidence refresh.
>
> ---

> **Verification amendment — 24 November 2026, 18:37 UTC:** This document's original evidence snapshot below was captured before the final handover-documentation and migration-filename PRs were merged. Current `main` is now `c55733c150bfaf78463fd09c12f99df49c3968d3`. Main push workflow [#1373](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/45449137171) completed successfully (TypeScript and production build job). PR #141 corrected the staff-classification migration filename to the exact applied version `20261124063334`; it did not change SQL. PR #139 added this handover-readiness record and was merged. The correction resolves one known filename mismatch only; it does not reconcile the broader migration history described below.
>
> The Cloudflare Pages root URL and public routes `/portal-options`, `/practice-drills` and `/admissions` were reachable in a fresh public fetch. The public practice-drills page currently explains that topic-only AI generation requires provider configuration and that users can paste lesson notes for source-based generation. These public checks do **not** establish which commit is currently aliased to the Cloudflare production root, and no authenticated student/teacher/parent/admin session or physical device acceptance was performed. The Cloudflare deployment commit therefore remains unverified.
>
> The backup workflow and exporter were reviewed at source level. They encrypt and verify the archive before upload, but the exporter excludes the entire `storage` schema from `pg_dump`; the Storage API export does not include Storage RLS policies, grants, functions or triggers. No backup was run and no isolated restore was performed. Treat the backup as incomplete for full recovery until that gap and the other exclusions are addressed and a restore rehearsal passes.
>
> An additional tracked defect is [issue #144](https://github.com/peinceab1989/School-Platform-Foundation/issues/144): checkpoint acknowledgement currently does not mark the associated reminder inbox messages read. No production SQL or message data was changed.

---

# RESA Digital Campus — Handover Readiness Snapshot

**Assessment date:** 24 November 2026  
**Repository:** [peinceab1989/School-Platform-Foundation](https://github.com/peinceab1989/School-Platform-Foundation)  
**Branch assessed:** `main`  
**Assessed main commit:** [`7dc67c9`](https://github.com/peinceab1989/School-Platform-Foundation/commit/7dc67c9fa3cfdb29283cd638bc7850f21c685c56)  
**Supabase project:** [School digital portal](https://supabase.com/dashboard/project/mhwwzzxwpsqwhxrsuwaa)  
**Primary deployment target:** https://school-platform-foundation.pages.dev  
**Legacy fallback:** https://resa-school-portal.netlify.app/

## Release decision

**NO-GO for final school handover.** Continue controlled testing only. This snapshot records read-only evidence and operational release gates. It does not certify the public production deployment or authenticated role/device acceptance.

No production learner, staff, parent, attendance, assignment, submission, grade, Auth-user or Storage-object data was changed for this assessment. No production migration, Edge Function deployment, Pages deployment, secret change, PR merge or reset was performed.

## 1. Evidence snapshot

### GitHub and build

- Current main at assessment: `7dc67c9fa3cfdb29283cd638bc7850f21c685c56`.
- [Main TypeScript/production build run #45342274332](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/45342274332) completed successfully. The job includes workspace typecheck, production application build, RESA Edge Function typecheck, push-audience authorization tests and notification-preference routing tests.
- [PR #138](https://github.com/peinceab1989/School-Platform-Foundation/pull/138) contains the approved crest/PWA icon and favicon correction. Its own description records that production `/favicon.ico` returned 404; final latest-head preview evidence and real device install checks are still required.
- [PR #130](https://github.com/peinceab1989/School-Platform-Foundation/pull/130) targets the Cloudflare invitation redirect. Do not merge/deploy its invitation functions until the exact Cloudflare `/accept-invitation` URL is confirmed in Supabase Auth Redirect URLs.
- [PR #137](https://github.com/peinceab1989/School-Platform-Foundation/pull/137) adds a movable Ask RESA widget; test touch drag on Android and mouse drag on desktop.
- [PR #120](https://github.com/peinceab1989/School-Platform-Foundation/pull/120) includes safe class editing, grading configuration and notification work; it remains draft and is not a production acceptance result.
- 15 PRs were open in the repository listing at assessment. PR #77 and PR #127 are merged. PR #78 and #79 are closed without merging; equivalent staff classification and shared two-sided ID-card implementation are now present in main. Do not infer production release from this source status.

### Supabase live project

Read-only project check returned **ACTIVE_HEALTHY**, PostgreSQL 17.11, region `eu-west-2`.

Aggregate production counts at assessment:

| Item | Count |
|---|---:|
| Students | 12 |
| Staff | 8 |
| Student attendance rows | 27 |
| Persisted form-teacher assignments | 0 |
| Parent attendance preference rows | 3 |
| Active biometric devices | 1 |
| Biometric attendance events | 36 |
| Assignments | 5 |
| Assignment submissions | 18 |
| Published student online exams | 4 |
| Student online exam attempts | 21 |
| RESA Drive objects | 0 |
| Chat group memberships | 0 |

The `staff.staff_category` column exists. All 8 staff currently have `unclassified`; none were automatically classified. The HR & Staff Records page already exposes an administrator selector for each existing employee. School management must classify each person based on the verified job/appointment record.

The `school_messages` table contains 8,400 rows: 8,399 `private` and 1 `customer_care`, spanning 28 October to 24 November 2026. Message contents were not read. Treat this as a data-volume/test-data review item; do not delete or reset any rows without an approved retention decision and a verified backup.

### Supabase migrations and functions

- Supabase migration registry returned 127 applied versions; latest is `20261124063334_resa_staff_academic_classification`.
- The current repository main did not expose a matching migration file at the expected path, and code search did not locate that exact version. Do not apply another classification migration or edit the registry until the SQL that was applied and the committed migration source are reconciled.
- `resa-push-dispatch` is ACTIVE v5 and `resa-ai-practice` is ACTIVE v11. Their live function sources were retrieved; previous assessment reported source matching for these deployed functions. Confirm source hashes against the exact current main paths before any future function rollout.
- No migration or function deployment was performed for this snapshot.

### Runtime and advisors

- Read-only last-24-hour log aggregation: Auth 123 entries, Edge 2,268, function Edge 694, PostgREST 35; zero HTTP 5xx in those queried streams. This is not a guarantee that every user journey succeeds.
- Security Advisor categories: RLS-enabled table without policy, extension in public schema, anonymous-executable SECURITY DEFINER, authenticated-executable SECURITY DEFINER, leaked-password protection.
- The two RLS-enabled tables with no policies are `admission_application_rate_events` and `external_candidate_registration_events`. Verify that they are intentionally service-role-only and that ordinary roles have no direct grants before considering policy changes.
- Three public-executable SECURITY DEFINER functions were inspected: public customer-care status, published RESA announcements and public RESA website content. They use an empty search path and fixed RESA school scope in the inspected definitions; retain public behavior only if product requirements explicitly require it and the returned columns remain safe.
- Performance Advisor categories: unindexed foreign keys, RLS initialization plans, unused indexes and multiple permissive policies. Review individually; do not blanket-drop indexes or revoke functions.
- Supabase health advisor returned no findings.
- Native leaked-password protection remains unavailable on the current Free plan per the prior documented assessment. Record this residual risk for school sign-off; do not upgrade without approval.

## 2. Deployment verification

- Intended primary: https://school-platform-foundation.pages.dev
- Legacy fallback: https://resa-school-portal.netlify.app/
- The root Cloudflare production URL and legacy Netlify URL could not be fetched by the available web viewer during this assessment.
- A current-main preview deployment was previously recorded at [093ebf69.school-platform-foundation.pages.dev](https://093ebf69.school-platform-foundation.pages.dev), but preview does not prove the root production alias changed.
- The last documented production deployment baseline in the preceding assessment was commit `dcf4759` (15 November 2026). No newer root production deployment ID, timestamp and commit tuple was available for confirmation here.
- **Deployment verdict: production commit unknown; main-to-production parity unverified; authenticated browser/device acceptance not performed.**

Cloudflare's own [Pages project documentation](https://developers.cloudflare.com/pages/get-started/git-integration/) says the project dashboard shows current deployment status, production URL and associated commit. Retrieve that exact deployment record before claiming release.

## 3. Mandatory school acceptance gates

Record tester, role, date/time, synthetic account label, expected result, actual result, evidence and pass/fail. Do not use real student or parent accounts for destructive testing.

- [ ] **Production deployment:** Cloudflare production deployment ID, commit SHA, creation time, final stage status and root URL confirmed. Verify the deployed SHA against main.
- [ ] **Administrator:** school/session/term settings, staff invitations, staff classification, class/subject assignments, form-teacher assignments, announcements and audit history.
- [ ] **Staff classification:** management confirms each of the 8 existing staff classifications using appointment/job evidence; an authorised admin saves each selection in HR & Staff Records.
- [ ] **Form teachers:** management assigns the actual form teacher for every required class/session. Current persisted count is zero.
- [ ] **Teacher:** assigned class attendance, lesson upload/publication, assignment creation, grading, result entry and approval.
- [ ] **Student:** assigned published CBT start/save/submit/timeout/attempt-limit flow, assignment submission and published result/feedback.
- [ ] **Parent:** only linked learner records, attendance, fees, published results, messages and notification preferences.
- [ ] **Push:** test a consenting parent on a real Android device; record dispatcher result, recipient/device count and actual OS notification display separately. Confirm suspended/unlinked parent receives nothing.
- [ ] **Messaging:** direct and group messages, read receipts, unread count, reconnect, multi-device read state, mobile background/foreground and expired-session recovery. Current group-membership count is zero.
- [ ] **Drive:** upload a harmless test file, list, preview, download and authorised deletion; verify private/school visibility. Current bucket object count is zero.
- [ ] **Assignments:** teacher publish → student view → student submit evidence → teacher grade → student/parent feedback; verify wrong-class and suspended-user denial.
- [ ] **Admissions/external CBT:** use approved synthetic forms/candidates; test verified/unused form, one-time redemption, duplicate/concurrent requests, rejected/suspended candidate denial and exam assignment restrictions.
- [ ] **Finance:** verify pending payment and authorised manual Finance confirmation/receipt. Paystack remains inactive until merchant onboarding, signed webhook verification, idempotency and test-mode acceptance are completed.
- [ ] **ID cards:** student and staff front/reverse print at CR80 size; verify photo, QR, duplex alignment, QR scan and permission enforcement. PWA crest/favicon change requires fresh Android/iOS install testing.
- [ ] **Biometric station:** physical camera/scanner test, assigned-class restrictions, duplicate check-in/out rejection, station reconfiguration/portability and manual fallback.
- [ ] **Backup:** run the owner-triggered encrypted Dropbox workflow after secrets are configured privately; verify archive size/hash, retain passphrase separately, export completeness and isolated restore rehearsal. A merged workflow is not proof of a backup.
- [ ] **Training/sign-off:** admin, teacher, finance and parent-support staff complete the operating guide; school representative signs the final acceptance record.

## 4. Prioritised next actions

1. Obtain Cloudflare production deployment evidence and compare its commit with main. Do not deploy until the school release owner explicitly approves.
2. Reconcile the applied staff-classification migration SQL/version with the repository; then have school management classify the eight existing staff records.
3. Assign real form teachers for the required classes/sessions; verify teacher attendance access with controlled role tests.
4. Complete backup export verification and an isolated restore rehearsal before treating the existing records as protected.
5. Run controlled authenticated role/device tests for attendance/push, Drive, assignments, CBT, admissions, messaging and ID-card printing; record failures and evidence.
6. Review the 8,400 private message records by aggregate metadata and retention policy with school management. Do not inspect message bodies or delete records as part of this assessment.
7. Review the two no-policy rate-event tables' grants and the flagged SECURITY DEFINER functions individually; fix only confirmed exposure with a reviewed migration and explicit production approval.

## 5. Handover sign-off

| Responsibility | Name | Signature | Date |
|---|---|---|---|
| School proprietor / authorised representative |  |  |  |
| School administrator |  |  |  |
| Finance representative |  |  |  |
| JETAB TECH delivery representative |  |  |  |

**Status:** Controlled testing may continue. Final handover remains NO-GO until the critical gates above are evidenced and signed.


## 6. Dropbox backup destination inspection

A read-only listing of `/RESA MASTER BACKUP/` confirms that the seven planned top-level folders exist. However, this folder structure is not a completed backup:

- `02 Supabase Database`: 128 files, all `.paper` documents with reported size 200 bytes; no database dump/archive file was found.
- `03 Supabase Storage`: 14 files, all `.paper` documents with reported size 200 bytes; no Storage object archive was found.
- `07 Historical Backups`: one `.paper` status document only; no encrypted historical backup archive was found.
- `01 GitHub Source Code`: includes a 2,822,086-byte repository ZIP dated 20 November 2026, plus older Paper documentation pinned to commit `3e947089`.

**Backup verdict: NOT COMPLETE / NOT RESTORE-VERIFIED.** The source ZIP is useful but does not protect the live database, Auth identities or Storage object bytes. The owner-triggered encrypted Dropbox workflow on main must be run after its required GitHub Actions secrets are configured privately. Verify the uploaded encrypted archive's byte count and hash, preserve its passphrase separately, and perform an isolated restore rehearsal before treating it as a recovery point. No Dropbox file was changed during this inspection.


## 7. Attendance reminder / communication inbox follow-up (24 Nov, 15:20 WAT)

A second metadata-only query traced the large private-message volume to the attendance checkpoint reminder workflow; it is not evidence of 8,000 ordinary chat messages.

- `school_messages` contains 8,432 rows with subject `Attendance checkpoint alert`, all in the private channel and with no chat-conversation ID. 8,431 are unread.
- The cron job `resa-attendance-checkpoint-reminders` is active on `*/15 * * * *`; the last 24-hour job-run aggregate returned 96 successful runs.
- The deployed `resa_process_attendance_checkpoints()` function only sends reminders during the Lagos 10:00–20:00 window and throttles each pending alert to one reminder every 30 minutes.
- `attendance_checkpoint_alerts` currently has 266 pending alerts (109 staff, 157 students), with 4,188 reminders across those pending alerts; 7 alerts are resolved (3 staff, 4 students) with 28 reminders. The maximum reminder count on one alert is 17.
- The message volume is consistent with the reminder function delivering each reminder to two authorised recipients. The repeated reminders are therefore active configured behaviour, not a confirmed accidental chat loop.
- **Confirmed usability gap:** the live `resa_acknowledge_attendance_checkpoint(uuid,text)` RPC changes the alert to `acknowledged` and records who/when/note, but it does not mark the related `school_messages` rows as read. Thus acknowledging an alert does not clear its accumulated unread inbox entries. The UI calls this RPC and refreshes the alert list; no message-read cleanup is present in that RPC.

**Required fix proposal (not applied):** introduce a safe, explicit relation between each reminder inbox entry and its `attendance_checkpoint_alerts.id` (for example, a dedicated nullable alert-reference column with an FK and appropriate index), populate it when reminders are emitted, and have the acknowledgement transaction mark only that alert's related inbox rows as read. Preserve the separate repeated push/portal reminder cadence while the alert remains pending. Backfill old messages only where a deterministic, verified mapping exists; do not bulk-mark the current inbox read. Implement and test on an isolated database branch first, then reconcile the production migration history and obtain explicit approval before production application.

This is a high-priority Communication Centre acceptance item. No alert was acknowledged, no message was marked read, and no cron job or production function was changed during this investigation.


### Customer Care recipient configuration check

The 8,432 attendance-checkpoint messages have exactly **2 distinct recipients** and **1 sender**. The production recipient query currently finds 2 active admin memberships and **0 active staff users** whose department matches the configured HR/Customer Care audience. The eight staff records are currently distributed across `DEMO / ICT & Science` (3), `ICT` (4) and `Science` (1); none is in a Customer Care department. Therefore the current reminder function is reaching the two administrators, but there is no configured Customer Care staff login in its eligible audience. School management must nominate and activate the appropriate staff member, confirm their staff login and department, and then test recipient delivery. Do not reassign a real staff member or create an account without management approval.


## 8. Administrator-controlled responsibility appointments (new requirement, 24 Nov 2026)

School management has specified that special staff responsibilities must not be assigned through informal nomination, self-selection or direct role changes. The authorised school administrator must initiate each appointment and the required approval must be recorded before the responsibility becomes active. This requirement covers (at minimum) form teachers, Customer Care, attendance supervisor, examination officer, academic/non-academic coordinators, heads of department and any future school responsibility.

### Required operating rules

- The appointment directory must draw from verified, active school staff/person records. It must not be restricted to academic staff by default: eligible non-academic/support staff may be appointed to responsibilities appropriate to their duties.
- Apply role-specific eligibility checks. For example, a form-teacher appointment requires an active staff record linked to an authorised teacher account and an appropriate teaching assignment/qualification where the school requires one. Customer Care and attendance support responsibilities may be assigned to other eligible staff.
- An administrator selects the person, responsibility, scope (school-wide, department, class/session where applicable), effective date, optional end date and documented reason.
- The appointment remains pending until the authorised approval step is completed. The approver, appointing administrator, timestamps, decision, reason and any later amendment/revocation must be auditable. If policy permits a one-admin approval, it must still be an explicit approval action with actor and timestamp; otherwise enforce a separate approver.
- Only after approval may the portal activate the responsibility-specific capability. Never change school_memberships.role, profiles, or the user's base teacher/staff role to admin to implement a special appointment.
- Apply least privilege by responsibility and scope. Multiple distinct appointments for one person are allowed where policy permits. Prevent conflicting active appointments for the same unique scope (for example, two form teachers for one class/session unless co-teaching is explicitly supported).
- Notify the appointee after approval; expose current, pending, expired and revoked appointments to authorised administrators. A suspended, inactive or departed staff record must not retain active responsibility permissions.
- Revocation/replacement must stop the old responsibility's access promptly, preserve history and require the same audit discipline as appointment.

### Existing system evidence and implementation boundary

- The live schema already contains class_form_teachers with school_id, staff_id, class_id, academic_session_id, assigned_by and creation timestamp. Its existing RLS policy permits school admins to manage assignments and assigned teachers to read their own assignments. The live table currently has zero rows.
- staff has user_id, status, staff_category and a person_id; staff_qualifications stores qualification records. Existing school_memberships uses a separate base school_role and status. These are useful inputs but do not constitute a general appointment-and-approval workflow.
- Current inspection found no existing general-purpose responsibility appointment, approval or responsibility-audit table among the relevant public tables. The HR page currently manages staff records and classification, not approved special-duty appointments.
- No appointment table, permission policy, RPC, UI, notification, or production data was created or changed during this assessment.

### Safe implementation sequence

1. Reconcile the applied staff-classification migration (20261124063334_resa_staff_academic_classification) with its committed SQL source before creating any new migration. Do not guess or rewrite migration history.
2. Design a dedicated appointment record and append-only decision/audit history, with school-scoped foreign keys, status transitions, effective dates, scope, actor identities and explicit approval metadata.
3. Implement server-enforced RLS/RPC authorization. The browser must not be the security boundary. Only authorised school administrators may create/submit appointments; only authorised approvers may approve/reject/revoke; appointees may read their own approved appointments. Validate active staff, school membership, scope and responsibility-specific eligibility inside trusted database functions.
4. Connect each approved responsibility to narrowly scoped permission checks in the relevant portal features. Do not grant generic admin access or rely on UI hiding.
5. Integrate the management interface into HR & Staff Records, with a dedicated Responsibilities & Appointments panel, pending approval queue, appointment history and revocation/replacement workflow.
6. Add automated database and application tests for cross-school access denial, unauthorised self-appointment, approval separation/policy, staff suspension, expiration, revocation, multiple responsibilities, class/session conflicts and preservation of base roles.
7. Test against an isolated database and synthetic accounts; obtain review and explicit production approval before applying any migration or changing live appointments.

**Status: REQUIREMENT RECORDED / NOT IMPLEMENTED.** The appointment and approval workflow is a mandatory handover gate. Do not ask school management to manually nominate staff through a workaround; the system must provide the controlled administrator appointment process first.


Implementation tracking: [GitHub issue #140 — Implement administrator-approved staff responsibility appointments](https://github.com/peinceab1989/School-Platform-Foundation/issues/140).


## 9. Encrypted Dropbox backup workflow review (24 Nov 2026)

The repository contains an owner-triggered GitHub Actions workflow at `.github/workflows/resa-encrypted-dropbox-backup.yml` and exporter `scripts/resa_encrypted_dropbox_backup.py`. The workflow is manual (`workflow_dispatch`), runs only from `main` when triggered by `peinceab1989`, and has a 90-minute job timeout. It does not run on every push.

### Required GitHub Actions secrets

Required in the repository's private Actions secrets (never commit or paste them into chat):

- `RESA_DB_URL` — PostgreSQL connection URI for the RESA project; includes database credentials and must be treated as highly sensitive.
- `SUPABASE_URL` — HTTPS project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key; highly privileged.
- `RESA_BACKUP_PASSPHRASE` — strong passphrase of at least 20 characters; retain separately from Dropbox and GitHub.
- Dropbox authentication: either `DROPBOX_ACCESS_TOKEN` for a one-time/manual run, or the durable trio `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`. Prefer the refresh-token trio for repeatable runs because short-lived access tokens expire.

The workflow validates that the mandatory values exist but does not print them. No secrets were inspected, created or changed in this assessment.

### What the script actually exports

- PostgreSQL custom-format application database dump, excluding Supabase-managed/internal schemas listed in the script.
- Auth user records and selected metadata using an explicit allowlist. It intentionally excludes password hashes, active tokens, sessions, MFA factors and recovery codes.
- Storage bucket configuration and downloaded Storage object bytes, plus an object manifest.
- A safe PostgreSQL role inventory without role passwords.
- A manifest of counts and excluded categories.

The script encrypts the archive with GPG AES-256, verifies that it can decrypt the encrypted archive to `/dev/null`, deletes plaintext before upload, uploads to `/RESA MASTER BACKUP/07 Historical Backups/`, and verifies Dropbox-reported size and content hash plus a read-after-write metadata check. Temporary encrypted/plaintext files are removed at job end.

**Recovery limitation:** this is not a complete point-in-time clone of the Supabase project. It does not preserve Auth passwords/sessions/MFA, database role passwords, Supabase project/API secrets, Edge Function secrets or Supabase-managed internal schemas. A restore rehearsal must explicitly document password resets/re-invitations, MFA re-enrolment, secret reconfiguration and Edge Function redeployment. The exporter also needs a controlled restore procedure for database roles and Storage metadata/policies before it can be called fully restore-verified.

### Required completion evidence

1. Configure the listed secrets privately in GitHub Actions; do not send their values in chat.
2. Trigger the workflow manually from `main` only after verifying the exact selected branch and commit.
3. Record run URL, commit SHA, encrypted archive path, encrypted byte count, database dump bytes, Auth record count, Storage bucket/object counts and Dropbox hash verification outcome.
4. Verify the archive is present in Dropbox and retain its passphrase in a separate secure location.
5. Perform an isolated restore rehearsal, including application schema/data, Storage objects, Auth account recovery and secret/Edge Function reconfiguration.
6. Do not mark backup complete until restoration is proven and the recovery limitations are signed off.

**Status: WORKFLOW CODE PRESENT / SECRETS AND SUCCESSFUL RUN NOT VERIFIED / RESTORE NOT TESTED.** No backup workflow was triggered and no Dropbox data was changed during this review.


## 10. Responsibility appointment implementation design notes

The following is a design baseline for issue #140, not executable migration SQL. It must be validated against the complete schema and tested before adoption.

### Proposed records and lifecycle

- `staff_responsibility_appointments`: one record per staff member, responsibility key, school and scope; include staff/person linkage, optional department/class/session scope, effective date range, reason, appointing actor, approval actor/time/note, lifecycle status, revocation actor/time/reason and created/updated timestamps.
- `staff_responsibility_appointment_events`: append-only event history for submission, approval, rejection, revocation, replacement and expiry; capture actor, event time, previous/new state and a bounded note. Direct authenticated update/delete must be denied.
- Responsibility catalogue: a controlled list of built-in responsibilities and scope/eligibility metadata, with a reviewed path for school-specific additions. Do not let an arbitrary free-text role create permissions.

### Server-side authorization model

- Submission, approval, rejection, revocation and replacement should be exposed through narrowly scoped database RPCs, not direct table writes from the browser.
- Each RPC must validate `auth.uid()`, active admin membership for the same school, school/staff/class/session relationships, status transition, effective dates, and responsibility-specific eligibility. All SECURITY DEFINER functions must set an empty/fixed `search_path`, schema-qualify objects and revoke execution from `PUBLIC`/`anon`.
- Read policy: school admins may read their school's appointments; an appointee may read only their own appointment summary. Qualification evidence and HR-only details remain admin-only.
- Approval separation should be an explicit school policy. The safe default is a different authorised admin from the appointing actor; if management chooses a single-admin exception, record that it was a one-person approval and why.
- An `has_active_staff_responsibility(...)` helper should check approved status, effective dates, active staff record and active school membership every time a protected feature is accessed. Revocation/suspension must therefore take effect immediately without relying on stale UI state.

### Scope and conflict handling

- Scope types should be explicit: school, department, class/session. Store foreign keys for class/session and validate that they belong to the same school.
- A person may hold several compatible responsibilities. Prevent overlapping active appointments for the same responsibility and exact scope; use transactional locking/RPC checks so two concurrent administrators cannot create conflicting assignments.
- A form-teacher appointment requires an active staff record linked to an active `teacher` membership for the same school, and class/session scope. Do not rely only on `staff_category='academic'`; that classification is an HR attribute, not proof of teacher access or qualification.
- Customer Care, attendance supervision and administrative support can be assigned to other eligible active staff. Qualification checks should be responsibility-specific and based on verified school records, not a blanket academic-only filter.

### Integration and tests

- Keep the appointment register and approval queue inside HR & Staff Records. Reuse the existing staff directory; do not create a second employee directory.
- Replace direct form-teacher assignment writes with the appointment approval flow, then synchronize/derive the existing `class_form_teachers` operational assignment only after approval, or migrate consumers to the shared responsibility helper after a complete dependency audit. Do not create two independent sources of truth.
- Add server-side capability checks to every relevant data path (not merely menu visibility): attendance, class rosters, examinations, results, communications and Customer Care alerts.
- Test unauthorised submission/approval, cross-school access, self-approval policy, inactive/suspended staff, expired/revoked appointments, concurrent conflicting appointments, teacher eligibility, non-academic support eligibility, multi-appointment compatibility and base-role immutability.

### Environment constraint

The Supabase project currently lists only its production `main` branch. Supabase development branches can incur additional hourly compute/usage charges; none was created. Until a no-cost isolated PostgreSQL/Supabase test environment is available, the migration and RLS/RPC implementation must remain unmerged and unapplied. GitHub's existing TypeScript/build checks do not prove database security correctness.


## 11. Full migration-history drift recheck (24 Nov 2026)

A fresh exact-version comparison was run against `main` commit `7dc67c9` and the live Supabase migration registry at assessment time:

| Measure | Current result |
|---|---:|
| Live Supabase migration versions | 127 |
| SQL files in `supabase/migrations/` on main | 57 |
| Exact version IDs present in both | 36 |
| Live versions without an exact filename/version match in main | 91 |
| Repository versions not recorded in live migration history | 21 |

These are exact version-ID comparisons, not proof that every unmatched SQL operation is missing or unapplied. Some operations may have been applied under different version IDs, while some repository-only files may be pending or historical. PR #141 was subsequently merged as a rename-only change: the existing staff-classification SQL was moved to the exact applied version filename `20261124063334_resa_staff_academic_classification.sql`, with the SQL content unchanged. Based on that one-file rename and no other migration changes, the expected exact-ID counts are now 37 matches, 90 live versions without exact file matches, and 20 repository-only versions. A fresh registry/tree comparison should confirm these counts before any future migration rollout. This correction does not resolve the substantial remaining migration-history drift.

The previously recorded recovery experiment in [the migration recovery plan](https://github.com/peinceab1989/School-Platform-Foundation/blob/improvement/editable-existing-classes/docs/RESA-DATABASE-MIGRATION-RECOVERY-PLAN-2026-11-22.md) found that a fresh local replay stops at the first migration because `public.online_exams` is absent from the repository baseline. Therefore neither a full `supabase db reset` nor a normal migration replay is currently a safe validation path.

**Mandatory release restriction:** do not run `supabase db push`, `db pull`, `migration repair`, linked reset, or apply any new migration to production as a shortcut. A reviewed schema-only baseline and complete migration-history reconciliation are required before reliable full replay. The responsibility appointment migration remains blocked until this prerequisite and an isolated test database are available.
