import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientAnalyticsSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type BizRow = { id: string; name: string };

type DatePreset = "today" | "this_month" | "specific_month" | "year";

type EventRow = { business_id: string; event_type: string };

function localDayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rangeForPreset(
  preset: DatePreset,
  monthYm: string,
  yearY: number,
): { start: Date; endExclusive: Date; label: string } {
  const now = new Date();
  if (preset === "today") {
    const start = localDayStart(now);
    const endExclusive = new Date(start);
    endExclusive.setDate(endExclusive.getDate() + 1);
    return {
      start,
      endExclusive,
      label: start.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    };
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start,
      endExclusive,
      label: start.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    };
  }
  if (preset === "specific_month") {
    const [y, m] = monthYm.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const endExclusive = new Date(y, m, 1);
    return {
      start,
      endExclusive,
      label: start.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    };
  }
  const start = new Date(yearY, 0, 1);
  const endExclusive = new Date(yearY + 1, 0, 1);
  return {
    start,
    endExclusive,
    label: `${yearY}`,
  };
}

function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const cur = new Date();
  cur.setDate(1);
  for (let i = 0; i < 36; i++) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    const value = `${y}-${String(m).padStart(2, "0")}`;
    const label = new Date(y, m - 1, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
    out.push({ value, label });
    cur.setMonth(cur.getMonth() - 1);
  }
  return out;
}

function yearOptions(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => y - i);
}

