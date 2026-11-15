# RESA Digital Campus — World-Class Quality & Release Standard

**Document status:** Engineering baseline / proposed acceptance standard  
**Baseline review date:** 15 November 2026  
**Repository:** `peinceab1989/School-Platform-Foundation`  
**Production data policy:** Preserve existing records. No reset, destructive cleanup, or production migration without an approved change plan.

## 1. Product objective

RESA Digital Campus should operate as a dependable, secure, accessible and mobile-first school information system. The quality bar is not the number of screens or features delivered; it is whether each role can complete its real school workflows accurately, safely and consistently.

The platform should provide one coherent experience for:

- School management and authorised administrators
- Teachers and non-academic staff
- Students
- Parents and guardians
- Finance and attendance officers
- Approved visitors and authorised collection workflows

The school remains the authority for student, staff, financial, academic and safeguarding decisions. Automation may prepare information and recommendations, but must not silently approve admissions, payments, grades, results, disciplinary action or child release.

## 2. Non-negotiable engineering principles

1. **Protect production:** no destructive SQL, bulk data changes, permission rewrites, migration application, or production deployment without a reviewed change and explicit approval.
2. **Least privilege:** enforce role and record scope in database policies and trusted server-side functions, not only by hiding interface controls.
3. **Fail safely:** payment, examination, attendance, identity and child-collection workflows must reject ambiguous or incomplete states rather than guess.
4. **Trace important actions:** record who performed a sensitive action, what changed, when it happened, and the relevant school/entity reference.
5. **Accessible by default:** keyboard operation, visible focus, readable contrast, semantic labels, helpful validation and reduced-motion support.
6. **Mobile-first:** all critical workflows must be usable on common Android phones, not merely shrink to fit.
7. **Resilient:** loading, empty, offline, permission-denied, expired-session and recoverable-error states must be designed and tested.
8. **Privacy by design:** collect only necessary data, restrict photographs and identity information, avoid exposing internal diagnostics, and define retention/access rules.
9. **No false completion claims:** a feature is complete only after role-based end-to-end verification in a non-production test path.
10. **Cost-aware operations:** prefer existing infrastructure and open standards; document unavoidable recurring costs before adopting a paid dependency.

## 3. Current baseline — verified 15 November 2026

### 3.1 Existing foundations

- The repository is a pnpm monorepo. The root build runs TypeScript checks before workspace builds.
- The school frontend uses React, Vite, TypeScript, TanStack Query, wouter and Supabase.
- The workspace has a pnpm package minimum-release-age policy of 1,440 minutes, which is a useful supply-chain safeguard and should be preserved.
- The live Supabase project has RLS enabled across the 160 public tables previously enumerated.
- Sixteen active Supabase Edge Functions were identified in the preceding audit.
- Existing application foundations include school roles, student/staff records, attendance, examinations, fee records and receipts, messaging, push delivery, QR identity workflows, a PWA, and AI practice support.
- The latest repository commit at review time was `dcf4759495372db5829666ce729a23dc86688993` (two-sided RESA identity-card standardisation).

### 3.2 Supabase advisor findings

The advisor snapshot returned the following findings:

| Finding | Count / level | Required treatment |
|---|---:|---|
| RLS enabled with no policy | 2 / Info | Confirm intended deny-by-default behaviour and document it; do not add broad policies. |
| Extension in public schema | 1 / Warning | Identify the extension and dependency; plan a safe schema move only if supported. |
| Anon can execute SECURITY DEFINER functions | 3 / Warning | Review each function body, data returned, and intended public use; restrict grants where not required. |
| Authenticated can execute SECURITY DEFINER functions | 30 / Warning | Review every function's in-function authorisation and scope; do not revoke in bulk. |
| Leaked-password protection disabled | 1 / Warning | Enable through Supabase Auth configuration after controlled sign-in testing. |
| Unindexed foreign keys | 58 / Info | Prioritise high-traffic joins and verify query plans before adding indexes. |
| Unused indexes | 419 / Info | Treat as observation-window evidence, not an automatic deletion list. |
| Multiple permissive policies | 133 / Warning | Review overlapping policies and consolidate only with equivalent or stronger access semantics. |
| Health lints | 0 | No health lints were returned in this snapshot; this is not a complete operational SLA test. |

