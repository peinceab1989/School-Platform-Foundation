# RESA public website content manager — administrator guide

## Where to open it

1. Sign in to the RESA School Portal with an active school administrator account.
2. Open **Publication Centre**.
3. Select **Website & public content** → **Open website manager**.
4. The direct route is `/website-manager` on the canonical portal: https://school-platform-foundation.pages.dev/website-manager

Website publishing is restricted to active RESA administrators. An administrator who also has a teacher role remains eligible. Public visitors and ordinary staff cannot open the manager or write website records.

## What administrators can publish

| Content type | Purpose | Public presentation |
| --- | --- | --- |
| News | School news, achievements and updates | Homepage content card and full detail page |
| Announcement | Public notices and important updates | Homepage content card and full detail page |
| Event | Upcoming or past school events | Homepage content card and full detail page |
| Admissions | Public admissions notices | Homepage content card and full detail page |
| Gallery | Approved school photos and video highlights | Homepage card and Activities & Gallery page |
| Managed page | School information and standalone pages | Existing page override or a new public page |

## Safe publishing workflow

1. Select **New content**, choose the content type and enter a clear title.
2. Review the generated slug. Keep it unique and use lowercase words separated by hyphens.
3. Add a short summary and the main public text. The editor treats the main text as plain text; do not paste HTML, scripts or private records.
4. Add an optional featured image or video. Check the preview shown below the editor.
5. Save as a draft first. Drafts are not visible to public visitors.
6. When the content has been approved for public release, use **Publish / Schedule**. You may set a future publication time and an optional expiry time.
7. Use the content library to edit, unpublish, or restore an earlier revision. Unpublishing hides the item but does not delete it.

## Managed pages and page slugs

Choose **Managed page** to replace an existing static school page or add a new page. These exact slugs override the corresponding existing public pages only after the CMS record is published:

- `home`
- `about`
- `academics`
- `admissions`
- `contact`
- `activities-gallery`
- `innovation-technology`
- `practical-skills`
- `wisdom-inspiration`

A different slug creates a new page at `/pages/<slug>`. Published news, announcements, events, admissions notices and gallery items have full detail pages at `/updates/<slug>`.

The existing static school page remains the fallback if there is no active published managed-page record or the public CMS endpoint is unavailable. Do not publish a replacement until its content has been checked.

## Media limits and privacy

- Images: JPG/JPEG, PNG, WebP or GIF; maximum 8 MB per file.
- Uploaded video: MP4 or WebM; maximum 8 MB per file.
- Video links: HTTPS YouTube, Vimeo or direct MP4/WebM links.
- Uploaded media is stored in the public RESA website media bucket. Anyone who visits the public website may view published media.
- Upload only school-approved media. Do not upload student records, identity documents, medical information, private contact details, confidential staff files or private School Drive documents.
- Obtain the necessary parent/guardian or staff permissions before publishing identifiable photographs or recordings of people.

## Search appearance

Managed content can include an optional SEO title and SEO description. Leave these blank to use the page title and summary. Keep titles accurate and descriptions concise; do not stuff keywords or include private information.

## Current publishing state

The CMS has been deployed with the additive database changes, public published-only read endpoint, role-scoped editing permissions, revision history, image/video media support and managed-page routes. Existing static pages remain available. No content is auto-created or auto-published: administrators must add and approve the school's actual news, events, photographs, videos and page copy before those items appear publicly.
