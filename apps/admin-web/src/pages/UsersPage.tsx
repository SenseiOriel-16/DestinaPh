import { useCallback, useEffect, useState } from "react";
import { AdminTablePageSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type UserRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

export function UsersPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
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
            All registered users with sign-in email and username (when set).
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.full_name?.trim() || "—"}</td>
                <td>{r.username?.trim() ? r.username : "—"}</td>
                <td style={{ wordBreak: "break-all" }}>{r.email?.trim() || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", padding: "28px 16px", color: "var(--muted)" }}>
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
