alter table public.online_exams
  add column if not exists term_id uuid references public.academic_terms(id);

create table if not exists public.cbt_result_transfers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attempt_id uuid not null references public.online_exam_attempts(id) on delete cascade,
  term_result_id uuid not null references public.student_term_results(id) on delete cascade,
  subject_result_id uuid not null references public.student_subject_results(id) on delete cascade,
  raw_score numeric not null,
  raw_total numeric not null,
  exam_score numeric not null,
  transferred_by uuid not null references auth.users(id),
  transferred_at timestamptz not null default now(),
  constraint cbt_result_transfers_attempt_unique unique (attempt_id)
);

alter table public.cbt_result_transfers enable row level security;

drop policy if exists "Admins can view CBT result transfers" on public.cbt_result_transfers;
create policy "Admins can view CBT result transfers"
on public.cbt_result_transfers for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create or replace function public.resa_transfer_cbt_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.online_exam_attempts%rowtype;
  v_exam public.online_exams%rowtype;
  v_term_result public.student_term_results%rowtype;
  v_subject_result public.student_subject_results%rowtype;
  v_total numeric;
  v_awarded numeric;
  v_exam_score numeric;
  v_questions integer;
  v_answered integer;
  v_existing public.cbt_result_transfers%rowtype;
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;

  select * into v_attempt from public.online_exam_attempts
  where id = p_attempt_id for update;
  if not found then raise exception 'CBT attempt not found.'; end if;

  if not public.has_school_role(v_attempt.school_id, array['admin']::public.school_role[]) then
    raise exception 'Only an authorised school administrator can transfer CBT marks.';
  end if;

  select * into v_existing from public.cbt_result_transfers where attempt_id = p_attempt_id;
  if found then
    return jsonb_build_object('success', true, 'already_transferred', true,
      'exam_score', v_existing.exam_score, 'transfer_id', v_existing.id);
  end if;

  if v_attempt.status <> 'submitted' or v_attempt.submitted_at is null then
    raise exception 'Only submitted CBT attempts can be transferred.';
  end if;

  select * into v_exam from public.online_exams
  where id = v_attempt.exam_id and school_id = v_attempt.school_id;
  if not found then raise exception 'The linked examination could not be found.'; end if;
  if v_exam.term_id is null then raise exception 'Assign this examination to an academic term before transferring marks.'; end if;
  if not exists (select 1 from public.academic_terms t where t.id=v_exam.term_id and t.school_id=v_exam.school_id and t.academic_session_id=v_exam.academic_session_id) then
    raise exception 'The examination term does not match its academic session.';
  end if;

  select count(*) into v_questions from public.online_exam_questions
  where exam_id=v_exam.id and school_id=v_exam.school_id;
  select count(*) into v_answered from public.online_exam_answers a
  join public.online_exam_questions q on q.id=a.question_id and q.exam_id=v_exam.id
  where a.attempt_id=v_attempt.id and a.school_id=v_attempt.school_id
    and (q.question_type='multiple_choice' or a.marks_awarded is not null);
  if v_questions = 0 then raise exception 'This examination has no questions.'; end if;
  if v_answered < v_questions then raise exception 'Some answers are missing or written answers still need marking.'; end if;

  select coalesce(sum(a.marks_awarded),0), coalesce(sum(q.marks),0)
  into v_awarded, v_total
  from public.online_exam_answers a
  join public.online_exam_questions q on q.id=a.question_id and q.exam_id=v_exam.id
  where a.attempt_id=v_attempt.id and a.school_id=v_attempt.school_id;
  if v_total <= 0 or abs(v_total-v_exam.total_marks) > 0.001 then
    raise exception 'Question marks do not match the examination total. Correct the examination before transferring.';
  end if;
  if v_awarded < 0 or v_awarded > v_total then raise exception 'The awarded marks are outside the valid range.'; end if;
  v_exam_score := round((v_awarded / v_total) * 60, 2);

  select * into v_term_result from public.student_term_results
  where school_id=v_attempt.school_id and student_id=v_attempt.student_id
    and academic_session_id=v_exam.academic_session_id and term_id=v_exam.term_id
    and class_id=v_exam.class_id for update;

  if not found then
    insert into public.student_term_results
      (school_id,student_id,academic_session_id,term_id,class_id,total_score,average_score,workflow_status)
    values (v_attempt.school_id,v_attempt.student_id,v_exam.academic_session_id,v_exam.term_id,v_exam.class_id,0,0,'draft')
    returning * into v_term_result;
  elsif v_term_result.workflow_status in ('approved','published') then
    raise exception 'This term result is already approved or published. Reopen it through the results workflow before changing marks.';
  end if;

  select * into v_subject_result from public.student_subject_results
  where term_result_id=v_term_result.id and subject_id=v_exam.subject_id for update;

  if found and coalesce(v_subject_result.exam_score,0) > 0 then
    raise exception 'An exam score already exists for this subject. Review it in Results Management; the CBT transfer will not overwrite it.';
  end if;

  if found then
    update public.student_subject_results
    set exam_score=v_exam_score,total_score=coalesce(v_subject_result.ca_score,0)+v_exam_score,
        grade=case
          when coalesce(v_subject_result.ca_score,0)+v_exam_score >= 70 then 'A'
          when coalesce(v_subject_result.ca_score,0)+v_exam_score >= 60 then 'B'
          when coalesce(v_subject_result.ca_score,0)+v_exam_score >= 50 then 'C'
          when coalesce(v_subject_result.ca_score,0)+v_exam_score >= 45 then 'D'
          when coalesce(v_subject_result.ca_score,0)+v_exam_score >= 40 then 'E'
          else 'F' end
    where id=v_subject_result.id returning * into v_subject_result;
  else
    insert into public.student_subject_results
      (school_id,term_result_id,student_id,subject_id,ca_score,exam_score,total_score,grade)
    values (v_attempt.school_id,v_term_result.id,v_attempt.student_id,v_exam.subject_id,0,v_exam_score,v_exam_score,
      case when v_exam_score>=70 then 'A' when v_exam_score>=60 then 'B' when v_exam_score>=50 then 'C' when v_exam_score>=45 then 'D' when v_exam_score>=40 then 'E' else 'F' end)
    returning * into v_subject_result;
  end if;

  insert into public.cbt_result_transfers
    (school_id,attempt_id,term_result_id,subject_result_id,raw_score,raw_total,exam_score,transferred_by)
  values (v_attempt.school_id,v_attempt.id,v_term_result.id,v_subject_result.id,v_awarded,v_total,v_exam_score,v_user);

  update public.student_term_results tr
  set total_score=x.total, average_score=x.average
  from (select coalesce(sum(total_score),0) total, coalesce(avg(total_score),0) average
        from public.student_subject_results where term_result_id=v_term_result.id) x
  where tr.id=v_term_result.id;

  return jsonb_build_object('success',true,'already_transferred',false,
    'raw_score',v_awarded,'raw_total',v_total,'exam_score',v_exam_score,
    'term_result_id',v_term_result.id,'subject_result_id',v_subject_result.id);
end;
$$;

revoke all on function public.resa_transfer_cbt_attempt(uuid) from public, anon;
grant execute on function public.resa_transfer_cbt_attempt(uuid) to authenticated;
