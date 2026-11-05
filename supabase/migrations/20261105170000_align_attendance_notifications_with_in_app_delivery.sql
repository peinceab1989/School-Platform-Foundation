-- Attendance notifications are delivered to the RESA in-app inbox.
-- The parent dashboard optionally mirrors them to browser/OS notifications.
-- No WhatsApp delivery worker is currently deployed, so do not label new
-- records as WhatsApp messages or leave them in an external-send queue.
alter table public.biometric_parent_notifications
  alter column channel set default 'in_app';

create or replace function public.create_biometric_parent_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_date date;
begin
  if new.event_type is null or new.event_type not in ('check_in', 'check_out') then
    raise exception 'Invalid biometric attendance event type';
  end if;

  v_event_date := (new.event_time at time zone 'Africa/Lagos')::date;

  if not exists (
    select 1
    from public.biometric_devices d
    where d.id = new.biometric_device_id
      and d.school_id = new.school_id
      and d.is_active = true
  ) then
    raise exception 'Invalid or inactive biometric device';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = new.student_id
      and s.school_id = new.school_id
      and s.status = 'active'
  ) then
    raise exception 'Invalid or inactive student';
  end if;

  if not exists (
    select 1
    from public.student_enrollments se
    join public.academic_sessions a
      on a.id = se.academic_session_id
     and a.school_id = se.school_id
    where se.school_id = new.school_id
      and se.student_id = new.student_id
      and se.status = 'active'
      and a.is_current = true
      and v_event_date between a.start_date and a.end_date
  ) then
    raise exception 'No valid current academic enrollment for this attendance event';
  end if;

  insert into public.biometric_parent_notifications (
    school_id,
    student_id,
    biometric_event_id,
    parent_guardian_id,
    channel,
    notification_type,
    message,
    status,
    sent_at
  )
  select
    new.school_id,
    new.student_id,
    new.id,
    pga.parent_guardian_id,
    'in_app',
    'attendance',
    'Your child has ' ||
      case when new.event_type = 'check_in' then 'checked in' else 'checked out' end ||
      ' at school at ' ||
      to_char(new.event_time at time zone 'Africa/Lagos', 'DD Mon YYYY, HH12:MI AM'),
    'delivered',
    now()
  from public.parent_student_portal_access pga
  where pga.school_id = new.school_id
    and pga.student_id = new.student_id
    and pga.is_active = true;

  return new;
end;
$function$;