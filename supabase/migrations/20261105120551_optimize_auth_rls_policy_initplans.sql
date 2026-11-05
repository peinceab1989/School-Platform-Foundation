-- Cache auth.uid() once per statement in the affected RLS policies.
-- This is a semantics-preserving performance change recommended by Supabase.
do $migration$
declare
  policy_row record;
  using_expression text;
  check_expression text;
  alter_statement text;
begin
  for policy_row in
    select p.polname, p.polrelid, p.polqual, p.polwithcheck
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        (c.relname = 'class_form_teachers' and p.polname = 'Assigned form teachers can read own assignments')
        or (c.relname = 'student_attendance' and p.polname in (
          'Assigned form teachers can read class attendance',
          'Assigned form teachers can record class attendance',
          'Assigned form teachers can update class attendance',
          'Assigned form teachers can delete class attendance'
        ))
        or (c.relname = 'teaching_materials' and p.polname in (
          'teachers manage assigned teaching materials',
          'teaching materials visible to school staff or enrolled published students'
        ))
        or (c.relname = 'resa_chat_messages' and p.polname in (
          'participants and admins read chat messages',
          'participants send messages when chat enabled'
        ))
        or (c.relname = 'resa_chat_conversations' and p.polname in (
          'participants update last message time',
          'participants and admins read chat conversations'
        ))
        or (c.relname = 'staff_attendance' and p.polname = 'staff can read own attendance')
      )
  loop
    using_expression := case
      when policy_row.polqual is null then null
      else replace(pg_get_expr(policy_row.polqual, policy_row.polrelid), 'auth.uid()', '(select auth.uid())')
    end;
    check_expression := case
      when policy_row.polwithcheck is null then null
      else replace(pg_get_expr(policy_row.polwithcheck, policy_row.polrelid), 'auth.uid()', '(select auth.uid())')
    end;
    alter_statement := format('alter policy %I on %s', policy_row.polname, policy_row.polrelid::regclass);
    if using_expression is not null then
      alter_statement := alter_statement || format(' using (%s)', using_expression);
    end if;
    if check_expression is not null then
      alter_statement := alter_statement || format(' with check (%s)', check_expression);
    end if;
    execute alter_statement;
  end loop;
end
$migration$;