import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/public-site";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase/client";

type ManagedContent = {
  content_type: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  image_alt: string | null;
  video_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
};

function resolveVideo(rawUrl: string | null) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().startsWith("www.") ? url.hostname.toLowerCase().slice(4) : url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id ? { type: "embed" as const, src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) } : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = url.searchParams.get("v") || (parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : null);
      return id ? { type: "embed" as const, src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) } : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      const numeric = Boolean(id) && id!.split("").every((character) => character >= "0" && character <= "9");
      return numeric ? { type: "embed" as const, src: "https://player.vimeo.com/video/" + id } : null;
    }
    if (url.pathname.toLowerCase().endsWith(".mp4") || url.pathname.toLowerCase().endsWith(".webm")) return { type: "file" as const, src: url.toString() };
  } catch { return null; }
  return null;
}

export default function ManagedPublicPage({ slug, contentType = "page" }: { slug: string; contentType?: string | null }) {
  const [item, setItem] = useState<ManagedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setItem(null);
    setFailed(false);
    if (!hasSupabaseConfig) {
      setFailed(true);
      setLoading(false);
      return () => { active = false; };
    }
    void (async () => {
      try {
        const { data, error } = await (getSupabaseClient() as any).rpc("get_resa_website_content_v2", {
          p_content_type: contentType,
          p_slug: slug,
        });
        if (error) throw error;
        if (active) setItem((data?.[0] ?? null) as ManagedContent | null);
      } catch (error) {
        console.error("Unable to load managed RESA page:", error);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug, contentType]);

  useEffect(() => {
    if (!item) return;
    document.title = (item.seo_title || item.title) + " | RESA International";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = item.seo_description || item.summary || "Rhema Exploits Science Academy International.";
  }, [item]);

  const video = resolveVideo(item?.video_url ?? null);

  return (
    <PublicLayout>
      <main className="min-h-[60vh] bg-[#fbfaf5] px-5 py-12 sm:px-8 sm:py-16">
        <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[#e7e1d3] bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-600" role="status">Loading RESA page…</div>
          ) : !item ? (
            <div className="p-10 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">RESA website</p>
              <h1 className="mt-3 text-2xl font-extrabold text-[#215641]">{failed ? "This page is temporarily unavailable" : "Page not found"}</h1>
              <p className="mt-3 text-sm text-slate-600">The page may be unpublished, expired or the address may be incorrect.</p>
              <Link href="/" className="mt-6 inline-flex rounded-xl bg-[#245b40] px-5 py-3 text-sm font-bold text-white">Return to RESA home</Link>
            </div>
          ) : (
            <>
              {item.image_url && <img src={item.image_url} alt={item.image_alt || item.title} className="max-h-[460px] w-full object-cover" />}
              <div className="p-6 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#98782c]">{item.content_type === "page" ? "Rhema Exploits Science Academy International" : item.content_type.replace(/_/g, " ") + " • RESA"}</p>
                <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[#215641] sm:text-4xl">{item.title}</h1>
                {item.published_at && <time dateTime={item.published_at} className="mt-3 block text-xs text-slate-500">{new Date(item.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</time>}
                {item.summary && <p className="mt-6 text-lg leading-8 text-slate-600">{item.summary}</p>}
                {video && (video.type === "file"
                  ? <video className="mt-7 max-h-[520px] w-full rounded-2xl bg-black" controls preload="metadata" src={video.src}>Your browser does not support video playback.</video>
                  : <div className="mt-7 aspect-video overflow-hidden rounded-2xl bg-black"><iframe className="h-full w-full" src={video.src} title={item.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>)}
                {item.body && <div className="mt-7 whitespace-pre-wrap break-words text-base leading-8 text-slate-700">{item.body}</div>}
                <Link href="/" className="mt-9 inline-flex rounded-xl border border-[#245b40] px-4 py-3 text-sm font-bold text-[#245b40] hover:bg-[#f1f5ef]">Back to RESA home</Link>
              </div>
            </>
          )}
        </article>
      </main>
    </PublicLayout>
  );
}
