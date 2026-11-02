-- Allow administrators to deliver school-wide and role-targeted notifications.
-- Each recipient receives a separate school_messages row, so inbox privacy is preserved.
-- This channel is distinct from private messaging and Customer Care.

create or replace function public.can_send_school_message(
  p_school_id uuid,
  p_sender_id uuid,
  p_recipient_id uuid,
  p_channel text,
  p_conversation_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  sender_role public.school_role;
  recipient_role public.school_role;
  conversation_exists boolean := false;
begin
  if p_sender_id is distinct from (select auth.uid())
     or p_school_id is null
     or p_recipient_id is null
     or p_sender_id = p_recipient_id then
    return false;
  end if;

  select m.role into sender_role
  from public.school_memberships m
  where m.school_id = p_school_id
    and m.user_id = p_sender_id
    and m.status = 'active'::public.membership_status
  limit 1;

  select m.role into recipient_role
  from public.school_memberships m
  where m.school_id = p_school_id
    and m.user_id = p_recipient_id
    and m.status = 'active'::public.membership_status
  limit 1;

  if sender_role is null or recipient_role is null then
    return false;
  end if;

  if p_channel = 'announcement' then
    return sender_role = 'admin'::public.school_role;
  end if;

  if p_channel = 'private' then
    return public.student_messaging_access_enabled(p_school_id, p_sender_id)
       and public.student_messaging_access_enabled(p_school_id, p_recipient_id);
  end if;

  if p_channel <> 'customer_care' or p_conversation_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.school_messages m
    where m.school_id = p_school_id
      and m.channel = 'customer_care'
      and m.conversation_id = p_conversation_id
      and (
        (m.sender_id = p_sender_id and m.recipient_id = p_recipient_id)
        or (m.sender_id = p_recipient_id and m.recipient_id = p_sender_id)
      )
  ) into conversation_exists;

  if conversation_exists then
    return true;
  end if;

  return sender_role = 'admin'::public.school_role
      or (sender_role <> 'admin'::public.school_role
          and recipient_role = 'admin'::public.school_role);
end;
$function$;

revoke all on function public.can_send_school_message(uuid, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.can_send_school_message(uuid, uuid, uuid, text, uuid) to authenticated;
