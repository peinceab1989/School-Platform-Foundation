-- Extend RESA background phone notifications to the main academic and finance workflows.
-- Additive trigger/function changes only; no existing school records are modified.

create or replace function public.resa_queue_push_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
  v_payload jsonb;
  v_row jsonb;
  v_event_type text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'resa_push_webhook_token'
  limit 1;
  if v_token is null then return null; end if;

  if tg_table_name = 'school_messages' then
    v_event_type := 'school_message';
  elsif tg_table_name = 'resa_chat_messages' then
    v_event_type := 'chat_message';
  elsif tg_table_name = 'biometric_parent_notifications' then
    v_event_type := 'attendance';
  elsif tg_table_name = 'announcements' then
    if coalesce((v_row->>'is_published')::boolean, false) is not true then return null; end if;
    v_event_type := 'announcement';
  elsif tg_table_name = 'student_term_results' then
    if coalesce(v_row->>'workflow_status','') <> 'published' then return null; end if;
    if tg_op = 'UPDATE'
      and old.workflow_status = new.workflow_status
      and old.published_at is not distinct from new.published_at then return null; end if;
    v_event_type := 'result_published';
  elsif tg_table_name = 'assignments' then
    if coalesce(v_row->>'status','') <> 'published' then return null; end if;
    if tg_op = 'UPDATE' then
      if old.status is not distinct from new.status then return null; end if;
    end if;
    v_event_type := 'assignment_published';
  elsif tg_table_name = 'assignment_submissions' then
    if coalesce(v_row->>'status','') <> 'graded' then return null; end if;
    if tg_op = 'UPDATE'
      and old.status is not distinct from new.status
      and old.score is not distinct from new.score then return null; end if;
    v_event_type := 'assignment_graded';
  elsif tg_table_name = 'online_exams' then
    if coalesce(v_row->>'status','') <> 'published' then return null; end if;
    if tg_op = 'UPDATE' then
      if old.status is not distinct from new.status then return null; end if;
    end if;
    v_event_type := 'exam_published';
  elsif tg_table_name = 'student_fee_assignments' then
    if tg_op = 'UPDATE' then
      if old.status is not distinct from new.status then return null; end if;
    end if;
    v_event_type := 'fee_update';
  elsif tg_table_name = 'student_fee_payments' then
    v_event_type := 'fee_payment';
  elsif tg_table_name = 'class_timetables' then
    if tg_op = 'UPDATE' then
      if old.class_id is not distinct from new.class_id
        and old.subject_id is not distinct from new.subject_id
        and old.staff_id is not distinct from new.staff_id
        and old.day_of_week is not distinct from new.day_of_week
        and old.start_time is not distinct from new.start_time
        and old.end_time is not distinct from new.end_time
        and old.room is not distinct from new.room then return null; end if;
    end if;
    v_event_type := 'timetable_update';
  elsif tg_table_name = 'admission_applications' then
    if tg_op = 'UPDATE' then
      if old.status is not distinct from new.status then return null; end if;
    end if;
    v_event_type := 'admission_admin';
  else
    return null;
  end if;

  v_payload := jsonb_build_object('event_type', v_event_type, 'record', v_row);
  perform net.http_post(
    url := 'https://mhwwzzxwpsqwhxrsuwaa.supabase.co/functions/v1/resa-push-dispatch',
    headers := jsonb_build_object('Content-Type','application/json','x-resa-push-token',v_token),
    body := v_payload,
    timeout_milliseconds := 5000
  );
  return null;
end;
$function$;

revoke all on function public.resa_queue_push_event() from public, anon, authenticated;

drop trigger if exists resa_push_result_published on public.student_term_results;
create trigger resa_push_result_published
  after update of workflow_status, published_at on public.student_term_results
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_assignment_published on public.assignments;
create trigger resa_push_assignment_published
  after insert or update of status on public.assignments
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_assignment_graded on public.assignment_submissions;
create trigger resa_push_assignment_graded
  after update of status, score on public.assignment_submissions
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_exam_published on public.online_exams;
create trigger resa_push_exam_published
  after insert or update of status on public.online_exams
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_fee_assignment on public.student_fee_assignments;
create trigger resa_push_fee_assignment
  after insert or update of status on public.student_fee_assignments
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_fee_payment on public.student_fee_payments;
create trigger resa_push_fee_payment
  after insert on public.student_fee_payments
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_timetable_change on public.class_timetables;
create trigger resa_push_timetable_change
  after insert or update or delete on public.class_timetables
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_admission_admin on public.admission_applications;
create trigger resa_push_admission_admin
  after insert or update of status on public.admission_applications
  for each row execute function public.resa_queue_push_event();
