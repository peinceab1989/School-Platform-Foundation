# RESA Unified Communication Centre — implementation standard

## Product objective
Build one admin-governed communication platform for the whole school. Do not describe it as better than WhatsApp or Telegram until performance, reliability, security and device behaviour have been independently demonstrated.

## Preserve existing data
The implementation is additive. Never clear or reset existing conversations, school messages, group memberships, notification history, accounts or push subscriptions as part of a UI/configuration reset.

## User experience
- Personal notification controls for private messages, group messages, announcements, attendance, academics, results, fees, admissions, CBT, school activities and system alerts.
- Independent category enablement and sound selection, vibration, preview privacy, quiet hours, and a global notification switch.
- Sound library identifiers: RESA Signature Chime, Digital Ping, School Bell, Gentle Melody, Soft Tone, Crystal Drop, Classic Bell, Message Pop, Double Beep, Vibrant Ring, Alert Tone and Silent.
- In-app sound previews must be initiated by a user gesture. Never play sound merely because notification preferences were enabled.
- Show sent/delivered/read only when the corresponding state is actually confirmed. Do not equate database insert with recipient-device delivery.
- Support unread counts, searchable history, conversation mute, reconnect/resubscribe and retry-safe delivery.

## Administrator controls
- The school administrator governs global channel availability and role policy for private messages, group messages, announcements and Customer Care.
- Database restrictive RLS policies enforce the saved channel and role policy for school messages, direct/group chat conversation creation and chat message inserts; announcement visibility and publishing are also gated server-side.
- Personal preferences cannot enable a channel that the administrator has disabled.
- Student private messaging remains disabled by default; group messaging and Customer Care remain separately controlled.
- Voice/video calling remain disabled until a real-time calling provider, credentials, consent, abuse controls and device testing are configured.

## Delivery architecture
- Supabase Realtime is the foreground live-update path.
- Web Push is the background PWA path and depends on VAPID configuration, subscription validity, browser permission, OS settings, network and battery policy.
- Delivery workers must use authenticated server-side recipient resolution, category preferences, idempotency, bounded retries and invalid-subscription cleanup.
- Do not expose service-role credentials, VAPID private keys or provider secrets to the browser.
- A phone may suppress custom sound because of Android notification channel, DND, mute, volume or browser settings. Provide clear device-level guidance.

## Release gates
1. Migration applies on a staging copy and RLS/security review passes.
2. TypeScript and production build pass.
3. Tests cover preference filtering, role policy, group recipient resolution, duplicate events, retries and invalid subscriptions.
4. Test with at least two Android devices and a desktop browser: foreground, background, closed PWA, offline/reconnect, quiet hours and muted categories.
5. Verify admin policy is enforced server-side, not only by hiding controls.
6. Verify messages and existing records remain intact.
7. Deploy only after review and successful checks; report the deployed commit and actual test outcomes.


## Implemented first operational slice (26 November 2026)
- Personal notification settings are available in the existing Notifications page: master switch, phone push, category switches, category sound selection and in-page preview, vibration, preview privacy, and quiet-hours schedule.
- Foreground school messages, announcements and account/security alerts apply the same personal category, quiet-hours and privacy choices.
- Web Push dispatch enforces category opt-outs, quiet hours in Africa/Lagos, preview privacy, vibration and the Silent choice for non-attendance event categories.
- Parent attendance continues to use its dedicated guardian opt-in and event routing, separate from ordinary quiet-hour preferences.
- The seven foundational additive schema migrations were applied to the linked RESA Supabase project. The push dispatcher is live as version 12 after the CORS preflight correction; the same CORS handling is now recorded in source control.

## Explicit platform boundaries and remaining work
- Android/browser notification-channel settings determine actual background sound; a web page cannot guarantee a custom sound file or override device DND.
- Phone push opt-in is enforced separately from in-page notification sounds. Registering a device enables the phone-push preference; disabling it suppresses foreground OS notifications and server push without deleting the device subscription.
- Quiet hours are enforced for ordinary server-delivered push and foreground OS notifications; urgent attendance alerts bypass quiet hours. This does not override device-level Do Not Disturb.
- Admin global channel/role policy controls are available in Communication Centre settings. Database restrictive policies enforce private/group/Customer Care/announcement access for relevant writes; announcement reads are also role-gated. Student private messaging defaults to off. Administrators can still view drafts and unpublish announcements while publishing is paused.
- Voice/video calls require a configured signalling/media provider, TURN relay, consent flow, abuse controls and device testing; they remain unavailable until those dependencies are selected and verified.
- GitHub TypeScript, production build, Edge Function type-checks and notification routing tests passed on the earlier feature revision. The current follow-up revision is undergoing CI. Real Android multi-device, closed-app and sustained-delivery tests remain required before release. The owner has now confirmed that one test notification was displayed on the registered Android phone.

