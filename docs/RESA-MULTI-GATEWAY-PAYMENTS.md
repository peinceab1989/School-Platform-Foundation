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
The provider-neutral payment foundation and admission-form checkout schema are present in production. Admission-form online checkout remains disabled until the proprietor supplies sandbox credentials and the end-to-end payment verification/reconciliation tests pass. No Paystack credentials or webhook signing secret have been configured, and no live gateway has been activated. Existing offline Finance verification remains supported.



## Admission-form collection channels (27 November 2026)
- After the updated proprietor Edge Function and portal release are deployed, the proprietor can configure public-facing admission-form collection instructions from RESA Payment & Collection Settings: bank transfer, POS at the school, cash at the school office, and another approved manual channel.
- Only enabled payment-method rows are returned by the trusted public admission quote endpoint. The full account number is intentionally shown to prospective payers only for an enabled official school account; it is never placed in source code or a client-side constant.
- The planned public admissions release shows the current configured form fee (currently ₦10,000 NGN), applicant summary, and available payment options. If no manual option or verified online gateway is available, it explicitly directs the applicant to RESA Customer Care and warns against unofficial accounts.
- Manual transfers, POS and cash are not automatically verified. Applicants are instructed to retain their transaction reference and contact RESA. An authorised admissions officer must independently verify receipt before issuing a form number. The admin form-issuance workflow now requires the exact configured fee, a transaction reference and an explicit confirmation that the payment has been checked against the official bank/provider/cash record.
- Paystack online checkout remains separately gated by the proprietor-controlled gateway switch, credentials, webhook and successful provider verification. A generic external link or browser redirect is not payment proof.
- Migration version `20261127002908` (`20261127002908_resa_admission_payment_methods_20261127101500.sql`) has been applied to production as a new additive migration and is recorded in the Supabase migration history. It creates server-managed payment method configuration and an audit ledger. The existing historical migration reconciliation issue remains open for older entries.
