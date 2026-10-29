-- Admin-controlled student messaging access and customer-care conversation metadata.
create table if not exists public.school_messaging_access (
  school_id uuid primary key references public.schools(id) on delete cascade,
  allow_all_students boolean not null default false,
  allowed_student_ids uuid[] not null default '{}'::uuid[],
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.school_messaging_access enable row level security;
drop policy if exists "school admins can view messaging access" on public.school_messaging_access;
create policy "school admins can view messaging access"
on public.school_messaging_access for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));
drop policy if exists "school admins can create messaging access" on public.school_messaging_access;
create policy "school admins can create messaging access"
on public.school_messaging_access for insert to authenticated
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and updated_by = (select auth.uid())
);
drop policy if exists "school admins can update messaging access" on public.school_messaging_access;
create policy "school admins can update messaging access"
on public.school_messaging_access for update to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and updated_by = (select auth.uid())
);

create or replace function public.student_messaging_access_enabled(p_school_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    not exists (
      select 1 from public.school_memberships m
      where m.school_id = p_school_id
        and m.user_id = p_user_id
        and m.status = 'active'::public.membership_status
        and m.role = 'student'::public.school_role
    )
    or exists (
      select 1
      from public.school_messaging_access a
      where a.school_id = p_school_id
        and (
          a.allow_all_students
          or p_user_id = any(a.allowed_student_ids)
        )
    );
$function$;
revoke all on function public.student_messaging_access_enabled(uuid, uuid) from public, anon;
grant execute on function public.student_messaging_access_enabled(uuid, uuid) to authenticated;

drop policy if exists "users can send school messages" on public.school_messages;
create policy "users can send school messages"
on public.school_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and public.has_school_role(school_id)
  and exists (
    select 1 from public.school_memberships recipient_membership
    where recipient_membership.school_id = school_messages.school_id
      and recipient_membership.user_id = school_messages.recipient_id
      and recipient_membership.status = 'active'::public.membership_status
  )
  and public.student_messaging_access_enabled(school_id, sender_id)
  and public.student_messaging_access_enabled(school_id, recipient_id)
);

alter table public.school_messages
  add column if not exists channel text not null default 'private',
  add column if not exists conversation_id uuid;

alter table public.school_messages
  drop constraint if exists school_messages_channel_check;
alter table public.school_messages
  add constraint school_messages_channel_check
  check (channel in ('private', 'customer_care'));

create index if not exists school_messages_conversation_idx
on public.school_messages (school_id, channel, conversation_id, sent_at);

