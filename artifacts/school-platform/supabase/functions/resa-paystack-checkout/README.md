# RESA Paystack checkout

Requires Supabase Edge Function secrets:
- `SUPABASE_URL` (provided by Supabase runtime)
- `SUPABASE_SERVICE_ROLE_KEY` (legacy service-role key; do not expose)
- `SUPABASE_ANON_KEY` (legacy anon key for JWT-aware user lookup)
- `PAYSTACK_SECRET_KEY` (test key first; live only after explicit approval)
- `RESA_PARENT_PAYMENT_CALLBACK_URL` (optional; defaults to the RESA parent dashboard)
- `RESA_ALLOWED_ORIGIN` (optional; defaults to the Cloudflare Pages production origin)

The function verifies the signed-in user, active parent account, active parent-child link, explicit parent fee visibility, outstanding balance, and enabled school gateway before it initializes a NGN transaction. It creates a pending intent only; no payment or receipt row is written.

Deploy with JWT verification enabled.
