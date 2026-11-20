# RESA School Observations — Approved Implementation Specification

**Date captured:** 20 November 2026  
**Source:** School review notes supplied by RESA and the user's explicit confirmations in ChatGPT.  
**Repository:** `peinceab1989/School-Platform-Foundation`  
**Status:** Approved requirements; implementation and school acceptance are tracked separately.

This document translates the school's observations into implementation requirements. It does not claim that unimplemented features are already live.

## 1. Confirmed decisions

| Topic | Confirmed requirement |
|---|---|
| Payment provider | Paystack |
| Payment methods | Both online payment and the existing offline/manual school payment route must remain available |
| Online receipts | Generate an official receipt only after server-side verification confirms successful payment |
| CAT terminology | CAT 1 and CAT 2 mean Continuous Assessment Test 1 and Continuous Assessment Test 2 |
| Class catalogue | Retain the existing classes; authorised administrators must be able to edit them |
| Admissions email | `resainternational2024@gmail.com` |
| Data/architecture | Preserve existing data and architecture; no reset, destructive migration or replacement platform |

## 2. Fees and online payments

### Required experience
1. Parents/guardians can view the correct learner's fee items, amount due, payments and balance.
2. Provide both:
   - Online checkout through Paystack.
   - Existing offline/manual payment instructions and Finance verification.
3. Display a clear pending state until payment is verified.
4. Generate an official receipt only after server-side verification.
5. Prevent duplicate payment records and duplicate receipts when a browser retries or a webhook is delivered more than once.
6. Provide a transaction/reference history to authorised Finance staff.

### Paystack implementation requirements
- Keep secret keys exclusively in server-side Supabase Edge Function secrets. Never expose them in Vite/client variables, source control, logs or browser responses.
- Initialise transactions server-side with a unique reference, the expected amount in the smallest currency unit, NGN, the correct learner/fee assignment and an authenticated user context.
- Redirect/return from checkout is not proof of payment. Verify the transaction with Paystack server-to-server and validate reference, amount, currency, status and expected metadata against the pending RESA payment.
- Verify Paystack webhook signatures using the documented signature scheme and the raw request body. Reject invalid signatures and unexpected event/reference combinations.
- Make webhook processing idempotent. A repeated event must not create a second payment or receipt.
- Reconcile pending, successful, abandoned, failed and reversed/refunded transactions. Never silently mark a pending payment as paid.
- Keep Paystack sandbox/test mode separate from production mode. Run controlled tests before enabling live keys.
- Retain offline payment as an independent route; do not require parents to use online checkout.
- No live collection until the school supplies/authorises Paystack merchant onboarding and credentials, confirms fee amounts and approves the sandbox evidence.

## 3. Classes, subjects and student records

### Class catalogue
- Keep the current class records and their IDs.
- Authorised school administrators can edit class names and academic levels in place.
- Validate empty names and duplicate names within the school.
- Preserve class IDs and all existing enrolment, attendance, CBT, assessment and result references.
- Do not automatically rename historical class records or delete classes as part of the edit feature.
- Confirm the existing class range and labels with the school before any bulk naming/level changes.

### Student gender
- Student registration and editing should offer Male and Female only, consistent with the school's note.
- Validate the value at save time, not only in the browser.
- Do not rewrite existing historical values automatically; identify and report any legacy value requiring an authorised correction.

### Subject catalogue
- Authorised administrators can edit subject names and codes in place.
- Preserve subject IDs and class assignments, result and assessment references.
- Do not offer destructive deletion where historical records depend on the subject.

## 4. CAT 1 and CAT 2 assessments

- Label CAT 1 and CAT 2 clearly as Continuous Assessment Test 1 and Continuous Assessment Test 2 in the assessment and result interfaces.
- Keep CAT 1, CAT 2 and examination marks distinct in storage and calculation.
- Use the existing assessment/results architecture; do not introduce a parallel gradebook.
- Before implementing calculations or changing report-card totals, obtain written school confirmation of each component's maximum mark, weighting, rounding rule, missing-score treatment and publication workflow.
- Test with synthetic learners and verify that previously published results remain unchanged.
- Do not assume that each CAT is out of 20 or that the two CATs have equal weight without school approval.

