# RESA launch-readiness audit — 1 November 2026

## Scope and safety

This audit reviewed the live Supabase project, deployed Edge Functions, GitHub source, latest CI workflow, and public Netlify site. No production database rows, RLS policies, Edge Functions, or public deployment were changed during the audit.

The remediation branch is `resa/launch-readiness-hardening`. Its changes are isolated in draft PR #10 and must not be treated as deployed.

## Confirmed release blockers

### 1. Receipt privacy
The live policy `school members can read student payment receipts` allowed any authenticated school member to read all receipt rows for that school. The remediation migration in this branch removes that broad policy and allows the linked parent/guardian and linked student to read the receipt; the existing admin ALL policy remains. This SQL has not been applied to production and still requires role-by-role RLS testing.

### 2. Student CBT access
The live CBT function checks for an active student record, active student membership, active class/session enrolment, and published exam. The live `student_cbt` module switch is enabled. The latest data review found 11 active enrolments matching published exams, but only five students had a linked Auth user and active student membership; six therefore cannot sign in to access CBT until their real identities are linked and invitations accepted. Do not create dummy accounts or assign guessed email addresses.

The deployed CBT function source has been synchronised to GitHub in this branch so the clearer no-enrolment/no-published-exam states are retained in source control. A final source comparison confirmed exact matches for all ten live Edge Function entrypoint files.

### 3. Parent activation
The deployed activation function supports parent invitation acceptance and portal activation; the repository copy did not contain this deployed parent workflow. The deployed source has been synchronised to GitHub in this branch. The live parent invitation function was also missing from the repository and has now been added to this branch. The deployed seed/cleanup functions were also ahead of GitHub and are now synchronised. A comparison of all ten live Edge Function entrypoints against the branch confirms exact source matches. These source-control changes do not themselves create or activate parent accounts. The previous data check found zero active parent portal accounts.

### 4. Fees and receipts
The previous live data check found zero fee assignments, payments, receipts, discounts, and enabled parent fee views. A finance workflow has now been implemented in the remediation branch: admin fee types and term-aware student assignments, verified school bank accounts, parent fee statements, linked-parent visibility rows, pending bank-transfer submissions, admin verification/rejection, partial payment balance calculation, active amount/percentage discounts, duplicate reference protection, and printable statements and verified receipts. A further policy migration restricts fee discount visibility to the relevant family and administrators, rather than all school members. The database migrations are additive and remain unapplied to production. The approval RPC records a payment and issues its receipt in one transaction; a parent reference submission alone never marks a fee as paid. This work still requires isolated database/RLS testing and a controlled deployment before it can be used live.

### 5. External CBT and admissions
The live database review found no separate external-candidate CBT workflow or trusted form-purchase verification flow. The current public admissions page was informational/enquiry-only. The remediation branch now contains an additive external-candidate schema, one-time verified CBT form redemption, a public registration Edge Function, trusted `app_metadata` candidate routing, a separate candidate portal, admin candidate approval, exam assignment, timed attempts, server-side saved-answer restoration, server-enforced deadline handling, objective grading, manual written-answer marking and result publication. External candidates remain outside the ordinary student and term-results tables.

The branch also adds a separate online admission application flow. An administrator issues an admission form only after confirming payment; the public application validates and redeems that form once, captures applicant and parent/guardian details, selects a school class, records the already-verified application payment, and creates a pending application. Administrators can review, approve/reject and print application records. The public page does not claim that application submission guarantees admission. Both workflows depend on the new database migrations and Edge Functions being deployed together; neither is live yet.

### 6. Source-of-truth drift
The live Supabase project reports 42 applied migration-history entries. The repository originally tracked five SQL migration files; this branch now contains ten migration files (five original plus five new, unapplied remediation migrations). The live history and the repository filenames/versions do not align one-to-one, and the historical SQL for the missing live versions has not been recovered. The live project has ten Edge Functions; two deployed functions were missing from the repository and are added in this branch. A fresh comparison confirms nine of the ten deployed `index.ts` files match the branch exactly. The tenth, `resa-activate-account`, has a deliberate branch-only extension that allows a verified external-candidate registration to set a password; this extension depends on the new `external_candidate_registrations` table and must be deployed only after its migration. Three new public/external functions (`resa-external-candidate-register`, `resa-external-cbt`, and `resa-admission-application-submit`) are branch-only and not deployed. The migration history remains a release blocker until reconciled safely.

### 7. Security Advisor
The latest scan reported:
- Three anon-executable SECURITY DEFINER functions.
- Fifteen authenticated-executable SECURITY DEFINER functions.
- Leaked-password protection disabled.
- Performance notices including unindexed foreign keys and multiple permissive policies.

These are review findings, not proof that every listed function is exploitable. Each RPC must be classified by intended caller and checked for internal authorization before privileges are changed. Do not bulk-revoke function access.

