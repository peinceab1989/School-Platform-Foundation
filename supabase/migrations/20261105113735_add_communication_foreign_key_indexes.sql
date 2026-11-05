create index if not exists resa_chat_conversations_created_by_idx
  on public.resa_chat_conversations (created_by);
create index if not exists resa_chat_conversations_participant_one_idx
  on public.resa_chat_conversations (participant_one);
create index if not exists resa_chat_conversations_participant_two_idx
  on public.resa_chat_conversations (participant_two);
create index if not exists resa_chat_conversations_class_idx
  on public.resa_chat_conversations (class_id);
create index if not exists resa_chat_group_members_school_idx
  on public.resa_chat_group_members (school_id);
create index if not exists resa_chat_group_members_added_by_idx
  on public.resa_chat_group_members (added_by);
create index if not exists resa_chat_messages_school_idx
  on public.resa_chat_messages (school_id);
create index if not exists resa_chat_messages_sender_idx
  on public.resa_chat_messages (sender_id);
create index if not exists resa_chat_settings_updated_by_idx
  on public.resa_chat_settings (updated_by);
create index if not exists resa_chat_message_reads_user_idx
  on public.resa_chat_message_reads (user_id);