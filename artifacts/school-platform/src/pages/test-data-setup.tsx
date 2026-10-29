import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type TestCredential = { role: string; name: string; username: string; password: string };
type SeedResult = {
  success?: boolean;
  message?: string;
  error?: string;
  run_id?: string;
  counts?: { teachers: number; students: number; cbtAttempts: number; caScores: number; publishedResults: number };
  credentials?: TestCredential[];
};

const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";

export default function TestDataSetupPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
    const text = result.credentials.map(c => `${c.role.toUpperCase()} | ${c.name} | Username: ${c.username} | Password: ${c.password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Automatic copy was blocked. Select and copy the credentials shown below.");
    }
  }

  if (checking) return <main className="mx-auto max-w-4xl p-6 text-[#244434]">Checking administrator access…</main>;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8 text-[#244434]">
      <Link href="/dashboard" className="inline-flex mb-5 text-sm font-semibold underline underline-offset-4">← Back to RESA dashboard</Link>
      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">Testing only</div>
        <h1 className="text-2xl font-bold sm:text-3xl">RESA Test Accounts & Results</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Creates 10 teacher logins and 20 student logins with usernames and temporary passwords, plus clearly labelled test attendance,
          continuous-assessment marks, submitted CBT attempts and published sample results. These are not real RESA people or official results.
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
                <thead className="bg-slate-50"><tr><th className="p-3">Role</th><th className="p-3">Test name</th><th className="p-3">Username</th><th className="p-3">Temporary password</th></tr></thead>
                <tbody>{(result.credentials || []).map(c => <tr key={c.username} className="border-t"><td className="p-3 capitalize">{c.role}</td><td className="p-3">{c.name}</td><td className="p-3 font-mono">{c.username}</td><td className="p-3 font-mono">{c.password}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
