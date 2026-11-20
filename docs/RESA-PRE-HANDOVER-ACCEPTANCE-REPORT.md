# RESA Digital Campus — Pre-Handover Acceptance & Readiness Report

**School:** RHEMA EXPLOITS SCIENCE ACADEMY INT'L  
**Project repository:** peinceab1989/School-Platform-Foundation  
**Supabase project:** School digital portal (mhwwzzxwpsqwhxrsuwaa)  
**Assessment date:** 20 November 2026  
**Source baseline:** `c88373091057c1600b6b4550a5f6f9f99d79fddd`
**Report status:** **NOT ACCEPTED FOR FINAL HANDOVER — controlled acceptance tests and recovery evidence remain outstanding.**

## 1. Executive assessment

The RESA platform has substantial implemented functionality and recent source-level improvements. The live Supabase project was previously observed as ACTIVE_HEALTHY. The current assessment does not establish that every role-based user journey, device notification, payment flow or disaster-recovery procedure works end to end.

This report deliberately distinguishes source/CI evidence from production evidence. A successful build, a merged pull request, an HTTP 200 response or a healthy database does not by itself prove that the school can safely operate the feature.

No production learner, staff, parent, attendance, assignment, submission, grade, Auth-user or Storage-object records were modified. Two additive production security migrations were applied to harden parent and teacher access, and the RESA push dispatcher was deployed to v4 after live-schema preflight and successful CI validation. No test notification was sent, and no manual Pages production deployment was initiated; GitHub merges may trigger automatic Cloudflare builds.

## 2. Verified evidence and current status

| Area | Evidence observed | Acceptance status |
|---|---|---|
| Push notification audience protection | PR #88 merged; schema-alignment PR #100 merged; nine parent-audience authorization tests passed | Live v4 deployed; real device delivery pending |
| Live push dispatcher | Supabase reports `resa-push-dispatch` ACTIVE v4 with schema-aligned parent-audience helper; webhook and VAPID configuration presence verified | Device delivery pending |
| Parent access hardening | PR #103 migration applied; all 3 active parent accounts passed helper checks for their 1, 2 and 2 active linked children | Helper verified; device journey pending |
| Teacher/student access hardening | PR #104 migration applied; broad school-wide teacher reads removed from sensitive student/person policies | RLS impersonation tests passed for assigned/unassigned teacher, admin, student and parent |
| Form-teacher attendance | 27 student attendance rows; zero persisted form-teacher assignments; temporary assignment test read all 27 rows and rolled back | Admin must assign actual form teachers before launch |
| Push runtime logs | Last 24h sample: 639 requests on v3 before deployment and 40 requests on v4 after deployment; all returned HTTP 200. Webhook token and both VAPID keys are configured; 12 database event triggers call the dispatcher | Event endpoint accepted requests; real device display/delivery still not proven |
| Messaging unread-count recovery | PR #101 merged after TypeScript, production build and Edge Function checks passed | Mobile/cross-device tests pending |
| RESA Drive visibility | Migration `20261115102316` is present; private `resa-drive` bucket is 100 MB capped and currently contains zero objects | Policy/source reviewed; actual file journey pending |
| Assignments | 5 published assignments, 18 submissions (all graded); role RLS tests and grading RPC transaction test passed | Database authorization verified; real UI/file journey pending |
| Student CBT | Function v6 ACTIVE; 4 published exams, 16 questions, 21 attempts all match active enrolment; answer keys excluded from student question response; role RLS tests passed | Server/RLS checks passed; real student exam journey pending |
| External CBT | Function v1 ACTIVE; approved-candidate and assigned-exam checks inspected; save/submit RPCs service-role-only; no external candidates or assignments exist | End-to-end tests blocked by zero test candidate data |
| External candidate registration | Function v1 ACTIVE; verified form purchase and one-time redemption checks; no external candidate/form-purchase records exist | End-to-end tests pending |
| Admission application | Live admission submit function v1; verified/unused admission-form check, class validation and rate-event checks are present | Duplicate redemption, concurrency, application review and end-to-end tests pending |
| Backup | Dropbox root/seven folders and runbook exist; selected source/schema metadata present | **Partial only — no full DB/Auth/Storage export or restore rehearsal** |
| Training | Role-based operating guide and disaster-recovery runbook merged | School validation and practical training sign-off pending |

## 3. Critical release blockers

