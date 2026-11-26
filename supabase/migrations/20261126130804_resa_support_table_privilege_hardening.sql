-- Harden grants on RESA support tables against permissive project default privileges.
-- RLS does not protect against TRUNCATE, so keep table-level rights minimal.
revoke all privileges on table public.resa_support_tickets from anon, authenticated, public;
revoke all privileges on table public.resa_support_ticket_replies from anon, authenticated, public;

grant select, insert on table public.resa_support_tickets to authenticated;
grant select, insert on table public.resa_support_ticket_replies to authenticated;
grant update (priority,status,assigned_to,resolution_note,updated_at,resolved_at)
  on table public.resa_support_tickets to authenticated;
grant usage, select on sequence public.resa_support_tickets_ticket_number_seq to authenticated;
