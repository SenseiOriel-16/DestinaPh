import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  DeviceEventEmitter,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import type { BookingsStackParamList, TabParamList } from "../navigation/tabTypes";
import { TabInlineBackButton } from "../components/ScreenBackBar";
import { firstPhotoPublicUrl } from "../lib/businessDisplay";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { shadowCompat } from "../lib/rnWebStyleCompat";
import { BOOKING_NOTIFICATION_EVENT, BOOKING_OPEN_DETAIL_EVENT } from "../lib/bookingNotificationEvents";

type Props = CompositeScreenProps<
  NativeStackScreenProps<BookingsStackParamList, "BookingsMain">,
  CompositeScreenProps<BottomTabScreenProps<TabParamList, "Bookings">, NativeStackScreenProps<RootStackParamList>>
>;

type Row = {
  id: string;
  status: string;
  requested_at: string;
  business_id: string;
  owner_note: string | null;
  check_in: string | null;
  arrival_time: string | null;
  payment_method: string | null;
  payment_proof_storage_path: string | null;
  businesses: {
    name: string;
    address_line: string | null;
    municipalities: { name: string } | null;
    barangays: { name: string } | null;
    provinces: { name: string } | null;
    business_photos: { storage_path: string; sort_order: number }[] | null;
    categories: { slug: string; name: string } | null;
  } | null;
};

type TabFilter = "upcoming" | "confirmed" | "rejected";
type CategoryFilter = "all" | "food-dining" | "resorts-leisure" | "nature-adventure";

type BookingDetail = {
  id: string;
  status: string;
  requested_at: string;
  accommodation_name: string | null;
  check_in: string | null;
  check_out: string | null;
  arrival_time: string | null;
  guest_count: number | null;
  notes: string | null;
  owner_note: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_proof_storage_path: string | null;
  businesses: {
    name: string;
    address_line: string | null;
    municipalities: { name: string } | null;
    barangays: { name: string } | null;
    provinces: { name: string } | null;
    categories: { slug: string; name: string } | null;
  } | null;
} | null;

function formatTime12(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "—";
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!m) return raw;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return raw;
  const h12 = ((hh + 11) % 12) + 1;
  const ap = hh >= 12 ? "PM" : "AM";
  if (mm === 0) return `${h12} ${ap}`;
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
}

function formatRequestedParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "—" };
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const hrs = d.getHours();
  const mins = d.getMinutes();
  const h12 = ((hrs + 11) % 12) + 1;
  const ap = hrs >= 12 ? "PM" : "AM";
  const time = mins === 0 ? `${h12} ${ap}` : `${h12}:${String(mins).padStart(2, "0")} ${ap}`;
  return { date, time };
}

function statusForTab(tab: TabFilter, status: string): boolean {
  if (tab === "upcoming") return status === "requested" || status === "pending_review";
  if (tab === "confirmed") return status === "confirmed";
  return status === "cancelled";
}

function badgeStyle(status: string) {
  if (status === "confirmed") return { bg: colors.successBg, fg: colors.successText, label: "Confirmed" };
  if (status === "cancelled") return { bg: colors.border, fg: colors.muted2, label: "Rejected" };
  if (status === "pending_review")
    return { bg: colors.warningBg, fg: colors.warningText, label: "Awaiting host" };
  return { bg: colors.warningBg, fg: colors.warningText, label: "Pending" };
}

