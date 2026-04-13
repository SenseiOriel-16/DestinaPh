import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import type { BookingsStackParamList, TabParamList } from "../navigation/tabTypes";
import { TabInlineBackButton } from "../components/ScreenBackBar";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";

type Props = CompositeScreenProps<
  NativeStackScreenProps<BookingsStackParamList, "BookingsMain">,
  CompositeScreenProps<BottomTabScreenProps<TabParamList, "Bookings">, NativeStackScreenProps<RootStackParamList>>
>;

type Row = {
  id: string;
  status: string;
  requested_at: string;
  business_id: string;
  businesses: {
    name: string;
    address_line: string | null;
    municipalities: { name: string } | null;
  } | null;
};

type TabFilter = "upcoming" | "completed" | "cancelled";

const PLACE_IMG =
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=400&q=60";

function statusForTab(tab: TabFilter, status: string): boolean {
  if (tab === "upcoming")
    return status === "requested" || status === "pending_review" || status === "confirmed";
  if (tab === "completed") return false;
  return status === "cancelled";
}

function badgeStyle(status: string) {
  if (status === "confirmed") return { bg: colors.successBg, fg: colors.successText, label: "Confirmed" };
  if (status === "cancelled") return { bg: colors.border, fg: colors.muted2, label: "Cancelled" };
  if (status === "pending_review")
    return { bg: colors.warningBg, fg: colors.warningText, label: "Awaiting host" };
  return { bg: colors.warningBg, fg: colors.warningText, label: "Pending" };
}

export function BookingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>("upcoming");

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
        "id,status,requested_at,business_id,businesses(name,address_line,municipalities(name))",
      )
      .eq("user_id", uid)
      .order("requested_at", { ascending: false });
    if (error) {
      setHint(error.message);
      return;
    }
    setRows((data as unknown as Row[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(
    () => rows.filter((r) => statusForTab(tab, r.status)),
    [rows, tab],
  );

  return (
    <View style={[styles.page, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.titleRow}>
        <TabInlineBackButton />
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ["upcoming", "Upcoming"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
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
        contentContainerStyle={{ paddingBottom: 120, gap: 14, paddingTop: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
        renderItem={({ item }) => {
          const b = badgeStyle(item.status);
          const when = new Date(item.requested_at);
          const loc =
            item.businesses?.address_line?.trim() ||
            item.businesses?.municipalities?.name ||
            "Philippines";
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("Detail", { id: item.business_id })}
            >
              <Image source={{ uri: PLACE_IMG }} style={styles.thumb} />
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
              {tab === "completed"
                ? "No completed bookings yet (travel dates will be added in a future schema update)."
                : "No bookings in this tab."}
            </Text>
          ) : null
        }
      />

      <Pressable style={styles.cta} onPress={() => navigation.navigate("Explore")}>
        <Text style={styles.ctaTxt}>View All Bookings</Text>
      </Pressable>
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
  cta: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  ctaTxt: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
