import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Category = {
  id: string;
  name: string;
  slug: string;
  color_token: string | null;
};

export function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,slug,color_token")
      .order("name");
    if (error) {
      setMsg(error.message);
      return;
    }
    setRows((data as Category[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.from("categories").insert({
      name,
      slug,
      color_token: "custom",
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setName("");
    setSlug("");
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete category? Linked businesses must be reassigned first.")) return;
    setMsg(null);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  return (
    <div className="page">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "var(--primary)" }}>Categories</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
          Curate the taxonomy surfaced in filters across web and mobile.
        </p>
      </header>
      {msg && <div className="card" style={{ marginBottom: 12 }}>{msg}</div>}
      <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add category</h3>
        <div className="field">
          <label htmlFor="cname">Name</label>
          <input id="cname" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="cslug">Slug</label>
          <input id="cslug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit">
          Save category
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
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.slug}</td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-danger" onClick={() => void remove(c.id)}>
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
