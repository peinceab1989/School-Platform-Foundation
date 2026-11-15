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

Their inspected definitions use an empty/restricted `search_path` and return public-facing content or a boolean status. Their public exposure appears intentional, but must remain limited to published content and non-sensitive status. The customer-care status function was corrected on 15 November 2026 to return the setting only for RESA's fixed school UUID and `false` for any other UUID. A direct SQL verification returned `true` for RESA and `false` for an unrelated UUID. The matching migration `20261115060828_scope_public_customer_care_status_to_resa` is present in the live Supabase migration registry and in PR #90. The advisor may still report the function because public execution is required by the website widget; the cross-school probe has been constrained.

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

## 9. Release-candidate readiness snapshot — 15 November 2026

**Current disposition: NOT APPROVED FOR PRODUCTION RELEASE.** The repository is suitable for continued review of the isolated changes below, but production release remains blocked until the outstanding deployment, security and operational acceptance gates are closed.

### 9.1 Verified change candidates

| Pull request | Scope | Evidence | Release disposition |
|---|---|---|---|
| [#85](https://github.com/peinceab1989/School-Platform-Foundation/pull/85) | Correct administrator name initials when names contain whitespace | TypeScript and production build passed; `resa-digital-campus` preview passed | Ready for code review; not merged |
| [#87](https://github.com/peinceab1989/School-Platform-Foundation/pull/87) | Include `person_id` in teacher fallback staff lookup | TypeScript and production build passed; `resa-digital-campus` preview passed | Ready for code review; not merged |
| [#88](https://github.com/peinceab1989/School-Platform-Foundation/pull/88) | Correct three notification destination paths | TypeScript, production build and RESA Edge Function typecheck passed; `resa-digital-campus` preview passed at commit `e5abbfcb760f0934c459f360380c441b21e1c56d` | Ready for code review; not merged; push Edge Function not deployed |
| [#86](https://github.com/peinceab1989/School-Platform-Foundation/pull/86) | Document SECURITY DEFINER exposure and review boundaries | Documentation-only inventory | Review document; it does not remediate database findings |
| [#84](https://github.com/peinceab1989/School-Platform-Foundation/pull/84) | This release-quality and acceptance standard | Documentation-only baseline | Review and approve the standard |

All changes above remain unmerged. No production deployment, database permission change, migration, or destructive data operation was performed.

### 9.2 Deployment gate status

| Target | Latest evidence | Status |
|---|---|---|
| `resa-digital-campus` Cloudflare Pages preview | Successful preview for PR #88 at commit `e5abbfc` | Preview passed; not proof of production release |
| `jetab-tech` Cloudflare Pages project | Build failure on PR #88 | Unresolved; determine whether this integration is an intended RESA target or a stale/incorrect project association |
| Legacy Netlify checks | Redirect/header/pages checks fail for the two connected Netlify projects | Unresolved; the school previously reported exhausted Netlify build minutes. Confirm logs/quota and decide whether these checks should be retired after Cloudflare is formally designated as the release host |
| RESA production URL | Exact currently deployed SHA not independently confirmed | Release blocker |

The release owner must designate one canonical production host and verify its production deployment SHA against the approved repository commit. A preview success is not production approval.

### 9.3 Remaining production blockers

1. **Security sign-off:** complete function-by-function review of SECURITY DEFINER functions, validate cross-school and record-level authorisation, review overlapping RLS policies, confirm the two no-policy tables are server-only by design, and enable leaked-password protection after controlled authentication tests.
2. **Role acceptance:** execute recorded admin, teacher, student and parent tests using dedicated test accounts, including denial tests for unrelated schools and records.
3. **Critical workflows:** test admissions, enrolment, attendance, parent alerts, assignments/grading, CBT timing/submission/publication, fees/payment verification/receipts, results, messaging and Drive upload/download.
4. **Notifications:** verify event-triggered delivery and preference handling on real Android devices; deploy the corrected Edge Function only after approval and a controlled test.
5. **Data recovery:** verify backup coverage and complete a restore rehearsal in an isolated environment without modifying production.
6. **Release host:** resolve the duplicate Cloudflare/Netlify integrations, document the canonical host, confirm environment bindings without exposing secret values, and test SPA routing, authentication redirects and storage access.
7. **Operational acceptance:** obtain school-side sign-off for workflows that affect attendance, grades, money, student identity and child collection.
8. **External dependencies:** document provider accounts, credentials, pricing and data-protection obligations before enabling WhatsApp, online payments, conferencing or biometric hardware. These are not currently verified as live integrations.

### 9.4 Approval checklist

A reviewer may approve individual code changes when their own checks pass. The overall RESA production release must remain **NO-GO** until every P0 item below is evidenced:

- [ ] Security review signed off; no unresolved critical/high exposure.
- [ ] Four-role end-to-end acceptance results recorded.
- [ ] Critical school workflows pass in a controlled test environment.
- [ ] Backup restore rehearsal passes.
- [ ] Canonical production host and exact release SHA confirmed.
- [ ] Production environment configuration checked without revealing secrets.
- [ ] Approved changes merged in a controlled sequence.
- [ ] Production deployment explicitly authorised.
- [ ] Post-deployment smoke tests pass and rollback target is available.
- [ ] School owner accepts the release.

**Release rule:** approval of a pull request is not approval to deploy. Production release requires a separate explicit authorisation after the evidence above is complete.


## 10. Follow-up verification update — 15 November 2026

This addendum supersedes any earlier release snapshot where the facts below differ.

### 10.1 Customer-care public RPC correction

- PR [#90](https://github.com/peinceab1989/School-Platform-Foundation/pull/90) records the migration that scopes `get_public_customer_care_status(uuid)` to RESA's fixed school UUID.
- The live database migration registry includes version `20261115060828`.
- Read-only verification confirmed RESA returns `true` at the time of test and an unrelated UUID returns `false`.
- PR #90's TypeScript and production build check passed; the Cloudflare Pages preview check for `resa-digital-campus` succeeded.
- The legacy Netlify checks and the separate `jetab-tech` Cloudflare check failed. The preview result is not production deployment evidence.
- PR #90 remains unmerged; the SQL correction was already applied directly to the live database. Do not blindly reapply it. Before merging, reconcile the repository migration with the live migration registry to avoid a duplicate or out-of-order migration.

### 10.2 External CBT rate-limit decision

PR [#89](https://github.com/peinceab1989/School-Platform-Foundation/pull/89) was closed without merging or deploying. Its proposed global rate-limit keyed only by form number could allow an attacker to exhaust the shared budget and deny service to a legitimate candidate. A replacement must combine abuse resistance with fair per-client/network controls, bounded storage, expiry, observability and tests for shared-NAT false positives. The live `resa-external-candidate-register` Edge Function remained at version 1 during this review.

### 10.3 Current check matrix

| Check | Result | Meaning |
|---|---|---|
| PR #90 TypeScript and production build | Passed | Code compiles and builds; does not prove full runtime correctness |
| PR #90 `resa-digital-campus` Cloudflare preview | Passed | Preview deployment only |
| PR #90 `jetab-tech` Cloudflare check | Failed | Separate project integration; establish whether it belongs in RESA's required release path |
| PR #90 legacy Netlify redirect/header/pages checks | Failed | Existing connected Netlify integrations; previously reported build-minute exhaustion must be reconciled with the current logs |
| Live RESA production SHA | Not independently confirmed | Still blocks production release |
| Authenticated four-role browser acceptance | Not completed | Requires controlled test accounts and live browser/device access |
| Backup restore rehearsal | Not completed | Requires an isolated restore target and verified backup artifacts |

### 10.4 Remaining work must be evidenced, not assumed

1. Inspect the current Cloudflare Pages production deployment for the canonical RESA project and compare its deployed commit SHA to the approved main-branch SHA.
2. Inspect authenticated Netlify/Cloudflare build logs and either repair the intended integration or formally remove obsolete checks only after the canonical host is approved.
3. Complete a branch-by-branch authorization review of all exposed SECURITY DEFINER RPCs, including negative tests for anonymous, unrelated authenticated, wrong-school, wrong-parent, wrong-student and wrong-role callers.
4. Review the public functions `get_resa_public_announcements()` and `get_resa_website_content(text)` for unintended unpublished or private fields; their current definitions are pinned to RESA and published rows.
5. Verify that `admission_application_rate_events` and `external_candidate_registration_events` remain inaccessible to `anon` and `authenticated`, with writes restricted to trusted server-side code.
6. Do not move `pg_net` or remove unused indexes as bulk cleanup; first map dependencies and inspect query plans.
7. Perform the four-role acceptance matrix, Android notification tests, financial reconciliation tests, CBT timing and publication tests, file-storage access tests, and child-collection safeguarding tests.
8. Perform a backup restore rehearsal and document RPO/RTO, restore owner and rollback target.
9. Obtain school-owner approval for the final candidate, then merge and deploy in a controlled sequence.

**Current release disposition remains NO-GO.** The completed SQL correction and passing preview are useful verified improvements, but the live deployment SHA, role acceptance, security sign-off and recovery rehearsal remain open gates.


## 11. Canonical production deployment evidence — 15 November 2026

The school owner supplied the Cloudflare Pages production deployment details and build log for the RESA project. This resolves the earlier uncertainty about the live production SHA.

| Field | Verified evidence |
|---|---|
| Cloudflare Pages project label | `resa-digital-campus` |
| Environment | Production |
| Deployment ID | `0c6fb2cb-aac7-4e6d-b760-9a2fee885267` |
| Immutable deployment URL | `https://0c6fb2cb.school-platform-foundation.pages.dev` |
| Repository / branch | `peinceab1989/School-Platform-Foundation` / `main` |
| Deployed commit | `dcf4759495372db5829666ce729a23dc86688993` (`dcf4759`) |
| Deployment result | Success |
| Build | `pnpm run build`; completed, assets uploaded |
| Build checks in supplied log | Workspace TypeScript checks and RESA Vite production build completed successfully |
| Deployment timestamp shown | 11 November 2026, 2:35 PM (dashboard local display) |

The deployed SHA exactly matches the main-branch baseline previously identified in this review. The deployed commit standardises two-sided RESA identity cards. The production build log also shows the portal navigation guide, attendance, admissions, external CBT, student CBT, results, fees, messaging, notifications, teacher dashboard and biometric-attendance frontend bundles were included in the build. Presence of a bundle proves it was built, not that its end-to-end workflow or any external hardware/provider integration is operational.

This evidence supersedes the earlier statement that the canonical production SHA was unverified. It does **not** supersede the outstanding security, role-based acceptance, backup restore, and live workflow gates. Production remains **NO-GO for final release approval** until those gates are evidenced.

The later PR #90 Cloudflare preview at commit `dabff15376ecaa753d7dec2f712597389ee88567` is a preview deployment, not the current production deployment. PR #90 remains unmerged, and its already-applied live SQL correction requires migration reconciliation before any merge. No production deployment or data reset is authorised by this evidence update.
