# RESA Critical Security Follow-ups

**Status:** Read-only findings and remediation/test plan; no production changes.  
**Review date:** 15 November 2026  
**Project:** School digital portal (`mhwwzzxwpsqwhxrsuwaa`)

## 1. Parent portal access revocation

### Live function behaviour observed

The live SECURITY DEFINER helpers currently behave as follows:

- `parent_can_access_guardian(parent_id)` verifies that the signed-in user owns the linked `people.user_id` and that `parents_guardians.portal_enabled = true`.
- `parent_can_access_student(student_id)` verifies the linked person/user, guardian `portal_enabled = true`, an active `parent_student_portal_access` row and the matching student.
- Neither helper independently checks that the matching `parent_portal_accounts.is_active` row is active.
- Neither helper independently checks that the matching `school_memberships` row has role parent and status active.
- The inspected tables have no revocation triggers that synchronise these flags.

### Live RLS policy snapshot

| Policy pattern | Count |
|---|---:|
| Policies using `parent_can_access_student` | 22 |
| Policies using `parent_can_access_guardian` | 9 |
| Student-helper policies without a visible `has_school_role` predicate | 9 |
| Guardian-helper policies without a visible `has_school_role` predicate | 8 |

This is a concrete hardening gap: in those policies, setting only the parent portal account inactive or suspending only the parent membership does not necessarily cause these helper predicates to deny access. The current live dataset snapshot had zero mismatches between `parent_portal_accounts.is_active` and `parents_guardians.portal_enabled`, and zero inactive accounts with active child links; this is reassuring current-state evidence, not a guarantee against future partial updates.

### Application workflow observation

The Parent Management screen directly updates `parents_guardians.portal_enabled` when editing a parent. The separate account/access management workflow reads portal-account and membership state as separate records. These are not one atomic transaction. A failed or alternative workflow can leave inconsistent flags.

### Recommended target

1. Make both helpers require the signed-in user's matching active parent portal account, active parent membership for the same school, enabled guardian portal flag, and (for student access) active parent-child portal link.
2. Ensure account user ID, guardian ID and school ID all match in the same join; do not accept an account row linked to a different guardian or school.
3. Provide one admin-only transactional RPC for enable/suspend/reactivate that updates the membership, portal account, guardian flag and parent-child links consistently. The RPC must validate active school admin authority and target-school ownership.
4. On suspension, deny access through every helper even if one legacy flag remains true. Re-enable only through the same validated transaction.
5. Preserve audit evidence and avoid deleting parent/student relationships as a side effect of suspending login access.

### Required isolated tests

- Each of the three revocation flags changed independently to inactive/disabled must deny all relevant parent RLS policies.
- Parent account active but membership suspended: denied.
- Membership active but parent account inactive: denied.
- Membership/account active but guardian portal disabled: denied.
- Guardian enabled but child link inactive/revoked: denied for that child.
- Parent A cannot read Parent B or an unrelated child, including cross-school identifiers.
- Re-enable via the transactional RPC restores only the intended linked child access.
- Simulate each write failing; transaction must roll back all changes.
- Existing valid parent access, published results, authorised receipts and attendance views must continue to work.

## 2. Fee payment duplicate/retry protection

### Live structure observed

- `student_fee_payments` contains `school_id`, `student_fee_assignment_id`, `student_id`, `amount_paid`, `payment_method`, `reference_number` and `receipt_number`.
- The live indexes include a unique index on payment `receipt_number`, but no unique index on `school_id + reference_number`.
- The receipt table has a unique constraint on `school_id + receipt_number`.
- The inspected `record_verified_school_fee_payment` RPC locks the fee assignment, validates admin role/amount/method/balance and creates payment plus receipt in one transaction. It does not enforce an idempotency key or duplicate payment reference.
- The read-only snapshot contained one payment with a non-empty reference and no blank references. This small DEMO/test-data sample does not prove retry safety.

### Recommended target

Before any live gateway integration, add a required idempotency/reference strategy at the trusted server boundary. For gateway payments, the provider transaction reference must be unique within the school/provider scope and verified server-side. For manually verified payments, require a stable Finance-entered reference or an explicitly generated idempotency token; do not treat blank or client-generated references as proof.

A duplicate request must return the already recorded payment/receipt or a clear duplicate response, never create a second payment. Use a database uniqueness guarantee and handle unique-violation/retry behaviour inside the trusted RPC/Edge Function. Do not rely on frontend button disabling.

### Required isolated tests

- Same idempotency key/reference submitted twice returns one payment and one receipt.
- Two concurrent identical requests create exactly one payment/receipt.
- A timeout after commit followed by retry does not duplicate the payment.
- Same reference in another school follows the documented tenant-scoped uniqueness rule.
- Reusing a reference for a different student or fee assignment is rejected.
- Amount, currency, provider, transaction status, school, student and fee assignment are verified server-side.
- Browser redirect alone never marks a payment verified.
- Finance's existing manual verification and receipt workflow remains functional.

No live payments, references, constraints or receipts were changed during this review.

## 3. Child collection manual verification

The live child-collection release function requires an authenticated admin or teacher, the pickup feature enabled, an active same-school student, collector name and verification note. It supports an approved unused authorisation with matching collector, a valid linked parent QR, or a `manual_verified` fallback. The manual fallback does not require a QR or pre-approved authorisation; the evidence currently rests on staff identity and the required note.

This may be operationally necessary, but it is a safeguarding-policy decision. Before release, RESA leadership must document:

