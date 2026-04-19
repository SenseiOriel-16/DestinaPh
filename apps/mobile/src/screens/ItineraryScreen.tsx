import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ImageBackground,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useItinerary } from "../context/ItineraryContext";
import { colors } from "../theme/colors";
import { shadowCompat } from "../lib/rnWebStyleCompat";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { firstPhotoPublicUrl } from "../lib/businessDisplay";
import { ratingParts } from "../lib/businessRatingDisplay";
import { haversineKm } from "../lib/geo";
import { LinearGradient } from "expo-linear-gradient";
import { HERO_BACKGROUND } from "../constants/heroBackground";
import {
  rankCandidates,
  type BizCandidate,
  type FoodVisitTime,
  type PriorityKey,
  type ResortPeriod,
} from "../lib/itineraryGenerator";

// ─── helpers ──────────────────────────────────────────────────────────────────

function peso(n: number) {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function usePressMotion() {
  const scale = useMemo(() => new Animated.Value(1), []);
  const shakeX = useMemo(() => new Animated.Value(0), []);
  const useNativeDriver = Platform.OS !== "web";

  const bounceAndShake = useCallback(() => {
    shakeX.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.07,
          duration: 80,
          useNativeDriver,
          easing: Easing.out(Easing.quad),
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver,
          speed: 22,
          bounciness: 8,
        }),
      ]),
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 1, duration: 35, useNativeDriver }),
        Animated.timing(shakeX, { toValue: -1, duration: 35, useNativeDriver }),
        Animated.timing(shakeX, { toValue: 1, duration: 35, useNativeDriver }),
        Animated.timing(shakeX, { toValue: 0, duration: 35, useNativeDriver }),
      ]),
    ]).start();
  }, [scale, shakeX, useNativeDriver]);

  const transform = useMemo(
    () => [
      { scale },
      {
        translateX: shakeX.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-3, 0, 3],
        }),
      },
    ],
    [scale, shakeX],
  );

  return { bounceAndShake, transform };
}

// ─── SectionRow ───────────────────────────────────────────────────────────────

