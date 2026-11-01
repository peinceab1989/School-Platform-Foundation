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
The live Supabase project reports 42 applied migrations while the repository contains only five SQL migration files. The live project has ten Edge Functions; two deployed functions were missing from the repository and are added in this branch. All ten deployed Edge Function `index.ts` sources now have exact content matches in this branch, including the two previously missing functions and the deployed versions of the CBT, activation, seed-test-data and cleanup functions. The 42-entry live migration history is still not fully represented by the repository's five tracked SQL files and must be reconciled before future schema releases.

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
- Synchronise the deployed `resa-student-cbt` and `resa-activate-account` function source to GitHub.

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

**Not ready for production launch.** The receipt policy remediation is prepared but not yet tested or deployed. Major finance and external CBT/admissions workflows are incomplete, six student identities need authorised account linking, and full role-based end-to-end testing and deployment verification remain outstanding.
