-- Admin-controlled bulk preparation of missing attendance QR identities.
-- All newly prepared credentials remain pending until individually approved.
create or replace function public.resa_prepare_missing_attendance_qr(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student_count integer := 0;
  v_staff_count integer := 0;
  v_student_enabled boolean := false;
  v_staff_enabled boolean := false;
begin
  if auth.uid() is null or not public.has_school_role(p_school_id,array['admin']::public.school_role[]) then
    raise exception 'Admin access required';
  end if;

  select coalesce(student_qr_enabled,false),coalesce(staff_qr_enabled,false)
    into v_student_enabled,v_staff_enabled
  from public.smart_access_settings
  where school_id=p_school_id;

  if not found then raise exception 'Smart Access settings are not configured for this school'; end if;
  if not v_student_enabled and not v_staff_enabled then raise exception 'Enable student QR or staff QR in Smart Access settings first'; end if;

  if v_student_enabled then
    insert into public.attendance_qr_credentials(school_id,person_type,student_id,token_hash,created_by,approval_status)
    select p_school_id,'student',s.id,encode(extensions.gen_random_bytes(32),'hex'),auth.uid(),'pending'
    from public.students s
    where s.school_id=p_school_id and s.status='active'
      and not exists (
        select 1 from public.attendance_qr_credentials q
        where q.school_id=p_school_id and q.student_id=s.id and q.is_active
      );
    get diagnostics v_student_count = row_count;
  end if;

  if v_staff_enabled then
    insert into public.attendance_qr_credentials(school_id,person_type,staff_id,token_hash,created_by,approval_status)
    select p_school_id,'staff',st.id,encode(extensions.gen_random_bytes(32),'hex'),auth.uid(),'pending'
    from public.staff st
    where st.school_id=p_school_id and st.status='active'
      and not exists (
        select 1 from public.attendance_qr_credentials q
        where q.school_id=p_school_id and q.staff_id=st.id and q.is_active
      );
    get diagnostics v_staff_count = row_count;
  end if;

  return jsonb_build_object(
    'students_created',v_student_count,
    'staff_created',v_staff_count,
    'total_created',v_student_count+v_staff_count,
    'approval_required',true
  );
end;
$function$;

revoke all on function public.resa_prepare_missing_attendance_qr(uuid) from public,anon;
grant execute on function public.resa_prepare_missing_attendance_qr(uuid) to authenticated;
