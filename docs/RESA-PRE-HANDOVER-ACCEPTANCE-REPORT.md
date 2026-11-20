# RESA Digital Campus — Pre-Handover Acceptance & Readiness Report

**School:** RHEMA EXPLOITS SCIENCE ACADEMY INT'L  
**Project repository:** peinceab1989/School-Platform-Foundation  
**Supabase project:** School digital portal (mhwwzzxwpsqwhxrsuwaa)  
**Assessment date:** 20 November 2026  
**Report status:** **NOT ACCEPTED FOR FINAL HANDOVER — controlled acceptance tests and recovery evidence remain outstanding.**

## 1. Executive assessment

The RESA platform has substantial implemented functionality and recent source-level improvements. The live Supabase project was previously observed as ACTIVE_HEALTHY. The current assessment does not establish that every role-based user journey, device notification, payment flow or disaster-recovery procedure works end to end.

This report deliberately distinguishes source/CI evidence from production evidence. A successful build, a merged pull request, an HTTP 200 response or a healthy database does not by itself prove that the school can safely operate the feature.

No production database records, Auth users, Storage objects or schema were changed during this reassessment. The RESA push dispatcher was deployed to version 4 after a live-schema preflight and successful CI validation. No test notification was sent, and no manual Pages production deployment was initiated; GitHub merges may trigger automatic Cloudflare builds.

## 2. Verified evidence and current status

| Area | Evidence observed | Acceptance status |
|---|---|---|
| Push notification audience protection | PR #88 merged; nine parent-audience authorization tests passed in GitHub Actions | Source validated; live reconciliation and device delivery pending |
| Live push dispatcher | Supabase reports `resa-push-dispatch` ACTIVE, version 3; deployed source lacks the newer parent-audience helper | **Blocker** |
| Push runtime logs | Recent dispatcher requests returned HTTP 200; log response does not prove a device displayed the alert or identify a successful recipient | Not accepted |
| Messaging unread-count recovery | PR #92 remains open/draft; associated TypeScript/build/Edge Function typecheck run succeeded; Cloudflare preview succeeded | Review and role/device tests pending |
| RESA Drive visibility | Migration `20261115102316` is present in live migration history | Schema change verified; upload/list/preview/download user journey pending |
| Assignments | Assignment routes and source improvements are present | Teacher-to-student lifecycle not accepted |
| Student CBT | Live `resa-student-cbt` function v6; authenticated user lookup and active student membership checks are present in inspected source | Controlled exam lifecycle tests pending |
| External CBT | Live external CBT function v1; candidate authentication, approved-candidate checks and assigned-exam lookup are present in inspected source | Candidate registration/approval/attempt/results tests pending |
| External candidate registration | Live registration function v1; hashed-key rate event checks and form-purchase verification are present | Concurrency, duplicate, abuse and rollback tests pending |
| Admission application | Live admission submit function v1; verified/unused admission-form check, class validation and rate-event checks are present | Duplicate redemption, concurrency, application review and end-to-end tests pending |
| Backup | Dropbox backup root and seven folders exist; text snapshots, schema/migration metadata and selected Edge Function source are present | **Partial only — not disaster-recovery ready** |
| Training | Role-based operating guide drafted alongside this report | School validation and practical training sign-off pending |

## 3. Critical release blockers

### A. Push dispatcher reconciliation
- Live dispatcher is ACTIVE version 4 and includes `index.ts` plus `parent-audience.ts` from the schema-aligned mainline.
- Live schema preflight confirmed the real `student_parent_guardians` table has no `is_active` column; the deployed query now uses relationship-row presence and requires the separate active `parent_student_portal_access` row.
- The webhook token and both VAPID key settings were confirmed configured without exposing their values.
- The existing `verify_jwt=false` invocation contract was preserved because the function validates test-user sessions and database webhook tokens internally.
- Next, test one consenting account per role and a parent linked to a test learner. Confirm positive delivery and denial for a suspended/unlinked parent. Do not equate push-service acceptance with actual Android display.
- Record the server response, recipient/device counts and actual Android notification display separately. Do not equate accepted-by-push-service with displayed-on-device.

### B. Messaging and mobile unread counts
- PR #101 is merged after CI passed; PR #92 was closed as superseded.
- Real Android/mobile acceptance is still outstanding.
- Review request ordering, stale responses, read-receipt behavior, Realtime subscription recovery and polling cleanup.
- Test two sessions for one account and separate parent, teacher, student and admin accounts.
- Confirm unread counts remain correct after new message, read, mark-read-on-another-device, offline/online transition, browser background/foreground and expired session.
- Confirm mobile layout, notification permissions and VAPID configuration. A browser badge count is not a substitute for push delivery.

