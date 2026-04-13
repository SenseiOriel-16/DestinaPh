import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Row = {
  id: string;
  status: string;
  requested_at: string;
  accommodation_name: string | null;
  check_in: string | null;
  check_out: string | null;
  guest_count: number | null;
  estimated_total_pesos: number | null;
  downpayment_pesos: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_proof_storage_path: string | null;
  notes: string | null;
  businesses: { name: string } | null;
};

function peso(n: number | null | undefined) {
  if (n == null) return "—";
  return `\u20B1${n.toLocaleString("en-PH")}`;
}

function needsHostAction(status: string) {
  return status === "pending_review" || status === "requested";
}

export function OwnerReservationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "needs_review" | "confirmed" | "cancelled">("needs_review");
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("ownerReservations.readIds.v1");
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  });

  const persistReadIds = (next: Set<string>) => {
    setReadIds(next);
    try {
      localStorage.setItem("ownerReservations.readIds.v1", JSON.stringify(Array.from(next).slice(-2000)));
    } catch {
      // ignore quota/blocked storage
    }
  };

  const load = useCallback(async () => {
    setMsg(null);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { data: myBiz, error: bizErr } = await supabase.from("businesses").select("id").eq("owner_id", uid);
    if (bizErr) {
      setMsg(bizErr.message);
      return;
    }
    const bizIds = (myBiz ?? []).map((b: { id: string }) => b.id);
    if (bizIds.length === 0) {
      setRows([]);
      setProofUrls({});
      return;
    }
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,status,requested_at,accommodation_name,check_in,check_out,guest_count,estimated_total_pesos,downpayment_pesos,payment_method,payment_reference,payment_proof_storage_path,notes,business_id,businesses(name)",
      )
      .in("business_id", bizIds)
      .order("requested_at", { ascending: false });
    if (error) {
      setMsg(error.message);
      return;
    }
    const list = (data as unknown as Row[]) ?? [];
    setRows(list);
    const next: Record<string, string> = {};
    for (const r of list) {
      const p = r.payment_proof_storage_path;
      if (!p) continue;
      const { data: signed } = await supabase.storage.from("booking-payment-proofs").createSignedUrl(p, 3600);
      if (signed?.signedUrl) next[r.id] = signed.signedUrl;
    }
    setProofUrls(next);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Mark currently loaded "needs action" bookings as read once the page has rendered the list.
  useEffect(() => {
    if (!rows.length) return;
    const next = new Set(readIds);
    let changed = false;
    for (const r of rows) {
      if (!needsHostAction(r.status)) continue;
      if (!next.has(r.id)) {
        next.add(r.id);
        changed = true;
      }
    }
    if (changed) persistReadIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const pendingHostCount = useMemo(
    () => rows.filter((r) => needsHostAction(r.status)).length,
    [rows],
  );

  const unreadCount = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      if (!needsHostAction(r.status)) continue;
      if (!readIds.has(r.id)) n++;
    }
    return n;
  }, [rows, readIds]);

  const filtered = useMemo(() => {
    if (filter === "needs_review") return rows.filter((r) => needsHostAction(r.status));
    if (filter === "confirmed") return rows.filter((r) => r.status === "confirmed");
    if (filter === "cancelled") return rows.filter((r) => r.status === "cancelled");
    return rows;
  }, [rows, filter]);

  const markAllRead = () => {
    const next = new Set(readIds);
    for (const r of rows) {
      if (!needsHostAction(r.status)) continue;
      next.add(r.id);
    }
    persistReadIds(next);
  };

  const setStatus = async (id: string, status: "confirmed" | "cancelled") => {
    if (status === "cancelled" && !confirm("Reject this reservation?")) return;
    setBusyId(id);
    setMsg(null);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  return (
    <div className="page page--wide owner-reservations">
      <header className="owner-reservations__hero">
        <div className="owner-reservations__hero-text">
          <p className="owner-reservations__eyebrow">Bookings</p>
          <h1 className="owner-reservations__title">Reservations</h1>
          <p className="owner-reservations__lead">
            Review traveler requests with payment proof and reference. Confirm when the 50% down payment matches your
            expectations — or decline if something does not look right.
          </p>
          {rows.length > 0 ? (
            <div className="owner-reservations__stats">
              <span className="owner-reservations__stat">
                Total <span className="owner-reservations__stat-num">{rows.length}</span>
              </span>
              {pendingHostCount > 0 ? (
                <span className="owner-reservations__stat">
                  Awaiting you <span className="owner-reservations__stat-num">{pendingHostCount}</span>
                </span>
              ) : null}
              {unreadCount > 0 ? (
                <span className="owner-reservations__stat">
                  New <span className="owner-reservations__stat-num">{unreadCount}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="owner-reservations__hero-art" aria-hidden />
      </header>

      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}

      {rows.length === 0 ? (
        <div className="owner-reservations-empty">
          <div className="owner-reservations-empty__icon" aria-hidden>
            {"\u{1F4C5}"}
          </div>
          <h2 className="owner-reservations-empty__title">No reservations yet</h2>
          <p className="owner-reservations-empty__text">
            When travelers reserve a <strong>Premium</strong> listing from the app, their stay details, payment method,
            and proof appear here for you to confirm or decline.
          </p>
          <div className="owner-reservations-empty__actions">
            <Link className="owner-reservations-empty__btn owner-reservations-empty__btn--primary" to="/upgrade">
              Upgrade a listing to Premium
            </Link>
            <Link className="owner-reservations-empty__btn owner-reservations-empty__btn--ghost" to="/listings">
              Manage listings
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="owner-reservations__toolbar">
            <div className="owner-reservations__filters" role="tablist" aria-label="Reservation filters">
              <button
                type="button"
                className={`owner-reservations__tab${filter === "needs_review" ? " is-active" : ""}`}
                onClick={() => setFilter("needs_review")}
              >
                Needs review
              </button>
              <button
                type="button"
                className={`owner-reservations__tab${filter === "all" ? " is-active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`owner-reservations__tab${filter === "confirmed" ? " is-active" : ""}`}
                onClick={() => setFilter("confirmed")}
              >
                Confirmed
              </button>
              <button
                type="button"
                className={`owner-reservations__tab${filter === "cancelled" ? " is-active" : ""}`}
                onClick={() => setFilter("cancelled")}
              >
                Cancelled
              </button>
            </div>
            <div className="owner-reservations__toolbar-actions">
              <button type="button" className="btn btn-ghost btn-inline" onClick={markAllRead} disabled={unreadCount === 0}>
                Mark all as read
              </button>
            </div>
          </div>

          <div className="owner-reservations__table-wrap">
          <table className="owner-reservations__table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Stay</th>
                <th>Guest / room</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isUnread = needsHostAction(r.status) && !readIds.has(r.id);
                return (
                <tr key={r.id} className={isUnread ? "owner-reservations__row--unread" : undefined}>
                  <td className="owner-reservations__cell-title">{r.businesses?.name ?? "—"}</td>
                  <td>
                    <div className="owner-reservations__cell-muted">
                      {r.check_in && r.check_out ? `${r.check_in} → ${r.check_out}` : "—"}
                    </div>
                    <div className="owner-reservations__cell-note">
                      Est. {peso(r.estimated_total_pesos)} · Down {peso(r.downpayment_pesos)}
                    </div>
                  </td>
                  <td>
                    <div className="owner-reservations__cell-muted">{r.guest_count ?? "—"} guests</div>
                    <div className="owner-reservations__cell-note">{r.accommodation_name ?? "—"}</div>
                  </td>
                  <td>
                    <div className="owner-reservations__cell-muted">{(r.payment_method ?? "—").toUpperCase()}</div>
                    <div className="owner-reservations__cell-note" style={{ wordBreak: "break-all" }}>
                      {r.payment_reference ?? "—"}
                    </div>
                  </td>
                  <td>
                    {r.status === "pending_review" || r.status === "requested" ? (
                      <span className="pill pending">{r.status === "requested" ? "Simple request" : "Review"}</span>
                    ) : r.status === "confirmed" ? (
                      <span className="pill approved">Confirmed</span>
                    ) : r.status === "cancelled" ? (
                      <span className="pill rejected">Rejected</span>
                    ) : (
                      <span className="pill pending">{r.status}</span>
                    )}
                  </td>
                  <td>
                    {proofUrls[r.id] ? (
                      <a
                        className="owner-reservations__proof-link"
                        href={proofUrls[r.id]}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (!needsHostAction(r.status)) return;
                          if (readIds.has(r.id)) return;
                          const next = new Set(readIds);
                          next.add(r.id);
                          persistReadIds(next);
                        }}
                      >
                        View proof
                      </a>
                    ) : (
                      <span className="owner-reservations__cell-note">—</span>
                    )}
                  </td>
                  <td>
                    {needsHostAction(r.status) ? (
                      <div className="owner-reservations__actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyId === r.id}
                          onClick={() => void setStatus(r.id, "confirmed")}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyId === r.id}
                          onClick={() => void setStatus(r.id, "cancelled")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="owner-reservations__cell-note">—</span>
                    )}
                  </td>
                </tr>
              );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="owner-reservations__cell-note">
                    No reservations in this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </>
      )}

      <Link className="owner-reservations__back" to="/listings">
        <span aria-hidden>{"\u2190"}</span> Back to listings
      </Link>
    </div>
  );
}