### A. Push dispatcher v4 — post-deployment validation
- Live dispatcher is ACTIVE version 4 and includes `index.ts` plus `parent-audience.ts` from the schema-aligned mainline.
- Live schema preflight confirmed the real `student_parent_guardians` table has no `is_active` column; the deployed query now uses relationship-row presence and requires the separate active `parent_student_portal_access` row.
- The push secret resolver confirms the webhook token, VAPID public key and VAPID private key are all configured (values intentionally not read into this report). Twelve database triggers are wired for attendance, messages, chat, announcements, results, assignments, exams, fees, timetable and admissions events.
- Log aggregation shows 40 dispatcher v4 HTTP 200 requests after deployment (and 639 v3 requests before it in the same 24-hour window). HTTP 200 proves the function accepted the webhook request; it does not prove a phone displayed a notification. No test push was sent to a real device during this audit.
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
- The Drive visibility constraint migration is live; the private Drive bucket currently has zero objects. A controlled upload/preview/download test is still required.
- Assignment database access is verified: 5 published assignments, 18 submissions (all graded), student/parent/teacher/admin RLS checks passed, and the authorised teacher grading RPC returned true in a rolled-back test transaction. Real UI/device submission and evidence-file tests remain required.
- Use a harmless test file. Verify upload, metadata creation, list display, preview/open, download and authorised deletion. Confirm private/staff/parent/school visibility boundaries.
- Test assignments through teacher creation/publication, student visibility, submission, teacher grading, feedback visibility and deadline enforcement.
- Verify access denial for a student outside the assigned class and for a suspended account.

### D. CBT and admissions
- Student CBT source and RLS checks are verified: 4 published exams, 16 questions, 21 attempts; every attempt matches an active enrolment and published exam. Student direct reads cannot see exam questions or answer rows; the authenticated Edge Function must serve the exam, and the inspected question-list response excludes correct answers.
- Complete real student exam start/save/submit/timeout/attempt-limit/results journey on a test account.
- External candidate and admission tables currently contain no candidate/form/application data; their Edge Function source checks are reviewed but end-to-end acceptance must wait for approved synthetic test forms and candidates.
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

### E. Form-teacher setup and attendance
- There are currently zero persisted `class_form_teachers` assignments. The admin Form Teacher & Attendance page exists and can assign a teacher to a class/session.
- A temporary assignment in a rolled-back transaction allowed the assigned teacher to read all 27 attendance rows for that class/session; the temporary row was rolled back and no live assignment was retained.
- Before school launch, management must select the actual form teacher for each relevant class/session and save those assignments in the admin page. Do not infer or autoassign staff.

## 5. Required acceptance test matrix

For each test, record tester, role, date/time, test account identifier (non-sensitive), expected result, actual result, evidence reference and pass/fail.

- [ ] Admin: invite/approve staff, assign class/subject, publish announcement and verify audit trail.
- [ ] Admissions: verify form, submit application, review/approve and enrol learner without duplicate record.
- [ ] Teacher: take attendance, publish lesson material, create assignment, grade submission and enter results.
- [ ] Student: view assigned CBT through the Edge Function, complete test, submit assignment and view published result/feedback.
- [ ] Parent: verify only linked learner data, attendance, fees, results, messages and notification settings.
- [ ] Finance: verify pending payment, reconcile evidence, confirm payment and generate one official receipt.
- [ ] Drive: upload a controlled file, list, preview, download and authorised delete with visibility boundary tests.
- [ ] Form teacher: admin assigns the selected teacher/class/session; teacher verifies attendance list and comparisons on the live account.
- [ ] Messaging: direct/group message, read receipts, unread count, reconnect and mobile background recovery.
- [ ] Push: test notification displayed on a real Android device; verify unauthorised recipient receives nothing.
- [ ] Security: suspended/unlinked users denied; cross-school and cross-class access denied.
- [ ] Backup: full exports, byte counts, SHA-256 manifest and isolated restore rehearsal completed.
- [ ] Operations: school staff trained and escalation contacts documented.

## 6. Release decision

**Current decision: NO-GO for final school handover.**

The system may continue in controlled testing. PR #106 is the current-main parent payment UI proposal; it is not merged. GitHub Actions TypeScript/production build is still running, Netlify checks fail while the team's build quota is exhausted, and a RESA Cloudflare preview has not yet been recorded for this PR. Do not describe it as fully accepted, fully backed up or production-ready for unrestricted school operation until all critical tests pass and the school signs the acceptance record.

### Conditions to change the decision to GO
1. Push dispatcher v4 source reconciled and configured; real Android delivery and parent attendance event tests passed.
2. PR #101 unread-count recovery merged; real Android parent/teacher/student/admin tests for cross-device read state, foreground/background recovery and offline reconnect passed.
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