function csvEscape(cell: string) {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function buildCsv(rows: { name: string; views: number; intent: number; confirmed: number }[], periodLabel: string) {
  const lines: string[] = [];
  lines.push(csvEscape("DestinaPH — listing analytics"));
  lines.push(csvEscape(`Period: ${periodLabel}`));
  lines.push("");
  lines.push(["Listing", "Views", "Visit intent", "Confirmed visits"].map(csvEscape).join(","));
  for (const r of rows) {
    lines.push([csvEscape(r.name), String(r.views), String(r.intent), String(r.confirmed)].join(","));
  }
  const tv = rows.reduce((a, r) => a + r.views, 0);
  const ti = rows.reduce((a, r) => a + r.intent, 0);
  const tc = rows.reduce((a, r) => a + r.confirmed, 0);
  lines.push("");
  lines.push(["Totals", String(tv), String(ti), String(tc)].map(csvEscape).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

export function AnalyticsPage() {
  const [pageReady, setPageReady] = useState(false);
  const [businesses, setBusinesses] = useState<BizRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [monthYm, setMonthYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [yearY, setYearY] = useState(() => new Date().getFullYear());

  const [byBiz, setByBiz] = useState<Record<string, { view: number; intent_visit: number; confirm_visit: number }>>(
    {},
  );

  const months = useMemo(() => monthOptions(), []);
  const years = useMemo(() => yearOptions(), []);

  const range = useMemo(() => rangeForPreset(preset, monthYm, yearY), [preset, monthYm, yearY]);

  const loadBusinesses = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from("businesses")
      .select("id,name")
      .eq("owner_id", uid)
      .order("name", { ascending: true });
    if (error) {
      setMsg(error.message);
      return [];
    }
    const list = (data as BizRow[]) ?? [];
    setBusinesses(list);
    return list;
  }, []);

  const loadEvents = useCallback(
    async (bizIds: string[]) => {
      if (bizIds.length === 0) {
        setByBiz({});
        return;
      }
      setMsg(null);
      const startIso = range.start.toISOString();
      const endIso = range.endExclusive.toISOString();
      const { data, error } = await supabase
        .from("business_analytics_events")
        .select("business_id, event_type")
        .in("business_id", bizIds)
        .gte("created_at", startIso)
        .lt("created_at", endIso);
      if (error) {
        setMsg(error.message);
        setByBiz({});
        return;
      }
      const next: Record<string, { view: number; intent_visit: number; confirm_visit: number }> = {};
      for (const id of bizIds) {
        next[id] = { view: 0, intent_visit: 0, confirm_visit: 0 };
      }
      for (const row of (data as EventRow[]) ?? []) {
        const b = next[row.business_id];
        if (!b) continue;
        if (row.event_type === "view") b.view += 1;
        else if (row.event_type === "intent_visit") b.intent_visit += 1;
        else if (row.event_type === "confirm_visit") b.confirm_visit += 1;
      }
      setByBiz(next);
    },
    [range.start, range.endExclusive],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadBusinesses();
      } finally {
        if (!cancelled) setPageReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBusinesses]);

  useEffect(() => {
    if (!pageReady) return;
    const ids = businesses.map((b) => b.id);
    void loadEvents(ids);
  }, [pageReady, businesses, loadEvents]);

  const tableRows = useMemo(() => {
    return businesses.map((b) => {
      const c = byBiz[b.id] ?? { view: 0, intent_visit: 0, confirm_visit: 0 };
      return {
        id: b.id,
        name: b.name,
        views: c.view,
        intent: c.intent_visit,
        confirmed: c.confirm_visit,
      };
    });
  }, [businesses, byBiz]);

  const totals = useMemo(() => {
    return tableRows.reduce(
      (a, r) => {
        a.views += r.views;
        a.intent += r.intent;
        a.confirmed += r.confirmed;
        return a;
      },
      { views: 0, intent: 0, confirmed: 0 },
    );
  }, [tableRows]);

  const onExport = () => {
    const csv = buildCsv(
      tableRows.map((r) => ({ name: r.name, views: r.views, intent: r.intent, confirmed: r.confirmed })),
      range.label,
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `destinaph-analytics-${range.start.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!pageReady) {
    return <ClientAnalyticsSkeleton />;
  }

  const quiet = totals.views === 0 && totals.intent === 0 && totals.confirmed === 0;

  return (
    <div className="page page--flush-top page-stack owner-analytics">
      <div className="owner-analytics__hero">
        <p className="owner-analytics__eyebrow">Performance</p>
        <h1 className="owner-analytics__title">Analytics</h1>
        <p className="owner-analytics__lead">
          Views, visit intent (listing taps from the app), and confirmed visits (when you confirm a booking) — per
          listing, for the period you choose. Export to CSV for spreadsheets.
        </p>
      </div>

      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}

      <div className="owner-analytics__toolbar">
        <div className="owner-analytics__filters" role="group" aria-label="Date range">
          <span className="owner-analytics__filter-label">Period</span>
          <div className="owner-analytics__preset-row">
            <button type="button" className={preset === "today" ? "active" : ""} onClick={() => setPreset("today")}>
              Today
            </button>
            <button
              type="button"
              className={preset === "this_month" ? "active" : ""}
              onClick={() => setPreset("this_month")}
            >
              This month
            </button>
            <button
              type="button"
              className={preset === "specific_month" ? "active" : ""}
              onClick={() => setPreset("specific_month")}
            >
              Month
            </button>
            <button type="button" className={preset === "year" ? "active" : ""} onClick={() => setPreset("year")}>
              Year
            </button>
          </div>
          {preset === "specific_month" && (
            <label className="owner-analytics__select-wrap">
              <span className="visually-hidden">Choose month</span>
              <select
                className="owner-analytics__select"
                value={monthYm}
                onChange={(e) => setMonthYm(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {preset === "year" && (
            <label className="owner-analytics__select-wrap">
              <span className="visually-hidden">Choose year</span>
              <select
                className="owner-analytics__select"
                value={String(yearY)}
                onChange={(e) => setYearY(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="owner-analytics__toolbar-meta">
          <span className="owner-analytics__range-pill">{range.label}</span>
          <button type="button" className="btn btn-outline owner-analytics__export" onClick={onExport}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="stat-grid owner-analytics__stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total views</div>
          <div className="stat-card__value">{totals.views.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Visit intent</div>
          <div className="stat-card__value">{totals.intent.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Confirmed visits</div>
          <div className="stat-card__value">{totals.confirmed.toLocaleString()}</div>
        </div>
      </div>

      <div className="owner-analytics__table-wrap">
        <table className="owner-analytics__table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Views</th>
              <th>Visit intent</th>
              <th>Confirmed visits</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="owner-analytics__listing-name">{r.name}</span>
                </td>
                <td>{r.views.toLocaleString()}</td>
                <td>{r.intent.toLocaleString()}</td>
                <td>{r.confirmed.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          {tableRows.length > 0 && (
            <tfoot>
              <tr>
                <td>Totals</td>
                <td>{totals.views.toLocaleString()}</td>
                <td>{totals.intent.toLocaleString()}</td>
                <td>{totals.confirmed.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {quiet && (
        <div className="empty-state empty-state--compact owner-analytics__empty">
          <div className="empty-state__icon" aria-hidden>
            📈
          </div>
          <p className="empty-state__title">No events in this period</p>
          <p className="empty-state__text">
            When travelers open your listings or you confirm reservations, counts appear here. Try a wider date range
            or keep growing visibility in the app.
          </p>
        </div>
      )}
    </div>
  );
}
