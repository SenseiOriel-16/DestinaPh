import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

async function currentCoordsString(): Promise<string | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return `${pos.coords.latitude},${pos.coords.longitude}`;
  } catch {
    return null;
  }
}

/** Opens the platform turn-by-turn app: Apple Maps (iOS) or Google Navigation (Android) when available. */
export async function openTurnByTurnNavigation(destLat: number, destLng: number): Promise<void> {
  const from = await currentCoordsString();
  const daddr = `${destLat},${destLng}`;

  if (Platform.OS === "ios") {
    const u = from
      ? `http://maps.apple.com/?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(daddr)}&dirflg=d`
      : `http://maps.apple.com/?daddr=${encodeURIComponent(daddr)}&dirflg=d`;
    await Linking.openURL(u);
    return;
  }

  const navUri = `google.navigation:q=${destLat},${destLng}&mode=d`;
  try {
    if (await Linking.canOpenURL(navUri)) {
      await Linking.openURL(navUri);
      return;
    }
  } catch {
    /* continue to https */
  }

  const fallback = from
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(daddr)}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(daddr)}&travelmode=driving`;
  await Linking.openURL(fallback);
}

/** Opens Google Maps (app or browser) with driving directions from the user to the destination when possible. */
export async function openGoogleMapsDirections(destLat: number, destLng: number): Promise<void> {
  const from = await currentCoordsString();
  const dest = `${destLat},${destLng}`;
  const u = from
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(dest)}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
  await Linking.openURL(u);
}
