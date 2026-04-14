import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

const KEY_ACCEPTED = "destinaph_terms_privacy_accepted_v1";

export const TERMS_PRIVACY_OPEN_EVENT = "destinaph-terms-privacy-open";

export async function getTermsPrivacyAccepted(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY_ACCEPTED);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setTermsPrivacyAccepted(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_ACCEPTED, "1");
  } catch {
    // ignore storage failures
  }
}

export function openTermsPrivacy(): void {
  DeviceEventEmitter.emit(TERMS_PRIVACY_OPEN_EVENT);
}

