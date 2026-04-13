import { FormEvent, useEffect, useState } from "react";
import { AdminPlansSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

type Plan = {
  id: string;
  code: string;
  name: string;
  price_monthly_cents: number;
  description: string | null;
  booking_enabled: boolean;
};

export function PlansPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [rows, setRows] = useState<Plan[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id,code,name,price_monthly_cents,description,booking_enabled")
        .order("code");
      if (error) {
        setMsg(error.message);
        return;
      }
      setRows((data as Plan[]) ?? []);
    } finally {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (e: FormEvent, plan: Plan) => {
    e.preventDefault();
    setMsg(null);
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const price = Number(fd.get("price") ?? 0);
    const description = String(fd.get("description") ?? "");
    const booking = fd.get("booking") === "on";
    const { error } = await supabase
      .from("subscription_plans")
      .update({
        price_monthly_cents: Math.round(price * 100),
        description,
        booking_enabled: booking,
      })
      .eq("id", plan.id);
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  };

  if (initialLoad) {
    return <AdminPlansSkeleton />;
  }

  return (
    <div className="page page-stack admin-tool-page">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Monetization</p>
          <h1 className="dash-title admin-page-hero__title">Subscription plans</h1>
          <p className="dash-sub admin-page-hero__sub">
            Tune pricing and booking entitlements for the business owner portal.
          </p>
        </div>
        <div className="admin-page-hero__accent admin-page-hero__accent--plans" aria-hidden />
      </header>
      {msg && <div className="alert-banner alert-banner--error">{msg}</div>}
      {rows.length > 0 ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          {rows.map((plan) => (
            <form key={plan.id} className="card" onSubmit={(e) => void save(e, plan)}>
              <h3 style={{ marginTop: 0 }}>{plan.name}</h3>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                Code · {plan.code}
              </div>
              <div className="field">
                <label htmlFor={`price-${plan.id}`}>Price (PHP / month)</label>
                <input
                  id={`price-${plan.id}`}
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={(plan.price_monthly_cents / 100).toFixed(2)}
                />
              </div>
              <div className="field">
                <label htmlFor={`desc-${plan.id}`}>Description</label>
                <textarea
                  id={`desc-${plan.id}`}
                  name="description"
                  rows={3}
                  defaultValue={plan.description ?? ""}
                />
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input type="checkbox" name="booking" defaultChecked={plan.booking_enabled} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Booking tools enabled</span>
              </label>
              <button className="btn btn-primary" type="submit">
                Save plan
              </button>
            </form>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--compact">
          <div className="empty-state__icon" aria-hidden>
            💳
          </div>
          <p className="empty-state__title">No plans loaded</p>
          <p className="empty-state__text">Seed subscription plans in the database to configure pricing here.</p>
        </div>
      )}
    </div>
  );
}
