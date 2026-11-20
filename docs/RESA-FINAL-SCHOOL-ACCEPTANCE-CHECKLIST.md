# RESA Final School Acceptance Checklist

**Purpose:** Record evidence that RESA is ready for school handover. A passing CI build is necessary but does not replace school-user acceptance.

**Release rule:** Keep PR #120 in draft and do not merge, apply its migrations, or deploy it until all applicable checks below have evidence, the backup and restore rehearsal are complete, and the school owner explicitly approves release.

## 1. Safety and release controls

- [ ] Confirm current production URL, Cloudflare project, GitHub main SHA, and Supabase project reference.
- [ ] Confirm no unexpected production deployment or database migration occurred during testing.
- [ ] Confirm no paid API, subscription, plan upgrade, WhatsApp API, or other billable service was enabled.
- [ ] Confirm Paystack remains inactive unless the school separately authorises merchant onboarding, transaction fees, test mode and production activation.
- [ ] Confirm test accounts and test records are clearly identified; do not delete/reset existing data without a separate explicit instruction.
- [ ] Record PR number, head SHA, CI run URL, reviewer and release decision.

## 2. Administrator acceptance

- [ ] Sign in using the authorised administrator account; verify role and school scope.
- [ ] Dashboard counts and navigation load without console or server errors.
- [ ] Create a test class only in an agreed test context; edit an existing class name and verify linked students, teachers, attendance, results and reports remain attached to the same class identity.
- [ ] Edit a subject and verify linked class allocations, assignments and results remain correct.
- [ ] Assign a teacher to a class and subject; verify teacher dashboard access.
- [ ] Approve/reject a pending workflow and verify the resulting status and audit history.
- [ ] Verify school settings, session/term, contact details and role permissions.
- [ ] Verify administrator can find and access the relevant student/staff records without exposing another school's data.

## 3. Teacher acceptance

- [ ] Sign in as an active teacher on Android and desktop.
- [ ] Verify assigned classes and subjects only.
- [ ] Open class list, student profiles, attendance, assignments and results.
- [ ] Create and publish an assignment; submit as a student; grade and return feedback.
- [ ] Enter CAT 1, CAT 2, examination and coursework marks within configured maxima.
- [ ] Confirm totals, grades, completeness indicators and published report card.
- [ ] Verify teacher cannot access unauthorised administration, finance or other classes.

## 4. Student and parent acceptance

- [ ] Sign in as an active enrolled student; verify the correct dashboard and profile photo.
- [ ] Verify only published exams are visible and attempt/submit an approved test.
- [ ] Verify published results and downloadable/printable one-page A4 report.
- [ ] Sign in as the linked parent; verify only linked child records are visible.
- [ ] Verify attendance, fees, assignments, results and communication views.
- [ ] Verify parent cannot see another family's records.

## 5. Attendance and notifications

- [ ] Test staff and student clock-in/clock-out with the configured method.
- [ ] Test the approved fallback when a card/device is unavailable.
- [ ] Confirm a fresh daily attendance record, correct timestamps and duplicate-event handling.
- [ ] Confirm parent attendance preferences persist across sign-in and reload.
- [ ] Confirm disabling the parent's phone-alert preference stops future attendance Web Push even if the general RESA notification preference remains enabled.
- [ ] Confirm one attendance event produces one foreground system notification when push is registered (no duplicate local + Web Push alert).
- [ ] On a real Android parent device, grant browser notification permission and register a subscription.
- [ ] Trigger a real test attendance event and confirm the parent receives the correct notification at the correct time—not merely when enabling alerts.
- [ ] Verify in-app notification, push delivery log, recipient targeting and acknowledgement.
- [ ] Verify absent-from-10am escalation only after the school confirms the exact threshold, recipients, repeat interval and acknowledgement workflow.
- [ ] Record device model, Android/browser version, account role, test time and result.

## 6. Messaging

- [ ] Test one-to-one messages between authorised parent/teacher/admin test accounts.
- [ ] Test group creation, membership, removal and school-role restrictions.
- [ ] Verify unread counts, read receipts, refresh/reconnect and notification behaviour across two real devices.
- [ ] Verify suspended/inactive users cannot read or send messages.
- [ ] Test permitted attachment upload, preview and download; verify file access is scoped to conversation membership.
- [ ] Do not represent WhatsApp automation, voice/video calls or live classes as available unless independently implemented and tested.

## 7. RESA Drive and assignments

- [ ] Upload a permitted test file using an authorised account.
- [ ] Confirm the file appears in the expected folder after refresh and a new sign-in.
- [ ] Preview, download and delete only the test file after confirming retention rules.
- [ ] Verify file-size limits, allowed types, access controls and cross-user isolation.
- [ ] Complete assignment creation, publication, student submission, teacher grading and parent/student visibility.
- [ ] Confirm failed uploads show a clear error and do not create misleading success records.

## 8. Admissions and CBT

