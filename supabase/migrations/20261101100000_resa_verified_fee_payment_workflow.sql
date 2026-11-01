-- RESA fees workflow: term-aware assignments, verified transfer submissions,
-- controlled parent visibility, and receipt issuance only after admin approval.

begin;

alter table public.student_fee_assignments
  add column if not exists academic_term_id uuid
  references public.academic_terms(id) on delete restrict;

create index if not exists student_fee_assignments_term_idx
  on public.student_fee_assignments (school_id, academic_term_id, student_id);

create table if not exists public.school_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  bank_name text not null check (length(trim(bank_name)) between 2 and 100),
  account_name text not null check (length(trim(account_name)) between 2 and 160),
  account_number text not null check (account_number ~ '^[0-9]{8,20}$'),
  payment_instructions text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_bank_accounts_active_idx
  on public.school_bank_accounts (school_id, is_active);

alter table public.school_bank_accounts enable row level security;
grant select, insert, update, delete on public.school_bank_accounts to authenticated;

drop policy if exists "school admins manage bank accounts" on public.school_bank_accounts;
create policy "school admins manage bank accounts"
  on public.school_bank_accounts for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "school members read active bank accounts" on public.school_bank_accounts;
create policy "school members read active bank accounts"
  on public.school_bank_accounts for select to authenticated
  using (is_active = true and public.has_school_role(school_id));

