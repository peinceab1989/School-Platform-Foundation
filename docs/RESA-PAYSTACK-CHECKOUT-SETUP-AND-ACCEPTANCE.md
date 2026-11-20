# RESA Paystack checkout — configuration and acceptance

## Implementation boundary

This change adds a parent-facing Paystack checkout path, a server-side payment initializer/verifier, signed webhook handling, a private payment-intent ledger, 30-minute checkout reservations, and atomic fee-payment/receipt settlement. The browser never receives a Paystack secret key. Existing cash, bank-transfer and POS Finance workflows remain separate and unchanged.

Paystack is **not active** until RESA completes merchant onboarding and supplies its own credentials. The code defaults to test mode and the parent portal displays “Coming soon · not activated” when the server reports that credentials are absent.

## Required Edge Function configuration

Deploy `supabase/functions/resa-paystack/index.ts` as the Supabase Edge Function `resa-paystack` with JWT verification **disabled at the gateway** because Paystack webhooks do not carry a Supabase JWT. The function independently validates the Supabase bearer token for the `status`, `initialize` and `verify` actions, and validates the Paystack signature for the webhook action.

Supabase's standard `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` runtime variables are used by the function. Configure these additional secrets through the Supabase Edge Function secrets interface:

- `PAYSTACK_SECRET_KEY`: start with the test key (`sk_test_...`) during acceptance. Never place this value in the browser, GitHub, source files or chat.
- `PAYSTACK_MODE`: set to `test` for the initial acceptance. Change to `live` only after successful test-mode sign-off and merchant approval.
- `PAYSTACK_WEBHOOK_SECRET`: the webhook signing secret from Paystack (`whsec_...`). Keep it server-side only.
- `RESA_APP_URL`: `https://school-platform-foundation.pages.dev` for the current Cloudflare Pages production hostname.

The webhook URL to enter in the Paystack test-mode dashboard is:

`https://mhwwzzxwpsqwhxrsuwaa.supabase.co/functions/v1/resa-paystack?action=webhook`

Subscribe to `charge.success`. The function verifies the signature on the raw request body, then independently calls Paystack's transaction verification endpoint before settlement. It accepts the modern timestamped `Paystack-Signature` header and the legacy `x-paystack-signature` header during migration.

## Database release

Apply `artifacts/school-platform/supabase/migrations/20261120190000_paystack_verified_fee_checkout.sql` only after review and backup. It creates a private RLS-enabled intent table and two service-role-only RPCs:

- `create_paystack_payment_intent` locks the fee assignment and reserves only the remaining unreserved balance for 30 minutes, preventing simultaneous checkout sessions from oversubscribing a fee.
- `record_verified_paystack_fee_payment` verifies the stored intent amount, currency and mode, creates the fee payment and official receipt in one transaction, updates the assignment balance, and is safe to replay after a successful settlement.

The migration does not modify existing fee assignments, payment rows, receipts, auth users or school records. It has **not** been applied to production by this source change.

## Acceptance test sequence — test mode only

1. Configure Paystack test credentials and the webhook signing secret in Supabase Edge Function secrets.
2. Deploy the function with `verify_jwt=false`; do not deploy live keys.
3. Apply the reviewed migration to an isolated test database first. Confirm RLS is enabled and no anon/authenticated grants exist on `paystack_payment_intents`.
4. Sign in as a linked parent whose fee assignment is explicitly enabled in `parent_fee_portal_views`.
5. Confirm the parent sees only linked children and authorised fee assignments.
6. Start a partial payment and complete Paystack's test checkout.
7. Confirm the callback and webhook both verify the same transaction; only one fee-payment row and one receipt are created.
8. Confirm the outstanding balance reduces by the verified amount and a retry returns the original receipt rather than creating a duplicate.
9. Attempt a payment exceeding the balance, a different parent's fee, a disabled fee view, a modified amount, an invalid signature, a wrong currency and a wrong test/live domain. All must be rejected without changing the ledger.
10. Start two concurrent checkout sessions for one fee and confirm the 30-minute reservations cannot exceed the remaining balance.
11. Test pending, abandoned and failed transactions. They must not issue receipts or reduce balances.
12. Reconcile the test transaction in Paystack Dashboard against the RESA payment reference and receipt.

## Production activation gate

Do not change `PAYSTACK_MODE` to `live` or add live credentials until the school confirms the legal merchant/business profile, settlement bank account, customer support details, transaction-fee handling and refund process; test-mode acceptance is signed; and the webhook endpoint is confirmed healthy. Paystack's fees and any bank/payment-channel charges must be disclosed and approved by the school before live checkout is enabled.

## Current limitation

This source implementation is not proof of a live payment. No merchant keys are present in the repository, and no production database migration, Edge Function deployment, Paystack dashboard change, charge or refund is performed by this PR.
