-- RESA public visitor Customer Care with private, service-role-only records.
create table if not exists public.resa_public_care_conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  visitor_name text not null check (char_length(visitor_name) between 2 and 100),
  visitor_email text check (visitor_email is null or char_length(visitor_email) <= 254),
  visitor_token_hash text not null check (visitor_token_hash ~ '^[0-9a-f]{64}$'),
  assigned_admin_id uuid not null references auth.users(id) on delete restrict,
  duty_key text not null default 'general'
    check (duty_key in ('general','fees','admissions','cbt','results','attendance','technical')),
  status text not null default 'open' check (status in ('open','waiting','closed')),
  last_message_sender_kind text not null default 'visitor'
    check (last_message_sender_kind in ('visitor','admin')),
  last_admin_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists resa_public_care_conversations_school_recent
  on public.resa_public_care_conversations(school_id,last_message_at desc);
create index if not exists resa_public_care_conversations_admin_recent
  on public.resa_public_care_conversations(assigned_admin_id,status,last_message_at desc);
create index if not exists resa_public_care_conversations_unread
  on public.resa_public_care_conversations(assigned_admin_id,last_message_at desc)
  where status <> 'closed' and last_message_sender_kind = 'visitor';
create table if not exists public.resa_public_care_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.resa_public_care_conversations(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('visitor','admin')),
  sender_admin_id uuid references auth.users(id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists resa_public_care_messages_conversation_recent
  on public.resa_public_care_messages(conversation_id,created_at);
create table if not exists public.resa_public_care_rate_limits (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null check (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  action_key text not null check (action_key in ('start','message','poll')),
  created_at timestamptz not null default now()
);
create index if not exists resa_public_care_rate_limits_lookup
  on public.resa_public_care_rate_limits(fingerprint_hash,action_key,created_at desc);

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

-- Atomic per-fingerprint throttling. The advisory transaction lock prevents
-- simultaneous requests from bypassing a count-then-insert rate check.
create or replace function public.resa_public_care_consume_rate_limit(
  p_fingerprint_hash text,
  p_action_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  current_count integer;
begin
  if p_fingerprint_hash !~ '^[0-9a-f]{64}$'
     or p_action_key not in ('start','message','poll')
     or p_max < 1 or p_max > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint_hash || ':' || p_action_key, 0));
  select count(*)::integer into current_count
  from public.resa_public_care_rate_limits
  where fingerprint_hash = p_fingerprint_hash and action_key = p_action_key
    and created_at >= now() - make_interval(secs => p_window_seconds);
  if current_count >= p_max then return false; end if;
  insert into public.resa_public_care_rate_limits(fingerprint_hash,action_key)
  values (p_fingerprint_hash,p_action_key);
  delete from public.resa_public_care_rate_limits
  where fingerprint_hash = p_fingerprint_hash and action_key = p_action_key
    and created_at < now() - interval '1 day';
  return true;
end;
$function$;
revoke all on function public.resa_public_care_consume_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.resa_public_care_consume_rate_limit(text,text,integer,integer) to service_role;