- Foreground incoming messages/announcements/account alerts also attempt the selected original RESA tone when in-app sound is enabled; browser autoplay policy can block this until the user interacts with the page.
- Notification tags are aligned between foreground and background delivery, and the service worker avoids re-sounding duplicate events.
- Parent attendance alerts honour the general Attendance category switch and sound/privacy/vibration settings, while retaining the dedicated parent-attendance opt-in; attendance bypasses ordinary quiet hours.


## Administrator policy enforcement update (26 November 2026)
- Added a SECURITY INVOKER policy-check function with a fixed search path and authenticated-only execution grants.
- Added restrictive database policies (ANDed with existing membership/conversation policies) for direct and group conversation creation, chat message inserts, legacy school message inserts, announcement publishing and announcement visibility.
- Updated the group-creation SECURITY DEFINER RPC to check the administrator's group channel setting before creating a conversation.
- Added Customer Care to the role matrix. Administrators can independently allow or deny private messages, group messages, announcements and Customer Care for teachers, parents and students.
- Verified policy evaluation with active admin, teacher and student membership contexts, including temporary policy overrides that were rolled back. Existing record counts remained unchanged during policy verification.
- Added a private-schema membership verifier for starting Customer Care chat. It checks the caller's active school membership and the recipient's active administrator membership without exposing the school membership directory through the public API. Student Customer Care chat also checks the existing student-messaging entitlement.
- Verified a parent-to-administrator Customer Care chat insert under the authenticated RLS role inside a transaction that was rolled back; no test conversation was retained.


## Final notification preference hardening and preview refresh (26 November 2026)
- Server-side push applies the global notification master switch to attendance events in addition to the dedicated guardian attendance opt-in and Attendance category preference.
- Direct and Customer Care chat pushes use the Private Messages preference; group chat pushes use Group Messages, with the category selected from the verified conversation record.
- Foreground OS notification handling loads the phone-push opt-in field and respects it independently of in-page sound.
- No separate Preview environment is part of the current release workflow. The feature branch remains isolated from the live production frontend; release acceptance must be performed against the agreed deployment path without asking the owner to repeat environment-variable setup.
- Latest CI passed for the notification hardening changes. Production frontend deployment remains gated on authenticated role and Android device acceptance tests.


## Contact directory and relationship-scoped messaging (26 November 2026)
- Direct messages, Customer Care and administrator-created group membership selection now use one server-authorised school contact directory.
- The next additive migration resolves a person's display name from the profile name first and the school's people record second; it returns a clear “name not set” state instead of silently labelling every account only as Teacher or Student.
- Contact visibility is administrator-controlled by sender-role and recipient-role policy. The server returns only active school members in categories the sender is allowed to contact; Customer Care is separately restricted to authorised school administrators.
- The contact-directory migration is committed to the feature branch but has not yet been applied to the live database. Its function definition and role-scoped lookup were smoke-tested inside a transaction and rolled back; active test contexts returned policy-filtered directories for all four roles (admin 19, parent 2, student 2 Customer Care administrators only, teacher 10). No production schema change was retained.
- The owner confirmed that the Android push test notification was displayed on the registered phone. This verifies one real-device test delivery; it does not yet establish multi-device, closed-app or sustained delivery reliability.

## Product quality roadmap — school-grade communications
The target is a school communication system that competes on clarity, speed, privacy and dependable delivery while retaining school-specific controls. Feature claims must be backed by working end-to-end tests.

### Reliability and delivery receipts
- Move high-value notification events toward a durable outbox/queue with idempotency keys, bounded exponential retries, dead-letter visibility and operator replay controls.
- Record separate states for queued, provider-accepted, device-delivery-confirmed where available, and read. Never label provider acceptance as device delivery.
- Add per-device health/last-seen information, invalid-subscription cleanup, dispatch latency/error dashboards and alerting for sustained failure.
- Preserve a user's category preferences, quiet hours and school administrator policy at the server boundary for every delivery channel.