- which staff may use manual verification;
- the minimum identity evidence to check for the collector;
- whether a second staff member/supervisor must approve;
- what happens when the collector is not on the approved list;
- how incidents, corrections and emergency exceptions are audited.

Required isolated negative tests: wrong-school student, inactive student, expired/consumed authorisation, wrong collector, invalid/revoked QR, disabled pickup station, duplicate release, suspended staff and unauthorised teacher. Do not remove the fallback until the school approves an operational replacement.

## 4. Change control and release status

- No production SQL, grants, RLS policies, account records, fee records, receipts, Auth settings, Edge Functions or hosting settings were changed.
- These remediations require a disposable staging database or verified restored DEMO copy. The current project is not to be used as a destructive test environment.
- Reconcile any proposed migration with the live migration registry first. In particular, do not blindly reapply migrations already present in the live database.
- Run the complete admin/teacher/student/parent positive and negative role matrix after every policy change.
- Capture before/after advisor results, migration checksum, test evidence, rollback plan and restore rehearsal.

**Release disposition: NO-GO** until parent revocation is fail-closed, payment idempotency is implemented and tested, the child-collection fallback is formally approved and all role-based acceptance tests pass.


## 5. Migration history reconciliation: public customer-care status

A separate open PR (#90) records migration `20261115060828_scope_public_customer_care_status_to_resa`. The connected live Supabase migration registry already contains this migration, and the PR description states that the matching change was applied and verified in the live project. The SQL file is stored in the repository under `artifacts/school-platform/supabase/migrations/`, not the conventional root `supabase/migrations/` path.

The migration replaces `public.get_public_customer_care_status(uuid)` with a narrowly scoped public lookup: only RESA's configured public website school UUID is queried; other UUIDs return false. It retains `SECURITY DEFINER`, an empty search path, and execute grants for `anon` and `authenticated` because the public website widget requires anonymous execution.

Release handling:
- Do not reapply this migration to the live project.
- Before merging PR #90, verify the repository's migration discovery/configuration convention and confirm the artifact-path migration is included in the authoritative migration history/build process.
- Confirm the deployed function body matches the reviewed SQL and retain the two read-only test cases (RESA UUID returns configured state; unrelated UUID returns false).
- Keep the intentional anonymous-execution advisor finding documented; do not revoke the public widget's required access.
- If repository migration tooling expects `supabase/migrations/`, reconcile file placement/history in a separate reviewed change without changing the live function.

This reconciliation was read-only. No migration was applied, moved, merged or deployed during this follow-up.


## 6. Reconfirmed live policy exposure (15 Nov 2026 follow-up)

A fresh read-only inspection of the connected production project reconfirmed that `public.can_access_student_record(uuid,uuid)` still returns true for any active teacher membership in the supplied school after confirming that the student belongs to that school. It does not check the teacher's staff profile, current-session assignment, class, or subject.

The helper is used by SELECT policies on:
- `house_points`
- `library_fines`
- `school_form_submissions`
- `student_awards`
- `student_career_aspirations`
- `student_certificates`
- `student_character_assessments`
- `student_class_transitions`
- `student_club_memberships`
- `student_enrollment_history`
- `student_enrollments`
- `student_hobbies_interests`
- `student_house_memberships`
- `student_previous_schools`
- `student_readmissions`
- `student_skills_talents`
- `student_status_history`
- `student_transfer_records`
- `student_withdrawals`

A separate fresh policy query also found school-wide teacher branches on `students`, `people`, and `school_form_submissions`; these do not become safe merely by changing the helper. The form-submission SELECT policy currently includes a direct admin-or-teacher branch in addition to submitter and helper checks. Other school-wide staff policies exist for inventory, visitors and child-collection release; these need explicit school policy decisions rather than blanket changes.

Current-session form-teacher assignments remain zero. The earlier current-session subject/class assignment snapshot was 42 rows across 3 teachers. Therefore a migration that removes blanket teacher access must not silently grant form-teacher access to anyone until the school configures those assignments. Subject teachers should be scoped to assigned class/subject/session where the table's data purpose permits; form-teacher-only records must use a distinct predicate; financial/history/admin-only records must remain admin-only.

## 7. Reconfirmed parent revocation and fee payment safeguards

The live `parent_can_access_student` helper checks linked person, enabled guardian and active child access, but does not independently require an active `parent_portal_accounts` row or active same-school parent membership, and does not verify an active `student_parent_guardians` relationship row. The live `parent_can_access_guardian` helper likewise does not require the portal account or active parent membership. This is separate from the source-only push audience fix in PR #88.

The live fee RPC `record_verified_school_fee_payment(uuid,uuid,numeric,text,text,text)` still accepts a nullable reference and has no request idempotency key. The table has a unique receipt-number index, but no unique school/reference constraint. A read-only production snapshot found one payment with a reference and zero without; this tiny sample is not proof of retry safety. The UI currently passes no idempotency key. Any fix must atomically persist a stable client request key, return the original receipt for a true retry, reject key/reference reuse with a different assignment or amount, and protect concurrent duplicate calls with a database uniqueness constraint.

## 8. Safe-release boundary

No production database changes were made during this follow-up. No Supabase development branch was created because the user requires zero additional cost. A production migration is not safe to apply until it has been generated in the repository's actual local Supabase CLI workflow and tested against a disposable local database with role-specific pgTAP cases. The local Supabase CLI is not available in the connected execution environment, and the repository could not be cloned into that environment because network DNS was unavailable. Do not substitute unverified SQL execution against production for isolated testing.
