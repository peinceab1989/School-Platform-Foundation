-- Mirror RESA dashboard chat messages into the recipient's existing notification inbox.
-- This lets the Notifications page show an unread count and receive Realtime updates.
create or replace function public.notify_resa_chat_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists trg_notify_resa_chat_recipient on public.resa_chat_messages;
create trigger trg_notify_resa_chat_recipient
after insert on public.resa_chat_messages
for each row execute function public.notify_resa_chat_recipient();

create index if not exists school_messages_recipient_unread_idx
on public.school_messages (school_id, recipient_id, is_read, sent_at desc);
