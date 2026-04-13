import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { formatBusinessAddress, firstPhotoPublicUrl } from "../lib/businessDisplay";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

type PhotoRow = { storage_path: string; sort_order?: number | null };

type BusinessEmbed = {
  id: string;
  name: string;
  status: string;
  short_description: string | null;
  address_line: string | null;
  municipalities: { name: string } | null;
  provinces: { name: string } | null;
  barangays: { name: string } | null;
  business_photos: PhotoRow[] | null;
};

type FavoriteListRow = {
  id: string;
  created_at: string;
  businesses: BusinessEmbed | BusinessEmbed[] | null;
};

function asBusiness(v: FavoriteListRow["businesses"]): BusinessEmbed | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function FavoritesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<FavoriteListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    setSignedIn(Boolean(uid));
    if (!uid) {
      setRows([]);
      return;
    }
    const { data, error } = await supabase
      .from("user_favorites")
      .select(
        `
        id,
        created_at,
        businesses (
          id,
          name,
          status,
          short_description,
          address_line,
          municipalities (name),
          provinces (name),
          barangays (name),
          business_photos (storage_path, sort_order)
        )
      `,
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[DestinaPH] favorites load:", error.message);
      setRows([]);
      return;
    }
    const list = ((data ?? []) as unknown as FavoriteListRow[]).filter((r) => asBusiness(r.businesses) != null);
    setRows(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void (async () => {
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const removeFavoriteConfirm = async (favId: string) => {
    const { error } = await supabase.from("user_favorites").delete().eq("id", favId);
    if (error) {
      Alert.alert("Favorites", error.message);
      return;
    }
    setRows((r) => r.filter((x) => x.id !== favId));
  };

  const removeFavorite = (favId: string, name: string) => {
    Alert.alert("Remove favorite", `Remove “${name}” from your favorites?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void removeFavoriteConfirm(favId),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centerPage, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primaryTeal} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="heart-outline" size={48} color={colors.primaryTeal} />
        </View>
        <Text style={styles.title}>My Favorites</Text>
        <Text style={styles.sub}>Sign in to save places you love and see them here on any device.</Text>
        <Pressable style={styles.btn} onPress={() => navigation.navigate("Main", { screen: "Profile" })}>
          <Text style={styles.btnTxt}>Go to Profile</Text>
        </Pressable>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="heart-outline" size={48} color={colors.primaryTeal} />
        </View>
        <Text style={styles.title}>No favorites yet</Text>
        <Text style={styles.sub}>
          Open a destination and tap the heart on the photo to add it here. Only approved listings can be saved.
        </Text>
        <Pressable style={styles.btn} onPress={() => navigation.navigate("Main", { screen: "Explore" })}>
          <Text style={styles.btnTxt}>Browse Explore</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.listPage, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const b = asBusiness(item.businesses)!;
          const thumb = firstPhotoPublicUrl(b.business_photos);
          const subtitle =
            b.status !== "approved"
              ? "No longer listed"
              : b.short_description?.trim() || formatBusinessAddress(b);
          return (
            <Pressable
              style={styles.card}
              onPress={() => {
                if (b.status === "approved")
                  navigation.navigate("Main", {
                    screen: "Home",
                    params: { screen: "Detail", params: { id: b.id } },
                  });
                else Alert.alert("DestinaPH", "This listing is no longer available.");
              }}
            >
              <View style={styles.thumbWrap}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPh]}>
                    <Ionicons name="image-outline" size={28} color={colors.muted2} />
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {b.name}
                </Text>
                <Text style={styles.cardSub} numberOfLines={2}>
                  {subtitle}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => removeFavorite(item.id, b.name)}
                style={styles.trashBtn}
                accessibilityLabel="Remove from favorites"
              >
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerPage: {
    flex: 1,
    backgroundColor: colors.pageBg,
    alignItems: "center",
    justifyContent: "center",
  },
  listPage: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    textAlign: "center",
  },
  sub: {
    marginTop: 12,
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  btn: {
    marginTop: 28,
    alignSelf: "center",
    backgroundColor: colors.primaryTeal,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  btnTxt: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  thumbWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  thumb: {
    width: 72,
    height: 72,
    backgroundColor: colors.chipIdle,
  },
  thumbPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
  cardSub: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  trashBtn: {
    padding: 6,
  },
});
