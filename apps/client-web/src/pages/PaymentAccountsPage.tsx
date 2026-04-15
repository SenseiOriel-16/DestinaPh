import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClientEditorSkeleton } from "../components/PageSkeletons";
import { SearchableSelect } from "../components/SearchableSelect";
import { supabase } from "../lib/supabaseClient";

type Biz = {
  id: string;
  name: string;
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
  pay_paypal_account_name: string | null;
  pay_gcash_account_label: string | null;
  pay_maya_account_label: string | null;
};

const QR_BUCKET = "booking-qrcodes";
const MAX_QR_BYTES = 5 * 1024 * 1024;

const E_WALLET_SAVE_SUCCESS = "E-wallet settings saved successfully.";

function publicQrUrl(path: string | null) {
  if (!path) return null;
  return supabase.storage.from(QR_BUCKET).getPublicUrl(path).data.publicUrl;
}

function ToggleSwitch({
  checked,
  onChange,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`ewallet-switch ${checked ? "ewallet-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ewallet-switch__knob" />
    </button>
  );
}

export function PaymentAccountsPage() {
  const [pageReady, setPageReady] = useState(false);
  const [rows, setRows] = useState<Biz[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const gcashInputRef = useRef<HTMLInputElement | null>(null);
  const mayaInputRef = useRef<HTMLInputElement | null>(null);

  const [gcashEnabled, setGcashEnabled] = useState(false);
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashLabelLegacy, setGcashLabelLegacy] = useState("");
  const [gcashQrPath, setGcashQrPath] = useState<string | null>(null);
  const [gcashQrFile, setGcashQrFile] = useState<File | null>(null);
  const [gcashLocalPreview, setGcashLocalPreview] = useState<string | null>(null);

  const [mayaEnabled, setMayaEnabled] = useState(false);
  const [mayaName, setMayaName] = useState("");
  const [mayaNumber, setMayaNumber] = useState("");
  const [mayaLabelLegacy, setMayaLabelLegacy] = useState("");
  const [mayaQrPath, setMayaQrPath] = useState<string | null>(null);
  const [mayaQrFile, setMayaQrFile] = useState<File | null>(null);
  const [mayaLocalPreview, setMayaLocalPreview] = useState<string | null>(null);

  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalAccountName, setPaypalAccountName] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");

  useEffect(() => {
    if (!gcashQrFile) {
      setGcashLocalPreview(null);
      return;
    }
    const u = URL.createObjectURL(gcashQrFile);
    setGcashLocalPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [gcashQrFile]);

  useEffect(() => {
    if (!mayaQrFile) {
      setMayaLocalPreview(null);
      return;
    }
    const u = URL.createObjectURL(mayaQrFile);
    setMayaLocalPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [mayaQrFile]);

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
        "id,name,pay_gcash_enabled,pay_gcash_qr_path,pay_gcash_account_name,pay_gcash_account_number,pay_maya_enabled,pay_maya_qr_path,pay_maya_account_name,pay_maya_account_number,pay_paypal_enabled,pay_paypal_email,pay_paypal_account_name,pay_gcash_account_label,pay_maya_account_label",
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

  useEffect(() => {
    if (msg !== E_WALLET_SAVE_SUCCESS) return;
    const t = window.setTimeout(() => setMsg(null), 5000);
    return () => window.clearTimeout(t);
  }, [msg]);

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
    setPaypalAccountName((b.pay_paypal_account_name ?? "").trim());
    setPaypalEmail((b.pay_paypal_email ?? "").trim());
  }, [selectedBiz?.id]);

  const pickQrFile = (file: File | null, which: "gcash" | "maya") => {
    if (!file) {
      if (which === "gcash") setGcashQrFile(null);
      else setMayaQrFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMsg("Please choose an image file (PNG or JPG).");
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      setMsg("QR image must be 5MB or smaller.");
      return;
    }
    setMsg(null);
    if (which === "gcash") setGcashQrFile(file);
    else setMayaQrFile(file);
  };

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

    if (existingPath && existingPath !== path) {
      await storage.remove([existingPath]);
    }

    return path;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
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
        pay_paypal_account_name: paypalEnabled ? paypalAccountName.trim() || null : null,
        pay_paypal_email: paypalEnabled ? paypalEmail.trim() || null : null,
      };

      const { error } = await supabase.from("businesses").update(payload).eq("id", selectedBiz.id);
      if (error) {
        setMsg(error.message);
        return;
      }
      await load();
      setMsg(E_WALLET_SAVE_SUCCESS);
    } finally {
      setBusy(false);
    }
  };

  const gcashQrDisplay = gcashLocalPreview ?? publicQrUrl(gcashQrPath);
  const mayaQrDisplay = mayaLocalPreview ?? publicQrUrl(mayaQrPath);

  const bizOptions = useMemo(() => rows.map((b) => ({ value: b.id, label: b.name })), [rows]);

  if (!pageReady) return <ClientEditorSkeleton />;

  return (
    <div className="ewallet-page page page--flush-top">
      <header className="ewallet-page__hero">
        <h1 className="ewallet-page__title">E-Wallet Settings</h1>
        <p className="ewallet-page__lead">Securely manage payment options you&apos;d like to receive.</p>
      </header>

      {msg ? (
        <div
          className={`alert-banner ${msg === E_WALLET_SAVE_SUCCESS ? "alert-banner--success" : "alert-banner--error"}`}
          role={msg === E_WALLET_SAVE_SUCCESS ? "status" : "alert"}
          aria-live="polite"
        >
          {msg}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state empty-state--compact ewallet-page__empty">
          <div className="empty-state__icon" aria-hidden>
            💳
          </div>
          <p className="empty-state__title">Create a listing first</p>
          <p className="empty-state__text">Add at least one listing, then return here to set up e-wallets.</p>
          <div className="empty-state__actions">
            <Link to="/listings/new" className="btn btn-primary btn-inline">
              + Add listing
            </Link>
          </div>
        </div>
      ) : (
        <form className="ewallet-card" onSubmit={(e) => void save(e)}>
          <div className="ewallet-card__listing">
            <label className="ewallet-card__listing-label" htmlFor="ewallet-biz">
              Property
            </label>
            <SearchableSelect
              id="ewallet-biz"
              className="ewallet-card__listing-select searchable-select--ewallet"
              value={selected}
              onChange={setSelected}
              options={bizOptions}
              placeholder="Choose a property"
              searchPlaceholder="Search properties…"
            />
          </div>

          <p className="ewallet-card__hint">
            GCash, Maya, and PayPal are side by side. Turn on a toggle to enable editing and to show that method to
            travelers in the app.
          </p>

          <div className="ewallet-columns">
            {/* GCash column */}
            <section className={`ewallet-col${gcashEnabled ? "" : " ewallet-col--off"}`} aria-labelledby="ewallet-col-gcash-title">
              <div className="ewallet-col__dropdown" id="ewallet-col-gcash-title">
                GCash
                <span className="ewallet-brand__badge ewallet-col__badge">Most popular</span>
              </div>
              <div className="ewallet-col__head">
                <div className="ewallet-brand">
                  <span className="ewallet-brand__logo ewallet-brand__logo--gcash" aria-hidden>
                    G
                  </span>
                </div>
                <div className="ewallet-panel__toggle ewallet-col__toggle">
                  <span className="ewallet-panel__toggle-label">Accept payments</span>
                  <ToggleSwitch checked={gcashEnabled} onChange={setGcashEnabled} id="sw-gcash" />
                </div>
              </div>

              <div className="ewallet-col__body">
                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="gcash-name">Account name</label>
                  <input
                    id="gcash-name"
                    value={gcashName}
                    onChange={(e) => setGcashName(e.target.value)}
                    placeholder="e.g. Juan dela Cruz"
                    autoComplete="off"
                    disabled={!gcashEnabled}
                  />
                </div>
                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="gcash-no">Account number</label>
                  <input
                    id="gcash-no"
                    value={gcashNumber}
                    onChange={(e) => setGcashNumber(e.target.value)}
                    placeholder="e.g. 09xxxxxxxxx"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={!gcashEnabled}
                  />
                </div>

                <div className={`ewallet-col__qr${!gcashEnabled ? " is-disabled" : ""}`}>
                  <label className="ewallet-upload">
                    <input
                      ref={gcashInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="ewallet-upload__input"
                      disabled={!gcashEnabled}
                      onChange={(e) => pickQrFile(e.target.files?.[0] ?? null, "gcash")}
                    />
                    <span
                      className="ewallet-upload__zone"
                      onDragOver={(ev) => gcashEnabled && ev.preventDefault()}
                      onDrop={(ev) => {
                        if (!gcashEnabled) return;
                        ev.preventDefault();
                        pickQrFile(ev.dataTransfer.files?.[0] ?? null, "gcash");
                      }}
                      onClick={() => gcashEnabled && gcashInputRef.current?.click()}
                      role="button"
                      tabIndex={gcashEnabled ? 0 : -1}
                      onKeyDown={(ev) => {
                        if (!gcashEnabled) return;
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          gcashInputRef.current?.click();
                        }
                      }}
                    >
                      <span className="ewallet-upload__cloud" aria-hidden>
                        ☁
                      </span>
                      <span className="ewallet-upload__title">Upload QR image</span>
                      <span className="ewallet-upload__hint">PNG, JPG up to 5MB</span>
                    </span>
                  </label>
                  <div className="ewallet-qr-preview ewallet-qr-preview--col">
                    {gcashQrDisplay ? (
                      <img src={gcashQrDisplay} alt="GCash QR preview" className="ewallet-qr-preview__img" />
                    ) : (
                      <div className="ewallet-qr-preview__ph">Preview</div>
                    )}
                  </div>
                </div>

                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="gcash-legacy">Legacy label (optional)</label>
                  <input
                    id="gcash-legacy"
                    value={gcashLabelLegacy}
                    onChange={(e) => setGcashLabelLegacy(e.target.value)}
                    placeholder="09xx / Juan D."
                    autoComplete="off"
                    disabled={!gcashEnabled}
                  />
                  <small className="ewallet-field__hint">Older app versions.</small>
                </div>
              </div>
            </section>

            {/* Maya column */}
            <section className={`ewallet-col${mayaEnabled ? "" : " ewallet-col--off"}`} aria-labelledby="ewallet-col-maya-title">
              <div className="ewallet-col__dropdown" id="ewallet-col-maya-title">
                Maya
              </div>
              <div className="ewallet-col__head">
                <div className="ewallet-brand">
                  <span className="ewallet-brand__logo ewallet-brand__logo--maya" aria-hidden>
                    M
                  </span>
                </div>
                <div className="ewallet-panel__toggle ewallet-col__toggle">
                  <span className="ewallet-panel__toggle-label">Accept payments</span>
                  <ToggleSwitch checked={mayaEnabled} onChange={setMayaEnabled} id="sw-maya" />
                </div>
              </div>

              <div className="ewallet-col__body">
                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="maya-name">Account name</label>
                  <input
                    id="maya-name"
                    value={mayaName}
                    onChange={(e) => setMayaName(e.target.value)}
                    placeholder="e.g. Juan dela Cruz"
                    autoComplete="off"
                    disabled={!mayaEnabled}
                  />
                </div>
                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="maya-no">Account number</label>
                  <input
                    id="maya-no"
                    value={mayaNumber}
                    onChange={(e) => setMayaNumber(e.target.value)}
                    placeholder="e.g. 09xxxxxxxxx"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={!mayaEnabled}
                  />
                </div>

                <div className={`ewallet-col__qr${!mayaEnabled ? " is-disabled" : ""}`}>
                  <label className="ewallet-upload">
                    <input
                      ref={mayaInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="ewallet-upload__input"
                      disabled={!mayaEnabled}
                      onChange={(e) => pickQrFile(e.target.files?.[0] ?? null, "maya")}
                    />
                    <span
                      className="ewallet-upload__zone"
                      onDragOver={(ev) => mayaEnabled && ev.preventDefault()}
                      onDrop={(ev) => {
                        if (!mayaEnabled) return;
                        ev.preventDefault();
                        pickQrFile(ev.dataTransfer.files?.[0] ?? null, "maya");
                      }}
                      onClick={() => mayaEnabled && mayaInputRef.current?.click()}
                      role="button"
                      tabIndex={mayaEnabled ? 0 : -1}
                      onKeyDown={(ev) => {
                        if (!mayaEnabled) return;
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          mayaInputRef.current?.click();
                        }
                      }}
                    >
                      <span className="ewallet-upload__cloud" aria-hidden>
                        ☁
                      </span>
                      <span className="ewallet-upload__title">Upload QR image</span>
                      <span className="ewallet-upload__hint">PNG, JPG up to 5MB</span>
                    </span>
                  </label>
                  <div className="ewallet-qr-preview ewallet-qr-preview--col">
                    {mayaQrDisplay ? (
                      <img src={mayaQrDisplay} alt="Maya QR preview" className="ewallet-qr-preview__img" />
                    ) : (
                      <div className="ewallet-qr-preview__ph">Preview</div>
                    )}
                  </div>
                </div>

                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="maya-legacy">Legacy label (optional)</label>
                  <input
                    id="maya-legacy"
                    value={mayaLabelLegacy}
                    onChange={(e) => setMayaLabelLegacy(e.target.value)}
                    placeholder="09xx / Juan D."
                    autoComplete="off"
                    disabled={!mayaEnabled}
                  />
                  <small className="ewallet-field__hint">Older app versions.</small>
                </div>
              </div>
            </section>

            {/* PayPal column */}
            <section className={`ewallet-col${paypalEnabled ? "" : " ewallet-col--off"}`} aria-labelledby="ewallet-col-paypal-title">
              <div className="ewallet-col__dropdown" id="ewallet-col-paypal-title">
                PayPal
              </div>
              <div className="ewallet-col__head">
                <div className="ewallet-brand">
                  <span className="ewallet-brand__logo ewallet-brand__logo--paypal" aria-hidden>
                    P
                  </span>
                </div>
                <div className="ewallet-panel__toggle ewallet-col__toggle">
                  <span className="ewallet-panel__toggle-label">Accept payments</span>
                  <ToggleSwitch checked={paypalEnabled} onChange={setPaypalEnabled} id="sw-paypal" />
                </div>
              </div>

              <div className="ewallet-col__body">
                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="paypal-name">Account name</label>
                  <input
                    id="paypal-name"
                    value={paypalAccountName}
                    onChange={(e) => setPaypalAccountName(e.target.value)}
                    placeholder="e.g. Bluish Resort"
                    autoComplete="off"
                    disabled={!paypalEnabled}
                  />
                </div>
                <div className="ewallet-field ewallet-field--full">
                  <label htmlFor="paypal-email">PayPal email or PayPal.me</label>
                  <input
                    id="paypal-email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="you@email.com or paypal.me/yourname"
                    autoComplete="off"
                    disabled={!paypalEnabled}
                  />
                </div>

                <div className="ewallet-col__qr ewallet-col__qr--paypal-static">
                  <div className="ewallet-paypal-qr-placeholder" aria-hidden>
                    <span className="ewallet-paypal-qr-placeholder__label">QR image</span>
                    <span className="ewallet-paypal-qr-placeholder__text">
                      PayPal does not use a guest-scanned QR here. Travelers pay using the email or link above.
                    </span>
                  </div>
                  <div className="ewallet-qr-preview ewallet-qr-preview--col ewallet-qr-preview--na">
                    <div className="ewallet-qr-preview__ph">Not applicable</div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="ewallet-card__footer">
            <button className="btn btn-primary ewallet-card__save" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
