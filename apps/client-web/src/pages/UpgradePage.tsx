import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Biz = { id: string; name: string; is_premium: boolean };

type PaymentMethod = "ewallet" | "gcash" | "maya" | "paypal";

type RequestRow = {
  id: string;
  business_id: string;
  payment_method: string;
  reference_number: string;
  status: string;
  created_at: string;
  businesses: { name: string } | null;
};

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "ewallet", label: "E-wallet" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "paypal", label: "PayPal" },
];

export function UpgradePage() {
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [selected, setSelected] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RequestRow[]>([]);

  const loadBusinesses = async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    const { data } = await supabase.from("businesses").select("id,name,is_premium").eq("owner_id", uid);
    const rows = (data as Biz[]) ?? [];
    setBusinesses(rows);
    const firstOpen = rows.find((b) => !b.is_premium)?.id ?? rows[0]?.id;
    if (firstOpen) setSelected((prev) => (prev && rows.some((b) => b.id === prev) ? prev : firstOpen));
  };

  const loadHistory = async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    const { data: bizRows } = await supabase.from("businesses").select("id").eq("owner_id", uid);
    const ids = (bizRows as { id: string }[] | null)?.map((b) => b.id) ?? [];
    if (!ids.length) {
      setHistory([]);
      return;
    }
    const { data } = await supabase
      .from("premium_upgrade_requests")
      .select("id,business_id,payment_method,reference_number,status,created_at,businesses(name)")
      .in("business_id", ids)
      .order("created_at", { ascending: false });
    setHistory((data as unknown as RequestRow[]) ?? []);
  };

  useEffect(() => {
    void (async () => {
      await loadBusinesses();
      await loadHistory();
    })();
  }, []);

  const selectedBiz = useMemo(() => businesses.find((b) => b.id === selected), [businesses, selected]);
  const pendingForSelected = useMemo(
    () => history.find((h) => h.business_id === selected && h.status === "pending"),
    [history, selected],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!selected) {
      setMsg("Please select a business listing.");
      return;
    }
    if (selectedBiz?.is_premium) {
      setMsg("This listing is already on Premium.");
      return;
    }
    if (pendingForSelected) {
      setMsg("There is already a pending payment request for this listing. Please wait for admin review.");
      return;
    }
    if (!reference.trim()) {
      setMsg("Enter the reference or transaction number.");
      return;
    }
    if (!file) {
      setMsg("Upload a screenshot of your payment (JPG or PNG).");
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      setMsg("Please sign in first.");
      return;
    }
    setLoading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${uid}/${crypto.randomUUID()}.${safeExt}`;
      const { error: upErr } = await supabase.storage.from("premium-payment-proofs").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
      });
      if (upErr) {
        setMsg(upErr.message);
        return;
      }
      const { error: insErr } = await supabase.from("premium_upgrade_requests").insert({
        business_id: selected,
        payment_method: method,
        reference_number: reference.trim(),
        proof_storage_path: path,
      });
      if (insErr) {
        setMsg(insErr.message);
        void supabase.storage.from("premium-payment-proofs").remove([path]);
        return;
      }
      setMsg(
        "Submitted. An admin will review your payment and proof; you can track it in the Premium payments dashboard.",
      );
      setReference("");
      setFile(null);
      await loadBusinesses();
      await loadHistory();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--flush-top">
      <h1 className="dash-title" style={{ marginBottom: 8 }}>
        Upgrade to Premium
      </h1>
      <p className="dash-sub" style={{ maxWidth: 640 }}>
        Pay with GCash, Maya, PayPal, or another e-wallet. Enter your reference number and upload a screenshot as
        proof. An admin will verify before Premium and booking/reservation features are enabled for your listing.
      </p>

      {businesses.length === 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          No listings yet. Create a listing before upgrading to Premium.
        </div>
      )}

      {businesses.length > 0 && (
        <form className="card" onSubmit={(e) => void submit(e)} style={{ marginTop: 16, maxWidth: 520 }}>
          <div className="field">
            <label htmlFor="biz">Business listing</label>
            <select id="biz" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.is_premium ? "(Premium)" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedBiz?.is_premium ? (
            <p style={{ color: "var(--muted)" }}>This listing is already on Premium.</p>
          ) : pendingForSelected ? (
            <p style={{ color: "var(--muted)" }}>
              Pending request ({pendingForSelected.payment_method} · ref {pendingForSelected.reference_number}). Please
              wait for admin review.
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="pm">Payment method</label>
                <select id="pm" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ref">Reference / transaction number</label>
                <input
                  id="ref"
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. GCash ref, PayPal transaction ID"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="proof">Payment screenshot</label>
                <input
                  id="proof"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && <small style={{ display: "block", marginTop: 6 }}>{file.name}</small>}
              </div>
            </>
          )}

          {msg && (
            <div
              style={{
                marginBottom: 12,
                fontSize: 14,
                color: msg.startsWith("Submitted") ? "var(--primary)" : "var(--danger, #c0392b)",
              }}
            >
              {msg}
            </div>
          )}

          {!selectedBiz?.is_premium && !pendingForSelected && (
            <button className="btn btn-primary btn-inline" type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit payment proof"}
            </button>
          )}
        </form>
      )}

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 20, maxWidth: 720 }}>
          <h2 className="dash-title" style={{ fontSize: 18, marginBottom: 12 }}>
            Request history
          </h2>
          <table className="biz-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.businesses?.name ?? "—"}</td>
                  <td>{h.payment_method}</td>
                  <td>
                    <code style={{ fontSize: 12 }}>{h.reference_number}</code>
                  </td>
                  <td>{h.status}</td>
                  <td style={{ fontSize: 13, color: "var(--muted)" }}>{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
