import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminReportsSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type DatePreset = "today" | "this_month" | "specific_month" | "year";

type DestRow = {
  business_id: string;
  business_name: string;
  category_name: string;
  municipality_name: string;
  views: number;
  intent_visits: number;
  confirm_visits: number;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function monthInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(base: Date, days: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

function rangeForPreset(
  preset: DatePreset,
  specificMonth: string,
  year: number,
): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (preset === "today") {
    const start = startOfLocalDay(now);
    const end = addLocalDays(start, 1);
    return {
      start,
      end,
      label: `Today (${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })})`,
    };
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}`,
    };
  }
  if (preset === "specific_month") {
    const [ys, ms] = specificMonth.split("-").map(Number);
    const start = new Date(ys, (ms || 1) - 1, 1);
    const end = new Date(ys, ms || 1, 1);
    return {
      start,
      end,
      label: start.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    };
  }
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return {
    start,
    end,
    label: `Year ${year}`,
  };
}

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return 0;
}

function escapeCsvCell(s: string) {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildAnalyticsCsv(rows: DestRow[], periodLabel: string) {
  const header = [
    "Destination",
    "Category",
    "Municipality",
    "Total views",
    "Intent visits",
    "Confirmed visits",
    "Report period",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.business_name),
        escapeCsvCell(r.category_name || "—"),
        escapeCsvCell(r.municipality_name || "—"),
        String(r.views),
        String(r.intent_visits),
        String(r.confirm_visits),
        escapeCsvCell(periodLabel),
      ].join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function ReportsPage() {
  const [pageReady, setPageReady] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [specificMonth, setSpecificMonth] = useState(() => monthInputValue(new Date()));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rows, setRows] = useState<DestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { start, end, label } = useMemo(
    () => rangeForPreset(preset, specificMonth, year),
    [preset, specificMonth, year],
  );

  const load = useCallback(async () => {
    setError(null);
    const pStart = start.toISOString();
    const pEnd = end.toISOString();
    const { data, error: rpcError } = await supabase.rpc("admin_destination_analytics", {
      p_start: pStart,
      p_end: pEnd,
    });
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
      return;
    }
    const parsed = (data as Record<string, unknown>[] | null)?.map((r) => ({
      business_id: String(r.business_id),
      business_name: String(r.business_name ?? ""),
      category_name: String(r.category_name ?? ""),
      municipality_name: String(r.municipality_name ?? ""),
      views: num(r.views),
      intent_visits: num(r.intent_visits),
      confirm_visits: num(r.confirm_visits),
    })) ?? [];
    parsed.sort(
      (a, b) =>
        b.views + b.intent_visits + b.confirm_visits - (a.views + a.intent_visits + a.confirm_visits),
    );
    setRows(parsed);
  }, [start, end]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (!cancelled) setPageReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          views: acc.views + r.views,
          intent: acc.intent + r.intent_visits,
          confirm: acc.confirm + r.confirm_visits,
        }),
        { views: 0, intent: 0, confirm: 0 },
      ),
    [rows],
  );

  const exportCsv = () => {
    const csv = buildAnalyticsCsv(rows, label);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DestinaPH-analytics-${preset}-${start.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const out: number[] = [];
    for (let i = y; i >= y - 8; i--) out.push(i);
    return out;
  }, []);

  if (!pageReady) {
    return <AdminReportsSkeleton />;
  }

  return (
    <div className="page page-stack admin-analytics-page">
      <header className="admin-page-hero">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Engagement</p>
          <h1 className="dash-title admin-page-hero__title">Analytics</h1>
          <p className="dash-sub admin-page-hero__sub">
            Per-destination views, intent actions (maps, itinerary, reserve), and confirmed reservations in the
            selected period. Export opens cleanly in Excel or Google Sheets.
          </p>
        </div>
        <div className="admin-page-hero__accent" aria-hidden />
      </header>

      {error ? (
        <div className="alert-banner alert-banner--error">
          {error}
          <span style={{ display: "block", marginTop: 8, fontSize: 13, opacity: 0.9 }}>
            If this mentions a missing function, apply the latest Supabase migration for{" "}
            <code style={{ fontSize: 12 }}>business_analytics_events</code>.
          </span>
        </div>
      ) : null}

      <div className="analytics-toolbar card card--flush">
        <div className="analytics-toolbar__filters">
          <span className="analytics-toolbar__label">Period</span>
          <div className="segment-tabs analytics-segment">
            {(
              [
                ["today", "Today"],
                ["this_month", "This month"],
                ["specific_month", "Specific month"],
                ["year", "Year"],
              ] as const
            ).map(([key, lab]) => (
              <button
                key={key}
                type="button"
                className={`btn btn-ghost ${preset === key ? "analytics-segment__active" : ""}`}
                onClick={() => setPreset(key)}
              >
                {lab}
              </button>
            ))}
          </div>
          {preset === "specific_month" ? (
            <label className="analytics-month-field">
              <span className="analytics-toolbar__label">Month</span>
              <input type="month" value={specificMonth} onChange={(e) => setSpecificMonth(e.target.value)} />
            </label>
          ) : null}
          {preset === "year" ? (
            <label className="analytics-month-field">
              <span className="analytics-toolbar__label">Year</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="analytics-toolbar__actions">
          <button type="button" className="btn btn-secondary btn-inline" onClick={() => void load()}>
            Refresh
          </button>
          <button type="button" className="btn btn-primary btn-inline" onClick={exportCsv} disabled={rows.length === 0}>
            Export to Sheet (CSV)
          </button>
        </div>
      </div>

      <p className="analytics-period-pill">
        <strong>{label}</strong>
        <span className="analytics-period-pill__muted">
          {start.toLocaleDateString("en-PH")} — {addLocalDays(end, -1).toLocaleDateString("en-PH")} (local dates)
        </span>
      </p>

      <p className="analytics-footnote">
        Time-stamped views and intent are recorded from app usage after this analytics migration is applied. Lifetime
        counters on listings may differ from sums shown here for past periods.
      </p>

      <div className="analytics-metric-grid">
        <div className="analytics-metric analytics-metric--views">
          <span className="analytics-metric__label">Total views</span>
          <span className="analytics-metric__value">{totals.views.toLocaleString("en-PH")}</span>
          <span className="analytics-metric__hint">Detail screen opens</span>
        </div>
        <div className="analytics-metric analytics-metric--intent">
          <span className="analytics-metric__label">Intent visits</span>
          <span className="analytics-metric__value">{totals.intent.toLocaleString("en-PH")}</span>
          <span className="analytics-metric__hint">Maps, itinerary, reserve</span>
        </div>
        <div className="analytics-metric analytics-metric--confirm">
          <span className="analytics-metric__label">Confirmed visits</span>
          <span className="analytics-metric__value">{totals.confirm.toLocaleString("en-PH")}</span>
          <span className="analytics-metric__hint">Host-confirmed bookings</span>
        </div>
      </div>

      <div className="card card--table-shell" style={{ padding: 0 }}>
        <div className="analytics-table-head">
          <span className="card__title" style={{ margin: 0 }}>
            By destination
          </span>
          <span className="card__subtitle" style={{ margin: 0 }}>
            Approved listings only · sorted by total engagement
          </span>
        </div>
        <div className="analytics-table-scroll">
          <table className="table table--analytics">
            <thead>
              <tr>
                <th>Destination</th>
                <th>Category</th>
                <th>Municipality</th>
                <th className="table__num table__th-num">Views</th>
                <th className="table__num table__th-num">Intent</th>
                <th className="table__num table__th-num">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.business_id}>
                  <td className="table__strong">{r.business_name}</td>
                  <td>{r.category_name || "—"}</td>
                  <td>{r.municipality_name || "—"}</td>
                  <td className="table__num">{r.views.toLocaleString("en-PH")}</td>
                  <td className="table__num">{r.intent_visits.toLocaleString("en-PH")}</td>
                  <td className="table__num">{r.confirm_visits.toLocaleString("en-PH")}</td>
                </tr>
              ))}
              {rows.length === 0 && !error ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No events in this range yet. Open listings in the traveler app (after migration) to record views and
                    intent; confirmations appear when hosts confirm reservations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
