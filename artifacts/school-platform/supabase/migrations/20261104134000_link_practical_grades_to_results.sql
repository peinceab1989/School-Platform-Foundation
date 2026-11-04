-- Link a practical assignment's first graded submission to the existing
-- academic assessment/results pipeline. Re-grading updates the same score row.
alter table public.assignments
  add column if not exists practical_assessment_id uuid
  references public.assessments(id) on delete set null;

create or replace function public.resa_grade_assignment_submission(
  p_submission_id uuid,
  p_score numeric,
  p_feedback text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_submission public.assignment_submissions%rowtype;
  v_assignment public.assignments%rowtype;
  v_assessment_id uuid;
  v_feedback text;
begin
  if v_uid is null then raise exception 'Sign in is required.'; end if;

  select * into v_submission
  from public.assignment_submissions
  where id = p_submission_id
  for update;
  if not found then raise exception 'Assignment submission not found.'; end if;

  select * into v_assignment
  from public.assignments
  where id = v_submission.assignment_id
    and school_id = v_submission.school_id
  for update;
  if not found then raise exception 'The linked assignment could not be found.'; end if;

  if not public.has_school_role(v_assignment.school_id, array['teacher']::public.school_role[]) then
    raise exception 'An active teacher membership is required.';
  end if;

  if not exists (
    select 1 from public.staff s
    where s.school_id = v_assignment.school_id
      and s.user_id = v_uid
      and s.status = 'active'
      and (
        s.id = v_assignment.staff_id
        or exists (
          select 1 from public.teacher_assignments ta
          where ta.school_id = v_assignment.school_id
            and ta.staff_id = s.id
            and ta.academic_session_id = v_assignment.academic_session_id
            and ta.class_id = v_assignment.class_id
            and ta.subject_id = v_assignment.subject_id
        )
        or exists (
          select 1 from public.class_timetables ct
          where ct.school_id = v_assignment.school_id
            and ct.staff_id = s.id
            and ct.class_id = v_assignment.class_id
            and ct.subject_id = v_assignment.subject_id
        )
      )
  ) then raise exception 'You are not assigned to teach this class and subject.'; end if;

  if v_submission.status not in ('submitted', 'graded') then
    raise exception 'Only submitted assignment work can be graded.';
  end if;
  if p_score is null or p_score < 0 or p_score > v_assignment.max_score then
    raise exception 'The score must be between zero and the assignment maximum.';
  end if;
  if length(coalesce(p_feedback, '')) > 5000 then
    raise exception 'Teacher feedback cannot exceed 5,000 characters.';
  end if;

  v_feedback := nullif(btrim(coalesce(p_feedback, '')), '');

  update public.assignment_submissions
  set score = p_score, feedback = v_feedback, status = 'graded',
      graded_by = v_uid, graded_at = now()
  where id = v_submission.id and school_id = v_submission.school_id;

  if v_assignment.assignment_type = 'practical' then
    v_assessment_id := v_assignment.practical_assessment_id;
    if v_assessment_id is null then
      insert into public.assessments (
        school_id, academic_session_id, class_id, subject_id,
        title, assessment_type, max_score, assessment_date
      ) values (
        v_assignment.school_id, v_assignment.academic_session_id,
        v_assignment.class_id, v_assignment.subject_id,
        v_assignment.title, 'practical', v_assignment.max_score,
        coalesce(v_assignment.due_date::date, current_date)
      ) returning id into v_assessment_id;

      update public.assignments
      set practical_assessment_id = v_assessment_id
      where id = v_assignment.id and school_id = v_assignment.school_id;
    end if;

    insert into public.assessment_scores (
      school_id, assessment_id, student_id, score, remarks
    ) values (
      v_assignment.school_id, v_assessment_id,
      v_submission.student_id, p_score, v_feedback
    )
    on conflict (assessment_id, student_id)
    do update set score = excluded.score, remarks = excluded.remarks;
  end if;

  return true;
end;
$function$;

revoke all on function public.resa_grade_assignment_submission(uuid, numeric, text) from public;
revoke all on function public.resa_grade_assignment_submission(uuid, numeric, text) from anon;
grant execute on function public.resa_grade_assignment_submission(uuid, numeric, text) to authenticated;

comment on column public.assignments.practical_assessment_id is
'Assessment record linked to the practical task; populated when the first student submission is graded.';
