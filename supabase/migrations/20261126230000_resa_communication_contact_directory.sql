-- Centralise RESA messaging contact visibility, names and administrator-controlled
-- role-to-role access. This is additive: no messages, memberships, accounts or
-- device subscriptions are modified.
alter table public.resa_chat_settings
  add column if not exists recipient_policy jsonb not null default
  '{"admin":["admin","teacher","parent","student"],"teacher":["admin","student"],"parent":["admin"],"student":["admin","teacher"]}'::jsonb;

update public.resa_chat_settings
set recipient_policy = '{"admin":["admin","teacher","parent","student"],"teacher":["admin","student"],"parent":["admin"],"student":["admin","teacher"]}'::jsonb
where recipient_policy is null or recipient_policy = '{}'::jsonb;

-- Check the current sender's role and the selected recipient's role against
-- the administrator-managed policy. Administrators retain directory access.
drop function if exists private.resa_chat_recipient_allowed(uuid, uuid);
drop function if exists private.resa_chat_recipient_allowed(uuid, uuid, text);
create or replace function private.resa_chat_recipient_allowed(
  p_school_id uuid,
  p_recipient_id uuid,
  p_channel_key text default 'private_messages'
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.school_memberships sender
    join public.resa_chat_settings settings on settings.school_id = sender.school_id
    join public.school_memberships recipient
      on recipient.school_id = sender.school_id
     and recipient.user_id = p_recipient_id
     and recipient.status = 'active'::public.membership_status
    where sender.school_id = p_school_id
      and sender.user_id = (select auth.uid())
      and sender.status = 'active'::public.membership_status
      and p_recipient_id <> (select auth.uid())
      and p_channel_key in ('private_messages', 'customer_care')
      and coalesce(settings.channel_policy ->> p_channel_key, 'true') = 'true'
      and (
        sender.role = 'admin'::public.school_role
        or (
          coalesce(settings.role_policy -> sender.role::text ->> p_channel_key, 'true') = 'true'
          and (
            (p_channel_key = 'customer_care' and recipient.role = 'admin'::public.school_role)
            or (
              p_channel_key = 'private_messages'
              and coalesce(settings.recipient_policy -> sender.role::text, '[]'::jsonb) ? recipient.role::text
              and (
                sender.role <> 'student'::public.school_role
                or public.student_messaging_access_enabled(p_school_id, sender.user_id)
              )
            )
          )
        )
      )
      and (
        sender.role = 'admin'::public.school_role
        or recipient.role = 'admin'::public.school_role
        or sender.role = recipient.role
        or (
          sender.role = 'teacher'::public.school_role
          and recipient.role = 'student'::public.school_role
          and exists (
            select 1
            from public.staff mine
            join public.teacher_assignments ta
              on ta.staff_id = mine.id and ta.school_id = mine.school_id
            join public.student_enrollments se
              on se.class_id = ta.class_id and se.school_id = ta.school_id
             and se.status = 'active'
            join public.students target
              on target.id = se.student_id and target.school_id = se.school_id
            where mine.school_id = p_school_id
              and mine.user_id = sender.user_id
              and mine.status = 'active'
              and target.user_id = recipient.user_id
          )
        )
        or (
          sender.role = 'student'::public.school_role
          and recipient.role = 'teacher'::public.school_role
          and exists (
            select 1
            from public.students mine
            join public.student_enrollments se
              on se.student_id = mine.id and se.school_id = mine.school_id
             and se.status = 'active'
            join public.teacher_assignments ta
              on ta.class_id = se.class_id and ta.school_id = se.school_id
            join public.staff target
              on target.id = ta.staff_id and target.school_id = ta.school_id
             and target.status = 'active'
            where mine.school_id = p_school_id
              and mine.user_id = sender.user_id
              and target.user_id = recipient.user_id
          )
        )
        or (
          sender.role = 'parent'::public.school_role
          and recipient.role = 'teacher'::public.school_role
          and exists (
            select 1
            from public.parent_portal_accounts ppa
            join public.parents_guardians pg
              on pg.id = ppa.parent_guardian_id and pg.school_id = ppa.school_id
             and pg.portal_enabled = true
            join public.parent_student_portal_access psa
              on psa.parent_guardian_id = ppa.parent_guardian_id and psa.school_id = ppa.school_id
             and psa.is_active = true
            join public.student_enrollments se
              on se.student_id = psa.student_id and se.school_id = psa.school_id
             and se.status = 'active'
            join public.teacher_assignments ta
              on ta.class_id = se.class_id and ta.school_id = se.school_id
            join public.staff target
              on target.id = ta.staff_id and target.school_id = ta.school_id
             and target.status = 'active'
            where ppa.school_id = p_school_id
              and ppa.user_id = sender.user_id
              and ppa.is_active = true
              and target.user_id = recipient.user_id
          )
        )
        or (
          sender.role = 'teacher'::public.school_role
          and recipient.role = 'parent'::public.school_role
          and exists (
            select 1
            from public.staff mine
            join public.teacher_assignments ta
              on ta.staff_id = mine.id and ta.school_id = mine.school_id
            join public.student_enrollments se
              on se.class_id = ta.class_id and se.school_id = ta.school_id
             and se.status = 'active'
            join public.student_parent_guardians spg
              on spg.student_id = se.student_id and spg.school_id = se.school_id
            join public.parents_guardians pg
              on pg.id = spg.parent_guardian_id and pg.school_id = spg.school_id
             and pg.portal_enabled = true
            join public.parent_student_portal_access psa
              on psa.parent_guardian_id = pg.id and psa.school_id = pg.school_id
             and psa.student_id = se.student_id and psa.is_active = true
            join public.parent_portal_accounts ppa
              on ppa.parent_guardian_id = pg.id and ppa.school_id = pg.school_id
             and ppa.is_active = true
            where mine.school_id = p_school_id
              and mine.user_id = sender.user_id
              and mine.status = 'active'
              and ppa.user_id = recipient.user_id
          )
        )
        or (
          sender.role = 'parent'::public.school_role
          and recipient.role = 'student'::public.school_role
          and exists (
            select 1
            from public.parent_portal_accounts ppa
            join public.parents_guardians pg
              on pg.id = ppa.parent_guardian_id and pg.school_id = ppa.school_id
             and pg.portal_enabled = true
            join public.parent_student_portal_access psa
              on psa.parent_guardian_id = ppa.parent_guardian_id and psa.school_id = ppa.school_id
             and psa.is_active = true
            join public.student_enrollments se
              on se.student_id = psa.student_id and se.school_id = psa.school_id
             and se.status = 'active'
            join public.students target
              on target.id = se.student_id and target.school_id = se.school_id
            where ppa.school_id = p_school_id
              and ppa.user_id = sender.user_id
              and ppa.is_active = true
              and target.user_id = recipient.user_id
          )
        )
        or (
          sender.role = 'student'::public.school_role
          and recipient.role = 'parent'::public.school_role
          and exists (
            select 1
            from public.students mine
            join public.student_parent_guardians spg
              on spg.student_id = mine.id and spg.school_id = mine.school_id
            join public.parents_guardians pg
              on pg.id = spg.parent_guardian_id and pg.school_id = spg.school_id
             and pg.portal_enabled = true
            join public.parent_student_portal_access psa
              on psa.parent_guardian_id = pg.id and psa.school_id = pg.school_id
             and psa.student_id = mine.id and psa.is_active = true
            join public.parent_portal_accounts ppa
              on ppa.parent_guardian_id = pg.id and ppa.school_id = pg.school_id
             and ppa.is_active = true
            where mine.school_id = p_school_id
              and mine.user_id = sender.user_id
              and ppa.user_id = recipient.user_id
          )
        )
      )
  );
