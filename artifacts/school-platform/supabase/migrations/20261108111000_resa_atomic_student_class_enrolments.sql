-- Atomically reassign a student to a class and academic session.
-- All previous active enrolments are closed and recorded in history in the
-- same transaction as the new active enrolment.
create or replace function public.resa_assign_student_enrollment(
  p_school_id uuid,
  p_student_id uuid,
  p_class_id uuid,
  p_academic_session_id uuid,
  p_enrollment_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_student_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
  v_old record;
  v_closed integer := 0;
begin
  if v_actor is null then
    raise exception 'Sign in is required';
  end if;
  if not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
    raise exception 'Only an active school administrator can assign class enrolments';
  end if;

  select st.id into v_student_id
  from public.students st
  where st.id = p_student_id
    and st.school_id = p_school_id
    and st.status = 'active'
  for update;
  if not found then
    raise exception 'The student is not active in this school';
  end if;

  if not exists (
    select 1 from public.school_classes c
    where c.id = p_class_id and c.school_id = p_school_id
  ) then
    raise exception 'Choose a class belonging to this school';
  end if;

  if not exists (
    select 1 from public.academic_sessions a
    where a.id = p_academic_session_id and a.school_id = p_school_id
  ) then
    raise exception 'Choose an academic session belonging to this school';
  end if;

  select e.id into v_existing_id
  from public.student_enrollments e
  where e.school_id = p_school_id
    and e.student_id = p_student_id
    and e.class_id = p_class_id
    and e.academic_session_id = p_academic_session_id
    and e.status = 'active'
  for update;

  if found then
    return jsonb_build_object('success', true, 'unchanged', true, 'enrollment_id', v_existing_id);
  end if;

  for v_old in
    select e.id, e.class_id, e.academic_session_id, e.enrollment_date
    from public.student_enrollments e
    where e.school_id = p_school_id
      and e.student_id = p_student_id
      and e.status = 'active'
    for update
  loop
    update public.student_enrollments
    set status = 'completed'
    where id = v_old.id and school_id = p_school_id;

    insert into public.student_enrollment_history(
      school_id, student_id, academic_session_id, class_id,
      enrollment_date, exit_date, status, reason, recorded_by
    ) values (
      p_school_id, p_student_id, v_old.academic_session_id, v_old.class_id,
      v_old.enrollment_date, coalesce(p_enrollment_date, current_date),
      'completed', 'Class/session reassignment', v_actor
    );
    v_closed := v_closed + 1;
  end loop;

  insert into public.student_enrollments(
    school_id, student_id, class_id, academic_session_id, enrollment_date, status
  ) values (
    p_school_id, p_student_id, p_class_id, p_academic_session_id,
    coalesce(p_enrollment_date, current_date), 'active'
  )
  returning id into v_new_id;

  insert into public.student_enrollment_history(
    school_id, student_id, academic_session_id, class_id,
    enrollment_date, status, reason, recorded_by
  ) values (
    p_school_id, p_student_id, p_academic_session_id, p_class_id,
    coalesce(p_enrollment_date, current_date), 'active',
    case when v_closed > 0 then 'New class/session assignment' else 'Initial class assignment' end,
    v_actor
  );

  return jsonb_build_object(
    'success', true,
    'unchanged', false,
    'enrollment_id', v_new_id,
    'previous_enrolments_closed', v_closed
  );
end;
$function$;

revoke all on function public.resa_assign_student_enrollment(uuid, uuid, uuid, uuid, date) from public, anon;
grant execute on function public.resa_assign_student_enrollment(uuid, uuid, uuid, uuid, date) to authenticated;
