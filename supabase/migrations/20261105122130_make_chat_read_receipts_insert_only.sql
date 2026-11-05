revoke update on table public.resa_chat_message_reads from authenticated;
drop policy if exists "chat users update own receipts" on public.resa_chat_message_reads;