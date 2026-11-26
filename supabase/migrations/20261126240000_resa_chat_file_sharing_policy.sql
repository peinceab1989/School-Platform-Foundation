-- RESA chat file-sharing policy and cross-device attachment capacity.
-- Private storage remains private. Existing files and message history are preserved.
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = null
where id = 'resa-chat-media';

-- Even if a client bypasses the upload control, the administrator's global
-- file-sharing switch is enforced by Storage RLS for every new chat upload.
drop policy if exists "RESA chat media uploads require admin file access" on storage.objects;
create policy "RESA chat media uploads require admin file access"
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'resa-chat-media'
  or exists (
    select 1
    from public.resa_chat_conversations c
    join public.resa_chat_settings s on s.school_id = c.school_id
    join public.school_memberships m
      on m.school_id = c.school_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'::public.membership_status
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.school_id = ((storage.foldername(name))[1])::uuid
      and s.chat_enabled = true
      and coalesce(s.channel_policy ->> 'file_attachments', 'true') = 'true'
      and (
        m.role = 'admin'::public.school_role
        or (
          coalesce(s.role_policy -> m.role::text ->> 'file_attachments', 'true') = 'true'
          and (
            (
              c.conversation_type = 'group'
              and exists (
                select 1 from public.resa_chat_group_members gm
                where gm.conversation_id = c.id
                  and gm.school_id = c.school_id
                  and gm.user_id = (select auth.uid())
              )
            )
            or (
              c.conversation_type <> 'group'
              and (c.participant_one = (select auth.uid()) or c.participant_two = (select auth.uid()))
            )
          )
        )
      )
  )
);

comment on policy "RESA chat media uploads require admin file access" on storage.objects is
  'RESA chat uploads are allowed only while the school administrator has enabled file attachments; reads remain limited by the existing conversation-membership policy.';

-- Revoked/inactive school accounts must not retain access to old group files
-- merely because a historical group-member row still exists.
drop policy if exists "RESA chat media reads require active school membership" on storage.objects;
create policy "RESA chat media reads require active school membership"
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'resa-chat-media'
  or exists (
    select 1
    from public.resa_chat_conversations c
    join public.school_memberships m
      on m.school_id = c.school_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'::public.membership_status
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.school_id = ((storage.foldername(name))[1])::uuid
      and (
        m.role = 'admin'::public.school_role
        or (
          c.conversation_type = 'group'
          and exists (
            select 1 from public.resa_chat_group_members gm
            where gm.conversation_id = c.id and gm.user_id = (select auth.uid())
          )
        )
        or (
          c.conversation_type <> 'group'
          and (c.participant_one = (select auth.uid()) or c.participant_two = (select auth.uid()))
        )
      )
  )
);

comment on policy "RESA chat media reads require active school membership" on storage.objects is
  'Chat attachments remain private and are readable only by active school members who are current conversation participants or school administrators.';
