-- RESA support and operations query performance hardening.
-- Additive indexes and policy expression optimization only.

create index if not exists resa_support_tickets_assigned_to_idx
  on public.resa_support_tickets(assigned_to)
  where assigned_to is not null;

create index if not exists resa_maintenance_schedules_asset_id_idx
  on public.resa_maintenance_schedules(asset_id)
  where asset_id is not null;

create index if not exists resa_maintenance_schedules_created_by_idx
  on public.resa_maintenance_schedules(created_by);

create index if not exists resa_technical_assets_created_by_idx
  on public.resa_technical_assets(created_by);

create index if not exists resa_technical_operations_events_actor_user_id_idx
  on public.resa_technical_operations_events(actor_user_id)
  where actor_user_id is not null;

drop policy if exists resa_support_ticket_read on public.resa_support_tickets;
create policy resa_support_ticket_read on public.resa_support_tickets
for select to authenticated
using (
  reporter_user_id = (select auth.uid())
  or exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_support_tickets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
);

drop policy if exists resa_support_ticket_create on public.resa_support_tickets;
create policy resa_support_ticket_create on public.resa_support_tickets
for insert to authenticated
with check (
  reporter_user_id = (select auth.uid())
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_support_tickets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
  )
);

drop policy if exists resa_support_ticket_admin_update on public.resa_support_tickets;
create policy resa_support_ticket_admin_update on public.resa_support_tickets
for update to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_support_tickets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = resa_support_tickets.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active' and sm.role = 'admin'
  )
  and (
    assigned_to is null
    or exists (
      select 1 from public.school_memberships assignee
      where assignee.school_id = resa_support_tickets.school_id
        and assignee.user_id = resa_support_tickets.assigned_to
        and assignee.status = 'active'
        and assignee.role in ('admin','teacher')
    )
  )
);

drop policy if exists resa_support_reply_read on public.resa_support_ticket_replies;
create policy resa_support_reply_read on public.resa_support_ticket_replies
for select to authenticated
using (
  exists (
    select 1 from public.resa_support_tickets t
    where t.id = resa_support_ticket_replies.ticket_id
      and t.school_id = resa_support_ticket_replies.school_id
      and (
        t.reporter_user_id = (select auth.uid())
        or exists (
          select 1 from public.school_memberships sm
          where sm.school_id = t.school_id
            and sm.user_id = (select auth.uid())
            and sm.status = 'active' and sm.role = 'admin'
        )
      )
  )
  and (
    not is_internal
    or exists (
      select 1 from public.school_memberships sm
      where sm.school_id = resa_support_ticket_replies.school_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active' and sm.role = 'admin'
    )
  )
);

drop policy if exists resa_support_reply_create on public.resa_support_ticket_replies;
create policy resa_support_reply_create on public.resa_support_ticket_replies
for insert to authenticated
with check (
  author_user_id = (select auth.uid())
  and is_internal = false
  and exists (
    select 1 from public.resa_support_tickets t
    where t.id = resa_support_ticket_replies.ticket_id
      and t.school_id = resa_support_ticket_replies.school_id
      and (
        t.reporter_user_id = (select auth.uid())
        or exists (
          select 1 from public.school_memberships sm
          where sm.school_id = t.school_id
            and sm.user_id = (select auth.uid())
            and sm.status = 'active' and sm.role = 'admin'
        )
      )
  )
);
