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

## Paystack implementation status
The development branch now contains:
- resa-paystack-checkout: authenticated parent checkout initiation, parent-child and fee-visibility checks, server-calculated balance, NGN amount conversion and server-side Paystack initialization.
- resa-paystack-webhook: raw-body signature validation (modern timestamped Paystack-Signature and legacy x-paystack-signature), independent Paystack transaction verification and exact amount/currency/reference checks.
- record_gateway_verified_school_fee_payment: service-role-only atomic transaction that records the verified online payment, creates one existing RESA receipt and updates the fee assignment.
- Parent dashboard fee selector and Paystack checkout action.

Monnify and Flutterwave remain planned adapters; their provider-specific checkout and webhook implementations are not yet complete. They must not be presented as active providers.

## Current deployment gate
The migration and Edge Functions are committed to the feature branch only. They have not been applied or deployed to production. No Paystack credentials, webhook signing secret or merchant settlement account have been configured. The Paystack gateway setting remains disabled by default. Existing offline Finance verification remains the supported collection process until the complete test and onboarding gates are passed.
