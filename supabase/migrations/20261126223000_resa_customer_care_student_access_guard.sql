-- Private helper for student private-message entitlement. The legacy public
-- helper is intentionally not executable by clients, so this check stays in
-- the private schema and verifies the caller is checking their own account.
create or replace function private.resa_student_messaging_allowed(
  p_school_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_user_id = (select auth.uid())
    and (
      not exists (
        select 1
        from public.school_memberships m
        where m.school_id = p_school_id
          and m.user_id = p_user_id
          and m.status = 'active'::public.membership_status
          and m.role = 'student'::public.school_role
      )
      or exists (
        select 1
        from public.school_messaging_access a
        where a.school_id = p_school_id
          and (
            a.allow_all_students = true
            or p_user_id = any(a.allowed_student_ids)
          )
      )
    );
$function$;

revoke all on function private.resa_student_messaging_allowed(uuid, uuid) from public, anon;
grant execute on function private.resa_student_messaging_allowed(uuid, uuid) to authenticated;

drop policy if exists "RESA members can open customer care chat" on public.resa_chat_conversations;
create policy "RESA members can open customer care chat"
on public.resa_chat_conversations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and participant_one = (select auth.uid())
  and participant_one <> participant_two
  and conversation_type = 'admin_support'
  and public.has_school_role(
    school_id,
    array['teacher','student','parent']::public.school_role[]
  )
  and private.resa_is_active_school_member(
    school_id,
    participant_two,
    'admin'::public.school_role
  )
  and exists (
    select 1 from public.resa_chat_settings s
    where s.school_id = resa_chat_conversations.school_id
      and s.chat_enabled = true
  )
  and private.resa_student_messaging_allowed(school_id, (select auth.uid()))
);
