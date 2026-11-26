-- RESA Technical Operations Centre
-- Additive maintenance, asset register, SLA escalation and incident history.
-- Existing school records and support tickets are preserved.

alter table public.resa_support_tickets
  add column if not exists escalation_level smallint not null default 0
    check (escalation_level between 0 and 3),
  add column if not exists escalated_at timestamptz;

create table if not exists public.resa_technical_operations_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  ticket_id uuid references public.resa_support_tickets(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('ticket_assigned','ticket_status_changed','ticket_priority_changed','ticket_escalated','maintenance_created','maintenance_completed','asset_created','repair_recorded','note')),
  summary text not null check (char_length(summary) between 3 and 240),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.resa_technical_assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  asset_tag text not null,
  asset_name text not null check (char_length(asset_name) between 2 and 160),
  category text not null check (category in ('computer','printer','network','projector','power','security','biometric','furniture','building','other')),
  location text,
  serial_number text,
  condition text not null default 'operational' check (condition in ('operational','needs_attention','under_repair','retired')),
  warranty_until date,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, asset_tag)
);

create table if not exists public.resa_maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  asset_id uuid references public.resa_technical_assets(id) on delete set null,
  title text not null check (char_length(title) between 3 and 160),
  description text,
  maintenance_type text not null check (maintenance_type in ('preventive','inspection','repair','upgrade','safety_check','other')),
  location text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled','overdue')),
  completion_notes text,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_end > scheduled_start)
);

create index if not exists resa_tech_events_school_created_idx
  on public.resa_technical_operations_events(school_id, created_at desc);
create index if not exists resa_tech_events_ticket_idx
  on public.resa_technical_operations_events(ticket_id, created_at desc);
create index if not exists resa_tech_assets_school_idx
  on public.resa_technical_assets(school_id, condition, category);
create index if not exists resa_maintenance_school_schedule_idx
  on public.resa_maintenance_schedules(school_id, scheduled_start, status);
create index if not exists resa_maintenance_assignee_idx
  on public.resa_maintenance_schedules(assigned_to, scheduled_start)
  where assigned_to is not null;

alter table public.resa_technical_operations_events enable row level security;
alter table public.resa_technical_assets enable row level security;
alter table public.resa_maintenance_schedules enable row level security;

revoke all on public.resa_technical_operations_events from anon, authenticated, public;
revoke all on public.resa_technical_assets from anon, authenticated, public;
revoke all on public.resa_maintenance_schedules from anon, authenticated, public;

grant select on public.resa_technical_operations_events to authenticated;
grant insert (school_id, ticket_id, actor_user_id, event_type, summary, details) on public.resa_technical_operations_events to authenticated;
grant select, insert on public.resa_technical_assets to authenticated;
grant update (condition, updated_at) on public.resa_technical_assets to authenticated;
grant select, insert on public.resa_maintenance_schedules to authenticated;
grant update (asset_id, title, description, maintenance_type, location, scheduled_start, scheduled_end, assigned_to, status, completion_notes, completed_at, updated_at) on public.resa_maintenance_schedules to authenticated;

drop policy if exists resa_tech_events_admin_read on public.resa_technical_operations_events;
create policy resa_tech_events_admin_read on public.resa_technical_operations_events
for select to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_technical_operations_events.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
  or exists (
    select 1 from public.resa_support_tickets t
    where t.id = resa_technical_operations_events.ticket_id
      and t.reporter_user_id = (select auth.uid())
  )
);

drop policy if exists resa_tech_events_admin_insert on public.resa_technical_operations_events;
create policy resa_tech_events_admin_insert on public.resa_technical_operations_events
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_technical_operations_events.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
  and (ticket_id is null or exists (
    select 1 from public.resa_support_tickets t
    where t.id = resa_technical_operations_events.ticket_id
      and t.school_id = resa_technical_operations_events.school_id
  ))
);

drop policy if exists resa_tech_assets_admin_read on public.resa_technical_assets;
create policy resa_tech_assets_admin_read on public.resa_technical_assets
for select to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_technical_assets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
);

drop policy if exists resa_tech_assets_admin_insert on public.resa_technical_assets;
create policy resa_tech_assets_admin_insert on public.resa_technical_assets
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_technical_assets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
);

drop policy if exists resa_tech_assets_admin_update on public.resa_technical_assets;
create policy resa_tech_assets_admin_update on public.resa_technical_assets
for update to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_technical_assets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_technical_assets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
);

drop policy if exists resa_maintenance_admin_read on public.resa_maintenance_schedules;
create policy resa_maintenance_admin_read on public.resa_maintenance_schedules
for select to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_maintenance_schedules.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
  or (
    assigned_to = (select auth.uid())
    and exists (
      select 1 from public.school_memberships sm
      where sm.school_id = resa_maintenance_schedules.school_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active' and sm.role in ('admin','teacher')
    )
  )
);

drop policy if exists resa_maintenance_admin_insert on public.resa_maintenance_schedules;
create policy resa_maintenance_admin_insert on public.resa_maintenance_schedules
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_maintenance_schedules.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
  and (asset_id is null or exists (
    select 1 from public.resa_technical_assets a
    where a.id = resa_maintenance_schedules.asset_id
      and a.school_id = resa_maintenance_schedules.school_id
  ))
  and (assigned_to is null or exists (
    select 1 from public.school_memberships assignee
    where assignee.school_id = resa_maintenance_schedules.school_id
      and assignee.user_id = resa_maintenance_schedules.assigned_to
      and assignee.status = 'active' and assignee.role in ('admin','teacher')
  ))
);

drop policy if exists resa_maintenance_admin_update on public.resa_maintenance_schedules;
create policy resa_maintenance_admin_update on public.resa_maintenance_schedules
for update to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_maintenance_schedules.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_maintenance_schedules.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
);

-- Automatic first-line SLA escalation. It flags overdue tickets and records a
-- durable event; it does not silently change the ticket's priority or status.
select cron.schedule(
  'resa-support-sla-escalation',
  '*/5 * * * *',
  $job$
    with overdue as (
      update public.resa_support_tickets t
      set escalation_level = 1,
          escalated_at = now(),
          updated_at = now()
      where t.status not in ('resolved','closed')
        and t.escalated_at is null
        and not exists (
          select 1 from public.resa_support_ticket_replies r
          where r.ticket_id = t.id
            and r.author_user_id <> t.reporter_user_id
            and r.is_internal = false
        )
        and t.created_at <= now() - make_interval(mins =>
          case t.priority
            when 'urgent' then 15
            when 'high' then 60
            when 'normal' then 480
            else 1440
          end
        )
      returning t.id, t.school_id, t.ticket_number, t.priority
    )
    insert into public.resa_technical_operations_events
      (school_id, ticket_id, actor_user_id, event_type, summary, details)
    select school_id, id, null, 'ticket_escalated',
      'Automatic SLA escalation: first response target was missed',
      jsonb_build_object('ticket_number', ticket_number, 'priority', priority, 'escalation_level', 1)
    from overdue;
  $job$
);
