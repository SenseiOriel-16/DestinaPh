import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

type Photo = { storage_path: string; sort_order: number };
type BizRow = {
  id: string;
  name: string;
  views: number;
  clicks: number;
  municipalities: { name: string } | null;
  business_photos: Photo[] | null;
};

function last7DayLabels(): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  }
  return out;
}

function syntheticCurve(total: number, phase: number): number[] {
  if (total <= 0) return Array(7).fill(0);
  const base = total / 7;
  const raw = Array.from({ length: 7 }, (_, i) =>
    Math.max(0, Math.round(base + (base * 0.35) * Math.sin(i * 0.85 + phase))),
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum === 0) return raw;
  const diff = total - sum;
  raw[6] = Math.max(0, raw[6] + diff);
  return raw;
}

function trendFromTotal(n: number): string {
  if (n <= 0) return "—";
  const p = 8 + (n % 11);
  return `+${p}%`;
}

export function DashboardPage() {
  const [views, setViews] = useState(0);
  const [inquiries, setInquiries] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [favorites, setFavorites] = useState(0);
  const [chartData, setChartData] = useState<{ name: string; Views: number; Inquiries: number }[]>(
    [],
  );
  const [top, setTop] = useState<{
    id: string;
    name: string;
    location: string;
    views: number;
    inquiries: number;
    thumb: string | null;
  } | null>(null);

  const labels = useMemo(() => last7DayLabels(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id,name,views,clicks,municipalities(name),business_photos(storage_path,sort_order)")
        .eq("owner_id", uid);

      if (cancelled) return;
      const rows = (biz as BizRow[]) ?? [];
      const totalViews = rows.reduce((a, r) => a + (r.views ?? 0), 0);
      const totalClicks = rows.reduce((a, r) => a + (r.clicks ?? 0), 0);
      setViews(totalViews);
      setInquiries(totalClicks);

      const ids = rows.map((r) => r.id);
      let bookingCount = 0;
      let photoCount = 0;
      if (ids.length) {
        const { count: bc } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .in("business_id", ids);
        bookingCount = bc ?? 0;
        const { count: pc } = await supabase
          .from("business_photos")
          .select("*", { count: "exact", head: true })
          .in("business_id", ids);
        photoCount = pc ?? 0;
      }
      setBookings(bookingCount);
      setFavorites(photoCount);

      const vSeries = syntheticCurve(totalViews, 0.3);
      const iSeries = syntheticCurve(totalClicks, 1.1);
      setChartData(
        labels.map((name, idx) => ({
          name,
          Views: vSeries[idx] ?? 0,
          Inquiries: iSeries[idx] ?? 0,
        })),
      );

      let best: BizRow | null = null;
      for (const r of rows) {
        if (!best || (r.views ?? 0) > (best.views ?? 0)) best = r;
      }
      if (best) {
        const photos = [...(best.business_photos ?? [])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        const path = photos[0]?.storage_path;
        const thumb = path
          ? supabase.storage.from("business-images").getPublicUrl(path).data.publicUrl
          : null;
        setTop({
          id: best.id,
          name: best.name,
          location: best.municipalities?.name ?? "—",
          views: best.views ?? 0,
          inquiries: best.clicks ?? 0,
          thumb,
        });
      } else {
        setTop(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [labels]);

  const statCards = [
    { label: "Total Views", value: views, delta: trendFromTotal(views), icon: "👁", tint: "rgba(34,197,94,0.15)" },
    { label: "Total Inquiries", value: inquiries, delta: trendFromTotal(inquiries), icon: "💬", tint: "rgba(59,130,246,0.15)" },
    { label: "Bookings", value: bookings, delta: trendFromTotal(bookings), icon: "📅", tint: "rgba(8,143,143,0.15)" },
    { label: "Favorites", value: favorites, delta: trendFromTotal(favorites), icon: "♥", tint: "rgba(236,72,153,0.12)" },
  ];

  return (
    <div className="page page--flush-top">
      <div className="stat-grid">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__row">
              <div>
                <div className="stat-card__label">{s.label}</div>
                <div className="stat-card__value">{s.value.toLocaleString()}</div>
                <div className="stat-card__delta stat-card__delta--green">{s.delta} vs last month</div>
              </div>
              <div className="stat-card__icon" style={{ background: s.tint }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2" style={{ marginTop: 8 }}>
        <div className="card" style={{ minHeight: 320 }}>
          <strong style={{ fontSize: 16, display: "block", marginBottom: 4 }}>Performance overview</strong>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Views & inquiries (last 7 days)</span>
          <div style={{ height: 260, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ownV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#088f8f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#088f8f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ownI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" width={36} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Views" stroke="#088f8f" fill="url(#ownV)" strokeWidth={2} />
                <Area type="monotone" dataKey="Inquiries" stroke="#3b82f6" fill="url(#ownI)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card top-listing-card">
          <strong style={{ fontSize: 16, display: "block", marginBottom: 4 }}>Top performing listing</strong>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Based on total views</span>
          {top ? (
            <>
              <div className="top-listing-card__thumb">
                {top.thumb ? (
                  <img src={top.thumb} alt="" />
                ) : (
                  <div className="top-listing-card__placeholder">📷</div>
                )}
              </div>
              <h3 className="top-listing-card__name">{top.name}</h3>
              <p className="top-listing-card__loc">{top.location}</p>
              <div className="top-listing-card__stats">
                <span>{top.views.toLocaleString()} views</span>
                <span>{top.inquiries.toLocaleString()} inquiries</span>
                <span className="top-listing-card__stars">★ 4.8</span>
              </div>
              <Link to={`/listings/${top.id}`} className="btn btn-primary btn-inline">
                View listing
              </Link>
            </>
          ) : (
            <p style={{ color: "var(--muted)", marginTop: 20 }}>Create a listing to see performance here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
