import { FormEvent, useEffect, useState } from "react";
import { AdminFormTableSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Provider = "ewallet" | "gcash" | "maya" | "paypal";

type Row = {
  id: string;
  provider_type: Provider;
  display_label: string;
  account_name: string;
  account_number: string;
  qr_storage_path: string | null;
  is_active: boolean;
};

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "paypal", label: "PayPal" },
  { value: "ewallet", label: "Other e-wallet" },
];

const BUCKET = "premium-platform-qr";

export function PremiumPlatformAccountsPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [providerType, setProviderType] = useState<Provider>("gcash");
  const [displayLabel, setDisplayLabel] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [qrFile, setQrFile] = useState<File | null>(null);

  const load = async () => {
    setMsg(null);
    const { data, error } = await supabase
      .from("premium_platform_payment_accounts")
      .select("id,provider_type,display_label,account_name,account_number,qr_storage_path,is_active")
      .order("created_at", { ascending: false });
    if (error) {
      setMsg(error.message);
      return;
    }
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setInitialLoad(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setProviderType("gcash");
    setDisplayLabel("");
    setAccountName("");
    setAccountNumber("");
    setIsActive(true);
    setQrFile(null);
  };

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setProviderType(r.provider_type);
    setDisplayLabel(r.display_label);
    setAccountName(r.account_name);
    setAccountNumber(r.account_number);
    setIsActive(r.is_active);
    setQrFile(null);
    setMsg(null);
  };

  const uploadQr = async (accountId: string, file: File): Promise<string | null> => {
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "png";
    const path = `${accountId}/qr-${crypto.randomUUID()}.${safeExt}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
    });
    if (error) {
      setMsg(error.message);
      return null;
    }
    return path;
  };

  const removeStoragePath = async (path: string | null) => {
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const label = displayLabel.trim();
    const name = accountName.trim();
    const number = accountNumber.trim();
    if (!label || !name || !number) {
      setMsg("Fill in display label, account name, and account number.");
      return;
    }
    if (editingId) {
      setBusyId(editingId);
      try {
        let nextPath: string | null | undefined;
        const existing = rows.find((x) => x.id === editingId);
        if (qrFile) {
          const uploaded = await uploadQr(editingId, qrFile);
          if (!uploaded) {
            setBusyId(null);
            return;
          }
          if (existing?.qr_storage_path) await removeStoragePath(existing.qr_storage_path);
          nextPath = uploaded;
        }
        const patch: Record<string, unknown> = {
          provider_type: providerType,
          display_label: label,
          account_name: name,
          account_number: number,
          is_active: isActive,
        };
        if (nextPath !== undefined) patch.qr_storage_path = nextPath;
        const { error } = await supabase.from("premium_platform_payment_accounts").update(patch).eq("id", editingId);
        if (error) {
          setMsg(error.message);
          return;
        }
        resetForm();
        await load();
      } finally {
        setBusyId(null);
      }
      return;
    }

    setBusyId("new");
    try {
      const { data: inserted, error: insErr } = await supabase
        .from("premium_platform_payment_accounts")
        .insert({
          provider_type: providerType,
          display_label: label,
          account_name: name,
          account_number: number,
          is_active: isActive,
        })
        .select("id")
        .single();
      if (insErr || !inserted?.id) {
        setMsg(insErr?.message ?? "Save failed.");
        return;
      }
      const id = inserted.id as string;
      if (qrFile) {
        const uploaded = await uploadQr(id, qrFile);
        if (!uploaded) {
          await supabase.from("premium_platform_payment_accounts").delete().eq("id", id);
          return;
        }
        const { error: upErr } = await supabase
          .from("premium_platform_payment_accounts")
          .update({ qr_storage_path: uploaded })
          .eq("id", id);
        if (upErr) {
          setMsg(upErr.message);
          void removeStoragePath(uploaded);
          await supabase.from("premium_platform_payment_accounts").delete().eq("id", id);
          return;
        }
      }
      resetForm();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm("Delete this payment account?")) return;
    setMsg(null);
    setBusyId(r.id);
    await removeStoragePath(r.qr_storage_path);
    const { error } = await supabase.from("premium_platform_payment_accounts").delete().eq("id", r.id);
    setBusyId(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (editingId === r.id) resetForm();
    await load();
  };

  const openQrPreview = async (path: string) => {
    setMsg(null);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error) {
      setMsg(error.message);
      return;
    }
    setPreviewUrl(data.signedUrl);
  };

  if (initialLoad) {
    return <AdminFormTableSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Premium</p>
          <h1 className="dash-title admin-page-hero__title">Platform payment accounts</h1>
          <p className="dash-sub admin-page-hero__sub" style={{ maxWidth: 640 }}>
            These are the GCash, Maya, PayPal, or other e-wallet instructions business owners see on the Premium upgrade
            page (account name, number, and QR). Use one active account per payment type; the newest entry is shown if
            duplicates exist.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--plans" aria-hidden />
      </header>

      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}

      <form className="card card--lift" onSubmit={(e) => void save(e)}>
        <h3 className="admin-form-card-title">{editingId ? "Edit account" : "Add account"}</h3>
        <div className="field">
          <label htmlFor="ppt">Payment type</label>
          <select id="ppt" value={providerType} onChange={(e) => setProviderType(e.target.value as Provider)}>
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="plab">Display label</label>
          <input
            id="plab"
            value={displayLabel}
            onChange={(e) => setDisplayLabel(e.target.value)}
            placeholder="e.g. DestinaPH GCash"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pname">Account name</label>
          <input id="pname" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pnum">Account number / email / mobile</label>
          <input id="pnum" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pqr">QR code (image)</label>
          <input
            id="pqr"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setQrFile(e.target.files?.[0] ?? null)}
          />
          <small className="form-footnote">
            Optional for PayPal-by-email and similar; upload when you want owners to scan a QR (GCash / Maya).
            {qrFile && ` Selected: ${qrFile.name}`}
          </small>
        </div>
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input id="pact" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <label htmlFor="pact" style={{ margin: 0 }}>
            Active (visible to owners)
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" type="submit" disabled={busyId !== null}>
            {busyId ? "Saving…" : editingId ? "Save changes" : "Add account"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={() => resetForm()}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="card card--table-shell" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Account</th>
              <th>QR</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.display_label}</td>
                <td>{r.provider_type}</td>
                <td>
                  <div style={{ fontSize: 13 }}>{r.account_name}</div>
                  <code style={{ fontSize: 12 }}>{r.account_number}</code>
                </td>
                <td>
                  {r.qr_storage_path ? (
                    <button type="button" className="btn btn-ghost" onClick={() => void openQrPreview(r.qr_storage_path!)}>
                      View
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{r.is_active ? "Yes" : "No"}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" className="btn btn-ghost" disabled={busyId !== null} onClick={() => startEdit(r)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busyId !== null}
                    onClick={() => void remove(r)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No payment accounts yet. Use the form above to add one.
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
            maxWidth: "min(420px, 96vw)",
            maxHeight: "92vh",
            overflow: "auto",
            padding: 16,
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 12px 48px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>QR preview</strong>
            <button type="button" className="btn btn-ghost" onClick={() => setPreviewUrl(null)}>
              Close
            </button>
          </div>
          <img src={previewUrl} alt="QR" style={{ width: "100%", height: "auto", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
