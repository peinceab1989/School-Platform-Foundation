# RESA Zero-Cost Validation and Release Work Plan

**Review date:** 15 November 2026  
**Constraint:** No additional spend. No paid Supabase branch, project, compute, API, hosting, subscription or external service.  
**Scope:** Safe preparation and validation only; this plan does not authorise production changes.

## 1. Operating rules

1. Keep the existing RESA production database, authentication, storage, hosting and records intact.
2. Do not create a Supabase development branch: branch compute may incur charges and is outside the approved budget.
3. Do not run destructive tests, test migrations, resets, seed scripts or permission changes against production.
4. Do not enable paid features or add a payment, WhatsApp, SMS, biometric or AI provider that requires billing.
5. Do not merge or deploy a pull request merely because its build passes. Obtain explicit release approval after review.
6. Use the existing GitHub repository and already-configured free-tier services only. Check quota/usage before triggering optional builds or workflows.
7. Keep secrets out of Git, logs, browser bundles and documentation. Use placeholders in examples.

## 2. No-cost validation layers

| Layer | Allowed method | What it can prove | Limitation |
|---|---|---|---|
| Static review | Existing repository, SQL and TypeScript review | Detects unsafe patterns, missing checks and obvious type/build issues | Does not prove runtime access control |
| Existing CI | Existing TypeScript, production build and Edge Function typecheck jobs | Confirms those jobs pass for the tested commit | Does not test database RLS or real user journeys |
| Local database rehearsal | Supabase CLI + local Docker/Postgres, only if already available at no extra charge | Can exercise migrations, SQL functions, RLS and disposable fixtures locally | Must first confirm local tooling; local schema parity and extensions may differ |
| Browser acceptance | Existing deployed preview only where it is already available and safe | Checks visible workflows and responsive behaviour | A preview is not a substitute for authenticated role isolation |
| Production smoke checks | Read-only checks and carefully controlled normal workflows | Confirms selected live services respond | Never use production to test denial, duplicate payment or destructive cases |

If Docker, local Supabase CLI, or a suitable local runtime is unavailable, record the test as **blocked** rather than creating a paid cloud environment.

## 3. Local-only database test design

If a local runtime is already available without additional spend:

1. Start a disposable local Supabase/Postgres stack, not a cloud branch.
2. Apply the repository migrations to the local database only; first reconcile the migration history, especially migration version `20261115060828`, which is already recorded in the live project.
3. Use synthetic school, student, teacher, parent, fee and attendance fixtures. Never copy production personal data or secrets into fixtures.
4. Create separate test identities and set authenticated JWT claims in the local test harness.
5. Run positive and negative assertions for each role. Record expected and actual outcomes.
6. Reset only the disposable local database between test runs.
7. Save logs and test output without credentials, access tokens or personal data.

A local test passing is evidence about the local schema and test fixtures only. It does not authorise or prove a production migration.

## 4. Required security assertions

### Teacher access
- Assigned current-session teacher can access only approved assigned-class/subject records.
- Unassigned teacher is denied, including for a student in the same school.
- Form teacher gets only the additional categories approved for the assigned form.
- No form-teacher assignment means no form-teacher-only access.
- Inactive staff, suspended membership, previous-session assignment and removed assignment are denied.
- Administrator retains intended school-wide access.
- Existing parent/student own-record access remains intact.
- Cross-school identifiers are denied.
- Every independent permissive policy is reviewed; narrowing one helper must not leave another broad teacher branch.

### Parent revocation
- Inactive parent portal account denies access.
- Suspended parent membership denies access.
- Disabled guardian portal flag denies access.
- Revoked child link denies access to that child.
- Partial state changes cannot leave access active.
- Re-enabling restores only the intended linked child.
- Parent A cannot access Parent B or an unrelated child.

### Fee payments
- Same idempotency key submitted twice creates at most one payment and one receipt.
- Concurrent duplicate submissions create at most one payment and one receipt.
- Timeout followed by retry does not duplicate a committed payment.
- Reusing a reference for another student or fee assignment is rejected.
- Amount, currency, provider, transaction status, school, student and fee assignment are verified at the trusted server boundary.
- Browser redirect alone never verifies a payment.
- Existing Finance verification and receipt workflow remains correct.

### Child collection
- Verify wrong-school/inactive student, expired or consumed authorisation, wrong collector, revoked QR, disabled station, duplicate release, inactive staff and unauthorised teacher are denied.
- Do not change the manual fallback until school leadership documents the approved identity evidence, staff eligibility and supervisor/exception process.

## 5. Release checklist

- [ ] Teacher access matrix implemented in a reviewed migration and independently reviewed.
- [ ] Parent revocation is fail-closed across all relevant policies.
- [ ] Fee payment retry/idempotency protection is implemented and tested.
- [ ] Child-collection manual fallback has written safeguarding approval and negative tests.
- [ ] Auth leaked-password protection reviewed with controlled signup/reset acceptance.
- [ ] All four roles (admin, teacher, student, parent) pass positive and negative acceptance tests.
- [ ] Existing DEMO/test data is backed up and a restore rehearsal is verified before any cleanup.
- [ ] Live migration history is reconciled; no already-applied migration is blindly replayed.
- [ ] Deployed Edge Function source is compared with the reviewed repository commit.
- [ ] Canonical Cloudflare deployment SHA and production smoke checks are verified.
- [ ] Netlify preview failures are diagnosed or formally classified as obsolete/non-blocking by the owner; do not silently ignore them.
- [ ] Every release change has a rollback plan and an evidence record.
- [ ] Owner gives explicit approval for merge and separately for production deployment.

## 6. Current disposition

**NO-GO for final release approval.** The live project has a verified successful Cloudflare deployment baseline, but critical teacher and parent access-control gaps, payment retry protection, child-collection policy confirmation, authenticated role testing, backup/restore rehearsal and hosting-check reconciliation remain open.

**Work completed under the zero-cost constraint:** read-only production inspection, security inventory, least-privilege access matrix, critical follow-up design and this no-cost validation plan.

**Not completed:** no local test environment has yet been confirmed or run; no staging role tests have passed; no production migration, policy change, payment change, account change, data reset, merge or deployment has been performed.

The correct status is **prepared for controlled validation, not approved for release**.
