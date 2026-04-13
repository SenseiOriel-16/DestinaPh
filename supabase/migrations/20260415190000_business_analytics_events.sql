-- Time-series analytics per destination (views, intent visits, confirmed visits)
-- + admin RPC; extends track_business_metric to append events; booking confirm → confirm_visit.
-- Municipalities: optional auto slug default for admin-created rows (slug hidden in UI).

create table if not exists public.business_analytics_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  event_type text not null check (event_type in ('view', 'intent_visit', 'confirm_visit')),
  created_at timestamptz not null default now()
);

create index if not exists business_analytics_events_business_time_idx
  on public.business_analytics_events (business_id, created_at desc);

create index if not exists business_analytics_events_time_idx
  on public.business_analytics_events (created_at desc);

alter table public.business_analytics_events enable row level security;

drop policy if exists "business_analytics_events admin select" on public.business_analytics_events;
create policy "business_analytics_events admin select"
  on public.business_analytics_events for select to authenticated
  using (public.is_admin());

-- —— Append events when travelers hit listing metrics (RPC already used by mobile) ——
create or replace function public.track_business_metric(target uuid, metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if metric = 'view' then
    update public.businesses
      set views = views + 1
    where id = target and status = 'approved';
    if found then
      insert into public.business_analytics_events (business_id, event_type)
      values (target, 'view');
    end if;
  elsif metric = 'click' then
    update public.businesses
      set clicks = clicks + 1
    where id = target and status = 'approved';
    if found then
      insert into public.business_analytics_events (business_id, event_type)
      values (target, 'intent_visit');
    end if;
  end if;
end;
$$;

-- —— Owner confirms reservation → one “confirm visit” signal per confirmation ——
create or replace function public.bookings_emit_confirm_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' and coalesce(old.status, '') <> 'confirmed' then
    insert into public.business_analytics_events (business_id, event_type)
    values (new.business_id, 'confirm_visit');
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_emit_confirm_visit on public.bookings;
create trigger bookings_emit_confirm_visit
after update on public.bookings
for each row execute procedure public.bookings_emit_confirm_visit();

-- —— Admin dashboard: per-destination rollups for [p_start, p_end) ——
create or replace function public.admin_destination_analytics(p_start timestamptz, p_end timestamptz)
returns table (
  business_id uuid,
  business_name text,
  category_name text,
  municipality_name text,
  views bigint,
  intent_visits bigint,
  confirm_visits bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select
    b.id,
    b.name,
    coalesce(c.name, '')::text,
    coalesce(m.name, '')::text,
    coalesce(count(e.id) filter (where e.event_type = 'view'), 0)::bigint,
    coalesce(count(e.id) filter (where e.event_type = 'intent_visit'), 0)::bigint,
    coalesce(count(e.id) filter (where e.event_type = 'confirm_visit'), 0)::bigint
  from public.businesses b
  left join public.categories c on c.id = b.category_id
  left join public.municipalities m on m.id = b.municipality_id
  left join public.business_analytics_events e
    on e.business_id = b.id
    and e.created_at >= p_start
    and e.created_at < p_end
  where b.status = 'approved'
  group by b.id, b.name, c.name, m.name
  order by b.name asc;
end;
$$;

revoke all on function public.admin_destination_analytics(timestamptz, timestamptz) from public;
grant execute on function public.admin_destination_analytics(timestamptz, timestamptz) to authenticated;

-- —— Municipalities: allow inserts without slug (UI); PSGC RPC still supplies slug ——
alter table public.municipalities
  alter column slug set default ('mun-' || replace(gen_random_uuid()::text, '-', ''));

notify pgrst, 'reload schema';
