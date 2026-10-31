# RESA International — Public Website Management Review

**Review date:** 31 October 2026  
**Production website:** https://resa-school-portal.netlify.app/  
**Prepared for:** RESA School Management  
**Technical implementation:** JETAB TECH

## Executive summary

The public website is reachable and its main public routes respond. The portal entry is `/portal`. This review is a content and public-route inspection; it is not a substitute for a signed-in end-to-end test of student, parent, teacher, administrator, CBT, and results workflows.

## Corrections applied

- Replaced the old public school email with **rhemaexploitsacademy@gmail.com** in the About/Contact content, homepage contact card, public footer, and admission enquiry email target.
- Removed the unconfirmed “Established 9 September 2026” statement from the About page.
- Retained the current telephone and WhatsApp numbers pending management confirmation; the WhatsApp contact is different from the main school telephone number and should be explicitly approved.

## Management approval required

Please confirm the following before launch approval:

1. The official school telephone number and whether **0701 094 5774** is the approved school WhatsApp line.
2. Whether **0805 215 9511** is still the correct admissions contact.
3. Whether the published school hours, **7:00 AM–4:00 PM**, are accurate and apply on all school days.
4. The spelling, titles, and current roles of the Founder/Proprietor and Principal/Head of School as displayed on the About page.
5. The accuracy and wording of the school's vision, mission, and core values.
6. The admissions process, required documents, fees/payment instructions, and current availability. The website advises visitors to confirm fees and requirements directly before payment.
7. Permission to publish each photograph in the activities gallery. Replace illustrative or stock-style imagery with current, authentic school photographs where available.
8. Whether the school wants an official map pin and any additional social-media channels displayed.

## Technical observations and remaining tests

- Main public pages checked include Home, About, Academics, Admissions, Contact, Innovation & Technology, Practical Skills, Wisdom & Inspiration, Activities Gallery, and Portal.
- The configured portal entry is `/portal`; do not use `/login` as the advertised entry unless a dedicated route is added.
- Unauthenticated visits to protected destinations are expected to return to the portal sign-in experience. Authenticated role-by-role testing is still required.
- Confirm that a published exam appears to the correct enrolled students, that submitted CBT attempts appear in the administrator's examination results panel, and that transferred marks appear in the correct term broadsheet without overwriting approved/published results.
- Test admission enquiry email composition on Android and desktop. The website uses a mailto workflow, so successful delivery depends on the visitor having an email application configured.
- Test the public portal and all role dashboards on a small Android screen, tablet, and desktop.
- Do not advertise offline access until offline functionality has been implemented and verified.
- Verify Netlify has deployed the latest successful `main` build before declaring these source corrections live.

## Management decision

Please approve the factual school information and provide corrections to the items above. Any changes to leadership names/titles, school hours, phone/WhatsApp numbers, fees, or admission requirements should be made only after management confirms them.

**Recommendation:** The website is suitable for management review. Final public-launch approval should follow management confirmation and authenticated portal acceptance testing.
