-- Enable student private messaging while preserving the recipient allowlist.
-- Students can contact school administrators and their assigned teachers only;
-- student-to-student messaging remains disallowed by recipient policy.
update public.resa_chat_settings
set role_policy = jsonb_set(
  coalesce(role_policy, '{}'::jsonb),
  '{student,private_messages}',
  'true'::jsonb,
  true
),
updated_at = now()
where school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid;
