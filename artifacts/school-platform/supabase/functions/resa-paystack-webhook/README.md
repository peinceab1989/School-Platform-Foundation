# RESA Paystack webhook

Requires Supabase Edge Function secrets:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (provided/configured server-side only)
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET` (recommended modern signing secret; legacy X-Paystack-Signature fallback uses PAYSTACK_SECRET_KEY)

Configure the Paystack webhook URL to this function's public URL. Deploy with platform JWT verification disabled because Paystack cannot send a Supabase user JWT; this function independently verifies Paystack's signature before processing any event.

Only `charge.success` is processed. The function verifies the transaction directly with Paystack and checks reference, NGN currency, exact expected amount and success status before invoking the restricted database RPC.
