import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function AnalyticsPage() {
  const [totals, setTotals] = useState({ views: 0, clicks: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) return;
      const { data } = await supabase.from("businesses").select("views,clicks").eq("owner_id", uid);
      if (!data || cancelled) return;
      const agg = data.reduce(
        (acc, row) => {
          acc.views += row.views ?? 0;
          acc.clicks += row.clicks ?? 0;
          return acc;
        },
        { views: 0, clicks: 0 },
      );
      setTotals(agg);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page page--flush-top">
      <h1 className="dash-title" style={{ marginBottom: 8 }}>
        Performance
      </h1>
      <p className="dash-sub">Aggregated attention across every listing you operate.</p>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="stat-card">
          <div className="stat-card__label">Total views</div>
          <div className="stat-card__value">{totals.views.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Total inquiries (clicks)</div>
          <div className="stat-card__value">{totals.clicks.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
