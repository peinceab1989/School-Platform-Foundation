# RESA Supabase SECURITY DEFINER Inventory

**Review date:** 15 November 2026  
**Project:** School digital portal (`mhwwzzxwpsqwhxrsuwaa`)  
**Method:** Read-only catalog and function-definition inspection. No grants, functions, policies or data were changed.

## 1. Snapshot

The live `public` schema contains 50 SECURITY DEFINER functions in the inspected catalog snapshot:

| Execution scope | Count | Interpretation |
|---|---:|---|
| Executable by `anon` | 3 | Publicly callable entry points; review as public API. |
| Executable by `authenticated` | 30 | Includes the 3 anon-callable functions; these require explicit caller and record-scope checks. |
| Not executable by anon or authenticated | 20 | Trigger/service-only from the checked roles; still review trigger effects and service-role call paths. |

All 50 inspected definitions set an empty `search_path` (`SET search_path TO ''`). This is a good hardening measure, but it does not replace authorisation checks. The count is a snapshot, not a permanent guarantee.

## 2. Publicly callable functions — review disposition

### `get_resa_public_announcements()`
- Returns published, currently active announcements for the fixed RESA school UUID.
- No caller identity is required; this appears to be an intentional public website endpoint.
- Keep public only if announcement publication is explicitly approved for public visibility.
- Test that unpublished, future-dated and expired announcements never appear.

### `get_resa_website_content(p_content_type text)`
- Returns selected published website content for the fixed RESA school UUID.
- No caller identity is required; this appears to be an intentional public website endpoint.
- Keep public only for content types and fields approved for public display.
- Review all rows in `public_website_content` for accidental personal or internal information; verify expiry and publication filters.

### `get_public_customer_care_status(p_school_id uuid)`
- Returns a boolean customer-care enabled status for the caller-supplied school UUID.
- The value is low sensitivity, but the arbitrary UUID parameter permits probing whether customer care is enabled for other school IDs.
- Decide whether this endpoint should be scoped to the RESA school constant or whether cross-school disclosure is an intended product capability.
- If only RESA is supported, narrow the function to that school and test that unrelated IDs reveal no information.

**Important:** No grant was changed. These functions may be intentionally public. The recommended action is an owner decision followed by a separately tested, reviewed migration if scope needs tightening.

## 3. Authenticated-callable functions

The following 27 functions are authenticated-callable and not anon-callable in the snapshot. Three additional public functions above are also authenticated-callable, giving 30 authenticated-callable functions total.

| Function | Intended security boundary to verify |
|---|---|
| `approve_invited_staff(p_school_id, p_user_id)` | Active school admin only; target must be an invited teacher with matching staff record. |
| `can_access_student_record(p_school_id, p_student_id)` | Caller must be admin/teacher, the student, or a linked parent; confirm teacher scope is appropriate. |
| `can_send_school_message(...)` | Sender identity must equal `auth.uid()`; active membership and channel/conversation rules must match. |
| `get_school_message_contacts(p_school_id)` | Contact list must be limited to the caller's active school membership and permitted roles. |
| `has_school_role(p_school_id, p_roles)` | Must derive identity from `auth.uid()` and only inspect active membership. |
| `is_nexus_owner()` | Must derive owner status from trusted server-side identity/claims, never editable user metadata. |
| `nexus_issue_compliance_case(...)` | Nexus-owner permission, school scope, and sensitive case-data access must be explicit. |
| `nexus_set_module_enabled(p_module_key, p_is_enabled)` | Nexus-owner permission and module-key allow-list must be enforced. |
| `parent_can_access_guardian(p_parent_guardian_id)` | Must prove caller is linked to that guardian record. |
| `parent_can_access_student(p_student_id)` | Must prove an active parent-child link for the signed-in parent. |
| `record_verified_school_fee_payment(...)` | Admin/finance role, school scope, positive amount, idempotency and receipt atomicity. |
| `resa_acknowledge_attendance_checkpoint(p_alert_id, p_note)` | Only an authorised school officer may acknowledge an alert in their school. |
| `resa_assign_student_enrollment(...)` | Admin permission; student, class and session must belong to the same school; prevent conflicting active enrolments. |
| `resa_create_chat_group(p_school_id, p_subject, p_member_ids)` | Creator permission, active same-school members, valid role combinations and membership limits. |
| `resa_get_active_attendance_qr(...)` | Caller must be entitled to view the requested person's active credential; raw secrets must never be exposed. |
| `resa_grade_assignment_submission(p_submission_id, p_score, p_feedback)` | Assigned teacher/class/subject/session scope, score bounds and submission state. |
| `resa_issue_parent_qr(...)` | Admin permission, linked guardian, secure token hashing and revocation lifecycle. |
| `resa_mark_cbt_answer(p_answer_id, p_marks)` | Authorised marker, exam/attempt scope, mark bounds and marking state. |
| `resa_prepare_missing_attendance_qr(p_school_id)` | Admin/attendance officer scope; no cross-school credential generation. |
| `resa_record_child_collection_release(...)` | Authorised station/officer, approved unexpired collection authority, correct student and append-only release evidence. |
| `resa_record_parent_event_checkin(...)` | Approved parent credential, event/school scope and active station. |
| `resa_record_qr_attendance(...)` | Authenticated operator, active station, hashed valid credential, correct person/school, duplicate prevention and event audit. |
| `resa_review_parent_access_request(...)` | School admin only; request must belong to the supplied school and remain pending. |
| `resa_submit_parent_access_request(...)` | Signed-in parent must own the active parent portal account and active child link; input validation and pending-only creation. |
| `resa_transfer_cbt_attempt(p_attempt_id)` | School admin only; submitted attempt, matching exam/term, complete marking and no overwrite of published results. |
| `suspend_school_teacher(p_school_id, p_user_id)` | Active school admin; target must be a teacher membership and matching staff record. |
| `unsuspend_school_teacher(p_school_id, p_user_id)` | Active school admin; target must be a suspended teacher membership and matching staff record. |

