-- Document the live service-role-only access model for public visitor support.
alter table public.resa_public_care_conversations enable row level security;
alter table public.resa_public_care_messages enable row level security;
alter table public.resa_public_care_rate_limits enable row level security;

revoke all on public.resa_public_care_conversations from public,anon,authenticated;
revoke all on public.resa_public_care_messages from public,anon,authenticated;
revoke all on public.resa_public_care_rate_limits from public,anon,authenticated;

grant all on public.resa_public_care_conversations to service_role;
grant all on public.resa_public_care_messages to service_role;
grant all on public.resa_public_care_rate_limits to service_role;
grant usage,select on sequence public.resa_public_care_rate_limits_id_seq to service_role;

revoke all on function public.resa_public_care_consume_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.resa_public_care_consume_rate_limit(text,text,integer,integer) to service_role;
revoke all on function public.resa_public_care_track_message() from public,anon,authenticated,service_role;