$function$;

revoke all on function private.resa_chat_recipient_allowed(uuid, uuid, text) from public, anon;
grant execute on function private.resa_chat_recipient_allowed(uuid, uuid, text) to authenticated;

create or replace function public.get_school_message_contacts(p_school_id uuid)
returns table(user_id uuid, role public.school_role, display_name text)
language sql
stable
security definer
set search_path to ''
as $function$
  with caller as (
    select m.role
    from public.school_memberships m
    where m.school_id = p_school_id
      and m.user_id = auth.uid()
      and m.status = 'active'::public.membership_status
    limit 1
  )
  select
    m.user_id,
    m.role,
    coalesce(
      nullif(btrim(pr.display_name), ''),
      nullif(btrim(concat_ws(' ', person.first_name, person.middle_name, person.last_name)), ''),
      case m.role
        when 'admin'::public.school_role then 'School administrator · name not set'
        when 'teacher'::public.school_role then 'Teacher · name not set'
        when 'student'::public.school_role then 'Student · name not set'
        when 'parent'::public.school_role then 'Parent/guardian · name not set'
        else 'School member · name not set'
      end
    ) as display_name
  from public.school_memberships m
  cross join caller c
  left join public.profiles pr on pr.id = m.user_id
  left join public.people person on person.user_id = m.user_id and person.school_id = m.school_id
  where m.school_id = p_school_id
    and m.status = 'active'::public.membership_status
    and auth.uid() is not null
    and m.user_id <> auth.uid()
    and (
      c.role = 'admin'::public.school_role
      or private.resa_chat_recipient_allowed(p_school_id, m.user_id, 'private_messages')
      or (
        m.role = 'admin'::public.school_role
        and private.resa_chat_recipient_allowed(p_school_id, m.user_id, 'customer_care')
      )
    )
  order by display_name, m.role;
