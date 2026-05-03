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

function requestHref(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

let clearingStaleAuth = false;

/**
 * Clears corrupted AsyncStorage session when refresh_token exchange returns 400
 * ("Invalid Refresh Token", etc.) so the user can sign in again instead of a broken loop.
 */
function createAuthRecoveryFetch(forClient: () => SupabaseClient): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input as Parameters<typeof fetch>[0], init);
    if (res.status !== 400 || clearingStaleAuth) return res;
    try {
      const href = requestHref(input as RequestInfo | URL);
      if (!href.includes("/auth/v1/token")) return res;
      const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return res;
      const desc = String(body.error_description ?? body.message ?? "").toLowerCase();
      const code = String(body.error ?? "");
      const badRefresh =
        desc.includes("refresh token") ||
        code === "invalid_grant" ||
        code === "refresh_token_already_used";
      if (!badRefresh) return res;
      clearingStaleAuth = true;
      try {
        await forClient().auth.signOut({ scope: "local" });
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DestinaPH] Supabase refresh token expired or invalid — cleared local session. Sign in again to load destinations and promos.",
          );
        }
      } finally {
        clearingStaleAuth = false;
      }
    } catch {
      /* ignore */
    }
    return res;
  };
}

let supabaseInstance: SupabaseClient;

supabaseInstance = createClient(resolvedUrl, resolvedAnon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: createAuthRecoveryFetch(() => supabaseInstance),
  },
});

/** Supabase JS client — uses AsyncStorage session + auto refresh; clears bad refresh tokens automatically. */
export const supabase = supabaseInstance;