### Pattern review results

The metadata scan found direct `auth.uid()` references in the 27 authenticated-only functions. Most administrative/business RPCs also contain a direct `has_school_role()` check; helper functions intentionally use narrower membership/relationship checks instead. This is only a triage signal: a direct text match does not prove that every parameter is bound to the correct school, student, parent, conversation, exam or submission.

Priority deep-review targets are:
1. `get_school_message_contacts` and `can_send_school_message` — private communication and directory disclosure.
2. `can_access_student_record`, `parent_can_access_guardian`, `parent_can_access_student` — student and family data boundaries.
3. `record_verified_school_fee_payment` — financial integrity and atomic receipt creation.
4. `resa_record_child_collection_release`, `resa_record_qr_attendance`, `resa_record_parent_event_checkin` — physical safeguarding and attendance.
5. `nexus_issue_compliance_case`, `nexus_set_module_enabled`, `is_nexus_owner` — platform-owner privileges and sensitive records.
6. `resa_grade_assignment_submission`, `resa_mark_cbt_answer`, `resa_transfer_cbt_attempt` — academic integrity.

## 4. Trigger/service-only functions

Twenty SECURITY DEFINER functions in the snapshot were not executable by either `anon` or `authenticated`. Their current grants reduce direct API exposure, but do not make them harmless: triggers can run them as part of a user write. Review trigger attachment, affected tables, write scope, and whether a user can cause an unintended side effect indirectly.

Do not grant client execution to trigger helpers. Do not remove or replace triggers as part of generic cleanup.

## 5. Required verification before any permission change

- Review the complete definition and dependencies of the target function.
- Confirm all call sites in frontend code, Edge Functions, policies and triggers.
- Test anonymous, unrelated authenticated, same-school authorised, wrong-school, linked-parent, unrelated-parent, assigned-teacher and admin cases as relevant.
- Test malformed IDs, cross-school IDs, nulls, duplicate calls and stale/revoked relationships.
- Verify expected successful behaviour as well as denied behaviour.
- Make the smallest grant/body change in a migration on an isolated database first.
- Re-run Supabase security advisors and the complete role-based smoke suite.
- Do not change grants in bulk or assume every SECURITY DEFINER function is a vulnerability.

## 6. Out of scope / not changed

This inventory is not a penetration test and does not certify the application as secure. It does not prove that the frontend or every Edge Function calls the intended RPC. No database grants, functions, RLS policies, Edge Functions, user accounts, records or production settings were changed while preparing this document.

