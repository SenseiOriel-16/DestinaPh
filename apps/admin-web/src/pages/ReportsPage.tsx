import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../lib/supabaseClient";

type Agg = { category: string; views: number; clicks: number };

export function ReportsPage() {
  const [rows, setRows] = useState<Agg[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("businesses").select(
        "views,clicks,categories(name)",
      );
      if (error || !data) return;
      const map = new Map<string, Agg>();
      for (const row of data as {
        views: number;
        clicks: number;
        categories: { name: string } | null;
      }[]) {
        const key = row.categories?.name ?? "Uncategorized";
        const prev = map.get(key) ?? { category: key, views: 0, clicks: 0 };
        prev.views += row.views;
        prev.clicks += row.clicks;
        map.set(key, prev);
      }
      if (!cancelled) {
        setRows(Array.from(map.values()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "var(--primary)" }}>Analytics</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
          Engagement totals grouped by primary category.
        </p>
      </header>
      <div className="card" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="views" fill="#0B3C5D" name="Views" radius={[8, 8, 0, 0]} />
            <Bar dataKey="clicks" fill="#00A896" name="Clicks" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
