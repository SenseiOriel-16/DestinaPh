import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { ScreenBackBar } from "../components/ScreenBackBar";
import { HERO_BACKGROUND } from "../constants/heroBackground";
import { colors } from "../theme/colors";
import { BrandAppIcon } from "../ui/BrandAppIcon";
import { GlassPanel } from "../ui/GlassPanel";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const padBottom = Math.max(insets.bottom, 20);
  const padTop = Math.max(insets.top, 18);

  return (
    <View style={styles.root}>
      <ImageBackground source={HERO_BACKGROUND} style={styles.bgImage} resizeMode="cover">
        <View style={styles.scrim} />
        <View style={[styles.content, { paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: 24 }]}>
          <ScreenBackBar tone="light" />
          <View style={styles.hero}>
            <GlassPanel
              style={styles.brandGlassOuter}
              contentStyle={styles.brandGlassInner}
              borderRadius={24}
            >
              <BrandAppIcon size={92} />
              <Text style={styles.brandName}>DestinaPH</Text>
              <View style={styles.taglineRow}>
                <View style={styles.taglineLine} />
                <Text style={styles.taglineText}>{"Discover Destinations Para Sa'yo."}</Text>
                <View style={styles.taglineLine} />
              </View>
            </GlassPanel>

            <Text style={styles.title}>Welcome to DestinaPH</Text>
            <Text style={styles.sub}>
              Sign in to sync bookings, or continue as a guest. You can always sign in later from Profile.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.gradPress, pressed && styles.pressed]}
              onPress={() => navigation.navigate("WelcomeAuth", { mode: "signup" })}
            >
              <LinearGradient
                colors={["#0BB8C4", "#2A7CC7"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradInner}
              >
                <Text style={styles.gradBtnText}>Create account</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.signInOuter, pressed && styles.pressed]}
              onPress={() => navigation.navigate("WelcomeAuth", { mode: "signin" })}
            >
              <LinearGradient
                colors={["#0F1F35", "#1E3A5F"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.signInGrad}
              >
                <Text style={styles.gradBtnText}>Sign in</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.later}
              onPress={() => navigation.navigate("InterestSelect", { intent: "onboarding" })}
            >
              <Text style={styles.laterText}>Do it later</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.heroLetterbox,
  },
  bgImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 48, 72, 0.4)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  hero: {
    alignItems: "center",
    paddingTop: 6,
  },
  brandGlassOuter: {
    maxWidth: 360,
    width: "100%",
  },
  brandGlassInner: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 22,
  },
  brandName: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.35,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    width: "100%",
    paddingHorizontal: 4,
  },
  taglineLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(30, 43, 78, 0.28)",
    maxHeight: 1,
  },
  taglineText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted2,
    textAlign: "center",
  },
  title: {
    marginTop: 28,
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.6,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  sub: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 340,
    fontWeight: "500",
  },
  actions: {
    gap: 14,
  },
  gradPress: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  gradInner: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  gradBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  signInOuter: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
  },
  signInGrad: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  later: {
    paddingVertical: 16,
    alignItems: "center",
  },
  laterText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.9,
  },
});
