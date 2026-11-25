-- Restrict RESA payment gateway administration to the designated proprietor.
-- Secrets are stored only in Supabase Vault; this migration stores Vault UUID references.

create table if not exists public.school_payment_gateway_proprietors (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (school_id, user_id)
);
alter table public.school_payment_gateway_proprietors enable row level security;
revoke all on public.school_payment_gateway_proprietors from public, anon, authenticated;
grant all on public.school_payment_gateway_proprietors to service_role;

insert into public.school_payment_gateway_proprietors (school_id, user_id)
values ('469a9ed9-8e6c-45b8-a76c-89536adb1d3d', '85bfff8f-72ee-49b8-bd80-213001468a0a')
on conflict (school_id, user_id) do nothing;

create table if not exists public.school_payment_gateway_secret_refs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  provider text not null check (provider in ('paystack','monnify','flutterwave')),
  environment text not null check (environment in ('test','live')),
  secret_kind text not null check (secret_kind in ('api_secret_key','webhook_signing_secret')),
  vault_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, provider, environment, secret_kind)
);
comment on table public.school_payment_gateway_secret_refs is
  'Backend-only references to encrypted credentials in Supabase Vault. Never store plaintext credentials here.';
alter table public.school_payment_gateway_secret_refs enable row level security;
revoke all on public.school_payment_gateway_secret_refs from public, anon, authenticated;
grant all on public.school_payment_gateway_secret_refs to service_role;

create table if not exists public.school_payment_gateway_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  provider text not null check (provider in ('paystack','monnify','flutterwave')),
  environment text not null check (environment in ('test','live')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists school_payment_gateway_audit_school_created_idx
  on public.school_payment_gateway_audit (school_id, created_at desc);
alter table public.school_payment_gateway_audit enable row level security;
revoke all on public.school_payment_gateway_audit from public, anon, authenticated;
grant all on public.school_payment_gateway_audit to service_role;

-- Keep gateway settings and intent writes on the trusted server only.
revoke insert, update, delete, truncate, references, trigger
  on public.school_payment_gateway_settings from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.student_fee_payment_intents from anon, authenticated;
revoke all on public.school_payment_webhook_events from public, anon, authenticated;
grant all on public.school_payment_gateway_settings to service_role;
grant all on public.student_fee_payment_intents to service_role;
grant all on public.school_payment_webhook_events to service_role;
