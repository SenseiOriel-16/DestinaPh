import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { normalizeSavedAccommodations, type AccommodationItem } from "../lib/accommodations";
import { supabase } from "../lib/supabaseClient";

type Photo = { storage_path: string; sort_order: number };

type Row = {
  id: string;
  name: string;
  status: string;
  views: number | null;
  clicks: number | null;
  short_description: string | null;
  pricing_text: string | null;
  operating_day: boolean | null;
  operating_night: boolean | null;
  accommodations: unknown;
  categories: { name: string; slug?: string } | null;
  municipalities: { name: string } | null;
  business_photos: Photo[] | null;
};

const RESORT_SLUG = "resorts-leisure";

function statusLabel(status: string) {
  if (status === "approved") return "Published";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  return status;
}

function pillClass(status: string) {
  if (status === "approved") return "pill approved";
  if (status === "pending") return "pill pending";
  if (status === "rejected") return "pill rejected";
  return "pill";
}

export function ListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"all" | "approved" | "pending" | "rejected">("all");
  const [savingAccKey, setSavingAccKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    const { data } = await supabase
      .from("businesses")
      .select(
        "id,name,status,views,clicks,short_description,pricing_text,operating_day,operating_night,accommodations,categories(name,slug),municipalities(name),business_photos(storage_path,sort_order)",
      )
      .eq("owner_id", uid)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const all = rows.length;
    const published = rows.filter((r) => r.status === "approved").length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    return { all, published, pending, rejected };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const remove = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    await supabase.from("businesses").delete().eq("id", id);
    await load();
  };

  const bannerUrl = (r: Row) => {
    const photos = [...(r.business_photos ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const path = photos[0]?.storage_path;
    if (!path) return null;
    return supabase.storage.from("business-images").getPublicUrl(path).data.publicUrl;
  };

  const accommodationsFor = (r: Row): AccommodationItem[] => normalizeSavedAccommodations(r.accommodations);

  const setAccommodationAvailable = async (listingId: string, index: number, available: boolean) => {
    const r = rows.find((x) => x.id === listingId);
    if (!r) return;
    const acc = accommodationsFor(r);
    if (index < 0 || index >= acc.length) return;
    const key = `${listingId}:${index}`;
    setSavingAccKey(key);
    setToast(null);
    const next = acc.map((a, i) => (i === index ? { ...a, available } : a));
    const { error } = await supabase.from("businesses").update({ accommodations: next }).eq("id", listingId);
    if (error) {
      setToast(error.message);
    } else {
      setRows((prev) => prev.map((row) => (row.id === listingId ? { ...row, accommodations: next } : row)));
    }
    setSavingAccKey(null);
  };

  return (
    <div className="page page--flush-top">
      <div className="listings-head">
        <div>
          <h1 className="dash-title" style={{ marginBottom: 6 }}>
            Manage Listings
          </h1>
          <p className="dash-sub" style={{ marginBottom: 0 }}>
            Your properties at a glance — mark room types as available or full so guests can plan ahead.
          </p>
        </div>
        <Link to="/listings/new" className="btn btn-primary btn-inline">
          + Add New Listing
        </Link>
      </div>

      {toast && (
        <div className="card" style={{ marginBottom: 14, borderColor: "#fecaca", background: "#fff7f7" }}>
          {toast}
        </div>
      )}

      <div className="tabs">
        <button type="button" className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
          All Listings ({counts.all})
        </button>
        <button
          type="button"
          className={tab === "approved" ? "active" : ""}
          onClick={() => setTab("approved")}
        >
          Published ({counts.published})
        </button>
        <button
          type="button"
          className={tab === "pending" ? "active" : ""}
          onClick={() => setTab("pending")}
        >
          Pending ({counts.pending})
        </button>
        <button
          type="button"
          className={tab === "rejected" ? "active" : ""}
          onClick={() => setTab("rejected")}
        >
          Rejected ({counts.rejected})
        </button>
      </div>

      <div className="listing-owner-cards">
        {filtered.map((r) => {
          const banner = bannerUrl(r);
          const acc = accommodationsFor(r);
          const isResort = r.categories?.slug === RESORT_SLUG;
          const hoursParts: string[] = [];
          if (isResort && r.operating_day) hoursParts.push("Day");
          if (isResort && r.operating_night) hoursParts.push("Night");

          return (
            <article className="listing-owner-card" key={r.id}>
              <div className="listing-owner-card__banner">
                {banner ? (
                  <img src={banner} alt="" />
                ) : (
                  <div className="listing-owner-card__banner-placeholder">No photo yet</div>
                )}
              </div>

              <div className="listing-owner-card__body">
                <div className="listing-owner-card__title-row">
                  <h2 className="listing-owner-card__name">{r.name}</h2>
                  <span className={pillClass(r.status)}>{statusLabel(r.status)}</span>
                </div>

                {r.short_description && (
                  <p className="listing-owner-card__desc">{r.short_description}</p>
                )}

                <div className="listing-owner-card__chips">
                  <span className="listing-owner-card__chip">{r.categories?.name ?? "—"}</span>
                  <span className="listing-owner-card__chip">{r.municipalities?.name ?? "—"}</span>
                  <span className="listing-owner-card__chip">{r.views ?? 0} views</span>
                </div>

                {isResort && (hoursParts.length > 0 || r.pricing_text) && (
                  <div className="listing-owner-card__fees">
                    {hoursParts.length > 0 && (
                      <div>
                        <strong>Operating:</strong> {hoursParts.join(" · ")}
                      </div>
                    )}
                    {r.pricing_text && (
                      <div>
                        <strong>Entrance:</strong> {r.pricing_text}
                      </div>
                    )}
                  </div>
                )}

                <section className="listing-owner-card__acc">
                  <h3 className="listing-owner-card__acc-title">Accommodations</h3>
                  <p className="listing-owner-card__acc-hint">
                    Turn off <strong>Available</strong> when that room type is fully booked or not offered, so guests
                    know before they travel (for example if they need space for 6 pax).
                  </p>
                  {acc.length === 0 ? (
                    <p className="listing-owner-card__acc-empty">
                      No room types yet.{" "}
                      <Link to={`/listings/${r.id}`} className="link-teal">
                        Edit listing
                      </Link>{" "}
                      to add accommodations.
                    </p>
                  ) : (
                    <ul className="listing-owner-card__acc-list">
                      {acc.map((a, i) => {
                        const busy = savingAccKey === `${r.id}:${i}`;
                        return (
                          <li className="listing-owner-card__acc-item" key={`${a.name}-${i}`}>
                            <div className="listing-owner-card__acc-info">
                              <span className="listing-owner-card__acc-name">{a.name}</span>
                              <span className="listing-owner-card__acc-meta">
                                {a.pax ? `${a.pax} · ` : ""}₱{a.price_pesos.toLocaleString()}
                              </span>
                            </div>
                            <label className={`listing-owner-card__avail${busy ? " is-busy" : ""}`}>
                              <input
                                type="checkbox"
                                checked={a.available}
                                disabled={busy}
                                onChange={(e) => void setAccommodationAvailable(r.id, i, e.target.checked)}
                              />
                              <span>{a.available ? "Available" : "Unavailable"}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <div className="listing-owner-card__actions">
                  <Link to={`/listings/${r.id}`} className="btn btn-primary btn-inline">
                    Edit listing
                  </Link>
                  <button type="button" className="btn btn-outline" onClick={() => void remove(r.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="card listing-owner-card listing-owner-card--empty">
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No listings in this filter.{" "}
              <Link to="/listings/new" className="link-teal">
                Add one
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
