alter table public.resa_public_care_conversations
  add column if not exists unread_visitor_count integer not null default 0
  check (unread_visitor_count >= 0);

create or replace function public.resa_public_care_track_message()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.sender_kind = 'visitor' then
    update public.resa_public_care_conversations
    set unread_visitor_count = unread_visitor_count + 1,
        last_message_sender_kind = 'visitor',
        last_message_at = new.created_at,
        updated_at = now()
    where id = new.conversation_id;
  else
    update public.resa_public_care_conversations
    set last_message_sender_kind = 'admin',
        last_message_at = new.created_at,
        updated_at = now()
    where id = new.conversation_id;
  end if;
  return new;
end;
$function$;

revoke all on function public.resa_public_care_track_message() from public,anon,authenticated,service_role;
drop trigger if exists trg_resa_public_care_track_message on public.resa_public_care_messages;
create trigger trg_resa_public_care_track_message
after insert on public.resa_public_care_messages
for each row execute function public.resa_public_care_track_message();
