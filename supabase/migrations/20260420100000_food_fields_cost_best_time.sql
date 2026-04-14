-- Food & Dining fields:
-- - Estimated cost range per person (min/max pesos)
-- - Best time to visit (Breakfast/Lunch/Dinner)

alter table public.businesses
  add column if not exists estimated_cost_min_pesos integer,
  add column if not exists estimated_cost_max_pesos integer,
  add column if not exists best_visit_times text[] not null default '{}';

-- Ensure valid ranges when set.
alter table public.businesses
  drop constraint if exists businesses_estimated_cost_range_chk;
alter table public.businesses
  add constraint businesses_estimated_cost_range_chk
  check (
    (estimated_cost_min_pesos is null and estimated_cost_max_pesos is null)
    or (
      estimated_cost_min_pesos is not null
      and estimated_cost_max_pesos is not null
      and estimated_cost_min_pesos >= 0
      and estimated_cost_max_pesos >= 0
      and estimated_cost_min_pesos <= estimated_cost_max_pesos
    )
  );

-- Keep best_visit_times values within allowed set.
alter table public.businesses
  drop constraint if exists businesses_best_visit_times_chk;
alter table public.businesses
  add constraint businesses_best_visit_times_chk
  check (
    best_visit_times <@ array['Breakfast','Lunch','Dinner']::text[]
  );

notify pgrst, 'reload schema';

