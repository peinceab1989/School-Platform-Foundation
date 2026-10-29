create table if not exists public.resa_chat_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  chat_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.resa_chat_settings enable row level security;
drop policy if exists "school members can view chat setting" on public.resa_chat_settings;
create policy "school members can view chat setting" on public.resa_chat_settings for select to authenticated
using (public.has_school_role(school_id, array['admin','teacher','student']::public.school_role[]));
drop policy if exists "admins manage chat setting" on public.resa_chat_settings;
create policy "admins manage chat setting" on public.resa_chat_settings for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
insert into public.resa_chat_settings(school_id, chat_enabled) select id, false from public.schools on conflict (school_id) do nothing;

create table if not exists public.resa_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  participant_one uuid not null references auth.users(id) on delete restrict,
  participant_two uuid not null references auth.users(id) on delete restrict,
  conversation_type text not null default 'direct' check (conversation_type in ('direct','class_group','admin_support')),
  class_id uuid references public.school_classes(id) on delete set null,
  subject text not null default 'Chat' check (length(trim(subject)) between 1 and 160),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (participant_one <> participant_two)
);
create index if not exists resa_chat_conversations_participants_idx on public.resa_chat_conversations(school_id, participant_one, participant_two, last_message_at desc);
alter table public.resa_chat_conversations enable row level security;
drop policy if exists "participants and admins read chat conversations" on public.resa_chat_conversations;
create policy "participants and admins read chat conversations" on public.resa_chat_conversations for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]) or (auth.uid() in (participant_one,participant_two) and public.has_school_role(school_id, array['teacher','student']::public.school_role[])));
drop policy if exists "members create allowed chat conversations" on public.resa_chat_conversations;
create policy "members create allowed chat conversations" on public.resa_chat_conversations for insert to authenticated
with check (
  created_by=auth.uid() and participant_one=auth.uid()
  and exists (select 1 from public.school_memberships target where target.school_id=resa_chat_conversations.school_id and target.user_id=resa_chat_conversations.participant_two and target.status='active' and target.role in ('admin','teacher','student'))
  and exists (select 1 from public.resa_chat_settings cs where cs.school_id=resa_chat_conversations.school_id and cs.chat_enabled=true)
  and (
    public.has_school_role(resa_chat_conversations.school_id,array['admin']::public.school_role[])
    or (exists (select 1 from public.school_memberships target where target.school_id=resa_chat_conversations.school_id and target.user_id=resa_chat_conversations.participant_two and target.role='admin' and target.status='active') and public.has_school_role(resa_chat_conversations.school_id,array['teacher','student']::public.school_role[]))
    or (public.has_school_role(resa_chat_conversations.school_id,array['teacher']::public.school_role[]) and exists (
      select 1 from public.staff st join public.teacher_assignments ta on ta.staff_id=st.id and ta.school_id=st.school_id
      join public.student_enrollments se on se.school_id=ta.school_id and se.class_id=ta.class_id and se.status='active'
      join public.students s on s.id=se.student_id and s.school_id=se.school_id
      where st.school_id=resa_chat_conversations.school_id and st.user_id=auth.uid() and st.status='active' and s.user_id=resa_chat_conversations.participant_two
    ))
    or (public.has_school_role(resa_chat_conversations.school_id,array['student']::public.school_role[]) and exists (
      select 1 from public.students s join public.student_enrollments se on se.student_id=s.id and se.school_id=s.school_id and se.status='active'
      join public.teacher_assignments ta on ta.school_id=se.school_id and ta.class_id=se.class_id
      join public.staff st on st.id=ta.staff_id and st.school_id=ta.school_id and st.status='active'
      where s.school_id=resa_chat_conversations.school_id and s.user_id=auth.uid() and st.user_id=resa_chat_conversations.participant_two
    ))
  )
);

create table if not exists public.resa_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.resa_chat_conversations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists resa_chat_messages_conversation_idx on public.resa_chat_messages(conversation_id,created_at);
alter table public.resa_chat_messages enable row level security;
drop policy if exists "participants and admins read chat messages" on public.resa_chat_messages;
create policy "participants and admins read chat messages" on public.resa_chat_messages for select to authenticated
using (public.has_school_role(school_id,array['admin']::public.school_role[]) or exists (
  select 1 from public.resa_chat_conversations c where c.id=resa_chat_messages.conversation_id and c.school_id=resa_chat_messages.school_id and auth.uid() in (c.participant_one,c.participant_two)
));
drop policy if exists "participants send messages when chat enabled" on public.resa_chat_messages;
create policy "participants send messages when chat enabled" on public.resa_chat_messages for insert to authenticated
with check (sender_id=auth.uid()
  and exists (select 1 from public.resa_chat_settings cs where cs.school_id=resa_chat_messages.school_id and cs.chat_enabled=true)
  and exists (select 1 from public.resa_chat_conversations c where c.id=resa_chat_messages.conversation_id and c.school_id=resa_chat_messages.school_id and auth.uid() in (c.participant_one,c.participant_two))
);
drop policy if exists "participants update last message time" on public.resa_chat_conversations;
create policy "participants update last message time" on public.resa_chat_conversations for update to authenticated
using (exists (select 1 from public.resa_chat_settings cs where cs.school_id=resa_chat_conversations.school_id and cs.chat_enabled=true) and auth.uid() in (participant_one,participant_two))
with check (auth.uid() in (participant_one,participant_two));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='resa_chat_messages') then
    alter publication supabase_realtime add table public.resa_chat_messages;
  end if;
end $$;
