# JETAB TECH marketing website

This is a standalone, static promotional website for JETAB TECH and RESA Digital Campus.

## Files
- `index.html` — responsive marketing landing page.
- `brochure.html` — printable product overview. Visitors can use **Download / Save as PDF** in their browser's print dialog.

## Free Cloudflare Pages deployment
Create a **new** Cloudflare Pages project connected to this repository. Do not change the existing RESA portal project.

Recommended settings:
- Project name: `jetab-tech` (or another available name)
- Production branch: `feature/jetab-tech-marketing-site`
- Root directory: `marketing-site`
- Framework preset: `None` / `Static HTML`
- Build command: leave empty
- Build output directory: `.`

Cloudflare Pages should publish `index.html` from this directory. The brochure is available at `/brochure.html`.

## Before public launch
1. Confirm the WhatsApp number and contact wording.
2. Replace or supplement the illustrative dashboard graphic with approved screenshots from a safe demo environment.
3. Confirm each advertised capability in a guided product test. The page intentionally describes RESA as an evolving platform and does not claim every listed workflow is production-ready.
4. Do not add real student, parent or staff records to the public site.
5. Keep the current school portal and its Supabase data separate from the marketing site.
