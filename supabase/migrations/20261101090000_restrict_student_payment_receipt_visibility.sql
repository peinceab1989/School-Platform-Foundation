-- Restrict student payment receipt visibility to school admins and the
-- authenticated parent/guardian or student associated with the receipt.
-- The existing parent_can_access_student helper enforces an active guardian
-- portal and active parent-student portal link.

begin;

drop policy if exists "school members can read student payment receipts"
  on public.student_payment_receipts;

drop policy if exists "families can read own student payment receipts"
  on public.student_payment_receipts;

create policy "families can read own student payment receipts"
  on public.student_payment_receipts
  for select
  to authenticated
  using (
    public.parent_can_access_student(issued_to_student_id)
    or exists (
      select 1
      from public.students as student
      where student.id = student_payment_receipts.issued_to_student_id
        and student.school_id = student_payment_receipts.school_id
        and student.user_id = (select auth.uid())
        and public.has_school_role(
          student.school_id,
          array['student'::public.school_role]
        )
    )
  );

commit;
