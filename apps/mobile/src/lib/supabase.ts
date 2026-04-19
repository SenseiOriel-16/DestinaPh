import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const anon = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** True when real project URL and anon key are present (not placeholder). */
export const isSupabaseConfigured = Boolean(url && anon);

/** Valid-looking placeholders so `createClient` never throws at import time (EAS builds without env would otherwise crash on launch). */
const resolvedUrl =
  url ||
  "https://placeholder.supabase.co";
const resolvedAnon =
  anon ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing — set apps/mobile/.env locally or Expo → Environment variables for EAS builds.",
  );
}

export const supabase: SupabaseClient = createClient(resolvedUrl, resolvedAnon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
