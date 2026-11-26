import { useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, MapPin, Navigation, Search, Sparkles } from "lucide-react";

const SCHOOL_NAME = "RHEMA EXPLOITS SCIENCE ACADEMY INT’L";
const SCHOOL_ADDRESS = "1 Smiling George Way, Behind Mat Ice, Opposite Winners’ Chapel, Sapele Road, Benin City, Edo State, Nigeria.";
const SCHOOL_MAP_QUERY = `${SCHOOL_NAME}, ${SCHOOL_ADDRESS}`;

function mapsSearchUrl(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}
function directionsUrl(destination: string, origin: string) {
  const params = new URLSearchParams({ api: "1", destination });
  if (origin.trim()) params.set("origin", origin.trim());
  params.set("travelmode", "driving");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function ResaMapsExplorerPage() {
  // Start with the school as the map destination so its pin and nearby map labels
  // are visible immediately, without requiring the visitor to search first.
  const [destination, setDestination] = useState(SCHOOL_MAP_QUERY);
  const [searchInput, setSearchInput] = useState("");
  const [origin, setOrigin] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const mapSrc = useMemo(() => {
    const zoom = destination === SCHOOL_MAP_QUERY ? 16 : 14;
    return `https://www.google.com/maps?q=${encodeURIComponent(destination || SCHOOL_MAP_QUERY)}&z=${zoom}&output=embed`;
  }, [destination]);

  function searchPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchInput.trim();
    if (query) setDestination(query);
  }

  function showSchoolAndNearbyPlaces() {
    setDestination(SCHOOL_MAP_QUERY);
    setSearchInput("");
  }

  function ask() {
    const q = question.trim().toLowerCase();
    if (!q) return;
    if (/resa|school|academy|address|located|location|find us/.test(q)) {
      setAnswer(`${SCHOOL_NAME} is located at ${SCHOOL_ADDRESS} The map opens centred on the school's address, with nearby Google Maps place labels where available. For turn-by-turn navigation, use the Directions button and confirm the route in Google Maps before travelling.`);
    } else if (/direction|route|how do i get|navigate|distance|time|travel/.test(q)) {
      setAnswer("Enter your starting point in the directions field and select Get directions. Google Maps will calculate the route and current estimated journey time. Traffic, road closures and GPS accuracy can change the result, so follow the live navigation instructions.");
    } else {
      setAnswer("I can currently provide verified school address information and help you open map search and directions. I don't yet have a connected live place-information AI service, so I won't guess facts about other places. Search the destination on the map or open Google Maps for current place details.");
    }
  }

  return <main className="min-h-screen bg-[#f6f7f2] px-4 py-7 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#103b2d] via-[#17543b] to-[#214c61] p-6 text-white shadow-xl sm:p-9">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100"><ArrowLeft size={16}/> Back to RHEMA EXPLOITS SCIENCE ACADEMY INT’L website</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#e5ca7d]">Explore • Discover • Navigate</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">RHEMA EXPLOITS SCIENCE ACADEMY INT’L Maps & Places</h1>
        <p className="mt-3 max-w-3xl leading-7 text-emerald-50">Find the school immediately, explore nearby landmarks and search destinations. Map results and journey estimates are supplied by Google Maps and may change with traffic and road conditions.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.8fr)]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div><h2 className="font-extrabold text-[#17452f]">School and nearby places</h2><p className="text-xs text-slate-500">The map opens at the school; nearby place labels appear where Google Maps has them.</p></div>
            <a href={mapsSearchUrl(destination || SCHOOL_MAP_QUERY)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#174c35] px-3 py-2 text-sm font-bold text-white">Open full map <ExternalLink size={14}/></a>
          </div>
          <iframe title="Map showing RHEMA EXPLOITS SCIENCE ACADEMY INT’L and nearby places" src={mapSrc} className="h-[420px] w-full border-0 sm:h-[540px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-xs leading-5 text-slate-500">The school address is the starting map location. Nearby landmarks such as Mat Ice are shown when available in Google Maps at this zoom level.</p>
            <button type="button" onClick={showSchoolAndNearbyPlaces} className="rounded-xl border border-emerald-700 px-3 py-2 text-sm font-bold text-emerald-800">Show school & nearby places</button>
          </div>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#174c35]"><MapPin size={19}/><h2 className="font-extrabold">Find a place</h2></div>
            <form onSubmit={searchPlace}>
              <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="resa-destination">Destination or address</label>
              <div className="mt-2 flex gap-2">
                <input id="resa-destination" value={searchInput} onChange={e=>setSearchInput(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="e.g. Mat Ice, Benin City"/>
                <button type="submit" className="rounded-xl bg-[#174c35] px-3 text-white" aria-label="Search map"><Search size={18}/></button>
              </div>
            </form>
            <button type="button" onClick={showSchoolAndNearbyPlaces} className="mt-3 text-left text-sm font-bold text-emerald-800 underline underline-offset-4">Show RHEMA EXPLOITS SCIENCE ACADEMY INT’L school location</button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#174c35]"><Navigation size={19}/><h2 className="font-extrabold">Get directions</h2></div>
            <label htmlFor="resa-origin" className="mt-4 block text-sm font-semibold text-slate-700">Starting point (optional)</label>
            <input id="resa-origin" value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Your current location or another address" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"/>
            <a href={directionsUrl(destination || SCHOOL_MAP_QUERY, origin)} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d8b765] px-4 py-3 font-extrabold text-[#173d2e]">Get live directions <ExternalLink size={16}/></a>
            <p className="mt-2 text-xs leading-5 text-slate-500">For turn-by-turn guidance, Google Maps opens with the selected route. Confirm the destination before starting your journey.</p>
          </section>

          <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="font-extrabold text-emerald-950">{SCHOOL_NAME}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">{SCHOOL_ADDRESS}</p>
            <a href={mapsSearchUrl(SCHOOL_MAP_QUERY)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-900 underline underline-offset-4">View school on Google Maps <ExternalLink size={14}/></a>
          </section>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-2 text-[#174c35]"><Sparkles size={20}/><h2 className="text-xl font-extrabold">Ask about RHEMA EXPLOITS SCIENCE ACADEMY INT’L and places</h2></div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Ask about the school's address or how to use the map. For other places, this first release directs you to live map-provider information rather than inventing details.</p>
        <form onSubmit={e=>{e.preventDefault();ask();}} className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="e.g. Where is the school located? How do I get directions?" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"/><button className="rounded-xl bg-[#174c35] px-5 py-3 font-bold text-white">Ask</button></form>
        {answer && <div role="status" className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{answer}</div>}
        <p className="mt-4 text-xs text-slate-500">This is an initial verified-information assistant, not yet a generative AI service. A full conversational assistant requires a secured server-side AI integration and an approved knowledge base.</p>
      </section>
    </div>
  </main>;
}
