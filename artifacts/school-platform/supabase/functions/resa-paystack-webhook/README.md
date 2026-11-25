# RESA Paystack webhook

Requires Supabase Edge Function secrets:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (provided/configured server-side only)
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET` (recommended modern signing secret; legacy X-Paystack-Signature fallback uses PAYSTACK_SECRET_KEY)
- `PAYSTACK_WEBHOOK_SECRETS` (optional JSON array of active `whsec_...` values during signing-secret rotation; keep the old and new secrets only for the provider's configured overlap period)

Configure the Paystack webhook URL to this function's public URL. Deploy with platform JWT verification disabled because Paystack cannot send a Supabase user JWT; this function independently verifies Paystack's signature before processing any event.

Only `charge.success` is processed. The function verifies the transaction directly with Paystack and checks reference, provider transaction ID, NGN currency, exact expected amount and success status before invoking the restricted database RPC. Temporary Paystack verification failures return HTTP 500 so Paystack can retry; a verified but mismatched transaction is quarantined for Finance review. Modern webhook signature validation supports multiple active signing secrets during rotation.
