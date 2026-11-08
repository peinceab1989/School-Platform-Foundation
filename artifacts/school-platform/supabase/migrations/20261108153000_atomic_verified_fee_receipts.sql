-- Atomically record an already-received school payment and issue its receipt.
-- The transaction rolls back in full if either write fails.
create or replace function public.record_verified_school_fee_payment(
  p_school_id uuid,
  p_assignment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text default null,
  p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assignment public.student_fee_assignments%rowtype;
  v_paid numeric(12,2);
  v_amount numeric(12,2);
  v_method text;
  v_reference text;
  v_remarks text;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_school_role(p_school_id, array['admin'::public.school_role]) then
    raise exception 'Only an active school administrator may record a verified payment' using errcode = '42501';
  end if;

  if p_amount is null or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Enter a finite payment amount';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'Enter a payment amount greater than zero';
  end if;

  v_method := lower(trim(coalesce(p_payment_method, '')));
  if v_method not in ('cash','bank_transfer','pos','other') then
    raise exception 'Select a valid payment method';
  end if;

  v_reference := nullif(left(trim(coalesce(p_reference_number, '')), 100), '');
  v_remarks := nullif(left(trim(coalesce(p_remarks, '')), 1000), '');

  select * into v_assignment
  from public.student_fee_assignments
  where id = p_assignment_id and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Fee assignment was not found for this school';
  end if;

  select coalesce(sum(amount_paid), 0)
  into v_paid
  from public.student_fee_payments
  where school_id = p_school_id
    and student_fee_assignment_id = v_assignment.id;

  if v_amount > greatest(v_assignment.amount_due - v_paid, 0) then
    raise exception 'Payment exceeds the remaining balance of %', greatest(v_assignment.amount_due - v_paid, 0);
  end if;

  v_receipt_number := 'RESA-' || to_char(v_today, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.student_fee_payments
    (school_id, student_fee_assignment_id, student_id, amount_paid, payment_date,
     payment_method, reference_number, remarks, receipt_number)
  values
    (p_school_id, v_assignment.id, v_assignment.student_id, v_amount, v_today,
     v_method, v_reference, v_remarks, v_receipt_number)
  returning id into v_payment_id;

  insert into public.student_payment_receipts
    (school_id, payment_id, receipt_number, receipt_date, issued_to_student_id,
     amount, payment_method, description, issued_by)
  values
    (p_school_id, v_payment_id, v_receipt_number, v_today, v_assignment.student_id,
     v_amount, v_method, coalesce(v_remarks, 'Verified school-fee payment'), auth.uid())
  returning id into v_receipt_id;

  update public.student_fee_assignments
  set status = case when v_paid + v_amount >= v_assignment.amount_due then 'paid' else 'partial' end
  where id = v_assignment.id and school_id = p_school_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number,
    'amount', v_amount,
    'payment_date', v_today,
    'payment_method', v_method
  );
end;
$function$;

revoke all on function public.record_verified_school_fee_payment(uuid, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.record_verified_school_fee_payment(uuid, uuid, numeric, text, text, text) to authenticated;

-- Payment and receipt rows are now written only by the authorized transaction above.
-- Keep the existing admin/parent/student read policies, but remove direct table writes
-- that could bypass the atomic receipt and balance update.
drop policy if exists "school admins can manage student fee payments" on public.student_fee_payments;
create policy "school admins can read student fee payments"
  on public.student_fee_payments for select to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "school admins can manage student payment receipts" on public.student_payment_receipts;
create policy "school admins can read student payment receipts"
  on public.student_payment_receipts for select to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]));

revoke insert, update, delete, truncate, references, trigger on public.student_fee_payments from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.student_payment_receipts from anon, authenticated;
