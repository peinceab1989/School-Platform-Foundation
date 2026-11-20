-- Paystack checkout intent ledger and atomic verified settlement.
-- No existing fee/payment rows are modified by this migration.
create table if not exists public.paystack_payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_fee_assignment_id uuid not null references public.student_fee_assignments(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  initiated_by uuid not null,
  reference text not null unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  gateway_mode text not null check (gateway_mode in ('test','live')),
  status text not null default 'pending' check (status in ('pending','paid','failed','review_required')),
  provider_transaction_id text,
  authorization_url text,
  access_code text,
  payment_id uuid references public.student_fee_payments(id) on delete restrict,
  receipt_id uuid references public.student_payment_receipts(id) on delete restrict,
  receipt_number text,
  paid_at timestamptz,
  last_verified_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paystack_payment_intents_school_status_created_idx
  on public.paystack_payment_intents (school_id, status, created_at desc);
create index if not exists paystack_payment_intents_assignment_idx
  on public.paystack_payment_intents (student_fee_assignment_id, created_at desc);

alter table public.paystack_payment_intents enable row level security;
revoke all on table public.paystack_payment_intents from public, anon, authenticated;
grant all on table public.paystack_payment_intents to service_role;

create or replace function public.record_verified_paystack_fee_payment(
  p_reference text,
  p_provider_transaction_id text,
  p_amount_kobo bigint,
  p_currency text,
  p_provider_domain text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_intent public.paystack_payment_intents%rowtype;
  v_assignment public.student_fee_assignments%rowtype;
  v_paid numeric(12,2);
  v_amount numeric(12,2);
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_receipt_number text;
  v_payment_id uuid;
  v_receipt_id uuid;
begin
  if nullif(trim(coalesce(p_reference,'')), '') is null
    or nullif(trim(coalesce(p_provider_transaction_id,'')), '') is null then
    raise exception 'A verified Paystack reference and transaction ID are required';
  end if;

  select * into v_intent
  from public.paystack_payment_intents
  where reference = p_reference
  for update;

  if not found then
    raise exception 'Paystack payment intent was not found';
  end if;

  if v_intent.status = 'paid' then
    return jsonb_build_object(
      'success', true, 'idempotent_replay', true,
      'payment_id', v_intent.payment_id, 'receipt_id', v_intent.receipt_id,
      'receipt_number', v_intent.receipt_number, 'amount', v_intent.amount_kobo::numeric / 100
    );
  end if;

  if v_intent.status not in ('pending','review_required') then
    raise exception 'This Paystack payment intent is not payable';
  end if;

  if p_currency <> 'NGN'
    or p_amount_kobo <> v_intent.amount_kobo
    or p_provider_domain <> v_intent.gateway_mode then
    raise exception 'Verified Paystack transaction does not match the stored payment intent';
  end if;

  select * into v_assignment
  from public.student_fee_assignments
  where id = v_intent.student_fee_assignment_id
    and school_id = v_intent.school_id
    and student_id = v_intent.student_id
  for update;

  if not found then
    raise exception 'The original school-fee assignment no longer exists';
  end if;

  v_amount := v_intent.amount_kobo::numeric / 100;

  select coalesce(sum(amount_paid),0) into v_paid
  from public.student_fee_payments
  where school_id = v_intent.school_id
    and student_fee_assignment_id = v_assignment.id;

  if v_amount > greatest(v_assignment.amount_due - v_paid, 0) then
    update public.paystack_payment_intents
    set status = 'review_required',
        provider_transaction_id = p_provider_transaction_id,
        last_verified_at = now(),
        failure_reason = 'Payment verified by Paystack but the fee balance changed before settlement; Finance reconciliation required.',
        updated_at = now()
    where id = v_intent.id;

    return jsonb_build_object('success', false, 'review_required', true);
  end if;

  v_receipt_number := 'RESA-' || to_char(v_today, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.student_fee_payments
    (school_id, student_fee_assignment_id, student_id, amount_paid, payment_date,
     payment_method, reference_number, remarks, receipt_number, idempotency_key)
  values
    (v_intent.school_id, v_assignment.id, v_assignment.student_id, v_amount, v_today,
     'paystack', v_intent.reference, 'Verified Paystack transaction ' || p_provider_transaction_id,
     v_receipt_number, v_intent.id)
  returning id into v_payment_id;

  insert into public.student_payment_receipts
    (school_id, payment_id, receipt_number, receipt_date, issued_to_student_id,
     amount, payment_method, description, issued_by)
  values
    (v_intent.school_id, v_payment_id, v_receipt_number, v_today, v_assignment.student_id,
     v_amount, 'paystack', 'Verified online school-fee payment', v_intent.initiated_by)
  returning id into v_receipt_id;

  update public.student_fee_assignments
  set status = case when v_paid + v_amount >= v_assignment.amount_due then 'paid' else 'partial' end
  where id = v_assignment.id and school_id = v_intent.school_id;

  update public.paystack_payment_intents
  set status = 'paid',
      provider_transaction_id = p_provider_transaction_id,
      payment_id = v_payment_id,
      receipt_id = v_receipt_id,
      receipt_number = v_receipt_number,
      paid_at = now(),
      last_verified_at = now(),
      failure_reason = null,
      updated_at = now()
  where id = v_intent.id;

  return jsonb_build_object(
    'success', true, 'idempotent_replay', false,
    'payment_id', v_payment_id, 'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number, 'amount', v_amount
  );
end;
$function$;

revoke all on function public.record_verified_paystack_fee_payment(text,text,bigint,text,text) from public, anon, authenticated;
grant execute on function public.record_verified_paystack_fee_payment(text,text,bigint,text,text) to service_role;
