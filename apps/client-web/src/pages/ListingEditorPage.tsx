import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SearchableSelect } from "../components/SearchableSelect";
import { supabase } from "../lib/supabaseClient";
import { type AccommodationItem } from "../lib/accommodations";
import {
  fetchBarangays,
  fetchCitiesAndMunicipalities,
  fetchProvinces,
  type PsgcBarangay,
  type PsgcCityMunicipality,
  type PsgcProvince,
} from "../lib/psgcApi";
import { compressListingImage, MAX_LISTING_PHOTOS } from "../lib/compressListingImage";

type Category = { id: string; name: string; slug: string };
type AccRow = AccommodationItem;

const RESORT_SLUG = "resorts-leisure";

function psgcCodeFromSlug(slug: string | null | undefined): string | null {
  if (!slug?.startsWith("psgc-")) return null;
  return slug.slice(5);
}

type RpcGeoRow = {
  out_province_id: string;
  out_municipality_id: string;
  out_barangay_id: string | null;
};

export function ListingEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [categories, setCategories] = useState<Category[]>([]);
  const [psgcProvinces, setPsgcProvinces] = useState<PsgcProvince[]>([]);
  const [psgcMuns, setPsgcMuns] = useState<PsgcCityMunicipality[]>([]);
  const [psgcBrgys, setPsgcBrgys] = useState<PsgcBarangay[]>([]);

  const [geoProvCode, setGeoProvCode] = useState("");
  const [geoMunCode, setGeoMunCode] = useState("");
  const [geoBrgyCode, setGeoBrgyCode] = useState("");
  const [geoLoadingMun, setGeoLoadingMun] = useState(false);
  const [geoLoadingBrgy, setGeoLoadingBrgy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [legacyGeoNote, setLegacyGeoNote] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [operatingDay, setOperatingDay] = useState(false);
  const [operatingNight, setOperatingNight] = useState(false);
  const [entranceFeeDay, setEntranceFeeDay] = useState("");
  const [entranceFeeNight, setEntranceFeeNight] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [latitudeStr, setLatitudeStr] = useState("");
  const [longitudeStr, setLongitudeStr] = useState("");
  const [accommodations, setAccommodations] = useState<AccRow[]>([
    { name: "", pax: "", price_pesos: 0, available: true },
  ]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingPhotoCount, setExistingPhotoCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveSuccessKind, setSaveSuccessKind] = useState<null | "created" | "updated">(null);

  const categorySlug = categories.find((c) => c.id === categoryId)?.slug ?? "";
  const isResort = categorySlug === RESORT_SLUG;

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
      const { data: cats } = await supabase.from("categories").select("id,name,slug").order("name");
      setCategories((cats as Category[]) ?? []);
      if (cats?.[0]) setCategoryId((prev) => prev || cats[0].id);
      try {
        setGeoError(null);
        const provs = await fetchProvinces();
        setPsgcProvinces(provs);
      } catch (e) {
        setGeoError(e instanceof Error ? e.message : "Could not load provinces (PSGC API).");
      }
    })();
  }, []);

  const dismissSaveSuccess = useCallback(() => {
    setSaveSuccessKind(null);
    navigate("/listings");
  }, [navigate]);

  useEffect(() => {
    if (!saveSuccessKind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissSaveSuccess();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveSuccessKind, dismissSaveSuccess]);

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
        setGeoMunCode((prev) => (muns.some((m) => m.code === prev) ? prev : ""));
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
        setGeoBrgyCode((prev) => (brs.some((b) => b.code === prev) ? prev : ""));
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

  useEffect(() => {
    if (!isResort) {
      setOperatingDay(false);
      setOperatingNight(false);
      setEntranceFeeDay("");
      setEntranceFeeNight("");
    }
  }, [isResort]);

  useEffect(() => {
    if (isNew) {
      setExistingPhotoCount(0);
    }
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*, categories(slug)")
        .eq("id", id!)
        .maybeSingle();
      if (error || !data) {
        setMsg(error?.message ?? "Listing not found");
        return;
      }
      const row = data as Record<string, unknown> & {
        tags?: string[] | null;
        accommodations?: AccRow[] | null;
        categories?: { slug?: string } | null;
        operating_day?: boolean | null;
        operating_night?: boolean | null;
        entrance_fee_day_pesos?: number | null;
        entrance_fee_night_pesos?: number | null;
      };
      setName(String(row.name ?? ""));
      setCategoryId(String(row.category_id ?? ""));
      setShortDescription(String(row.short_description ?? row.description ?? ""));
      setTags(Array.isArray(row.tags) ? row.tags : []);

      const catRel = row.categories;
      const catSlug =
        (Array.isArray(catRel) ? (catRel[0] as { slug?: string } | undefined)?.slug : catRel?.slug) ?? "";
      const rowIsResort = catSlug === RESORT_SLUG;
      const od = Boolean(row.operating_day);
      const on = Boolean(row.operating_night);
      const dFee = row.entrance_fee_day_pesos;
      const nFee = row.entrance_fee_night_pesos;
      if (rowIsResort && (od || on || dFee != null || nFee != null)) {
        setOperatingDay(od);
        setOperatingNight(on);
        setEntranceFeeDay(dFee != null ? String(dFee) : "");
        setEntranceFeeNight(nFee != null ? String(nFee) : "");
      } else if (rowIsResort && row.entrance_fee_pesos != null) {
        setOperatingDay(true);
        setOperatingNight(false);
        setEntranceFeeDay(String(row.entrance_fee_pesos));
        setEntranceFeeNight("");
      } else {
        setOperatingDay(false);
        setOperatingNight(false);
        setEntranceFeeDay("");
        setEntranceFeeNight("");
      }
      setAddressLine(String(row.address_line ?? ""));
      const latRaw = row.latitude as number | string | null | undefined;
      const lngRaw = row.longitude as number | string | null | undefined;
      setLatitudeStr(latRaw != null && latRaw !== "" ? String(latRaw) : "");
      setLongitudeStr(lngRaw != null && lngRaw !== "" ? String(lngRaw) : "");
      const acc = row.accommodations;
      if (Array.isArray(acc) && acc.length) {
        setAccommodations(
          acc.map((a: Record<string, unknown>) => ({
            name: String(a.name ?? ""),
            pax: String(a.pax ?? a.pax_label ?? ""),
            price_pesos: Number(a.price_pesos ?? 0),
            available: a.available !== false,
          })),
        );
      }

      const { count: photoCount, error: photoCountErr } = await supabase
        .from("business_photos")
        .select("id", { count: "exact", head: true })
        .eq("business_id", id!);
      setExistingPhotoCount(photoCountErr ? 0 : photoCount ?? 0);

      const muniId = String(row.municipality_id ?? "");
      setLegacyGeoNote(null);
      if (!muniId) return;

      const { data: mun, error: munErr } = await supabase
        .from("municipalities")
        .select("slug, name, provinces ( slug, name )")
        .eq("id", muniId)
        .maybeSingle();

      if (munErr || !mun) return;

      const provSlug = (mun as { provinces?: { slug?: string; name?: string } | null }).provinces?.slug;
      const munSlug = (mun as { slug?: string; name?: string }).slug;
      const provCode = psgcCodeFromSlug(provSlug);
      const munCode = psgcCodeFromSlug(munSlug);

      if (provCode && munCode) {
        setGeoProvCode(provCode);
        try {
          const muns = await fetchCitiesAndMunicipalities(provCode);
          setPsgcMuns(muns);
          setGeoMunCode(munCode);
          const brgyId = String(row.barangay_id ?? "");
          if (brgyId) {
            const { data: br } = await supabase.from("barangays").select("slug").eq("id", brgyId).maybeSingle();
            const brCode = psgcCodeFromSlug((br as { slug?: string } | null)?.slug);
            if (brCode) {
              const brs = await fetchBarangays(munCode);
              setPsgcBrgys(brs);
              setGeoBrgyCode(brCode);
            }
          }
        } catch {
          setLegacyGeoNote(
            "The saved address could not be matched to the PSGC list. Please select province and city/municipality again.",
          );
        }
      } else {
        const pName = (mun as { provinces?: { name?: string } | null }).provinces?.name ?? "";
        const mName = (mun as { name?: string }).name ?? "";
        setLegacyGeoNote(
          `Legacy address (not in PSGC): ${pName} → ${mName}. Please re-select using the new dropdowns.`,
        );
      }
    })();
  }, [id, isNew]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const addAccRow = () =>
    setAccommodations((prev) => [...prev, { name: "", pax: "", price_pesos: 0, available: true }]);

  const setAcc = (i: number, patch: Partial<AccRow>) =>
    setAccommodations((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const removeAccRow = (i: number) =>
    setAccommodations((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));

  const uploadMany = async (businessId: string, files: File[]) => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid || files.length === 0) return;
    let sort = 0;
    for (const file of files) {
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("business-images").upload(path, file, {
        upsert: true,
        contentType: "image/jpeg",
      });
      if (upErr) throw new Error(upErr.message);
      const { error: insErr } = await supabase.from("business_photos").insert({
        business_id: businessId,
        storage_path: path,
        sort_order: sort++,
      });
      if (insErr) throw new Error(insErr.message);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      setMsg("Not authenticated");
      setBusy(false);
      return;
    }
    if (existingPhotoCount + pendingFiles.length > MAX_LISTING_PHOTOS) {
      setMsg(`Maximum ${MAX_LISTING_PHOTOS} photos per listing.`);
      setBusy(false);
      return;
    }
    if (!geoProvCode || !geoMunCode) {
      setMsg("Please select a province and city/municipality.");
      setBusy(false);
      return;
    }
    const provName = psgcProvinces.find((p) => p.code === geoProvCode)?.name ?? geoProvCode;
    const munName = psgcMuns.find((m) => m.code === geoMunCode)?.name ?? geoMunCode;
    const brgyName = geoBrgyCode ? (psgcBrgys.find((b) => b.code === geoBrgyCode)?.name ?? "") : "";

    const { data: rpcRows, error: rpcErr } = await supabase.rpc("ensure_address_from_psgc", {
      p_province_code: geoProvCode,
      p_municipality_code: geoMunCode,
      p_barangay_code: geoBrgyCode || null,
      p_province_name: provName,
      p_municipality_name: munName,
      p_barangay_name: brgyName || null,
    });

    if (rpcErr) {
      setMsg(
        rpcErr.message.includes("ensure_address_from_psgc")
          ? "The database function `ensure_address_from_psgc` is not deployed. Run migration 20260413160000."
          : rpcErr.message,
      );
      setBusy(false);
      return;
    }

    const geo = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as RpcGeoRow | undefined;
    if (!geo?.out_municipality_id) {
      setMsg("Could not resolve the address.");
      setBusy(false);
      return;
    }

    const accPayload = accommodations
      .filter((a) => a.name.trim())
      .map((a) => ({
        name: a.name.trim(),
        pax: a.pax.trim(),
        price_pesos: Math.max(0, Math.round(Number(a.price_pesos) || 0)),
        available: Boolean(a.available),
      }));

    let latitude: number | null = null;
    let longitude: number | null = null;
    const latTrim = latitudeStr.trim();
    const lngTrim = longitudeStr.trim();
    if (latTrim || lngTrim) {
      if (!latTrim || !lngTrim) {
        setMsg("Enter both latitude and longitude for the map pin, or leave both fields empty.");
        setBusy(false);
        return;
      }
      const la = Number(latTrim);
      const lo = Number(lngTrim);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        setMsg("Latitude and longitude must be valid numbers.");
        setBusy(false);
        return;
      }
      if (la < -90 || la > 90 || lo < -180 || lo > 180) {
        setMsg("Latitude must be between -90 and 90, longitude between -180 and 180.");
        setBusy(false);
        return;
      }
      latitude = la;
      longitude = lo;
    }

    let entrance_fee_pesos: number | null = null;
    let pricing_text: string | null = null;
    let operating_day = false;
    let operating_night = false;
    let entrance_fee_day_pesos: number | null = null;
    let entrance_fee_night_pesos: number | null = null;

    if (isResort) {
      operating_day = operatingDay;
      operating_night = operatingNight;
      if (operatingDay) {
        if (entranceFeeDay.trim() === "" || Number.isNaN(Number(entranceFeeDay))) {
          setMsg("Please enter the day entrance fee (₱), or uncheck Day.");
          setBusy(false);
          return;
        }
        entrance_fee_day_pesos = Math.max(0, Math.round(Number(entranceFeeDay)));
      }
      if (operatingNight) {
        if (entranceFeeNight.trim() === "" || Number.isNaN(Number(entranceFeeNight))) {
          setMsg("Please enter the night entrance fee (₱), or uncheck Night.");
          setBusy(false);
          return;
        }
        entrance_fee_night_pesos = Math.max(0, Math.round(Number(entranceFeeNight)));
      }
      const parts: string[] = [];
      if (operatingDay && entrance_fee_day_pesos != null) {
        parts.push(`Day: ₱${entrance_fee_day_pesos}`);
      }
      if (operatingNight && entrance_fee_night_pesos != null) {
        parts.push(`Night: ₱${entrance_fee_night_pesos}`);
      }
      pricing_text = parts.length ? parts.join(" · ") : null;
      const candidates = [
        operatingDay ? entrance_fee_day_pesos : null,
        operatingNight ? entrance_fee_night_pesos : null,
      ].filter((x): x is number => x != null);
      entrance_fee_pesos = candidates.length ? Math.min(...candidates) : null;
    }

    const payload = {
      owner_id: uid,
      name: name.trim(),
      category_id: categoryId,
      subcategory: null as string | null,
      short_description: shortDescription.trim() || null,
      description: shortDescription.trim() || null,
      tags: tags.length ? tags : [],
      operating_day,
      operating_night,
      entrance_fee_day_pesos,
      entrance_fee_night_pesos,
      entrance_fee_pesos,
      province_id: geo.out_province_id || null,
      municipality_id: geo.out_municipality_id,
      barangay_id: geo.out_barangay_id || null,
      address_line: addressLine.trim() || null,
      accommodations: accPayload,
      pricing_text,
      latitude,
      longitude,
      status: "approved" as const,
    };
    try {
      if (isNew) {
        const { data, error } = await supabase
          .from("businesses")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) {
          setMsg(error?.message ?? "Unable to create");
          setBusy(false);
          return;
        }
        if (pendingFiles.length) await uploadMany(data.id, pendingFiles);
        setPendingFiles([]);
        setMsg(null);
        setSaveSuccessKind("created");
      } else {
        const { error } = await supabase.from("businesses").update(payload).eq("id", id!);
        if (error) {
          setMsg(error.message);
          setBusy(false);
          return;
        }
        if (pendingFiles.length) {
          await uploadMany(id!, pendingFiles);
          setExistingPhotoCount((c) => c + pendingFiles.length);
        }
        setPendingFiles([]);
        setMsg(null);
        setSaveSuccessKind("updated");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    }
    setBusy(false);
  };

  const ingestImageFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const raw = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (!raw.length) return;
    const slots = MAX_LISTING_PHOTOS - existingPhotoCount - pendingFiles.length;
    if (slots <= 0) {
      setMsg(`Maximum ${MAX_LISTING_PHOTOS} photos per listing (including photos already saved).`);
      return;
    }
    const take = raw.slice(0, slots);
    if (raw.length > take.length) {
      setMsg(`Only ${take.length} more photo(s) added (max ${MAX_LISTING_PHOTOS} total).`);
    }
    const compressed: File[] = [];
    for (const f of take) {
      try {
        compressed.push(await compressListingImage(f));
      } catch {
        setMsg("Could not process an image. Try JPG or PNG under ~20MB.");
        return;
      }
    }
    setPendingFiles((prev) => [...prev, ...compressed]);
  };

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    void ingestImageFiles(ev.dataTransfer.files);
  };

  return (
    <div className="page page--flush-top">
      <div className="editor-head">
        <Link to="/listings" className="link-back">
          ← Back
        </Link>
        <h1 className="dash-title" style={{ margin: "8px 0 0" }}>
          {isNew ? "Add New Listing" : "Edit Listing"}
        </h1>
      </div>
      {msg && (
        <div className="card" style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <div className="editor-grid">
          <div className="card editor-card">
            <h2 className="editor-card__title">Business information</h2>
            <div className="field">
              <label htmlFor="name">Business name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="cat">Category</label>
              <select id="cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="short">Short description</label>
              <textarea
                id="short"
                rows={4}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief highlight for travelers"
                required
              />
            </div>
            <div className="field">
              <label>Tags</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="pill approved"
                    style={{ cursor: "pointer", border: "none" }}
                    onClick={() => removeTag(t)}
                  >
                    {t} ×
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Type a tag and press Add"
                />
                <button type="button" className="btn btn-outline" onClick={addTag}>
                  Add tag
                </button>
              </div>
            </div>
            {isResort && (
              <>
                <div className="field">
                  <span className="field__group-label" id="operating-hours-label">
                    Operating hours
                  </span>
                  <div
                    className="field-checkbox-row"
                    role="group"
                    aria-labelledby="operating-hours-label"
                  >
                    <label className="field-checkbox">
                      <input
                        type="checkbox"
                        checked={operatingDay}
                        onChange={(e) => setOperatingDay(e.target.checked)}
                      />
                      <span>Day</span>
                    </label>
                    <label className="field-checkbox">
                      <input
                        type="checkbox"
                        checked={operatingNight}
                        onChange={(e) => setOperatingNight(e.target.checked)}
                      />
                      <span>Night</span>
                    </label>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
                    Check when you are open; set the entrance fee for each period you offer.
                  </p>
                </div>
                {operatingDay && (
                  <div className="field">
                    <label htmlFor="fee-day">Day entrance fee (₱)</label>
                    <input
                      id="fee-day"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 350"
                      value={entranceFeeDay}
                      onChange={(e) => setEntranceFeeDay(e.target.value)}
                    />
                  </div>
                )}
                {operatingNight && (
                  <div className="field">
                    <label htmlFor="fee-night">Night entrance fee (₱)</label>
                    <input
                      id="fee-night"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 400"
                      value={entranceFeeNight}
                      onChange={(e) => setEntranceFeeNight(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card editor-card">
            <h2 className="editor-card__title">Address & resort images</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
              Provinces, cities/municipalities, and barangays come from the official{" "}
              <strong>PSGC</strong> (Philippine Standard Geographic Code) public API (
              <a href="https://psgc.gitlab.io/" target="_blank" rel="noreferrer">
                psgc.gitlab.io
              </a>
              ).
            </p>
            {geoError && (
              <p style={{ fontSize: 13, color: "var(--danger, #c0392b)", marginBottom: 12 }}>{geoError}</p>
            )}
            {legacyGeoNote && (
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>{legacyGeoNote}</p>
            )}

            <div className="field">
              <label htmlFor="prov">Province</label>
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
            <div className="field">
              <label htmlFor="mun">City / Municipality</label>
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
            <div className="field">
              <label htmlFor="brgy">Barangay (optional)</label>
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
            <div className="field">
              <label htmlFor="addr">Zone & street</label>
              <input
                id="addr"
                placeholder="Street, zone, landmark"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
              />
            </div>

            <div className="field">
              <span className="field__group-label">Map location (optional)</span>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>
                Used for the traveler app map and directions. Get coordinates from Google Maps (long-press the pin, then
                copy latitude / longitude).
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label htmlFor="lat">Latitude</label>
                  <input
                    id="lat"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 13.6218"
                    value={latitudeStr}
                    onChange={(e) => setLatitudeStr(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="lng">Longitude</label>
                  <input
                    id="lng"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 123.1875"
                    value={longitudeStr}
                    onChange={(e) => setLongitudeStr(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <label>Accommodations</label>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>
                Name, capacity (pax), price in pesos, and whether this type is still available for guests — add as
                many rows as you need.
              </p>
              <div className="acc-editor-rows">
                {accommodations.map((row, i) => (
                  <div className="acc-editor-row" key={i}>
                    <input
                      placeholder="e.g. Cabin"
                      value={row.name}
                      onChange={(e) => setAcc(i, { name: e.target.value })}
                    />
                    <input
                      placeholder="e.g. 4-6 pax"
                      value={row.pax}
                      onChange={(e) => setAcc(i, { pax: e.target.value })}
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="₱"
                      value={row.price_pesos || ""}
                      onChange={(e) => setAcc(i, { price_pesos: Number(e.target.value) || 0 })}
                    />
                    <label className="acc-editor-avail">
                      <input
                        type="checkbox"
                        checked={row.available}
                        onChange={(e) => setAcc(i, { available: e.target.checked })}
                      />
                      <span>Available</span>
                    </label>
                    <button type="button" className="icon-btn" onClick={() => removeAccRow(i)} title="Remove">
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-outline" style={{ marginTop: 10 }} onClick={addAccRow}>
                + Add accommodation
              </button>
            </div>

            <div className="field">
              <label>Resort images</label>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>
                Up to {MAX_LISTING_PHOTOS} photos total (including photos already saved). Each file is resized and
                saved as JPEG before upload to save storage.
              </p>
              <div
                className="upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => {
                  if (existingPhotoCount + pendingFiles.length >= MAX_LISTING_PHOTOS) return;
                  document.getElementById("imgs")?.click();
                }}
                role="presentation"
                style={{
                  opacity: existingPhotoCount + pendingFiles.length >= MAX_LISTING_PHOTOS ? 0.55 : 1,
                  pointerEvents: existingPhotoCount + pendingFiles.length >= MAX_LISTING_PHOTOS ? "none" : "auto",
                }}
              >
                <span className="upload-zone__icon">⬆</span>
                <p>
                  <strong>Upload images</strong>
                </p>
                <p className="upload-zone__hint">
                  Drag and drop or click — max {MAX_LISTING_PHOTOS} photos ({existingPhotoCount} saved,{" "}
                  {pendingFiles.length} queued)
                </p>
                {pendingFiles.length > 0 && (
                  <ul style={{ fontSize: 13, marginTop: 10, textAlign: "left", listStyle: "none", padding: 0 }}>
                    {pendingFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Remove"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setPendingFiles((prev) => prev.filter((_, j) => j !== i));
                          }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  id="imgs"
                  type="file"
                  accept="image/*"
                  multiple
                  className="upload-zone__input"
                  onChange={(e) => {
                    const list = e.target.files;
                    void (async () => {
                      await ingestImageFiles(list);
                      e.target.value = "";
                    })();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="page-footer-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate("/listings")}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-inline"
            type="submit"
            disabled={busy || !!saveSuccessKind}
          >
            {busy ? "Saving…" : "Save Listing"}
          </button>
        </div>
      </form>

      {saveSuccessKind ? (
        <div className="modal-backdrop" role="presentation" onClick={dismissSaveSuccess}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-success-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="save-success-title" className="modal-card__title">
              {saveSuccessKind === "created" ? "Listing created" : "Saved"}
            </h2>
            <p className="modal-card__body">
              {saveSuccessKind === "created"
                ? "Your new listing was saved. You can edit it anytime from your listings."
                : "Your changes were saved successfully."}
            </p>
            <div className="modal-card__actions">
              <button type="button" className="btn btn-primary btn-inline" onClick={dismissSaveSuccess}>
                Back to listings
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
