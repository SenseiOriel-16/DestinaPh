import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Row = {
  id: string;
  name: string;
  is_featured: boolean;
  municipalities: { name: string } | null;
};

export function FeaturedPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("businesses")
      .select("id,name,is_featured,municipalities(name)")
      .eq("status", "approved")
      .order("name");
    if (error) {
      setMsg(error.message);
      return;
    }
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: Row) => {
    setMsg(null);
    const { error } = await supabase
      .from("businesses")
      .update({ is_featured: !row.is_featured })
      .eq("id", row.id);
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  return (
    <div className="page">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "var(--primary)" }}>
          Featured destinations
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
          Highlight hero cards on the mobile home experience.
        </p>
      </header>
      {msg && <div className="card" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Municipality</th>
              <th>Featured</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.municipalities?.name ?? "—"}</td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => void toggle(r)}>
                    {r.is_featured ? "Remove spotlight" : "Feature"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
