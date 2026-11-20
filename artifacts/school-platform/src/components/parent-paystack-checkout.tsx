import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type FeeRow = Record<string, unknown> & {
  id: string;
  student_id: string;
  fee_type_id: string;
  amount_due: number | string;
};

type PaymentRow = Record<string, unknown> & {
  student_fee_assignment_id: string;
  amount_paid: number | string;
};

type Props = {
  schoolId: string;
  feeRows: FeeRow[];
  paymentRows: PaymentRow[];
  feeTypeNames: Record<string, string>;
  childName: (studentId: string) => string;
};

const money = (value: number) => "₦" + value.toLocaleString("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ParentPaystackCheckout({
  schoolId,
  feeRows,
  paymentRows,
  feeTypeNames,
  childName,
}: Props) {
  const paidByAssignment = useMemo(() => paymentRows.reduce<Record<string, number>>((totals, row) => {
    const id = String(row.student_fee_assignment_id);
    totals[id] = (totals[id] || 0) + Number(row.amount_paid || 0);
    return totals;
  }, {}), [paymentRows]);

  const outstandingFees = useMemo(() => feeRows.map((row) => ({
    ...row,
    balance: Math.max(0, Number(row.amount_due || 0) - (paidByAssignment[String(row.id)] || 0)),
  })).filter((row) => row.balance > 0), [feeRows, paidByAssignment]);

  const [assignmentId, setAssignmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [gatewayReady, setGatewayReady] = useState(false);
  const [gatewayMode, setGatewayMode] = useState<"test" | "live">("test");
  const [gatewayChecking, setGatewayChecking] = useState(true);

  useEffect(() => {
    if (!assignmentId && outstandingFees.length) {
      setAssignmentId(String(outstandingFees[0].id));
      setAmount(String(outstandingFees[0].balance.toFixed(2)));
    }
  }, [assignmentId, outstandingFees]);

  useEffect(() => {
    let active = true;
    void getSupabaseClient().functions.invoke("resa-paystack", {
      body: { action: "status" },
    }).then(({ data, error }) => {
      if (!active) return;
      setGatewayReady(!error && data?.configured === true);
      if (data?.mode === "live") setGatewayMode("live");
    }).catch(() => {
      if (active) setGatewayReady(false);
    }).finally(() => {
      if (active) setGatewayChecking(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (params.get("paystack") !== "verify" || !reference) return;

    let active = true;
    setBusy(true);
    setNotice("Confirming your payment securely with Paystack…");
    void getSupabaseClient().functions.invoke("resa-paystack", {
      body: { action: "verify", reference },
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) throw error;
      if (data?.success && data?.status === "paid") {
        setReceiptNumber(String(data.receipt_number || ""));
        setNotice("Payment verified successfully. Your official RESA receipt has been issued.");
      } else {
        setNotice(String(data?.message || "Paystack has not confirmed this payment yet. Your fee balance has not been changed."));
      }
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "Payment verification is pending. Please contact RESA Finance if this persists.");
    }).finally(() => {
      if (active) setBusy(false);
      window.history.replaceState({}, "", window.location.pathname);
    });
    return () => { active = false; };
  }, []);

  const selected = outstandingFees.find((row) => String(row.id) === assignmentId);
  const balance = selected?.balance ?? 0;

  async function startCheckout() {
    const value = Number(amount);
    if (!selected || !Number.isFinite(value) || value <= 0 || value > balance + 0.001) {
      setNotice("Choose an outstanding fee and enter an amount within its remaining balance.");
      return;
    }
    setBusy(true);
    setNotice("");
    setReceiptNumber("");
    try {
      const { data, error } = await getSupabaseClient().functions.invoke("resa-paystack", {
        body: {
          action: "initialize",
          school_id: schoolId,
          assignment_id: assignmentId,
          amount_naira: Number(value.toFixed(2)),
        },
      });
      if (error) throw error;
      if (!data?.authorization_url || typeof data.authorization_url !== "string") {
        throw new Error(data?.error || "Paystack checkout could not be started.");
      }
      window.location.assign(data.authorization_url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to start Paystack checkout. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-lg font-bold text-emerald-800">₦</span>
          <div>
            <p className="font-extrabold text-emerald-950">Pay online with Paystack</p>
            <p className="text-xs font-semibold text-emerald-700">Secure checkout · verification required</p>
          </div>
        </div>
        {outstandingFees.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">There are no outstanding fee balances available for online payment.</p>
        ) : (
          <>
            <label className="mt-3 block text-xs font-bold text-slate-700">
              Select learner's fee
              <select value={assignmentId} onChange={(event) => {
                const next = outstandingFees.find((row) => String(row.id) === event.target.value);
                setAssignmentId(event.target.value);
                setAmount(next ? next.balance.toFixed(2) : "");
                setNotice("");
              }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
                {outstandingFees.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>
                    {childName(String(row.student_id))} · {feeTypeNames[String(row.fee_type_id)] || "School fee"} · {money(row.balance)} balance
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-bold text-slate-700">
              Amount to pay (₦)
              <input type="number" inputMode="decimal" min="0.01" max={balance} step="0.01" value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal"
                aria-label="Amount to pay in naira" />
            </label>
            <p className="mt-2 text-xs text-slate-500">Outstanding balance: <strong>{money(balance)}</strong>. Partial payments are allowed up to this amount.</p>
            <button type="button" disabled={busy || !selected || !gatewayReady || gatewayChecking} onClick={() => void startCheckout()}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Please wait…" : gatewayChecking ? "Checking Paystack availability…" : !gatewayReady ? "Paystack coming soon · not activated" : gatewayMode === "test" ? "Continue to Paystack test checkout" : "Continue to secure Paystack checkout"}
            </button>
            {!gatewayReady && !gatewayChecking && <p className="mt-2 text-xs leading-5 text-amber-800">Online checkout is not yet configured by RESA Finance. No payment can be taken through this option until the merchant keys and signed webhook are configured and tested.</p>}
          </>
        )}
        {notice && <div role="status" aria-live="polite" className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">
          {notice}
          {receiptNumber && <p className="mt-1 font-extrabold">Receipt: {receiptNumber}</p>}
          {receiptNumber && <button type="button" onClick={() => window.location.reload()} className="mt-2 font-bold underline">Refresh fee balances and receipts</button>}
        </div>}
      </div>
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">↗</span>
          <div><p className="font-extrabold text-emerald-950">Bank transfer or school office</p><p className="text-xs font-semibold text-emerald-700">Finance confirmation required</p></div>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Contact RESA through the official School Messages channel to confirm the school's approved account details or in-person payment procedure before sending money.</p>
        <a href="/school-communication" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-900 px-4 py-2.5 text-center text-sm font-extrabold text-white transition hover:bg-emerald-800">Contact RESA Finance</a>
      </div>
    </div>
  );
}
