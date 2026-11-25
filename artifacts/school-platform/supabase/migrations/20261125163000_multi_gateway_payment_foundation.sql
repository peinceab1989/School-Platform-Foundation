-- RESA multi-provider payment foundation.
-- This migration adds provider-neutral ledgers only. It does not enable checkout,
-- store gateway credentials, change existing fee/payment records, or issue receipts.

create table if not exists public.school_payment_gateway_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  provider text not null check (provider in ('paystack','monnify','flutterwave')),
  is_enabled boolean not null default false,
  environment text not null default 'test' check (environment in ('test','live')),
  display_name text,
  settlement_bank_name text,
  settlement_account_name text,
  settlement_account_number_last4 text,
  settlement_verified_at timestamptz,
  activated_at timestamptz,
  activated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, provider),
  check (settlement_account_number_last4 is null or settlement_account_number_last4 ~ '^[0-9]{4}$'),
  check (not is_enabled or (activated_at is not null and activated_by is not null))
);

comment on table public.school_payment_gateway_settings is
  'Non-secret provider configuration and settlement metadata. API keys/webhook secrets must remain in Supabase Edge Function secrets, never in this table.';

create table if not exists public.student_fee_payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_fee_assignment_id uuid not null references public.student_fee_assignments(id) on delete restrict,
  student_id uuid not null,
  initiated_by uuid not null references auth.users(id),
  provider text not null check (provider in ('paystack','monnify','flutterwave')),
  provider_reference text not null,
  expected_amount numeric(12,2) not null check (expected_amount > 0),
  expected_amount_minor bigint not null check (expected_amount_minor > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','expired','cancelled')),
  checkout_url text,
  provider_transaction_id text,
  verified_amount_minor bigint,
  verified_currency text,
  failure_code text,
  expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, provider, provider_reference),
  check (verified_amount_minor is null or verified_amount_minor > 0)
);

create index if not exists student_fee_payment_intents_assignment_idx
  on public.student_fee_payment_intents (school_id, student_fee_assignment_id, created_at desc);
create index if not exists student_fee_payment_intents_initiator_idx
  on public.student_fee_payment_intents (initiated_by, created_at desc);
create index if not exists student_fee_payment_intents_status_idx
  on public.student_fee_payment_intents (status, expires_at);

comment on table public.student_fee_payment_intents is
  'Pending online payment attempts. Never insert into student_fee_payments or issue a receipt until the provider is independently verified server-side.';

create table if not exists public.school_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack','monnify','flutterwave')),
  provider_event_id text not null,
  provider_reference text,
  event_type text not null,
  signature_verified boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received','processing','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_code text,
  unique (provider, provider_event_id)
);

comment on table public.school_payment_webhook_events is
  'Minimal webhook idempotency/audit ledger. Raw webhook bodies and secrets are deliberately not stored.';

alter table public.school_payment_gateway_settings enable row level security;
alter table public.student_fee_payment_intents enable row level security;
alter table public.school_payment_webhook_events enable row level security;

revoke all on public.school_payment_gateway_settings from anon, authenticated;
revoke all on public.student_fee_payment_intents from anon, authenticated;
revoke all on public.school_payment_webhook_events from anon, authenticated;

grant select on public.school_payment_gateway_settings to authenticated;
grant select on public.student_fee_payment_intents to authenticated;

drop policy if exists "school admins read payment gateway settings" on public.school_payment_gateway_settings;
create policy "school admins read payment gateway settings"
  on public.school_payment_gateway_settings
  for select to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "parents and admins read own payment intents" on public.student_fee_payment_intents;
create policy "parents and admins read own payment intents"
  on public.student_fee_payment_intents
  for select to authenticated
  using (
    initiated_by = (select auth.uid())
    or public.has_school_role(school_id, array['admin'::public.school_role])
  );

-- No client INSERT/UPDATE/DELETE policies are intentionally created.
-- Only trusted server-side functions using the service role may mutate these ledgers.
