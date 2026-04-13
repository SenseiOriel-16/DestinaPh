import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminManageClientsSkeleton } from "../components/PageSkeletons";
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [pending, setPending] = useState<OwnerProfile[]>([]);
  const [approved, setApproved] = useState<OwnerProfile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [listingsByOwner, setListingsByOwner] = useState<Record<string, OwnerBusiness[]>>({});
  const [listingsLoading, setListingsLoading] = useState<Record<string, boolean>>({});
  /** Resolved emails from auth (key missing = not fetched yet). */
  const [ownerEmails, setOwnerEmails] = useState<Record<string, string | null>>({});
  const ownerEmailRequested = useRef<Set<string>>(new Set());
  const pendingRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    try {
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
    } finally {
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const totalClients = pending.length + approved.length;
    const pendingCount = pending.length;
    const approvedCount = approved.length;
    return { totalClients, pendingCount, approvedCount };
  }, [pending.length, approved.length]);

  const filteredApproved = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = approved.filter((r) => {
      if (statusFilter === "active" && r.is_suspended) return false;
      if (statusFilter === "suspended" && !r.is_suspended) return false;
      if (!needle) return true;
      const full = (r.full_name ?? "").toLowerCase();
      const biz = (r.registration_business_name ?? "").toLowerCase();
      return full.includes(needle) || biz.includes(needle);
    });
    return base;
  }, [approved, q, statusFilter]);

  const approvePending = async (id: string) => {
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
    if (expandedId === id) setExpandedId(null);
    await load();
  };

  const declinePending = async (id: string) => {
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
    if (expandedId === id) setExpandedId(null);
    setListingsByOwner((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setOwnerEmails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    ownerEmailRequested.current.delete(id);
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
    setOwnerEmails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    ownerEmailRequested.current.delete(id);
    await load();
  };

  const loadOwnerEmail = async (id: string) => {
    if (ownerEmailRequested.current.has(id)) return;
    ownerEmailRequested.current.add(id);
    const { data, error } = await supabase.rpc("admin_profile_email", { p_profile_id: id });
    if (error) {
      ownerEmailRequested.current.delete(id);
      setMsg(error.message);
      setOwnerEmails((prev) => ({ ...prev, [id]: null }));
      return;
    }
    setOwnerEmails((prev) => ({ ...prev, [id]: (data as string | null) ?? null }));
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    void loadOwnerEmail(id);
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

  const renderListingPanel = (owner: OwnerProfile) => {
    const ownerId = owner.id;
    const emailVal = ownerEmails[ownerId];
    const phoneVal = owner.registration_phone?.trim() || null;
    const contactBlock = (
      <div className="manage-clients__contact">
        <div className="manage-clients__contact-row">
          <span className="manage-clients__contact-label">Email</span>
          <span className="manage-clients__contact-value">
            {emailVal === undefined ? "Loading…" : emailVal || "—"}
          </span>
        </div>
        <div className="manage-clients__contact-row">
          <span className="manage-clients__contact-label">Phone</span>
          <span className="manage-clients__contact-value">{phoneVal || "—"}</span>
        </div>
      </div>
    );

    if (listingsLoading[ownerId]) {
      return (
        <div className="manage-clients__panel-inner">
          {contactBlock}
          <div className="sk-mini-grid manage-clients__contact-after" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sk-mini-card" />
            ))}
          </div>
        </div>
      );
    }
    const rows = listingsByOwner[ownerId] ?? [];
    if (rows.length === 0) {
      return (
        <div className="manage-clients__panel-inner">
          {contactBlock}
          <p className="manage-clients__muted manage-clients__contact-after">No listings for this client yet.</p>
        </div>
      );
    }
    return (
      <div className="manage-clients__panel-inner">
        {contactBlock}
        <div className="manage-clients__listing-grid">
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
      </div>
    );
  };

  if (initialLoad) {
    return <AdminManageClientsSkeleton />;
  }

  return (
    <div className="page page--wide admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact manage-clients__page-hero">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Directory</p>
          <h1 className="dash-title admin-page-hero__title">Manage clients</h1>
          <p className="dash-sub admin-page-hero__sub">
            Approve new business owners, review their listings, and control access.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--dash" aria-hidden />
      </header>
      {msg && <div className="alert-banner alert-banner--error manage-clients__banner">{msg}</div>}

      <section className="stat-grid manage-clients__stats" aria-label="Client stats">
        <div className="stat-card">
          <div className="stat-card__row">
            <div>
              <div className="stat-card__label">Total Clients</div>
              <div className="stat-card__value">{totals.totalClients}</div>
            </div>
            <div className="stat-card__icon" style={{ background: "rgba(8, 143, 143, 0.12)", color: "var(--admin-teal)" }} aria-hidden>
              👥
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__row">
            <div>
              <div className="stat-card__label">Pending Approval</div>
              <div className="stat-card__value">{totals.pendingCount}</div>
            </div>
            <div className="stat-card__icon" style={{ background: "rgba(255, 183, 3, 0.18)", color: "#9a6b00" }} aria-hidden>
              ⏳
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__row">
            <div>
              <div className="stat-card__label">Approved Clients</div>
              <div className="stat-card__value">{totals.approvedCount}</div>
            </div>
            <div className="stat-card__icon" style={{ background: "rgba(34, 197, 94, 0.14)", color: "#15803d" }} aria-hidden>
              🛡️
            </div>
          </div>
        </div>
      </section>

      <section className="manage-clients__section" ref={pendingRef as unknown as React.RefObject<HTMLElement>}>
        <div className="manage-clients__section-head">
          <div>
            <h2>Pending approval</h2>
            <p className="manage-clients__section-lead">New registrations waiting for your decision.</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost manage-clients__head-action"
            onClick={() => pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            View all pending
          </button>
        </div>
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
                  <td>
                    <div className="manage-clients__client-cell">
                      <span className="manage-clients__avatar" aria-hidden>
                        {(r.full_name?.trim()?.[0] || "—").toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 700 }}>{r.full_name?.trim() || "—"}</span>
                    </div>
                  </td>
                  <td>{r.registration_business_name ?? "—"}</td>
                  <td>{r.registration_phone ?? "—"}</td>
                  <td className="manage-clients__muted">{new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    <div className="manage-clients__actions">
                      <button type="button" className="btn btn-ghost manage-clients__btn-approve" onClick={() => void approvePending(r.id)}>
                        ✓ Approve
                      </button>
                      <button type="button" className="btn btn-ghost manage-clients__btn-reject" onClick={() => void declinePending(r.id)}>
                        ✕ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty manage-clients__muted">
                    No pending owner accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manage-clients__section">
        <div className="manage-clients__section-head">
          <div>
            <h2>Approved clients</h2>
            <p className="manage-clients__section-lead">
              Expand a client to see their email, phone, and listings. Suspend blocks dashboard access; remove deletes
              listings and rejects the account.
            </p>
          </div>
          <div className="manage-clients__tools" role="search">
            <label className="manage-clients__search">
              <span className="manage-clients__search-icon" aria-hidden>
                🔍
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search clients..."
                aria-label="Search clients"
              />
            </label>
            <label className="manage-clients__filters">
              <span className="manage-clients__filters-icon" aria-hidden>
                ⏷
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "suspended")}
                aria-label="Filter by status"
              >
                <option value="all">Filters</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          </div>
        </div>
        <div className="card manage-clients__table-wrap">
          <table className="table manage-clients__table">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Client</th>
                <th>Business (registration)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApproved.map((r) => {
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
                          <span className="manage-clients__avatar manage-clients__avatar--sm" aria-hidden>
                            {(r.full_name?.trim()?.[0] || "—").toUpperCase()}
                          </span>
                          <span className="manage-clients__expand-label">{r.full_name?.trim() || "—"}</span>
                        </button>
                      </td>
                      <td>{r.registration_business_name ?? "—"}</td>
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
                              className="btn btn-ghost manage-clients__btn-approve"
                              onClick={() => void setSuspended(r.id, false)}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost manage-clients__btn-outline"
                              onClick={() => void setSuspended(r.id, true)}
                            >
                              Suspend
                            </button>
                          )}
                          <button type="button" className="btn btn-ghost manage-clients__btn-reject" onClick={() => void removeClient(r.id)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="manage-clients__panel-row">
                        <td colSpan={4}>
                          <div className="manage-clients__panel">{renderListingPanel(r)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filteredApproved.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty manage-clients__muted">
                    No clients match your search.
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
