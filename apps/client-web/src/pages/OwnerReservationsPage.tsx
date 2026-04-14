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
  const [loading, setLoading] = useState(false);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofState, setProofState] = useState<Record<string, "idle" | "loading" | "ready" | "missing">>({});
  const [proofModal, setProofModal] = useState<{ open: boolean; url: string; title: string } | null>(null);
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
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data: myBiz, error: bizErr } = await supabase.from("businesses").select("id").eq("owner_id", uid);
    if (bizErr) {
      setMsg(bizErr.message);
      setLoading(false);
      return;
    }
    const bizIds = (myBiz ?? []).map((b: { id: string }) => b.id);
    if (bizIds.length === 0) {
      setRows([]);
      setProofUrls({});
      setLoading(false);
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
      setLoading(false);
      return;
    }
    const list = (data as unknown as Row[]) ?? [];
    setRows(list);
    // Proof URLs are generated on demand (click) to avoid noisy 400s
    // when legacy rows point to missing objects.
    setProofUrls({});
    setProofState({});
    setLoading(false);
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

    // Safety: don't allow confirming a booking if the proof object is missing.
    if (status === "confirmed") {
      const row = rows.find((r) => r.id === id);
      if (row?.payment_proof_storage_path) {
        const url = await ensureProofUrl(row);
        if (!url) {
          setBusyId(null);
          setMsg("Payment proof not found. Ask the traveler to re-upload their proof before confirming.");
          return;
        }
      }
    }

    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  const ensureProofUrl = async (r: Row, opts?: { silent?: boolean }): Promise<string | null> => {
    const p = (r.payment_proof_storage_path ?? "").trim();
    if (!p) return null;

    // Backward-compatible: some older rows may have stored a full URL instead of a storage path.
    if (p.startsWith("http://") || p.startsWith("https://")) {
      setProofState((prev) => ({ ...prev, [r.id]: "ready" }));
      setProofUrls((prev) => ({ ...prev, [r.id]: p }));
      return p;
    }

    if (proofUrls[r.id]) return proofUrls[r.id];
    if (proofState[r.id] === "loading" || proofState[r.id] === "missing") return null;
    setProofState((prev) => ({ ...prev, [r.id]: "loading" }));

    const { data: signed, error: signErr } = await supabase.storage
      .from("booking-payment-proofs")
      .createSignedUrl(p, 3600);
    if (signErr || !signed?.signedUrl) {
      // Supabase Storage returns "Object not found" for missing objects (and sometimes for denied access).
      // Treat it as missing and avoid retry spam.
      setProofState((prev) => ({ ...prev, [r.id]: "missing" }));
      if (!opts?.silent) setMsg(signErr?.message ?? "Could not open payment proof.");
      return null;
    }

    setProofUrls((prev) => ({ ...prev, [r.id]: signed.signedUrl }));
    setProofState((prev) => ({ ...prev, [r.id]: "ready" }));
    return signed.signedUrl;
  };

  const openProof = async (r: Row) => {
    const url = await ensureProofUrl(r);
    if (!url) return;
    const title = `${r.businesses?.name ?? "Reservation"} · ${r.payment_method?.toUpperCase?.() ?? "Payment proof"}`;
    setProofModal({ open: true, url, title });
  };

  useEffect(() => {
    if (!proofModal?.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProofModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proofModal?.open]);

  // Prefetch proof previews for visible rows (avoids extra clicks).
  useEffect(() => {
    const list = filtered.filter((r) => Boolean(r.payment_proof_storage_path));
    if (!list.length) return;
    const toFetch = list
      .filter((r) => !proofUrls[r.id] && proofState[r.id] !== "loading" && proofState[r.id] !== "missing")
      .slice(0, 12);
    if (!toFetch.length) return;
    void Promise.all(toFetch.map((r) => ensureProofUrl(r, { silent: true })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, filtered.length]);

  return (
    <div className="page page--wide owner-reservations">
      {proofModal?.open ? (
        <div
          className="proof-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Payment proof preview"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProofModal(null);
          }}
        >
          <div className="proof-modal__panel">
            <div className="proof-modal__header">
              <div className="proof-modal__title">{proofModal.title}</div>
              <button type="button" className="proof-modal__close" onClick={() => setProofModal(null)}>
                Close
              </button>
            </div>
            <a className="proof-modal__imageWrap" href={proofModal.url} target="_blank" rel="noreferrer" title="Open original">
              <img className="proof-modal__img" src={proofModal.url} alt="Payment proof" />
            </a>
            <div className="proof-modal__hint">Tip: click image to open original in new tab.</div>
          </div>
        </div>
      ) : null}
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

      {loading ? (
        <div className="owner-reservations-loading">
          <div className="owner-reservations-loading__card" />
          <div className="owner-reservations-loading__row" />
          <div className="owner-reservations-loading__row" />
        </div>
      ) : rows.length === 0 ? (
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
                    {r.payment_proof_storage_path ? (
                      <div className="owner-reservations__proof">
                        {proofUrls[r.id] ? (
                          <a
                            className="owner-reservations__proof-thumb"
                            href={proofUrls[r.id]}
                            target="_blank"
                            rel="noreferrer"
                            title="Open proof"
                            onClick={() => {
                              if (needsHostAction(r.status) && !readIds.has(r.id)) {
                                const next = new Set(readIds);
                                next.add(r.id);
                                persistReadIds(next);
                              }
                            }}
                          >
                            <img src={proofUrls[r.id]} alt="Payment proof" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            className={`owner-reservations__proof-thumb owner-reservations__proof-thumb--ph${proofState[r.id] === "missing" ? " is-missing" : ""}`}
                            disabled={proofState[r.id] === "missing"}
                            title={proofState[r.id] === "missing" ? "Proof missing" : "Load preview"}
                            onClick={() => {
                              if (needsHostAction(r.status) && !readIds.has(r.id)) {
                                const next = new Set(readIds);
                                next.add(r.id);
                                persistReadIds(next);
                              }
                              void openProof(r);
                            }}
                          >
                            {proofState[r.id] === "missing" ? "Missing" : "Preview"}
                          </button>
                        )}
                        {proofState[r.id] === "loading" ? (
                          <span className="owner-reservations__cell-note">Loading…</span>
                        ) : null}
                      </div>
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
