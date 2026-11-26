-- Securely verify another active member without exposing the membership
-- directory through the public Data API. This is used only by the chat RLS gate.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.resa_is_active_school_member(
  p_school_id uuid,
  p_user_id uuid,
  p_required_role public.school_role default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1
      from public.school_memberships actor
      where actor.school_id = p_school_id
        and actor.user_id = (select auth.uid())
        and actor.status = 'active'::public.membership_status
    )
    and exists (
      select 1
      from public.school_memberships target
      where target.school_id = p_school_id
        and target.user_id = p_user_id
        and target.status = 'active'::public.membership_status
        and (p_required_role is null or target.role = p_required_role)
    );
$function$;

revoke all on function private.resa_is_active_school_member(uuid, uuid, public.school_role) from public, anon;
grant execute on function private.resa_is_active_school_member(uuid, uuid, public.school_role) to authenticated;

-- The legacy conversation policy checks the target membership directly. RLS
-- intentionally hides other members from non-admin users, so Customer Care
-- chat starts need this narrow private-schema membership check.
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
  and (
    not public.has_school_role(school_id, array['student']::public.school_role[])
    or public.student_messaging_access_enabled(school_id, (select auth.uid()))
  )
);
