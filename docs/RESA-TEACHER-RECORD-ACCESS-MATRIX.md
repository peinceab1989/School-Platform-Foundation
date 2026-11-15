# RESA Teacher Record Access Matrix

**Status:** Design proposal for review; not a production migration.  
**Reviewed:** 15 November 2026  
**Source:** Read-only inspection of the linked RESA Supabase schema and RLS policies.  
**Owner decision:** Use least-privilege, assignment-based teacher access.

## 1. Approved role model

| Role | Default record visibility |
|---|---|
| School administrator | School-wide, subject to active admin membership and existing function-level controls |
| Subject/class teacher | Current-session roster for classes in their active teacher assignments; no general access to unrelated student welfare, family, financial or historical records |
| Form teacher | Additional class-level academic, attendance and pastoral information for the class assigned to them in the current academic session |
| Student | Own records and information published/shared with them |
| Parent | Records of their actively linked child(ren), subject to parent portal access and publication/visibility rules |

A teacher membership alone is never sufficient for school-wide student-record access. Temporary wider duties must be explicitly authorised and auditable. The current role enum contains only admin, teacher, student and parent; there is no separate finance, librarian, counsellor or safeguarding-officer role in the inspected enum snapshot.

## 2. Current implementation risk

The live `public.can_access_student_record(p_school_id, p_student_id)` function currently treats any active teacher membership in the school as sufficient. It does not check class, subject, form-teacher assignment or record sensitivity.

The helper is referenced by 19 SELECT policies. In addition, the `school_form_submissions` policy separately includes an `admin OR teacher` role branch, so narrowing the helper alone would **not** remove unrestricted teacher access to form submissions.

No production function or policy was changed during this review.

## 3. Record-by-record target matrix

