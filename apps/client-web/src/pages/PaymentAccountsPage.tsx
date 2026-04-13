import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClientEditorSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Biz = {
  id: string;
  name: string;
  is_premium: boolean;
  pay_gcash_enabled: boolean;
  pay_gcash_qr_path: string | null;
  pay_gcash_account_name: string | null;
  pay_gcash_account_number: string | null;
  pay_maya_enabled: boolean;
  pay_maya_qr_path: string | null;
  pay_maya_account_name: string | null;
  pay_maya_account_number: string | null;
  pay_paypal_enabled: boolean;
  pay_paypal_email: string | null;
  // legacy (optional)
  pay_gcash_account_label: string | null;
  pay_maya_account_label: string | null;
};

const QR_BUCKET = "booking-qrcodes";

function publicQrUrl(path: string | null) {
  if (!path) return null;
  return supabase.storage.from(QR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function PaymentAccountsPage() {
  const [pageReady, setPageReady] = useState(false);
  const [rows, setRows] = useState<Biz[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [gcashEnabled, setGcashEnabled] = useState(false);
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashLabelLegacy, setGcashLabelLegacy] = useState("");
  const [gcashQrPath, setGcashQrPath] = useState<string | null>(null);
  const [gcashQrFile, setGcashQrFile] = useState<File | null>(null);

  const [mayaEnabled, setMayaEnabled] = useState(false);
  const [mayaName, setMayaName] = useState("");
  const [mayaNumber, setMayaNumber] = useState("");
  const [mayaLabelLegacy, setMayaLabelLegacy] = useState("");
  const [mayaQrPath, setMayaQrPath] = useState<string | null>(null);
  const [mayaQrFile, setMayaQrFile] = useState<File | null>(null);

  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");

  const load = useCallback(async () => {
    setMsg(null);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setRows([]);
      return;
    }
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id,name,is_premium,pay_gcash_enabled,pay_gcash_qr_path,pay_gcash_account_name,pay_gcash_account_number,pay_maya_enabled,pay_maya_qr_path,pay_maya_account_name,pay_maya_account_number,pay_paypal_enabled,pay_paypal_email,pay_gcash_account_label,pay_maya_account_label",
      )
      .eq("owner_id", uid)
      .order("created_at", { ascending: true });
    if (error) {
      setMsg(error.message);
      setRows([]);
      return;
    }
    const list = (data as Biz[]) ?? [];
    setRows(list);
    const first = list[0]?.id ?? "";
    setSelected((prev) => (prev && list.some((b) => b.id === prev) ? prev : first));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setPageReady(true);
      }
    })();
  }, [load]);

  const selectedBiz = useMemo(() => rows.find((b) => b.id === selected) ?? null, [rows, selected]);

  useEffect(() => {
    const b = selectedBiz;
    if (!b) return;
    setGcashEnabled(Boolean(b.pay_gcash_enabled));
    setGcashName((b.pay_gcash_account_name ?? "").trim());
    setGcashNumber((b.pay_gcash_account_number ?? "").trim());
    setGcashLabelLegacy((b.pay_gcash_account_label ?? "").trim());
    setGcashQrPath(b.pay_gcash_qr_path ?? null);
    setGcashQrFile(null);

    setMayaEnabled(Boolean(b.pay_maya_enabled));
    setMayaName((b.pay_maya_account_name ?? "").trim());
    setMayaNumber((b.pay_maya_account_number ?? "").trim());
    setMayaLabelLegacy((b.pay_maya_account_label ?? "").trim());
    setMayaQrPath(b.pay_maya_qr_path ?? null);
    setMayaQrFile(null);

    setPaypalEnabled(Boolean(b.pay_paypal_enabled));
    setPaypalEmail((b.pay_paypal_email ?? "").trim());
  }, [selectedBiz?.id]);

  const uploadQrUnique = async (
    businessId: string,
    base: "gcash" | "maya",
    file: File,
    existingPath: string | null,
  ): Promise<string | null> => {
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "png";
    const normalizedExt = safeExt === "jpeg" ? "jpg" : safeExt;
    const path = `${businessId}/${base}-${crypto.randomUUID()}.${normalizedExt}`;
    const contentType = file.type || `image/${normalizedExt === "jpg" ? "jpeg" : normalizedExt}`;
    const storage = supabase.storage.from(QR_BUCKET);

    const { error } = await storage.upload(path, file, { upsert: false, cacheControl: "3600", contentType });
    if (error) {
      setMsg(error.message);
      return null;
    }

    // Best-effort cleanup of previous QR to reduce clutter.
    if (existingPath && existingPath !== path) {
      await storage.remove([existingPath]);
    }

    return path;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
    if (!selectedBiz.is_premium) {
      setMsg("Upgrade this listing to Premium to accept paid reservations.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      let nextGcashPath = gcashQrPath;
      let nextMayaPath = mayaQrPath;

      if (gcashEnabled && gcashQrFile) {
        const uploaded = await uploadQrUnique(selectedBiz.id, "gcash", gcashQrFile, gcashQrPath);
        if (!uploaded) return;
        nextGcashPath = uploaded;
      }
      if (mayaEnabled && mayaQrFile) {
        const uploaded = await uploadQrUnique(selectedBiz.id, "maya", mayaQrFile, mayaQrPath);
        if (!uploaded) return;
        nextMayaPath = uploaded;
      }

      const payload = {
        pay_gcash_enabled: gcashEnabled,
        pay_gcash_account_name: gcashEnabled ? gcashName.trim() || null : null,
        pay_gcash_account_number: gcashEnabled ? gcashNumber.trim() || null : null,
        pay_gcash_account_label: gcashEnabled ? gcashLabelLegacy.trim() || null : null,
        pay_gcash_qr_path: gcashEnabled ? nextGcashPath : null,
        pay_maya_enabled: mayaEnabled,
        pay_maya_account_name: mayaEnabled ? mayaName.trim() || null : null,
        pay_maya_account_number: mayaEnabled ? mayaNumber.trim() || null : null,
        pay_maya_account_label: mayaEnabled ? mayaLabelLegacy.trim() || null : null,
        pay_maya_qr_path: mayaEnabled ? nextMayaPath : null,
        pay_paypal_enabled: paypalEnabled,
        pay_paypal_email: paypalEnabled ? paypalEmail.trim() || null : null,
      };

      const { error } = await supabase.from("businesses").update(payload).eq("id", selectedBiz.id);
      if (error) {
        setMsg(error.message);
        return;
      }
      // refresh local state from DB
      await load();
      setMsg("Saved.");
    } finally {
      setBusy(false);
    }
  };

  if (!pageReady) return <ClientEditorSkeleton />;

  return (
    <div className="page page--flush-top page-stack">
      <div>
        <h1 className="dash-title" style={{ marginBottom: 8 }}>
          Reservation payment accounts
        </h1>
        <p className="dash-sub" style={{ maxWidth: 760, marginBottom: 0 }}>
          Set your GCash/Maya/PayPal details and upload QR images. Travelers will see these during reservation on the
          mobile app and submit payment proof for your review.
        </p>
      </div>

      {msg ? (
        <div className={`alert-banner ${msg === "Saved." ? "alert-banner--success" : "alert-banner--error"}`}>{msg}</div>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <div className="empty-state__icon" aria-hidden>
            💳
          </div>
          <p className="empty-state__title">Create a listing first</p>
          <p className="empty-state__text">Add at least one listing, then come back to set up reservation payments.</p>
          <div className="empty-state__actions">
            <Link to="/listings/new" className="btn btn-primary btn-inline">
              + Add listing
            </Link>
          </div>
        </div>
      ) : (
        <form className="card" onSubmit={(e) => void save(e)} style={{ maxWidth: 860 }}>
          <div className="field">
            <label htmlFor="biz">Business listing</label>
            <select id="biz" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {rows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.is_premium ? "(Premium)" : "(Free)"}
                </option>
              ))}
            </select>
            {!selectedBiz?.is_premium ? (
              <small className="form-footnote">
                This listing is not Premium yet. Reservation payments are available only for Premium listings.
              </small>
            ) : null}
          </div>

          <div className="field" style={{ marginTop: 6 }}>
            <h3 className="card__title">GCash</h3>
            <label className="acc-editor-avail" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={gcashEnabled} onChange={(e) => setGcashEnabled(e.target.checked)} />
              <span>Accept GCash</span>
            </label>
            {gcashEnabled ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div>
                  <label>Account name</label>
                  <input value={gcashName} onChange={(e) => setGcashName(e.target.value)} placeholder="e.g. Juan D." />
                </div>
                <div>
                  <label>Account number</label>
                  <input
                    value={gcashNumber}
                    onChange={(e) => setGcashNumber(e.target.value)}
                    placeholder="e.g. 09xxxxxxxxx"
                    inputMode="numeric"
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>QR image</label>
                  <input type="file" accept="image/*" onChange={(e) => setGcashQrFile(e.target.files?.[0] ?? null)} />
                  {gcashQrPath ? (
                    <img
                      src={publicQrUrl(gcashQrPath) ?? ""}
                      alt="GCash QR"
                      style={{ maxHeight: 160, marginTop: 10, borderRadius: 10, border: "1px solid var(--border)" }}
                    />
                  ) : null}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Legacy label (optional)</label>
                  <input
                    value={gcashLabelLegacy}
                    onChange={(e) => setGcashLabelLegacy(e.target.value)}
                    placeholder="09xx / Juan D."
                  />
                  <small className="form-footnote">Only needed for older app builds; safe to leave blank.</small>
                </div>
              </div>
            ) : null}
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <h3 className="card__title">Maya</h3>
            <label className="acc-editor-avail" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={mayaEnabled} onChange={(e) => setMayaEnabled(e.target.checked)} />
              <span>Accept Maya</span>
            </label>
            {mayaEnabled ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div>
                  <label>Account name</label>
                  <input value={mayaName} onChange={(e) => setMayaName(e.target.value)} placeholder="e.g. Juan D." />
                </div>
                <div>
                  <label>Account number</label>
                  <input
                    value={mayaNumber}
                    onChange={(e) => setMayaNumber(e.target.value)}
                    placeholder="e.g. 09xxxxxxxxx"
                    inputMode="numeric"
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>QR image</label>
                  <input type="file" accept="image/*" onChange={(e) => setMayaQrFile(e.target.files?.[0] ?? null)} />
                  {mayaQrPath ? (
                    <img
                      src={publicQrUrl(mayaQrPath) ?? ""}
                      alt="Maya QR"
                      style={{ maxHeight: 160, marginTop: 10, borderRadius: 10, border: "1px solid var(--border)" }}
                    />
                  ) : null}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Legacy label (optional)</label>
                  <input value={mayaLabelLegacy} onChange={(e) => setMayaLabelLegacy(e.target.value)} />
                  <small className="form-footnote">Only needed for older app builds; safe to leave blank.</small>
                </div>
              </div>
            ) : null}
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <h3 className="card__title">PayPal</h3>
            <label className="acc-editor-avail" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={paypalEnabled} onChange={(e) => setPaypalEnabled(e.target.checked)} />
              <span>Accept PayPal</span>
            </label>
            {paypalEnabled ? (
              <>
                <label>Email or PayPal.me</label>
                <input
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="you@email.com or paypal.me/yourname"
                />
              </>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-primary btn-inline" type="submit" disabled={busy || !selectedBiz?.is_premium}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

