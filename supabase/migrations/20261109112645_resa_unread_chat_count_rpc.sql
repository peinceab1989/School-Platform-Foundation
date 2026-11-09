-- Exact unread group/direct RESA chat count for each signed-in school member.
create or replace function public.resa_get_unread_chat_count(p_school_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $function$
  select count(*)::integer
  from public.resa_chat_messages m
  join public.resa_chat_conversations c
    on c.id=m.conversation_id and c.school_id=m.school_id
  where m.school_id=p_school_id
    and auth.uid() is not null
    and m.sender_id <> auth.uid()
    and (
      public.has_school_role(p_school_id,array['admin']::public.school_role[])
      or (
        c.conversation_type='group'
        and exists (
          select 1 from public.resa_chat_group_members gm
          where gm.conversation_id=c.id and gm.school_id=c.school_id and gm.user_id=auth.uid()
        )
      )
      or (
        c.conversation_type <> 'group'
        and (c.participant_one=auth.uid() or c.participant_two=auth.uid())
      )
    )
    and not exists (
      select 1 from public.resa_chat_message_reads r
      where r.message_id=m.id and r.school_id=m.school_id and r.user_id=auth.uid()
    );
$function$;

revoke all on function public.resa_get_unread_chat_count(uuid) from public,anon;
grant execute on function public.resa_get_unread_chat_count(uuid) to authenticated;
