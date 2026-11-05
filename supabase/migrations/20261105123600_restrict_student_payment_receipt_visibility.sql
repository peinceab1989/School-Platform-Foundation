drop policy if exists "school members can read student payment receipts" on public.student_payment_receipts;
create policy "students and authorised parents can read own payment receipts"
on public.student_payment_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.students st
    where st.id = student_payment_receipts.issued_to_student_id
      and st.school_id = student_payment_receipts.school_id
      and st.user_id = (select auth.uid())
      and st.status = 'active'
  )
  or (
    public.has_school_role(
      student_payment_receipts.school_id,
      array['parent'::public.school_role]
    )
    and public.parent_can_access_student(student_payment_receipts.issued_to_student_id)
    and exists (
      select 1
      from public.student_fee_payments fp
      join public.parent_fee_portal_views pfv
        on pfv.student_fee_assignment_id = fp.student_fee_assignment_id
       and pfv.student_id = student_payment_receipts.issued_to_student_id
       and pfv.school_id = student_payment_receipts.school_id
       and pfv.can_view = true
      where fp.id = student_payment_receipts.payment_id
        and fp.school_id = student_payment_receipts.school_id
        and public.parent_can_access_guardian(pfv.parent_guardian_id)
    )
  )
);