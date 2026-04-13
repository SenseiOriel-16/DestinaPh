import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClientUpgradeSkeleton } from "../components/PageSkeletons";
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

const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));

const PLATFORM_QR_BUCKET = "premium-platform-qr";

type PlatformAccount = {
  id: string;
  provider_type: string;
  display_label: string;
  account_name: string;
  account_number: string;
  qr_storage_path: string | null;
};

export function UpgradePage() {
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [selected, setSelected] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RequestRow[]>([]);
  const [pageReady, setPageReady] = useState(false);
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
  const [platformQrUrls, setPlatformQrUrls] = useState<Record<string, string>>({});

  const loadPlatformAccounts = async () => {
    const { data, error } = await supabase
      .from("premium_platform_payment_accounts")
      .select("id,provider_type,display_label,account_name,account_number,qr_storage_path")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[upgrade] premium_platform_payment_accounts:", error.message);
      setPlatformAccounts([]);
      setPlatformQrUrls({});
      return;
    }
    const list = (data as PlatformAccount[]) ?? [];
    setPlatformAccounts(list);
    const urls: Record<string, string> = {};
    for (const row of list) {
      if (!row.qr_storage_path) continue;
      const { data: signed } = await supabase.storage
        .from(PLATFORM_QR_BUCKET)
        .createSignedUrl(row.qr_storage_path, 3600);
      if (signed?.signedUrl) urls[row.id] = signed.signedUrl;
    }
    setPlatformQrUrls(urls);
  };

  const loadBusinesses = async (): Promise<Biz[]> => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return [];
    const { data, error } = await supabase.from("businesses").select("id,name,is_premium").eq("owner_id", uid);
    if (error) {
      setMsg(error.message);
      return [];
    }
    const rows = (data as Biz[]) ?? [];
    setBusinesses(rows);
    const firstOpen = rows.find((b) => !b.is_premium)?.id ?? rows[0]?.id;
    if (firstOpen) setSelected((prev) => (prev && rows.some((b) => b.id === prev) ? prev : firstOpen));
    return rows;
  };

  const loadHistory = async (bizRows: Biz[]) => {
    const ids = bizRows.map((b) => b.id);
    if (!ids.length) {
      setHistory([]);
      return;
    }
    const nameById = Object.fromEntries(bizRows.map((b) => [b.id, b.name]));
    const { data, error } = await supabase
      .from("premium_upgrade_requests")
      .select("id,business_id,payment_method,reference_number,status,created_at")
      .in("business_id", ids)
      .order("created_at", { ascending: false });
    if (error) {
      setMsg(error.message);
      setHistory([]);
      return;
    }
    const flat = (data as Omit<RequestRow, "businesses">[]) ?? [];
    setHistory(
      flat.map((h) => ({
        ...h,
        businesses: { name: nameById[h.business_id] ?? "—" },
      })),
    );
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await loadBusinesses();
        if (cancelled) return;
        await loadHistory(rows);
        if (cancelled) return;
        await loadPlatformAccounts();
      } finally {
        if (!cancelled) setPageReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBiz = useMemo(() => businesses.find((b) => b.id === selected), [businesses, selected]);
  const pendingForSelected = useMemo(
    () => history.find((h) => h.business_id === selected && h.status === "pending"),
    [history, selected],
  );

  /** Newest row per type wins if duplicates exist (admin should keep one active account per payment type). */
  const primaryAccountForMethod = useMemo(
    () => platformAccounts.find((a) => a.provider_type === method) ?? null,
    [platformAccounts, method],
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
      const rows = await loadBusinesses();
      await loadHistory(rows);
      await loadPlatformAccounts();
    } finally {
      setLoading(false);
    }
  };

  const msgTone = (msg ?? "").startsWith("Submitted") ? "success" : "error";

  if (!pageReady) {
    return <ClientUpgradeSkeleton />;
  }

  return (
    <div className="page page--flush-top page-stack">
      <div className="upgrade-page-header">
        <h1 className="dash-title upgrade-page-header__title">
          <span className="upgrade-page-header__crown" aria-hidden>
            👑
          </span>{" "}
          Upgrade to Premium
        </h1>
        <p className="dash-sub upgrade-page-header__sub">
          Choose your payment method below to see DestinaPH account details (name, number, QR). Pay, then enter your
          reference number and upload a screenshot as proof. An admin will verify before Premium is enabled.
        </p>
      </div>

      {businesses.length === 0 && (
        <div className="empty-state empty-state--compact">
          <div className="empty-state__icon" aria-hidden>
            ⭐
          </div>
          <p className="empty-state__title">Create a listing first</p>
          <p className="empty-state__text">
            Premium applies per business listing. Add at least one listing, then return here to submit payment proof.
          </p>
          <div className="empty-state__actions">
            <Link to="/listings/new" className="btn btn-primary btn-inline">
              + Add listing
            </Link>
          </div>
        </div>
      )}

      {businesses.length > 0 && (
        <form className="upgrade-form" onSubmit={(e) => void submit(e)}>
          {msg && (
            <div
              className={`alert-banner ${msgTone === "success" ? "alert-banner--success" : "alert-banner--error"}`}
              style={{ marginBottom: 0 }}
            >
              {msg}
            </div>
          )}

          {selectedBiz?.is_premium || pendingForSelected ? (
            <div className="card upgrade-step-card" style={{ maxWidth: 560 }}>
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
                <p style={{ color: "var(--muted)", marginBottom: 0 }}>This listing is already on Premium.</p>
              ) : pendingForSelected ? (
                <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                  Pending request ({pendingForSelected.payment_method} · ref {pendingForSelected.reference_number}). Please
                  wait for admin review.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="upgrade-grid">
                <section className="card upgrade-step-card" aria-labelledby="upgrade-step-title-1">
                  <h2 id="upgrade-step-title-1" className="upgrade-step-card__heading">
                    <span className="upgrade-step-card__icon" aria-hidden>
                      💳
                    </span>
                    1. Select Details
                  </h2>
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
                  <div className="upgrade-secure-notice" role="note">
                    <span className="upgrade-secure-notice__icon" aria-hidden>
                      🛡️
                    </span>
                    <span>
                      <strong>Secure &amp; Verified Payments:</strong> Your payment is secure and will be verified by
                      our admin team.
                    </span>
                  </div>
                </section>

                <section className="card upgrade-step-card" aria-labelledby="upgrade-step-title-2">
                  <h2 id="upgrade-step-title-2" className="upgrade-step-card__heading">
                    <span className="upgrade-step-card__icon" aria-hidden>
                      💼
                    </span>
                    2. Send Payment ({METHOD_LABEL[method] ?? method})
                  </h2>
                  {platformAccounts.length > 0 ? (
                    <div
                      className="upgrade-payto-panel upgrade-payto-panel--in-step"
                      role="region"
                      aria-label={`Payment details for ${METHOD_LABEL[method] ?? method}`}
                    >
                      {primaryAccountForMethod ? (
                        <div className="upgrade-payto-split">
                          <div className="upgrade-payto-split__details">
                            <div className="upgrade-payto-card upgrade-payto-card--flat">
                              <div className="upgrade-payto-card__label">{primaryAccountForMethod.display_label}</div>
                              <div className="upgrade-payto-card__row">
                                <span className="upgrade-payto-card__k">Account name</span>
                                <span className="upgrade-payto-card__v">{primaryAccountForMethod.account_name}</span>
                              </div>
                              <div className="upgrade-payto-card__row">
                                <span className="upgrade-payto-card__k">Account number / email</span>
                                <code className="upgrade-payto-card__code">{primaryAccountForMethod.account_number}</code>
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost btn-inline upgrade-payto-card__copy"
                                onClick={() => void navigator.clipboard.writeText(primaryAccountForMethod.account_number)}
                              >
                                Copy number
                              </button>
                              <div className="upgrade-payto-important">
                                <strong>Important:</strong> Send only to the DestinaPH account shown here. Keep your
                                receipt until verification is complete.
                              </div>
                            </div>
                          </div>
                          {platformQrUrls[primaryAccountForMethod.id] ? (
                            <div className="upgrade-payto-split__qr">
                              <span className="upgrade-payto-card__k">Scan to pay</span>
                              <img
                                src={platformQrUrls[primaryAccountForMethod.id]}
                                alt={`${primaryAccountForMethod.display_label} QR code`}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="upgrade-payto-panel__empty">
                          No payout account is set for {METHOD_LABEL[method] ?? method} yet. Try another method or contact
                          support.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="upgrade-payto-panel__empty">
                      Payment destination details are not available yet. Please try again later or contact support.
                    </p>
                  )}
                </section>
              </div>

              <section className="card upgrade-step-card upgrade-step-card--wide" aria-labelledby="upgrade-step-title-3">
                <h2 id="upgrade-step-title-3" className="upgrade-step-card__heading">
                  <span className="upgrade-step-card__icon" aria-hidden>
                    📋
                  </span>
                  3. Submit Payment Proof
                </h2>
                <div className="upgrade-submit-row">
                  <div className="field upgrade-submit-row__field">
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
                  <div className="field upgrade-submit-row__field">
                    <label htmlFor="proof">Payment screenshot</label>
                    <input
                      id="proof"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    {file && <small className="form-footnote">{file.name}</small>}
                  </div>
                  <div className="upgrade-submit-row__actions">
                    <button className="btn btn-primary btn-inline" type="submit" disabled={loading}>
                      {loading ? "Submitting…" : "Submit payment proof"}
                    </button>
                  </div>
                </div>
                <p className="upgrade-verify-footnote">
                  Verification usually takes 1–24 hours. You&apos;ll be notified once your Premium is activated.
                </p>
              </section>
            </>
          )}
        </form>
      )}

      {history.length > 0 && (
        <div className="card" style={{ maxWidth: 720 }}>
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
                  <td>{METHOD_LABEL[h.payment_method] ?? h.payment_method}</td>
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