- [ ] Submit an enquiry and confirm delivery to resainternational2024@gmail.com.
- [ ] Complete the approved admissions application validation path.
- [ ] Verify application status, review, approval/rejection and applicant notifications.
- [ ] Test external-candidate registration and admission-form purchase/validation only after the school confirms the actual payment flow and zero-cost implications.
- [ ] Verify external CBT candidates are isolated from enrolled-student accounts and exams.
- [ ] Verify published exams, timing, attempt limits, answer-key protection, scoring and results.
- [ ] Test enrolled-student CBT separately from external-candidate CBT.

## 9. Fees and payments

- [ ] Verify fee items, balances and pending payment states.
- [ ] Verify offline payment evidence is pending until finance verification.
- [ ] Verify receipts are issued only after confirmed finance approval.
- [ ] Verify duplicate payment submissions/references are safely rejected or idempotently replayed.
- [ ] Review draft Paystack implementation PR #123 and confirm the exact passing CI head SHA.
- [ ] Review the private intent-ledger migration in an isolated database; test fee reservation, expiry, concurrency, overpayment, idempotency and duplicate provider transaction IDs.
- [ ] Configure Paystack test secret and webhook signing secret only in Supabase secrets (never in chat, source code or browser variables).
- [ ] Deploy the Edge Function to a non-production/test environment with webhook JWT verification disabled only because the handler independently authenticates parent actions and verifies webhook signatures.
- [ ] Complete test-mode parent checkout, failed/cancelled payment, duplicate webhook, forged signature, stale timestamp, wrong-parent, partial/full payment and official receipt tests.
- [ ] Verify reconciliation and Finance reporting against the Paystack dashboard before any live activation.
- [ ] Keep Paystack disabled until merchant ownership, transaction charges, test-mode verification, signed webhook validation, reconciliation and written school approval are complete.

## 10. Public website and assistant

- [ ] Check public pages at mobile and desktop widths.
- [ ] Verify official school name, motto, address, contact information, admissions email and map destination.
- [ ] Verify links, forms, privacy boundaries and accessible labels.
- [ ] Confirm the assistant answers only from its reviewed local knowledge base.
- [ ] Ask an unknown question and confirm it admits the limitation and offers school contact routes.
- [ ] Confirm no paid AI endpoint or paid provider is called by the public assistant.
- [ ] Verify Customer Care status and WhatsApp handoff without implying that WhatsApp automation is configured.

## 11. Backup and disaster recovery

- [ ] Export the exact GitHub main and release-candidate source (full repository archive or Git bundle) and record SHA-256 and commit SHA.
- [ ] Export Supabase schema, migrations, roles/grants and database data using a verified remote dump procedure.
- [ ] Handle Auth user exports/password hashes as highly sensitive; encrypt before storage and restrict access.
- [ ] Export actual private Storage object bytes, not just object names/counts; verify sizes and hashes.
- [ ] Include approved school-owned assets and operational documents.
- [ ] Exclude API keys, service-role keys, passwords, VAPID private keys and other secrets from ordinary Dropbox backup files. Store secrets separately in an approved password manager.
- [ ] Copy to the seven approved folders under /RESA MASTER BACKUP/ without moving or deleting originals.
- [ ] Verify each copied file by size/hash and record missing items.
- [ ] Rehearse restore into an isolated, non-production environment without overwriting live data.
- [ ] Record restore duration, errors, recovered counts and any limitations.

## 12. Security and privacy

- [ ] Review RLS for every table changed by the release; test both authorised and unauthorised roles.
- [ ] Review SECURITY DEFINER functions individually: fixed search_path, minimal grants, explicit school/role checks and safe inputs.
- [ ] Confirm public endpoints expose only intended public school information.
- [ ] Confirm no service-role or provider secrets are present in browser bundles, source-controlled env files, logs or public documents.
- [ ] Review storage policies and signed URL expiry/visibility.
- [ ] Document residual Supabase advisor findings and why each is accepted or remediated.
- [ ] Document Free-plan limitations, including unavailable leaked-password protection if still applicable.

## 13. Evidence and final sign-off

For every test, record: **test ID, date/time, environment, tester role, device/browser, test data identifier (non-sensitive), expected result, actual result, pass/fail, evidence link and defect reference**.

Release gates:
- [ ] All critical/high defects resolved or formally accepted by the school.
- [ ] CI passes on the exact release candidate SHA.
- [ ] Backup verification and isolated restore rehearsal pass.
- [ ] Administrator, teacher, student and parent representatives approve their journeys.
- [ ] School owner approves production migration/deployment and handover.
- [ ] Rollback owner, rollback steps and post-release monitoring window are recorded.

**Current known gaps at the last read-only production review (20 November 2026):** one push subscription; zero parent notification-log rows; zero RESA Drive file records; zero admission applications; zero external-candidate registrations; one chat message; zero group members. These counts are diagnostic snapshots, not proof of failure by themselves. Real user journeys must be tested and evidence recorded.

**Important:** Never use production data cleanup, database reset, destructive test scripts, or production migrations as a shortcut to make this checklist pass.