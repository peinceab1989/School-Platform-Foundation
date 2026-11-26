-- Add explicit per-role Customer Care permissions while preserving any
-- administrator-customised values already saved in the JSON policy.
alter table public.resa_chat_settings
  alter column role_policy set default
  '{"admin":{"private_messages":true,"group_messages":true,"announcements":true,"customer_care":true},"teacher":{"private_messages":true,"group_messages":true,"announcements":true,"customer_care":true},"parent":{"private_messages":true,"group_messages":true,"announcements":true,"customer_care":true},"student":{"private_messages":false,"group_messages":true,"announcements":true,"customer_care":true}}'::jsonb;

update public.resa_chat_settings s
set role_policy =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(s.role_policy, '{}'::jsonb),
          '{admin}',
          coalesce(s.role_policy -> 'admin', '{}'::jsonb) ||
            jsonb_build_object('customer_care', coalesce(s.role_policy #> '{admin,customer_care}', 'true'::jsonb)),
          true
        ),
        '{teacher}',
        coalesce(s.role_policy -> 'teacher', '{}'::jsonb) ||
          jsonb_build_object('customer_care', coalesce(s.role_policy #> '{teacher,customer_care}', 'true'::jsonb)),
        true
      ),
      '{parent}',
      coalesce(s.role_policy -> 'parent', '{}'::jsonb) ||
        jsonb_build_object('customer_care', coalesce(s.role_policy #> '{parent,customer_care}', 'true'::jsonb)),
      true
    ),
    '{student}',
    coalesce(s.role_policy -> 'student', '{}'::jsonb) ||
      jsonb_build_object('customer_care', coalesce(s.role_policy #> '{student,customer_care}', 'true'::jsonb)),
    true
  );
