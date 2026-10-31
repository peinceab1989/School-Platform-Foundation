create or replace function public.resa_guard_transferred_exam_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.term_id is not null and not exists (
    select 1 from public.academic_terms t
    where t.id = new.term_id
      and t.school_id = new.school_id
      and t.academic_session_id = new.academic_session_id
  ) then
    raise exception 'The selected academic term must belong to this school and academic session.';
  end if;

  if tg_op = 'UPDATE'
     and exists (
       select 1
       from public.online_exam_attempts a
       join public.cbt_result_transfers x on x.attempt_id = a.id
       where a.exam_id = old.id
     )
     and (
       new.school_id is distinct from old.school_id
       or new.academic_session_id is distinct from old.academic_session_id
       or new.class_id is distinct from old.class_id
       or new.subject_id is distinct from old.subject_id
       or new.term_id is distinct from old.term_id
     ) then
    raise exception 'This examination already has transferred results. Its school, session, class, subject and term can no longer be changed.';
  end if;

  return new;
end
$function$;

drop trigger if exists resa_guard_transferred_exam_link on public.online_exams;
create trigger resa_guard_transferred_exam_link
before insert or update of school_id, academic_session_id, class_id, subject_id, term_id
on public.online_exams
for each row execute function public.resa_guard_transferred_exam_link();

revoke all on function public.resa_guard_transferred_exam_link() from public, anon, authenticated;
