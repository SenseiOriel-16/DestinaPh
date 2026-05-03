import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ClientEditorSkeleton } from "../components/PageSkeletons";
import { SearchableSelect } from "../components/SearchableSelect";
import { supabase } from "../lib/supabaseClient";
import { type AccommodationItem } from "../lib/accommodations";
import {
  fetchBarangays,
  fetchCitiesAndMunicipalities,
  fetchProvinces,
  normalizePsgcCode,
  type PsgcBarangay,
  type PsgcCityMunicipality,
  type PsgcProvince,
} from "../lib/psgcApi";
import { compressListingImage, MAX_LISTING_PHOTOS } from "../lib/compressListingImage";

type Category = { id: string; name: string; slug: string };
type AccRow = AccommodationItem;

const RESORT_SLUG = "resorts-leisure";
const NATURE_SLUG = "nature-adventure";
const FOOD_SLUG = "food-dining";

const NATURE_SUBCATEGORIES = [
  { value: "waterfalls-swimming", label: "Waterfalls / Swimming" },
  { value: "camping-sightseeing", label: "Camping / Sightseeing" },
] as const;
type NatureSubcategory = (typeof NATURE_SUBCATEGORIES)[number]["value"];

const BEST_TIMES = ["Breakfast", "Lunch", "Dinner"] as const;
type BestTime = (typeof BEST_TIMES)[number];

