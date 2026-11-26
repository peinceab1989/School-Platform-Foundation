-- Fix the direct-chat RLS permission error without exposing the internal
-- student eligibility helper as a public RPC.
drop policy if exists "admin approved role-to-role direct chat" on public.resa_chat_conversations;
create policy "admin approved role-to-role direct chat"
on public.resa_chat_conversations
for insert
to authenticated
with check (
  conversation_type = 'direct'
  and created_by = (select auth.uid())
  and participant_one = (select auth.uid())
  and participant_one <> participant_two
  and private.resa_chat_recipient_allowed(school_id, participant_two, 'private_messages')
  and (
    not public.has_school_role(school_id, array['student']::public.school_role[])
    or private.resa_student_messaging_allowed(school_id, (select auth.uid()))
  )
  and exists (
    select 1
    from public.resa_chat_settings settings
    where settings.school_id = resa_chat_conversations.school_id
      and settings.chat_enabled = true
  )
);

-- Customer Care always targets an active school administrator. This trigger
-- protects the rule even if another permissive INSERT policy is present.
create or replace function private.enforce_admin_only_customer_care_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  sender_role public.school_role;
  recipient_role public.school_role;
begin
  if new.conversation_type <> 'admin_support' then
    return new;
  end if;

  if (select auth.uid()) is null
     or new.created_by is distinct from (select auth.uid())
     or new.participant_one is distinct from (select auth.uid())
     or new.participant_one = new.participant_two then
    raise exception 'Customer Care conversations must be opened by the signed-in school member';
  end if;

  select membership.role into sender_role
  from public.school_memberships membership
  where membership.school_id = new.school_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'::public.membership_status
  limit 1;

  select membership.role into recipient_role
  from public.school_memberships membership
  where membership.school_id = new.school_id
    and membership.user_id = new.participant_two
    and membership.status = 'active'::public.membership_status
  limit 1;

  if sender_role is null then
    raise exception 'An active school membership is required to contact Customer Care';
  end if;

  if recipient_role is distinct from 'admin'::public.school_role then
    raise exception 'Customer Care conversations can only be addressed to an active school administrator';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_admin_only_customer_care_conversations() from public, anon, authenticated;
drop trigger if exists resa_admin_only_customer_care_recipient_guard on public.resa_chat_conversations;
create trigger resa_admin_only_customer_care_recipient_guard
before insert on public.resa_chat_conversations
for each row
execute function private.enforce_admin_only_customer_care_conversations();
