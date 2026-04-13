import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BookingsScreen } from "../screens/BookingsScreen";
import { ExploreScreen } from "../screens/ExploreScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ItineraryScreen } from "../screens/ItineraryScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { DestinaTabBar } from "./DestinaTabBar";
import { colors } from "../theme/colors";

export type TabParamList = {
  Home: undefined;
  Explore: { categorySlug?: string } | undefined;
  Itinerary: undefined;
  Bookings: undefined;
  Profile: undefined;
};

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
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: "Explore" }} />
      <Tab.Screen name="Itinerary" component={ItineraryScreen} options={{ title: "Itinerary" }} />
      <Tab.Screen name="Bookings" component={BookingsScreen} options={{ title: "Bookings" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
