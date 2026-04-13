import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Reviews">;

export function ReviewsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="star-outline" size={48} color={colors.star} />
      </View>
      <Text style={styles.title}>My Reviews</Text>
      <Text style={styles.sub}>
        After you visit a place, leaving a rating and short review helps other travelers. Star ratings and written
        feedback will show here once the review feature is connected to your account.
      </Text>
      <Text style={styles.note}>
        Tip: use bookings and itinerary to track where you have been—when reviews launch, we can prompt you for those
        spots first.
      </Text>
      <Pressable style={styles.btn} onPress={() => navigation.navigate("Main", { screen: "Bookings" })}>
        <Text style={styles.btnTxt}>Open My Bookings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  note: {
    marginTop: 16,
    fontSize: 13,
    color: colors.muted2,
    textAlign: "center",
    lineHeight: 19,
  },
  btn: {
    marginTop: 28,
    alignSelf: "center",
    backgroundColor: colors.navy,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  btnTxt: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
});
