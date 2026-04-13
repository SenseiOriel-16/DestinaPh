-- Consumer (and any signed-in profile) favorites for approved businesses.

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, business_id)
);

create index if not exists user_favorites_user_idx on public.user_favorites (user_id);
create index if not exists user_favorites_business_idx on public.user_favorites (business_id);

alter table public.user_favorites enable row level security;

drop policy if exists "user_favorites read own" on public.user_favorites;
create policy "user_favorites read own"
  on public.user_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "user_favorites admin read" on public.user_favorites;
create policy "user_favorites admin read"
  on public.user_favorites for select
  using (public.is_admin());

drop policy if exists "user_favorites insert own approved" on public.user_favorites;
create policy "user_favorites insert own approved"
  on public.user_favorites for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.status = 'approved'
    )
  );

drop policy if exists "user_favorites delete own" on public.user_favorites;
create policy "user_favorites delete own"
  on public.user_favorites for delete
  using (auth.uid() = user_id);