Advisor findings are leads for engineering review, not proof that each item is exploitable or should be changed automatically.

#### Function and schema triage from read-only inspection

The three functions currently executable by `anon` are:

- `get_public_customer_care_status(p_school_id uuid)`
- `get_resa_public_announcements()`
- `get_resa_website_content(p_content_type text)`

Their inspected definitions use an empty/restricted `search_path` and return public-facing content or a boolean status. Their public exposure appears intentional, but must remain limited to published content and non-sensitive status. The customer-care status function accepts a caller-supplied school UUID, so confirm that exposing this boolean across school identifiers is acceptable.

The 30 authenticated-executable `SECURITY DEFINER` functions were also inspected at a metadata/pattern level. The sampled business RPCs contain `auth.uid()`, and the inspected administrative actions check school roles or the JETAB owner identity. This is a positive sign, not a complete authorisation proof: each function still needs a full branch-by-branch review, especially helpers that are intended to be called by RLS policies and parent-scoped workflows. A text search for `auth.uid()` or `has_school_role()` is not a substitute for testing whether the caller may act on the specific record and school passed as parameters.

The extension warning is specifically `pg_net 0.20.4` installed in the `public` schema. Before moving it, check all dependent functions and scheduled jobs; do not move or drop it during a routine cleanup.

The two RLS-enabled tables without policies are `admission_application_rate_events` and `external_candidate_registration_events`. With RLS enabled and no policies, normal API roles are denied by default. Confirm that this is intentional for internal rate-limit/audit event storage and that inserts occur only through the trusted server-side path.

### 3.3 Deployment verification still required

The GitHub main branch and Cloudflare Pages production deployment must be compared by exact commit SHA. A successful repository build or a newer GitHub commit does not prove that the public site is serving that commit. Record the deployed SHA, build status, deployment URL and smoke-test outcome for every release.

## 4. Release gates

A change must pass all applicable gates before it is promoted.

### Gate A — Change safety

- Change has a clear purpose, owner and scope.
- Data and permission impact are documented.
- Database changes are additive where possible.
- Migration has a rollback/recovery strategy or a documented forward-fix plan.
- No secrets, service-role keys, private tokens or personal data are committed.
- Existing user journeys and role permissions are considered.

### Gate B — Automated quality

- TypeScript check passes.
- Production build passes.
- Lint/format checks pass where configured.
- Unit/component tests pass for changed logic.
- Database migration checks pass in a non-production environment.
- No new high/critical dependency vulnerability is introduced.
- Build output and bundle-size changes are reviewed.

### Gate C — Security and privacy

- RLS is enabled on exposed tables.
- Policies are tested for anonymous, unrelated authenticated, linked parent, student, assigned teacher and administrator contexts as applicable.
- SECURITY DEFINER functions use a controlled search path and perform explicit authorisation inside the function.
- Storage paths and object policies are scoped to the correct school and record.
- Sensitive data is not exposed in logs, URLs, public errors or client bundles.
- Authentication, session expiry, password recovery and account lifecycle are tested.

### Gate D — User acceptance

- Test the workflow using dedicated test accounts for each relevant role.
- Verify success, validation failure, permission denial, duplicate submission and interrupted network cases.
- Verify the interface on a small Android viewport and a desktop viewport.
- Confirm the displayed totals and status labels match database outcomes.
- Obtain school-side acceptance for workflows that affect real operations.

### Gate E — Release and rollback

- Confirm the target environment and exact commit SHA.
- Confirm required environment variables are present without printing secret values.
- Deploy only after approval.
- Run post-deployment smoke tests.
- Monitor application, database and Edge Function errors.
- Keep the previous known-good deployment available for rollback.
- Record the release and any incident follow-up.

## 5. Role-based end-to-end acceptance tests

