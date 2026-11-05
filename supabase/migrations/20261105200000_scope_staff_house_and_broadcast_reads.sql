alter policy "school members can read staff" on public.staff
  using (
    public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
    or exists (
      select 1
      from public.teacher_assignments ta
      join public.student_enrollments se
        on se.school_id = ta.school_id
       and se.class_id = ta.class_id
       and se.status = 'active'
      join public.students st
        on st.id = se.student_id
       and st.school_id = se.school_id
      where ta.school_id = staff.school_id
        and ta.staff_id = staff.id
        and st.user_id = auth.uid()
    )
  );

alter policy "school members can read house points" on public.house_points
  using (public.can_access_student_record(school_id, student_id));

alter policy "school members can read broadcasts" on public.message_broadcasts
  using (
    public.has_school_role(school_id, array['admin']::public.school_role[])
    or sender_id = auth.uid()
    or exists (
      select 1
      from public.school_memberships membership
      where membership.school_id = message_broadcasts.school_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'::public.membership_status
        and (message_broadcasts.target_role is null or membership.role = message_broadcasts.target_role)
        and (
          message_broadcasts.target_class_id is null
          or exists (
            select 1
            from public.student_enrollments se
            join public.students st on st.id = se.student_id and st.school_id = se.school_id
            where se.school_id = message_broadcasts.school_id
              and se.class_id = message_broadcasts.target_class_id
              and se.status = 'active'
              and (st.user_id = auth.uid() or public.parent_can_access_student(st.id))
          )
          or exists (
            select 1
            from public.teacher_assignments ta
            join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
            where ta.school_id = message_broadcasts.school_id
              and ta.class_id = message_broadcasts.target_class_id
              and st.user_id = auth.uid()
              and st.status = 'active'
          )
          or exists (
            select 1
            from public.class_form_teachers ft
            join public.staff st on st.id = ft.staff_id and st.school_id = ft.school_id
            where ft.school_id = message_broadcasts.school_id
              and ft.class_id = message_broadcasts.target_class_id
              and st.user_id = auth.uid()
              and st.status = 'active'
          )
        )
    )
  );