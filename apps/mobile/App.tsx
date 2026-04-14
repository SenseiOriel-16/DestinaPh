import { NavigationContainer, DefaultTheme, NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ItineraryProvider } from "./src/context/ItineraryContext";
import { SplashScreen } from "./src/screens/SplashScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { WelcomeAuthScreen } from "./src/screens/WelcomeAuthScreen";
import { InterestSelectScreen } from "./src/screens/InterestSelectScreen";
import { MainTabs, type TabParamList } from "./src/navigation/MainTabs";
import { navyStackHeader } from "./src/navigation/stackScreenOptions";
import { DestinationMapScreen } from "./src/screens/DestinationMapScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { HelpSupportScreen } from "./src/screens/HelpSupportScreen";
import { AboutDestinaPHScreen } from "./src/screens/AboutDestinaPHScreen";
import { FavoritesScreen } from "./src/screens/FavoritesScreen";
import { ReviewsScreen } from "./src/screens/ReviewsScreen";
import { EditProfileScreen } from "./src/screens/EditProfileScreen";
import { colors } from "./src/theme/colors";

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  WelcomeAuth: { mode: "signin" | "signup" };
  InterestSelect: { intent?: "onboarding" | "edit" } | undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  DestinationMap: { title: string; destLat: number; destLng: number };
  Settings: undefined;
  HelpSupport: undefined;
  AboutDestinaPH: undefined;
  Favorites: undefined;
  Reviews: undefined;
  EditProfile: undefined;
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
          <Stack.Screen
            name="DestinationMap"
            component={DestinationMapScreen}
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...navyStackHeader, title: "Settings" }} />
          <Stack.Screen
            name="HelpSupport"
            component={HelpSupportScreen}
            options={{ ...navyStackHeader, title: "Help & Support" }}
          />
          <Stack.Screen
            name="AboutDestinaPH"
            component={AboutDestinaPHScreen}
            options={{ ...navyStackHeader, title: "About" }}
          />
          <Stack.Screen
            name="Favorites"
            component={FavoritesScreen}
            options={{ ...navyStackHeader, title: "My Favorites" }}
          />
          <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ ...navyStackHeader, title: "My Reviews" }} />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ ...navyStackHeader, title: "Edit profile" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ItineraryProvider>
  );
}
