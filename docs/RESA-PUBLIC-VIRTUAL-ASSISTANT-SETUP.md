# RESA Public Virtual Assistant

## What this adds

- A public RESA assistant Edge Function at `resa-public-assistant`.
- The assistant uses OpenAI's Responses API from the server only. The browser never receives the provider key.
- School-specific answers are constrained to verified public facts in the function prompt. Unknown school policies, fees, deadlines, exam dates, and personal records must be referred to the school office.
- General educational and everyday questions can be answered when the AI provider is configured.
- The endpoint accepts only short text questions and a small recent conversation history. It does not read student records, admissions records, grades, attendance, messages, or private files.
- Requests are limited to 30 per IP-hash per UTC hour. Only a salted SHA-256 hash and hourly counter are stored; raw IP addresses and chat content are not written to the rate-limit table.
- OpenAI request storage is disabled with `store: false`.
- Public human-support handoff is via RESA's official WhatsApp number. The public Customer Care availability toggle controls the website invitation; this is not a native agent inbox.

## Required provider setup

The Edge Function requires an `OPENAI_API_KEY` Supabase Edge Function secret. No key is stored in this repository and no key is configured by this change. The function returns `AI_NOT_CONFIGURED` until the secret exists; the website continues to answer the curated RESA FAQ topics and shows the Customer Care WhatsApp contact.

Set the secret only after the school owner approves the provider and its usage charges. Use the Supabase Dashboard's Edge Function secrets page or the current Supabase CLI secrets workflow. Never put the key in a `VITE_*` variable, source code, GitHub file, browser storage, or chat message.

Optional `RESA_ASSISTANT_MODEL` defaults to `gpt-5.4-mini`. The function currently allowlists that model only. Do not change the allowlist without testing and reviewing expected API cost.

OpenAI's current developer guidance recommends the Responses API for new text-generation integrations:
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/guides/migrate-to-responses

## Database migration

`supabase/migrations/20261120170000_resa_public_assistant_rate_limit.sql` creates a private rate-limit table and a narrowly granted RPC. RLS is enabled; browser roles have no table access; only `service_role` can execute the rate-limit RPC. The migration is committed to the development branch but has **not** been applied to the live Supabase project.

Before deployment:
1. Complete and verify a fresh backup and recovery path for the live project.
2. Review the SQL and apply it to a disposable Supabase environment first.
3. Run security and performance advisors.
4. Deploy `resa-public-assistant` with JWT verification disabled only because it is a public website endpoint; retain the server-side rate limit and keep the service-role and OpenAI keys exclusively in Edge Function secrets.
5. Add the approved `OPENAI_API_KEY` secret only after confirming the account, spending limits, and budget.
6. Test the public FAQ fallback, AI answers, unknown school-policy questions, rate limiting, origin allowlist, and WhatsApp handoff.
7. Do not merge or deploy to production until the school owner approves the release.

## Public support boundary

The availability pop-up offers a direct WhatsApp handoff to +234 805 842 2691 when Customer Care is marked available. This is a live external channel, not a website-native agent inbox. A native public chat inbox with authenticated staff assignment, transcript retention controls, and moderation is a separate feature and should not be represented as already delivered.
