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
