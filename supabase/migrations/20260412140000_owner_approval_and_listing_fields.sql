-- Business owners: register then wait for admin (owner_approval_status).
-- Listings: no admin gate — default status approved; consumers see approved only.
--
-- Para sa SQL Editor na gusto paulit-ulit / existing DB: gamitin ang
-- `20260413100000_idempotent_existing_db_upgrade.sql` (may DROP POLICY bago CREATE).

-- —— Profiles: owner gate + registration snapshot for admin UI ——
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

-- —— Provinces & barangays (Camarines Sur MVP) ——
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

insert into public.provinces (name, slug)
values ('Camarines Sur', 'camarines-sur')
on conflict (slug) do nothing;

update public.municipalities m
set province_id = p.id
from public.provinces p
where p.slug = 'camarines-sur'
  and m.slug in ('naga-city', 'pili', 'iriga-city', 'camarines-sur');

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

-- —— Businesses: listing fields + auto-approved ——
alter table public.businesses
  add column if not exists short_description text;

alter table public.businesses
  add column if not exists tags text[] not null default '{}';

alter table public.businesses
  add column if not exists entrance_fee_pesos integer;

alter table public.businesses
  add column if not exists province_id uuid references public.provinces (id);

alter table public.businesses
  add column if not exists barangay_id uuid references public.barangays (id);

alter table public.businesses
  add column if not exists accommodations jsonb not null default '[]'::jsonb;

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

-- New signups: trigger sets owner pending
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

-- Admin can approve/reject business owners
drop policy if exists "profiles admin update" on public.profiles;

create policy "profiles admin update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Only approved business owners can create listings
drop policy if exists "businesses insert owner" on public.businesses;

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
    )
  );
