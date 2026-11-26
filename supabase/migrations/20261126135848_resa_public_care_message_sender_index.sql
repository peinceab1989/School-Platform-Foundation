create index if not exists resa_public_care_messages_sender_admin_id_idx
  on public.resa_public_care_messages(sender_admin_id)
  where sender_admin_id is not null;
