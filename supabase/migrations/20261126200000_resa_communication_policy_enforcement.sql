-- Enforce the administrator-managed communication channel and role policies
-- at the database boundary. Existing messages and memberships are untouched.
create or replace function public.resa_communication_channel_allowed(
  p_school_id uuid,
  p_channel_key text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.school_memberships m
    join public.resa_chat_settings s on s.school_id = m.school_id
    where m.school_id = p_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'::public.membership_status
      and p_channel_key = any (array[
        'private_messages',
        'group_messages',
        'announcements',
        'customer_care'
      ]::text[])
      and coalesce(s.channel_policy ->> p_channel_key, 'true') = 'true'
      and (
        m.role = 'admin'::public.school_role
        or coalesce(s.role_policy -> m.role::text ->> p_channel_key, 'true') = 'true'
      )
  );
$function$;

revoke all on function public.resa_communication_channel_allowed(uuid, text) from public, anon;
grant execute on function public.resa_communication_channel_allowed(uuid, text) to authenticated;

-- Restrictive policies are ANDed with the existing permissive policies. This
-- preserves the carefully scoped existing recipient/group checks while adding
-- a central admin-controlled channel gate.
drop policy if exists "resa admin channel gate conversations" on public.resa_chat_conversations;
create policy "resa admin channel gate conversations"
on public.resa_chat_conversations
as restrictive
for insert
to authenticated
with check (
  public.resa_communication_channel_allowed(
    school_id,
    case
      when conversation_type = 'group' then 'group_messages'
      when conversation_type = 'admin_support' then 'customer_care'
      when conversation_type = 'direct' then 'private_messages'
      else 'unsupported'
    end
  )
);

drop policy if exists "resa admin channel gate chat messages" on public.resa_chat_messages;
create policy "resa admin channel gate chat messages"
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
      and public.resa_communication_channel_allowed(
        c.school_id,
        case
          when c.conversation_type = 'group' then 'group_messages'
          when c.conversation_type = 'admin_support' then 'customer_care'
          when c.conversation_type = 'direct' then 'private_messages'
          else 'unsupported'
        end
      )
  )
);

drop policy if exists "resa admin channel gate school messages" on public.school_messages;
create policy "resa admin channel gate school messages"
on public.school_messages
as restrictive
for insert
to authenticated
with check (
  public.resa_communication_channel_allowed(
    school_id,
    case
      when channel = 'private' then 'private_messages'
      when channel = 'customer_care' then 'customer_care'
      when channel = 'announcement' then 'announcements'
      else 'unsupported'
    end
  )
);

-- Group creation uses a SECURITY DEFINER RPC, so enforce the same policy
-- inside the function rather than relying on table RLS.
create or replace function public.resa_create_chat_group(
  p_school_id uuid,
  p_subject text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_conversation_id uuid;
  v_first_member uuid;
  v_count integer;
begin
  if v_user is null or not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
    raise exception 'Only an active school administrator can create a group.';
  end if;
  if not public.resa_communication_channel_allowed(p_school_id, 'group_messages') then
    raise exception 'School group messaging is disabled by the communication policy.';
  end if;
  if not exists (select 1 from public.resa_chat_settings s where s.school_id=p_school_id and s.chat_enabled=true) then
    raise exception 'School chat is currently disabled.';
  end if;
  if p_subject is null or length(trim(p_subject)) < 1 or length(trim(p_subject)) > 160 then
    raise exception 'Group name must contain 1 to 160 characters.';
  end if;
  if p_member_ids is null then raise exception 'Select at least two group members.'; end if;
  select count(distinct x) into v_count from unnest(p_member_ids) x where x is not null and x <> v_user;
  if v_count < 2 or v_count > 100 then raise exception 'Select between 2 and 100 other active members.'; end if;
  if exists (
    select 1 from (select distinct x as user_id from unnest(p_member_ids) x where x is not null and x <> v_user) chosen
    where not exists (
      select 1 from public.school_memberships m
      where m.school_id=p_school_id and m.user_id=chosen.user_id
        and m.status='active'::public.membership_status
    )
  ) then raise exception 'One or more selected members are not active in this school.'; end if;
  select x into v_first_member from unnest(p_member_ids) x where x is not null and x <> v_user limit 1;
  insert into public.resa_chat_conversations(
    school_id,created_by,participant_one,participant_two,conversation_type,subject,last_message_at
  ) values (
    p_school_id,v_user,v_user,v_first_member,'group',trim(p_subject),now()
  ) returning id into v_conversation_id;
  insert into public.resa_chat_group_members(conversation_id,school_id,user_id,added_by)
  select v_conversation_id,p_school_id,v_user,v_user
  union
  select v_conversation_id,p_school_id,x,v_user
  from unnest(p_member_ids) x where x is not null and x <> v_user;
  return v_conversation_id;
end;
$function$;

comment on function public.resa_communication_channel_allowed(uuid, text) is
  'Enforces school administrator channel policy and active member role permissions for RESA communication writes.';
