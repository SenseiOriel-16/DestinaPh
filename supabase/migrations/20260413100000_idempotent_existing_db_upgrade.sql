-- ============================================================================
-- DestinaPH — IDEMPOTENT upgrade for EXISTING databases
-- ============================================================================
-- Safe to run multiple times in Supabase SQL Editor (no "already exists" on policies).
-- Gamitin ito kung na-run mo na dati ang init at ayaw mong i-drop ang data.
-- HUWAG i-run ang buong init_destinaph.sql sa may schema na — gumagamit iyon ng plain CREATE TABLE.
--
-- Sakop: is_admin + profiles RLS, address_line, owner approval, geo (province/barangay),
--        business listing columns, handle_new_user, policies, is_suspended + insert/update rules.
-- ============================================================================

-- —— RLS helper (idempotent) ——
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles self read" on public.profiles;

create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- —— Profiles: owner gate ——
alter table public.profiles
  add column if not exists owner_approval_status text not null default 'approved'
    check (owner_approval_status in ('pending', 'approved', 'rejected'));

alter table public.profiles
  add column if not exists registration_business_name text;

alter table public.profiles
  add column if not exists registration_phone text;

update public.profiles
set owner_approval_status = 'approved'
where role <> 'business_owner';

update public.profiles
set owner_approval_status = 'approved'
where role = 'business_owner';

-- —— Businesses: address + listing fields ——
alter table public.businesses
  add column if not exists address_line text;

alter table public.businesses
  add column if not exists short_description text;

alter table public.businesses
  add column if not exists tags text[] not null default '{}';

alter table public.businesses
  add column if not exists entrance_fee_pesos integer;

alter table public.businesses
  add column if not exists accommodations jsonb not null default '[]'::jsonb;

-- FK targets must exist before adding FK columns
create table if not exists public.provinces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.municipalities
  add column if not exists province_id uuid references public.provinces (id);

create table if not exists public.barangays (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (municipality_id, slug)
);

create index if not exists barangays_municipality_idx on public.barangays (municipality_id);

-- province_id / barangay_id on businesses (after provinces & barangays exist)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'businesses' and column_name = 'province_id'
  ) then
    alter table public.businesses
      add column province_id uuid references public.provinces (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'businesses' and column_name = 'barangay_id'
  ) then
    alter table public.businesses
      add column barangay_id uuid references public.barangays (id);
  end if;
end $$;

insert into public.provinces (name, slug)
values ('Camarines Sur', 'camarines-sur')
on conflict (slug) do nothing;

update public.municipalities m
set province_id = p.id
from public.provinces p
where p.slug = 'camarines-sur'
  and m.slug in ('naga-city', 'pili', 'iriga-city', 'camarines-sur')
  and (m.province_id is null or m.province_id is distinct from p.id);

insert into public.barangays (municipality_id, name, slug)
select m.id, v.name, v.slug
from public.municipalities m
cross join lateral (
  values
    ('Concepcion Grande', 'concepcion-grande'),
    ('Mabolo', 'mabolo'),
    ('Triangulo', 'triangulo')
) as v(name, slug)
where m.slug = 'naga-city'
on conflict (municipality_id, slug) do nothing;

insert into public.barangays (municipality_id, name, slug)
select m.id, v.name, v.slug
from public.municipalities m
cross join lateral (
  values
    ('La Purisima', 'la-purisima'),
    ('Caroyroyan', 'caroyroyan'),
    ('Cadlan', 'cadlan')
) as v(name, slug)
where m.slug = 'pili'
on conflict (municipality_id, slug) do nothing;

insert into public.barangays (municipality_id, name, slug)
select m.id, v.name, v.slug
from public.municipalities m
cross join lateral (
  values
    ('San Agustin', 'san-agustin'),
    ('San Francisco', 'san-francisco')
) as v(name, slug)
where m.slug = 'iriga-city'
on conflict (municipality_id, slug) do nothing;

insert into public.barangays (municipality_id, name, slug)
select m.id, v.name, v.slug
from public.municipalities m
cross join lateral (
  values
    ('Poblacion', 'poblacion-general')
) as v(name, slug)
where m.slug = 'camarines-sur'
on conflict (municipality_id, slug) do nothing;

alter table public.provinces enable row level security;
alter table public.barangays enable row level security;

drop policy if exists "provinces read" on public.provinces;
drop policy if exists "provinces admin write" on public.provinces;
drop policy if exists "barangays read" on public.barangays;
drop policy if exists "barangays admin write" on public.barangays;

create policy "provinces read"
  on public.provinces for select
  using (true);

create policy "provinces admin write"
  on public.provinces for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "barangays read"
  on public.barangays for select
  using (true);

create policy "barangays admin write"
  on public.barangays for all
  using (public.is_admin())
  with check (public.is_admin());

-- Listings: default approved + clear old pending rows
alter table public.businesses
  alter column status set default 'approved';

update public.businesses
set status = 'approved'
where status = 'pending';

update public.businesses b
set province_id = m.province_id
from public.municipalities m
where b.municipality_id = m.id
  and b.province_id is null
  and m.province_id is not null;

-- —— Auth trigger ——
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_role text := coalesce(new.raw_user_meta_data->>'role', 'consumer');
  approval text := 'approved';
begin
  if desired_role not in ('admin', 'business_owner', 'consumer') then
    desired_role := 'consumer';
  end if;

  if desired_role = 'business_owner' then
    approval := 'pending';
  end if;

  insert into public.profiles (
    id,
    full_name,
    role,
    owner_approval_status,
    registration_business_name,
    registration_phone
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    desired_role,
    approval,
    nullif(trim(coalesce(new.raw_user_meta_data->>'business_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '')
  );
  return new;
end;
$$;

drop policy if exists "profiles admin update" on public.profiles;

create policy "profiles admin update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "businesses insert owner" on public.businesses;

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

create policy "businesses insert owner"
  on public.businesses for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'business_owner'
        and p.owner_approval_status = 'approved'
        and coalesce(p.is_suspended, false) = false
    )
  );

drop policy if exists "businesses update privileged" on public.businesses;

create policy "businesses update privileged"
  on public.businesses for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      auth.uid() = owner_id
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and coalesce(p.is_suspended, false) = false
      )
    )
  );
