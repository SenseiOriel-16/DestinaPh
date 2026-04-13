import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type OwnerProfile = {
  id: string;
  full_name: string | null;
  owner_approval_status: string;
  registration_business_name: string | null;
  registration_phone: string | null;
  is_suspended: boolean | null;
  created_at: string;
};

type BusinessPhoto = { storage_path: string; sort_order: number };

type OwnerBusiness = {
  id: string;
  name: string;
  address_line: string | null;
  categories: { name: string } | null;
  municipalities: { name: string } | null;
  provinces: { name: string } | null;
  barangays: { name: string } | null;
  business_photos: BusinessPhoto[] | null;
};

function formatAddress(b: OwnerBusiness): string {
  const parts = [
    b.address_line?.trim(),
    b.barangays?.name,
    b.municipalities?.name,
    b.provinces?.name,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function thumbUrl(b: OwnerBusiness): string | null {
  const photos = [...(b.business_photos ?? [])].sort(
    (a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0),
  );
  const path = photos[0]?.storage_path;
  if (!path) return null;
  return supabase.storage.from("business-images").getPublicUrl(path).data.publicUrl;
}

export function ListingsPage() {
  const [pending, setPending] = useState<OwnerProfile[]>([]);
  const [approved, setApproved] = useState<OwnerProfile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listingsByOwner, setListingsByOwner] = useState<Record<string, OwnerBusiness[]>>({});
  const [listingsLoading, setListingsLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setMsg(null);
    const base =
      "id,full_name,owner_approval_status,registration_business_name,registration_phone,is_suspended,created_at";
    const [pRes, aRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(base)
        .eq("role", "business_owner")
        .eq("owner_approval_status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select(base)
        .eq("role", "business_owner")
        .eq("owner_approval_status", "approved")
        .order("created_at", { ascending: false }),
    ]);
    if (pRes.error) {
      setMsg(pRes.error.message);
      return;
    }
    if (aRes.error) {
      setMsg(aRes.error.message);
      return;
    }
    setPending((pRes.data as OwnerProfile[]) ?? []);
    setApproved((aRes.data as OwnerProfile[]) ?? []);
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
    if (expandedId === id) setExpandedId(null);
    await load();
  };

  const setSuspended = async (id: string, suspended: boolean) => {
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ is_suspended: suspended })
      .eq("id", id)
      .eq("role", "business_owner");
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  const removeClient = async (id: string) => {
    if (
      !confirm(
        "Remove this client? Their listings will be deleted permanently and the account will be marked rejected.",
      )
    ) {
      return;
    }
    setMsg(null);
    const { error: delErr } = await supabase.from("businesses").delete().eq("owner_id", id);
    if (delErr) {
      setMsg(delErr.message);
      return;
    }
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ owner_approval_status: "rejected", is_suspended: true })
      .eq("id", id)
      .eq("role", "business_owner");
    if (upErr) {
      setMsg(upErr.message);
      return;
    }
    if (expandedId === id) setExpandedId(null);
    setListingsByOwner((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await load();
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (listingsByOwner[id] !== undefined) return;
    setListingsLoading((m) => ({ ...m, [id]: true }));
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id,name,address_line,categories(name),municipalities(name),provinces(name),barangays(name),business_photos(storage_path,sort_order)",
      )
      .eq("owner_id", id)
      .order("created_at", { ascending: false });
    setListingsLoading((m) => ({ ...m, [id]: false }));
    if (error) {
      setMsg(error.message);
      return;
    }
    setListingsByOwner((prev) => ({ ...prev, [id]: (data as OwnerBusiness[]) ?? [] }));
  };

  const renderListingPanel = (ownerId: string) => {
    if (listingsLoading[ownerId]) {
      return (
        <div className="manage-clients__panel-inner">
          <p className="manage-clients__muted">Loading listings…</p>
        </div>
      );
    }
    const rows = listingsByOwner[ownerId] ?? [];
    if (rows.length === 0) {
      return (
        <div className="manage-clients__panel-inner">
          <p className="manage-clients__muted">No listings for this client yet.</p>
        </div>
      );
    }
    return (
      <div className="manage-clients__panel-inner manage-clients__listing-grid">
        {rows.map((b) => {
          const src = thumbUrl(b);
          return (
            <div key={b.id} className="manage-clients__listing-card">
              <div className="manage-clients__listing-thumb">
                {src ? (
                  <img src={src} alt="" width={96} height={72} loading="lazy" />
                ) : (
                  <span className="manage-clients__muted">No image</span>
                )}
              </div>
              <div className="manage-clients__listing-body">
                <div className="manage-clients__listing-name">{b.name}</div>
                <div className="manage-clients__muted">{b.categories?.name ?? "—"}</div>
                <div className="manage-clients__listing-address">{formatAddress(b)}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="page page--wide">
      <header className="manage-clients__header">
        <h1>Manage clients</h1>
        <p>Approve new business owners, review their listings, and control access.</p>
      </header>
      {msg && <div className="card manage-clients__banner">{msg}</div>}

      <section className="manage-clients__section">
        <h2>Pending approval</h2>
        <p className="manage-clients__section-lead">New registrations waiting for your decision.</p>
        <div className="card manage-clients__table-wrap">
          <table className="table manage-clients__table">
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
              {pending.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.full_name?.trim() || "—"}</td>
                  <td>{r.registration_business_name ?? "—"}</td>
                  <td>{r.registration_phone ?? "—"}</td>
                  <td className="manage-clients__muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="manage-clients__actions">
                      <button type="button" className="btn btn-primary" onClick={() => void decide(r.id, "approved")}>
                        Approve
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => void decide(r.id, "rejected")}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="manage-clients__muted">
                    No pending owner accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manage-clients__section">
        <h2>Approved clients</h2>
        <p className="manage-clients__section-lead">
          Expand a name to see listings. Suspend blocks dashboard access; remove deletes listings and rejects the
          account.
        </p>
        <div className="card manage-clients__table-wrap">
          <table className="table manage-clients__table">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Client</th>
                <th>Business (registration)</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((r) => {
                const open = expandedId === r.id;
                const suspended = !!r.is_suspended;
                return (
                  <Fragment key={r.id}>
                    <tr className={open ? "manage-clients__row--open" : undefined}>
                      <td>
                        <button
                          type="button"
                          className="manage-clients__expand-btn"
                          onClick={() => void toggleExpand(r.id)}
                          aria-expanded={open}
                        >
                          <span className={`manage-clients__chevron${open ? " is-open" : ""}`} aria-hidden />
                          <span className="manage-clients__expand-label">{r.full_name?.trim() || "—"}</span>
                        </button>
                      </td>
                      <td>{r.registration_business_name ?? "—"}</td>
                      <td>{r.registration_phone ?? "—"}</td>
                      <td>
                        {suspended ? (
                          <span className="pill pending">Suspended</span>
                        ) : (
                          <span className="pill approved">Active</span>
                        )}
                      </td>
                      <td>
                        <div className="manage-clients__actions">
                          {suspended ? (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => void setSuspended(r.id, false)}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => void setSuspended(r.id, true)}
                            >
                              Suspend
                            </button>
                          )}
                          <button type="button" className="btn btn-danger" onClick={() => void removeClient(r.id)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="manage-clients__panel-row">
                        <td colSpan={5}>
                          <div className="manage-clients__panel">{renderListingPanel(r.id)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {approved.length === 0 && (
                <tr>
                  <td colSpan={5} className="manage-clients__muted">
                    No approved business owners yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
