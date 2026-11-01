# RESA launch-readiness audit — 1 November 2026

## Scope and safety

This audit reviewed the live Supabase project, deployed Edge Functions, GitHub source, latest CI workflow, and public Netlify site. No production database rows, RLS policies, Edge Functions, or public deployment were changed during the audit.

The remediation branch is `resa/launch-readiness-hardening`. Its changes are isolated in draft PR #10 and must not be treated as deployed.

## Confirmed release blockers

### 1. Receipt privacy
The live policy `school members can read student payment receipts` allowed any authenticated school member to read all receipt rows for that school. The remediation migration in this branch removes that broad policy and allows the linked parent/guardian and linked student to read the receipt; the existing admin ALL policy remains. This SQL has not been applied to production and still requires role-by-role RLS testing.

### 2. Student CBT access
The live CBT function checks for an active student record, active student membership, active class/session enrolment, and published exam. The live `student_cbt` module switch is enabled. The latest data review found 11 active enrolments matching published exams, but only five students had a linked Auth user and active student membership; six therefore cannot sign in to access CBT until their real identities are linked and invitations accepted. Do not create dummy accounts or assign guessed email addresses.

The deployed CBT function source has been synchronised to GitHub in this branch so the clearer no-enrolment/no-published-exam states are retained in source control.

### 3. Parent activation
The deployed activation function supports parent invitation acceptance and portal activation; the repository copy did not contain this deployed parent workflow. The deployed source has been synchronised to GitHub in this branch. The live parent invitation function was also missing from the repository and has now been added to this branch. These source-control changes do not themselves create or activate parent accounts. The previous data check found zero active parent portal accounts.

### 4. Fees and receipts
The current fees page is a read-only record viewer, not a complete finance workflow. The previous live data check found zero fee assignments, payments, receipts, discounts, and enabled parent fee views. The current schema/workflow still needs verified bank-transfer submission, pending review, partial payment handling, duplicate reference prevention, receipt issuance only after confirmation, and printable invoices/statements/receipts. Do not represent a payment as paid merely because a parent submitted a reference or screenshot.

### 5. External CBT and admissions
The live database review found no separate external-candidate CBT workflow or trusted form-purchase verification flow. The current public admissions page is informational/enquiry-only. External candidates need isolated records and attempts, trusted verified payment references, admin approval, exam scheduling, secure question delivery, timed/autosubmitted attempts, grading and printable results. External results must remain separate from enrolled students' term reports.

### 6. Source-of-truth drift
The live Supabase project reports 42 applied migrations while the repository contains only five SQL migration files. The live project has ten Edge Functions; two deployed functions were missing from the repository and are added in this branch. The deployed `resa-activate-account` and `resa-student-cbt` sources were also ahead of the repository and have been synchronised in this branch. Remaining migration history and function versions still need a complete reconciliation before future releases.

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
- Add deployed `resa-create-student-login` and `resa-invite-parent` Edge Function source files to GitHub.
- Synchronise the deployed `resa-student-cbt` and `resa-activate-account` function source to GitHub.

## Required verification before merge or launch

1. Test the receipt policy in a disposable Supabase environment as admin, linked parent, unrelated parent, linked student, unrelated student, teacher, and anonymous user.
2. Reconcile all 42 migration versions with tracked migration files and verify function source/version parity.
3. Complete the parent activation and student invitation flows using real, authorised accounts without sharing passwords in chat.
4. Build and test the fees workflow, including finance verification and printable outputs.
5. Build and test the separate external CBT/admissions workflow.
6. Run browser-based end-to-end tests for admin, teacher, student, and parent roles; confirm route protection and published exam visibility.
7. Confirm the exact Netlify deployment commit and run post-deployment smoke tests.
8. Establish and test an export/backup and restore procedure appropriate to the current Supabase plan.

## Launch decision

**Not ready for production launch.** The receipt policy remediation is prepared but not yet tested or deployed. Major finance and external CBT/admissions workflows are incomplete, six student identities need authorised account linking, and full role-based end-to-end testing and deployment verification remain outstanding.