### C. Drive and assignments
- The Drive visibility constraint migration is live, but no controlled user journey is accepted by this report.
- Use a harmless test file. Verify upload, metadata creation, list display, preview/open, download and authorised deletion. Confirm private/staff/parent/school visibility boundaries.
- Test assignments through teacher creation/publication, student visibility, submission, teacher grading, feedback visibility and deadline enforcement.
- Verify access denial for a student outside the assigned class and for a suspended account.

### D. CBT and admissions
- Student CBT: verify only the learner's active enrolments and published/scheduled exams are returned; test start, save/submit, timeout, attempt limits, duplicate submit and results transfer.
- External CBT: verify only approved candidates with assigned exams can list/start/submit; test pending, rejected and suspended candidates; test expired assignments and attempt limits.
- Candidate registration: verify purchased/verified form requirement, one-time redemption, duplicate email/form handling, rate limits, concurrent requests and cleanup/rollback when account creation fails.
- Admissions: verify verified and unused admission form, valid school/class/session, duplicate submissions, concurrent redemption, application review and safe handling of invalid forms.
- Use synthetic test identities and non-production/test exam content. Never test by deleting or modifying real learner records.

## 4. Disaster-recovery backup — current boundary

The Dropbox root `/RESA MASTER BACKUP/` contains the seven planned folders and a manifest. The manifest explicitly records that the backup is partial.

Existing materials include:
- Selected GitHub source text snapshots and a 370-path inventory pinned to an older commit. A new disaster-recovery runbook is included in the handover documentation.
- Database schema, migration and function metadata, plus selected partial table exports.
- Selected deployed Edge Function source snapshots.
- Selected website source/configuration notes.

Not verified as backed up:
- A complete byte-for-byte GitHub ZIP/TAR for the current main commit.
- A complete, consistent PostgreSQL dump of all required schemas and data.
- Supabase Auth users/configuration export through an approved secure route.
- Actual bytes for every Storage object, including the existing profile-photo object.
- Complete current Edge Function deployable bundle and configuration inventory.
- Full website deployment/media bundle and non-secret configuration.
- Actual school documents and JETAB TECH business assets.
- Checksums for the complete export set and a successful isolated restore rehearsal.

**Do not delete test data, alter production records or mark the backup complete until the exports are verified and a restore has been rehearsed in a separate disposable environment.** Secrets must remain outside Dropbox and outside chat.

## 5. Required acceptance test matrix

For each test, record tester, role, date/time, test account identifier (non-sensitive), expected result, actual result, evidence reference and pass/fail.

- [ ] Admin: invite/approve staff, assign class/subject, publish announcement and verify audit trail.
- [ ] Admissions: verify form, submit application, review/approve and enrol learner without duplicate record.
- [ ] Teacher: take attendance, publish lesson material, create assignment, grade submission and enter results.
- [ ] Student: view assigned CBT, complete test, submit assignment and view published result/feedback.
- [ ] Parent: verify only linked learner data, attendance, fees, results, messages and notification settings.
- [ ] Finance: verify pending payment, reconcile evidence, confirm payment and generate one official receipt.
- [ ] Drive: upload, list, preview, download and authorised delete with visibility boundary tests.
- [ ] Messaging: direct/group message, read receipts, unread count, reconnect and mobile background recovery.
- [ ] Push: test notification displayed on a real Android device; verify unauthorised recipient receives nothing.
- [ ] Security: suspended/unlinked users denied; cross-school and cross-class access denied.
- [ ] Backup: full exports, byte counts, SHA-256 manifest and isolated restore rehearsal completed.
- [ ] Operations: school staff trained and escalation contacts documented.

## 6. Release decision

**Current decision: NO-GO for final school handover.**

The system may continue in controlled testing. Do not describe it as fully accepted, fully backed up or production-ready for unrestricted school operation until all critical tests pass and the school signs the acceptance record.

### Conditions to change the decision to GO
1. Push dispatcher source reconciled with live version and tested on real Android devices.
2. PR #92 reviewed, approved and mobile unread-count tests passed.
3. Drive and assignment journeys passed for the relevant roles.
4. Student CBT, external CBT and admissions tests passed, including negative/abuse cases.
5. Complete backup exports verified and isolated restore rehearsal passed.
6. Role-based training delivered and recorded.
7. No unresolved critical/high security finding; known limitations and support ownership documented.
8. School representative signs the final acceptance record.

## 7. Sign-off record

| Responsibility | Name | Signature | Date |
|---|---|---|---|
| School proprietor / authorised representative |  |  |  |
| School administrator |  |  |  |
| Finance representative |  |  |  |
| JETAB TECH delivery representative |  |  |  |

**Important:** This is a pre-handover assessment, not a certificate of successful production acceptance.
