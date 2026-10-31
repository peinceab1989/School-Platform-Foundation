create or replace function public.resa_transfer_cbt_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
 u uuid:=auth.uid(); a public.online_exam_attempts%rowtype; e public.online_exams%rowtype;
 tr public.student_term_results%rowtype; sr public.student_subject_results%rowtype;
 existing public.cbt_result_transfers%rowtype; raw numeric; possible numeric; scaled numeric;
 question_count integer; marked_count integer;
begin
 if u is null then raise exception 'Sign in is required.'; end if;
 select * into a from public.online_exam_attempts where id=p_attempt_id for update;
 if not found then raise exception 'CBT attempt not found.'; end if;
 if not public.has_school_role(a.school_id,array['admin']::public.school_role[]) then raise exception 'Only an authorised school administrator can transfer CBT marks.'; end if;
 select * into existing from public.cbt_result_transfers where attempt_id=p_attempt_id;
 if found then return jsonb_build_object('success',true,'already_transferred',true,'exam_score',existing.exam_score,'transfer_id',existing.id); end if;
 if a.status<>'submitted' or a.submitted_at is null then raise exception 'Only submitted CBT attempts can be transferred.'; end if;
 select * into e from public.online_exams where id=a.exam_id and school_id=a.school_id;
 if not found then raise exception 'The linked examination could not be found.'; end if;
 if e.term_id is null then raise exception 'Assign this examination to an academic term before transferring marks.'; end if;
 if not exists(select 1 from public.academic_terms t where t.id=e.term_id and t.school_id=e.school_id and t.academic_session_id=e.academic_session_id) then raise exception 'The examination term does not match its academic session.'; end if;
 select count(*) into question_count from public.online_exam_questions where exam_id=e.id and school_id=e.school_id;
 select count(*) into marked_count from public.online_exam_answers ans join public.online_exam_questions q on q.id=ans.question_id and q.exam_id=e.id
  where ans.attempt_id=a.id and ans.school_id=a.school_id and (q.question_type='multiple_choice' or ans.marks_awarded is not null);
 if question_count=0 then raise exception 'This examination has no questions.'; end if;
 if marked_count<question_count then raise exception 'Some answers are missing or written answers still need marking.'; end if;
 select coalesce(sum(ans.marks_awarded),0),coalesce(sum(q.marks),0) into raw,possible
  from public.online_exam_answers ans join public.online_exam_questions q on q.id=ans.question_id and q.exam_id=e.id
  where ans.attempt_id=a.id and ans.school_id=a.school_id;
 if possible<=0 or abs(possible-e.total_marks)>0.001 then raise exception 'Question marks do not match the examination total.'; end if;
 if raw<0 or raw>possible then raise exception 'Awarded marks are outside the valid range.'; end if;
 scaled:=round(raw/possible*60,2);
 select * into tr from public.student_term_results where school_id=a.school_id and student_id=a.student_id and academic_session_id=e.academic_session_id and term_id=e.term_id and class_id=e.class_id for update;
 if not found then
  insert into public.student_term_results(school_id,student_id,academic_session_id,term_id,class_id,total_score,average_score,workflow_status)
  values(a.school_id,a.student_id,e.academic_session_id,e.term_id,e.class_id,0,0,'draft') returning * into tr;
 elsif tr.workflow_status in ('approved','published') then raise exception 'Term result is approved or published. Reopen it through Results Management before changing marks.'; end if;
 select * into sr from public.student_subject_results where term_result_id=tr.id and subject_id=e.subject_id for update;
 if found and coalesce(sr.exam_score,0)>0 then raise exception 'An exam score already exists. No score was overwritten.'; end if;
 if found then
  update public.student_subject_results set exam_score=scaled,total_score=coalesce(sr.ca_score,0)+scaled,
   grade=case when coalesce(sr.ca_score,0)+scaled>=80 then 'A' when coalesce(sr.ca_score,0)+scaled>=70 then 'B' when coalesce(sr.ca_score,0)+scaled>=60 then 'C' when coalesce(sr.ca_score,0)+scaled>=50 then 'D' when coalesce(sr.ca_score,0)+scaled>=40 then 'E' else 'F' end
   where id=sr.id returning * into sr;
 else
  insert into public.student_subject_results(school_id,term_result_id,student_id,subject_id,ca_score,exam_score,total_score,grade)
  values(a.school_id,tr.id,a.student_id,e.subject_id,0,scaled,scaled,
   case when scaled>=80 then 'A' when scaled>=70 then 'B' when scaled>=60 then 'C' when scaled>=50 then 'D' when scaled>=40 then 'E' else 'F' end)
  returning * into sr;
 end if;
 insert into public.cbt_result_transfers(school_id,attempt_id,term_result_id,subject_result_id,raw_score,raw_total,exam_score,transferred_by)
 values(a.school_id,a.id,tr.id,sr.id,raw,possible,scaled,u);
 update public.student_term_results set total_score=x.total,average_score=x.average from
  (select coalesce(sum(total_score),0) total,coalesce(avg(total_score),0) average from public.student_subject_results where term_result_id=tr.id) x
 where id=tr.id;
 return jsonb_build_object('success',true,'already_transferred',false,'raw_score',raw,'raw_total',possible,'exam_score',scaled,'term_result_id',tr.id,'subject_result_id',sr.id);
end $function$;
revoke all on function public.resa_transfer_cbt_attempt(uuid) from public, anon;
grant execute on function public.resa_transfer_cbt_attempt(uuid) to authenticated;
