import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

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

    const disableFurtherPings =
      error.code === "PGRST400" ||
      error.code === "PGRST204" ||
      (error as any).status === 400;

    // eslint-disable-next-line no-console
    console.warn("[useLastSeenPing] Failed to update profiles.last_seen_at:", error);
    if (disableFurtherPings) {
      // eslint-disable-next-line no-console
      console.warn(
        "[useLastSeenPing] Disabling further pings due to 400. Ensure migration `20260415223000_admin_users_presence_and_actions.sql` is applied (adds profiles.last_seen_at).",
      );
    }

    return { ok: false, disableFurtherPings };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[useLastSeenPing] Failed to update last seen (exception):", e);
    return { ok: false, disableFurtherPings: false };
  }
}

export function useLastSeenPing() {
  useEffect(() => {
    let disabled = false;

    void (async () => {
      const res = await touchLastSeen();
      if (!res.ok && res.disableFurtherPings) disabled = true;
    })();

    const onVis = () => {
      if (disabled) return;
      if (document.visibilityState === "visible") {
        void (async () => {
          const res = await touchLastSeen();
          if (!res.ok && res.disableFurtherPings) disabled = true;
        })();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const id = window.setInterval(() => {
      if (disabled) return;
      void (async () => {
        const res = await touchLastSeen();
        if (!res.ok && res.disableFurtherPings) disabled = true;
      })();
    }, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, []);
}