| Workflow | Minimum acceptance evidence |
|---|---|
| Authentication | Each role signs in, signs out, recovers access and cannot access another role's private routes. |
| Student registration | Required fields validate; duplicate identity/admission references are handled; approval is auditable. |
| Class enrolment | Only authorised staff can assign; class/session are explicit; no silent default enrolment. |
| Attendance | One valid event is recorded once; duplicates and invalid QR tokens are rejected; authorised corrections are audited. |
| Parent alerts | Correct linked guardian receives the event; preferences are honoured; retries and delivery status are observable. |
| Messaging | Only participants can read a conversation; read receipts are scoped; attachments obey storage permissions. |
| Assignments | Published work is visible to the correct class; submission deadlines are enforced; only authorised teachers grade. |
| CBT | Only eligible candidates see the exam; timing and submission are server-enforced; results are not exposed before publication. |
| Fees | A payment remains pending until verified; duplicate references are rejected; receipts follow successful verification only. |
| Results | Only authorised staff publish; student/parent visibility follows publication state; print output is legible and consistent. |
| ID cards | Photo and identity details are correct; QR credentials are approved, revocable and verified server-side; print alignment is tested. |
| Child collection | A valid authorisation is checked by an authorised officer; the release event is recorded; parent QR alone is not treated as consent. |
| RESA Drive | Upload, storage path, read access, preview/download and file-size restrictions are verified by role. |

## 6. Prioritised delivery roadmap

### P0 — Production confidence

1. Verify Cloudflare production SHA against GitHub main.
2. Verify backup completeness and perform a documented restore rehearsal without touching production.
3. Reconcile repository migrations with the live migration registry and review open pull requests for overlap.
4. Review all three anon-executable and thirty authenticated-executable SECURITY DEFINER functions.
5. Review the two no-policy tables and the public-schema extension.
6. Enable leaked-password protection after a controlled authentication test.
7. Establish a release log and smoke-test checklist.

### P1 — Finish existing core workflows

1. Repair and verify messaging and parent notification triggers.
2. Verify closed-browser push delivery and real-device subscription lifecycle.
3. Complete assignment submission and teacher grading.
4. Verify RESA Drive upload visibility and access controls.
5. Test student exam visibility, CBT submission and published results.
6. Resolve the student portal recovery/error state and unexpected settings landing behaviour.
7. Verify parent, teacher, student and admin navigation on Android.

### P2 — Finance and reporting

1. Complete fee setup, student assignment, pending-payment review and receipt verification.
2. Deliver parent statements, outstanding balances and class-level collection reports.
3. Add controlled income, expenses, payroll and cashflow reporting where the underlying data is complete.
4. Integrate a payment provider only after webhook signature verification, idempotency, reconciliation and refund/failure handling are tested.

### P3 — Attendance and safeguarding

1. Complete QR issuance, approval, revocation and scanning tests.
2. Verify staff attendance and movement records.
3. Test 10:00 a.m. absence checkpoint alerts, escalation and acknowledgement.
4. Validate actual fingerprint hardware compatibility before committing to a vendor SDK or hardware purchase.

### P4 — Platform expansion

1. Validate PWA installability, offline messaging and notification behaviour.
2. Add official WhatsApp Business Platform integration only with approved templates and a cost plan.
3. Introduce video lessons/meetings using a supported conferencing service.
4. Expand the AI assistant initially as a permission-filtered, read-only helper; sensitive actions remain human-approved.

## 7. Operational service indicators

Track these monthly once real operational use begins:

- Successful sign-in rate by role
- Critical workflow completion rate
- Failed/duplicate payment and receipt incidents
- Attendance event delivery and parent notification success
- Assignment and CBT submission error rates
- Application and Edge Function error rates
- Median page/API response time for key workflows
- Backup completion and restore-test result
- Open high-severity security findings
- Support requests by category and time to resolution

Do not publish service-level claims until sufficient production measurements exist.

## 8. Immediate next actions

1. Obtain the current Cloudflare production deployment SHA and compare it with GitHub main.
2. Produce a function-by-function SECURITY DEFINER review register with intended callers, authorisation checks, grants and recommended action.
3. Review the open finance/admissions/CBT, assignment and Smart Access pull requests against the live migration registry to prevent duplicate or conflicting changes.
4. Run a controlled role-based smoke test on the existing production site without altering records.
5. Convert confirmed defects into small, isolated pull requests with tests and acceptance evidence.

**Definition of done:** RESA is ready for operational launch only when the critical role-based workflows pass, security findings have documented dispositions, backups have a proven recovery path, and the deployed production SHA is traceable to an approved, tested repository commit.
