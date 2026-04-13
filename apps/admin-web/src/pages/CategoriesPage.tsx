import { FormEvent, useEffect, useState } from "react";
import { AdminFormTableSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Category = {
  id: string;
  name: string;
  slug: string;
  color_token: string | null;
};

export function CategoriesPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,color_token")
        .order("name");
      if (error) {
        setMsg(error.message);
        return;
      }
      setRows((data as Category[]) ?? []);
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

  if (initialLoad) {
    return <AdminFormTableSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Taxonomy</p>
          <h1 className="dash-title admin-page-hero__title">Categories</h1>
          <p className="dash-sub admin-page-hero__sub">
            Curate the labels travelers see in filters across web and mobile.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--cat" aria-hidden />
      </header>
      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}
      <form className="card card--lift" onSubmit={create}>
        <h3 className="admin-form-card-title">Add category</h3>
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
      <div className="card card--table-shell" style={{ padding: 0 }}>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  No categories yet. Add one above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
