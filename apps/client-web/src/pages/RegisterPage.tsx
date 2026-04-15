import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { SearchableSelect } from "../components/SearchableSelect";
import { supabase } from "../lib/supabaseClient";
import {
  fetchBarangays,
  fetchCitiesAndMunicipalities,
  fetchProvinces,
  normalizePsgcCode,
  type PsgcBarangay,
  type PsgcCityMunicipality,
  type PsgcProvince,
} from "../lib/psgcApi";

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");

  const [psgcProvinces, setPsgcProvinces] = useState<PsgcProvince[]>([]);
  const [psgcMuns, setPsgcMuns] = useState<PsgcCityMunicipality[]>([]);
  const [psgcBrgys, setPsgcBrgys] = useState<PsgcBarangay[]>([]);
  const [geoProvCode, setGeoProvCode] = useState("");
  const [geoMunCode, setGeoMunCode] = useState("");
  const [geoBrgyCode, setGeoBrgyCode] = useState("");
  const [geoLoadingMun, setGeoLoadingMun] = useState(false);
  const [geoLoadingBrgy, setGeoLoadingBrgy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [addressLine, setAddressLine] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const provinceOptions = useMemo(
    () => psgcProvinces.map((p) => ({ value: p.code, label: p.name })),
    [psgcProvinces],
  );
  const municipalityOptions = useMemo(
    () =>
      psgcMuns.map((m) => ({
        value: m.code,
        label: `${m.name}${m.isCity ? " (City)" : m.isMunicipality ? " (Mun.)" : ""}`,
      })),
    [psgcMuns],
  );
  const barangayOptions = useMemo(
    () => psgcBrgys.map((b) => ({ value: b.code, label: b.name })),
    [psgcBrgys],
  );

  useEffect(() => {
    void (async () => {
      try {
        setGeoError(null);
        const provs = await fetchProvinces();
        setPsgcProvinces(provs);
      } catch (e) {
        setGeoError(e instanceof Error ? e.message : "Could not load provinces (PSGC API).");
      }
    })();
  }, []);

  useEffect(() => {
    if (!geoProvCode) {
      setPsgcMuns([]);
      setPsgcBrgys([]);
      setGeoMunCode("");
      setGeoBrgyCode("");
      return;
    }
    let cancelled = false;
    void (async () => {
      setGeoLoadingMun(true);
      setGeoError(null);
      try {
        const muns = await fetchCitiesAndMunicipalities(geoProvCode);
        if (cancelled) return;
        setPsgcMuns(muns);
        setGeoMunCode((prev) => {
          const p = normalizePsgcCode(prev);
          return muns.some((m) => m.code === p) ? p : "";
        });
        setPsgcBrgys([]);
        setGeoBrgyCode("");
      } catch (e) {
        if (!cancelled) setGeoError(e instanceof Error ? e.message : "Could not load cities/municipalities.");
      } finally {
        if (!cancelled) setGeoLoadingMun(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geoProvCode]);

  useEffect(() => {
    if (!geoMunCode) {
      setPsgcBrgys([]);
      setGeoBrgyCode("");
      return;
    }
    let cancelled = false;
    void (async () => {
      setGeoLoadingBrgy(true);
      setGeoError(null);
      try {
        const brs = await fetchBarangays(geoMunCode);
        if (cancelled) return;
        setPsgcBrgys(brs);
        setGeoBrgyCode((prev) => {
          const p = normalizePsgcCode(prev);
          return brs.some((b) => b.code === p) ? p : "";
        });
      } catch (e) {
        if (!cancelled) setGeoError(e instanceof Error ? e.message : "Could not load barangays.");
      } finally {
        if (!cancelled) setGeoLoadingBrgy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geoMunCode]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!geoProvCode || !geoMunCode) {
      setError("Please select province and city/municipality.");
      return;
    }
    const provName = psgcProvinces.find((p) => p.code === geoProvCode)?.name ?? "";
    const munName = psgcMuns.find((m) => m.code === geoMunCode)?.name ?? "";
    const brgyName = geoBrgyCode ? (psgcBrgys.find((b) => b.code === geoBrgyCode)?.name ?? "") : "";

    setBusy(true);
    setError(null);
    const { error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          business_name: businessName,
          phone,
          role: "business_owner",
          address_line: addressLine.trim() || null,
          psgc_province_code: geoProvCode,
          psgc_municipality_code: geoMunCode,
          psgc_barangay_code: geoBrgyCode.trim() || null,
          psgc_province_name: provName || null,
          psgc_municipality_name: munName || null,
          psgc_barangay_name: brgyName || null,
        },
      },
    });
    if (signErr) {
      setError(signErr.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    navigate("/login", { state: { pendingOwnerApproval: true } });
  };

  return (
    <AuthSplitLayout variant="client" formScrollClassName="auth-split__form-inner--wide">
      <div className="auth-card auth-card--wide">
          <h2>Create your business account</h2>
          <p className="auth-lead">
            Your business owner account must be approved by an admin before you can sign in. Once active, listings do
            not require admin approval.
          </p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <div className="input-with-icon">
                <span>👤</span>
                <input
                  id="fullName"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="biz">Business name</label>
              <div className="input-with-icon">
                <span>🏪</span>
                <input
                  id="biz"
                  placeholder="Enter business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="phone">Contact number</label>
              <div className="input-with-icon">
                <span>📱</span>
                <input
                  id="phone"
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {geoError && <div className="alert-banner alert-banner--error">{geoError}</div>}

            <div className="field">
              <label htmlFor="prov">Province</label>
              <div className="input-with-icon">
                <span>📍</span>
                <SearchableSelect
                  id="prov"
                  value={geoProvCode}
                  onChange={setGeoProvCode}
                  options={provinceOptions}
                  disabled={!psgcProvinces.length}
                  placeholder="— Select province —"
                  searchPlaceholder="Search province…"
                  allowClear
                  clearLabel="— Select province —"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="mun">City / Municipality</label>
              <div className="input-with-icon">
                <span>📍</span>
                <SearchableSelect
                  id="mun"
                  value={geoMunCode}
                  onChange={setGeoMunCode}
                  options={municipalityOptions}
                  disabled={!geoProvCode || geoLoadingMun}
                  placeholder={geoLoadingMun ? "Loading…" : "— Select city or municipality —"}
                  searchPlaceholder="Search city or municipality…"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="brgy">Barangay (optional)</label>
              <div className="input-with-icon">
                <span>📍</span>
                <SearchableSelect
                  id="brgy"
                  value={geoBrgyCode}
                  onChange={setGeoBrgyCode}
                  options={barangayOptions}
                  disabled={!geoMunCode || geoLoadingBrgy}
                  placeholder={geoLoadingBrgy ? "Loading…" : "— No barangay selected —"}
                  searchPlaceholder="Search barangay…"
                  allowClear
                  clearLabel="— No barangay selected —"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="addr">Zone & street</label>
              <div className="input-with-icon">
                <span>📍</span>
                <input
                  id="addr"
                  placeholder="Street, zone, landmark"
                  autoComplete="street-address"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input-with-icon">
                <span>✉</span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <span>🔒</span>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-pw"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <div className="input-with-icon">
                <span>🔒</span>
                <input
                  id="confirm"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Submitting…" : "Create Account"}
            </button>
          </form>
          <div className="auth-footer">
            <p style={{ marginBottom: 0 }}>
              Already have an account? <Link to="/login">Sign in here</Link>
            </p>
          </div>
        </div>
    </AuthSplitLayout>
  );
}
