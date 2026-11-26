-- Public Ask RESA visitor chat. Messages are accessed only through the
-- resa-public-customer-care Edge Function using the service role.
create table if not exists public.resa_public_care_conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  visitor_name text not null,
  visitor_email text,
  visitor_token_hash text not null,
  assigned_admin_id uuid,
  duty_key text not null default 'general'
    check (duty_key in ('general','fees','admissions','cbt','results','attendance','technical')),
  status text not null default 'open' check (status in ('open','waiting','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists resa_public_care_conversations_school_recent
  on public.resa_public_care_conversations(school_id,last_message_at desc);
create index if not exists resa_public_care_conversations_admin_recent
  on public.resa_public_care_conversations(assigned_admin_id,last_message_at desc);
create table if not exists public.resa_public_care_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.resa_public_care_conversations(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('visitor','admin')),
  sender_admin_id uuid,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists resa_public_care_messages_conversation_recent
  on public.resa_public_care_messages(conversation_id,created_at);
create table if not exists public.resa_public_care_rate_limits (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null,
  action_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists resa_public_care_rate_limits_lookup
  on public.resa_public_care_rate_limits(fingerprint_hash,action_key,created_at desc);
alter table public.resa_public_care_conversations enable row level security;
alter table public.resa_public_care_messages enable row level security;
alter table public.resa_public_care_rate_limits enable row level security;
revoke all on public.resa_public_care_conversations from anon, authenticated;
revoke all on public.resa_public_care_messages from anon, authenticated;
revoke all on public.resa_public_care_rate_limits from anon, authenticated;