**Disposition:** Three public functions have an explicit review decision path. The 27 authenticated-only functions have named security boundaries for deeper verification. The 20 trigger/service-only functions remain subject to trigger-path review. No automatic permission revocation is recommended.


## 7. Live Supabase advisor snapshot

**Observed:** 15 November 2026 at approximately 05:38 UTC. These are live advisor findings from the linked project, not a static inference from the repository. Re-run advisors before each release because findings can change.

### Security findings

| Advisor | Count | Severity | Disposition |
|---|---:|---|---|
| RLS enabled with no policies | 2 tables | INFO | admission_application_rate_events and external_candidate_registration_events. Confirm these are intentionally server-only event tables; do not add broad client policies merely to silence the lint. |
| Extension installed in public | 1 (pg_net) | WARN | Review extension dependencies and supported relocation before moving it. Do not move it as an untested cleanup. |
| Anon can execute SECURITY DEFINER | 3 functions | WARN | Matches the public function review in section 2. Keep only if their public API behaviour is intentional and their returned data is safe. |
| Authenticated can execute SECURITY DEFINER | 30 functions | WARN | Matches section 3. Review function-by-function; do not revoke grants in bulk. |
| Leaked password protection disabled | 1 Auth setting | WARN | Enable in Supabase Auth settings after confirming the user-facing password policy and signup/reset flows. This is an account configuration change, not a SQL migration. |

