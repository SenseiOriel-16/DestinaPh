import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const anon = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** Valid-looking placeholders so `createClient` never throws at import time (EAS builds without env would otherwise crash on launch). */
const resolvedUrl =
  url ||
  "https://placeholder.supabase.co";
const resolvedAnon =
  anon ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

if (__DEV__ && (!url || !anon)) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing — using placeholder client; set them in .env or EAS env.",
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
