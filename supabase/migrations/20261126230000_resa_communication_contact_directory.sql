-- Centralise RESA messaging contact visibility, names and administrator-controlled
-- role-to-role access. This is additive: no messages, memberships, accounts or
-- device subscriptions are modified.
alter table public.resa_chat_settings
  add column if not exists recipient_policy jsonb not null default
  '{"admin":["admin","teacher","parent","student"],"teacher":["admin","student"],"parent":["admin"],"student":["admin","teacher"]}'::jsonb;

update public.resa_chat_settings
set recipient_policy = '{"admin":["admin","teacher","parent","student"],"teacher":["admin","student"],"parent":["admin"],"student":["admin","teacher"]}'::jsonb
where recipient_policy is null or recipient_policy = '{}'::jsonb;

-- Check the current sender's role and the selected recipient's role against
-- the administrator-managed policy. Administrators retain directory access.
create or replace function public.resa_chat_recipient_allowed(
  p_school_id uuid,
  p_recipient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.school_memberships sender
    join public.resa_chat_settings settings on settings.school_id = sender.school_id
    join public.school_memberships recipient
      on recipient.school_id = sender.school_id
     and recipient.user_id = p_recipient_id
     and recipient.status = 'active'::public.membership_status
    where sender.school_id = p_school_id
      and sender.user_id = (select auth.uid())
      and sender.status = 'active'::public.membership_status
      and p_recipient_id <> (select auth.uid())
      and (
        sender.role = 'admin'::public.school_role
        or (
          coalesce(settings.channel_policy ->> 'private_messages', 'true') = 'true'
          and coalesce(settings.role_policy -> sender.role::text ->> 'private_messages', 'true') = 'true'
          and coalesce(settings.recipient_policy -> sender.role::text, '[]'::jsonb)
            ? recipient.role::text
        )
      )
  );
$function$;

revoke all on function public.resa_chat_recipient_allowed(uuid, uuid) from public, anon;
grant execute on function public.resa_chat_recipient_allowed(uuid, uuid) to authenticated;

create or replace function public.get_school_message_contacts(p_school_id uuid)
returns table(user_id uuid, role public.school_role, display_name text)
language sql
stable
security definer
set search_path to ''
as $function$
  with caller as (
    select m.role
    from public.school_memberships m
    where m.school_id = p_school_id
      and m.user_id = auth.uid()
      and m.status = 'active'::public.membership_status
    limit 1
  )
  select
    m.user_id,
    m.role,
    coalesce(
      nullif(btrim(pr.display_name), ''),
      nullif(btrim(concat_ws(' ', person.first_name, person.middle_name, person.last_name)), ''),
      case m.role
        when 'admin'::public.school_role then 'School administrator · name not set'
        when 'teacher'::public.school_role then 'Teacher · name not set'
        when 'student'::public.school_role then 'Student · name not set'
        when 'parent'::public.school_role then 'Parent/guardian · name not set'
        else 'School member · name not set'
      end
    ) as display_name
  from public.school_memberships m
  cross join caller c
  left join public.profiles pr on pr.id = m.user_id
  left join public.people person on person.user_id = m.user_id and person.school_id = m.school_id
  where m.school_id = p_school_id
    and m.status = 'active'::public.membership_status
    and auth.uid() is not null
    and m.user_id <> auth.uid()
    and (
      c.role = 'admin'::public.school_role
      or public.resa_chat_recipient_allowed(p_school_id, m.user_id)
    )
  order by display_name, m.role;
$function$;

revoke all on function public.get_school_message_contacts(uuid) from public, anon;
grant execute on function public.get_school_message_contacts(uuid) to authenticated;


-- Restrictive policies ensure the recipient-role choice is enforced even if a
-- client bypasses the contact selector or submits a forged conversation.
drop policy if exists "resa recipient role policy conversations" on public.resa_chat_conversations;
create policy "resa recipient role policy conversations"
on public.resa_chat_conversations
as restrictive
for insert
to authenticated
with check (
  conversation_type = 'group'
  or public.resa_chat_recipient_allowed(
    school_id,
    case when participant_one = (select auth.uid()) then participant_two else participant_one end
  )
);

drop policy if exists "resa recipient role policy messages" on public.resa_chat_messages;
create policy "resa recipient role policy messages"
on public.resa_chat_messages
as restrictive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.resa_chat_conversations c
    where c.id = resa_chat_messages.conversation_id
      and c.school_id = resa_chat_messages.school_id
      and (
        c.conversation_type = 'group'
        or public.resa_chat_recipient_allowed(
          c.school_id,
          case when c.participant_one = (select auth.uid()) then c.participant_two else c.participant_one end
        )
      )
  )
);
