import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TabInlineBackButton } from "../components/ScreenBackBar";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
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
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { firstPhotoPublicUrl } from "../lib/businessDisplay";
import {
  rankCandidates,
  type BizCandidate,
  type FoodVisitTime,
  type PriorityKey,
  type ResortPeriod,
} from "../lib/itineraryGenerator";

function peso(n: number) {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function usePressMotion() {
  const scale = useMemo(() => new Animated.Value(1), []);
  const shakeX = useMemo(() => new Animated.Value(0), []);

  const bounceAndShake = useCallback(() => {
    // Grow briefly, then return, plus a small shake.
    shakeX.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 90,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 6,
        }),
      ]),
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 1, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -1, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 1, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]),
    ]).start();
  }, [scale, shakeX]);

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

function IconChip({
  active,
  icon,
  label,
  onPress,
  scheme = "neutral",
  variant = "chip",
  chipStyle,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  scheme?: "neutral" | "resort" | "nature" | "food" | "day" | "night" | "budget" | "people" | "prio";
  variant?: "chip" | "card";
  chipStyle?: ViewStyle;
}) {
  const m = usePressMotion();
  const palette = useMemo(() => {
    const mk = (activeBg: string, idleBg: string, activeBorder: string, idleBorder: string, activeIcon: string, idleIcon: string) => ({
      activeBg,
      idleBg,
      activeBorder,
      idleBorder,
      activeIcon,
      idleIcon,
    });
    switch (scheme) {
      case "resort":
        return mk("rgba(14, 201, 182, 0.18)", "rgba(14, 201, 182, 0.10)", "rgba(14, 201, 182, 0.32)", "rgba(148, 163, 184, 0.24)", colors.primaryTealDeep, "#475569");
      case "nature":
        return mk("rgba(34, 197, 94, 0.18)", "rgba(34, 197, 94, 0.10)", "rgba(34, 197, 94, 0.32)", "rgba(148, 163, 184, 0.24)", "#16a34a", "#475569");
      case "food":
        return mk("rgba(236, 72, 153, 0.18)", "rgba(236, 72, 153, 0.10)", "rgba(236, 72, 153, 0.32)", "rgba(148, 163, 184, 0.24)", "#db2777", "#475569");
      case "day":
        return mk("rgba(251, 146, 60, 0.22)", "rgba(251, 146, 60, 0.12)", "rgba(251, 146, 60, 0.35)", "rgba(148, 163, 184, 0.24)", "#f97316", "#475569");
      case "night":
        return mk("rgba(59, 130, 246, 0.20)", "rgba(59, 130, 246, 0.10)", "rgba(59, 130, 246, 0.32)", "rgba(148, 163, 184, 0.24)", "#2563eb", "#475569");
      case "budget":
        return mk("rgba(236, 72, 153, 0.18)", "rgba(236, 72, 153, 0.08)", "rgba(236, 72, 153, 0.30)", "rgba(148, 163, 184, 0.24)", "#111827", "#475569");
      case "people":
        return mk("rgba(2, 132, 199, 0.18)", "rgba(2, 132, 199, 0.08)", "rgba(2, 132, 199, 0.30)", "rgba(148, 163, 184, 0.24)", "#0284c7", "#475569");
      case "prio":
        return mk("rgba(11, 184, 196, 0.16)", "rgba(15, 23, 42, 0.04)", "rgba(11, 184, 196, 0.34)", "rgba(148, 163, 184, 0.24)", colors.primaryTealDeep, "#475569");
      default:
        return mk("rgba(11, 184, 196, 0.14)", "rgba(15, 23, 42, 0.04)", "rgba(11, 184, 196, 0.30)", "rgba(148, 163, 184, 0.24)", colors.primaryTealDeep, "#475569");
    }
  }, [scheme]);

  const iconBadgeBg = active ? palette.activeBg : "rgba(15, 23, 42, 0.03)";

  return (
    <Pressable
      onPress={() => {
        m.bounceAndShake();
        onPress();
      }}
      style={({ pressed }) => [styles.genChipHit, pressed && { opacity: 0.95 }, variant === "card" && { flex: 1 }]}
    >
      <Animated.View
        style={[
          variant === "card" ? styles.genCardBtn : styles.genChip,
          chipStyle,
          {
            backgroundColor: active ? palette.activeBg : palette.idleBg,
            borderColor: active ? palette.activeBorder : palette.idleBorder,
          },
          { transform: m.transform },
        ]}
      >
        {variant === "card" ? (
          <>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: iconBadgeBg,
                  borderColor: active ? palette.activeBorder : "rgba(148, 163, 184, 0.20)",
                },
              ]}
            >
              <Ionicons name={icon} size={22} color={active ? palette.activeIcon : palette.idleIcon} />
            </View>
            <Text style={[styles.genCardBtnTxt, active && styles.genCardBtnTxtOn]} numberOfLines={2}>
              {label}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name={icon} size={18} color={active ? palette.activeIcon : palette.idleIcon} style={{ marginRight: 6 }} />
            <Text style={[styles.genChipTxt, active && styles.genChipTxtOn]}>{label}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function ItineraryScreen() {
  const insets = useSafeAreaInsets();
  const { stops, setStops } = useItinerary();
  const [view, setView] = useState<"form" | "loading" | "results">("form");
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  const [municipalityId, setMunicipalityId] = useState<string>("");
  const [categorySlug, setCategorySlug] = useState<string>("resorts-leisure");
  const [resortPeriod, setResortPeriod] = useState<ResortPeriod>("day");
  const [budgetValue, setBudgetValue] = useState<number | null>(150);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [groupSizeInput, setGroupSizeInput] = useState<string>("2");
  const [foodVisitTime, setFoodVisitTime] = useState<FoodVisitTime>("Lunch");
  const [prio1, setPrio1] = useState<PriorityKey>("distance");
  const [prio2, setPrio2] = useState<PriorityKey>("popularity");
  const [prio3, setPrio3] = useState<PriorityKey>("budget");

  const setPriority = useCallback(
    (slot: 1 | 2 | 3, key: PriorityKey) => {
      // Keep priorities unique. If the chosen key is already used in another slot, swap values.
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
      // slot === 3
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
    const n = Number(groupSizeInput.trim());
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
    return null;
  }, [groupSizeInput]);

  // This screen remains mounted in tabs; reset to planning whenever user returns.
  useFocusEffect(
    useCallback(() => {
      setView("form");
      return () => {};
    }, []),
  );

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
    const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    setMunicipalities(list);
    setMunicipalityId((prev) => (prev && list.some((x) => x.id === prev) ? prev : list[0]?.id ?? ""));
  }, []);

  useEffect(() => {
    void loadMunicipalities();
  }, [loadMunicipalities]);

  const generate = useCallback(async () => {
    if (!municipalityId) {
      Alert.alert("Missing municipality", "Please select a municipality first.");
      return;
    }
    setView("loading");

    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Location required", "Please allow location access to generate an itinerary by distance.");
        setView("form");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };

      const { data, error } = await supabase
        .from("businesses")
        .select(
          "id,name,latitude,longitude,allow_reservations,operating_day,operating_night,entrance_fee_pesos,entrance_fee_day_pesos,entrance_fee_night_pesos,accommodations,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,rating_average,rating_count,categories(slug,name),municipalities(id,name),business_photos(storage_path,sort_order)",
        )
        .eq("status", "approved")
        .eq("allow_reservations", true)
        .eq("municipality_id", municipalityId)
        .order("sort_order", { ascending: true, foreignTable: "business_photos" });
      if (error || !data) {
        Alert.alert("Error", error?.message ?? "Could not load destinations.");
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

      const prefs = {
        origin,
        municipalityId,
        categorySlug,
        resortPeriod,
        entranceBudget: categorySlug === "resorts-leisure" ? derivedBudget : null,
        groupSize:
          categorySlug === "resorts-leisure" ? derivedGroupSize : categorySlug === "food-dining" ? derivedGroupSize : derivedGroupSize,
        foodVisitTime: categorySlug === "food-dining" ? foodVisitTime : null,
        foodBudgetPerPerson: categorySlug === "food-dining" ? derivedBudget : null,
        priorities: [prio1, prio2, prio3] as [PriorityKey, PriorityKey, PriorityKey],
      };

      const ranked = rankCandidates(candidates, prefs).slice(0, 5);
      if (ranked.length === 0) {
        Alert.alert("No matches", "No destinations matched your preferences. Try changing budget, period, or priorities.");
        setStops([]);
        setView("form");
        return;
      }

      setStops(
        ranked.map((b) => ({
          id: b.id,
          name: b.name,
          latitude: b.latitude!,
          longitude: b.longitude!,
          categoryName: b.categoryName ?? undefined,
          photoUrl: b.photoUrl,
          estimatedTotalPesos: b.estimatedTotalPesos ?? null,
          estimatedEntrancePesos:
            b.entranceFeePesos != null && (derivedGroupSize ?? 0) > 0
              ? b.entranceFeePesos * Math.max(1, derivedGroupSize ?? 1)
              : b.entranceFeePesos ?? null,
          estimatedAccommodationPesos: b.accommodationPick?.pricePesos ?? b.accommodationCheapestPesos ?? null,
          estimatedAccommodationName: b.accommodationPick?.name ?? null,
          estimatedAccommodationPax: b.accommodationPick?.pax ?? null,
          estimatedGroupSize:
            derivedGroupSize,
          estimatedPerPersonPesos: b.estimatedTotalPerPersonPesos ?? null,
        })),
      );
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
  ]);

  const content = useMemo(() => {
    if (view === "loading") {
      return (
        <View style={styles.loadingWrap}>
          <View style={styles.loadingHead}>
            <Text style={styles.loadingTitle}>Generating itinerary…</Text>
            <Text style={styles.loadingSub}>Finding the best destinations for your preferences.</Text>
          </View>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.loadingCard} />
          ))}
        </View>
      );
    }

    if (view === "results") {
      return (
        <View>
          <View style={styles.resultsHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsTitle}>Generated Results</Text>
              <Text style={styles.resultsSub}>{stops.length} destination{stops.length === 1 ? "" : "s"} matched</Text>
            </View>
            <Pressable
              onPress={() => setView("form")}
              style={({ pressed }) => [styles.smallBtn, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.primaryTealDeep} />
              <Text style={styles.smallBtnTxt}>Generate again</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 10 }}>
            {stops.map((s, idx) => (
              <View key={s.id} style={styles.resultCard}>
                <View style={styles.topBadge} pointerEvents="none">
                  <Text style={styles.topBadgeTxt}>Top {idx + 1}</Text>
                </View>
                <View style={styles.resultIdx}>
                  <Text style={styles.resultIdxTxt}>{idx + 1}</Text>
                </View>
                {s.photoUrl ? (
                  <Image source={{ uri: s.photoUrl }} style={styles.resultThumb} />
                ) : (
                  <View style={[styles.resultThumb, styles.resultThumbPh]}>
                    <Ionicons name="image-outline" size={20} color={colors.muted2} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resultName} numberOfLines={2}>
                    {s.name}
                  </Text>
                  <Text style={styles.resultCat}>{s.categoryName ?? "Destination"}</Text>
                  {typeof s.estimatedGroupSize === "number" ? (
                    <Text style={styles.resultLineMuted}>Group: {s.estimatedGroupSize} person{s.estimatedGroupSize === 1 ? "" : "s"}</Text>
                  ) : null}
                  {typeof s.estimatedPerPersonPesos === "number" ? (
                    <Text style={styles.resultLine}>
                      Est cost: <Text style={styles.resultLineStrong}>{peso(s.estimatedPerPersonPesos)}</Text> / person
                      {typeof s.estimatedGroupSize === "number" ? (
                        <Text style={styles.resultLineMuted}>
                          {" "}
                          × {s.estimatedGroupSize} ={" "}
                          <Text style={styles.resultLineStrong}>{peso(s.estimatedPerPersonPesos * s.estimatedGroupSize)}</Text>
                        </Text>
                      ) : null}
                    </Text>
                  ) : null}
                  {typeof s.estimatedEntrancePesos === "number" && typeof s.estimatedGroupSize === "number" ? (
                    <Text style={styles.resultLine}>
                      Entrance:{" "}
                      <Text style={styles.resultLineStrong}>
                        {peso(Math.round(s.estimatedEntrancePesos / Math.max(1, s.estimatedGroupSize)))}
                      </Text>{" "}
                      × {s.estimatedGroupSize} = <Text style={styles.resultLineStrong}>{peso(s.estimatedEntrancePesos)}</Text>
                    </Text>
                  ) : typeof s.estimatedEntrancePesos === "number" ? (
                    <Text style={styles.resultLine}>
                      Entrance: <Text style={styles.resultLineStrong}>{peso(s.estimatedEntrancePesos)}</Text>
                    </Text>
                  ) : null}
                  {typeof s.estimatedAccommodationPesos === "number" ? (
                    <Text style={styles.resultLine}>
                      Accommodation:{" "}
                      <Text style={styles.resultLineStrong}>
                        {s.estimatedAccommodationName ? s.estimatedAccommodationName : "Stay"}
                      </Text>
                      {s.estimatedAccommodationPax ? (
                        <Text style={styles.resultLineMuted}> ({s.estimatedAccommodationPax})</Text>
                      ) : null}{" "}
                      <Text style={styles.resultLineMuted}>·</Text>{" "}
                      <Text style={styles.resultLineStrong}>{peso(s.estimatedAccommodationPesos)}</Text>
                      <Text style={styles.resultLineMuted}> / night (1 night)</Text>
                    </Text>
                  ) : null}
                  {typeof s.estimatedTotalPesos === "number" ? (
                    <Text style={styles.resultTotal}>
                      Total: <Text style={styles.resultTotalStrong}>{peso(s.estimatedTotalPesos)}</Text>
                      {typeof s.estimatedAccommodationPesos === "number" ? (
                        <Text style={styles.resultLineMuted}> (est. 1 night)</Text>
                      ) : null}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted2} />
              </View>
            ))}
          </View>
        </View>
      );
    }

    // view === "form"
    return (
      <View style={styles.genCard}>
        <View style={styles.genTop}>
          <Text style={styles.genTitle}>Generate itinerary</Text>
          <Text style={styles.genSub}>Using current location (Modified A*).</Text>
        </View>

        <View style={styles.sectionHead}>
          <Ionicons name="navigate-outline" size={16} color={colors.primaryTealDeep} />
          <Text style={styles.sectionHeadTxt}>Using current location</Text>
        </View>

        <Text style={styles.genLabel}>Choose Municipality</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genChipRow}>
          {municipalities.map((m) => (
            <IconChip
              key={m.id}
              active={municipalityId === m.id}
              icon="location-outline"
              label={m.name}
              scheme="neutral"
              onPress={() => setMunicipalityId(m.id)}
            />
          ))}
        </ScrollView>

        <Text style={styles.genLabel}>Choose Category</Text>
        <View style={styles.categoryRow}>
          {[
            { id: "resorts-leisure", label: "Resort & Nature", icon: "bed-outline" as const, scheme: "resort" as const },
            { id: "nature-adventure", label: "Nature & Adventure", icon: "leaf-outline" as const, scheme: "nature" as const },
            { id: "food-dining", label: "Food", icon: "restaurant-outline" as const, scheme: "food" as const },
          ].map((c) => (
            <View key={c.id} style={{ flex: 1 }}>
              <IconChip
                active={categorySlug === c.id}
                icon={c.icon}
                label={c.label}
                scheme={c.scheme}
                variant="card"
                chipStyle={styles.equalCategoryCard}
                onPress={() => setCategorySlug(c.id)}
              />
            </View>
          ))}
        </View>

        {categorySlug === "resorts-leisure" ? (
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.genLabel}>Day / Night</Text>
              <View style={styles.genChipRowWrap}>
                {(["day", "night"] as const).map((p) => (
                  <IconChip
                    key={p}
                    active={resortPeriod === p}
                    icon={p === "day" ? "sunny-outline" : "moon-outline"}
                    label={p === "day" ? "Day" : "Night"}
                    scheme={p === "day" ? "day" : "night"}
                      chipStyle={styles.equalHalfChip}
                    onPress={() => setResortPeriod(p)}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.genLabel}>{categorySlug === "resorts-leisure" ? "Entrance budget" : "Budget per person"}</Text>
        <View style={styles.genChipRowWrap}>
          {[50, 100, 150, 200].map((b) => (
            <IconChip
              key={b}
              active={budgetValue === b && !budgetInput.trim()}
              icon="cash-outline"
              label={`₱${b}`}
              scheme="budget"
                      chipStyle={styles.equalBudgetChip}
              onPress={() => {
                setBudgetInput("");
                setBudgetValue(b);
              }}
            />
          ))}
        </View>
        <TextInput
          value={budgetInput}
          onChangeText={setBudgetInput}
          placeholder="Input custom budget (optional) e.g. ₱250"
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.genLabel}>Group size</Text>
        <TextInput
          value={groupSizeInput}
          onChangeText={setGroupSizeInput}
          placeholder="Input group size"
          keyboardType="numeric"
          style={styles.input}
        />

        {categorySlug === "food-dining" ? (
          <>
            <Text style={styles.genLabel}>Best time to visit</Text>
            <View style={styles.genChipRowWrap}>
              {(["Breakfast", "Lunch", "Dinner"] as const).map((t) => (
                <IconChip
                  key={t}
                  active={foodVisitTime === t}
                  icon={t === "Breakfast" ? "sunny-outline" : t === "Lunch" ? "time-outline" : "moon-outline"}
                  label={t}
                  scheme={t === "Breakfast" ? "day" : t === "Lunch" ? "neutral" : "night"}
                  chipStyle={styles.equalThirdChip}
                  onPress={() => setFoodVisitTime(t)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.genLabel}>Priorities (1st → 3rd)</Text>
        <View style={styles.prioRow}>
          {([
            { key: "distance", label: "Distance", icon: "navigate-outline" as const },
            { key: "popularity", label: "Popularity", icon: "star-outline" as const },
            { key: "budget", label: "Budget", icon: "cash-outline" as const },
          ] as const).map((o) => (
            <View key={o.key} style={styles.prioCol}>
              <Pressable onPress={() => setPriority(1, o.key)} style={[styles.prioBtn, prio1 === o.key && styles.prioBtnOn]}>
                <View style={styles.prioTop}>
                  <Ionicons name={o.icon} size={16} color={prio1 === o.key ? colors.primaryTealDeep : colors.muted2} />
                  <Text style={[styles.prioTxt, prio1 === o.key && styles.prioTxtOn]}>1st</Text>
                </View>
                <Text style={[styles.prioName, prio1 === o.key && styles.prioNameOn]}>{o.label}</Text>
              </Pressable>
              <Pressable onPress={() => setPriority(2, o.key)} style={[styles.prioBtn, prio2 === o.key && styles.prioBtnOn]}>
                <View style={styles.prioTop}>
                  <Ionicons name={o.icon} size={16} color={prio2 === o.key ? colors.primaryTealDeep : colors.muted2} />
                  <Text style={[styles.prioTxt, prio2 === o.key && styles.prioTxtOn]}>2nd</Text>
                </View>
                <Text style={[styles.prioName, prio2 === o.key && styles.prioNameOn]}>{o.label}</Text>
              </Pressable>
              <Pressable onPress={() => setPriority(3, o.key)} style={[styles.prioBtn, prio3 === o.key && styles.prioBtnOn]}>
                <View style={styles.prioTop}>
                  <Ionicons name={o.icon} size={16} color={prio3 === o.key ? colors.primaryTealDeep : colors.muted2} />
                  <Text style={[styles.prioTxt, prio3 === o.key && styles.prioTxtOn]}>3rd</Text>
                </View>
                <Text style={[styles.prioName, prio3 === o.key && styles.prioNameOn]}>{o.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.genBtnHit, pressed && { transform: [{ translateY: 1 }] }]} onPress={generate}>
          <View style={styles.genBtn}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={styles.genBtnTxt}>Generate</Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  }, [
    view,
    municipalities,
    municipalityId,
    categorySlug,
    resortPeriod,
    budgetValue,
    budgetInput,
    groupSizeInput,
    foodVisitTime,
    prio1,
    prio2,
    prio3,
    stops,
    generate,
    setPriority,
  ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 20, paddingTop: Math.max(insets.top, 8) }}
    >
      <View style={styles.kickerRow}>
        {view === "form" ? (
          <TabInlineBackButton />
        ) : (
          <Pressable
            onPress={() => setView("form")}
            hitSlop={10}
            style={({ pressed }) => [styles.inlineBack, pressed && { transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Back to planning"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primaryTealDeep} />
            <Text style={styles.inlineBackTxt}>Back</Text>
          </Pressable>
        )}
        <Text style={styles.kicker}>ITINERARY</Text>
      </View>
      <Text style={styles.title}>Itinerary</Text>
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 2,
  },
  inlineBack: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 6, paddingRight: 8 },
  inlineBackTxt: { fontSize: 12.5, fontWeight: "700", color: colors.primaryTealDeep },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.primaryTeal,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.navy,
    marginTop: 4,
  },
  sectionHead: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(11,184,196,0.10)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.22)",
  },
  sectionHeadTxt: { fontSize: 13, fontWeight: "900", color: colors.primaryTealDeep },
  genCard: {
    marginTop: 14,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  genTop: { marginBottom: 10 },
  genTitle: { fontSize: 16, fontWeight: "800", color: colors.navy },
  genSub: { marginTop: 2, fontSize: 12.5, fontWeight: "600", color: colors.muted2, lineHeight: 17 },
  genLabel: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted2,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  genChipRow: { gap: 10, paddingVertical: 12, paddingRight: 6 },
  genChipRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 12 },
  genChipHit: { borderRadius: 12 },
  genChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.chipIdle,
    minHeight: 46,
  },
  genCardBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 108,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 10,
  },
  genChipOn: {
    borderColor: "rgba(11,184,196,0.35)",
    backgroundColor: "rgba(11,184,196,0.14)",
  },
  genChipTxt: { fontSize: 13.5, fontWeight: "700", color: colors.muted2 },
  genChipTxtOn: { color: colors.primaryTealDeep },
  genCardBtnTxt: { fontSize: 13, fontWeight: "700", color: colors.muted2, textAlign: "center", lineHeight: 17 },
  genCardBtnTxtOn: { color: colors.navy },
  row2: { flexDirection: "row", gap: 12, marginTop: 6 },
  categoryRow: { flexDirection: "row", gap: 10, marginTop: 12, alignItems: "stretch" },
  equalCategoryCard: {
    width: "100%",
  },
  equalHalfChip: {
    width: 126,
    justifyContent: "center",
  },
  equalBudgetChip: {
    width: 92,
    justifyContent: "center",
  },
  equalThirdChip: {
    width: 108,
    justifyContent: "center",
  },
  numRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 10 },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontWeight: "700",
    color: colors.navy,
    backgroundColor: "rgba(15, 23, 42, 0.03)",
  },
  prioRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  prioCol: { flex: 1, gap: 8 },
  prioBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.chipIdle,
  },
  prioBtnOn: {
    borderColor: "rgba(11,184,196,0.35)",
    backgroundColor: "rgba(11,184,196,0.14)",
  },
  prioTxt: { fontSize: 11, fontWeight: "700", color: colors.muted2, opacity: 0.85 },
  prioTxtOn: { color: colors.primaryTealDeep, opacity: 1 },
  prioName: { marginTop: 2, fontSize: 12.5, fontWeight: "700", color: colors.navy },
  prioNameOn: { color: colors.primaryTealDeep },
  prioTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  genBtnHit: { borderRadius: 16, overflow: "hidden" },
  genBtn: {
    marginTop: 14,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  genBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  loadingWrap: { marginTop: 14 },
  loadingHead: { marginBottom: 14 },
  loadingTitle: { fontSize: 18, fontWeight: "800", color: colors.navy },
  loadingSub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: colors.muted2, lineHeight: 18 },
  loadingCard: {
    height: 74,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginBottom: 12,
  },
  resultsHead: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  resultsTitle: { fontSize: 20, fontWeight: "800", color: colors.navy },
  resultsSub: { marginTop: 2, fontSize: 13, fontWeight: "500", color: colors.muted2 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.28)",
    backgroundColor: "rgba(11,184,196,0.10)",
  },
  smallBtnTxt: { fontSize: 13, fontWeight: "600", color: colors.primaryTealDeep },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: colors.white,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    position: "relative",
  },
  topBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(11,184,196,0.10)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.26)",
  },
  topBadgeTxt: { fontSize: 11.5, fontWeight: "700", color: colors.primaryTealDeep },
  resultIdx: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(11,184,196,0.14)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.26)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultIdxTxt: { fontSize: 13, fontWeight: "800", color: colors.primaryTealDeep },
  resultThumb: { width: 54, height: 54, borderRadius: 14, backgroundColor: colors.chipIdle },
  resultThumbPh: { alignItems: "center", justifyContent: "center" },
  resultName: { fontSize: 14.5, fontWeight: "700", color: colors.navy },
  resultCat: { marginTop: 2, fontSize: 12, fontWeight: "500", color: colors.muted2 },
  resultCost: { marginTop: 6, fontSize: 12.5, fontWeight: "500", color: colors.text, lineHeight: 17 },
  resultCostStrong: { fontWeight: "700", color: colors.navy },
  resultCostMeta: { color: colors.muted2, fontWeight: "500" },
  resultLine: { marginTop: 4, fontSize: 12.5, fontWeight: "500", color: colors.text, lineHeight: 17 },
  resultLineStrong: { fontWeight: "700", color: colors.navy },
  resultLineMuted: { color: colors.muted2, fontWeight: "500" },
  resultTotal: { marginTop: 6, fontSize: 13, fontWeight: "600", color: colors.navy },
  resultTotalStrong: { fontWeight: "700", color: colors.primaryTealDeep },
  tabs: {
    flexDirection: "row",
    gap: 24,
    marginTop: 16,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabHit: {
    paddingBottom: 10,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted2,
  },
  tabLabelOn: {
    color: colors.primaryTeal,
  },
  tabLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primaryTeal,
  },
  tripCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  tripTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy,
  },
  tripDates: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "rgba(4, 120, 126, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryTealDeep,
  },
  timelineWrap: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 4,
  },
  timeCol: {
    width: 36,
    alignItems: "center",
    marginRight: 10,
  },
  vline: {
    position: "absolute",
    top: 36,
    bottom: -8,
    width: 2,
    backgroundColor: colors.border,
    left: "50%",
    marginLeft: -1,
  },
  numBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  numText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  itemCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.chipIdle,
  },
  thumbPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  placeName: {
    fontWeight: "800",
    color: colors.navy,
    fontSize: 15,
    flex: 1,
  },
  placeCat: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  placeTime: {
    fontSize: 12,
    color: colors.muted2,
    marginTop: 4,
  },
  costLine: {
    marginTop: 6,
    fontSize: 12.5,
    color: colors.text,
    fontWeight: "700",
    lineHeight: 17,
  },
  costStrong: { fontWeight: "900", color: colors.navy },
  costMeta: { color: colors.muted2, fontWeight: "700" },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.chipIdle,
    borderRadius: 16,
    padding: 14,
  },
  statLabel: {
    color: colors.muted2,
    fontSize: 13,
    fontWeight: "600",
  },
  statValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy,
  },
  optimize: {
    marginTop: 18,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  optimizeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    marginTop: 10,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
  },
  clearBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 8,
  },
  clearTxt: {
    color: colors.primaryTeal,
    fontWeight: "700",
    fontSize: 14,
  },
  map: {
    marginTop: 18,
    height: 180,
    borderRadius: 18,
    backgroundColor: "#E9F6F4",
    borderWidth: 1,
    borderColor: "#CFEEE9",
    position: "relative",
    overflow: "hidden",
  },
  routeLine: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: "48%",
    height: 3,
    backgroundColor: colors.primaryTeal,
    borderRadius: 999,
  },
  pin: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  empty: {
    color: colors.muted,
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
});
