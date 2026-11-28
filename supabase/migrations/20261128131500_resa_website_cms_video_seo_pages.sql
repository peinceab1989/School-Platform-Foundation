-- Additive RESA website CMS expansion: video embeds and page SEO metadata.
-- Existing content, publication states, revision history and access policies remain intact.

alter table public.public_website_content
  add column if not exists video_url text,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.public_website_content
  drop constraint if exists public_website_content_video_url_https_check;

alter table public.public_website_content
  add constraint public_website_content_video_url_https_check
  check (video_url is null or video_url ~* '^https://');

-- Keep the existing 8 MB per-file cap to protect the free storage allowance.
-- Extend only the public website media bucket MIME allow-list; private school storage is untouched.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']::text[]
where id = 'resa-public-website-media';

comment on column public.public_website_content.video_url is
  'Optional HTTPS link to an approved public video (YouTube, Vimeo or direct MP4/WebM). Videos may be uploaded to the public website media bucket (8 MB maximum) or embedded from an approved HTTPS source; private school storage is not used.';
comment on column public.public_website_content.seo_title is
  'Optional search-result title for a public content page.';
comment on column public.public_website_content.seo_description is
  'Optional search-result description for a public content page.';

create or replace function public.get_resa_website_content_v2(
  p_content_type text default null,
  p_slug text default null
)
returns table(
  id uuid,
  content_type text,
  title text,
  slug text,
  summary text,
  body text,
  image_url text,
  image_alt text,
  video_url text,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    c.id,
    c.content_type,
    c.title,
    c.slug,
    c.summary,
    c.body,
    c.image_url,
    c.image_alt,
    c.video_url,
    c.seo_title,
    c.seo_description,
    c.published_at,
    c.sort_order
  from public.public_website_content as c
  where c.school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid
    and c.is_published = true
    and (c.published_at is null or c.published_at <= now())
    and (c.expires_at is null or c.expires_at > now())
    and (p_content_type is null or c.content_type = p_content_type)
    and (p_slug is null or c.slug = p_slug)
  order by c.sort_order, c.published_at desc nulls last;
$function$;

revoke all on function public.get_resa_website_content_v2(text, text) from public;
grant execute on function public.get_resa_website_content_v2(text, text) to anon, authenticated;

comment on function public.get_resa_website_content_v2(text, text) is
  'Public RESA website content endpoint. Returns only published, currently active content for the fixed RESA school; never returns drafts or unpublished rows.';
