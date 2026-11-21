# RESA Parent Fee Payment Authorisation & Clearance

## Product decision

Introduce a RESA Payment Clearance ID (PCID). It is a school-issued, opaque reference linked in the database to one parent/guardian, one learner, and one specific fee assignment. It is not a Paystack transaction reference, bank RRR, password, or substitute for parent sign-in. The parent must be authenticated and the parent-to-learner relationship must still be active.

## Required workflow

1. An authorised RESA administrator/Finance officer selects the learner, linked parent/guardian, and fee assignment.
2. The administrator approves payment and chooses the permitted amount (default: current outstanding balance), whether instalments are allowed, and optional expiry.
3. The server generates a cryptographically random, non-sequential PCID, stores only a safe representation/hash where practical, and records approver, timestamp, scope, amount cap, and status.
4. The parent dashboard displays the PCID, learner, fee description, authorised amount, expiry, and Active/Revoked/Paid status.
5. Every payment initiation checks on the server that the PCID is active, unexpired, not exhausted, scoped to the exact school/learner/fee assignment, and belongs to the signed-in parent account through the current active guardian and student links.
6. Paystack success is accepted only after server-to-server verification and an atomic database settlement. A browser redirect or screenshot never counts as payment.
7. Finance records for cash, POS, and bank transfer also require an active PCID and verified funds before an official payment/receipt is recorded. Offline evidence remains pending until Finance confirms funds.
8. On settlement, the parent balance, fee assignment status, receipt, payment ledger and admin financial summaries update from the same committed transaction. The PCID remains active for permitted instalments until the authorised amount is exhausted or the balance is cleared; then it becomes completed.
9. Admin can revoke/deactivate a PCID at any time. Revocation blocks new checkout attempts immediately. Already-confirmed provider payments must still be reconciled; revocation must never erase a completed payment.
10. Every approval, amendment, revocation, payment, failed attempt, reconciliation and exception is audit logged with actor and timestamp.

## Administrator controls

- Payment authorisation queue and search by parent, learner, admission number, fee, term/session, and PCID.
- Activate, deactivate/revoke, expire, and reissue PCIDs.
- Set authorised amount (never above the current outstanding balance), allow/disallow instalments, and optional expiry.
- See amount authorised, amount paid against the PCID, remaining authorised amount, and outstanding fee balance.
- View pending, verified, failed, duplicate, refunded, disputed and Finance-review transactions.
- Any exceptional Finance override must be a separate, explicitly permissioned and audited action; it must not silently bypass the clearance gate.

## Parent dashboard

- Show only clearances linked to that signed-in parent's active guardian account and active learner links.
- Display the PCID, learner, fee type, term/session, approved amount, amount paid, remaining amount, expiry and status.
- Block payment and explain why when no active clearance exists, it has expired, has been revoked, is fully used, or the parent's link is inactive.
- Show the same PCID against payment history and official receipts.

## Data and security requirements

- Use the existing parents_guardians, parent_portal_accounts, parent_student_portal_access, student_parent_guardians, student_fee_assignments, student_fee_payments, and student_payment_receipts relationships; do not create duplicate parent/student identities.
- Add a dedicated authorisation table and append-only audit events. Keep the authorisation ledger private with RLS enabled; never expose it directly to anon clients.
- Perform authorization and settlement checks server-side. The frontend PCID is a display/input reference only and cannot grant access by itself.
- Enforce school, parent, student and fee-assignment scope on every operation. Do not trust user metadata or client-supplied parent/student IDs.
- Enforce amount caps, concurrency-safe reservations, idempotency and unique provider transaction IDs.
- Keep Paystack secrets server-side. Validate signed webhooks and independently verify transactions with Paystack before writing a payment or receipt.
- Preserve existing fee assignments, payments, receipts, historical records and offline workflows. Do not rewrite historical payment rows.
- A payment already confirmed by Paystack must be reconciled even if an administrator revokes the PCID after checkout began; no new checkout may begin after revocation. Expiry/revocation policy for an in-flight transaction must be explicit and audited.

## Acceptance tests (must pass before production)

- Unapproved parent cannot start Paystack checkout or submit an offline payment for recording.
- Wrong parent, wrong learner, wrong school, wrong fee assignment, revoked/expired/completed PCID are rejected server-side.
- Active approved parent can pay; amount above remaining authorisation or fee balance is rejected.
- Partial payments work and update both parent and admin views.
- Duplicate webhook/verify calls create exactly one payment and one receipt.
- A forged browser redirect, screenshot, invalid webhook signature, wrong currency/mode/amount or reused provider transaction creates no payment.
- Concurrent checkouts cannot over-collect.
- Revocation blocks subsequent checkout attempts and is visible on the parent dashboard.
- Cash/POS/bank transfer remain pending until Finance verification and require the same PCID.
- Existing historical payments, receipts, fee balances and linked parent records remain unchanged.
- Admin audit log records every approval, revocation and adjustment.

## Current implementation gap found

The existing Paystack checkout work (PR #123) verifies that the signed-in parent account is linked to the selected learner, but it does not yet require a school-issued, administrator-approved PCID. The new authorisation gate must be added to the Paystack initializer and settlement path and to Finance's offline payment-recording path before checkout is enabled. PR #123 is still a draft and is not deployed; no production schema or payment records were changed for this specification.