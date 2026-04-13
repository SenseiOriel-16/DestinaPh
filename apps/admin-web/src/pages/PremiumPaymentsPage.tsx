import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPremiumSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Row = {
  id: string;
  business_id: string;
  payment_method: string;
  reference_number: string;
  proof_storage_path: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  businesses: { name: string } | null;
};

const METHOD_LABEL: Record<string, string> = {
  ewallet: "E-wallet",
  gcash: "GCash",
  maya: "Maya",
  paypal: "PayPal",
};

export function PremiumPaymentsPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [pageReady, setPageReady] = useState(false);
  const firstLoadDone = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    try {
      let q = supabase
        .from("premium_upgrade_requests")
        .select("id,business_id,payment_method,reference_number,proof_storage_path,status,admin_notes,created_at,reviewed_at,businesses(name)")
        .order("created_at", { ascending: false });
      if (tab === "pending") q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) {
        setMsg(error.message);
        return;
      }
      setRows((data as unknown as Row[]) ?? []);
    } finally {
      if (!firstLoadDone.current) {
        firstLoadDone.current = true;
        setPageReady(true);
      }
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const openProof = async (path: string) => {
    setMsg(null);
    const { data, error } = await supabase.storage.from("premium-payment-proofs").createSignedUrl(path, 600);
    if (error) {
      setMsg(error.message);
      return;
    }
    setPreviewUrl(data.signedUrl);
  };

  const approve = async (row: Row) => {
    setMsg(null);
    setBusyId(row.id);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setMsg("Not signed in.");
      setBusyId(null);
      return;
    }
    const { data: plan, error: planErr } = await supabase.from("subscription_plans").select("id").eq("code", "premium").maybeSingle();
    if (planErr || !plan) {
      setMsg(planErr?.message ?? "Premium plan missing");
      setBusyId(null);
      return;
    }
    const { error: bizErr } = await supabase.from("businesses").update({ is_premium: true }).eq("id", row.business_id);
    if (bizErr) {
      setMsg(bizErr.message);
      setBusyId(null);
      return;
    }
    const { error: subErr } = await supabase.from("business_subscriptions").insert({
      business_id: row.business_id,
      plan_id: plan.id,
      expires_at: null,
    });
    if (subErr && !subErr.message.includes("duplicate") && !subErr.message.includes("unique")) {
      setMsg(subErr.message);
      setBusyId(null);
      return;
    }
    const { error: reqErr } = await supabase
      .from("premium_upgrade_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: uid,
        admin_notes: null,
      })
      .eq("id", row.id)
      .eq("status", "pending");
    if (reqErr) {
      setMsg(reqErr.message);
      setBusyId(null);
      return;
    }
    setBusyId(null);
    await load();
  };

  const reject = async () => {
    if (!rejectId) return;
    setMsg(null);
    setBusyId(rejectId);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setMsg("Not signed in.");
      setBusyId(null);
      return;
    }
    const { error } = await supabase
      .from("premium_upgrade_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: uid,
        admin_notes: rejectNotes.trim() || null,
      })
      .eq("id", rejectId)
      .eq("status", "pending");
    if (error) {
      setMsg(error.message);
      setBusyId(null);
      return;
    }
    setRejectId(null);
    setRejectNotes("");
    setBusyId(null);
    await load();
  };

  if (!pageReady) {
    return <AdminPremiumSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Revenue</p>
          <h1 className="dash-title admin-page-hero__title">Premium payment requests</h1>
          <p className="dash-sub admin-page-hero__sub" style={{ maxWidth: 640 }}>
            Review GCash / Maya / PayPal (or e-wallet) payments and proof screenshots. Approving enables premium and
            booking tools for that listing. Platform payout QR and account numbers are configured under Settings →
            Premium payout accounts.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--plans" aria-hidden />
      </header>

      <div className="segment-tabs">
        <button type="button" className={`btn ${tab === "pending" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("pending")}>
          Pending
        </button>
        <button type="button" className={`btn ${tab === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("all")}>
          All
        </button>
      </div>

      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}

      <div className="card card--table-shell" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.businesses?.name ?? "—"}</td>
                <td>{METHOD_LABEL[r.payment_method] ?? r.payment_method}</td>
                <td>
                  <code style={{ fontSize: 13 }}>{r.reference_number}</code>
                </td>
                <td style={{ color: "var(--muted)", fontSize: 14 }}>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        r.status === "approved"
                          ? "rgba(46, 155, 76, 0.15)"
                          : r.status === "rejected"
                            ? "rgba(192, 57, 43, 0.12)"
                            : "rgba(14, 201, 182, 0.15)",
                      color: r.status === "approved" ? "#1e6b3a" : r.status === "rejected" ? "#922b21" : "var(--primary)",
                    }}
                  >
                    {r.status}
                  </span>
                </td>
                <td style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => void openProof(r.proof_storage_path)}>
                    View proof
                  </button>
                  {r.status === "pending" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === r.id}
                        onClick={() => void approve(r)}
                      >
                        {busyId === r.id ? "…" : "Enable premium"}
                      </button>
                      <button type="button" className="btn btn-danger" disabled={busyId === r.id} onClick={() => setRejectId(r.id)}>
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No premium payment requests in this tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {previewUrl && (
        <div
          className="card"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            margin: "auto",
            maxWidth: "min(920px, 96vw)",
            maxHeight: "92vh",
            overflow: "auto",
            padding: 16,
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 12px 48px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>Payment proof</strong>
            <button type="button" className="btn btn-ghost" onClick={() => setPreviewUrl(null)}>
              Close
            </button>
          </div>
          <img src={previewUrl} alt="Payment proof" style={{ width: "100%", height: "auto", borderRadius: 8 }} />
        </div>
      )}

      {rejectId && (
        <div className="card" style={{ marginTop: 16, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Reject request</h3>
          <div className="field">
            <label htmlFor="rej">Notes to owner (optional)</label>
            <textarea
              id="rej"
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-danger" disabled={busyId === rejectId} onClick={() => void reject()}>
              Confirm reject
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setRejectId(null); setRejectNotes(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
