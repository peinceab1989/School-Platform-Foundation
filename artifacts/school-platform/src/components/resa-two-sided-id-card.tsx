import QrCodeDisplay from "@/components/qr-code-display";

export type ResaIdCardKind = "STUDENT" | "STAFF" | "PARENT / GUARDIAN" | "VISITOR" | "OTHER";

export type ResaTwoSidedIdCardProps = {
  kind: ResaIdCardKind;
  name: string;
  reference: string;
  photoUrl?: string | null;
  qrPayload?: string | null;
  roleOrClass?: string | null;
  department?: string | null;
  linkedChildren?: string[];
  status?: string | null;
  schoolName?: string;
};

const SCHOOL = "RHEMA EXPLOITS SCIENCE ACADEMY INT’L (RESA)";
const RETURN_NOTICE = "IF FOUND, PLEASE RETURN TO RHEMA EXPLOITS SCIENCE ACADEMY INT’L (RESA), BENIN CITY, EDO STATE.";

export default function ResaTwoSidedIdCard({
  kind,
  name,
  reference,
  photoUrl,
  qrPayload,
  roleOrClass,
  department,
  linkedChildren = [],
  status,
}: ResaTwoSidedIdCardProps) {
  return (
    <div className="resa-two-sided-id-card mx-auto flex w-full max-w-[420px] flex-col gap-3">
      <style>{`
        .resa-id-card-face { width: 85.6mm; height: 54mm; box-sizing: border-box; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden !important; }
          .resa-two-sided-id-card, .resa-two-sided-id-card * { visibility: visible !important; }
          .resa-two-sided-id-card { display: block !important; width: auto !important; max-width: none !important; }
          .resa-id-card-face { display: flex !important; position: relative !important; width: 85.6mm !important; height: 54mm !important; min-height: 54mm !important; max-height: 54mm !important; margin: 12mm !important; padding: 2.5mm !important; overflow: hidden !important; box-sizing: border-box !important; border: .35mm solid #164e36 !important; border-radius: 2mm !important; box-shadow: none !important; break-inside: avoid !important; page-break-inside: avoid !important; }
          .resa-id-card-back { break-before: page !important; page-break-before: always !important; }
          .resa-id-card-screen-only { display: none !important; }
        }
      `}</style>
      <section className="resa-id-card-face relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-xl border-2 border-emerald-900 bg-white p-3 text-slate-900 shadow-sm">
        <header className="flex items-center justify-between gap-2 border-b-2 border-amber-400 pb-1.5">
          <img src="/media/logo/resa-logo.jpg" alt="RESA crest" className="h-8 w-8 shrink-0 rounded-full object-contain" />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-black leading-tight tracking-wide text-emerald-950">{SCHOOL}</p>
            <p className="text-[8px] font-bold tracking-[0.16em] text-emerald-800">OFFICIAL {kind} IDENTIFICATION</p>
          </div>
          <span className="text-[8px] font-black text-amber-700">RESA</span>
        </header>
        <div className="flex min-h-0 flex-1 items-center gap-2.5 py-2">
          <div className="h-[76px] w-[60px] shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-100">
            {photoUrl ? <img src={photoUrl} alt={name + " passport photograph"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-center text-[8px] font-bold text-slate-500">PASSPORT<br/>PHOTO</div>}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="line-clamp-2 break-words text-[11px] font-black text-slate-950">{name}</p>
            <p className="mt-1 text-[8px] font-extrabold uppercase tracking-wide text-emerald-800">{kind}</p>
            <p className="mt-1 break-words text-[9px] font-bold text-slate-800">{reference}</p>
            {roleOrClass && <p className="break-words text-[8px] text-slate-700">{roleOrClass}</p>}
            {department && <p className="break-words text-[8px] text-slate-700">{department}</p>}
            {status && <p className="text-[8px] text-slate-700">STATUS: {status}</p>}
            {linkedChildren.length > 0 && <p className="mt-1 line-clamp-2 text-[7px] text-slate-700">LINKED LEARNERS: {linkedChildren.join("; ")}</p>}
          </div>
          <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-center text-[8px] font-black text-slate-500">SECURE QR<br/>ON REVERSE</div>
        </div>
        <footer className="border-t border-amber-300 pt-1 text-center text-[7px] font-semibold text-emerald-950">PASSION • SKILLS • EXCELLENT SPIRIT</footer>
      </section>

      <section className="resa-id-card-face resa-id-card-back relative flex aspect-[1.586/1] w-full flex-col items-center justify-between overflow-hidden rounded-xl border-2 border-emerald-900 bg-white p-3 text-slate-900 shadow-sm">
        <header className="w-full border-b-2 border-amber-400 pb-1 text-center">
          <p className="text-[9px] font-black tracking-wide text-emerald-950">{SCHOOL}</p>
          <p className="text-[7px] font-bold uppercase tracking-widest text-emerald-700">SECURE IDENTITY & ATTENDANCE REFERENCE</p>
        </header>
        <div className="flex flex-1 items-center justify-center py-1">
          {qrPayload ? <div className="flex flex-col items-center gap-1"><QrCodeDisplay value={qrPayload} size={86}/><span className="text-[7px] font-black tracking-wide text-slate-700">SCAN TO VERIFY IDENTITY</span></div> : <div className="grid h-[86px] w-[86px] place-items-center rounded-md border border-dashed border-slate-300 text-center text-[8px] font-bold text-slate-500">QR NOT YET<br/>APPROVED</div>}
        </div>
        <footer className="w-full border-t border-amber-300 pt-1 text-center">
          <p className="text-[7px] font-black leading-tight text-emerald-950">{RETURN_NOTICE}</p>
          <p className="mt-1 text-[6px] leading-tight text-slate-600">For attendance or identity checks, an authorised officer must scan the QR and visually match the cardholder to the photograph. A parent identity card alone does not authorise child collection.</p>
          <p className="mt-1 text-[6px] font-semibold text-slate-600">1 Smiling George Way, Sapele Road, Benin City · +234 805 842 2691</p>
        </footer>
      </section>
      <p className="resa-id-card-screen-only text-center text-[11px] text-slate-500">CR80 size: 85.6 × 54 mm per side · Print double-sided, flip on long edge. Check printer alignment with one sample before bulk printing.</p>
    </div>
  );
}
