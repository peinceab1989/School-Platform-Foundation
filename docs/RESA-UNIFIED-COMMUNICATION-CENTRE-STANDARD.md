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
- The school administrator governs global channel availability and role policy.
- Personal preferences cannot enable a channel that the administrator has disabled.
- Student direct messaging remains disabled by default in the policy until an administrator explicitly approves it.
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
- The additive schema was applied to the linked Supabase project and the push dispatcher was deployed as version 9.

## Explicit platform boundaries and remaining work
- Android/browser notification-channel settings determine actual background sound; a web page cannot guarantee a custom sound file or override device DND.
- Admin global channel/role policy fields are schema-only until all message and chat write paths enforce them server-side. Do not expose them as effective controls yet.
- Voice/video calls require a configured signaling/media provider and remain unavailable.
- Delivery testing on real Android devices and the current Cloudflare Pages build/checks must pass before merging.

- Foreground incoming messages/announcements/account alerts also attempt the selected original RESA tone when in-app sound is enabled; browser autoplay policy can block this until the user interacts with the page.
- Notification tags are aligned between foreground and background delivery, and the service worker avoids re-sounding duplicate events.
- Parent attendance alerts honour the general Attendance category switch and sound/privacy/vibration settings, while retaining the dedicated parent-attendance opt-in; attendance bypasses ordinary quiet hours.
