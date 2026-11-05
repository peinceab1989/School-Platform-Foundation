create or replace function public.can_access_student_record(p_school_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null and (
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

revoke all on function public.can_access_student_record(uuid,uuid) from public, anon;
grant execute on function public.can_access_student_record(uuid,uuid) to authenticated;

alter policy "school members can read student awards" on public.student_awards
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student career aspirations" on public.student_career_aspirations
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student certificates" on public.student_certificates
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student character assessments" on public.student_character_assessments
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student class transitions" on public.student_class_transitions
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student club memberships" on public.student_club_memberships
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student enrollment history" on public.student_enrollment_history
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student hobbies interests" on public.student_hobbies_interests
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student house memberships" on public.student_house_memberships
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student previous schools" on public.student_previous_schools
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student readmissions" on public.student_readmissions
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student skills talents" on public.student_skills_talents
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student status history" on public.student_status_history
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student transfer records" on public.student_transfer_records
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read student withdrawals" on public.student_withdrawals
  using (public.can_access_student_record(school_id, student_id));
alter policy "school members can read enrollments" on public.student_enrollments
  using (public.can_access_student_record(school_id, student_id));

alter policy "school members can read student fee discounts" on public.student_fee_discounts
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

alter policy "school members can read student portal accounts" on public.student_portal_accounts
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or exists (
      select 1 from public.students st
      where st.id = student_portal_accounts.student_id
        and st.school_id = student_portal_accounts.school_id
        and st.user_id = auth.uid()
    )
  );

alter policy "school members can read student payment receipts" on public.student_payment_receipts
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or public.can_access_student_record(school_id, issued_to_student_id)
    and public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or (
      public.has_school_role(school_id, array['parent']::public.school_role[])
      and public.parent_can_access_student(issued_to_student_id)
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

alter policy "school members can read library fines" on public.library_fines
  using (public.can_access_student_record(school_id, student_id));

alter policy "school members can read class timetables" on public.class_timetables
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or exists (
      select 1
      from public.student_enrollments se
      join public.students st on st.id = se.student_id and st.school_id = se.school_id
      where se.school_id = class_timetables.school_id
        and se.class_id = class_timetables.class_id
        and se.status = 'active'
        and (st.user_id = auth.uid() or public.parent_can_access_student(st.id))
    )
  );

alter policy "school members can read teacher assignments" on public.teacher_assignments
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or exists (
      select 1
      from public.student_enrollments se
      join public.students st on st.id = se.student_id and st.school_id = se.school_id
      where se.school_id = teacher_assignments.school_id
        and se.class_id = teacher_assignments.class_id
        and se.status = 'active'
        and (st.user_id = auth.uid() or public.parent_can_access_student(st.id))
    )
  );

alter policy "school members can read visitors" on public.school_visitors
  using (public.has_school_role(school_id, array['admin','teacher']::public.school_role[]));
alter policy "school members can read inventory items" on public.inventory_items
  using (public.has_school_role(school_id, array['admin','teacher']::public.school_role[]));
alter policy "school members can read inventory movements" on public.inventory_movements
  using (public.has_school_role(school_id, array['admin','teacher']::public.school_role[]));
alter policy "school members can read school assets" on public.school_assets
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
alter policy "school members can read staff id cards" on public.staff_id_cards
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
alter policy "school members can read staff qualifications" on public.staff_qualifications
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
alter policy "school members can read staff trainings" on public.staff_trainings
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

alter policy "school members can read school documents" on public.school_documents
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or (is_public = true and public.has_school_role(school_id))
  );
alter policy "school members can read form submissions" on public.school_form_submissions
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or submitted_by = auth.uid()
    or (student_id is not null and public.can_access_student_record(school_id, student_id))
  );
alter policy "school members can read school forms" on public.school_forms
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or (is_active = true and public.has_school_role(school_id))
  );