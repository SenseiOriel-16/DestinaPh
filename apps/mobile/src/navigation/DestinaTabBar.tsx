import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

const tabIcon = (
  routeName: string,
  focused: boolean,
): keyof typeof Ionicons.glyphMap => {
  switch (routeName) {
    case "Home":
      return focused ? "home" : "home-outline";
    case "Explore":
      return focused ? "search" : "search-outline";
    case "Itinerary":
      return focused ? "clipboard" : "clipboard-outline";
    case "Bookings":
      return focused ? "calendar" : "calendar-outline";
    case "Profile":
      return focused ? "person" : "person-outline";
    default:
      return "ellipse-outline";
  }
};

const tabLabel: Record<string, string> = {
  Home: "Home",
  Explore: "Explore",
  Itinerary: "Itinerary",
  Bookings: "Bookings",
  Profile: "Profile",
};

function tabTitle(
  opts: BottomTabBarProps["descriptors"][string]["options"],
  routeName: string,
) {
  return (opts.tabBarLabel as string) || (opts.title as string) || tabLabel[routeName] || routeName;
}

function TabButton({
  route,
  isFocused,
  label,
  navigation,
}: {
  route: BottomTabBarProps["state"]["routes"][0];
  isFocused: boolean;
  label: string;
  navigation: BottomTabBarProps["navigation"];
}) {
  const onPress = () => {
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      style={styles.tab}
    >
      <Ionicons
        name={tabIcon(route.name, isFocused)}
        size={22}
        color={isFocused ? colors.primaryTeal : colors.muted2}
      />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DestinaTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const routes = state.routes;

  if (routes.length === 0) {
    return null;
  }

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        {routes.map((route, index) => (
          <TabButton
            key={route.key}
            route={route}
            isFocused={state.index === index}
            label={tabTitle(descriptors[route.key].options, route.name)}
            navigation={navigation}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingBottom: 2,
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted2,
  },
  tabLabelActive: {
    color: colors.primaryTeal,
  },
});
