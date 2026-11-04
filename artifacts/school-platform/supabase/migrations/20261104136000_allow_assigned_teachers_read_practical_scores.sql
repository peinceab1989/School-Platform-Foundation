-- Let active teachers assigned to the class and subject read practical
-- assessment definitions and marks for the Results Management import action.
drop policy if exists "assigned teachers can read practical assessments" on public.assessments;
create policy "assigned teachers can read practical assessments"
on public.assessments
for select
to authenticated
using (
  public.has_school_role(school_id, array['teacher']::public.school_role[])
  and exists (
    select 1
    from public.teacher_assignments ta
    join public.staff st
      on st.id = ta.staff_id
     and st.school_id = ta.school_id
    where ta.school_id = assessments.school_id
      and ta.academic_session_id = assessments.academic_session_id
      and ta.class_id = assessments.class_id
      and ta.subject_id = assessments.subject_id
      and st.user_id = (select auth.uid())
      and st.status = 'active'
  )
);

drop policy if exists "assigned teachers can read practical assessment scores" on public.assessment_scores;
create policy "assigned teachers can read practical assessment scores"
on public.assessment_scores
for select
to authenticated
using (
  public.has_school_role(school_id, array['teacher']::public.school_role[])
  and exists (
    select 1
    from public.assessments a
    join public.teacher_assignments ta
      on ta.school_id = a.school_id
     and ta.academic_session_id = a.academic_session_id
     and ta.class_id = a.class_id
     and ta.subject_id = a.subject_id
    join public.staff st
      on st.id = ta.staff_id
     and st.school_id = ta.school_id
    where a.id = assessment_scores.assessment_id
      and a.school_id = assessment_scores.school_id
      and st.user_id = (select auth.uid())
      and st.status = 'active'
  )
);