| Table / record category | Subject/class teacher | Form teacher | Administrator | Parent/student |
|---|---|---|---|---|
| `student_enrollments` (class roster) | Assigned current-session class only | Assigned current-session form only | School-wide | Own/linked rows only |
| `student_awards` | No default access | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_certificates` | No default access | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_character_assessments` | No default access | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_career_aspirations` | No default access | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_hobbies_interests` | No default access | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_skills_talents` | No default access | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_club_memberships` | No default access until a club-sponsor assignment model exists | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_house_memberships`, `house_points` | No default access until a house-officer assignment model exists | Assigned form class | School-wide | Own/linked rows where portal policy permits |
| `student_class_transitions`, `student_enrollment_history` | No access | No default access; only a separately approved summary view if needed | School-wide | Own/linked rows only if explicitly exposed |
| `student_previous_schools`, `student_readmissions` | No access | No default access | School-wide | Own/linked rows only if explicitly exposed |
| `student_status_history`, `student_transfer_records`, `student_withdrawals` | No access | No default access | School-wide | Own/linked rows only if explicitly exposed |
| `library_fines` | No access (financial record) | No access by default | School-wide | Own/linked balance only through a deliberately limited parent/student view |
| `school_form_submissions` | Own submissions only; no general teacher directory access | Own submissions only unless a separately defined form-review permission exists | School-wide | Submitter's own submission only, where applicable |

**Important:** The parent/student column above is a target visibility boundary, not a statement that every listed table is currently exposed to those roles. Existing parent/student policies and product workflows must be preserved and tested independently. Do not broaden their access while changing teacher scope.

## 4. Assignment evidence available in the live schema

The inspected schema provides a workable basis for assignment-scoped checks:

- `teacher_assignments`: school, staff, academic session, class and subject.
- `class_form_teachers`: school, staff, academic session and class.
- `staff`: school, user ID and staff status.
- `school_memberships`: signed-in user, school, teacher role and membership status.
- `academic_sessions`: school and `is_current`.
- `student_enrollments`: school, student, class, academic session and status.

The inspected tables do not have a separate active/revoked flag on teacher assignment rows. The implementation should therefore require the current academic session, active staff record, active teacher membership and a matching assignment. Assignment deletion/reassignment semantics must be verified before relying on them as revocation.

A subject assignment includes a class and subject, but most of the 19 policy tables do not carry a subject ID. Therefore subject assignment must **not** be treated as permission to read every student profile or pastoral record for that class. It may support the class roster and separately approved subject-specific workflows only.

## 5. Policy implementation approach

Do not simply change the teacher branch of the existing helper and assume the job is complete.

1. Introduce narrowly named, schema-qualified SECURITY DEFINER predicates with an empty search path, each deriving identity from `auth.uid()`:
   - current assigned-class roster access;
   - current form-teacher class access;
   - administrator access through active membership;
   - existing parent/student relationship access.
2. For each table, compose only the predicate(s) approved in section 3. Keep parent/student predicates independent of teacher predicates.
3. Remove the blanket `admin, teacher` shortcut from `school_form_submissions`; retain admin and submitter access, and add a form-review permission only if a real ownership/assignment model is established.
4. Keep historical transfer, withdrawal, previous-school and status-change records administrator-only unless the school approves a narrowly defined additional duty.
5. Do not add a new role enum value or generic override until all call sites, UI flows and RPCs are mapped.
6. Preserve existing write policies and RPCs unless a separate review proves they need change. This proposal concerns the identified SELECT access paths only.
7. Review all other policies that grant teacher access independently of this helper; RLS policies are permissive by default and their OR-combination can bypass a narrowed helper.

## 6. Required isolated test matrix

Use a disposable staging database or restored DEMO copy with separate authenticated identities. Do not use live student records as test fixtures.

| Test identity / condition | Expected result |
|---|---|
| Active administrator in RESA | Can read the intended school-wide administrative records |
| Active subject teacher assigned to Class A, current session | Can read Class A roster; cannot read Class B roster |
| Same teacher, unassigned class in same school | Denied |
| Same teacher, unrelated student record in same school | Denied unless the table matrix explicitly allows the form teacher |
| Active form teacher assigned to Class A, current session | Can read the approved Class A pastoral/academic categories only |
| Teacher assigned only in a previous academic session | No current-session teacher access |
| Suspended teacher membership | Denied immediately |
| Inactive staff record | Denied |
| Teacher assignment removed/reassigned | Access revoked as soon as the assignment change commits |
| Parent linked to Child A | Can access only approved Child A portal data |
| Parent not linked to Child B | Denied for Child B |
| Student account for Student A | Can access only Student A's own permitted data |
| Any role with another school's UUID/student ID | Denied |
| Teacher on `school_form_submissions` | Own submission only; not all submissions |
| Teacher with no assignment rows | No student-record access by virtue of teacher membership alone |

For each test, record role, school, assignment/session, target student, table, expected result, actual result and evidence. Include positive as well as negative assertions.

## 7. Release gates

- [ ] Map every policy on all 19 tables, including policies that do not call the current helper but grant teacher access independently.
- [ ] Confirm intended visibility with the school safeguarding/academic leadership for sensitive categories.
- [ ] Implement the predicates and per-table policies in a new reviewed migration on an isolated database.
- [ ] Add automated SQL/RLS tests for the full matrix above.
- [ ] Verify all application screens and RPCs used by teachers still work for assigned classes.
- [ ] Verify admin, parent and student access has not regressed.
- [ ] Verify teacher reassignment, suspension and session rollover revoke access correctly.
- [ ] Reconcile the migration against the live Supabase migration registry before any production rollout.
- [ ] Obtain a reviewed backup and restore rehearsal before production changes.

## 8. Explicit non-actions

This file is a design artifact only. No live SQL, RLS policies, grants, data, Auth settings, Edge Functions or hosting settings were changed. Do not merge or deploy a future migration solely because it compiles; the isolated role tests and owner review are mandatory.

**Release disposition: NO-GO until the above controls are implemented and evidenced.**

## 9. Live assignment readiness snapshot — 15 November 2026

A read-only aggregate query against the live project found:

| Metric | Snapshot |
|---|---:|
| Current academic sessions | 1 |
| Active teacher memberships | 7 |
| Current-session subject/class assignment rows with active staff and membership | 42 |
| Distinct teachers with current subject/class assignments | 3 |
| Current-session form-teacher assignment rows with active staff and membership | 0 |
| Distinct teachers with current form-teacher assignments | 0 |
| Current-session subject/class assignments with missing or inactive staff | 0 |

This is a readiness observation, not a reason to change records. It means the strict target policy cannot assume that form-teacher assignments are already configured. Before any policy rollout, the school must review and enter its real current-session form-teacher assignments through the approved admin workflow. Until then, the target form-teacher-only record categories should remain administrator-only rather than silently falling back to school-wide teacher access.

The 42 assignment rows are not proof that all seven active teacher accounts have the correct class/subject allocations. Verify the actual assignment roster with school leadership before enabling assignment-based access. Do not create or guess assignments from aggregate counts.
