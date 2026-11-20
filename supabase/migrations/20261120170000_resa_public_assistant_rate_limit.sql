-- Public RESA assistant: anonymous visitors may use the Edge Function, but
-- rate-limit storage and its mutation API remain inaccessible to browser roles.
create table if not exists public.resa_public_assistant_rate_limits (
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 1 and request_count <= 120),
  primary key (ip_hash, window_start)
);

alter table public.resa_public_assistant_rate_limits enable row level security;
revoke all on table public.resa_public_assistant_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_resa_public_assistant_rate_limit(
  p_ip_hash text,
  p_window_start timestamptz,
  p_max_requests integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_count integer;
begin
  if p_ip_hash is null
    or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_window_start is null
    or p_max_requests is null
    or p_max_requests < 1
    or p_max_requests > 120
  then
    return false;
  end if;

  insert into public.resa_public_assistant_rate_limits as existing (
    ip_hash, window_start, request_count
  )
  values (p_ip_hash, p_window_start, 1)
  on conflict (ip_hash, window_start)
  do update set request_count = existing.request_count + 1
  where existing.request_count < p_max_requests
  returning request_count into v_request_count;

  -- Opportunistic retention cleanup; only hashed network identifiers are stored.
  delete from public.resa_public_assistant_rate_limits
  where window_start < p_window_start - interval '48 hours';

  return v_request_count is not null;
end;
$function$;

revoke all on function public.consume_resa_public_assistant_rate_limit(text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.consume_resa_public_assistant_rate_limit(text, timestamptz, integer)
  to service_role;

comment on table public.resa_public_assistant_rate_limits is
  'Short-lived hashed-IP rate counters for the public RESA virtual assistant. No raw IP addresses or chat content are stored.';
comment on function public.consume_resa_public_assistant_rate_limit(text, timestamptz, integer) is
  'Atomic rate-limit counter callable only by the trusted Supabase service role.';