### Conversation experience
- Keep direct messages, class groups, staff groups, parent–teacher conversations, Customer Care and official announcements in a consistent inbox.
- Add paginated searchable history, reply/thread context, reactions, pinning, mute controls, message editing/deletion policy, attachment previews and explicit read receipts.
- Retain realtime presence and typing indicators only where the conversation membership permits them; reconnect and resubscribe safely after network loss.
- Make contact names and roles consistent across direct-message and group-recipient selectors, using the authorised school directory rather than generic role-only labels.

### Multi-channel reach
- PWA/Web Push remains the current phone-alert channel. Native Android/iOS delivery, SMS, email and official WhatsApp Business delivery require separate supported providers, credentials, costs, consent and operational testing; none should be advertised as connected until verified.
- Voice/video calls require a real-time signalling/media provider, TURN relay, consent and moderation controls, and testing on real devices. Do not expose call controls until this is implemented.

### Security, privacy and operations
- Enforce school membership, class/guardian relationships, role permissions and administrator channel policies on the server and in RLS.
- Keep private notification previews optional; never expose private message contents to an unauthorised device or recipient.
- Add auditable administrator actions, abuse/report controls, attachment size/type restrictions and retention rules approved by school management.
- Test administrator, teacher, parent and student scenarios, including disabled channels, revoked memberships, stale subscriptions, duplicate events, offline/reconnect and multiple devices.

### Current release boundary
- The CORS correction is live in the RESA push-dispatch Edge Function version 12 and the owner has confirmed one successful Android test notification.
- The contact-directory improvement is committed to this feature branch with a migration for SQL review; it is not yet applied to production.
- The feature-branch frontend remains unmerged and has not replaced the live RESA frontend.
- No separate Preview environment is required or being requested for this work.

## Administrator-managed recipient routing and message deep links (26 November 2026)
- The compose flow now starts with a recipient-category selector: Administrators, Teachers & staff, Parents & guardians, and Students. A second selector displays named people only after the current sender role is authorised for that recipient category.
- If the administrator has not granted access to a recipient category or the channel itself is disabled, the interface explains that the user must contact the administrator. It does not reveal names from a disallowed category.
- The administrator's Communication Permissions panel now includes a sender-role × recipient-role matrix. Each role can be granted or denied private-message access to each recipient group independently.
- The default policy preserves conservative access: teacher → admin/student; parent → admin; student → admin/teacher (subject to the existing student private-messaging entitlement); administrators can manage all active members. The administrator can change these settings, for example to permit student-to-student or teacher-to-teacher communication.
- The database contact directory filters names using the same recipient policy. A SECURITY DEFINER helper with an empty search_path checks the active sender and recipient memberships, channel switch, sender-role permission and recipient-role matrix. Restrictive conversation/message INSERT policies prevent bypassing the UI. A separate Customer Care path checks Customer Care permission and only exposes administrators.
- A new permissive direct-chat policy allows administrator-approved role pairs beyond the former teacher/student assignment-only pattern, while the existing student-messaging entitlement remains an additional guard.
- Customer Care is now available inside RESA Chat, routes non-admin requests to an administrator support conversation, and is linked from Ask RESA and the Communication Centre. Customer Care is kept distinct from ordinary direct chats.
- The unified notifications inbox now displays sender names and opens the exact message or conversation. Chat deep links include the conversation and message IDs; the chat screen scrolls to the selected message. The legacy school-message inbox similarly opens and highlights the selected message.
- The portal-wide realtime listener now handles incoming RESA chat messages, verifies the current user's conversation/group membership, and presents sender-aware alerts with category preferences, sound, quiet hours, privacy and a deep link. Push notifications also include the sender's verified profile name and deep-link to the exact message.
- The service worker already routes notification taps to the URL carried by the notification payload; this work now supplies the conversation/message target for chat alerts.

### Recipient-policy validation
- The migration, helper and restrictive policies were applied only inside transactions for syntax, grants and role-scoped contact-directory smoke tests, then rolled back. The latest directory test returned 19 administrator contacts, 2 parent contacts, 2 student contacts (Customer Care administrators only because student private messaging is disabled by default), and 10 teacher contacts. No production schema changes were retained.
- Role matrix smoke tests confirmed the default Customer Care route to an administrator remains available for student, parent and teacher roles, while the student private-message channel remains closed until an administrator enables it.
- The feature branch has not been merged and these recipient-policy changes have not been applied to production.
