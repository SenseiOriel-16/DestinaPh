import { useCallback, useEffect, useState } from "react";
import { AdminTablePageSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Row = {
  id: string;
  full_name: string | null;
  owner_approval_status: string;
  registration_business_name: string | null;
  registration_phone: string | null;
  created_at: string;
};

export function ApprovalsPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,owner_approval_status,registration_business_name,registration_phone,created_at")
        .eq("role", "business_owner")
        .eq("owner_approval_status", "pending")
        .order("created_at", { ascending: false });
      if (error) {
        setMsg(error.message);
        return;
      }
      setRows((data as Row[]) ?? []);
    } finally {
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ owner_approval_status: "approved" })
      .eq("id", id)
      .eq("role", "business_owner");
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  const decline = async (id: string) => {
    if (
      !confirm(
        "Delete this registration permanently? The account and signup data will be removed from the database.",
      )
    ) {
      return;
    }
    setMsg(null);
    const { error } = await supabase.rpc("admin_delete_pending_owner_registration", { p_user_id: id });
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  if (initialLoad) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Trust & safety</p>
          <h1 className="dash-title admin-page-hero__title">Business owner approvals</h1>
          <p className="dash-sub admin-page-hero__sub">
            Approve accounts before they can sign in to DestinaPH Business and add listings.
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
              <th>Business (registration)</th>
              <th>Phone</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.full_name?.trim() || "—"}</td>
                <td>{r.registration_business_name ?? "—"}</td>
                <td>{r.registration_phone ?? "—"}</td>
                <td style={{ color: "var(--muted)", fontSize: 14 }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-primary" onClick={() => void approve(r.id)}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void decline(r.id)}>
                    Decline
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  No pending owner accounts — you&apos;re all caught up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
