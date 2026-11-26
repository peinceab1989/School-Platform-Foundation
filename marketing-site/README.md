# JETAB TECH marketing website

A standalone, responsive static website for JETAB TECH Digital Solutions.

## Website contents
- `index.html` — company introduction, complete service catalogue, products, communities, project approach and WhatsApp enquiry form.
- `brochure.html` — printable RESA Digital Campus product overview.
- `favicon.svg` — JETAB TECH browser icon.
- `robots.txt` and `sitemap.xml` — basic search-engine discovery files.

## Cloudflare Pages deployment

This site is deployed separately from the RESA school portal.

Recommended settings for the dedicated `jetab-tech` Pages project:
- Production branch: `feature/jetab-tech-marketing-site`
- Root directory: leave blank
- Framework preset: `None` / `Static HTML`
- Build command: leave empty
- Build output directory: `marketing-site`

The public homepage is `https://jetab-tech.pages.dev/`; the product brochure is available at `/brochure.html`.

## Installable app (PWA)
The site includes a web app manifest, standalone display mode, install controls for browsers that expose the install prompt, iOS Add to Home Screen guidance, a service worker, an offline fallback page and a branded scalable app icon. It is served from the same HTTPS origin, so no app-store account or separate backend is required. The service worker caches the app shell and uses network-first navigation with an offline fallback. Browser install prompts vary by browser, device and installation eligibility; on iPhone/iPad, visitors use Safari's Share → Add to Home Screen flow.

## Enquiry form and privacy
The enquiry form validates the visitor's entries in the browser and prepares a WhatsApp message to +234 705 407 8988. It does not write enquiry data to a website database. Visitors review the prepared message and choose whether to send it.

## Content and service integrity
The website distinguishes commercial service areas from products and community/educational initiatives. It does not claim that every RESA or JETAB AI capability is production-ready, and it does not imply formal HSE certification. Availability, project scope, pricing and deliverables are confirmed during enquiry.

## Before launch verification
1. Confirm the WhatsApp number and company contact channels.
2. Add only approved portfolio images, testimonials and project screenshots.
3. Test all navigation links, service enquiry selections and WhatsApp form behaviour on mobile and desktop.
4. Review current product capabilities before making stronger feature claims.
5. Keep real student, parent and staff records off the public marketing website.
6. Keep the dedicated JETAB TECH Pages project separate from RESA's portal deployment and Supabase data.
