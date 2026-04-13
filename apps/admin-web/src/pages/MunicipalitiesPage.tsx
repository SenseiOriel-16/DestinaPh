import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Municipality = {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
};

export function MunicipalitiesPage() {
  const [rows, setRows] = useState<Municipality[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("municipalities")
      .select("id,name,slug,thumbnail_url")
      .order("name");
    if (error) {
      setMsg(error.message);
      return;
    }
    setRows((data as Municipality[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.from("municipalities").insert({ name, slug });
    if (error) {
      setMsg(error.message);
      return;
    }
    setName("");
    setSlug("");
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

  return (
    <div className="page">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "var(--primary)" }}>Municipalities</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
          Maintain the Camarines Sur coverage map for discovery filters.
        </p>
      </header>
      {msg && <div className="card" style={{ marginBottom: 12 }}>{msg}</div>}
      <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add municipality</h3>
        <div className="field">
          <label htmlFor="mname">Name</label>
          <input id="mname" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="mslug">Slug</label>
          <input id="mslug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit">
          Save municipality
        </button>
      </form>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>{m.slug}</td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-danger" onClick={() => void remove(m.id)}>
                    Delete
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
