import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BookingsScreen } from "../screens/BookingsScreen";
import { DestinationDetailScreen } from "../screens/DestinationDetailScreen";
import { ExploreScreen } from "../screens/ExploreScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { BookingRequestScreen } from "../screens/BookingRequestScreen";
import type { BookingsStackParamList, ExploreStackParamList, HomeStackParamList } from "./tabTypes";
import { colors } from "../theme/colors";

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();

export function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Detail" component={DestinationDetailScreen} />
      <HomeStack.Screen
        name="BookingRequest"
        component={BookingRequestScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          title: "Reserve",
        }}
      />
    </HomeStack.Navigator>
  );
}

export function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStack.Screen name="ExploreMain" component={ExploreScreen} />
      <ExploreStack.Screen name="Detail" component={DestinationDetailScreen} />
      <ExploreStack.Screen
        name="BookingRequest"
        component={BookingRequestScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          title: "Reserve",
        }}
      />
    </ExploreStack.Navigator>
  );
}

export function BookingsStackNavigator() {
  return (
    <BookingsStack.Navigator screenOptions={{ headerShown: false }}>
      <BookingsStack.Screen name="BookingsMain" component={BookingsScreen} />
      <BookingsStack.Screen name="Detail" component={DestinationDetailScreen} />
      <BookingsStack.Screen
        name="BookingRequest"
        component={BookingRequestScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          title: "Reserve",
        }}
      />
    </BookingsStack.Navigator>
  );
}
