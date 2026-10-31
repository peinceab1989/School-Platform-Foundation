import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type TestCredential = { role: string; name: string; username: string; password: string };
type SeedResult = {
  success?: boolean;
  message?: string;
  error?: string;
  run_id?: string;
  counts?: { teachers: number; students: number; parents: number; cbtAttempts: number; caScores: number; publishedResults: number };
  credentials?: TestCredential[];
};
type CleanupPreview = {
  success?: boolean; dry_run?: boolean; message?: string; error?: string;
  trackedDemoMarkerRows?: number; preservedLegacyMarkerRows?: number; uniqueDemoLoginAccounts?: number;
  counts?: Record<string, number>; requiredConfirmation?: string;
  deletedCounts?: Record<string, number>; deletedLoginAccounts?: number;
};

const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";

export default function TestDataSetupPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [cleanupMessage, setCleanupMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function checkAccess() {
      try {
        const supabase = getSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) {
          if (active) setError("Sign in to the RESA portal as an administrator first.");
          return;
        }
        const { data, error: queryError } = await supabase
          .from("school_memberships")
          .select("role,status")
          .eq("school_id", SCHOOL_ID)
          .eq("user_id", user.id)
          .eq("role", "admin")
          .eq("status", "active")
          .maybeSingle();
        if (queryError) throw queryError;
        if (active) setIsAdmin(Boolean(data));
        if (!data && active) setError("This page is restricted to active RESA school administrators.");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not verify administrator access.");
      } finally {
        if (active) setChecking(false);
      }
    }
    void checkAccess();
    return () => { active = false; };
  }, []);

  async function createTestData() {
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-seed-test-data", { body: {} });
      if (invokeError) throw invokeError;
      const payload = data as SeedResult;
      if (!payload?.success) throw new Error(payload?.error || "The test data setup did not complete.");
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create test accounts.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!result?.credentials?.length) return;
    const text = result.credentials.map(c => `${c.role.toUpperCase()} | ${c.name} | Login ID / Email: ${c.username} | Password: ${c.password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Automatic copy was blocked. Select and copy the credentials shown below.");
    }
  }

  async function previewCleanup() {
    setCleanupBusy(true); setCleanupMessage(""); setError("");
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-clean-test-data", { body: { dry_run: true } });
      if (invokeError) throw invokeError;
      const payload = data as CleanupPreview;
      if (!payload?.success) throw new Error(payload?.error || "Could not preview test-data cleanup.");
      setCleanupPreview(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview test-data cleanup.");
    } finally { setCleanupBusy(false); }
  }

  async function runCleanup() {
    if (cleanupConfirmation !== "CLEAN RESA TEST DATA") {
      setError('Type exactly "CLEAN RESA TEST DATA" to confirm.'); return;
    }
    if (!window.confirm("Final confirmation: delete only explicitly marked demo_* records? Legacy_test_* and unmarked RESA records will be preserved. This cannot be undone.")) return;
    setCleanupBusy(true); setError(""); setCleanupMessage("");
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-clean-test-data", {
        body: { dry_run: false, confirmation: cleanupConfirmation },
      });
      if (invokeError) throw invokeError;
      const payload = data as CleanupPreview;
      if (!payload?.success) throw new Error(payload?.error || payload?.message || "Cleanup did not complete.");
      setCleanupMessage(payload.message || "Tracked test data was removed.");
      setCleanupPreview(null); setCleanupConfirmation(""); setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test-data cleanup failed.");
    } finally { setCleanupBusy(false); }
  }

  if (checking) return <main className="mx-auto max-w-4xl p-6 text-[#244434]">Checking administrator access…</main>;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8 text-[#244434]">
      <Link href="/dashboard" className="inline-flex mb-5 text-sm font-semibold underline underline-offset-4">← Back to RESA dashboard</Link>
      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">Testing only</div>
        <h1 className="text-2xl font-bold sm:text-3xl">RESA Test Accounts & Results</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Creates 10 teacher logins, 20 student logins and 6 parent/guardian logins with demo-only email IDs and temporary passwords, plus clearly labelled test attendance,
          continuous-assessment marks, submitted CBT attempts and published sample results. All test records are isolated and marked DEMO ONLY; they are not real RESA people or official results.
        </p>
        {!isAdmin && (
          <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error || "Administrator access is required."} <Link href="/portal" className="underline">Go to sign in</Link>
          </div>
        )}
        {isAdmin && !result && (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>Important:</strong> This creates test records in the existing live RESA database. The setup can run only once until the test data is cleaned up.
            Passwords are displayed only after creation, so keep a copy of the credentials.
            <button
              type="button"
              onClick={() => { if (window.confirm("Create 10 teacher and 20 student test accounts, test attendance, CA marks, CBT attempts, and published test results in the live RESA database?")) void createTestData(); }}
              disabled={busy}
              className="mt-4 block rounded-lg bg-emerald-900 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Creating test accounts and records…" : "Create RESA test dataset"}
            </button>
          </div>
        )}
        {error && isAdmin && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {result && (
          <div className="mt-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="font-bold">Test dataset created</h2>
              <p className="mt-1 text-sm">{result.message}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-3"><dt className="text-xs text-slate-500">Teachers</dt><dd className="text-xl font-bold">{result.counts?.teachers ?? 0}</dd></div>
                <div className="rounded-lg bg-white p-3"><dt className="text-xs text-slate-500">Students</dt><dd className="text-xl font-bold">{result.counts?.students ?? 0}</dd></div>
                <div className="rounded-lg bg-white p-3"><dt className="text-xs text-slate-500">Parents / Guardians</dt><dd className="text-xl font-bold">{result.counts?.parents ?? 0}</dd></div>
                <div className="rounded-lg bg-white p-3"><dt className="text-xs text-slate-500">CBT submissions</dt><dd className="text-xl font-bold">{result.counts?.cbtAttempts ?? 0}</dd></div>
                <div className="rounded-lg bg-white p-3"><dt className="text-xs text-slate-500">CA marks</dt><dd className="text-xl font-bold">{result.counts?.caScores ?? 0}</dd></div>
                <div className="rounded-lg bg-white p-3"><dt className="text-xs text-slate-500">Published test results</dt><dd className="text-xl font-bold">{result.counts?.publishedResults ?? 0}</dd></div>
              </dl>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Login credentials — copy and keep safe</h2>
              <button type="button" onClick={() => void copyCredentials()} className="rounded-lg border border-emerald-800 px-4 py-2 text-sm font-semibold">
                {copied ? "Copied" : "Copy all credentials"}
              </button>
            </div>
            <p className="mt-2 text-sm text-amber-800">Passwords are not saved in the database or shown again after you leave this page. Do not use these test credentials for real school accounts.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50"><tr><th className="p-3">Role</th><th className="p-3">Test name</th><th className="p-3">Login ID / Email</th><th className="p-3">Temporary password</th></tr></thead>
                <tbody>{(result.credentials || []).map(c => <tr key={c.username} className="border-t"><td className="p-3 capitalize">{c.role}</td><td className="p-3">{c.name}</td><td className="p-3 font-mono">{c.username}</td><td className="p-3 font-mono">{c.password}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
        {isAdmin && (
          <section className="mt-8 rounded-2xl border border-red-200 bg-white p-5 sm:p-8">
            <div className="mb-3 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-800">Launch cleanup — use only when testing is finished</div>
            <h2 className="text-xl font-bold">Remove tracked test data</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Preview first. Cleanup is restricted to explicitly registered demo_* records and demo login accounts. All legacy_test_* markers and unmarked records are excluded and preserved, alongside school settings, classes, subjects, school/owner records and administrator accounts.</p>
            <button type="button" onClick={() => void previewCleanup()} disabled={cleanupBusy} className="mt-4 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-60">{cleanupBusy ? "Checking…" : "Preview test-data cleanup"}</button>
            {cleanupPreview && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <p className="font-semibold">{cleanupPreview.message}</p>
                <p className="mt-1 text-sm">Demo markers: {cleanupPreview.trackedDemoMarkerRows ?? 0} · Legacy markers preserved: {cleanupPreview.preservedLegacyMarkerRows ?? 0} · Demo login accounts: {cleanupPreview.uniqueDemoLoginAccounts ?? 0}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(cleanupPreview.counts || {}).map(([table, count]) => <div key={table} className="flex justify-between gap-3 rounded border bg-white p-2 text-sm"><span className="break-all">{table}</span><strong>{count}</strong></div>)}
                </div>
                <label htmlFor="cleanup-confirmation" className="mt-4 block text-sm font-semibold">To permanently clean the tracked test records, type: CLEAN RESA TEST DATA</label>
                <input id="cleanup-confirmation" value={cleanupConfirmation} onChange={event => setCleanupConfirmation(event.target.value)} placeholder="CLEAN RESA TEST DATA" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" autoComplete="off" />
                <button type="button" onClick={() => void runCleanup()} disabled={cleanupBusy || cleanupConfirmation !== "CLEAN RESA TEST DATA"} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{cleanupBusy ? "Cleaning…" : "Permanently remove tracked demo data"}</button>
              </div>
            )}
            {cleanupMessage && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">{cleanupMessage}</p>}
          </section>
        )}
      </section>
    </main>
  );
}
