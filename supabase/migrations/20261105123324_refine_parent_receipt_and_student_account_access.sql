create or replace function public.can_access_student_record(p_school_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and exists (
      select 1 from public.students scope_student
      where scope_student.id = p_student_id
        and scope_student.school_id = p_school_id
    )
    and (
      public.has_school_role(p_school_id, array['admin','teacher']::public.school_role[])
      or exists (
        select 1
        from public.students st
        left join public.people person
          on person.id = st.person_id and person.school_id = st.school_id
        where st.id = p_student_id
          and st.school_id = p_school_id
          and (st.user_id = auth.uid() or person.user_id = auth.uid())
      )
      or (
        public.has_school_role(p_school_id, array['parent']::public.school_role[])
        and public.parent_can_access_student(p_student_id)
      )
    );
$function$;

alter policy "school members can read student portal accounts" on public.student_portal_accounts
  using (
    public.has_school_role(school_id, array['admin']::public.school_role[])
    or user_id = auth.uid()
  );

alter policy "school members can read student payment receipts" on public.student_payment_receipts
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or exists (
      select 1
      from public.students st
      where st.id = student_payment_receipts.issued_to_student_id
        and st.school_id = student_payment_receipts.school_id
        and st.user_id = auth.uid()
    )
    or (
      public.has_school_role(school_id, array['parent']::public.school_role[])
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