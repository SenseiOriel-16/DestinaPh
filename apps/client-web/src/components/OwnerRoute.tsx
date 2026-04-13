import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { OwnerShellSkeleton } from "./PageSkeletons";
import { supabase } from "../lib/supabaseClient";

async function isBusinessOwner(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, owner_approval_status, is_suspended")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.warn("[DestinaPH] profiles:", error.message);
      return false;
    }
    const gate = (profile as { owner_approval_status?: string } | null)?.owner_approval_status ?? "approved";
    const suspended = !!(profile as { is_suspended?: boolean | null } | null)?.is_suspended;
    return profile?.role === "business_owner" && gate === "approved" && !suspended;
  } catch (e) {
    console.warn("[DestinaPH] auth check failed:", e);
    return false;
  }
}

export function OwnerRoute() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const ok = await isBusinessOwner();
        if (!cancelled) setAllowed(ok);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void (async () => {
        try {
          const ok = await isBusinessOwner();
          if (!cancelled) setAllowed(ok);
        } finally {
          if (!cancelled) setReady(true);
        }
      })();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return <OwnerShellSkeleton />;
  }

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
