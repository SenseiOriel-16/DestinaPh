import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AdminShellSkeleton } from "./PageSkeletons";
import { supabase } from "../lib/supabaseClient";

async function isAdminSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.warn("[DestinaPH Admin] profiles:", error.message);
      return false;
    }
    return profile?.role === "admin";
  } catch (e) {
    console.warn("[DestinaPH Admin] auth check:", e);
    return false;
  }
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const ok = await isAdminSession();
        if (!cancelled) setAllowed(ok);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void (async () => {
        try {
          const ok = await isAdminSession();
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
    return <AdminShellSkeleton />;
  }

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
