import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BookingsScreen } from "../screens/BookingsScreen";
import { DestinationDetailScreen } from "../screens/DestinationDetailScreen";
import { ExploreScreen } from "../screens/ExploreScreen";
import { HomeScreen } from "../screens/HomeScreen";
import type { BookingsStackParamList, ExploreStackParamList, HomeStackParamList } from "./tabTypes";

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();

export function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Detail" component={DestinationDetailScreen} />
    </HomeStack.Navigator>
  );
}

export function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStack.Screen name="ExploreMain" component={ExploreScreen} />
      <ExploreStack.Screen name="Detail" component={DestinationDetailScreen} />
    </ExploreStack.Navigator>
  );
}

export function BookingsStackNavigator() {
  return (
    <BookingsStack.Navigator screenOptions={{ headerShown: false }}>
      <BookingsStack.Screen name="BookingsMain" component={BookingsScreen} />
      <BookingsStack.Screen name="Detail" component={DestinationDetailScreen} />
    </BookingsStack.Navigator>
  );
}
