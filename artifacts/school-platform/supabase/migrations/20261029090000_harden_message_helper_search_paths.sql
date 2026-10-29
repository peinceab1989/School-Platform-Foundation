-- Harden SECURITY DEFINER helpers against search_path object shadowing.
create or replace function public.get_school_message_contacts(p_school_id uuid)
returns table(user_id uuid, role public.school_role, display_name text)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    m.user_id,
    m.role,
    coalesce(nullif(p.display_name, ''), initcap(m.role::text) || ' member') as display_name
  from public.school_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.school_id = p_school_id
    and m.status = 'active'::public.membership_status
    and auth.uid() is not null
    and exists (
      select 1
      from public.school_memberships me
      where me.school_id = p_school_id
        and me.user_id = auth.uid()
        and me.status = 'active'::public.membership_status
    )
  order by display_name;
$function$;

create or replace function public.notify_resa_chat_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recipient uuid;
  chat_subject text;
begin
  select
    case when c.participant_one = new.sender_id
      then c.participant_two
      else c.participant_one
    end,
    coalesce(nullif(c.subject, ''), 'New RESA chat message')
  into recipient, chat_subject
  from public.resa_chat_conversations c
  where c.id = new.conversation_id
    and c.school_id = new.school_id;

  if recipient is not null and recipient <> new.sender_id then
    insert into public.school_messages
      (school_id, sender_id, recipient_id, subject, message, is_read, sent_at)
    values
      (new.school_id, new.sender_id, recipient, chat_subject, new.body, false, new.created_at);
  end if;

  return new;
end;
$function$;
