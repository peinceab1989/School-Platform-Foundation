-- Only one unexpired online checkout may be open per fee assignment.
-- Expired attempts remain eligible for late provider-success reconciliation.
create unique index if not exists student_fee_payment_intents_one_active_per_assignment_uidx
  on public.student_fee_payment_intents (school_id, student_fee_assignment_id)
  where status in ('pending','processing');
