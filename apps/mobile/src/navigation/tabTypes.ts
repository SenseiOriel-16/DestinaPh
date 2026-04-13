import type { NavigatorScreenParams } from "@react-navigation/native";

export type HomeStackParamList = {
  HomeMain: undefined;
  Detail: { id: string };
};

export type ExploreStackParamList = {
  ExploreMain: { categorySlug?: string } | undefined;
  Detail: { id: string };
};

export type BookingsStackParamList = {
  BookingsMain: undefined;
  Detail: { id: string };
};

export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Explore: NavigatorScreenParams<ExploreStackParamList> | undefined;
  Itinerary: undefined;
  Bookings: NavigatorScreenParams<BookingsStackParamList> | undefined;
  Profile: undefined;
};
