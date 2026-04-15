import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { ScreenBackBar } from "../components/ScreenBackBar";
import { HERO_BACKGROUND } from "../constants/heroBackground";
import { TRAVEL_CATEGORIES } from "../data/travelCategories";
import { getInterestSlugs, markOnboardingComplete, saveInterestSlugs } from "../lib/onboardingStorage";
import { colors } from "../theme/colors";
import { BrandAppIcon } from "../ui/BrandAppIcon";
import { GlassPanel } from "../ui/GlassPanel";

type Props = NativeStackScreenProps<RootStackParamList, "InterestSelect">;

type CardTheme = {
  border: string;
  label: string;
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CARD_THEMES: readonly CardTheme[] = [
  { border: "#2E7D32", label: "#1B5E20", iconBg: "#2E7D32", icon: "leaf-outline" },
  { border: "#1565C0", label: "#0D47A1", iconBg: "#0B7A9E", icon: "umbrella-outline" },
  { border: "#6D4C41", label: "#4E342E", iconBg: "#8D6E63", icon: "restaurant-outline" },
];

export function InterestSelectScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const intent = route.params?.intent ?? "onboarding";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const cardWidth = useMemo(() => {
    const horizontal = 32;
    const gapEach = 10;
    const gapsTotal = gapEach * 2;
    const inner = windowWidth - horizontal;
    const per = Math.floor((inner - gapsTotal) / 3);
    return Math.min(220, Math.max(96, per));
  }, [windowWidth]);

  useEffect(() => {
    void (async () => {
      const existing = await getInterestSlugs();
      if (existing.length) setSelected(new Set(existing));
    })();
  }, []);

  const toggle = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const onContinue = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await saveInterestSlugs([...selected]);
      if (intent === "onboarding") {
        await markOnboardingComplete();
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
      } else {
        navigation.goBack();
      }
    } finally {
      setBusy(false);
    }
  };

  /** Skip picking: default to all categories so Home recommendations still work. */
  const onDoItLater = async () => {
    setBusy(true);
    try {
      if (intent === "edit") {
        navigation.goBack();
        return;
      }
      await saveInterestSlugs(TRAVEL_CATEGORIES.map((c) => c.slug));
      await markOnboardingComplete();
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } finally {
      setBusy(false);
    }
  };

  const footerInset = Math.max(insets.bottom, 14);
  const scrollBottomPad = footerInset + 100;

  return (
    <View style={styles.root}>
      <ImageBackground source={HERO_BACKGROUND} style={styles.bgImage} resizeMode="cover">
        <View style={styles.scrim} />
        <View style={[styles.inner, { paddingTop: Math.max(insets.top, 12) }]}>
          <ScreenBackBar tone="light" />
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
            showsVerticalScrollIndicator={false}
          >
            <GlassPanel
              style={styles.brandGlassOuter}
              contentStyle={styles.brandGlassInner}
              borderRadius={24}
              intensity={56}
            >
              <BrandAppIcon size={88} />
              <Text style={styles.brandName}>DestinaPH</Text>
              <View style={styles.taglineRow}>
                <View style={styles.taglineLine} />
                <Text style={styles.tagline}>{"Discover Destinations Para Sa'yo."}</Text>
                <View style={styles.taglineLine} />
              </View>
            </GlassPanel>

            <Text style={styles.title}>Select your interests</Text>

            <View style={[styles.categoryRow, { gap: 10 }]}>
              {TRAVEL_CATEGORIES.map((c, index) => {
                const on = selected.has(c.slug);
                const theme = CARD_THEMES[index] ?? CARD_THEMES[0];
                return (
                  <Pressable
                    key={c.slug}
                    accessibilityLabel={c.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => toggle(c.slug)}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        width: cardWidth,
                        borderColor: on ? theme.border : "rgba(255,255,255,0.85)",
                        borderWidth: on ? 3 : 2,
                      },
                      pressed && { opacity: 0.94 },
                    ]}
                  >
                    <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cardVeil]} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <View style={[styles.iconSquare, { backgroundColor: theme.iconBg }]}>
                          <Ionicons name={theme.icon} color="#fff" size={22} />
                        </View>
                        {on ? (
                          <View style={[styles.checkBadgeInline, { backgroundColor: theme.iconBg }]} pointerEvents="none">
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          </View>
                        ) : (
                          <View style={styles.checkBadgeInlinePlaceholder} pointerEvents="none" />
                        )}
                      </View>
                      <Text style={[styles.cardLabel, { color: on ? "#fff" : "rgba(255,255,255,0.92)" }]} numberOfLines={3}>
                        {c.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {selected.size === 0 ? (
              <Text style={styles.hint}>Pumili ng kahit isa para magpatuloy.</Text>
            ) : null}
          </ScrollView>

          <View style={[styles.footerBar, { paddingBottom: footerInset }]}>
            <GlassPanel style={styles.footerGlassOuter} contentStyle={styles.footerGlassInner} borderRadius={20}>
              {intent === "onboarding" ? (
                <Pressable
                  style={({ pressed }) => [styles.footerSecondary, pressed && styles.footerPressed]}
                  onPress={() => void onDoItLater()}
                  disabled={busy}
                >
                  <Text style={styles.footerSecondaryText}>Do it later</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.footerSecondary, pressed && styles.footerPressed]}
                  onPress={() => navigation.goBack()}
                  disabled={busy}
                >
                  <Text style={styles.footerSecondaryText}>Cancel</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.footerPrimary,
                  (selected.size === 0 || busy) && styles.footerPrimaryDisabled,
                  pressed && selected.size > 0 && !busy && { opacity: 0.92 },
                ]}
                disabled={selected.size === 0 || busy}
                onPress={() => void onContinue()}
              >
                <Text style={styles.footerPrimaryText}>{busy ? "Saving…" : "Continue"}</Text>
              </Pressable>
            </GlassPanel>
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
    backgroundColor: "rgba(18, 48, 72, 0.35)",
  },
  inner: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  brandGlassOuter: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
    marginBottom: 18,
  },
  brandGlassInner: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  brandName: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.4,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    width: "100%",
    paddingHorizontal: 4,
  },
  taglineLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(30, 43, 78, 0.22)",
    maxHeight: 1,
  },
  tagline: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted2,
    textAlign: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 22,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "stretch",
    alignSelf: "center",
    width: "100%",
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardVeil: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  cardBody: {
    minHeight: 128,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeInline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
  },
  checkBadgeInlinePlaceholder: {
    width: 28,
    height: 28,
  },
  cardLabel: {
    width: "100%",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  hint: {
    marginTop: 18,
    textAlign: "center",
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  footerGlassOuter: {
    width: "100%",
  },
  footerGlassInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  footerSecondary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
  },
  footerSecondaryText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.muted2,
  },
  footerPrimary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTeal,
  },
  footerPrimaryDisabled: {
    opacity: 0.42,
  },
  footerPrimaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  footerPressed: {
    opacity: 0.88,
  },
});