function SectionRow({
  left,
  right,
}: {
  left: string;
  right?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{left}</Text>
      {right ? (
        <Pressable
          onPress={right.onPress}
          hitSlop={10}
          style={({ pressed }) => [styles.sectionRight, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.sectionRightTxt}>{right.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primaryTealDeep} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────

function CategoryCard({
  active,
  title,
  emoji,
  gradient,
  onPress,
}: {
  active: boolean;
  title: string;
  emoji: string;
  gradient: [string, string, string];
  onPress: () => void;
}) {
  const m = usePressMotion();
  return (
    <Pressable
      onPress={() => {
        m.bounceAndShake();
        onPress();
      }}
      style={({ pressed }) => [
        styles.catCardHit,
        pressed && { opacity: 0.93 },
      ]}
    >
      <Animated.View style={{ transform: m.transform }}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.catCard, active && styles.catCardActive]}
        >
          {active && (
            <View style={styles.catActiveRing} />
          )}
          <View style={styles.catEmojiWrap}>
            <Text style={styles.catEmoji}>{emoji}</Text>
          </View>
          <Text style={styles.catTitle} numberOfLines={2}>
            {title}
          </Text>
          {active && (
            <View style={styles.catCheckDot}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ─── BudgetChip ───────────────────────────────────────────────────────────────

function BudgetChip({
  active,
  label,
  gradient,
  onPress,
}: {
  active: boolean;
  label: string;
  gradient: [string, string];
  onPress: () => void;
}) {
  const m = usePressMotion();
  return (
    <Pressable
      onPress={() => {
        m.bounceAndShake();
        onPress();
      }}
      style={({ pressed }) => [styles.budgetChipHit, pressed && { opacity: 0.93 }]}
    >
      <Animated.View style={{ transform: m.transform, flex: 1 }}>
        <LinearGradient
          colors={active ? ["#22C55E", "#16A34A"] : ["#F8F9FF", "#F0F3FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.budgetChip, active && styles.budgetChipActive]}
        >
          <Text style={[styles.budgetChipTxt, active && styles.budgetChipTxtActive]}>
            {label}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ─── PriorityChip ─────────────────────────────────────────────────────────────

function PriorityChip({
  rank,
  priorityKey,
  onPress,
}: {
  rank: 1 | 2 | 3;
  priorityKey: PriorityKey;
  onPress: () => void;
}) {
  const m = usePressMotion();

  const rankColors: Record<1 | 2 | 3, { bg: string; dot: string; label: string }> = {
    1: { bg: "rgba(4,120,126,0.10)", dot: colors.primaryTeal, label: "1st" },
    2: { bg: "rgba(255,183,3,0.12)", dot: colors.star, label: "2nd" },
    3: { bg: "rgba(46,155,76,0.12)", dot: colors.accentGreen, label: "3rd" },
  };

  const prioMeta: Record<PriorityKey, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> = {
    distance: { icon: "location", label: "Distance", color: "#EF4444" },
    popularity: { icon: "star", label: "Popularity", color: colors.star },
    budget: { icon: "cash", label: "Budget", color: colors.accentGreen },
  };

  const rc = rankColors[rank];
  const pm = prioMeta[priorityKey];

  return (
    <Pressable
      onPress={() => {
        m.bounceAndShake();
        onPress();
      }}
      style={[styles.prioChipHit]}
    >
      <Animated.View style={[styles.prioChip, { transform: m.transform }]}>
        <View style={[styles.prioBadge, { backgroundColor: rc.bg }]}>
          <View style={[styles.prioDot, { backgroundColor: rc.dot }]} />
          <Text style={[styles.prioBadgeTxt, { color: rc.dot }]}>{rc.label}</Text>
        </View>
        <View style={styles.prioInner}>
          <Ionicons name={pm.icon} size={14} color={pm.color} />
          <Text style={[styles.prioLabel, { color: pm.color }]}>{pm.label}</Text>
          <Ionicons name="chevron-down" size={13} color={pm.color} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function PriorityRow({
  rank,
  value,
  onSelect,
}: {
  rank: 1 | 2 | 3;
  value: PriorityKey;
  onSelect: (k: PriorityKey) => void;
}) {
  const opts: { key: PriorityKey; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { key: "popularity", label: "Popularity", icon: "star", color: colors.star },
    { key: "budget", label: "Budget", icon: "cash", color: colors.accentGreen },
    { key: "distance", label: "Distance", icon: "location", color: "#EF4444" },
  ];

  const rankLabel = rank === 1 ? "1st priority" : rank === 2 ? "2nd priority" : "3rd priority";

  return (
    <View style={styles.prioRow2}>
      <Text style={styles.prioRowLabel}>{rankLabel}</Text>
      <View style={styles.prioSeg}>
        {opts.map((o, idx) => {
          const active = value === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => onSelect(o.key)}
              style={({ pressed }) => [
                styles.prioSegBtn,
                idx === 0 && styles.prioSegBtnFirst,
                idx === opts.length - 1 && styles.prioSegBtnLast,
                active && styles.prioSegBtnActive,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Ionicons
                name={o.icon}
                size={14}
                color={active ? o.color : "rgba(71,85,105,0.75)"}
              />
              <Text style={[styles.prioSegTxt, active && styles.prioSegTxtActive]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── MuniChip ─────────────────────────────────────────────────────────────────

function MuniChip({
  active,
  name,
  onPress,
}: {
  active: boolean;
  name: string;
  onPress: () => void;
}) {
  const m = usePressMotion();
  return (
    <Pressable
      onPress={() => {
        m.bounceAndShake();
        onPress();
      }}
      style={({ pressed }) => [pressed && { opacity: 0.92 }]}
    >
      <Animated.View
        style={[styles.muniChip, active && styles.muniChipActive, { transform: m.transform }]}
      >
        {active ? (
          <LinearGradient
            colors={["rgba(4,120,126,0.18)", "rgba(14,201,182,0.14)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.muniIconBg}
          >
            <Ionicons name="business" size={15} color={colors.primaryTealDeep} />
          </LinearGradient>
        ) : (
          <View style={[styles.muniIconBg, { backgroundColor: "#F3F4F6" }]}>
            <Ionicons name="business" size={15} color="#9CA3AF" />
          </View>
        )}
        <Text style={[styles.muniTxt, active && styles.muniTxtActive]} numberOfLines={1}>
          {name}
        </Text>
        {active && (
          <View style={styles.muniCheck}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ItineraryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { stops, setStops } = useItinerary();
  const [view, setView] = useState<"form" | "loading" | "results">("form");
  const scrollRef = useRef<ScrollView | null>(null);
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  // Empty string means "All municipalities"
  const [municipalityId, setMunicipalityId] = useState<string>("");
  const [categorySlug, setCategorySlug] = useState<string>("resorts-leisure");
  const [natureSubcategory, setNatureSubcategory] = useState<"all" | "waterfalls-swimming" | "camping-sightseeing">("all");
  const [resortPeriod, setResortPeriod] = useState<ResortPeriod>("day");
  const [budgetValue, setBudgetValue] = useState<number | null>(150);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [groupSizeInput, setGroupSizeInput] = useState<string>("2");
  const [foodVisitTime, setFoodVisitTime] = useState<FoodVisitTime>("Lunch");
  const [prio1, setPrio1] = useState<PriorityKey>("distance");
  const [prio2, setPrio2] = useState<PriorityKey>("popularity");
  const [prio3, setPrio3] = useState<PriorityKey>("budget");
  const [noMatchNote, setNoMatchNote] = useState<string | null>(null);
  const [fallbackCategory, setFallbackCategory] = useState<BizCandidate[]>([]);

  const setPriority = useCallback(
    (slot: 1 | 2 | 3, key: PriorityKey) => {
      if (slot === 1) {
        if (key === prio2) setPrio2(prio1);
        else if (key === prio3) setPrio3(prio1);
        setPrio1(key);
        return;
      }
      if (slot === 2) {
        if (key === prio1) setPrio1(prio2);
        else if (key === prio3) setPrio3(prio2);
        setPrio2(key);
        return;
      }
      if (key === prio1) setPrio1(prio3);
      else if (key === prio2) setPrio2(prio3);
      setPrio3(key);
    },
    [prio1, prio2, prio3],
  );

  const derivedBudget = useMemo(() => {
    const n = Number(budgetInput.trim());
    if (budgetInput.trim() && Number.isFinite(n) && n > 0) return Math.floor(n);
    return budgetValue;
  }, [budgetInput, budgetValue]);

  const derivedGroupSize = useMemo(() => {
    const raw = groupSizeInput.trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const v = Math.max(1, Math.floor(n));
    return v;
  }, [groupSizeInput]);

  const [detailsStopId, setDetailsStopId] = useState<string | null>(null);
  const detailsStop = useMemo(
    () => (detailsStopId ? stops.find((s) => s.id === detailsStopId) ?? null : null),
    [detailsStopId, stops],
  );

  // Keep the current view when navigating back (e.g., from Detail → Results),
  // so the user doesn't feel like the back button "double backs".

  const loadMunicipalities = useCallback(async () => {
    const { data, error } = await supabase
      .from("businesses")
      .select("municipalities(id,name)")
      .eq("status", "approved");
    if (error || !data) {
      setMunicipalities([]);
      setMunicipalityId("");
      return;
    }
    const map = new Map<string, { id: string; name: string }>();
    for (const r of data as any[]) {
      const raw = r.municipalities as { id: string; name: string } | { id: string; name: string }[] | null | undefined;
      const m = Array.isArray(raw) ? raw[0] : raw;
      if (m?.id && m.name) map.set(m.id, { id: m.id, name: m.name });
    }
    const list = [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    setMunicipalities(list);
    setMunicipalityId((prev) => {
      // Keep "All" selection if already chosen.
      if (prev === "") return "";
      return prev && list.some((x) => x.id === prev) ? prev : list[0]?.id ?? "";
    });
  }, []);

  useEffect(() => {
    void loadMunicipalities();
  }, [loadMunicipalities]);

  useEffect(() => {
    // When switching views, keep the user at the top of the sheet so it feels like a "redirect"
    // to the Generated Results section (especially after tapping Generate at the bottom).
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [view]);

  const generate = useCallback(async () => {
    setView("loading");
    setNoMatchNote(null);
    setFallbackCategory([]);

    try {
      // Kick off location permission and data fetch in parallel to reduce wait time.
      const permPromise = Location.requestForegroundPermissionsAsync();
      let q = supabase
        .from("businesses")
        .select(
          // Keep payload lean; only 1 photo is needed for cards.
          "id,name,latitude,longitude,subcategory,allow_reservations,operating_day,operating_night,entrance_fee_pesos,entrance_fee_day_pesos,entrance_fee_night_pesos,accommodations,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,rating_average,rating_count,categories(slug,name),municipalities(id,name),business_photos(storage_path,sort_order)",
        )
        .eq("status", "approved")
        .eq("allow_reservations", true);
      if (municipalityId) q = q.eq("municipality_id", municipalityId);
      const dataPromise = q
        .order("sort_order", { ascending: true, foreignTable: "business_photos" })
        .limit(1, { foreignTable: "business_photos" });

      const [perm, bizRes] = await Promise.all([permPromise, dataPromise]);
      const { data, error } = bizRes as any;

      if (error || !data) {
        Alert.alert("Error", error?.message ?? "Could not load destinations.");
        setView("form");
        return;
      }

      const candidates: BizCandidate[] = (data as any[]).map((r) => {
        const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
        const mun = Array.isArray(r.municipalities) ? r.municipalities[0] : r.municipalities;
        return {
          id: String(r.id),
          name: String(r.name ?? ""),
          latitude: typeof r.latitude === "number" ? r.latitude : null,
          longitude: typeof r.longitude === "number" ? r.longitude : null,
          subcategory: typeof r.subcategory === "string" ? r.subcategory : null,
          categorySlug: String(cat?.slug ?? ""),
          categoryName: typeof cat?.name === "string" ? cat.name : null,
          municipalityId: typeof mun?.id === "string" ? mun.id : null,
          municipalityName: typeof mun?.name === "string" ? mun.name : null,
          ratingAverage: typeof r.rating_average === "number" ? r.rating_average : null,
          ratingCount: typeof r.rating_count === "number" ? r.rating_count : null,
          allowReservations: r.allow_reservations !== false,
          operatingDay: Boolean(r.operating_day),
          operatingNight: Boolean(r.operating_night),
          entranceFeeDefault: typeof r.entrance_fee_pesos === "number" ? r.entrance_fee_pesos : null,
          entranceFeeDay: typeof r.entrance_fee_day_pesos === "number" ? r.entrance_fee_day_pesos : null,
          entranceFeeNight: typeof r.entrance_fee_night_pesos === "number" ? r.entrance_fee_night_pesos : null,
          accommodations: Array.isArray(r.accommodations) ? r.accommodations : null,
          estimatedCostMin: typeof r.estimated_cost_min_pesos === "number" ? r.estimated_cost_min_pesos : null,
          estimatedCostMax: typeof r.estimated_cost_max_pesos === "number" ? r.estimated_cost_max_pesos : null,
          bestVisitTimes: Array.isArray(r.best_visit_times) ? r.best_visit_times : null,
          photoUrl: firstPhotoPublicUrl(r.business_photos),
        };
      });

      const narrowedCandidates =
        categorySlug === "nature-adventure" && natureSubcategory !== "all"
          ? candidates.filter(
              (c) => String((c as any).subcategory ?? "") === natureSubcategory,
            )
          : candidates;

      // Resolve origin: prefer current GPS; fallback to last known; final fallback to
      // centroid of candidate destinations (so generation still works even if GPS fails).
      let origin: { latitude: number; longitude: number } | null = null;
      if (perm.status === "granted") {
        try {
          const pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Location timeout")), 9000),
            ),
          ]);
          origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch {
          try {
            const last = await Location.getLastKnownPositionAsync();
            if (last?.coords?.latitude != null && last?.coords?.longitude != null) {
              origin = { latitude: last.coords.latitude, longitude: last.coords.longitude };
            }
          } catch {
            // ignore
          }
        }
      }

      if (!origin) {
        const pts = narrowedCandidates.filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number");
        if (pts.length) {
          const lat = pts.reduce((s, p) => s + (p.latitude ?? 0), 0) / pts.length;
          const lng = pts.reduce((s, p) => s + (p.longitude ?? 0), 0) / pts.length;
          origin = { latitude: lat, longitude: lng };
        } else {
          origin = { latitude: 13.0, longitude: 122.0 }; // PH-ish fallback; should be rare
        }
      }

      const prefs = {
        origin,
        municipalityId: municipalityId || null,
        categorySlug,
        resortPeriod,
        entranceBudget: categorySlug === "resorts-leisure" ? derivedBudget : null,
        groupSize: derivedGroupSize,
        foodVisitTime: categorySlug === "food-dining" ? foodVisitTime : null,
        foodBudgetPerPerson: categorySlug === "food-dining" ? derivedBudget : null,
        priorities: [prio1, prio2, prio3] as [PriorityKey, PriorityKey, PriorityKey],
      };

      const ranked = rankCandidates(narrowedCandidates, prefs).slice(0, 5);

      if (ranked.length === 0) {
        setStops([]);

        const budgetFirst = prio1 === "budget";
        const budgetTarget =
          categorySlug === "resorts-leisure"
            ? prefs.entranceBudget
            : categorySlug === "food-dining"
              ? prefs.foodBudgetPerPerson
              : null;

        if (
          budgetFirst &&
          typeof budgetTarget === "number" &&
          Number.isFinite(budgetTarget) &&
          budgetTarget > 0
        ) {
          const target = Math.round(budgetTarget);

          const feeForResort = (b: BizCandidate): number | null => {
            const periodOk =
              prefs.resortPeriod === "day" ? b.operatingDay : b.operatingNight;
            if (!periodOk) return null;
            const fee =
              prefs.resortPeriod === "day" ? b.entranceFeeDay : b.entranceFeeNight;
            if (typeof fee === "number" && Number.isFinite(fee) && fee >= 0)
              return Math.round(fee);
            if (
              typeof b.entranceFeeDefault === "number" &&
              Number.isFinite(b.entranceFeeDefault) &&
              b.entranceFeeDefault >= 0
            )
              return Math.round(b.entranceFeeDefault);
            return null;
          };

          const foodDiff = (b: BizCandidate): number | null => {
            const when = prefs.foodVisitTime;
            if (when) {
              const bt = b.bestVisitTimes ?? [];
              const has = bt.some((x) => String(x).toLowerCase() === String(when).toLowerCase());
              if (!has) return null;
            }
            const min = b.estimatedCostMin;
            const max = b.estimatedCostMax;
            if (typeof min !== "number" || typeof max !== "number") return null;
            if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
            if (target >= min && target <= max) return 0;
            return Math.min(Math.abs(target - min), Math.abs(target - max));
          };

          const relaxed = narrowedCandidates
            .map((b) => {
              if (!b.allowReservations) return null;
              if (!b.latitude || !b.longitude) return null;
              if (prefs.municipalityId && (!b.municipalityId || b.municipalityId !== prefs.municipalityId)) return null;
              if (!b.categorySlug || b.categorySlug !== prefs.categorySlug) return null;

              let diff: number | null = null;
              let entranceFeePesos: number | null = null;
              let estPerPerson: number | null = null;

              if (prefs.categorySlug === "resorts-leisure") {
                entranceFeePesos = feeForResort(b);
                if (entranceFeePesos == null) return null;
                diff = Math.abs(entranceFeePesos - target);
              } else if (prefs.categorySlug === "food-dining") {
                diff = foodDiff(b);
                if (diff == null) return null;
                estPerPerson = target;
              } else {
                return null;
              }

              const distKm = haversineKm(prefs.origin, {
                latitude: b.latitude,
                longitude: b.longitude,
              });
              const pop = Math.max(
                0,
                Math.floor(Number(b.ratingCount ?? 0) || 0),
              );
              return { b, diff, distKm, pop, entranceFeePesos, estPerPerson };
            })
            .filter((x): x is NonNullable<typeof x> => !!x)
            .sort((a, b) => {
              if (a.diff !== b.diff) return a.diff - b.diff;
              if (a.distKm !== b.distKm) return a.distKm - b.distKm;
              return b.pop - a.pop;
            })
            .slice(0, 5);

          if (relaxed.length) {
            setNoMatchNote(
              `No exact budget match for ₱${target}. Showing destinations closest to your budget instead.`,
            );
            setFallbackCategory([]);
            setStops(
              relaxed.map((x) => ({
                id: x.b.id,
                name: x.b.name,
                latitude: x.b.latitude ?? null,
                longitude: x.b.longitude ?? null,
                categoryName: x.b.categoryName ?? undefined,
                photoUrl: x.b.photoUrl,
                distanceKm: x.distKm,
                ratingAverage: x.b.ratingAverage,
                ratingCount: x.b.ratingCount,
                estimatedPerPersonPesos: x.estPerPerson,
                estimatedEntrancePesos: x.entranceFeePesos,
                estimatedGroupSize: derivedGroupSize,
                estimatedCostMinPesos: x.b.estimatedCostMin,
                estimatedCostMaxPesos: x.b.estimatedCostMax,
                estimatedTotalPesos:
                  prefs.categorySlug === "resorts-leisure" && x.entranceFeePesos != null
                    ? x.entranceFeePesos
                    : null,
              })),
            );
            setView("results");
            return;
          }
        }

        setNoMatchNote(
          "No destinations matched your preferences. Showing available destinations in your selected category instead.",
        );
        setFallbackCategory(narrowedCandidates);
        setView("results");
        return;
      }

      setStops(
        ranked.map((b) => ({
          id: b.id,
          name: b.name,
          latitude: b.latitude ?? null,
          longitude: b.longitude ?? null,
          categoryName: b.categoryName ?? undefined,
          photoUrl: b.photoUrl,
          distanceKm: Number.isFinite(b.distKm) ? b.distKm : null,
          ratingAverage: b.ratingAverage,
          ratingCount: b.ratingCount,
          estimatedTotalPesos: b.estimatedTotalPesos ?? null,
          estimatedEntrancePesos: b.entranceFeePesos ?? null,
          estimatedAccommodationPesos: b.accommodationPick?.pricePesos ?? b.accommodationCheapestPesos ?? null,
          estimatedAccommodationName: b.accommodationPick?.name ?? null,
          estimatedAccommodationPax: b.accommodationPick?.pax ?? null,
          estimatedGroupSize: derivedGroupSize,
          estimatedPerPersonPesos: b.estimatedTotalPerPersonPesos ?? null,
          estimatedCostMinPesos: b.estimatedCostMin,
          estimatedCostMaxPesos: b.estimatedCostMax,
        })),
      );
      setNoMatchNote(null);
      setFallbackCategory([]);
      setView("results");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not generate.");
      setView("form");
    }
  }, [
    municipalityId,
    categorySlug,
    resortPeriod,
    derivedBudget,
    derivedGroupSize,
    budgetValue,
    budgetInput,
    groupSizeInput,
    foodVisitTime,
    prio1,
    prio2,
    prio3,
    setStops,
    natureSubcategory,
  ]);

  // ─── Loading View ───────────────────────────────────────────────────────────

  const loadingContent = (
    <View style={styles.loadingWrap}>
      <View style={styles.loadingHead}>
        <Text style={styles.loadingTitle}>✨ Generating your itinerary…</Text>
        <Text style={styles.loadingSub}>Finding the best destinations for your preferences.</Text>
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.loadingCard, { opacity: 1 - i * 0.18 }]} />
      ))}
    </View>
  );

  // ─── Results View ───────────────────────────────────────────────────────────

  const resultsContent = (
    <View>
      {/* Results header */}
      <View style={styles.resultsHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultsTitle}>🗺️ Generated Results</Text>
          <Text style={styles.resultsSub}>
            {stops.length} destination{stops.length === 1 ? "" : "s"} matched
          </Text>
        </View>
        <Pressable
          onPress={() => setView("form")}
          style={({ pressed }) => [styles.regenBtn, pressed && { opacity: 0.85 }]}
        >
            <LinearGradient
              colors={["rgba(4,120,126,0.12)", "rgba(14,201,182,0.10)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.regenBtnInner}
          >
              <Ionicons name="refresh-outline" size={15} color={colors.primaryTealDeep} />
            <Text style={styles.regenBtnTxt}>Regenerate</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {noMatchNote ? (
        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={18} color={colors.primaryTealDeep} />
          <Text style={styles.noteText}>{noMatchNote}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 8 }}>
        {stops.map((s, idx) => {
          return (
            <Pressable
              key={s.id}
              style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.95 }]}
              onPress={() => navigation?.navigate?.("Detail", { id: s.id })}
            >
              {/* Thumbnail */}
              {s.photoUrl ? (
                <Image source={{ uri: s.photoUrl }} style={styles.resultThumb} />
              ) : (
                <View style={[styles.resultThumb, styles.resultThumbPh]}>
                  <LinearGradient
                    colors={["rgba(4,120,126,0.10)", "rgba(14,201,182,0.10)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="image-outline" size={22} color={colors.primaryTealDeep} />
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.resultName} numberOfLines={2}>{s.name}</Text>
                <Text style={styles.resultCat}>{s.categoryName ?? "Destination"}</Text>

                <View style={styles.metaRow}>
                  {([prio1, prio2, prio3] as const).map((k) => {
                    if (k === "distance") {
                      return (
                        <View key={k} style={[styles.metaPill, { backgroundColor: "rgba(4,120,126,0.10)", borderColor: "rgba(4,120,126,0.20)" }]}>
                          <Ionicons name="navigate" size={11} color={colors.primaryTealDeep} />
                          <Text style={[styles.metaPillTxt, { color: colors.primaryTealDeep }]}>
                            {typeof s.distanceKm === "number"
                              ? s.distanceKm < 1
                                ? `${Math.round(s.distanceKm * 1000)} m`
                                : `${s.distanceKm.toFixed(1)} km`
                              : "—"}
                          </Text>
                        </View>
                      );
                    }
                    if (k === "popularity") {
                      const p = ratingParts(s.ratingAverage, s.ratingCount);
                      return (
                        <View key={k} style={[styles.metaPill, { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }]}>
                          <Ionicons name="star" size={11} color="#D97706" />
                          <Text style={[styles.metaPillTxt, { color: "#92400E" }]}>
                            {p.kind === "new" ? "New" : `${p.averageText} · ${p.count}`}
                          </Text>
                        </View>
                      );
                    }
                    // budget
                    const perPerson =
                      typeof s.estimatedPerPersonPesos === "number"
                        ? Math.round(s.estimatedPerPersonPesos)
                        : typeof s.estimatedEntrancePesos === "number"
                          ? Math.round(s.estimatedEntrancePesos)
                          : null;
                    return (
                      <View key={k} style={[styles.metaPill, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
                        <Ionicons name="cash" size={11} color="#16A34A" />
                        <Text style={[styles.metaPillTxt, { color: "#15803D" }]}>
                          {perPerson != null ? peso(perPerson) : "—"}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.resultHintRow}>
                  <View style={{ flex: 1 }} />
                  <Pressable
                    onPress={() => setDetailsStopId(s.id)}
                    style={({ pressed }) => [styles.viewDetailsBtn, pressed && { opacity: 0.9 }]}
                  >
                    <Text style={styles.viewDetailsBtnTxt}>View details</Text>
                    <Ionicons name="information-circle-outline" size={16} color={colors.primaryTealDeep} />
                  </Pressable>
                </View>
              </View>

            <Ionicons name="chevron-forward" size={18} color="rgba(4,120,126,0.55)" />
            </Pressable>
          );
        })}

        {stops.length === 0 &&
          (fallbackCategory.length ? (
            <View style={{ marginTop: 4 }}>
              {fallbackCategory.slice(0, 10).map((c) => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.95 }]}
                  onPress={() => navigation?.navigate?.("Detail", { id: c.id })}
                >
                  {c.photoUrl ? (
                    <Image source={{ uri: c.photoUrl }} style={styles.resultThumb} />
                  ) : (
                    <View style={[styles.resultThumb, styles.resultThumbPh]}>
                      <Ionicons name="image-outline" size={20} color={colors.primaryTealDeep} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={2}>{c.name}</Text>
                    <Text style={styles.resultCat}>
                      {c.categoryName ?? "Destination"}
                      {c.municipalityName ? ` · ${c.municipalityName}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(4,120,126,0.55)" />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>
              No destinations found. Try a different municipality or category.
            </Text>
          ))}
      </View>

      <Modal
        visible={Boolean(detailsStop)}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsStopId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDetailsStopId(null)} />
        <View style={[styles.modalWrap, { pointerEvents: "box-none" as any }]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Estimated cost</Text>
              <Pressable onPress={() => setDetailsStopId(null)} hitSlop={10} accessibilityLabel="Close details">
                <Ionicons name="close" size={22} color={colors.navy} />
              </Pressable>
            </View>
            {detailsStop ? (
              <View style={styles.modalBody}>
                <Text style={styles.modalPlace} numberOfLines={2}>{detailsStop.name}</Text>
                {detailsStop.estimatedGroupSize ? (
                  <Text style={styles.modalMeta}>Group size: {detailsStop.estimatedGroupSize}</Text>
                ) : (
                  <Text style={styles.modalMeta}>Group size: —</Text>
                )}

                {typeof detailsStop.estimatedEntrancePesos === "number" ? (
                  <View style={styles.costRow}>
                    <Text style={styles.costK}>Entrance (per person)</Text>
                    <Text style={styles.costV}>{peso(detailsStop.estimatedEntrancePesos)}</Text>
                  </View>
                ) : null}

                {typeof detailsStop.estimatedEntrancePesos === "number" && detailsStop.estimatedGroupSize ? (
                  <View style={styles.costRow}>
                    <Text style={styles.costK}>
                      Entrance total ({detailsStop.estimatedEntrancePesos} × {detailsStop.estimatedGroupSize})
                    </Text>
                    <Text style={styles.costV}>
                      {peso(detailsStop.estimatedEntrancePesos * detailsStop.estimatedGroupSize)}
                    </Text>
                  </View>
                ) : null}

                {detailsStop.estimatedAccommodationPesos != null ? (
                  <View style={styles.costRow}>
                    <Text style={styles.costK}>
                      Accommodation{detailsStop.estimatedAccommodationPax ? ` (${detailsStop.estimatedAccommodationPax})` : ""}
                    </Text>
                    <Text style={styles.costV}>{peso(detailsStop.estimatedAccommodationPesos)}</Text>
                  </View>
                ) : null}

                {typeof detailsStop.estimatedCostMinPesos === "number" &&
                typeof detailsStop.estimatedCostMaxPesos === "number" ? (
                  <>
                    <View style={styles.costRow}>
                      <Text style={styles.costK}>Estimated cost (per person)</Text>
                      <Text style={styles.costV}>
                        {peso(detailsStop.estimatedCostMinPesos)}–{peso(detailsStop.estimatedCostMaxPesos)}
                      </Text>
                    </View>
                    {detailsStop.estimatedGroupSize ? (
                      <View style={styles.costRow}>
                        <Text style={styles.costK}>
                          Estimated total ({detailsStop.estimatedGroupSize} persons)
                        </Text>
                        <Text style={styles.costV}>
                          {peso(detailsStop.estimatedCostMinPesos * detailsStop.estimatedGroupSize)}–
                          {peso(detailsStop.estimatedCostMaxPesos * detailsStop.estimatedGroupSize)}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {typeof detailsStop.estimatedTotalPesos === "number" ? (
                  <View style={[styles.costRow, styles.costRowTotal]}>
                    <Text style={styles.costKTotal}>Total</Text>
                    <Text style={styles.costVTotal}>{peso(detailsStop.estimatedTotalPesos)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );

  // ─── Form View ──────────────────────────────────────────────────────────────

  const formContent = (
    <View>
      {/* Top card */}
      <LinearGradient
        colors={["#F5F3FF", "#EFF6FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topCard}
      >
        <View style={styles.topCardLeft}>
          <LinearGradient
            colors={["rgba(4,120,126,0.18)", "rgba(14,201,182,0.10)"]}
            style={styles.topCardIconWrap}
          >
            <Ionicons name="location" size={26} color={colors.primaryTealDeep} />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.topCardTitle}>Generate Itinerary</Text>
          </View>
        </View>
        <Pressable style={({ pressed }) => [styles.locationPill, pressed && { opacity: 0.88 }]}>
          <LinearGradient
            colors={["rgba(4,120,126,0.10)", "rgba(14,201,182,0.08)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.locationPillInner}
          >
            <Ionicons name="navigate" size={14} color={colors.primaryTealDeep} />
            <Text style={styles.locationPillTxt}>Using current location</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primaryTealDeep} />
          </LinearGradient>
        </Pressable>
      </LinearGradient>

      {/* Municipality */}
      <SectionRow
        left="CHOOSE MUNICIPALITY"
        right={{ label: "View all", onPress: () => {} }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.muniRow}
      >
        <MuniChip
          key="all"
          name="All"
          active={municipalityId === ""}
          onPress={() => setMunicipalityId("")}
        />
        {municipalities.slice(0, 12).map((m) => (
          <MuniChip
            key={m.id}
            name={m.name}
            active={municipalityId === m.id}
            onPress={() => setMunicipalityId(m.id)}
          />
        ))}
      </ScrollView>

      {/* Category */}
      <SectionRow left="CHOOSE CATEGORY" />
      <View style={styles.catRow}>
        <CategoryCard
          active={categorySlug === "resorts-leisure"}
          title={"Resort &\nLeisure"}
          emoji="🏖️"
          gradient={["#E0F7FA", "#B2EBF2", "#E0F7FA"]}
          onPress={() => {
            setCategorySlug("resorts-leisure");
            setNatureSubcategory("all");
            setBudgetInput("");
            setBudgetValue(150);
          }}
        />
        <CategoryCard
          active={categorySlug === "nature-adventure"}
          title={"Nature &\nAdventure"}
          emoji="🌿"
          gradient={["#E8F5E9", "#C8E6C9", "#E8F5E9"]}
          onPress={() => {
            setCategorySlug("nature-adventure");
            setBudgetInput("");
            setBudgetValue(150);
          }}
        />
        <CategoryCard
          active={categorySlug === "food-dining"}
          title={"Food &\nDining"}
          emoji="🍜"
          gradient={["#FFF3E0", "#FFE0B2", "#FFF3E0"]}
          onPress={() => {
            setCategorySlug("food-dining");
            setNatureSubcategory("all");
            setBudgetInput("");
            setBudgetValue(150);
          }}
        />
      </View>

      {/* Best time to visit (food only) */}
      {categorySlug === "food-dining" && (
        <>
          <SectionRow left="BEST TIME TO VISIT" />
          <View style={styles.foodTimeRow}>
            {(["Breakfast", "Lunch", "Dinner"] as const).map((t, idx, arr) => {
              const active = foodVisitTime === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setFoodVisitTime(t)}
                  style={({ pressed }) => [
                    styles.foodTimeBtn,
                    idx === 0 && styles.foodTimeBtnFirst,
                    idx === arr.length - 1 && styles.foodTimeBtnLast,
                    active && styles.foodTimeBtnActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  {active ? (
                    <LinearGradient
                      colors={["rgba(253,186,116,0.55)", "rgba(34,197,94,0.12)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <Text style={[styles.foodTimeTxt, active && styles.foodTimeTxtActive]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Day / Night (resorts only) */}
      {categorySlug === "resorts-leisure" && (
        <>
          <SectionRow left="DAY / NIGHT" />
          <View style={styles.dayNightRow}>
            <Pressable
              onPress={() => setResortPeriod("day")}
              style={({ pressed }) => [
                styles.dayNightBtn,
                resortPeriod === "day" && styles.dayNightBtnActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              {resortPeriod === "day" ? (
                <LinearGradient
                  colors={["#FEF3C7", "#FDE68A"]}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text style={styles.dayNightEmoji}>☀️</Text>
              <Text style={[styles.dayNightTxt, resortPeriod === "day" && { color: "#92400E" }]}>
                Day
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setResortPeriod("night")}
              style={({ pressed }) => [
                styles.dayNightBtn,
                resortPeriod === "night" && styles.dayNightBtnActiveNight,
                pressed && { opacity: 0.9 },
              ]}
            >
              {resortPeriod === "night" ? (
                <LinearGradient
                  colors={["#1E3A5F", "#312E81"]}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text style={styles.dayNightEmoji}>🌙</Text>
              <Text style={[styles.dayNightTxt, resortPeriod === "night" && { color: "#C7D2FE" }]}>
                Night
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Budget */}
      <SectionRow
        left={
          categorySlug === "resorts-leisure" ? "ENTRANCE BUDGET" : "BUDGET PER PERSON"
        }
      />
      <View style={styles.budgetRow}>
        {[
          { val: 50, grad: ["#BFDBFE", "#93C5FD"] as [string, string] },
          { val: 100, grad: ["#BBF7D0", "#86EFAC"] as [string, string] },
          { val: 150, grad: ["#FED7AA", "#FDBA74"] as [string, string] },
          { val: 200, grad: ["#A7F3D0", "#5EEAD4"] as [string, string] },
        ].map(({ val, grad }) => (
          <BudgetChip
            key={val}
            active={budgetValue === val && !budgetInput.trim()}
            label={`₱${val}`}
            gradient={grad}
            onPress={() => {
              setBudgetInput("");
              setBudgetValue(val);
            }}
          />
        ))}
      </View>

      <View style={styles.budgetInputRow}>
        <View style={styles.budgetInputIcon}>
          <Ionicons name="calculator-outline" size={17} color="#9CA3AF" />
        </View>
        <TextInput
          value={budgetInput}
          onChangeText={setBudgetInput}
          placeholder={
            categorySlug === "resorts-leisure"
              ? "Enter entrance budget"
              : "Enter budget per person"
          }
          placeholderTextColor="rgba(100,116,139,0.5)"
          keyboardType="numeric"
          style={styles.budgetInput}
        />
        <Text style={styles.budgetHint}>e.g. 250</Text>
      </View>

      {/* Group size */}
      <SectionRow left="GROUP SIZE" />
      <View style={styles.budgetInputRow}>
        <View style={styles.budgetInputIcon}>
          <Ionicons name="people-outline" size={17} color="#9CA3AF" />
        </View>
        <TextInput
          value={groupSizeInput}
          onChangeText={(t) => setGroupSizeInput(t.replace(/[^\d]/g, "").slice(0, 3))}
          placeholder="Enter group size"
          placeholderTextColor="rgba(100,116,139,0.5)"
          keyboardType="numeric"
          style={styles.budgetInput}
        />
        <Text style={styles.budgetHint}>e.g. 6</Text>
      </View>

      {/* Priorities */}
      <SectionRow
        left="PRIORITIES (1ST → 3RD)"
        right={{ label: "What's this?", onPress: () => {} }}
      />
      <View style={{ marginTop: 10, gap: 10 }}>
        <PriorityRow rank={1} value={prio1} onSelect={(k) => setPriority(1, k)} />
        <PriorityRow rank={2} value={prio2} onSelect={(k) => setPriority(2, k)} />
        <PriorityRow rank={3} value={prio3} onSelect={(k) => setPriority(3, k)} />
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaHit,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
        onPress={generate}
      >
        <LinearGradient
          colors={["#22C55E", "#14B8A6", "#16A34A"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.cta}
        >
          <Text style={styles.ctaEmoji}>✨</Text>
          <Text style={styles.ctaTxt}>Generate Itinerary</Text>
          <Ionicons name="send" size={17} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );

  const content =
    view === "loading"
      ? loadingContent
      : view === "results"
        ? resultsContent
        : formContent;

  return (
    <ScrollView
      ref={(r) => {
        scrollRef.current = r;
      }}
      style={styles.root}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 26 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <ImageBackground source={HERO_BACKGROUND} style={styles.heroBg} resizeMode="cover">
        <LinearGradient
          colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0.12)", "rgba(0,0,0,0)"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroTop, { paddingTop: Math.max(insets.top, 10) }]}>
          <Pressable
            onPress={() => navigation?.goBack?.()}
            hitSlop={10}
            style={({ pressed }) => [styles.heroBack, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.heroBalloon}>
            <Text style={{ fontSize: 28 }}>🎈</Text>
          </View>
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.heroKickerWrap}>
            <Text style={styles.heroKicker}>ITINERARY</Text>
          </View>
          <Text style={styles.heroTitle}>Itinerary</Text>
          <Text style={styles.heroSub}>Plan your perfect trip ✨</Text>
        </View>
      </ImageBackground>

      {/* Sheet */}
      <View style={styles.sheet}>{content}</View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F4FF" },

  // Hero
  heroBg: { height: 220, width: "100%" },
  heroTop: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },
  heroBalloon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { paddingHorizontal: 18, paddingTop: 10 },
  heroKickerWrap: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: 1.6,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.8,
    textShadowColor: "rgba(0,0,0,0.22)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSub: {
    marginTop: 3,
    fontSize: 14.5,
    fontWeight: "600",
    color: "rgba(255,255,255,0.90)",
  },

  // Sheet
  sheet: {
    marginTop: -58,
    marginHorizontal: 12,
    backgroundColor: "#FDFCFF",
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.30)",
    ...shadowCompat({ opacity: 0.12, radius: 20, offsetY: 10, elevation: 10 }),
  },

  // Section row
  sectionRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1.1,
  },
  sectionRight: { flexDirection: "row", alignItems: "center", gap: 3 },
  sectionRightTxt: { fontSize: 12.5, fontWeight: "700", color: colors.primaryTealDeep },

  // Top card
  topCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.35)",
    flexDirection: "column",
    gap: 10,
    ...shadowCompat({ opacity: 0.06, radius: 12, offsetY: 6, elevation: 4 }),
  },
  topCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  topCardIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topCardTitle: { fontSize: 15, fontWeight: "800", color: "#1E1B4B" },
  topCardSub: { marginTop: 2, fontSize: 12.5, fontWeight: "600", color: colors.primaryTealDeep },
  locationPill: { borderRadius: 14, overflow: "hidden" },
  locationPillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(4,120,126,0.26)",
  },
  locationPillTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.primaryTealDeep },

  // Municipality
  muniRow: { gap: 10, paddingTop: 10, paddingBottom: 2, paddingRight: 10 },
  muniChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "#fff",
  },
  muniChipActive: {
    borderColor: "rgba(4,120,126,0.35)",
    backgroundColor: "rgba(4,120,126,0.06)",
    transform: [{ translateY: -1 }],
  },
  muniIconBg: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  muniTxt: { fontSize: 13, fontWeight: "700", color: "#64748B", maxWidth: 130 },
  muniTxtActive: { color: colors.navy },
  muniCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryTealDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  // Category
  catRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  catCardHit: { flex: 1 },
  catCard: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.18)",
    overflow: "hidden",
  },
  catCardActive: {
    borderColor: "rgba(4,120,126,0.40)",
    transform: [{ translateY: -2 }],
    ...shadowCompat({ opacity: 0.12, radius: 14, offsetY: 6, elevation: 6 }),
  },
  catActiveRing: {
    position: "absolute",
    inset: 0,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(4,120,126,0.22)",
  },
  catEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.80)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.20)",
    marginBottom: 8,
  },
  catEmoji: { fontSize: 26 },
  catTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E1B4B",
    textAlign: "center",
    lineHeight: 17,
  },
  catCheckDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryTealDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  // Day / Night
  dayNightRow: {
    marginTop: 10,
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.22)",
    height: 52,
  },
  dayNightBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
    borderRadius: 0,
  },
  dayNightBtnActive: { backgroundColor: "#FEF3C7" },
  dayNightBtnActiveNight: { backgroundColor: "#1E3A5F" },
  dayNightEmoji: { fontSize: 18 },
  dayNightTxt: { fontSize: 14, fontWeight: "700", color: "#64748B" },

  // Best time to visit (food)
  foodTimeRow: {
    marginTop: 10,
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "#FFFFFF",
    height: 48,
  },
  foodTimeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "rgba(148,163,184,0.18)",
    overflow: "hidden",
  },
  foodTimeBtnFirst: {},
  foodTimeBtnLast: { borderRightWidth: 0 },
  foodTimeBtnActive: {
    backgroundColor: "rgba(253,186,116,0.18)",
  },
  foodTimeTxt: { fontSize: 13.5, fontWeight: "800", color: "rgba(71,85,105,0.85)" },
  foodTimeTxtActive: { color: "#1E1B4B" },

  // Budget
  budgetRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  budgetChipHit: { flex: 1 },
  budgetChip: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.20)",
    gap: 3,
  },
  budgetChipActive: {
    borderColor: "rgba(22,163,74,0.55)",
    transform: [{ translateY: -2 }],
    ...shadowCompat({ opacity: 0.10, radius: 10, offsetY: 4, elevation: 4 }),
  },
  budgetChipTxt: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#94A3B8",
  },
  budgetChipTxtActive: { color: "#FFFFFF", fontWeight: "900" },

  budgetInputRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...shadowCompat({ opacity: 0.05, radius: 10, offsetY: 6, elevation: 2 }),
  },
  budgetInputIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  budgetInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1E1B4B",
    minWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
        } as any)
      : null),
  },
  budgetHint: { fontSize: 12, fontWeight: "600", color: "rgba(71,85,105,0.55)" },

  // Priorities
  prioRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  prioChipHit: { flex: 1 },
  prioChip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.40)",
    backgroundColor: "#F8F6FF",
    overflow: "hidden",
    paddingBottom: 10,
  },
  prioBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  prioDot: { width: 6, height: 6, borderRadius: 3 },
  prioBadgeTxt: { fontSize: 11, fontWeight: "800" },
  prioInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  prioLabel: { fontSize: 12.5, fontWeight: "800", flex: 1 },

  prioRow2: { gap: 8 },
  prioRowLabel: { fontSize: 12.5, fontWeight: "800", color: "#1E1B4B" },
  prioSeg: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "#FFFFFF",
  },
  prioSegBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "rgba(148,163,184,0.18)",
  },
  prioSegBtnFirst: {},
  prioSegBtnLast: { borderRightWidth: 0 },
  prioSegBtnActive: {
    backgroundColor: "rgba(4,120,126,0.10)",
  },
  prioSegTxt: { fontSize: 12.5, fontWeight: "800", color: "rgba(71,85,105,0.85)" },
  prioSegTxtActive: { color: colors.primaryTealDeep },

  // CTA
  ctaHit: { marginTop: 16, borderRadius: 20, overflow: "hidden" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  ctaEmoji: { fontSize: 18 },
  ctaTxt: { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: -0.2 },

  // Loading
  loadingWrap: { marginTop: 10 },
  loadingHead: { marginBottom: 14 },
  loadingTitle: { fontSize: 18, fontWeight: "800", color: "#1E1B4B" },
  loadingSub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: "#94A3B8", lineHeight: 18 },
  loadingCard: {
    height: 76,
    borderRadius: 18,
    backgroundColor: "rgba(4,120,126,0.10)",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(4,120,126,0.18)",
  },

  // Results
  resultsHead: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  resultsTitle: { fontSize: 19, fontWeight: "800", color: "#1E1B4B" },
  resultsSub: { marginTop: 2, fontSize: 13, fontWeight: "600", color: "#94A3B8" },
  regenBtn: { borderRadius: 14, overflow: "hidden" },
  regenBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(4,120,126,0.22)",
  },
  regenBtnTxt: { fontSize: 12.5, fontWeight: "700", color: colors.primaryTealDeep },

  noteBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(4,120,126,0.08)",
    borderWidth: 1,
    borderColor: "rgba(4,120,126,0.18)",
    marginBottom: 10,
    marginTop: 6,
  },
  noteText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.primaryTealDeep, lineHeight: 17 },

  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.30)",
    backgroundColor: "#fff",
    marginBottom: 12,
    ...shadowCompat({ opacity: 0.07, radius: 14, offsetY: 6, elevation: 4 }),
    position: "relative",
  },
  resultThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(4,120,126,0.10)",
  },
  resultThumbPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  resultName: { fontSize: 14, fontWeight: "700", color: "#1E1B4B" },
  resultCat: { marginTop: 2, fontSize: 11.5, fontWeight: "600", color: "#94A3B8" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  metaPillTxt: { fontSize: 11.5, fontWeight: "700" },
  resultLine: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    lineHeight: 17,
  },
  resultLineStrong: { fontWeight: "700", color: "#1E1B4B" },
  resultTotal: { marginTop: 5, fontSize: 12.5, fontWeight: "700", color: "#1E1B4B" },
  resultTotalStrong: { fontWeight: "800", color: colors.primaryTealDeep },
  resultHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  resultHintRowText: { flex: 1, minWidth: 0 },
  resultCostHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    fontStyle: "italic",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(4,120,126,0.08)",
    borderWidth: 1,
    borderColor: "rgba(4,120,126,0.20)",
  },
  viewDetailsBtnTxt: { fontSize: 13, fontWeight: "800", color: colors.primaryTealDeep },
  empty: { color: "#94A3B8", marginTop: 16, fontSize: 14, lineHeight: 20, textAlign: "center" },

  // Details modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.62)" },
  modalWrap: { flex: 1, justifyContent: "flex-end", padding: 14 },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.28)",
    overflow: "hidden",
    ...shadowCompat({ opacity: 0.12, radius: 20, offsetY: 10, elevation: 10 }),
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(240,253,250,0.7)",
  },
  modalTitle: { fontSize: 15.5, fontWeight: "900", color: colors.navy },
  modalBody: { padding: 14, gap: 10 },
  modalPlace: { fontSize: 14.5, fontWeight: "800", color: colors.navy },
  modalMeta: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  costRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  costK: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.muted2 },
  costV: { fontSize: 13, fontWeight: "900", color: colors.navy },
  costRowTotal: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.18)" },
  costKTotal: { flex: 1, fontSize: 14, fontWeight: "900", color: colors.navy },
  costVTotal: { fontSize: 14.5, fontWeight: "900", color: colors.primaryTealDeep },
});