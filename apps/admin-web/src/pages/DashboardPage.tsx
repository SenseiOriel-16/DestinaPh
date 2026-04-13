import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../lib/supabaseClient";

type Stat = { clients: number; businesses: number; pending: number; destinations: number };
type Recent = { id: string; name: string; status: string; created_at: string };

function lastNDaysLabels(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
  }
  return out;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function bucketRows(
  rows: { created_at: string }[] | null,
  labels: string[],
): number[] {
  const counts = new Array(labels.length).fill(0);
  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = labels.length - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayKeys.push(dayKey(d));
  }
  for (const r of rows ?? []) {
    const k = r.created_at?.slice(0, 10);
    const idx = dayKeys.indexOf(k);
    if (idx >= 0) counts[idx] += 1;
  }
  return counts;
}

function pctDelta(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "+100%" : "0%";
  const p = Math.round(((current - previous) / previous) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stat>({
    clients: 0,
    businesses: 0,
    pending: 0,
    destinations: 0,
  });
  const [deltas, setDeltas] = useState({
    clients: "—",
    businesses: "—",
    destinations: "—",
  });
  const [chartData, setChartData] = useState<{ name: string; Clients: number; Businesses: number }[]>(
    [],
  );
  const [recent, setRecent] = useState<Recent[]>([]);

  const labels = useMemo(() => lastNDaysLabels(7), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const sinceIso = since.toISOString();
      const t7 = Date.now() - 7 * 864e5;
      const t14 = Date.now() - 14 * 864e5;

      const [
        { count: clients },
        { count: businesses },
        { count: pending },
        { count: approved },
        { data: consumerRows },
        { data: bizRows },
        { data: recentRows },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "consumer"),
        supabase.from("businesses").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "business_owner")
          .eq("owner_approval_status", "pending"),
        supabase
          .from("businesses")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved"),
        supabase.from("profiles").select("created_at").eq("role", "consumer").gte("created_at", sinceIso),
        supabase.from("businesses").select("created_at").gte("created_at", sinceIso),
        supabase
          .from("businesses")
          .select("id,name,status,created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const cRows = (consumerRows as { created_at: string }[]) ?? [];
      const bRows = (bizRows as { created_at: string }[]) ?? [];
      const cSeries = bucketRows(cRows, labels);
      const bSeries = bucketRows(bRows, labels);
      const chart = labels.map((name, i) => ({
        name,
        Clients: cSeries[i] ?? 0,
        Businesses: bSeries[i] ?? 0,
      }));

      const lastWeekC = cRows.filter((r) => new Date(r.created_at).getTime() >= t7).length;
      const prevWeekC = cRows.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t < t7 && t >= t14;
      }).length;
      const lastWeekB = bRows.filter((r) => new Date(r.created_at).getTime() >= t7).length;
      const prevWeekB = bRows.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t < t7 && t >= t14;
      }).length;

      if (cancelled) return;
      setStats({
        clients: clients ?? 0,
        businesses: businesses ?? 0,
        pending: pending ?? 0,
        destinations: approved ?? 0,
      });
      setDeltas({
        clients: pctDelta(lastWeekC, prevWeekC),
        businesses: pctDelta(lastWeekB, prevWeekB),
        destinations: pctDelta(lastWeekB, Math.max(1, prevWeekB)),
      });
      setChartData(chart);
      setRecent((recentRows as Recent[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [labels]);

  const statCards = [
    {
      label: "Total Clients",
      value: stats.clients,
      delta: deltas.clients,
      icon: "👥",
      tint: "rgba(8,143,143,0.15)",
    },
    {
      label: "Total Businesses",
      value: stats.businesses,
      delta: deltas.businesses,
      icon: "🏪",
      tint: "rgba(59,130,246,0.15)",
    },
    {
      label: "Pending owners",
      value: stats.pending,
      delta: "",
      icon: "📋",
      tint: "rgba(234,179,8,0.2)",
    },
    {
      label: "Total Destinations",
      value: stats.destinations,
      delta: deltas.destinations,
      icon: "📍",
      tint: "rgba(34,197,94,0.15)",
    },
  ];

  const avatarColors = ["#088f8f", "#2563eb", "#ca8a04", "#16a34a", "#9333ea", "#dc2626"];

  return (
    <div className="page">
      <h1 className="dash-title">Dashboard</h1>
      <p className="dash-sub">
        Welcome back, Admin! Here&apos;s what&apos;s happening with DestinaPH.
      </p>

      <div className="stat-grid">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__row">
              <div>
                <div className="stat-card__label">{s.label}</div>
                <div className="stat-card__value">{s.value}</div>
                <div className="stat-card__delta">
                  {s.label === "Pending owners"
                    ? stats.pending > 0
                      ? "Awaiting review"
                      : "All caught up"
                    : `${s.delta} vs last week`}
                </div>
              </div>
              <div className="stat-card__icon" style={{ background: s.tint }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <div className="card" style={{ minHeight: 320 }}>
          <strong style={{ fontSize: 16, display: "block", marginBottom: 4 }}>Overview</strong>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Clients & businesses (last 7 days)</span>
          <div style={{ height: 260, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#088f8f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#088f8f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" width={32} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Clients" stroke="#088f8f" fill="url(#gc)" strokeWidth={2} />
                <Area type="monotone" dataKey="Businesses" stroke="#3b82f6" fill="url(#gb)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <strong style={{ fontSize: 16, display: "block", marginBottom: 4 }}>Recent activity</strong>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Latest listings</span>
          <div style={{ marginTop: 8 }}>
            {recent.map((r, i) => (
              <div key={r.id} className="recent-row">
                <div
                  className="recent-avatar"
                  style={{ background: avatarColors[i % avatarColors.length] }}
                >
                  {r.name.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`pill ${r.status}`}>{r.status}</span>
              </div>
            ))}
            {recent.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>No listings yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
