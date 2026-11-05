-- Persistent parent attendance alert preferences and inbox read state.
alter table public.biometric_parent_notifications
  add column if not exists read_at timestamptz;

create table if not exists public.parent_attendance_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  parent_guardian_id uuid not null,
  user_id uuid not null,
  enabled boolean not null default false,
  sound_choice text not null default 'chime'
    check (sound_choice in ('chime','bell','soft','none')),
  phone_notifications_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (school_id, parent_guardian_id, user_id)
);

alter table public.parent_attendance_notification_preferences enable row level security;

drop policy if exists "parents manage own attendance notification preferences"
  on public.parent_attendance_notification_preferences;
create policy "parents manage own attendance notification preferences"
on public.parent_attendance_notification_preferences
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = parent_attendance_notification_preferences.school_id
      and a.parent_guardian_id = parent_attendance_notification_preferences.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active = true
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = parent_attendance_notification_preferences.school_id
      and a.parent_guardian_id = parent_attendance_notification_preferences.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active = true
  )
);

drop policy if exists "parents can mark own attendance alerts read"
  on public.biometric_parent_notifications;
create policy "parents can mark own attendance alerts read"
on public.biometric_parent_notifications
for update to authenticated
using (
  exists (
    select 1
    from public.parents_guardians g
    join public.people p on p.id = g.person_id and p.school_id = g.school_id
    join public.parent_student_portal_access a on a.parent_guardian_id = g.id and a.school_id = g.school_id
    where g.id = biometric_parent_notifications.parent_guardian_id
      and g.school_id = biometric_parent_notifications.school_id
      and p.user_id = (select auth.uid())
      and g.portal_enabled = true
      and a.student_id = biometric_parent_notifications.student_id
      and a.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.parents_guardians g
    join public.people p on p.id = g.person_id and p.school_id = g.school_id
    join public.parent_student_portal_access a on a.parent_guardian_id = g.id and a.school_id = g.school_id
    where g.id = biometric_parent_notifications.parent_guardian_id
      and g.school_id = biometric_parent_notifications.school_id
      and p.user_id = (select auth.uid())
      and g.portal_enabled = true
      and a.student_id = biometric_parent_notifications.student_id
      and a.is_active = true
  )
);

create index if not exists parent_attendance_notification_preferences_user_idx
  on public.parent_attendance_notification_preferences(user_id, school_id);
create index if not exists biometric_parent_notifications_parent_created_idx
  on public.biometric_parent_notifications(parent_guardian_id, created_at desc);
