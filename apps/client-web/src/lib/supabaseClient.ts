import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in apps/client-web/.env",
  );
}

function isInvalidStoredSessionError(err: unknown): boolean {
  const msg =
    typeof err === "object" && err && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message.toLowerCase()
      : String(err).toLowerCase();
  return (
    msg.includes("invalid refresh token") ||
    msg.includes("refresh token not found") ||
    msg.includes("invalid jwt")
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: {
    storageKey: "destinaph.client-web.supabase.auth",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// If the browser has a stale/corrupt refresh token (common after env/project changes),
// clear local auth storage so the app doesn't keep trying to refresh it.
void supabase.auth.getSession().then(({ error }) => {
  if (error && isInvalidStoredSessionError(error)) {
    void supabase.auth.signOut({ scope: "local" });
  }
});
