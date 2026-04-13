import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../../App";
import { isOnboardingComplete } from "../lib/onboardingStorage";
import { BrandAppIcon } from "../ui/BrandAppIcon";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

const MIN_SPLASH_MS = 1400;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    let cancelled = false;
    const t0 = Date.now();
    void (async () => {
      const [done] = await Promise.all([isOnboardingComplete(), new Promise((r) => setTimeout(r, MIN_SPLASH_MS))]);
      if (cancelled) return;
      const wait = MIN_SPLASH_MS - (Date.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;
      if (done) navigation.replace("Main");
      else navigation.replace("Welcome");
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return (
    <View style={styles.root}>
      <BrandAppIcon size={120} />
      <Text style={styles.title}>DestinaPH</Text>
      <Text style={styles.tagline}>Discover Destinations. Plan Smarter.</Text>
      <ActivityIndicator style={styles.spinner} size="large" color="rgba(255,255,255,0.9)" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B3C5D",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    marginTop: 16,
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "System",
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  spinner: {
    marginTop: 28,
  },
});
