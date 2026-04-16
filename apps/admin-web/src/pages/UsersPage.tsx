import { useCallback, useEffect, useState } from "react";
import { AdminTablePageSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type UserRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  is_suspended: boolean;
  last_seen_at: string | null;
  is_online: boolean;
  created_at: string;
};

function formatRelativeLastSeen(lastSeenIso: string | null, isOnline: boolean): string {
  if (isOnline) return "online now";
  if (!lastSeenIso) return "—";
  const d = new Date(lastSeenIso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "—";

  const diffMs = Date.now() - t;
  if (diffMs < 0) return "—";
  const min = Math.floor(diffMs / 60_000);
  if (min <= 0) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function UsersPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMsg(null);
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) {
        setMsg(error.message);
        return;
      }
      setRows((data as UserRow[]) ?? []);
    } finally {
      setInitialLoad(false);
    }
  }, []);

  const setSuspended = useCallback(async (userId: string, suspended: boolean) => {
    setBusyId(userId);
    setMsg(null);
    try {
      const { error } = await supabase.from("profiles").update({ is_suspended: suspended }).eq("id", userId);
      if (error) {
        setMsg(error.message);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!confirm("Delete this user? This will remove their account and related data.")) return;
    setBusyId(userId);
    setMsg(null);
    try {
      const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
      if (error) {
        setMsg(error.message);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Realtime updates for presence + admin actions (suspend, etc.).
    // If replication isn't enabled for `profiles`, this will no-op and polling/manual refresh still works.
    let t: number | null = null;
    const bump = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => void load(), 250);
    };

    const ch = supabase
      .channel("admin-users:profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => bump(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          // eslint-disable-next-line no-console
          console.warn("[admin users] Realtime channel error — enable Replication for profiles in Supabase.");
        }
      });

    return () => {
      if (t) window.clearTimeout(t);
      void supabase.removeChannel(ch);
    };
  }, [load]);

  if (initialLoad) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Accounts</p>
          <h1 className="dash-title admin-page-hero__title">Users</h1>
          <p className="dash-sub admin-page-hero__sub">
            Mobile app users only (consumers). Shows realtime status and last active.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--cat" aria-hidden />
      </header>
      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}
      <div className="card card--table-shell" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last active</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.full_name?.trim() || "—"}</td>
                <td>{r.username?.trim() ? r.username : "—"}</td>
                <td style={{ wordBreak: "break-all" }}>{r.email?.trim() || "—"}</td>
                <td>
                  <span className={`pill ${r.role}`}>{r.role}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`pill ${r.is_online ? "approved" : "pending"}`}>
                      {r.is_online ? "online" : "offline"}
                    </span>
                    {r.is_suspended ? <span className="pill rejected">suspended</span> : <span className="pill approved">active</span>}
                  </div>
                </td>
                <td>{formatRelativeLastSeen(r.last_seen_at, r.is_online)}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {r.role === "admin" ? (
                      <button type="button" className="btn btn-ghost" disabled title="Admin accounts cannot be suspended/deleted here.">
                        Protected
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busyId === r.id}
                          onClick={() => void setSuspended(r.id, !r.is_suspended)}
                        >
                          {r.is_suspended ? "Unsuspend" : "Suspend"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyId === r.id}
                          onClick={() => void deleteUser(r.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "28px 16px", color: "var(--muted)" }}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