### 8. Deployment and testing
The latest main-branch workflow previously passed TypeScript and production build, but that is not an end-to-end test. The current remediation PR workflow is still running; Netlify reported one preview failure and one pending preview at the last status check. The deployed Netlify commit has not been independently tied to the latest GitHub commit. Replit has no confirmed published deployment.

## Work included in draft PR #10

- Restrict student receipt RLS visibility to linked parents/guardians and linked students, retaining the existing admin policy.
- Add the finance UI for admin and parent roles, including fee setup, term-aware assignment, bank account configuration, discounts, parent transfer submission, finance review, balances and printable statements/receipts.
- Add additive fees migrations for term references, bank accounts, pending payment submissions, family visibility triggers, an admin-only verification RPC, duplicate payment reference/amount constraints, receipt RLS hardening and family-only discount visibility.
- Add external CBT form-purchase, candidate registration, exam assignment/attempt/answer schema and separate admin candidate management/marking UI.
- Add the external candidate registration and CBT Edge Functions, candidate portal route, trusted app-metadata routing, saved-answer resume and server deadline enforcement.
- Add verified admission form issuance, one-time public application submission, application payment recording, admin application review/printing and the public application route.
- Remove the duplicate read-only Admissions entry from the generic School Services viewer.
- Add deployed `resa-create-student-login` and `resa-invite-parent` Edge Function source files to GitHub.
- Synchronise the deployed `resa-student-cbt` function source to GitHub; extend `resa-activate-account` in the branch for trusted external-candidate activation after the candidate schema is installed.

## Required verification before merge or launch

1. Test the receipt and fee-submission policies in a disposable Supabase environment as admin, linked parent, unrelated parent, linked student, unrelated student, teacher, and anonymous user; verify the payment approval RPC is atomic and rejects overpayments/duplicate references.
2. Reconcile all 42 migration versions with tracked migration files and verify function source/version parity.
3. Complete the parent activation and student invitation flows using real, authorised accounts without sharing passwords in chat.
4. Build and test the fees workflow, including finance verification and printable outputs.
5. Apply the new external CBT/admissions migrations in an isolated environment; test one-time form redemption, duplicate registration, candidate approval, exam assignment, resume/autosubmit, objective/written marking, and application review/printing.
6. Run browser-based end-to-end tests for admin, teacher, student, and parent roles; confirm route protection and published exam visibility.
7. Confirm the exact Netlify deployment commit and run post-deployment smoke tests.
8. Establish and test an export/backup and restore procedure appropriate to the current Supabase plan.

## Launch decision

**Not ready for production launch.** The receipt/discount policy and new finance, external CBT and admissions workflows are implemented in the isolated branch but have not yet been tested against an isolated database or deployed. Six student identities need authorised account linking, parent accounts still need real invitations/activation, the 42-entry migration history must be reconciled, and full role-based end-to-end testing and deployment verification remain outstanding.

## Verification refresh — 1 November 2026

- GitHub Actions run [41288233941](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/41288233941) completed successfully on branch head `e21bd3f011acfc04c6d8ca4c609e1179fc6d821d`: workspace TypeScript, production build, and Deno checks for the external-candidate/admissions functions all passed.
- The branch remains an open draft PR. It is not merged and no production deploy has occurred.
- Read-only live database snapshot: 11 student records, 5 with linked auth users and 6 without; 7 active parent-student links; 0 active parent fee-visibility rows; 0 fee assignments, fee payments, receipts or admission applications; 3 published internal exams and 9 internal exam attempts.
- The live Supabase project still reports 42 applied migrations. The branch adds five new migrations; historical migration files still need reconciliation before safe migration deployment.
- The live Edge Function inventory remains the existing 10 active functions. The new admissions and external-CBT functions, and the extended activation function, remain branch-only and are not deployed.
- Security Advisor still reports 3 public and 15 authenticated SECURITY DEFINER functions as warnings, plus leaked-password protection disabled. These findings require per-function authorization review; they have not been bulk-revoked because several are intentional app APIs.
- No production rows, schema, policies, deployed functions, or Netlify site were modified during this verification refresh.

## Release gates still open

1. Run all five migrations against a disposable PostgreSQL/Supabase environment with the exact live schema, then execute role-based RLS tests. Creating a Supabase development branch may incur usage charges and has not been authorized.
2. Reconcile the 42 production migration-history entries with repository history; do not fabricate or replay unknown historical migrations.
3. Perform authenticated end-to-end tests for student, parent, teacher, admin, finance, admissions, and external-candidate journeys.
4. Link the six student records without auth accounts only after confirming each real student's correct identity/contact; do not create guessed login identities.
5. Complete parent activation using confirmed guardian identities; active family links alone do not prove portal login readiness.
6. Verify the Netlify deployment commit and production routes after merge/deployment approval.
7. Confirm school-approved fee amounts, bank details, admission form fees, and admission policy before opening payment/application workflows to the public.
