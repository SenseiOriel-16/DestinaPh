import { useCallback, useEffect, useState } from "react";
import { AdminTablePageSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Row = {
  id: string;
  name: string;
  is_featured: boolean;
  municipalities: { name: string } | null;
};

export function FeaturedPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
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
    } finally {
      setInitialLoad(false);
    }
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

  if (initialLoad) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Spotlight</p>
          <h1 className="dash-title admin-page-hero__title">Featured destinations</h1>
          <p className="dash-sub admin-page-hero__sub">
            Choose which approved listings get hero treatment on the mobile home screen.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--feat" aria-hidden />
      </header>
      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}
      <div className="card card--table-shell" style={{ padding: 0 }}>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  No approved listings to feature yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