function modalStatusStyle(status: string) {
  if (status === "confirmed")
    return { bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.28)", fg: "#166534", label: "Confirmed" };
  if (status === "cancelled")
    return { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.28)", fg: "#991b1b", label: "Cancelled" };
  if (status === "pending_review")
    return { bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.28)", fg: "#92400e", label: "Awaiting host" };
  if (status === "requested")
    return { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", fg: "#92400e", label: "Pending" };
  return { bg: "rgba(148,163,184,0.22)", border: "rgba(148,163,184,0.25)", fg: colors.muted2, label: status };
}

export function BookingsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const reloadTimerRef = useRef<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>("upcoming");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetail>(null);

  const categoryChips: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "food-dining", label: "Food" },
    { id: "resorts-leisure", label: "Resort" },
    { id: "nature-adventure", label: "Nature" },
  ];

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      setRows([]);
      setHint("Sign in from the Profile tab to see your bookings.");
      return;
    }
    setHint(null);
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,status,requested_at,owner_note,business_id,check_in,arrival_time,payment_method,payment_proof_storage_path,businesses(name,municipalities(name),barangays(name),provinces(name),categories(slug,name),business_photos(storage_path,sort_order))",
      )
      .eq("user_id", uid)
      .order("requested_at", { ascending: false });
    if (error) {
      setHint(error.message);
      return;
    }
    setRows((data as unknown as Row[]) ?? []);
  }, []);

  const openBookingDetails = useCallback(async (bookingId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailErr(null);
    setDetail(null);
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      setDetailErr("Please sign in to view booking details.");
      setDetailLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,status,requested_at,accommodation_name,check_in,check_out,arrival_time,guest_count,notes,owner_note,payment_method,payment_reference,payment_proof_storage_path,businesses(name,municipalities(name),barangays(name),provinces(name),categories(slug,name))",
      )
      .eq("id", bookingId)
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !data) {
      setDetailErr(error?.message ?? "Could not load booking details.");
      setDetailLoading(false);
      return;
    }
    setDetail(data as unknown as NonNullable<BookingDetail>);
    setDetailLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const initial = (route.params as any)?.initialTab as TabFilter | undefined;
      if (initial) setTab(initial);
      // Avoid re-applying when navigating back to this screen.
      if (initial) {
        navigation.setParams({ initialTab: undefined } as any);
      }
      void load();
    }, [load, navigation, route.params]),
  );

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleLoad = () => {
      if (!active) return;
      if (reloadTimerRef.current != null) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => void load(), 220) as unknown as number;
    };

    const setupRealtime = async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid || !active) return;

      const filter = `user_id=eq.${uid}`;
      channel = supabase
        .channel(`destinaph-mobile-bookings-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings", filter }, scheduleLoad)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter }, scheduleLoad)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "bookings", filter }, scheduleLoad)
        .subscribe();
    };

    void setupRealtime();

    return () => {
      active = false;
      if (reloadTimerRef.current != null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!statusForTab(tab, r.status)) return false;
        if (categoryFilter === "all") return true;
        return (r.businesses?.categories?.slug ?? "") === categoryFilter;
      }),
    [rows, tab, categoryFilter],
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(BOOKING_OPEN_DETAIL_EVENT, (payload: { bookingId?: string }) => {
      const bid = (payload?.bookingId ?? "").trim();
      if (!bid) return;
      setTab("upcoming");
      void openBookingDetails(bid);
    });
    return () => sub.remove();
  }, [openBookingDetails]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(BOOKING_NOTIFICATION_EVENT, () => {
      void load();
    });
    return () => sub.remove();
  }, [load]);

  return (
    <View style={[styles.page, { paddingTop: Math.max(insets.top, 10) }]}>
      <Modal
        visible={detailOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDetailOpen(false)} />
        <View style={[styles.modalWrap, { pointerEvents: "box-none" as any }]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Reservation details
              </Text>
              <Pressable style={styles.modalClose} onPress={() => setDetailOpen(false)} accessibilityRole="button">
                <Ionicons name="close" size={22} color={colors.navy} />
              </Pressable>
            </View>
            {detailLoading ? (
              <Text style={styles.modalMuted}>Loading…</Text>
            ) : detailErr ? (
              <Text style={[styles.modalMuted, { color: colors.danger }]}>{detailErr}</Text>
            ) : detail ? (
              <View style={{ gap: 12 }}>
                <View style={styles.modalTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalPlace} numberOfLines={1}>
                      {detail.businesses?.name ?? "—"}
                    </Text>
                    <Text style={styles.modalSub} numberOfLines={1}>
                      {(() => {
                        const brgy = detail.businesses?.barangays?.name?.trim() ?? "";
                        const muni = detail.businesses?.municipalities?.name?.trim() ?? "";
                        const prov = detail.businesses?.provinces?.name?.trim() ?? "";
                        const parts = [brgy, muni, prov].filter(Boolean);
                        return parts.length ? parts.join(", ") : "Philippines";
                      })()}
                    </Text>
                  </View>
                  {(() => {
                    const s = modalStatusStyle(detail.status);
                    return (
                      <View
                        style={[
                          styles.modalStatusPill,
                          { backgroundColor: s.bg, borderColor: s.border },
                        ]}
                      >
                        <Text style={[styles.modalStatusTxt, { color: s.fg }]}>{s.label}</Text>
                      </View>
                    );
                  })()}
                </View>

                {(() => {
                  const cat = (detail.businesses?.categories?.slug ?? "").trim();
                  const isFood = cat === "food-dining";
                  const req = formatRequestedParts(detail.requested_at);
                  const visitDate = (detail.check_in ?? "").trim() || "—";
                  const visitTime = formatTime12(detail.arrival_time);
                  const pay = (detail.payment_method ?? "—").toString().toUpperCase();
                  const ref = (detail.payment_reference ?? "").trim();
                  const hasProof = Boolean((detail.payment_proof_storage_path ?? "").trim());

                  return (
                    <View style={styles.modalGrid}>
                      <View style={styles.modalCell}>
                        <View style={styles.modalKRow}>
                          <Ionicons name="time-outline" size={14} color={colors.primaryTealDeep} />
                          <Text style={styles.modalK}>Requested</Text>
                        </View>
                        <Text style={styles.modalVLeft}>{req.date}</Text>
                        <Text style={styles.modalVSub}>{req.time}</Text>
                      </View>
                      <View style={styles.modalCell}>
                        <View style={styles.modalKRow}>
                          <Ionicons name="people-outline" size={14} color={colors.primaryTealDeep} />
                          <Text style={styles.modalK}>Guests</Text>
                        </View>
                        <Text style={styles.modalVLeft}>{detail.guest_count ?? "—"}</Text>
                      </View>
                      <View style={styles.modalCell}>
                        <View style={styles.modalKRow}>
                          <Ionicons name="calendar-outline" size={14} color={colors.accentGreen} />
                          <Text style={styles.modalK}>Visit date</Text>
                        </View>
                        <Text style={styles.modalVLeft}>{visitDate}</Text>
                      </View>
                      <View style={styles.modalCell}>
                        <View style={styles.modalKRow}>
                          <Ionicons name="time-outline" size={14} color={colors.accentOrange} />
                          <Text style={styles.modalK}>Visit time</Text>
                        </View>
                        <Text style={styles.modalVLeft}>{visitTime}</Text>
                      </View>
                      {!isFood ? (
                        <View style={[styles.modalCell, styles.modalCellFull]}>
                          <View style={styles.modalKRow}>
                            <Ionicons name="bed-outline" size={14} color={colors.navy} />
                            <Text style={styles.modalK}>Room</Text>
                          </View>
                          <Text style={styles.modalVLeft}>{detail.accommodation_name ?? "—"}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.modalCell, styles.modalCellFull]}>
                        <View style={styles.modalKRow}>
                          <Ionicons name="card-outline" size={14} color={colors.navy} />
                          <Text style={styles.modalK}>Payment</Text>
                        </View>
                        <Text style={styles.modalVLeft}>
                          {pay}
                          {ref ? ` · ${ref}` : ""}
                          {hasProof ? " · Proof attached" : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {detail.status === "cancelled" ? (
                  <View style={styles.modalReasonBox}>
                    <Text style={styles.modalReasonTitle}>Reason</Text>
                    <Text style={styles.modalReasonText}>
                      {detail.owner_note?.trim() ? detail.owner_note.trim() : "No reason was provided."}
                    </Text>
                  </View>
                ) : null}
                {detail.notes?.trim() ? (
                  <View style={styles.modalNotesBox}>
                    <Text style={styles.modalNotesTitle}>Your notes</Text>
                    <Text style={styles.modalNotesText}>{detail.notes.trim()}</Text>
                  </View>
                ) : null}
                <View style={styles.modalFootRow}>
                  <Ionicons name="key-outline" size={14} color={colors.muted2} />
                  <Text style={styles.modalFoot}>Booking ID: #{detail.id.slice(0, 8)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.modalMuted}>—</Text>
            )}
          </View>
        </View>
      </Modal>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <View style={styles.headerTop}>
                <TabInlineBackButton />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>My Bookings</Text>
                <Text style={styles.headerSub}>View and manage your confirmed bookings.</Text>
              </View>
            </View>

            <View style={styles.sheet}>
              <View style={styles.tabs}>
                {(
                  [
                    ["upcoming", "Upcoming"],
                    ["confirmed", "Confirmed"],
                    ["rejected", "Rejected"],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable key={key} style={styles.tabCell} onPress={() => setTab(key)}>
                    <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{label}</Text>
                    {tab === key && <View style={styles.tabUnderline} />}
                  </Pressable>
                ))}
              </View>

              <View style={styles.categoryTabs}>
                {categoryChips.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategoryFilter(c.id)}
                    style={[styles.categoryTab, categoryFilter === c.id && styles.categoryTabOn]}
                  >
                    <Text style={[styles.categoryTabTxt, categoryFilter === c.id && styles.categoryTabTxtOn]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
          </View>
        }
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 12) + 72,
          gap: 14,
          paddingTop: 10,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
        renderItem={({ item }) => {
          const b = badgeStyle(item.status);
          const when = new Date(item.requested_at);
          const visitDate = (item.check_in ?? "").trim();
          const visitTime = (item.arrival_time ?? "").trim();
          const loc =
            item.businesses?.address_line?.trim() ||
            item.businesses?.municipalities?.name ||
            "Philippines";
          const thumbUrl = firstPhotoPublicUrl(item.businesses?.business_photos);
          return (
            <Pressable
              style={styles.card}
              onPress={() => {
                if (item.status === "cancelled" || item.status === "confirmed") {
                  void openBookingDetails(item.id);
                  return;
                }
                navigation.navigate("Detail", { id: item.business_id });
              }}
            >
              {thumbUrl ? (
                <Image source={{ uri: thumbUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="image-outline" size={26} color={colors.muted2} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.place}>{item.businesses?.name ?? "Business"}</Text>
                <Text style={styles.loc}>{loc}</Text>
                <View style={styles.dateRow}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateMon}>{when.toLocaleString("en-PH", { month: "short" }).toUpperCase()}</Text>
                    <Text style={styles.dateDay}>{when.getDate()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dtLabel}>Visit</Text>
                    <Text style={styles.dtVal}>
                      {visitDate ? `${visitDate}${visitTime ? ` · ${visitTime}` : ""}` : "—"}
                    </Text>
                    <Text style={[styles.dtLabel, { marginTop: 6 }]}>Requested</Text>
                    <Text style={styles.dtVal}>
                      {when.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                    </Text>
                  </View>
                </View>
                <View style={styles.footer}>
                  <View style={[styles.pill, { backgroundColor: b.bg }]}>
                    <Text style={[styles.pillTxt, { color: b.fg }]}>{b.label}</Text>
                  </View>
                  <Text style={styles.paymentPill} numberOfLines={1}>
                    {(item.payment_method ?? "—").toString().toUpperCase()}
                    {item.payment_proof_storage_path ? " · Proof" : ""}
                  </Text>
                  {item.status === "cancelled" && item.owner_note?.trim() ? (
                    <Text style={styles.reason} numberOfLines={1}>
                      {item.owner_note.trim()}
                    </Text>
                  ) : null}
                  <Text style={styles.bid}>Booking ID: #{item.id.slice(0, 8)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !hint ? (
            <Text style={styles.empty}>
              No bookings in this tab.
            </Text>
          ) : null
        }
      />
    </View>
  );
}


const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 20,
  },
  header: {
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerText: {
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.navy,
    letterSpacing: -0.2,
  },
  headerSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  sheet: {
    marginTop: -28,
    backgroundColor: colors.pageBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  tabCell: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
  },
  tabTxt: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted2,
  },
  tabTxtOn: {
    color: colors.primaryTeal,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    height: 3,
    width: "60%",
    borderRadius: 2,
    backgroundColor: colors.primaryTeal,
  },
  categoryTabs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  categoryTabOn: {
    backgroundColor: "rgba(4,120,126,0.10)",
    borderColor: "rgba(4,120,126,0.22)",
  },
  categoryTabTxt: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.muted2,
  },
  categoryTabTxtOn: {
    color: colors.primaryTealDeep,
  },
  hint: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowCompat({ opacity: 0.06, radius: 10, offsetY: 4, elevation: 2 }),
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  thumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  place: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy,
  },
  loc: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  dateBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.chipIdle,
    alignItems: "center",
    justifyContent: "center",
  },
  dateMon: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted2,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy,
  },
  dtLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
  },
  dtVal: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  paymentPill: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    maxWidth: 120,
  },
  reason: { flex: 1, fontSize: 12.5, fontWeight: "700", color: colors.muted2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: "700",
  },
  bid: {
    flex: 1,
    fontSize: 11,
    color: colors.muted,
  },
  empty: {
    textAlign: "center",
    color: colors.muted,
    marginTop: 36,
    fontSize: 14,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadowCompat({ opacity: 0.12, radius: 18, offsetY: 10, elevation: 6 }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: colors.navy, flex: 1, paddingRight: 10 },
  modalClose: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  modalMuted: { fontSize: 13.5, color: colors.muted, fontWeight: "600" },
  modalKRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  // Labels bold + black; values soft (not bold)
  modalK: { fontSize: 12, fontWeight: "800", color: colors.navy, letterSpacing: 0.2 },
  modalVLeft: { marginTop: 4, fontSize: 13.5, fontWeight: "500", color: colors.text },
  modalVSub: { marginTop: 2, fontSize: 13, fontWeight: "500", color: colors.muted2 },
  modalTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalPlace: { fontSize: 16.5, fontWeight: "700", color: colors.primaryTealDeep },
  modalSub: { marginTop: 2, fontSize: 13, fontWeight: "500", color: colors.muted },
  modalStatusPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  modalStatusTxt: { fontSize: 12, fontWeight: "800", color: colors.muted2, textTransform: "capitalize" },
  modalGrid: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: "rgba(248, 250, 252, 1)",
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  modalCell: { width: "47%" },
  modalCellFull: { width: "100%" },
  modalReasonBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(220, 53, 69, 0.22)",
    backgroundColor: "rgba(220, 53, 69, 0.08)",
    padding: 12,
  },
  modalReasonTitle: { fontSize: 12, fontWeight: "800", color: colors.danger, letterSpacing: 0.2 },
  modalReasonText: { marginTop: 6, fontSize: 13.5, fontWeight: "700", color: colors.navy, lineHeight: 18 },
  modalNotesBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.22)",
    backgroundColor: "rgba(11,184,196,0.08)",
    padding: 12,
  },
  modalNotesTitle: { fontSize: 12, fontWeight: "800", color: colors.primaryTeal, letterSpacing: 0.2 },
  modalNotesText: { marginTop: 6, fontSize: 13.5, fontWeight: "700", color: colors.navy, lineHeight: 18 },
  modalFootRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  modalFoot: { fontSize: 12, color: colors.muted, fontWeight: "700" },
});
