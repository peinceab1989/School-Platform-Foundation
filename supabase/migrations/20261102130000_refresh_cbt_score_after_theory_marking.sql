create or replace function public.resa_mark_cbt_answer(p_answer_id uuid, p_marks numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  ans public.online_exam_answers%rowtype;
  q public.online_exam_questions%rowtype;
  a public.online_exam_attempts%rowtype;
  pending_manual integer;
  final_score numeric;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;

  select * into ans
  from public.online_exam_answers
  where id = p_answer_id
  for update;

  if not found then
    raise exception 'Answer not found.';
  end if;

  select * into a
  from public.online_exam_attempts
  where id = ans.attempt_id;

  if not public.has_school_role(ans.school_id, array['admin']::public.school_role[]) then
    raise exception 'Only an authorised school administrator can mark CBT answers.';
  end if;

  if a.status <> 'submitted' then
    raise exception 'Only submitted answers can be marked.';
  end if;

  if exists (
    select 1 from public.cbt_result_transfers
    where attempt_id = a.id
  ) then
    raise exception 'This attempt has already been transferred. Reopen the results workflow before changing it.';
  end if;

  select * into q
  from public.online_exam_questions
  where id = ans.question_id and school_id = ans.school_id;

  if q.question_type = 'multiple_choice' then
    raise exception 'Objective answers are marked automatically.';
  end if;

  if p_marks < 0 or p_marks > q.marks then
    raise exception 'Marks must be between zero and the question maximum.';
  end if;

  update public.online_exam_answers
  set marks_awarded = p_marks
  where id = ans.id;

  select count(*) into pending_manual
  from public.online_exam_answers answer_row
  join public.online_exam_questions question_row
    on question_row.id = answer_row.question_id
   and question_row.exam_id = a.exam_id
  where answer_row.attempt_id = a.id
    and answer_row.school_id = a.school_id
    and question_row.question_type <> 'multiple_choice'
    and answer_row.marks_awarded is null;

  if pending_manual = 0 then
    select coalesce(sum(marks_awarded), 0) into final_score
    from public.online_exam_answers
    where attempt_id = a.id and school_id = a.school_id;

    update public.online_exam_attempts
    set score = final_score
    where id = a.id and school_id = a.school_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'marks_awarded', p_marks,
    'maximum', q.marks,
    'manual_answers_pending', pending_manual,
    'final_score', case when pending_manual = 0 then final_score else null end
  );
end;
$function$;

revoke all on function public.resa_mark_cbt_answer(uuid, numeric) from public, anon;
grant execute on function public.resa_mark_cbt_answer(uuid, numeric) to authenticated;