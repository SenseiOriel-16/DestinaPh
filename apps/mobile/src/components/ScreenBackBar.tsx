import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

type Props = {
  /** Icon color on dark hero screens */
  tone?: "light" | "dark";
};

/** Stack screens only (Welcome, InterestSelect, …). Tab screens use `TabInlineBackButton` in their header row. */
export function ScreenBackBar({ tone = "light" }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const iconColor = tone === "light" ? "#fff" : colors.navy;

  if (!navigation.canGoBack()) return null;
  return (
    <View style={[styles.stackRow, { paddingTop: Math.max(insets.top, 8) }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.stackHit, pressed && { opacity: 0.85 }]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={28} color={iconColor} />
      </Pressable>
    </View>
  );
}

export function useTabBackAction(): { visible: boolean; onPress: () => void } {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const routeName = route.name;
  const atHomeTabRoot = routeName === "Home" || routeName === "HomeMain";
  const canPopStack = navigation.canGoBack();
  const tabNav = navigation.getParent() as NavigationProp<ParamListBase> | undefined;
  const visible = canPopStack || !atHomeTabRoot;

  const onPress = () => {
    if (canPopStack) {
      navigation.goBack();
      return;
    }
    if (!atHomeTabRoot) {
      tabNav?.navigate("Home" as never);
    }
  };

  return { visible, onPress };
}

/** Single chevron for embedding in a tab screen header (no extra full-width bar). */
export function TabInlineBackButton({
  iconColor = colors.navy,
  size = 26,
}: {
  iconColor?: string;
  size?: number;
}) {
  const { visible, onPress } = useTabBackAction();
  if (!visible) return null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.inlineHit, pressed && { opacity: 0.72 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={size} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  stackHit: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  inlineHit: {
    marginRight: 2,
    paddingVertical: 2,
    justifyContent: "center",
  },
});
