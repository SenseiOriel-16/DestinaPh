import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const RESERVATIONS_REFRESH_EVENT = "destinaph-owner-reservations-refresh";

type BusinessLite = {
  name: string | null;
  categories?: { slug: string; name: string } | null;
};

type Row = {
  id: string;
  status: string;
  requested_at: string;
  accommodation_name: string | null;
  check_in: string | null;
  check_out: string | null;
  arrival_time: string | null;
  guest_count: number | null;
  estimated_total_pesos: number | null;
  downpayment_pesos: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_proof_storage_path: string | null;
  notes: string | null;
  owner_note: string | null;
  businesses: BusinessLite | null;
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
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filter, setFilter] = useState<"all" | "needs_review" | "confirmed" | "cancelled">("needs_review");
  const [category, setCategory] = useState<"all" | "food-dining" | "resorts-leisure" | "nature-adventure">("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bizIds, setBizIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("ownerReservations.readIds.v1");
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    // Clear booking notifications when user opens Reservations page.
    window.dispatchEvent(new Event("destinaph-owner-notifs-clear-bookings"));
  }, []);

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
    setBizIds(bizIds);
    if (bizIds.length === 0) {
      setRows([]);
      setProofUrls({});
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,status,requested_at,accommodation_name,check_in,check_out,arrival_time,guest_count,estimated_total_pesos,downpayment_pesos,payment_method,payment_reference,payment_proof_storage_path,notes,owner_note,business_id,businesses(name,categories(slug,name))",
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

  useEffect(() => {
    // Refresh the table when notification hook detects new bookings (works even if Realtime is flaky).
    let t: number | null = null;
    const onRefresh = () => {
      if (t != null) window.clearTimeout(t);
      t = window.setTimeout(() => void load(), 250);
    };
    window.addEventListener(RESERVATIONS_REFRESH_EVENT, onRefresh as EventListener);
    return () => {
      if (t != null) window.clearTimeout(t);
      window.removeEventListener(RESERVATIONS_REFRESH_EVENT, onRefresh as EventListener);
    };
  }, [load]);

  useEffect(() => {
    if (!bizIds.length) return;

    let t: number | null = null;
    const scheduleReload = () => {
      if (t != null) window.clearTimeout(t);
      t = window.setTimeout(() => void load(), 400);
    };

    const filterStr = `business_id=in.(${bizIds.join(",")})`;
    const channel = supabase
      .channel("destinaph-owner-reservations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings", filter: filterStr }, () => {
        scheduleReload();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: filterStr }, () => {
        scheduleReload();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "bookings", filter: filterStr }, () => {
        scheduleReload();
      })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "[reservations] Realtime channel issue — enable Replication for bookings in Supabase. The page still loads on refresh.",
            err,
          );
        }
      });

    return () => {
      if (t != null) window.clearTimeout(t);
      void supabase.removeChannel(channel);
    };
  }, [bizIds, load]);

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
    const base =
      filter === "needs_review"
        ? rows.filter((r) => needsHostAction(r.status))
        : filter === "confirmed"
          ? rows.filter((r) => r.status === "confirmed")
          : filter === "cancelled"
            ? rows.filter((r) => r.status === "cancelled")
            : rows;
    if (category === "all") return base;
    return base.filter((r) => (r.businesses?.categories?.slug ?? "") === category);
  }, [rows, filter, category]);

  useEffect(() => {
    if (filter !== "confirmed" && filter !== "cancelled") {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  }, [filter]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canDeleteCompleted = (r: Row): boolean => {
    if (r.status !== "confirmed" && r.status !== "cancelled") return false;
    const cat = (r.businesses?.categories?.slug ?? "").trim();
    const isResort = cat === "resorts-leisure";
    const tToday = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    const startMs = (s: string | null | undefined) => {
      const raw = (s ?? "").trim();
      if (!raw) return null;
      const t = new Date(raw).getTime();
      if (Number.isNaN(t)) return null;
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const tIn = startMs(r.check_in);
    const tOut = startMs(r.check_out);
    if (isResort) return (tOut ?? tIn) != null && (tOut ?? tIn)! < tToday;
    return tIn != null && tIn < tToday;
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const map = new Map(rows.map((r) => [r.id, r] as const));
    const sel = ids.map((id) => map.get(id)).filter((x): x is Row => Boolean(x));
    const blocked = sel.filter((r) => !canDeleteCompleted(r));
    if (blocked.length) {
      setMsg("Some selected reservations cannot be deleted because their visit date is not completed yet.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${ids.length} reservation(s)? This cannot be undone.`)) return;
    const { error } = await supabase.from("bookings").delete().in("id", ids);
    if (error) {
      setMsg(error.message);
      return;
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    await load();
  };

  const setStatus = async (id: string, status: "confirmed" | "cancelled") => {
    if (status === "cancelled") {
      const r = rows.find((x) => x.id === id);
      setRejectReason((r?.owner_note ?? "").trim());
      setRejectModal({
        open: true,
        id,
        title: `${r?.businesses?.name ?? "Reservation"} · Reject reservation`,
      });
      return;
    }
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

  const submitReject = async () => {
    const rm = rejectModal;
    if (!rm?.open) return;
    const id = rm.id;
    setBusyId(id);
    setMsg(null);
    const note = rejectReason.trim();
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", owner_note: note ? note : null })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    setRejectModal(null);
    setRejectReason("");
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
      {rejectModal?.open ? (
        <div
          className="proof-modal reject-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Reject reservation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRejectModal(null);
          }}
        >
          <div className="proof-modal__panel reject-modal__panel">
            <div className="proof-modal__header reject-modal__header">
              <div className="proof-modal__title reject-modal__title">{rejectModal.title}</div>
              <button
                type="button"
                className="proof-modal__close reject-modal__close"
                onClick={() => setRejectModal(null)}
                disabled={busyId === rejectModal.id}
              >
                Close
              </button>
            </div>
            <div className="field reject-modal__body">
              <label htmlFor="reject-reason" className="reject-modal__label">
                Reason (shown to traveler)
              </label>
              <textarea
                id="reject-reason"
                className="input reject-modal__textarea"
                rows={5}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Fully booked for those dates, please choose another day."
              />
            </div>
            <div className="reject-modal__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRejectModal(null)}
                disabled={busyId === rejectModal.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void submitReject()}
                disabled={busyId === rejectModal.id}
              >
                {busyId === rejectModal.id ? "Rejecting…" : "Reject reservation"}
              </button>
            </div>
            <div className="proof-modal__hint reject-modal__hint">
              This will update the traveler&apos;s booking status in real time.
            </div>
          </div>
        </div>
      ) : null}
      <header className="owner-reservations__hero">
        <div className="owner-reservations__hero-text">
          <p className="owner-reservations__eyebrow">Bookings</p>
          <h1 className="owner-reservations__title">Reservations</h1>
          <p className="owner-reservations__lead">
            Review traveler reservation requests: stay details and optional payment proof when travelers pay online.
            Confirm when everything looks right, or decline if you cannot accommodate the booking. Manage your receiving
            GCash, Maya, and PayPal details in{" "}
            <Link className="owner-reservations__inline-link" to="/settings/e-wallet">
              Settings → E-Wallet
            </Link>
            .
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
            When travelers request a reservation from the DestinaPH app, their stay details (and payment proof when
            they pay online) appear here for you to confirm or decline.
          </p>
          <div className="owner-reservations-empty__actions">
            <Link className="owner-reservations-empty__btn owner-reservations-empty__btn--primary" to="/listings">
              Manage listings
            </Link>
            <Link className="owner-reservations-empty__btn owner-reservations-empty__btn--ghost" to="/">
              Back to dashboard
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
            <div className="owner-reservations__filters" role="tablist" aria-label="Category filters">
              <button
                type="button"
                className={`owner-reservations__tab${category === "all" ? " is-active" : ""}`}
                onClick={() => setCategory("all")}
              >
                All categories
              </button>
              <button
                type="button"
                className={`owner-reservations__tab${category === "food-dining" ? " is-active" : ""}`}
                onClick={() => setCategory("food-dining")}
              >
                Food
              </button>
              <button
                type="button"
                className={`owner-reservations__tab${category === "resorts-leisure" ? " is-active" : ""}`}
                onClick={() => setCategory("resorts-leisure")}
              >
                Resort
              </button>
              <button
                type="button"
                className={`owner-reservations__tab${category === "nature-adventure" ? " is-active" : ""}`}
                onClick={() => setCategory("nature-adventure")}
              >
                Nature
              </button>
            </div>
          </div>

          {(filter === "confirmed" || filter === "cancelled") ? (
            <div className="owner-reservations__toolbar" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setSelectMode((v) => !v);
                    setSelectedIds(new Set());
                  }}
                >
                  {selectMode ? "Done" : "Select"}
                </button>
                {selectMode ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={selectedIds.size === 0}
                    onClick={() => void deleteSelected()}
                    title="Delete selected"
                  >
                    🗑 Delete{selectedIds.size ? ` (${selectedIds.size})` : ""}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="owner-reservations__table-wrap">
          <table className="owner-reservations__table">
            <thead>
              <tr>
                {selectMode ? <th aria-label="Select" /> : null}
                <th>Property</th>
                <th>Visit date</th>
                <th>Visit time</th>
                <th>Requested</th>
                <th>Payment method</th>
                <th>Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isUnread = needsHostAction(r.status) && !readIds.has(r.id);
                return (
                <tr key={r.id} className={isUnread ? "owner-reservations__row--unread" : undefined}>
                  {selectMode ? (
                    <td data-label="Select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        disabled={!canDeleteCompleted(r)}
                        title={!canDeleteCompleted(r) ? "Cannot delete until completed" : "Select"}
                      />
                    </td>
                  ) : null}
                  <td className="owner-reservations__cell-title" data-label="Property">
                    {r.businesses?.name ?? "—"}
                  </td>
                  <td data-label="Visit date">
                    <div className="owner-reservations__cell-muted">{r.check_in ?? "—"}</div>
                    <div className="owner-reservations__cell-note">Guests: {r.guest_count ?? "—"}</div>
                  </td>
                  <td data-label="Visit time">
                    <div className="owner-reservations__cell-muted">{r.arrival_time ?? "—"}</div>
                    <div className="owner-reservations__cell-note">
                      Est. {peso(r.estimated_total_pesos)} · Down {peso(r.downpayment_pesos)}
                    </div>
                  </td>
                  <td data-label="Requested">
                    <div className="owner-reservations__cell-muted">
                      {new Date(r.requested_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </td>
                  <td data-label="Payment method">
                    <div className="owner-reservations__cell-muted">{(r.payment_method ?? "—").toUpperCase()}</div>
                    <div className="owner-reservations__cell-note" style={{ wordBreak: "break-all" }}>
                      {r.payment_reference ?? "—"}
                    </div>
                  </td>
                  <td data-label="Proof">
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
                  <td data-label="Actions">
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
                  <td colSpan={selectMode ? 8 : 7} className="owner-reservations__cell-note">
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
