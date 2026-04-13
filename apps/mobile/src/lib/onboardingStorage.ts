import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const KEY_DONE = "@destina/onboarding_v1_complete";
const KEY_INTERESTS = "@destina/interest_category_slugs";

export async function isOnboardingComplete(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY_DONE);
  return v === "1";
}

export async function getInterestSlugs(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY_INTERESTS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed as string[];
      }
    } catch {
      /* ignore */
    }
  }
  const { data: session } = await supabase.auth.getSession();
  const meta = session.session?.user?.user_metadata as { interest_category_slugs?: unknown } | undefined;
  const fromMeta = meta?.interest_category_slugs;
  if (Array.isArray(fromMeta) && fromMeta.every((x) => typeof x === "string")) {
    return fromMeta as string[];
  }
  return [];
}

export async function saveInterestSlugs(slugs: string[]): Promise<void> {
  const unique = [...new Set(slugs.filter(Boolean))];
  await AsyncStorage.setItem(KEY_INTERESTS, JSON.stringify(unique));
  const { data: session } = await supabase.auth.getSession();
  if (session.session) {
    await supabase.auth.updateUser({
      data: { interest_category_slugs: unique },
    });
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY_DONE, "1");
}
