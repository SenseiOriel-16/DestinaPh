import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";

export const navyStackHeader: NativeStackNavigationOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
  headerBackTitleVisible: false,
};
