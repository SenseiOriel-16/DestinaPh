import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { supabase } from "../lib/supabase";

async function touchLastSeen(): Promise<{ ok: true } | { ok: false; disableFurtherPings: boolean }> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return { ok: true };

    const { error } = await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error) return { ok: true };

    // 400 commonly happens when the column isn't deployed yet (schema mismatch),
    // or when PostgREST rejects the request payload.
    const disableFurtherPings =
      error.code === "PGRST400" ||
      error.code === "PGRST204" ||
      (error as any).status === 400;

    // eslint-disable-next-line no-console
    console.warn("[LastSeenPinger] Failed to update profiles.last_seen_at:", error);
    if (disableFurtherPings) {
      // eslint-disable-next-line no-console
      console.warn(
        "[LastSeenPinger] Disabling further pings due to 400. Ensure migration `20260415223000_admin_users_presence_and_actions.sql` is applied (adds profiles.last_seen_at).",
      );
    }

    return { ok: false, disableFurtherPings };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[LastSeenPinger] Failed to update last seen (exception):", e);
    return { ok: false, disableFurtherPings: false };
  }
}

export function LastSeenPinger() {
  const alive = useRef(true);
  const disabled = useRef(false);

  useEffect(() => {
    alive.current = true;
    void (async () => {
      const res = await touchLastSeen();
      if (!res.ok && res.disableFurtherPings) disabled.current = true;
    })();

    const sub = AppState.addEventListener("change", (state) => {
      if (!alive.current) return;
      if (disabled.current) return;
      if (state === "active") {
        void (async () => {
          const res = await touchLastSeen();
          if (!res.ok && res.disableFurtherPings) disabled.current = true;
        })();
      }
    });

    const id = setInterval(() => {
      if (!alive.current) return;
      if (disabled.current) return;
      void (async () => {
        const res = await touchLastSeen();
        if (!res.ok && res.disableFurtherPings) disabled.current = true;
      })();
    }, 60_000);

    return () => {
      alive.current = false;
      clearInterval(id);
      sub.remove();
    };
  }, []);

  return null;
}