function parseCostRangePerPerson(inputRaw: string): { min: number; max: number } | null {
  const s = inputRaw.trim().toLowerCase();
  if (!s) return null;
  // Accept: 100-200, 100 - 200, 100 to 200
  const m = s.match(/^(\d{1,7})\s*(?:-|\sto\s)\s*(\d{1,7})$/);
  if (!m) return null;
  const a = Math.round(Number(m[1]));
  const b = Math.round(Number(m[2]));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < 0 || b < 0) return null;
  if (a > b) return null;
  return { min: a, max: b };
}

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
  const [allowReservations, setAllowReservations] = useState(true);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [alwaysOpen, setAlwaysOpen] = useState(true);
  const [openHour, setOpenHour] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12>(8);
  const [openMeridiem, setOpenMeridiem] = useState<"AM" | "PM">("AM");
  const [closeHour, setCloseHour] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12>(5);
  const [closeMeridiem, setCloseMeridiem] = useState<"AM" | "PM">("PM");
  const [operatingDay, setOperatingDay] = useState(false);
  const [operatingNight, setOperatingNight] = useState(false);
  const [entranceFeeDay, setEntranceFeeDay] = useState("");
  const [entranceFeeNight, setEntranceFeeNight] = useState("");
  const [natureEntranceFee, setNatureEntranceFee] = useState("");
  const [natureSubcategory, setNatureSubcategory] = useState<NatureSubcategory | "">("");
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
  const [detailReady, setDetailReady] = useState(isNew);
  const [foodCostRange, setFoodCostRange] = useState("");
  const [bestTimes, setBestTimes] = useState<BestTime[]>([]);
  const [advisoryText, setAdvisoryText] = useState("");
  const [operatingVariationsText, setOperatingVariationsText] = useState("");
  const [closedNow, setClosedNow] = useState(false);
  const [closedReason, setClosedReason] = useState("");
  const [fullyBooked, setFullyBooked] = useState(false);
  const [promoHeadline, setPromoHeadline] = useState("");
  const [promoBody, setPromoBody] = useState("");
  const [promoValidUntil, setPromoValidUntil] = useState("");
  const [scheduleChoice, setScheduleChoice] = useState<
    | "none"
    | "weekdays_closed"
    | "weekends_closed"
    | "closed_specific_days"
    | "open_specific_days_only"
    | "seasonal"
    | "appointment_only"
    | "temporary_closed"
    | "other"
  >("none");
  const [scheduleDetails, setScheduleDetails] = useState("");
  const [scheduleUntil, setScheduleUntil] = useState(""); // YYYY-MM-DD
  const [scheduleDays, setScheduleDays] = useState<
    Array<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun">
  >([]);

  const scheduleDetailsLimit = 120;
  const scheduleDaysLine = useMemo(() => {
    if (!scheduleDays.length) return "";
    return scheduleDays.join(", ");
  }, [scheduleDays]);

  const scheduleLine = useMemo(() => {
    const base =
      scheduleChoice === "none"
        ? ""
        : scheduleChoice === "weekdays_closed"
          ? "Weekdays closed"
          : scheduleChoice === "weekends_closed"
            ? "Weekends closed"
            : scheduleChoice === "closed_specific_days"
              ? "Closed on specific days"
              : scheduleChoice === "open_specific_days_only"
                ? "Open on specific days only"
                : scheduleChoice === "seasonal"
                  ? "Seasonal schedule"
                  : scheduleChoice === "appointment_only"
                    ? "By appointment only"
                    : scheduleChoice === "temporary_closed"
                      ? "Temporarily closed"
                      : "Other";

    const det =
      scheduleChoice === "temporary_closed"
        ? [scheduleUntil.trim() ? `Reopens ${scheduleUntil.trim()}` : "", scheduleDetails.trim()].filter(Boolean).join(" · ")
        : scheduleChoice === "closed_specific_days" || scheduleChoice === "open_specific_days_only"
          ? [scheduleDaysLine, scheduleDetails.trim()].filter(Boolean).join(" · ")
          : scheduleDetails.trim();
    if (!base) return "";
    if (!det) return base;
    return `${base} · ${det}`;
  }, [scheduleChoice, scheduleDaysLine, scheduleDetails, scheduleUntil]);

  const previewFile = pendingFiles[0] ?? null;
  const previewUrl = useMemo(() => (previewFile ? URL.createObjectURL(previewFile) : null), [previewFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const categorySlug = categories.find((c) => c.id === categoryId)?.slug ?? "";
  const isResort = categorySlug === RESORT_SLUG;
  const isNature = categorySlug === NATURE_SLUG;
  const isFood = categorySlug === FOOD_SLUG;

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

  useEffect(() => {
    if (!isResort) {
      setOperatingDay(false);
      setOperatingNight(false);
      setEntranceFeeDay("");
      setEntranceFeeNight("");
    }
  }, [isResort]);

  useEffect(() => {
    if (!isNature) {
      setNatureEntranceFee("");
      setNatureSubcategory("");
    }
  }, [isNature]);

  useEffect(() => {
    // Food listings do not have accommodations.
    if (isFood) {
      setAccommodations([{ name: "", pax: "", price_pesos: 0, available: true }]);
    }
  }, [isFood]);

  useEffect(() => {
    if (isNew) {
      setExistingPhotoCount(0);
    }
  }, [isNew]);

  useEffect(() => {
    if (isNew) {
      setDetailReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setDetailReady(false);
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
        operating_hours_always_open?: boolean | null;
        operating_open_hour?: number | null;
        operating_open_meridiem?: string | null;
        operating_close_hour?: number | null;
        operating_close_meridiem?: string | null;
        operating_day?: boolean | null;
        operating_night?: boolean | null;
        entrance_fee_day_pesos?: number | null;
        entrance_fee_night_pesos?: number | null;
        estimated_cost_min_pesos?: number | null;
        estimated_cost_max_pesos?: number | null;
        best_visit_times?: string[] | null;
        advisory_text?: string | null;
        operating_variations_text?: string | null;
        closed_now?: boolean | null;
        closed_reason?: string | null;
        fully_booked?: boolean | null;
        promo_headline?: string | null;
        promo_body?: string | null;
        promo_valid_until?: string | null;
      };
      setName(String(row.name ?? ""));
      setCategoryId(String(row.category_id ?? ""));
      setShortDescription(String(row.short_description ?? row.description ?? ""));
      setAllowReservations(row.allow_reservations !== false);
      setTags(Array.isArray(row.tags) ? row.tags : []);

      const ao = row.operating_hours_always_open === true;
      const oh = row.operating_open_hour;
      const om = row.operating_open_meridiem;
      const ch = row.operating_close_hour;
      const cm = row.operating_close_meridiem;
      if (ao) {
        setAlwaysOpen(true);
      } else if (
        typeof oh === "number" &&
        typeof ch === "number" &&
        (om === "AM" || om === "PM") &&
        (cm === "AM" || cm === "PM") &&
        oh >= 1 &&
        oh <= 12 &&
        ch >= 1 &&
        ch <= 12
      ) {
        setAlwaysOpen(false);
        setOpenHour(oh as any);
        setOpenMeridiem(om);
        setCloseHour(ch as any);
        setCloseMeridiem(cm);
      } else {
        setAlwaysOpen(true);
      }

      const catRel = row.categories;
      const catSlug =
        (Array.isArray(catRel) ? (catRel[0] as { slug?: string } | undefined)?.slug : catRel?.slug) ?? "";
      const rowIsResort = catSlug === RESORT_SLUG;
      const rowIsNature = catSlug === NATURE_SLUG;
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

      if (rowIsNature) {
        const fee = row.entrance_fee_pesos;
        setNatureEntranceFee(fee != null && Number.isFinite(Number(fee)) ? String(fee) : "");
        const sc = typeof (row as any).subcategory === "string" ? String((row as any).subcategory) : "";
        const ok = NATURE_SUBCATEGORIES.some((x) => x.value === sc);
        setNatureSubcategory(ok ? (sc as NatureSubcategory) : "");
      } else {
        setNatureEntranceFee("");
        setNatureSubcategory("");
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

      const cmin = row.estimated_cost_min_pesos;
      const cmax = row.estimated_cost_max_pesos;
      if (cmin != null && cmax != null && Number.isFinite(Number(cmin)) && Number.isFinite(Number(cmax))) {
        setFoodCostRange(`${Math.round(Number(cmin))}-${Math.round(Number(cmax))}`);
      } else {
        setFoodCostRange("");
      }
      const bt = Array.isArray(row.best_visit_times) ? row.best_visit_times : [];
      const nextTimes = bt.filter((x): x is BestTime => BEST_TIMES.includes(x as BestTime));
      setBestTimes(nextTimes);
      setAdvisoryText(String(row.advisory_text ?? ""));
      const ov = String(row.operating_variations_text ?? "").trim();
      setOperatingVariationsText(ov);
      if (!ov) {
        setScheduleChoice("none");
        setScheduleDetails("");
        setScheduleUntil("");
        setScheduleDays([]);
      } else {
        const [headRaw, ...rest] = ov.split("·").map((x) => x.trim()).filter(Boolean);
        const head = (headRaw ?? "").toLowerCase();
        const details = rest.join(" · ").trim();
        if (head === "weekdays closed") setScheduleChoice("weekdays_closed");
        else if (head === "weekends closed") setScheduleChoice("weekends_closed");
        else if (head === "closed on specific days") setScheduleChoice("closed_specific_days");
        else if (head === "open on specific days only") setScheduleChoice("open_specific_days_only");
        else if (head === "seasonal schedule") setScheduleChoice("seasonal");
        else if (head === "by appointment only") setScheduleChoice("appointment_only");
        else if (head === "temporarily closed") setScheduleChoice("temporary_closed");
        else setScheduleChoice("other");
        setScheduleDetails(details);
        setScheduleUntil("");
        setScheduleDays([]);
      }
      setClosedNow(row.closed_now === true);
      setClosedReason(row.closed_now === true ? String(row.closed_reason ?? "") : "");
      setFullyBooked(row.fully_booked === true);
      setPromoHeadline(String(row.promo_headline ?? ""));
      setPromoBody(String(row.promo_body ?? ""));
      const pv = row.promo_valid_until;
      setPromoValidUntil(typeof pv === "string" ? pv.slice(0, 10) : "");

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
      const provCode = normalizePsgcCode(psgcCodeFromSlug(provSlug));
      const munCode = normalizePsgcCode(psgcCodeFromSlug(munSlug));

      if (provCode && munCode) {
        setGeoProvCode(provCode);
        try {
          const muns = await fetchCitiesAndMunicipalities(provCode);
          setPsgcMuns(muns);
          setGeoMunCode(munCode);
          const brgyId = String(row.barangay_id ?? "");
          if (brgyId) {
            const { data: br } = await supabase.from("barangays").select("slug").eq("id", brgyId).maybeSingle();
            const brCode = normalizePsgcCode(psgcCodeFromSlug((br as { slug?: string } | null)?.slug));
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
      } finally {
        if (!cancelled) setDetailReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
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

    const foodCost = isFood ? parseCostRangePerPerson(foodCostRange) : null;
    if (isFood && !foodCost) {
      setMsg("Estimated cost per person is required for Food. Use format: 100-200, 100 - 200, or 100 to 200.");
      setBusy(false);
      return;
    }
    if (isNature && !natureSubcategory) {
      setMsg("Nature subcategory is required. If the listing is a river/swimming spot, choose Waterfalls / Swimming.");
      setBusy(false);
      return;
    }

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

    if (isNature) {
      const raw = natureEntranceFee.trim();
      if (raw !== "") {
        if (Number.isNaN(Number(raw))) {
          setMsg("Entrance fee must be a number, or leave it empty.");
          setBusy(false);
          return;
        }
        entrance_fee_pesos = Math.max(0, Math.round(Number(raw)));
        pricing_text = `Entrance: ₱${entrance_fee_pesos}`;
      } else {
        entrance_fee_pesos = null;
        // keep pricing_text null unless other category logic sets it
      }
    }

    if (isFood && foodCost) {
      pricing_text = `₱${foodCost.min.toLocaleString("en-PH")}–₱${foodCost.max.toLocaleString("en-PH")} / person`;
    }

    if (!alwaysOpen) {
      if (
        !Number.isFinite(Number(openHour)) ||
        !Number.isFinite(Number(closeHour)) ||
        (openMeridiem !== "AM" && openMeridiem !== "PM") ||
        (closeMeridiem !== "AM" && closeMeridiem !== "PM")
      ) {
        setMsg("Please set valid opening and closing time, or choose Always open / 24-7.");
        setBusy(false);
        return;
      }
    }

    const variationsOut =
      scheduleChoice === "none"
        ? ""
        : scheduleChoice === "other"
          ? (scheduleDetails.trim() ? scheduleDetails.trim() : operatingVariationsText.trim())
          : scheduleLine;

    const payload = {
      owner_id: uid,
      name: name.trim(),
      category_id: categoryId,
      subcategory: isNature && natureSubcategory ? natureSubcategory : null,
      short_description: shortDescription.trim() || null,
      description: shortDescription.trim() || null,
      allow_reservations: allowReservations,
      tags: tags.length ? tags : [],
      closed_now: closedNow,
      closed_reason: closedNow ? closedReason.trim() || null : null,
      fully_booked: fullyBooked,
      operating_hours_always_open: alwaysOpen,
      operating_open_hour: alwaysOpen ? null : openHour,
      operating_open_meridiem: alwaysOpen ? null : openMeridiem,
      operating_close_hour: alwaysOpen ? null : closeHour,
      operating_close_meridiem: alwaysOpen ? null : closeMeridiem,
      operating_day,
      operating_night,
      entrance_fee_day_pesos,
      entrance_fee_night_pesos,
      entrance_fee_pesos,
      province_id: geo.out_province_id || null,
      municipality_id: geo.out_municipality_id,
      barangay_id: geo.out_barangay_id || null,
      address_line: addressLine.trim() || null,
      accommodations: isFood ? [] : accPayload,
      pricing_text,
      estimated_cost_min_pesos: isFood && foodCost ? foodCost.min : null,
      estimated_cost_max_pesos: isFood && foodCost ? foodCost.max : null,
      best_visit_times: isFood ? bestTimes : [],
      latitude,
      longitude,
      advisory_text: advisoryText.trim() || null,
      operating_variations_text: variationsOut.trim() || null,
      ...((): {
        promo_headline: string | null;
        promo_body: string | null;
        promo_valid_until: string | null;
      } => {
        const hasPromo = Boolean(promoHeadline.trim() || promoBody.trim());
        return {
          promo_headline: promoHeadline.trim() ? promoHeadline.trim() : null,
          promo_body: hasPromo ? promoBody.trim() || null : null,
          promo_valid_until: hasPromo ? promoValidUntil.trim() || null : null,
        };
      })(),
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

  if (!detailReady) {
    return <ClientEditorSkeleton />;
  }

  return (
    <div className="page page--flush-top page--editor">
      <div className="editor-head">
        <Link to="/listings" className="link-back">
          ← Back
        </Link>
        <h1 className="dash-title" style={{ margin: "8px 0 0" }}>
          {isNew ? "Add New Listing" : "Edit Listing"}
        </h1>
      </div>
      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}
      <form onSubmit={onSubmit}>
          <div className="editor-grid">
          <div className="editor-col">
            <div className="card editor-card">
              <h2 className="editor-card__title">Business information</h2>
              <div className="field">
                <label htmlFor="name">Business name</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <span className="field__group-label" id="allow-res-label">
                  Reservations
                </span>
                <div className="field-checkbox-row" role="group" aria-labelledby="allow-res-label">
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={allowReservations}
                      onChange={(e) => setAllowReservations(e.target.checked)}
                    />
                    <span>{allowReservations ? "Booking enabled" : "Booking disabled"}</span>
                  </label>
                </div>
                <p className="editor-help" style={{ margin: "4px 0 0" }}>
                  Toggle off if you don’t accept online reservations for this destination. Travelers won’t be able to
                  reserve when disabled.
                </p>
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
                <div className="editor-tag-pills">
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
                <div className="editor-tag-inputrow">
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

              <div className="field">
                <span className="field__group-label" id="operating-hours-12h-label">
                  Operating hours
                </span>
                <div className="field-checkbox-row" role="group" aria-labelledby="operating-hours-12h-label">
                  <label className="field-checkbox">
                    <input type="radio" name="always-open" checked={alwaysOpen} onChange={() => setAlwaysOpen(true)} />
                    <span>Always open / 24-7</span>
                  </label>
                  <label className="field-checkbox">
                    <input type="radio" name="always-open" checked={!alwaysOpen} onChange={() => setAlwaysOpen(false)} />
                    <span>Set time</span>
                  </label>
                </div>
                {!alwaysOpen ? (
                  <div className="field-checkbox-row" style={{ marginTop: 10 }}>
                    <div className="field" style={{ margin: 0, flex: 1 }}>
                      <label htmlFor="open-hour">Opening time</label>
                      <div className="field-checkbox-row" style={{ marginTop: 6 }}>
                        <select
                          id="open-hour"
                          value={openHour}
                          onChange={(e) => setOpenHour(Number(e.target.value) as any)}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Opening meridiem"
                          value={openMeridiem}
                          onChange={(e) => setOpenMeridiem(e.target.value as any)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    <div className="field" style={{ margin: 0, flex: 1 }}>
                      <label htmlFor="close-hour">Closing time</label>
                      <div className="field-checkbox-row" style={{ marginTop: 6 }}>
                        <select
                          id="close-hour"
                          value={closeHour}
                          onChange={(e) => setCloseHour(Number(e.target.value) as any)}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Closing meridiem"
                          value={closeMeridiem}
                          onChange={(e) => setCloseMeridiem(e.target.value as any)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
                    Displayed in the mobile app as <strong>Always Open</strong>.
                  </p>
                )}
              </div>

              <div className="field">
                <span className="field__group-label" id="closed-now-label">
                  Resort status
                </span>
                <div className="field-checkbox-row" role="group" aria-labelledby="closed-now-label">
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={closedNow}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setClosedNow(on);
                        if (!on) setClosedReason("");
                      }}
                    />
                    <span>Close now (show “Closed” badge in app)</span>
                  </label>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={fullyBooked}
                      onChange={(e) => setFullyBooked(e.target.checked)}
                    />
                    <span>Fully booked (disable reservations)</span>
                  </label>
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
                  Use “Close now” for temporary closures. Add a short <strong>reason for close</strong> below so travelers
                  see it in an app notice — or use Advisory for other updates.
                </p>
                {closedNow ? (
                  <div className="field" style={{ marginTop: 14 }}>
                    <label htmlFor="closed-reason">Reason for close (shown in app)</label>
                    <textarea
                      id="closed-reason"
                      rows={3}
                      maxLength={500}
                      placeholder="e.g. Closed for renovation until June 2026 · Emergency maintenance today"
                      value={closedReason}
                      onChange={(e) => setClosedReason(e.target.value)}
                    />
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>
                      Optional but recommended. If empty, the app may still show your general Advisory when closed.
                    </p>
                  </div>
                ) : null}
              </div>
              {isResort && (
                <>
                  <div className="field">
                    <span className="field__group-label" id="fee-periods-label">
                      Entrance fee periods
                    </span>
                    <div className="field-checkbox-row" role="group" aria-labelledby="fee-periods-label">
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

            {isNature && (
              <>
                <div className="field">
                  <label htmlFor="nature-subcat">Nature subcategory</label>
                  <select
                    id="nature-subcat"
                    value={natureSubcategory}
                    onChange={(e) => setNatureSubcategory(e.target.value as NatureSubcategory | "")}
                  >
                    <option value="">— Select subcategory —</option>
                    {NATURE_SUBCATEGORIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="editor-help" style={{ margin: "4px 0 0" }}>
                    If your listing is a <strong>river / swimming spot</strong>, choose <strong>Waterfalls / Swimming</strong>.
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="fee-nature">Entrance / environmental fee (₱) (optional)</label>
                  <input
                    id="fee-nature"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 50"
                    value={natureEntranceFee}
                    onChange={(e) => setNatureEntranceFee(e.target.value)}
                  />
                  <p className="editor-help" style={{ margin: "4px 0 0" }}>
                    Optional for public areas (e.g., river/swimming spots) that still require an environmental fee.
                  </p>
                </div>
              </>
            )}
            </div>

            <div className="card editor-card">
              <h2 className="editor-card__title">Photos</h2>
              <details className="editor-disclosure" open={pendingFiles.length > 0 || existingPhotoCount === 0}>
                <summary>
                  <span>{isResort ? "Resort images" : "Listing images"}</span>
                  <span className="editor-disclosure__meta">
                    {existingPhotoCount} saved · {pendingFiles.length} queued
                  </span>
                </summary>
                <p className="editor-help" style={{ marginTop: 10 }}>
                  Up to {MAX_LISTING_PHOTOS} photos total (including photos already saved). Each file is resized and saved as
                  JPEG before upload to save storage.
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
                  <div className="upload-zone__preview" aria-hidden>
                    {previewUrl ? (
                      <img src={previewUrl} alt="" />
                    ) : (
                      <div className="upload-zone__preview-empty">
                        <span className="upload-zone__preview-icon">⬆</span>
                        <span>4:3 preview</span>
                      </div>
                    )}
                  </div>
                  <p style={{ margin: 0 }}>
                    <strong>{previewUrl ? "Add more images" : "Upload images"}</strong>
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
              </details>
            </div>
          </div>

          <div className="editor-col">
            <div className="card editor-card">
              <h2 className="editor-card__title">{isFood ? "Food details" : "Accommodations"}</h2>

              {isFood ? (
                <div className="editor-2col editor-2col--tight">
                  <div className="field">
                    <label htmlFor="food-cost">Estimated cost per person</label>
                    <input
                      id="food-cost"
                      inputMode="numeric"
                      placeholder="e.g. 100-200"
                      value={foodCostRange}
                      onChange={(e) => setFoodCostRange(e.target.value)}
                    />
                    <p className="editor-help" style={{ marginTop: 6 }}>
                      Format: <code>100-200</code>, <code>100 - 200</code>, or <code>100 to 200</code>.
                    </p>
                  </div>
                  <div className="field">
                    <span className="field__group-label">Best time to visit</span>
                    <div className="editor-pill-row">
                      {BEST_TIMES.map((t) => {
                        const on = bestTimes.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            className={on ? "pill approved" : "pill"}
                            style={{ border: "none", cursor: "pointer" }}
                            onClick={() => {
                              setBestTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
                            }}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    <p className="editor-help" style={{ marginTop: 6 }}>
                      Pick one or more.
                    </p>
                  </div>
                </div>
              ) : (
                <details className="editor-disclosure" open={accommodations.some((a) => (a.name ?? "").trim().length > 0)}>
                  <summary>
                    <span>Accommodation rows</span>
                    <span className="editor-disclosure__meta">
                      {accommodations.length} row{accommodations.length === 1 ? "" : "s"}
                    </span>
                  </summary>
                  <p className="editor-help" style={{ marginTop: 10 }}>
                    Price is per night in pesos. Uncheck <strong>Available</strong> if this type is full or not offered.
                  </p>
                  <div className="acc-editor-rows">
                    {accommodations.map((row, i) => (
                      <div className="acc-editor-row" key={i}>
                        <div className="acc-editor-fields">
                          <div className="acc-editor-field">
                            <label htmlFor={`acc-name-${i}`}>Name</label>
                            <input
                              id={`acc-name-${i}`}
                              placeholder="e.g. Cabin"
                              value={row.name}
                              onChange={(e) => setAcc(i, { name: e.target.value })}
                            />
                          </div>
                          <div className="acc-editor-field">
                            <label htmlFor={`acc-pax-${i}`}>Capacity</label>
                            <input
                              id={`acc-pax-${i}`}
                              placeholder="e.g. 4–6 pax"
                              value={row.pax}
                              onChange={(e) => setAcc(i, { pax: e.target.value })}
                            />
                          </div>
                          <div className="acc-editor-field acc-editor-field--price">
                            <label htmlFor={`acc-price-${i}`}>Price / night</label>
                            <div className="acc-editor-price-input">
                              <span className="acc-editor-price-input__prefix" aria-hidden>
                                ₱
                              </span>
                              <input
                                id={`acc-price-${i}`}
                                type="number"
                                min={0}
                                placeholder="0"
                                value={row.price_pesos || ""}
                                onChange={(e) => setAcc(i, { price_pesos: Number(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="acc-editor-row__tail">
                          <label className="acc-editor-avail">
                            <input
                              type="checkbox"
                              checked={row.available}
                              onChange={(e) => setAcc(i, { available: e.target.checked })}
                            />
                            <span>Available</span>
                          </label>
                          <button type="button" className="icon-btn" onClick={() => removeAccRow(i)} title="Remove row">
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn-outline" style={{ marginTop: 10 }} onClick={addAccRow}>
                    + Add accommodation
                  </button>
                </details>
              )}
            </div>

            <div className="card editor-card">
              <h2 className="editor-card__title">Location</h2>
              <p className="editor-help">
                Provinces, cities/municipalities, and barangays come from the official <strong>PSGC</strong> public API (
                <a href="https://psgc.gitlab.io/" target="_blank" rel="noreferrer">
                  psgc.gitlab.io
                </a>
                ).
              </p>
              {geoError ? <p className="editor-help editor-help--error">{geoError}</p> : null}
              {legacyGeoNote ? <p className="editor-help">{legacyGeoNote}</p> : null}

              <div className="editor-2col">
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
              </div>

              <div className="editor-2col editor-2col--tight">
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
              </div>

              <details className="editor-disclosure">
                <summary>
                  <span>Map location (optional)</span>
                  <span className="editor-disclosure__meta">
                    {latitudeStr.trim() || longitudeStr.trim() ? "Set" : "Not set"}
                  </span>
                </summary>
                <p className="editor-help" style={{ marginTop: 10 }}>
                  Used for the traveler app map and directions. Get coordinates from Google Maps (long-press the pin, then
                  copy latitude / longitude).
                </p>
                <div className="editor-2col editor-2col--tight">
                  <div className="field">
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
                  <div className="field">
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
              </details>

              <details className="editor-disclosure" style={{ marginTop: 10 }}>
                <summary>
                  <span>Advisories & schedule changes (for tourists)</span>
                  <span className="editor-disclosure__meta">
                    {advisoryText.trim() || operatingVariationsText.trim() ? "Set" : "Not set"}
                  </span>
                </summary>
                <p className="editor-help" style={{ marginTop: 10 }}>
                  Use this to inform travelers if the place has upcoming events, is closed due to holidays, or has
                  half-day / special operating hours.
                </p>
                <div className="field">
                  <label htmlFor="advisory">Advisory (events / temporary closure)</label>
                  <textarea
                    id="advisory"
                    rows={4}
                    placeholder="e.g. Closed on May 1 (Labor Day). Reopens May 2, 8AM. • Fiesta event on May 15, expect crowd."
                    value={advisoryText}
                    onChange={(e) => setAdvisoryText(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="schedule-choice">Schedule changes (choices)</label>
                  <select
                    id="schedule-choice"
                    value={scheduleChoice}
                    onChange={(e) => {
                      const next = e.target.value as typeof scheduleChoice;
                      setScheduleChoice(next);
                      if (next === "none") {
                        setScheduleDetails("");
                        setScheduleUntil("");
                        setScheduleDays([]);
                        setOperatingVariationsText("");
                      }
                    }}
                  >
                    <option value="none">No changes (regular hours)</option>
                    <option value="weekdays_closed">Weekdays closed</option>
                    <option value="weekends_closed">Weekends closed</option>
                    <option value="closed_specific_days">Closed on specific days</option>
                    <option value="open_specific_days_only">Open on specific days only</option>
                    <option value="seasonal">Seasonal schedule</option>
                    <option value="appointment_only">By appointment only</option>
                    <option value="temporary_closed">Temporarily closed</option>
                    <option value="other">Other (custom)</option>
                  </select>
                  <p className="editor-help" style={{ marginTop: 8 }}>
                    This will be shown in the traveler app under <strong>Status</strong>.
                  </p>

                  {scheduleChoice !== "none" ? (
                    <div style={{ marginTop: 10 }}>
                      <label htmlFor="schedule-details" style={{ display: "block", marginBottom: 6 }}>
                        {scheduleChoice === "other" ? "Custom schedule (required)" : "Details (optional)"}
                      </label>

                      {scheduleChoice === "temporary_closed" ? (
                        <div className="editor-2col editor-2col--tight" style={{ marginBottom: 10 }}>
                          <div className="field" style={{ margin: 0 }}>
                            <label htmlFor="schedule-until">Reopens on (optional)</label>
                            <input
                              id="schedule-until"
                              type="date"
                              value={scheduleUntil}
                              onChange={(e) => setScheduleUntil(e.target.value)}
                            />
                          </div>
                        </div>
                      ) : null}

                      {scheduleChoice === "closed_specific_days" || scheduleChoice === "open_specific_days_only" ? (
                        <div style={{ marginBottom: 10 }}>
                          <div className="editor-help" style={{ marginBottom: 6 }}>
                            Select days (optional)
                          </div>
                          <div className="field-checkbox-row" style={{ flexWrap: "wrap", gap: 10 }}>
                            {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((d) => (
                              <label key={d} className="field-checkbox">
                                <input
                                  type="checkbox"
                                  checked={scheduleDays.includes(d)}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setScheduleDays((prev) => (on ? (prev.includes(d) ? prev : [...prev, d]) : prev.filter((x) => x !== d)));
                                  }}
                                />
                                <span>{d}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <input
                        id="schedule-details"
                        value={scheduleDetails}
                        onChange={(e) => setScheduleDetails(e.target.value)}
                        placeholder={
                          scheduleChoice === "other"
                            ? "e.g. Weekdays: closed • Open Sat–Sun 7AM–5PM"
                            : "e.g. Open Sat–Sun 7AM–5PM · Closed on May 1"
                        }
                        required={scheduleChoice === "other"}
                        maxLength={scheduleDetailsLimit}
                      />
                      <div className="editor-help" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <span>Keep it short so it looks good in the traveler app.</span>
                        <span>
                          {scheduleDetails.length}/{scheduleDetailsLimit}
                        </span>
                      </div>
                      <p className="editor-help" style={{ marginTop: 8 }}>
                        Preview: <strong>{scheduleChoice === "other" ? scheduleDetails.trim() || "—" : scheduleLine || "—"}</strong>
                      </p>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="card editor-card">
              <h2 className="editor-card__title">Promo for travelers</h2>
              <p className="editor-help">
                Travelers see <strong>exactly what you type below</strong> — no placeholder text. Use a headline (best for
                lists) or details only (lists show the first line of details). Valid date applies whenever headline or
                details are set. Clear both headline and details to hide the promo everywhere.
              </p>
              <div className="field">
                <label htmlFor="promo-headline">Headline (recommended — shown in lists and listing)</label>
                <input
                  id="promo-headline"
                  placeholder="e.g. Ber-month family package · book 3 nights, save 10%"
                  value={promoHeadline}
                  onChange={(e) => setPromoHeadline(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="field">
                <label htmlFor="promo-body">Details (optional)</label>
                <textarea
                  id="promo-body"
                  rows={3}
                  placeholder="Terms, dates, or how to avail — keep it short."
                  value={promoBody}
                  onChange={(e) => setPromoBody(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="field">
                <label htmlFor="promo-until">Valid until (optional)</label>
                <input
                  id="promo-until"
                  type="date"
                  value={promoValidUntil}
                  onChange={(e) => setPromoValidUntil(e.target.value)}
                  disabled={!promoHeadline.trim() && !promoBody.trim()}
                />
                <p className="editor-help" style={{ marginTop: 6 }}>
                  Leave blank for no end date. Past dates hide the promo in the app.
                </p>
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
