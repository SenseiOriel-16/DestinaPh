import { DeviceEventEmitter } from "react-native";

export type BookingNotificationEvent = {
  id: string;
  bookingId: string;
  title: string;
  body: string;
  createdAt: number;
};

export const BOOKING_NOTIFICATION_EVENT = "destinaph.bookingNotification";

// Emitted when a user taps a notification and wants to open the booking details modal.
export const BOOKING_OPEN_DETAIL_EVENT = "destinaph.openBookingDetail";

export function emitBookingNotification(evt: BookingNotificationEvent) {
  DeviceEventEmitter.emit(BOOKING_NOTIFICATION_EVENT, evt);
}

