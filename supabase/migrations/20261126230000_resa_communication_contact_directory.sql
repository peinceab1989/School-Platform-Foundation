-- Centralise RESA messaging contact visibility and resolve real school names.
-- Additive change: no messages, memberships, accounts or subscriptions are modified.
create or replace function public.get_school_message_contacts(p_school_id uuid)
returns table(user_id uuid, role public.school_role, display_name text)
language sql
stable
security definer
set search_path to ''
as $function$
  with caller as (
    select m.role
    from public.school_memberships m
    where m.school_id = p_school_id
      and m.user_id = auth.uid()
      and m.status = 'active'::public.membership_status
    limit 1
  )
  select
    m.user_id,
    m.role,
    coalesce(
      nullif(btrim(pr.display_name), ''),
      nullif(btrim(concat_ws(' ', person.first_name, person.middle_name, person.last_name)), ''),
      case m.role
        when 'admin'::public.school_role then 'School administrator · name not set'
        when 'teacher'::public.school_role then 'Teacher · name not set'
        when 'student'::public.school_role then 'Student · name not set'
        when 'parent'::public.school_role then 'Parent/guardian · name not set'
        else 'School member · name not set'
      end
    ) as display_name
  from public.school_memberships m
  cross join caller c
  left join public.profiles pr on pr.id = m.user_id
  left join public.people person on person.user_id = m.user_id and person.school_id = m.school_id
  where m.school_id = p_school_id
    and m.status = 'active'::public.membership_status
    and auth.uid() is not null
    and m.user_id <> auth.uid()
    and (
      c.role = 'admin'::public.school_role
      or (
        c.role = 'parent'::public.school_role
        and (
          m.role = 'admin'::public.school_role
          or (
            m.role = 'teacher'::public.school_role
            and exists (
              select 1
              from public.parent_portal_accounts ppa
              join public.parents_guardians pg
                on pg.id = ppa.parent_guardian_id
               and pg.school_id = ppa.school_id
               and pg.portal_enabled = true
              join public.parent_student_portal_access psa
                on psa.parent_guardian_id = ppa.parent_guardian_id
               and psa.school_id = ppa.school_id
               and psa.is_active = true
              join public.student_enrollments se
                on se.student_id = psa.student_id
               and se.school_id = psa.school_id
               and se.status = 'active'
              join public.teacher_assignments ta
                on ta.class_id = se.class_id
               and ta.school_id = se.school_id
              join public.staff st
                on st.id = ta.staff_id
               and st.school_id = ta.school_id
               and st.status = 'active'
              where ppa.school_id = p_school_id
                and ppa.user_id = auth.uid()
                and ppa.is_active = true
                and st.user_id = m.user_id
            )
          )
        )
      )
      or (
        c.role = 'teacher'::public.school_role
        and (
          m.role = 'admin'::public.school_role
          or (
            m.role = 'student'::public.school_role
            and exists (
              select 1
              from public.staff mine
              join public.teacher_assignments ta
                on ta.staff_id = mine.id and ta.school_id = mine.school_id
              join public.student_enrollments se
                on se.class_id = ta.class_id and se.school_id = ta.school_id
               and se.status = 'active'
              join public.students s
                on s.id = se.student_id and s.school_id = se.school_id
              where mine.school_id = p_school_id
                and mine.user_id = auth.uid()
                and mine.status = 'active'
                and s.user_id = m.user_id
            )
          )
        )
      )
      or (
        c.role = 'student'::public.school_role
        and (
          m.role = 'admin'::public.school_role
          or (
            m.role = 'teacher'::public.school_role
            and exists (
              select 1
              from public.students mine
              join public.student_enrollments se
                on se.student_id = mine.id and se.school_id = mine.school_id
               and se.status = 'active'
              join public.teacher_assignments ta
                on ta.class_id = se.class_id and ta.school_id = se.school_id
              join public.staff st
                on st.id = ta.staff_id and st.school_id = ta.school_id
               and st.status = 'active'
              where mine.school_id = p_school_id
                and mine.user_id = auth.uid()
                and st.user_id = m.user_id
            )
          )
        )
      )
    )
  order by display_name, m.role;
$function$;

revoke all on function public.get_school_message_contacts(uuid) from public, anon;
grant execute on function public.get_school_message_contacts(uuid) to authenticated;
