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
import { BookingStatusNotifier } from "./src/components/BookingStatusNotifier";
import { BookingNotificationBell } from "./src/components/BookingNotificationBell";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { TermsPrivacyModal } from "./src/components/TermsPrivacyModal";
import { getTermsPrivacyAccepted, setTermsPrivacyAccepted, TERMS_PRIVACY_OPEN_EVENT } from "./src/lib/termsPrivacy";
import { navigationRef } from "./src/navigation/navRef";

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
  const [routeName, setRouteName] = useState<string>("Splash");
  const [tpVisible, setTpVisible] = useState(false);
  const [tpAccepted, setTpAccepted] = useState<boolean | null>(null);

  const canShowAuto = useMemo(() => routeName !== "Splash", [routeName]);
  const canShowNotifUi = useMemo(
    () => !["Splash", "Welcome", "WelcomeAuth", "InterestSelect"].includes(routeName),
    [routeName],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await getTermsPrivacyAccepted();
      if (cancelled) return;
      setTpAccepted(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canShowAuto) return;
    if (tpAccepted === false) setTpVisible(true);
  }, [canShowAuto, tpAccepted]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TERMS_PRIVACY_OPEN_EVENT, () => setTpVisible(true));
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ItineraryProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          onStateChange={(state) => {
            const name = state?.routes?.[state.index ?? 0]?.name;
            if (typeof name === "string") setRouteName(name);
          }}
        >
          <StatusBar style="light" />
          {canShowNotifUi ? (
            <>
              <BookingStatusNotifier />
              <BookingNotificationBell />
            </>
          ) : null}
          <TermsPrivacyModal
            visible={tpVisible}
            mustAccept={tpAccepted === false}
            onClose={() => setTpVisible(false)}
            onAccept={() => {
              void (async () => {
                await setTermsPrivacyAccepted();
                setTpAccepted(true);
                setTpVisible(false);
              })();
            }}
          />
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
    </SafeAreaProvider>
  );
}
