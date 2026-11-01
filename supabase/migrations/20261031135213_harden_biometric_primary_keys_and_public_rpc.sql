alter table public.biometric_attendance_events alter column id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.biometric_attendance_events'::regclass
      and contype = 'p'
  ) then
    alter table public.biometric_attendance_events
      add constraint biometric_attendance_events_pkey primary key (id);
  end if;
end
$$;

alter table public.biometric_parent_notifications alter column id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.biometric_parent_notifications'::regclass
      and contype = 'p'
  ) then
    alter table public.biometric_parent_notifications
      add constraint biometric_parent_notifications_pkey primary key (id);
  end if;
end
$$;

alter function public.get_public_customer_care_status(uuid) set search_path = '';