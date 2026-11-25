# RESA Multi-Gateway Payments — Implementation Notes

## Provider strategy
RESA is being prepared for Paystack, Monnify and Flutterwave behind a provider-neutral payment-intent model. Existing direct bank transfer, POS and cash Finance workflows remain unchanged.

## Settlement model
The gateway processes a parent payment; the provider settles funds according to its verified merchant onboarding and settlement rules. The proprietor's preferred account can be considered only where the selected provider accepts and verifies that account. RESA must not promise settlement to an unrelated personal account or bypass provider KYC.

## Security boundaries
- Provider credentials and webhook signing secrets must be stored only as Supabase Edge Function secrets.
- Never put API keys, secret keys, webhook secrets, or full settlement account numbers in browser code, Git, ordinary database rows, logs, or school settings.
- Pending online attempts belong in `student_fee_payment_intents`; they are not verified payments.
- A browser redirect is not payment proof.
- Before a receipt is issued, a trusted backend must verify provider signature and transaction status, exact NGN amount, currency, provider reference and transaction ID, then atomically write the existing verified payment and receipt records.
- Webhook retries must be idempotent. Duplicate provider event IDs and references must not create duplicate receipts.
- Provider configuration is disabled by default. Live activation requires a verified merchant account, settlement destination, successful test-mode journey and explicit school approval.

## Migration
`20261125163000_multi_gateway_payment_foundation.sql` adds only provider metadata, pending payment intents and minimal webhook idempotency records. It does not alter or backfill existing fee/payment/receipt records, and it does not enable checkout.

## Current deployment gate
No provider is active until provider-specific Edge Functions, signed webhook verification, integration tests, secure Edge Function secrets and proprietor onboarding are complete. Existing offline Finance verification remains the supported collection process.
