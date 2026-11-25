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


-- Tighten the financial invariants and reserve mutation rights for trusted backend
-- execution only. Browser roles remain read-only under the policies above.
alter table public.student_fee_payment_intents
  add constraint student_fee_intents_amount_minor_match
  check (expected_amount_minor = round(expected_amount * 100)::bigint);

create unique index if not exists student_fee_payment_intents_provider_txn_uidx
  on public.student_fee_payment_intents (provider, provider_transaction_id)
  where provider_transaction_id is not null;

grant all privileges on public.school_payment_gateway_settings to service_role;
grant all privileges on public.student_fee_payment_intents to service_role;
grant all privileges on public.school_payment_webhook_events to service_role;

-- The webhook ledger is intentionally invisible to browser sessions.
revoke all on public.school_payment_webhook_events from public, anon, authenticated;


-- A server-only transaction that turns one independently verified Paystack intent
-- into one existing RESA payment and one receipt, atomically.
create or replace function public.record_gateway_verified_school_fee_payment(
  p_intent_id uuid,
  p_provider_transaction_id text,
  p_verified_amount_minor bigint,
  p_verified_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_intent public.student_fee_payment_intents%rowtype;
  v_assignment public.student_fee_assignments%rowtype;
  v_payment public.student_fee_payments%rowtype;
  v_receipt public.student_payment_receipts%rowtype;
  v_paid numeric(12,2);
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_receipt_number text;
  v_payment_id uuid;
  v_receipt_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Trusted payment backend required' using errcode = '42501';
  end if;

  if p_intent_id is null or nullif(trim(coalesce(p_provider_transaction_id, '')), '') is null then
    raise exception 'Verified payment identifiers are required';
  end if;

  select * into v_intent
  from public.student_fee_payment_intents
  where id = p_intent_id and provider = 'paystack'
  for update;

  if not found then raise exception 'Payment intent not found'; end if;

  if v_intent.status = 'paid' then
    select * into v_payment from public.student_fee_payments
    where school_id = v_intent.school_id and idempotency_key = v_intent.id;
    if not found then raise exception 'Paid intent has no matching payment; contact Finance'; end if;
    select * into v_receipt from public.student_payment_receipts
    where school_id = v_intent.school_id and payment_id = v_payment.id;
    if not found then raise exception 'Paid intent has no matching receipt; contact Finance'; end if;
    return jsonb_build_object('success', true, 'already_processed', true,
      'receipt_number', v_receipt.receipt_number, 'payment_id', v_payment.id);
  end if;

  if v_intent.status not in ('pending','processing') then
    raise exception 'Payment intent is not payable';
  end if;
  if v_intent.expires_at is not null and v_intent.expires_at < now() then
    update public.student_fee_payment_intents set status = 'expired', updated_at = now()
      where id = v_intent.id;
    raise exception 'Payment intent has expired';
  end if;
  if p_verified_currency <> 'NGN'
    or p_verified_amount_minor <> v_intent.expected_amount_minor
    or v_intent.currency <> 'NGN'
    or v_intent.expected_amount_minor <> round(v_intent.expected_amount * 100)::bigint then
    raise exception 'Verified amount or currency does not match the payment intent';
  end if;

  select * into v_assignment
  from public.student_fee_assignments
  where id = v_intent.student_fee_assignment_id
    and school_id = v_intent.school_id
    and student_id = v_intent.student_id
  for update;
  if not found then raise exception 'Fee assignment no longer exists'; end if;

  select coalesce(sum(amount_paid), 0) into v_paid
  from public.student_fee_payments
  where school_id = v_intent.school_id
    and student_fee_assignment_id = v_assignment.id;

  if v_intent.expected_amount > greatest(v_assignment.amount_due - v_paid, 0) then
    raise exception 'Verified payment exceeds the remaining fee balance; manual Finance review required';
  end if;

  v_receipt_number := 'RESA-' || to_char(v_today, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.student_fee_payments
    (school_id, student_fee_assignment_id, student_id, amount_paid, payment_date,
     payment_method, reference_number, remarks, receipt_number, idempotency_key)
  values
    (v_intent.school_id, v_assignment.id, v_assignment.student_id, v_intent.expected_amount,
     v_today, 'online_paystack', 'PAYSTACK:' || v_intent.provider_reference,
     'Paystack verified transaction ' || p_provider_transaction_id,
     v_receipt_number, v_intent.id)
  returning id into v_payment_id;

  insert into public.student_payment_receipts
    (school_id, payment_id, receipt_number, receipt_date, issued_to_student_id,
     amount, payment_method, description, issued_by)
  values
    (v_intent.school_id, v_payment_id, v_receipt_number, v_today, v_assignment.student_id,
     v_intent.expected_amount, 'online_paystack',
     'Online school-fee payment verified by Paystack',
     v_intent.initiated_by)
  returning id into v_receipt_id;

  update public.student_fee_assignments
  set status = case when v_paid + v_intent.expected_amount >= v_assignment.amount_due
    then 'paid' else 'partial' end
  where id = v_assignment.id and school_id = v_intent.school_id;

  update public.student_fee_payment_intents
  set status = 'paid', provider_transaction_id = p_provider_transaction_id,
      verified_amount_minor = p_verified_amount_minor, verified_currency = p_verified_currency,
      verified_at = now(), updated_at = now()
  where id = v_intent.id;

  return jsonb_build_object('success', true, 'already_processed', false,
    'receipt_number', v_receipt_number, 'payment_id', v_payment_id, 'receipt_id', v_receipt_id);
end;
$function$;

revoke all on function public.record_gateway_verified_school_fee_payment(uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.record_gateway_verified_school_fee_payment(uuid, text, bigint, text)
  to service_role;
