import type { NavigatorScreenParams } from "@react-navigation/native";

export type BookingsTabFilter = "upcoming" | "confirmed" | "rejected";

export type HomeStackParamList = {
  HomeMain: undefined;
  Detail: { id: string };
  BookingRequest: { businessId: string };
};

export type ExploreStackParamList = {
  ExploreMain: { categorySlug?: string } | undefined;
  Detail: { id: string };
  BookingRequest: { businessId: string };
};

export type BookingsStackParamList = {
  BookingsMain: { initialTab?: BookingsTabFilter } | undefined;
  Detail: { id: string };
  BookingRequest: { businessId: string };
};

export type ItineraryStackParamList = {
  ItineraryMain: undefined;
  Detail: { id: string };
  BookingRequest: { businessId: string };
};

export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Explore: NavigatorScreenParams<ExploreStackParamList> | undefined;
  Itinerary: NavigatorScreenParams<ItineraryStackParamList> | undefined;
  Bookings: NavigatorScreenParams<BookingsStackParamList> | undefined;
  Profile: undefined;
};
