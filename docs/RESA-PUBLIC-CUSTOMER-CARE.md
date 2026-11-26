# RESA Public Ask RESA Customer Care

## Purpose

The public Ask RESA widget lets a parent, prospective family or other visitor contact the school without creating a portal account. This is a separate channel from authenticated student, parent, teacher and administrator conversations in the RESA Communication Centre.

## Visitor experience

1. A visitor opens Ask RESA on the school website.
2. During the configured availability window, the website may show a dismissible "Customer Care available now" prompt.
3. The visitor chooses a topic, enters a display name and first message, and may optionally provide an email address.
4. The widget stores a random browser conversation token locally. Only its SHA-256 hash is stored in Supabase.
5. The visitor can continue the conversation from the same browser. If the administrator closes the conversation, the visitor sees that state and can start a new conversation.

The widget does not request a portal password, school login or student record.

## Administrator experience

- The Chief Administrator can see all public visitor conversations.
- Other active administrators see only conversations assigned to them.
- Enquiries are routed server-side by duty: general, fees, admissions, CBT, results, attendance or technical.
- If a specific duty has no active assignment, the configured all-access assignment is used; the Chief Administrator is the final fallback.
- Administrators can read, reply, close and reopen conversations.
- Opening a conversation marks visitor messages as read. Closing it clears any outstanding unread visitor count.
- New visitor enquiries appear in the administrator notification centre under Customer Care.

## Availability defaults

- Timezone: `Africa/Lagos`
- Days: Monday to Friday
- Hours: 08:00–16:00
- The Chief Administrator can change the days, opening/closing times, website prompt and soft sound from the Customer Care controls in the Communication Centre.

The browser checks the public schedule view. It does not expose the Chief Administrator identity or assignment list.

## Abuse controls

Database-backed, atomic rate limits are applied per visitor IP/user-agent fingerprint:
- Conversation starts: 5 per hour
- Visitor messages: 20 per 10 minutes
- Polls: 120 per 10 minutes

Requests are validated and text is length-limited by the Edge Function. The browser cannot directly read or write visitor conversation, message or rate-limit tables.

## Security boundaries

- `resa-public-customer-care` is deployed with platform JWT verification disabled so anonymous visitors can start chats.
- Every administrator action validates the bearer token and checks for an active RESA administrator membership inside the Edge Function.
- Visitor conversation, message and rate-limit tables have RLS enabled, explicit deny policies for anon/authenticated roles, and service-role-only access.
- Anonymous clients can read only the approved public availability fields through `resa_customer_care_public_availability`.
- Customer Care assignment changes are protected by Chief Administrator RLS policies.
- Schedule updates use column-level grants; the Chief Administrator identity is not editable through the schedule UI.
- The public visitor chat does not read or write authenticated private/group conversation records.

## Delivery expectations

Conversation updates use Realtime broadcast as the fast path, with secure polling as a recovery fallback while the visitor or administrator inbox is open. The school-wide admin refresh channel is private and permits only active RESA administrators; it carries only a generic refresh signal, not visitor identity, message text or conversation IDs. This is foreground chat delivery, not a claim of native WhatsApp/Telegram background push or email/WhatsApp delivery. Administrator unread counts are surfaced in the portal notification centre.

## Deployment

- Edge Function: `resa-public-customer-care`
- Supabase config: `[functions.resa-public-customer-care]` with `verify_jwt = false`
- The function performs its own administrator authentication.
- Allowed website origins are maintained in the Edge Function allowlist.
- The RESA school portal and Jetab Tech Cloudflare Pages projects build from the repository.

## Operational checks

- Confirm the public availability view returns only schedule fields to the anonymous role.
- Confirm anonymous users cannot read the Chief Administrator ID or assignment table and cannot write to settings.
- Confirm a visitor message increments `unread_visitor_count`.
- Confirm opening or closing a conversation clears the unread count.
- Confirm a non-assigned administrator cannot open another administrator's conversation.
- Confirm the Chief Administrator can review all school visitor enquiries.
- Confirm rate limits block requests beyond their configured threshold.
- Confirm the private school-wide broadcast refresh channel is visible only to active RESA administrators.

## Current scope limitation

Customer Care duties route visitor enquiries among existing active administrators. This feature does not create new administrator accounts or grant fine-grained module permissions across the entire portal. Administrator invitations and per-module authorization must be designed and reviewed separately before limited-duty accounts are granted portal administrator roles.