create table if not exists public.student_fee_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_fee_assignment_id uuid not null references public.student_fee_assignments(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  parent_guardian_id uuid not null references public.parents_guardians(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'bank_transfer' check (payment_method = 'bank_transfer'),
  reference_number text not null check (length(trim(reference_number)) between 4 and 100),
  evidence_storage_path text,
  parent_note text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  admin_note text,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  student_fee_payment_id uuid references public.student_fee_payments(id) on delete set null,
  receipt_id uuid references public.student_payment_receipts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_fee_payment_submission_school_ref_unique unique (school_id, reference_number)
);

create index if not exists fee_payment_submissions_review_idx
  on public.student_fee_payment_submissions (school_id, status, created_at desc);
create index if not exists fee_payment_submissions_parent_idx
  on public.student_fee_payment_submissions (parent_guardian_id, student_id, created_at desc);

alter table public.student_fee_payment_submissions enable row level security;
grant select, insert on public.student_fee_payment_submissions to authenticated;

drop policy if exists "school admins manage fee payment submissions" on public.student_fee_payment_submissions;
create policy "school admins manage fee payment submissions"
  on public.student_fee_payment_submissions for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "parents submit and read own fee payment submissions" on public.student_fee_payment_submissions;
create policy "parents submit and read own fee payment submissions"
  on public.student_fee_payment_submissions for select to authenticated
  using (
    public.parent_can_access_guardian(parent_guardian_id)
    and public.parent_can_access_student(student_id)
    and exists (
      select 1
      from public.parent_student_portal_access link
      join public.parent_fee_portal_views view_row
        on view_row.parent_guardian_id = link.parent_guardian_id
       and view_row.student_id = link.student_id
       and view_row.school_id = link.school_id
      where link.parent_guardian_id = student_fee_payment_submissions.parent_guardian_id
        and link.student_id = student_fee_payment_submissions.student_id
        and link.school_id = student_fee_payment_submissions.school_id
        and link.is_active = true
        and view_row.student_fee_assignment_id = student_fee_payment_submissions.student_fee_assignment_id
        and view_row.can_view = true
    )
  );

drop policy if exists "parents submit own fee payment evidence" on public.student_fee_payment_submissions;
create policy "parents submit own fee payment evidence"
  on public.student_fee_payment_submissions for insert to authenticated
  with check (
    status = 'pending'
    and submitted_by = (select auth.uid())
    and reviewed_by is null
    and reviewed_at is null
    and student_fee_payment_id is null
    and receipt_id is null
    and public.parent_can_access_guardian(parent_guardian_id)
    and public.parent_can_access_student(student_id)
    and exists (
      select 1
      from public.student_fee_assignments assignment
      join public.parent_student_portal_access link
        on link.student_id = assignment.student_id
       and link.school_id = assignment.school_id
      join public.parent_fee_portal_views view_row
        on view_row.parent_guardian_id = link.parent_guardian_id
       and view_row.student_id = link.student_id
       and view_row.school_id = link.school_id
       and view_row.student_fee_assignment_id = assignment.id
      where assignment.id = student_fee_payment_submissions.student_fee_assignment_id
        and assignment.school_id = student_fee_payment_submissions.school_id
        and assignment.student_id = student_fee_payment_submissions.student_id
        and link.parent_guardian_id = student_fee_payment_submissions.parent_guardian_id
        and link.is_active = true
        and view_row.can_view = true
    )
  );

-- Create parent visibility rows for fee assignments already linked to families.
insert into public.parent_fee_portal_views
  (school_id, parent_guardian_id, student_id, student_fee_assignment_id, can_view)
select distinct link.school_id, link.parent_guardian_id, assignment.student_id, assignment.id, true
from public.student_fee_assignments assignment
join public.parent_student_portal_access link
  on link.school_id = assignment.school_id
 and link.student_id = assignment.student_id
 and link.is_active = true
where not exists (
  select 1 from public.parent_fee_portal_views existing
  where existing.school_id = assignment.school_id
    and existing.parent_guardian_id = link.parent_guardian_id
    and existing.student_id = assignment.student_id
    and existing.student_fee_assignment_id = assignment.id
);

create or replace function public.sync_parent_fee_portal_views_for_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.parent_fee_portal_views
    (school_id, parent_guardian_id, student_id, student_fee_assignment_id, can_view)
  select new.school_id, link.parent_guardian_id, new.student_id, new.id, true
  from public.parent_student_portal_access link
  where link.school_id = new.school_id
    and link.student_id = new.student_id
    and link.is_active = true
    and not exists (
      select 1 from public.parent_fee_portal_views existing
      where existing.school_id = new.school_id
        and existing.parent_guardian_id = link.parent_guardian_id
        and existing.student_id = new.student_id
        and existing.student_fee_assignment_id = new.id
    );
  return new;
end;
$function$;

drop trigger if exists sync_parent_fee_views_after_assignment on public.student_fee_assignments;
create trigger sync_parent_fee_views_after_assignment
after insert on public.student_fee_assignments
for each row execute function public.sync_parent_fee_portal_views_for_assignment();

create or replace function public.sync_parent_fee_portal_views_for_family_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.is_active then
    insert into public.parent_fee_portal_views
      (school_id, parent_guardian_id, student_id, student_fee_assignment_id, can_view)
    select new.school_id, new.parent_guardian_id, new.student_id, assignment.id, true
    from public.student_fee_assignments assignment
    where assignment.school_id = new.school_id
      and assignment.student_id = new.student_id
      and not exists (
        select 1 from public.parent_fee_portal_views existing
        where existing.school_id = new.school_id
          and existing.parent_guardian_id = new.parent_guardian_id
          and existing.student_id = new.student_id
          and existing.student_fee_assignment_id = assignment.id
      );
  end if;
  return new;
end;
$function$;

drop trigger if exists sync_parent_fee_views_after_family_link on public.parent_student_portal_access;
create trigger sync_parent_fee_views_after_family_link
after insert or update of is_active on public.parent_student_portal_access
for each row execute function public.sync_parent_fee_portal_views_for_family_link();

-- Only an active school administrator may approve/reject a submitted transfer.
-- Approval atomically records the payment and issues its receipt.
create or replace function public.review_student_fee_payment_submission(
  p_submission_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_submission public.student_fee_payment_submissions%rowtype;
  v_assignment public.student_fee_assignments%rowtype;
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_payment_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_submission
  from public.student_fee_payment_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Payment submission not found' using errcode = 'P0002';
  end if;

  if not public.has_school_role(v_submission.school_id, array['admin'::public.school_role]) then
    raise exception 'Only an active school administrator may review payment submissions' using errcode = '42501';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'This payment submission has already been reviewed';
  end if;

  if p_decision is null or p_decision not in ('verify','reject') then
    raise exception 'Decision must be verify or reject';
  end if;

  v_note := nullif(left(trim(coalesce(p_admin_note, '')), 1000), '');

  if p_decision = 'reject' then
    update public.student_fee_payment_submissions
    set status = 'rejected',
        admin_note = v_note,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = v_submission.id;

    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;

  select * into v_assignment
  from public.student_fee_assignments
  where id = v_submission.student_fee_assignment_id
    and school_id = v_submission.school_id
    and student_id = v_submission.student_id
  for update;

  if not found then
    raise exception 'The fee assignment no longer matches this submission';
  end if;

  select coalesce(sum(amount_paid), 0)
  into v_paid
  from public.student_fee_payments
  where school_id = v_submission.school_id
    and student_fee_assignment_id = v_assignment.id;

  v_remaining := greatest(v_assignment.amount_due - v_paid, 0);
  if v_submission.amount > v_remaining then
    raise exception 'Submitted amount exceeds the remaining fee balance. Review the amount before verification.';
  end if;

  v_receipt_number := 'RESA-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.student_fee_payments
    (school_id, student_fee_assignment_id, student_id, amount_paid, payment_date, payment_method, reference_number, remarks, receipt_number)
  values
    (v_submission.school_id, v_assignment.id, v_submission.student_id, v_submission.amount,
     v_submission.payment_date, 'bank_transfer', v_submission.reference_number, v_note, v_receipt_number)
  returning id into v_payment_id;

  insert into public.student_payment_receipts
    (school_id, payment_id, receipt_number, receipt_date, issued_to_student_id, amount, payment_method, description, issued_by)
  values
    (v_submission.school_id, v_payment_id, v_receipt_number, current_date, v_submission.student_id,
     v_submission.amount, 'bank_transfer', 'Verified school-fee payment', auth.uid())
  returning id into v_receipt_id;

  v_paid := v_paid + v_submission.amount;
  update public.student_fee_assignments
  set status = case when v_paid >= amount_due then 'paid' else 'partial' end
  where id = v_assignment.id;

  update public.student_fee_payment_submissions
  set status = 'verified',
      admin_note = v_note,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      student_fee_payment_id = v_payment_id,
      receipt_id = v_receipt_id,
      updated_at = now()
  where id = v_submission.id;

  return jsonb_build_object(
    'success', true,
    'status', 'verified',
    'payment_id', v_payment_id,
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number
  );
end;
$function$;

revoke all on function public.review_student_fee_payment_submission(uuid, text, text) from public, anon;
grant execute on function public.review_student_fee_payment_submission(uuid, text, text) to authenticated;

-- Replace the broad receipt read policy with linked-family and linked-student access.
drop policy if exists "school members can read student payment receipts"
  on public.student_payment_receipts;
drop policy if exists "families can read own student payment receipts"
  on public.student_payment_receipts;

create policy "families can read own student payment receipts"
  on public.student_payment_receipts for select to authenticated
  using (
    exists (
      select 1
      from public.parent_fee_portal_views view_row
      join public.parent_student_portal_access link
        on link.parent_guardian_id = view_row.parent_guardian_id
       and link.student_id = view_row.student_id
       and link.school_id = view_row.school_id
      where view_row.school_id = student_payment_receipts.school_id
        and view_row.student_id = student_payment_receipts.issued_to_student_id
        and view_row.can_view = true
        and link.is_active = true
        and public.parent_can_access_guardian(view_row.parent_guardian_id)
        and public.parent_can_access_student(view_row.student_id)
    )
    or exists (
      select 1
      from public.students student
      where student.id = student_payment_receipts.issued_to_student_id
        and student.school_id = student_payment_receipts.school_id
        and student.user_id = (select auth.uid())
        and public.has_school_role(student.school_id, array['student'::public.school_role])
    )
  );

commit;
