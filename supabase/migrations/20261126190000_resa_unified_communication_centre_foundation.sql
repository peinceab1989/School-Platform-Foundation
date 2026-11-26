-- RESA Unified Communication Centre foundation.
-- Additive and idempotent: preserves all existing conversations, messages,
-- school messages, memberships, push subscriptions and user preferences.
alter table public.resa_notification_preferences
  add column if not exists category_preferences jsonb not null default
    '{"messages":true,"group_messages":true,"announcements":true,"attendance":true,"academics":true,"results":true,"fees":true,"admissions":true,"cbt":true,"school_activities":true,"system_alerts":true}'::jsonb,
  add column if not exists category_sounds jsonb not null default
    '{"messages":"resa_chime","group_messages":"digital_ping","announcements":"school_bell","attendance":"gentle_melody","academics":"soft_tone","results":"crystal_drop","fees":"classic_bell","admissions":"message_pop","cbt":"double_beep","school_activities":"vibrant_ring","system_alerts":"alert_tone"}'::jsonb,
  add column if not exists vibration_enabled boolean not null default true,
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start time not null default '21:00',
  add column if not exists quiet_hours_end time not null default '07:00',
  add column if not exists show_notification_preview boolean not null default true,
  add column if not exists in_app_sound_enabled boolean not null default true,
  add column if not exists updated_from_device text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.resa_notification_preferences'::regclass and conname='resa_notification_category_preferences_object') then
    alter table public.resa_notification_preferences add constraint resa_notification_category_preferences_object
      check (jsonb_typeof(category_preferences) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.resa_notification_preferences'::regclass and conname='resa_notification_category_sounds_object') then
    alter table public.resa_notification_preferences add constraint resa_notification_category_sounds_object
      check (jsonb_typeof(category_sounds) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.resa_notification_preferences'::regclass and conname='resa_notification_device_label_length') then
    alter table public.resa_notification_preferences add constraint resa_notification_device_label_length
      check (updated_from_device is null or length(updated_from_device) <= 120);
  end if;
end $$;

-- Central administrator policy for communication channels. Defaults preserve
-- the current operating posture; admins can later disable individual channels
-- without deleting messages or personal notification choices.
alter table public.resa_chat_settings
  add column if not exists channel_policy jsonb not null default
    '{"private_messages":true,"group_messages":true,"announcements":true,"customer_care":true,"voice_calls":false,"video_calls":false,"file_attachments":true,"voice_notes":true}'::jsonb,
  add column if not exists role_policy jsonb not null default
    '{"admin":{"private_messages":true,"group_messages":true,"announcements":true},"teacher":{"private_messages":true,"group_messages":true,"announcements":true},"parent":{"private_messages":true,"group_messages":true,"announcements":true},"student":{"private_messages":false,"group_messages":true,"announcements":true}}'::jsonb,
  add column if not exists policy_updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.resa_chat_settings'::regclass and conname='resa_chat_channel_policy_object') then
    alter table public.resa_chat_settings add constraint resa_chat_channel_policy_object
      check (jsonb_typeof(channel_policy) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.resa_chat_settings'::regclass and conname='resa_chat_role_policy_object') then
    alter table public.resa_chat_settings add constraint resa_chat_role_policy_object
      check (jsonb_typeof(role_policy) = 'object');
  end if;
end $$;

comment on column public.resa_notification_preferences.category_preferences is
  'Per-user opt-in/out by RESA notification category; does not override mandatory admin/security alerts.';
comment on column public.resa_notification_preferences.category_sounds is
  'Per-category RESA sound identifiers. Actual background sound is subject to browser and OS notification-channel support.';
comment on column public.resa_chat_settings.channel_policy is
  'Administrator-managed global availability of communication channels. Voice/video remain disabled until a call provider is configured.';
comment on column public.resa_chat_settings.role_policy is
  'Administrator-managed role permissions for communication channels; must be enforced server-side before release.';
