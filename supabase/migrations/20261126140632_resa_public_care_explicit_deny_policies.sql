-- Explicit deny policies document that public visitor records are never
-- directly accessible to browser roles. The Edge Function uses service_role.
drop policy if exists resa_public_care_deny_client_access on public.resa_public_care_conversations;
create policy resa_public_care_deny_client_access on public.resa_public_care_conversations
for all to anon, authenticated using (false) with check (false);
drop policy if exists resa_public_care_deny_client_access on public.resa_public_care_messages;
create policy resa_public_care_deny_client_access on public.resa_public_care_messages
for all to anon, authenticated using (false) with check (false);
drop policy if exists resa_public_care_deny_client_access on public.resa_public_care_rate_limits;
create policy resa_public_care_deny_client_access on public.resa_public_care_rate_limits
for all to anon, authenticated using (false) with check (false);