$function$;

revoke all on function public.get_school_message_contacts(uuid) from public, anon;
grant execute on function public.get_school_message_contacts(uuid) to authenticated;


-- Restrictive policies ensure the recipient-role choice is enforced even if a
-- client bypasses the contact selector or submits a forged conversation.
-- Existing direct-chat policies deliberately covered only assigned teacher/student
-- pairs and admin support. This additional permissive policy enables other
-- role pairs only when the administrator has explicitly enabled that pair.
drop policy if exists "admin approved role-to-role direct chat" on public.resa_chat_conversations;
create policy "admin approved role-to-role direct chat"
on public.resa_chat_conversations
for insert
to authenticated
with check (
  conversation_type = 'direct'
  and created_by = (select auth.uid())
  and participant_one = (select auth.uid())
  and participant_one <> participant_two
  and private.resa_chat_recipient_allowed(school_id, participant_two, 'private_messages')
  and (
    not public.has_school_role(school_id, array['student'::public.school_role])
    or public.student_messaging_access_enabled(school_id, (select auth.uid()))
  )
  and exists (
    select 1 from public.resa_chat_settings settings
    where settings.school_id = resa_chat_conversations.school_id
      and settings.chat_enabled = true
  )
);

drop policy if exists "resa recipient role policy conversations" on public.resa_chat_conversations;
create policy "resa recipient role policy conversations"
on public.resa_chat_conversations
as restrictive
for insert
to authenticated
with check (
  conversation_type = 'group'
  or private.resa_chat_recipient_allowed(
    school_id,
    case when participant_one = (select auth.uid()) then participant_two else participant_one end,
    case when conversation_type = 'admin_support' then 'customer_care' else 'private_messages' end
  )
);

drop policy if exists "resa recipient role policy messages" on public.resa_chat_messages;
create policy "resa recipient role policy messages"
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
      and (
        c.conversation_type = 'group'
        or private.resa_chat_recipient_allowed(
          c.school_id,
          case when c.participant_one = (select auth.uid()) then c.participant_two else c.participant_one end,
          case when c.conversation_type = 'admin_support' then 'customer_care' else 'private_messages' end
        )
      )
  )
);