## 5. Admissions workflow

### Contact
- Show `resainternational2024@gmail.com` as the confirmed admissions email in the appropriate public and admissions contact locations.
- Do not replace the school's other official contact details unless authorised.

### Payment and application
- Support both online Paystack payment and the existing offline/manual payment route for admission/form fees.
- Keep form/application status pending until the chosen payment route is verified.
- After successful verification, issue or expose the candidate's unique registration/application code.
- Provide a secure online status/result-checking route using the registration code plus an appropriate second verification factor; do not expose applicant results through a guessable sequential ID or email-only lookup.
- Prevent duplicate form redemption and duplicate applications for the same purchase.
- Ensure candidate account creation and application submission are recoverable if one step fails.

### Required applicant documents
Provide secure applicant upload fields for:
- Medical report.
- Birth certificate.
- Previous school result(s).

Requirements:
- Restrict file types and sizes; validate server-side.
- Store documents in private storage, not public buckets.
- Enforce applicant/authorised admissions staff access and school-level isolation.
- Display upload status and allow authorised replacement where policy permits.
- Keep document review status (received, pending review, accepted, rejected/replace requested) and audit changes.
- Do not make sensitive applicant documents public through a registration code or result-check page.

## 6. School identity and public website

- Update public-facing school-name wording from “RESA” to “Rhema” where the full school identity requires it; retain RESA where it is the approved portal/product abbreviation or brand mark. Confirm the final exact public display name with school management before a global text replacement.
- Use the approved current school logo/crest consistently in the public website, portal sign-in, receipts and school documents.
- Provide a photo section for the Director and Principal.
- Provide a slideshow/gallery for approved school photographs.
- Optimise image dimensions and file sizes for mobile performance; use accessible captions/alt text and controls.
- Obtain school approval and appropriate consent before publishing identifiable staff/student photographs.
- Keep image uploads restricted to authorised content managers and store originals safely.

## 7. Cross-cutting quality and security

- Preserve Supabase Auth, RLS, existing records, IDs and application architecture.
- Every new database read/write must be school-scoped and authorised server-side.
- Keep audit history for financial, admission, academic and identity changes.
- Add clear loading, empty, pending, success and actionable error states.
- Ensure mobile-first layouts and accessible labels, focus states and keyboard operation.
- Test role boundaries for administrator, admissions, Finance, teacher, student and parent.
- Use synthetic test identities and amounts; do not test by altering real student or payment records.
- Do not expose secrets, private documents, answer keys or other learners' records.

## 8. Delivery and acceptance gates

| Workstream | Evidence required before acceptance |
|---|---|
| Classes/subjects | CI green; admin edits existing row; linked enrolment, attendance, CBT and historical result views remain correct |
| Gender | Registration/edit validation; legacy values audited without automatic rewrite |
| CAT 1/CAT 2 | School-approved mark/weighting specification; calculation tests; no historical result regression |
| Paystack | Sandbox initialization, valid/invalid webhook, duplicate webhook, amount/reference mismatch, pending/failure/refund/reconciliation tests |
| Offline payments | Finance verification and one-receipt/idempotency test |
| Admissions | Both payment routes, secure documents, unique code, online status check, duplicate/concurrency and rejection tests |
| Website identity | Approved name/logo and image assets; mobile and accessibility review |
| Photo gallery | Consent/approval, private upload controls, authorised publishing, mobile slideshow and performance checks |
| Recovery | Complete DB/Auth/Storage/source backup, checksums and isolated restore rehearsal |
| Handover | Role-based school training, issue log and signed acceptance |

## 9. Explicit exclusions until separately approved

- No destructive reset or cleanup of production data.
- No automatic bulk class rename or historical record rewrite.
- No automatic CAT mark weighting.
- No live Paystack activation before merchant credentials, sandbox tests and school approval.
- No public exposure of medical reports, birth certificates or previous results.
- No publication of identifiable photographs without school approval/consent.
- No claim of completed end-to-end acceptance based solely on source changes or CI.

