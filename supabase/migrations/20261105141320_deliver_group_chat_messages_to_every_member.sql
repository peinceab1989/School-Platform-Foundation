-- Deliver group-chat notifications to every active group member.
-- Direct conversations continue to notify their other participant only.
create or replace function public.notify_resa_chat_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_subject text;
begin
  select coalesce(nullif(c.subject, ''), 'New RESA chat message')
    into v_subject
  from public.resa_chat_conversations c
  where c.id = new.conversation_id
    and c.school_id = new.school_id;

  if v_subject is null then
    raise exception 'Chat conversation not found for this message';
  end if;

  if exists (
    select 1
    from public.resa_chat_conversations c
    where c.id = new.conversation_id
      and c.school_id = new.school_id
      and c.conversation_type = 'group'
  ) then
    insert into public.school_messages
      (school_id, sender_id, recipient_id, subject, message, is_read, sent_at, channel, conversation_id)
    select
      new.school_id, new.sender_id, gm.user_id, v_subject, new.body, false,
      new.created_at, 'private', new.conversation_id
    from public.resa_chat_group_members gm
    where gm.conversation_id = new.conversation_id
      and gm.school_id = new.school_id
      and gm.user_id <> new.sender_id
      and exists (
        select 1 from public.school_memberships sm
        where sm.school_id = new.school_id
          and sm.user_id = gm.user_id
          and sm.status = 'active'::public.membership_status
      );
  else
    insert into public.school_messages
      (school_id, sender_id, recipient_id, subject, message, is_read, sent_at, channel, conversation_id)
    select
      new.school_id, new.sender_id,
      case when c.participant_one = new.sender_id then c.participant_two else c.participant_one end,
      v_subject, new.body, false, new.created_at, 'private', new.conversation_id
    from public.resa_chat_conversations c
    where c.id = new.conversation_id
      and c.school_id = new.school_id
      and new.sender_id in (c.participant_one, c.participant_two)
      and case when c.participant_one = new.sender_id then c.participant_two else c.participant_one end <> new.sender_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.notify_resa_chat_recipient() from public, anon, authenticated;
grant execute on function public.notify_resa_chat_recipient() to postgres, service_role;