Remediation references:
- [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Extension in public schema](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- [Anon-executable SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated-executable SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### Performance findings

| Advisor | Count | Disposition |
|---|---:|---|
| Unindexed foreign keys | 58 | Prioritise high-traffic attendance, messaging, enrolment, finance and safeguarding relationships. Confirm existing composite indexes before adding anything. |
| Unused indexes | 419 | Treat as observations only. Index usage can reset and low-frequency indexes may still be essential. Do not delete indexes based on this lint alone. |
| Multiple permissive policies | 133 | Review policy overlap and OR semantics on sensitive tables. Multiple permissive policies are not automatically a vulnerability; consolidate only after proving equivalent access for every role. |

Remediation references:
- [Unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

### Health

The health advisor returned no lints in this snapshot. This does not replace functional testing, security review or production monitoring.

**Change control:** No advisor finding was automatically remediated. In particular, no RLS policy, extension, index, function grant or Auth setting was changed during this update. Each proposed fix must have a reviewed migration or documented dashboard change, a rollback plan, and positive plus negative role-based tests.


## 8. Deeper read-only review — 15 November 2026, approximately 07:50 UTC

This section records direct inspection of selected live function bodies, grants, RLS policies, parent access state and public RPC behaviour. It remains a read-only review. No production SQL, grants, records, Auth settings or functions were changed.

### 8.1 Confirmed positive controls

- All 50 SECURITY DEFINER function definitions inspected have `SET search_path = ''`. This reduces search-path hijacking risk; explicit schema qualification is still required and was present in the selected definitions reviewed.
- The two rate/event tables flagged as RLS-enabled with no policies have RLS enabled, no policies, and no SELECT/INSERT/UPDATE privileges for either `anon` or `authenticated`. Their present state is deny-by-default. Do not add client policies merely to clear the informational lint.
- `get_public_customer_care_status` was tested read-only: the configured RESA school UUID returned `true`; an unrelated all-zero UUID returned `false`. The function remains intentionally public for the website widget, but is tenant-scoped.
- `get_resa_public_announcements()` returned two currently published public announcements in this snapshot. Its function body filters by the fixed RESA school UUID, `is_published = true`, publication time not in the future and expiry not elapsed.
- `get_resa_website_content(null)` returned zero rows in this snapshot. Its body is restricted to published, current content for the fixed RESA school UUID. Keep this endpoint public only for fields/content that are approved for public display.
- `has_school_role` derives identity from `auth.uid()` and checks an active membership for the supplied school and requested roles.
- `is_nexus_owner` derives owner status from the server-side `nexus_owners` table keyed to `auth.uid()`; it does not rely on editable user metadata.
- The selected staff approval/suspension RPCs require an authenticated caller with an active admin role for the supplied school and validate the target teacher membership and staff row.
- `nexus_set_module_enabled` calls `is_nexus_owner()`, locks the target module row, updates only an existing module and records an audit entry.
- `resa_submit_parent_access_request` checks that the signed-in user owns an active parent portal account and that any selected child is linked to that guardian before inserting a pending request.
- `resa_grade_assignment_submission` checks active teacher membership, the assigned staff/class/subject/session relationship, submission state and score bounds before grading.
- `resa_mark_cbt_answer` and `resa_transfer_cbt_attempt` enforce admin-only marking/transfer, submitted attempt state, question/mark bounds, completeness and protection against overwriting transferred or published results.
- The live parent portal records currently have zero mismatches between `parent_portal_accounts.is_active` and `parents_guardians.portal_enabled`; zero inactive accounts currently retain an active child link.

### 8.2 Items requiring an explicit security/owner decision

**A. Teacher scope in `can_access_student_record` — HIGH PRIORITY TO CONFIRM**

The live helper returns true for any active teacher membership in the supplied school once the student belongs to that school. It does not itself check whether the teacher is assigned to that student's class, subject or form group. This helper is referenced by 19 public RLS policies, including student awards, certificates, character assessments, enrollment history, hobbies/interests, transfer/withdrawal records, library fines and house points.

This may reflect an intentional school-wide teacher visibility policy, but it is broader than an assigned-class-only model. The school owner must explicitly confirm whether every active teacher should read all these student-linked records. If not, replace the broad teacher branch with a tested class/form/subject assignment scope in an isolated environment first. Do not alter the live helper or policies until positive and negative tests prove that teachers retain exactly the required access.

**B. Parent access revocation — HARDENING CANDIDATE**

`parent_can_access_guardian` and `parent_can_access_student` derive identity from the guardian's linked `people.user_id`, `portal_enabled` and active parent-child link. They do not independently require an active row in `parent_portal_accounts` or an active parent `school_memberships` row.

The current Parent Management UI suspends access by updating the parent membership, `parent_portal_accounts.is_active` and `parents_guardians.portal_enabled` sequentially. There are no triggers on those three tables to make this a single database transaction. The current production records are consistent (zero mismatches), and the UI attempts all three changes; however, a partial failure or another admin workflow that changes only one flag could leave helper-based RLS access active.

Before release, test a parent account suspension where each update fails in turn, and verify that the user immediately loses access to all 22 policies using `parent_can_access_student` and all 9 policies using `parent_can_access_guardian`. Preferred hardening is to make the helpers also require the active parent account/membership, or to replace the sequential UI updates with a single transactional admin RPC. This must be migration-reviewed and tested in isolation before production.

**C. Verified school-fee payment — FINANCIAL INTEGRITY TEST REQUIRED**

The live `record_verified_school_fee_payment` RPC requires an authenticated school admin, finite positive amount, an allowed payment method, a same-school fee assignment locked `FOR UPDATE`, and a balance check. It creates the payment and receipt in the same database transaction and updates the assignment balance. This is a useful atomicity control.

The inspected function does not implement an explicit idempotency key or duplicate-reference rejection. A repeated administrator submission after a timeout could create a second payment/receipt if sufficient balance remains. This is not proof of an existing duplicate, but it is a release test and hardening requirement: use a unique, validated payment reference/idempotency token where available, and test retries/concurrent submissions in a disposable environment. Do not treat a browser redirect or unverified Paystack callback as proof of payment.

**D. Child collection manual fallback — SAFEGUARDING POLICY CONFIRMATION**

`resa_record_child_collection_release` requires an authenticated admin or teacher, the school's pickup feature enabled, an active student in the same school, and a documented collector name and verification note. It supports three paths: approved unused authorization with matching collector, valid linked parent QR, or `manual_verified` fallback. The manual fallback does not require a parent QR or pre-approved authorization; its evidence is the staff identity and required verification note.

Confirm that RESA's safeguarding policy permits this fallback and define who may use it, what identity checks are mandatory, and whether supervisor approval is required. Test wrong-school student IDs, expired/consumed authorization, wrong collector, invalid/revoked QR, inactive station and duplicate release. Do not disable the fallback without a school-approved operational alternative.

### 8.3 Automated test coverage gap

The current `.github/workflows/resa-portal-checks.yml` performs dependency installation, workspace TypeScript checks, production builds and Deno typechecks for four Edge Functions. It does not run unit tests, SQL policy tests, browser tests or role-based end-to-end tests. The repository tree inspected for this review did not expose a Playwright, Cypress, Vitest or Jest test suite.

The historical RESA demo/navigation guide records database workflow checks using DEMO data, but explicitly states that live authenticated browser sessions were not available for every teacher, student and parent account. Therefore those checks are not equivalent to a current four-role acceptance test.

Required pre-release test matrix:

| Role | Required positive tests | Required negative tests |
|---|---|---|
| Administrator | Student/staff management, approvals, attendance, publishing, finance verification, safeguarding, reports and audit history | Cannot access another school's records; only authorised admin/Nexus owner actions succeed |
| Teacher | Assigned class/subject attendance, materials, assignments, submissions and grading | Cannot grade another teacher's unassigned work or change finance/admin/Nexus settings |
| Student | Own dashboard, assigned materials/assignments, eligible published CBT, own results and attendance | Cannot view another learner, unpublished exams/answers, staff/admin screens or another student's records |
| Parent | Own linked children, published results, authorised fees/receipts, attendance, messages and access requests | Cannot access unrelated children, other parents, unpublished results, private staff data or school administration |

Each test must be executed with real test identities on a staging copy or a controlled DEMO dataset. Record the account role, school, expected outcome, actual outcome, timestamp and screenshot/log evidence. Include wrong-school, wrong-parent, wrong-student, unassigned-teacher, suspended-account, expired-token and duplicate-request cases.

### 8.4 Release disposition after deeper review

- No confirmed anonymous data leak was identified in the three public RPCs inspected; the customer-care RPC is now scoped to RESA, announcements are publication/expiry filtered, and the public website-content query returned no current rows.
- The two no-policy event tables are currently protected by absent API grants and RLS.
- No bulk permission change is justified by the advisor warnings alone.
- **The teacher-wide student-record helper and parent revocation consistency require explicit acceptance or hardening before a release decision.**
- Payment retry/idempotency and manual child-collection fallback need dedicated tests/policy confirmation.
- Current CI is build/typecheck-only; role-based acceptance has not been automated or fully executed.

**Updated disposition: NO-GO pending the four items above, a real four-role acceptance run, Auth leaked-password protection review, backup/restore rehearsal and hosting verification.** This review has not changed production state.

## 9. Owner decision — teacher access scope, 15 November 2026

The school owner accepted the recommended professional access model: **least-privilege, assignment-based teacher access**, rather than unrestricted school-wide access for every teacher.

### Approved target policy

- **Subject/class teachers:** Access student records and operational data only for classes, subjects and students covered by their active assignments, and only for the functions required to perform those duties.
- **Form teachers:** Receive the additional academic, attendance and welfare visibility needed for their assigned form/class. This is not blanket access to unrelated classes.
- **Administrators:** Retain school-wide access according to their active administrative role and permissions.
- **Parents and students:** Remain limited to their own linked child/learner records and the information explicitly published or shared with them.
- **Temporary/special duties:** Any wider access must be granted explicitly, be time-bounded where practical, and be auditable; it must not be inferred merely from having a teacher membership.

### Implementation and release requirements

The live `can_access_student_record` helper currently grants a broader school-wide teacher path and is referenced by 19 RLS policies. That live helper and its dependent policies have **not** been changed. Before implementation, map each dependent table to the minimum relevant assignment rule; some records may require form-teacher scope, some subject/class scope, and some administrator-only access. Do not apply one generic assignment predicate to every table without reviewing its purpose.

Implement the revised rules in a reviewed migration and test suite on an isolated database/staging copy first. Required cases include:
- assigned subject/class teacher can access only the permitted students and record categories;
- unassigned teacher is denied, including when the student is in the same school;
- form teacher receives only the approved additional class-level visibility;
- administrator retains intended school-wide access;
- parent/student access remains limited to linked/own records;
- suspended or inactive teacher loses access;
- cross-school identifiers and stale assignments are denied;
- assignment changes/revocation take effect as intended, including existing sessions/tokens.

The migration must preserve existing administrator workflows and avoid accidental denial of necessary attendance, safeguarding or academic operations. Any special-duty exception must be explicit and tested.

**Decision status:** Owner-approved target policy. **Implementation status:** Not implemented in production. The live database remains unchanged. Release remains NO-GO until the policy is implemented, independently reviewed and the positive/negative role tests pass.
