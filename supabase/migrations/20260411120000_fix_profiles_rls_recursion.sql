-- Fix: SELECT on profiles was self-referencing via EXISTS(subquery on profiles) → infinite RLS recursion → HTTP 500.
-- Use a SECURITY DEFINER helper so admin checks bypass RLS inside the function only.

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
