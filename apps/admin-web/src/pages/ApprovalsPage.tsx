import { useCallback, useEffect, useState } from "react";
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
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ owner_approval_status: status })
      .eq("id", id)
      .eq("role", "business_owner");
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  return (
    <div className="page">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "var(--primary)" }}>Business owner approvals</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
          Approve accounts before they can sign in to DestinaPH Business and add listings.
        </p>
      </header>
      {msg && <div className="card" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="card" style={{ padding: 0 }}>
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
                  <button type="button" className="btn btn-primary" onClick={() => void decide(r.id, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void decide(r.id, "rejected")}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  No pending owner accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
