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

  -- School-wide or role-targeted notices are administrator-only.
  if p_channel = 'announcement' then
    return sender_role = 'admin'::public.school_role;
  end if;

  -- The legacy inbox is for administrator communication and parent support.
  -- Teacher/student peer communication uses RESA Chat, where assignment and
  -- group-membership checks are enforced by conversation RLS.
  if p_channel = 'private' then
    if sender_role = 'admin'::public.school_role then
      return true;
    end if;

    if recipient_role <> 'admin'::public.school_role then
      return false;
    end if;

    return sender_role <> 'student'::public.school_role
      or public.student_messaging_access_enabled(p_school_id, p_sender_id);
  end if;

  if p_channel <> 'customer_care' or p_conversation_id is null then
    return false;
  end if;

  if sender_role <> 'admin'::public.school_role
     and recipient_role <> 'admin'::public.school_role then
    return false;
  end if;

  if sender_role = 'student'::public.school_role
     and not public.student_messaging_access_enabled(p_school_id, p_sender_id) then
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

  return conversation_exists
    or sender_role = 'admin'::public.school_role
    or recipient_role = 'admin'::public.school_role;
end;
$function$;

revoke all on function public.can_send_school_message(uuid, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.can_send_school_message(uuid, uuid, uuid, text, uuid) to authenticated;