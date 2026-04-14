import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "../../App";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToBookingsMain() {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("Main", { screen: "Bookings", params: { screen: "BookingsMain" } });
}

