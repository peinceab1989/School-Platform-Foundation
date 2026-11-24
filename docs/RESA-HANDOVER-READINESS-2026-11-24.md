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
