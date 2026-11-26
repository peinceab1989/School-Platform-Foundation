-- Index the remaining RESA support reply foreign keys for school and author lookups.
create index if not exists resa_support_ticket_replies_author_user_id_idx
  on public.resa_support_ticket_replies(author_user_id);

create index if not exists resa_support_ticket_replies_school_id_idx
  on public.resa_support_ticket_replies(school_id);
