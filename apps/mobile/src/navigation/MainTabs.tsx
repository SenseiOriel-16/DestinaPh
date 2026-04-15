import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ProfileScreen } from "../screens/ProfileScreen";
import { DestinaTabBar } from "./DestinaTabBar";
import { BookingsStackNavigator, ExploreStackNavigator, HomeStackNavigator, ItineraryStackNavigator } from "./tabStacks";
import type { TabParamList } from "./tabTypes";
import { colors } from "../theme/colors";

export type { TabParamList } from "./tabTypes";

const Tab = createBottomTabNavigator<TabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <DestinaTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primaryTeal,
        tabBarInactiveTintColor: colors.muted2,
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: "Home" }} />
      <Tab.Screen name="Explore" component={ExploreStackNavigator} options={{ title: "Explore" }} />
      <Tab.Screen name="Itinerary" component={ItineraryStackNavigator} options={{ title: "Itinerary" }} />
      <Tab.Screen name="Bookings" component={BookingsStackNavigator} options={{ title: "Bookings" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
