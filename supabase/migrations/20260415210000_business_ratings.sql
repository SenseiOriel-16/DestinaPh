-- Per-destination star ratings (1–5) from signed-in users; aggregates on public.businesses.

alter table public.businesses
  add column if not exists rating_average numeric(4, 2),
  add column if not exists rating_count integer not null default 0;

comment on column public.businesses.rating_average is 'Mean stars (1–5), 2 decimals; null when no ratings.';
comment on column public.businesses.rating_count is 'Number of ratings in business_ratings for this listing.';

create table if not exists public.business_ratings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars >= 1 and stars <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists business_ratings_business_idx on public.business_ratings (business_id);
create index if not exists business_ratings_user_idx on public.business_ratings (user_id);

drop trigger if exists business_ratings_touch on public.business_ratings;
create trigger business_ratings_touch
before update on public.business_ratings
for each row execute procedure public.touch_updated_at();

create or replace function public.refresh_business_rating_aggregate(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
  sm numeric;
begin
  select count(*)::int, coalesce(sum(stars), 0)::numeric
    into cnt, sm
  from public.business_ratings
  where business_id = p_business_id;

  update public.businesses
  set
    rating_count = cnt,
    rating_average = case when cnt = 0 then null else round(sm / cnt, 2) end
  where id = p_business_id;
end;
$$;

revoke all on function public.refresh_business_rating_aggregate(uuid) from public;

create or replace function public.trg_business_ratings_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_business_rating_aggregate(coalesce(new.business_id, old.business_id));
  return coalesce(new, old);
end;
$$;

revoke all on function public.trg_business_ratings_refresh() from public;

drop trigger if exists business_ratings_refresh on public.business_ratings;
create trigger business_ratings_refresh
after insert or update or delete on public.business_ratings
for each row execute procedure public.trg_business_ratings_refresh();

do $$
declare
  r record;
begin
  for r in select distinct business_id from public.business_ratings
  loop
    perform public.refresh_business_rating_aggregate(r.business_id);
  end loop;
end;
$$;

alter table public.business_ratings enable row level security;

drop policy if exists "business_ratings read approved" on public.business_ratings;
create policy "business_ratings read approved"
  on public.business_ratings for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and b.status = 'approved'
    )
  );

drop policy if exists "business_ratings insert self" on public.business_ratings;
create policy "business_ratings insert self"
  on public.business_ratings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and stars between 1 and 5
    and exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and b.status = 'approved'
        and b.owner_id is distinct from auth.uid()
    )
  );

drop policy if exists "business_ratings update own" on public.business_ratings;
create policy "business_ratings update own"
  on public.business_ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and stars between 1 and 5
    and exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and b.status = 'approved'
        and b.owner_id is distinct from auth.uid()
    )
  );

drop policy if exists "business_ratings delete own" on public.business_ratings;
create policy "business_ratings delete own"
  on public.business_ratings for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "business_ratings admin all" on public.business_ratings;
create policy "business_ratings admin all"
  on public.business_ratings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
