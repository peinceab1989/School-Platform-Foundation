-- Tighten inherited PUBLIC table grants on Customer Care administration data.
-- The public availability view exposes only the approved schedule fields.
revoke all on table public.resa_customer_care_settings from public,anon,authenticated;
grant select (
  school_id,availability_enabled,availability_days,availability_start,
  availability_end,timezone,website_popup_enabled,soft_sound_enabled
) on table public.resa_customer_care_settings to anon,authenticated;
grant update (
  availability_start,availability_end,availability_days,website_popup_enabled,
  soft_sound_enabled,updated_by,updated_at
) on table public.resa_customer_care_settings to authenticated;

revoke all on table public.resa_customer_care_assignments from public,anon,authenticated;
grant select,insert,update,delete on table public.resa_customer_care_assignments to authenticated;

revoke all on table public.resa_customer_care_public_availability from public,anon,authenticated;
grant select on table public.resa_customer_care_public_availability to anon,authenticated;

revoke all on table public.resa_public_care_conversations from public,anon,authenticated;
revoke all on table public.resa_public_care_messages from public,anon,authenticated;
revoke all on table public.resa_public_care_rate_limits from public,anon,authenticated;
grant all on table public.resa_public_care_conversations to service_role;
grant all on table public.resa_public_care_messages to service_role;
grant all on table public.resa_public_care_rate_limits to service_role;
