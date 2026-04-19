-- Fix Postgres 42P17 "infinite recursion detected in policy for relation profiles".
--
-- Some policies (e.g. businesses read) query public.profiles to check roles.
-- That SELECT enters profiles RLS; profiles RLS calls public.is_admin(); is_admin()
-- SELECTs profiles again → recursion. Run the inner admin check with row_security disabled
-- for this helper only (same pattern as can_read_booking_payment_proof in 20260413182000).

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Ensure the attribute sticks even if replacing an older function definition.
alter function public.is_admin() set row_security = off;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

notify pgrst, 'reload schema';

