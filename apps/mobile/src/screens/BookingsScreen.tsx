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
  businesses: {
    name: string;
    address_line: string | null;
    municipalities: { name: string } | null;
    business_photos: { storage_path: string; sort_order: number }[] | null;
  } | null;
};

type TabFilter = "upcoming" | "confirmed" | "rejected";

type BookingDetail = {
  id: string;
  status: string;
  requested_at: string;
  accommodation_name: string | null;
  check_in: string | null;
  check_out: string | null;
  guest_count: number | null;
  notes: string | null;
  owner_note: string | null;
  businesses: {
    name: string;
    address_line: string | null;
    municipalities: { name: string } | null;
  } | null;
} | null;

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

export function BookingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const reloadTimerRef = useRef<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>("upcoming");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetail>(null);

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
        "id,status,requested_at,owner_note,business_id,businesses(name,address_line,municipalities(name),business_photos(storage_path,sort_order))",
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
        "id,status,requested_at,accommodation_name,check_in,check_out,guest_count,notes,owner_note,businesses(name,address_line,municipalities(name))",
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
      void load();
    }, [load]),
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
    () => rows.filter((r) => statusForTab(tab, r.status)),
    [rows, tab],
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
        <View style={styles.modalWrap} pointerEvents="box-none">
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
                      {detail.businesses?.address_line?.trim() ||
                        detail.businesses?.municipalities?.name ||
                        "Philippines"}
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

                <View style={styles.modalGrid}>
                  <View style={styles.modalCell}>
                    <Text style={styles.modalK}>Requested</Text>
                    <Text style={styles.modalVLeft}>
                      {new Date(detail.requested_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                    </Text>
                  </View>
                  <View style={styles.modalCell}>
                    <Text style={styles.modalK}>Guests</Text>
                    <Text style={styles.modalVLeft}>{detail.guest_count ?? "—"}</Text>
                  </View>
                  <View style={styles.modalCell}>
                    <Text style={styles.modalK}>Check-in</Text>
                    <Text style={styles.modalVLeft}>{detail.check_in ?? "—"}</Text>
                  </View>
                  <View style={styles.modalCell}>
                    <Text style={styles.modalK}>Check-out</Text>
                    <Text style={styles.modalVLeft}>{detail.check_out ?? "—"}</Text>
                  </View>
                  <View style={[styles.modalCell, styles.modalCellFull]}>
                    <Text style={styles.modalK}>Room</Text>
                    <Text style={styles.modalVLeft}>{detail.accommodation_name ?? "—"}</Text>
                  </View>
                </View>

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
                <Text style={styles.modalFoot}>Booking ID: #{detail.id.slice(0, 8)}</Text>
              </View>
            ) : (
              <Text style={styles.modalMuted}>—</Text>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.titleRow}>
        <TabInlineBackButton />
        <Text style={styles.title}>My Bookings</Text>
      </View>

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

      {hint && <Text style={styles.hint}>{hint}</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 12) + 72,
          gap: 14,
          paddingTop: 8,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
        renderItem={({ item }) => {
          const b = badgeStyle(item.status);
          const when = new Date(item.requested_at);
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
                    <Text style={styles.dtLabel}>Requested</Text>
                    <Text style={styles.dtVal}>
                      {when.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                    </Text>
                  </View>
                </View>
                <View style={styles.footer}>
                  <View style={[styles.pill, { backgroundColor: b.bg }]}>
                    <Text style={[styles.pillTxt, { color: b.fg }]}>{b.label}</Text>
                  </View>
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
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "900", color: colors.navy, flex: 1, paddingRight: 10 },
  modalClose: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  modalMuted: { fontSize: 13.5, color: colors.muted, fontWeight: "700" },
  modalK: { fontSize: 12, fontWeight: "900", color: colors.muted2, letterSpacing: 0.2 },
  modalVLeft: { marginTop: 4, fontSize: 13.5, fontWeight: "800", color: colors.navy },
  modalTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalPlace: { fontSize: 16.5, fontWeight: "900", color: colors.navy },
  modalSub: { marginTop: 2, fontSize: 13, fontWeight: "700", color: colors.muted },
  modalStatusPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  modalStatusTxt: { fontSize: 12, fontWeight: "900", color: colors.muted2, textTransform: "capitalize" },
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
  modalReasonTitle: { fontSize: 12, fontWeight: "900", color: colors.danger, letterSpacing: 0.2 },
  modalReasonText: { marginTop: 6, fontSize: 13.5, fontWeight: "800", color: colors.navy, lineHeight: 18 },
  modalNotesBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.22)",
    backgroundColor: "rgba(11,184,196,0.08)",
    padding: 12,
  },
  modalNotesTitle: { fontSize: 12, fontWeight: "900", color: colors.primaryTeal, letterSpacing: 0.2 },
  modalNotesText: { marginTop: 6, fontSize: 13.5, fontWeight: "800", color: colors.navy, lineHeight: 18 },
  modalFoot: { marginTop: 4, fontSize: 12, color: colors.muted, fontWeight: "800" },
});
