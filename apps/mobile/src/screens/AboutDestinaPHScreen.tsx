import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { BrandAppIcon } from "../ui/BrandAppIcon";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "AboutDestinaPH">;

export function AboutDestinaPHScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingTop: 20, alignItems: "center" }}
    >
      <BrandAppIcon size={88} />
      <Text style={styles.title}>DestinaPH</Text>
      <Text style={styles.tag}>Discover Destinations. Plan Smarter.</Text>
      <Text style={styles.version}>Version {version}</Text>

      <View style={styles.card}>
        <Text style={styles.p}>
          DestinaPH helps travelers explore Camarines Sur and beyond—find places, build smarter day routes, and request
          bookings where businesses support it.
        </Text>
        <Text style={[styles.p, styles.pSp]}>
          This app is part of a capstone-style project: consumer mobile experience, owner web tools, and admin
          moderation—connected through a shared backend.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  title: {
    marginTop: 16,
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
  },
  tag: {
    marginTop: 6,
    fontSize: 14,
    color: colors.primaryTeal,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  version: {
    marginTop: 8,
    fontSize: 13,
    color: colors.muted,
  },
  card: {
    marginTop: 24,
    marginHorizontal: 20,
    alignSelf: "stretch",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  p: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  pSp: {
    marginTop: 12,
  },
});
