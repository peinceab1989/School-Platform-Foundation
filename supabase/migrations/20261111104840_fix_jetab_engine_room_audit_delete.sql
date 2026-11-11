-- Correct the Engine Room audit trigger's DELETE branch.
-- Use jsonb_agg directly; text[] cannot be cast to jsonb with ::jsonb.
create or replace function public.nexus_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_action text;
  v_target_id text;
  v_school_id uuid;
  v_changed_fields jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
    v_action := 'data_insert';
    select coalesce(v_new->>'id', v_new->>'student_id', v_new->>'staff_id', v_new->>'person_id')
      into v_target_id;
    select to_jsonb(coalesce(array_agg(k order by k), array[]::text[]))
      into v_changed_fields from jsonb_object_keys(v_new) as keys(k);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
    v_action := 'data_update';
    select coalesce(v_new->>'id', v_new->>'student_id', v_new->>'staff_id', v_new->>'person_id')
      into v_target_id;
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
      into v_changed_fields
      from jsonb_each(v_new) n
      join jsonb_each(v_old) o using (key)
      where n.value is distinct from o.value;
  else
    v_old := to_jsonb(old);
    v_row := v_old;
    v_action := 'data_delete';
    select coalesce(v_old->>'id', v_old->>'student_id', v_old->>'staff_id', v_old->>'person_id')
      into v_target_id;
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
      into v_changed_fields from jsonb_object_keys(v_old) as keys(k);
  end if;

  if coalesce(v_row->>'school_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_school_id := (v_row->>'school_id')::uuid;
  else
    v_school_id := null;
  end if;

  insert into public.nexus_activity_events (
    actor_user_id, school_id, actor_role, dashboard, route, action,
    target_type, target_id, outcome, metadata
  ) values (
    (select auth.uid()), v_school_id, 'unknown', 'data', null,
    v_action, tg_table_name, v_target_id, 'success',
    jsonb_build_object(
      'operation', tg_op,
      'table', tg_table_name,
      'changed_fields', v_changed_fields,
      'source', 'database_trigger'
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.nexus_audit_row_change() from public, anon, authenticated;
