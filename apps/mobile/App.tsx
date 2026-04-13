import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ItineraryProvider } from "./src/context/ItineraryContext";
import { SplashScreen } from "./src/screens/SplashScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { WelcomeAuthScreen } from "./src/screens/WelcomeAuthScreen";
import { InterestSelectScreen } from "./src/screens/InterestSelectScreen";
import { MainTabs } from "./src/navigation/MainTabs";
import { DestinationDetailScreen } from "./src/screens/DestinationDetailScreen";
import { DestinationMapScreen } from "./src/screens/DestinationMapScreen";
import { BookingRequestScreen } from "./src/screens/BookingRequestScreen";
import { colors } from "./src/theme/colors";

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  WelcomeAuth: { mode: "signin" | "signup" };
  InterestSelect: { intent?: "onboarding" | "edit" } | undefined;
  Main: undefined;
  Detail: { id: string };
  DestinationMap: { title: string; destLat: number; destLng: number };
  BookingRequest: { businessId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primaryTeal,
    background: colors.pageBg,
    card: colors.white,
    text: colors.text,
    border: colors.border,
    notification: colors.primaryTeal,
  },
};

export default function App() {
  return (
    <ItineraryProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="WelcomeAuth" component={WelcomeAuthScreen} />
          <Stack.Screen name="InterestSelect" component={InterestSelectScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Detail" component={DestinationDetailScreen} />
          <Stack.Screen
            name="DestinationMap"
            component={DestinationMapScreen}
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="BookingRequest"
            component={BookingRequestScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.navy },
              headerTintColor: "#fff",
              headerTitleStyle: { fontWeight: "700" },
              title: "Book",
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ItineraryProvider>
  );
}
