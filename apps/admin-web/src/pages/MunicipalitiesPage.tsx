import { FormEvent, useEffect, useState } from "react";
import { AdminFormTableSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Municipality = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  provinces: { name: string } | null;
};

type Province = { id: string; name: string };

export function MunicipalitiesPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<Municipality[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [name, setName] = useState("");
  const [provinceId, setProvinceId] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const [munRes, provRes] = await Promise.all([
        supabase
          .from("municipalities")
          .select("id,name,thumbnail_url,provinces(name)")
          .eq("user_managed", true)
          .order("name"),
        supabase.from("provinces").select("id,name").order("name"),
      ]);
      if (munRes.error) {
        setMsg(munRes.error.message);
        return;
      }
      if (provRes.error) {
        setMsg(provRes.error.message);
        return;
      }
      setRows((munRes.data as Municipality[]) ?? []);
      setProvinces((provRes.data as Province[]) ?? []);
    } finally {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const pid = provinceId || null;
    const { error } = await supabase.from("municipalities").insert({
      name: name.trim(),
      province_id: pid,
      user_managed: true,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setName("");
    setProvinceId("");
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete municipality?")) return;
    setMsg(null);
    const { error } = await supabase.from("municipalities").delete().eq("id", id);
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  if (initialLoad) {
    return <AdminFormTableSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Geography</p>
          <h1 className="dash-title admin-page-hero__title">Municipalities</h1>
          <p className="dash-sub admin-page-hero__sub">
            Only municipalities you add here appear in this list. PSGC and legacy seed places stay in the database
            for addresses when needed, but are not shown here.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--geo" aria-hidden />
      </header>
      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}
      <form className="card card--lift" onSubmit={create}>
        <h3 className="admin-form-card-title">Add municipality</h3>
        <div className="field">
          <label htmlFor="mname">Name</label>
          <input id="mname" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Daet" />
        </div>
        <div className="field">
          <label htmlFor="mprov">Province (optional)</label>
          <select id="mprov" value={provinceId} onChange={(e) => setProvinceId(e.target.value)}>
            <option value="">— None —</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">
          Save municipality
        </button>
      </form>
      <div className="card card--table-shell" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Province</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="table__strong">{m.name}</td>
                <td>{m.provinces?.name ?? "—"}</td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-danger" onClick={() => void remove(m.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  No municipalities yet. Add one above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
