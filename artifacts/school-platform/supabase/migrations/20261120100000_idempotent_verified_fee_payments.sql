-- Idempotent Finance payment recording and duplicate-reference protection.
-- Existing payments remain untouched; legacy rows keep a NULL idempotency key.

ALTER TABLE public.student_fee_payments
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS student_fee_payments_school_idempotency_uidx
  ON public.student_fee_payments (school_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS student_fee_payments_assignment_reference_uidx
  ON public.student_fee_payments (school_id, student_fee_assignment_id, lower(btrim(reference_number)))
  WHERE reference_number IS NOT NULL AND btrim(reference_number) <> '';

DROP FUNCTION IF EXISTS public.record_verified_school_fee_payment(uuid, uuid, numeric, text, text, text);

CREATE FUNCTION public.record_verified_school_fee_payment(
  p_school_id uuid,
  p_assignment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_idempotency_key uuid,
  p_reference_number text DEFAULT NULL,
  p_remarks text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_assignment public.student_fee_assignments%rowtype;
  v_existing public.student_fee_payments%rowtype;
  v_existing_receipt public.student_payment_receipts%rowtype;
  v_paid numeric(12,2);
  v_amount numeric(12,2);
  v_method text;
  v_reference text;
  v_remarks text;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF NOT public.has_school_role(p_school_id, ARRAY['admin'::public.school_role]) THEN
    RAISE EXCEPTION 'Only an active school administrator may record a verified payment' USING errcode = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A payment request key is required';
  END IF;

  IF p_amount IS NULL OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Enter a finite payment amount';
  END IF;
  v_amount := round(p_amount, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Enter a payment amount greater than zero';
  END IF;

  v_method := lower(trim(coalesce(p_payment_method, '')));
  IF v_method NOT IN ('cash','bank_transfer','pos','other') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;

  v_reference := nullif(left(trim(coalesce(p_reference_number, '')), 100), '');
  v_remarks := nullif(left(trim(coalesce(p_remarks, '')), 1000), '');

  SELECT * INTO v_assignment
  FROM public.student_fee_assignments
  WHERE id = p_assignment_id AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee assignment was not found for this school';
  END IF;

  -- Fast retry path: return the exact receipt from the original committed request.
  SELECT * INTO v_existing
  FROM public.student_fee_payments
  WHERE school_id = p_school_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.student_fee_assignment_id <> v_assignment.id
      OR v_existing.amount_paid <> v_amount
      OR v_existing.payment_method <> v_method
      OR v_existing.reference_number IS DISTINCT FROM v_reference
      OR v_existing.remarks IS DISTINCT FROM v_remarks THEN
      RAISE EXCEPTION 'This payment request key was already used for different payment details';
    END IF;

    SELECT * INTO v_existing_receipt
    FROM public.student_payment_receipts
    WHERE school_id = p_school_id AND payment_id = v_existing.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The original payment exists but its receipt is missing; contact Finance before retrying';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'payment_id', v_existing.id,
      'receipt_id', v_existing_receipt.id,
      'receipt_number', v_existing_receipt.receipt_number,
      'amount', v_existing.amount_paid,
      'payment_date', v_existing.payment_date,
      'payment_method', v_existing.payment_method
    );
  END IF;

  IF v_reference IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.student_fee_payments
    WHERE school_id = p_school_id
      AND student_fee_assignment_id = v_assignment.id
      AND lower(btrim(reference_number)) = lower(v_reference)
  ) THEN
    RAISE EXCEPTION 'This payment reference has already been recorded for this fee assignment';
  END IF;

  SELECT coalesce(sum(amount_paid), 0)
  INTO v_paid
  FROM public.student_fee_payments
  WHERE school_id = p_school_id
    AND student_fee_assignment_id = v_assignment.id;

  IF v_amount > greatest(v_assignment.amount_due - v_paid, 0) THEN
    RAISE EXCEPTION 'Payment exceeds the remaining balance of %', greatest(v_assignment.amount_due - v_paid, 0);
  END IF;

  v_receipt_number := 'RESA-' || to_char(v_today, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.student_fee_payments
    (school_id, student_fee_assignment_id, student_id, amount_paid, payment_date,
     payment_method, reference_number, remarks, receipt_number, idempotency_key)
  VALUES
    (p_school_id, v_assignment.id, v_assignment.student_id, v_amount, v_today,
     v_method, v_reference, v_remarks, v_receipt_number, p_idempotency_key)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    -- A concurrent retry may have won the unique idempotency-key race.
    SELECT * INTO v_existing
    FROM public.student_fee_payments
    WHERE school_id = p_school_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF v_existing.student_fee_assignment_id <> v_assignment.id
        OR v_existing.amount_paid <> v_amount
        OR v_existing.payment_method <> v_method
        OR v_existing.reference_number IS DISTINCT FROM v_reference
        OR v_existing.remarks IS DISTINCT FROM v_remarks THEN
        RAISE EXCEPTION 'This payment request key was already used for different payment details';
      END IF;

      SELECT * INTO v_existing_receipt
      FROM public.student_payment_receipts
      WHERE school_id = p_school_id AND payment_id = v_existing.id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'The original payment exists but its receipt is missing; contact Finance before retrying';
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'payment_id', v_existing.id,
        'receipt_id', v_existing_receipt.id,
        'receipt_number', v_existing_receipt.receipt_number,
        'amount', v_existing.amount_paid,
        'payment_date', v_existing.payment_date,
        'payment_method', v_existing.payment_method
      );
    END IF;

    RAISE EXCEPTION 'This payment reference has already been recorded; refresh the fee register before retrying';
  END IF;

  INSERT INTO public.student_payment_receipts
    (school_id, payment_id, receipt_number, receipt_date, issued_to_student_id,
     amount, payment_method, description, issued_by)
  VALUES
    (p_school_id, v_payment_id, v_receipt_number, v_today, v_assignment.student_id,
     v_amount, v_method, coalesce(v_remarks, 'Verified school-fee payment'), auth.uid())
  RETURNING id INTO v_receipt_id;

  UPDATE public.student_fee_assignments
  SET status = CASE WHEN v_paid + v_amount >= v_assignment.amount_due THEN 'paid' ELSE 'partial' END
  WHERE id = v_assignment.id AND school_id = p_school_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'payment_id', v_payment_id,
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number,
    'amount', v_amount,
    'payment_date', v_today,
    'payment_method', v_method
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_verified_school_fee_payment(uuid, uuid, numeric, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_verified_school_fee_payment(uuid, uuid, numeric, text, uuid, text, text) TO authenticated;

-- Keep payment and receipt writes inside the Finance-only atomic RPC.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.student_fee_payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.student_payment_receipts FROM anon, authenticated;
