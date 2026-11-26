-- RESA Technical Support & Maintenance Centre
-- Additive only: no existing school records are modified.
create table if not exists public.resa_support_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  ticket_number bigint generated always as identity,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_role text not null default 'unknown' check (reporter_role in ('admin','teacher','student','parent','staff','unknown')),
  category text not null check (category in ('technical_issue','maintenance','access_login','bug_error','feature_request','data_correction','other')),
  title text not null check (char_length(title) between 5 and 160),
  description text not null check (char_length(description) between 10 and 6000),
  page_url text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','acknowledged','in_progress','waiting_for_reporter','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (school_id, ticket_number)
);
create index if not exists resa_support_tickets_school_status_idx on public.resa_support_tickets(school_id,status,created_at desc);
create index if not exists resa_support_tickets_reporter_idx on public.resa_support_tickets(reporter_user_id,created_at desc);

create table if not exists public.resa_support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.resa_support_tickets(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists resa_support_replies_ticket_idx on public.resa_support_ticket_replies(ticket_id,created_at);

alter table public.resa_support_tickets enable row level security;
alter table public.resa_support_ticket_replies enable row level security;
revoke all on public.resa_support_tickets from anon;
revoke all on public.resa_support_ticket_replies from anon;
grant select,insert on public.resa_support_tickets to authenticated;
revoke update on public.resa_support_tickets from authenticated;
grant update (priority,status,assigned_to,resolution_note,updated_at,resolved_at) on public.resa_support_tickets to authenticated;
grant select,insert on public.resa_support_ticket_replies to authenticated;
grant usage,select on sequence public.resa_support_tickets_ticket_number_seq to authenticated;

drop policy if exists resa_support_ticket_read on public.resa_support_tickets;
create policy resa_support_ticket_read on public.resa_support_tickets for select to authenticated
using (
  reporter_user_id = auth.uid()
  or exists (select 1 from public.school_memberships sm where sm.school_id = resa_support_tickets.school_id and sm.user_id = auth.uid() and sm.status = 'active' and sm.role = 'admin')
);
drop policy if exists resa_support_ticket_create on public.resa_support_tickets;
create policy resa_support_ticket_create on public.resa_support_tickets for insert to authenticated
with check (
  reporter_user_id = auth.uid()
  and exists (select 1 from public.school_memberships sm where sm.school_id = resa_support_tickets.school_id and sm.user_id = auth.uid() and sm.status = 'active')
);
drop policy if exists resa_support_ticket_admin_update on public.resa_support_tickets;
create policy resa_support_ticket_admin_update on public.resa_support_tickets for update to authenticated
using (exists (select 1 from public.school_memberships sm where sm.school_id = resa_support_tickets.school_id and sm.user_id = auth.uid() and sm.status = 'active' and sm.role = 'admin'))
with check (
  exists (select 1 from public.school_memberships sm where sm.school_id = resa_support_tickets.school_id and sm.user_id = auth.uid() and sm.status = 'active' and sm.role = 'admin')
  and (assigned_to is null or exists (select 1 from public.school_memberships assignee where assignee.school_id = resa_support_tickets.school_id and assignee.user_id = resa_support_tickets.assigned_to and assignee.status = 'active' and assignee.role in ('admin','teacher'))
);

drop policy if exists resa_support_reply_read on public.resa_support_ticket_replies;
create policy resa_support_reply_read on public.resa_support_ticket_replies for select to authenticated
using (
  exists (select 1 from public.resa_support_tickets t where t.id = ticket_id and t.school_id = resa_support_ticket_replies.school_id
    and (t.reporter_user_id = auth.uid() or exists (select 1 from public.school_memberships sm where sm.school_id = t.school_id and sm.user_id = auth.uid() and sm.status = 'active' and sm.role = 'admin')))
  and (not is_internal or exists (select 1 from public.school_memberships sm where sm.school_id = resa_support_ticket_replies.school_id and sm.user_id = auth.uid() and sm.status = 'active' and sm.role = 'admin'))
);
drop policy if exists resa_support_reply_create on public.resa_support_ticket_replies;
create policy resa_support_reply_create on public.resa_support_ticket_replies for insert to authenticated
with check (
  author_user_id = auth.uid()
  and is_internal = false
  and exists (select 1 from public.resa_support_tickets t where t.id = ticket_id and t.school_id = resa_support_ticket_replies.school_id and (t.reporter_user_id = auth.uid() or exists (select 1 from public.school_memberships sm where sm.school_id = t.school_id and sm.user_id = auth.uid() and sm.status = 'active' and sm.role = 'admin')))
);
