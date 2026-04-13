-- ============================================================================
-- DestinaPH — FULL SCHEMA (fresh database ONLY)
-- ============================================================================
-- Hinihiling ang WALANG LAMAN na `public` schema (o bagong Supabase project).
-- HUWAG i-paste / i-run muli sa SQL Editor kung may `profiles`, `businesses`, atbp. na —
-- mag-error ang `relation "…" already exists` (PostgreSQL 42P07).
--
-- Sa existing project (may `profiles` / tables na):
--   • I-run ang IDEMPOTENT upgrade (maaaring paulit-ulit sa SQL Editor):
--       `20260413100000_idempotent_existing_db_upgrade.sql`
--   • O Supabase CLI: `supabase db push` (lahat ng migrations na hindi pa naka-track).
--   • Huwag i-paste muli ang buong init dito.
--
-- Schema sakop: profiles (owner approval), provinces/barangays/municipalities, businesses
-- (tags, accommodations, auto-approved listings), RLS, storage, seed data.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Profiles mirror auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'business_owner', 'consumer')),
  owner_approval_status text not null default 'approved'
    check (owner_approval_status in ('pending', 'approved', 'rejected')),
  registration_business_name text,
  registration_phone text,
  is_suspended boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  color_token text,
  created_at timestamptz not null default now()
);

create table public.provinces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  province_id uuid references public.provinces (id),
  name text not null,
  slug text not null unique,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table public.barangays (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (municipality_id, slug)
);

create index barangays_municipality_idx on public.barangays (municipality_id);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('free', 'premium')),
  name text not null,
  price_monthly_cents integer not null default 0,
  description text,
  booking_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category_id uuid not null references public.categories (id),
  subcategory text,
  province_id uuid references public.provinces (id),
  municipality_id uuid not null references public.municipalities (id),
  barangay_id uuid references public.barangays (id),
  description text,
  short_description text,
  tags text[] not null default '{}',
  entrance_fee_pesos integer,
  accommodations jsonb not null default '[]'::jsonb,
  pricing_text text,
  latitude double precision,
  longitude double precision,
  address_line text,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  is_featured boolean not null default false,
  is_premium boolean not null default false,
  views integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_owner_idx on public.businesses (owner_id);
create index businesses_status_idx on public.businesses (status);
create index businesses_municipality_idx on public.businesses (municipality_id);
create index businesses_category_idx on public.businesses (category_id);

create table public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  started_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  notes text,
  requested_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_touch
before update on public.profiles
for each row execute procedure public.touch_updated_at();

create trigger businesses_touch
before update on public.businesses
for each row execute procedure public.touch_updated_at();

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

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS helper: never use EXISTS (SELECT … FROM profiles …) inside a policy ON profiles (infinite recursion → 500).
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

-- Seed taxonomy & plans
insert into public.categories (name, slug, color_token) values
  ('Nature & Adventure', 'nature-adventure', 'nature'),
  ('Resorts & Leisure', 'resorts-leisure', 'resort'),
  ('Food & Dining', 'food-dining', 'food');

insert into public.provinces (name, slug)
values ('Camarines Sur', 'camarines-sur')
on conflict (slug) do nothing;

insert into public.municipalities (province_id, name, slug)
select p.id, v.name, v.slug
from public.provinces p
cross join lateral (
  values
    ('Naga City', 'naga-city'),
    ('Pili', 'pili'),
    ('Iriga City', 'iriga-city'),
    ('Camarines Sur (General)', 'camarines-sur')
) as v(name, slug)
where p.slug = 'camarines-sur'
on conflict (slug) do nothing;

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

insert into public.subscription_plans (code, name, price_monthly_cents, description, booking_enabled) values
  ('free', 'Free', 0, 'Standard listing exposure', false),
  ('premium', 'Premium', 149900, 'Booking tools + higher placement', true);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.provinces enable row level security;
alter table public.municipalities enable row level security;
alter table public.barangays enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.businesses enable row level security;
alter table public.business_photos enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.bookings enable row level security;

create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles admin update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "taxonomy read categories"
  on public.categories for select
  using (true);

create policy "taxonomy read municipalities"
  on public.municipalities for select
  using (true);

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

create policy "categories admin write"
  on public.categories for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "municipalities admin write"
  on public.municipalities for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "plans read"
  on public.subscription_plans for select
  using (true);

create policy "plans admin write"
  on public.subscription_plans for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "businesses read"
  on public.businesses for select
  using (
    status = 'approved'
    or auth.uid() = owner_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

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

create policy "businesses delete privileged"
  on public.businesses for delete
  using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "photos read"
  on public.business_photos for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (
          b.status = 'approved'
          or auth.uid() = b.owner_id
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "photos owner admin write"
  on public.business_photos for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (
          auth.uid() = b.owner_id
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (
          auth.uid() = b.owner_id
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "subs read"
  on public.business_subscriptions for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (
          auth.uid() = b.owner_id
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "subs write owner admin"
  on public.business_subscriptions for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (
          auth.uid() = b.owner_id
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (
          auth.uid() = b.owner_id
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "bookings read"
  on public.bookings for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and auth.uid() = b.owner_id
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "bookings insert consumer"
  on public.bookings for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'consumer')
  );

create policy "bookings update parties"
  on public.bookings for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and auth.uid() = b.owner_id
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

insert into storage.buckets (id, name, public)
values ('business-images', 'business-images', true)
on conflict (id) do nothing;

create policy "business images public read"
  on storage.objects for select
  using (bucket_id = 'business-images');

create policy "business images owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'business-images'
    and auth.role() = 'authenticated'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "business images owner update"
  on storage.objects for update
  using (
    bucket_id = 'business-images'
    and auth.role() = 'authenticated'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "business images owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'business-images'
    and auth.role() = 'authenticated'
    and split_part(name, '/', 1) = auth.uid()::text
  );

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
  elsif metric = 'click' then
    update public.businesses
      set clicks = clicks + 1
    where id = target and status = 'approved';
  end if;
end;
$$;

revoke all on function public.track_business_metric(uuid, text) from public;
grant execute on function public.track_business_metric(uuid, text) to anon, authenticated;
