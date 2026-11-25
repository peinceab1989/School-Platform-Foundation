# RESA Paystack test and production acceptance plan

## Preconditions
- Use Paystack test credentials and test webhook signing secret stored only in Supabase Edge Function Secrets.
- Apply the payment-foundation migration to an isolated Supabase test project before deploying either function.
- Create a test gateway settings row with provider paystack, environment test, and is_enabled = true; never enable production/live mode from this test.
- Configure the Paystack test webhook to the deployed resa-paystack-webhook endpoint.
- Use a dedicated test parent, test learner and test fee assignment only.

## Required positive tests
1. A signed-in parent with an active parent-child link and explicit fee visibility can initialize checkout for the exact outstanding NGN balance.
2. Paystack test checkout completes and the webhook signature is accepted.
3. The backend independently verifies the reference, successful status, NGN currency and exact amount in kobo.
4. Exactly one row is added to student_fee_payments, exactly one receipt is added to student_payment_receipts, and the fee assignment balance/status updates correctly.
5. Re-delivering the same webhook does not create a second payment or receipt.
6. A partial balance is represented correctly if a prior verified offline payment exists.

## Required negative/security tests
1. Unauthenticated caller, non-parent, inactive parent link and parent without fee visibility are denied.
2. Unknown/forged reference, bad signature, stale modern signature timestamp, wrong provider transaction ID, non-success status, wrong currency and wrong amount are rejected.
3. Modern signature rotation accepts any valid signature matching an active configured signing secret; invalid signatures remain rejected.
4. Temporary provider verification failures return a retryable error and do not permanently fail the payment intent.
3. An expired checkout window cannot authorize a new checkout; a genuinely successful provider transaction whose webhook arrives after expiry is still reconciled exactly once.
4. Concurrent successful intents for the same remaining balance cannot overpay the fee assignment.
5. Browser callback or a fabricated client-side success response cannot issue a receipt.
6. Existing cash, POS and bank-transfer Finance recording remains unchanged.
7. A service-role-only receipt RPC call from anon/authenticated JWT is denied.

## Rollout
- Run repository build/type checks and review all CI/deployment checks.
- Complete test cases above and retain sanitized evidence (never credentials or raw card data).
- Obtain proprietor approval of the verified merchant account and settlement destination.
- Only then plan live credentials, live webhook signing secret, explicit live-mode activation and production smoke test.
- If any test fails, keep the provider disabled. Do not create receipts manually to simulate online success.