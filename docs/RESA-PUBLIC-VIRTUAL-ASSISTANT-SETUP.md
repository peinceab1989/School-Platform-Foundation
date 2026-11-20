# RESA Public Virtual Assistant — zero-cost operating mode

## Release decision

The public RESA assistant is designed to operate without a paid AI provider, API key, subscription, or per-message charge. The browser widget uses a reviewed knowledge base bundled with the website. It does not call OpenAI or another external generative-AI endpoint.

## Current capabilities

- Answers reviewed, common questions about RESA admissions, location, attendance, results, fees and payment verification, CBT, assignments, classes, parent and staff accounts, school communication, school services, study skills and digital safety.
- Provides links to relevant portal and public website sections.
- Displays the Customer Care invitation only when the existing public Customer Care status reports availability.
- Hands visitors to the school's existing WhatsApp channel and published email address.
- Gives an honest fallback when a question is not covered, rather than inventing school policy or claiming a human has answered.
- Does not read private student, parent, admission, grade, attendance, message or file records. It cannot change accounts or confirm payments.

## Zero-cost and privacy boundary

- No OpenAI API key or other provider secret is required.
- No paid AI endpoint is called by the public widget.
- No visitor question is sent to a generative-AI provider.
- Knowledge-base answers must be reviewed against current school-approved information before release.
- Do not add fees, deadlines, school policies, staff details, examination dates or other operational facts unless the school has verified them.
- Do not invite visitors to submit passwords, one-time codes, payment-card details, medical records or private student information.
- WhatsApp handoff opens the school's existing external WhatsApp channel. It is not a native website agent inbox and should not be described as one.

## How to extend the free knowledge base

1. Add a focused topic with plain-language keywords, a short approved answer and a relevant public route.
2. Check the answer against the school's current approved information.
3. Include safe guidance and a human contact route for topics that require confirmation.
4. Run the repository's TypeScript and production-build checks.
5. Test the widget on a narrow Android-sized viewport and desktop.
6. Confirm that a question with no matching topic produces the honest fallback and does not make a network request to an AI provider.

## Deferred features

Open-ended generative answers, native live-agent inbox, retained chat transcripts, WhatsApp Business API automation and paid third-party integrations are not part of this zero-cost release. They must not be activated or represented as available without separate technical review and explicit school approval.

## Release safeguards

No production database migration is needed for the local knowledge-base assistant. Preserve existing Supabase authentication, RLS, school data and Customer Care status logic. Do not merge or deploy this draft until the complete PR checks, backup/recovery safeguards and school acceptance tests pass and the school owner approves release.
