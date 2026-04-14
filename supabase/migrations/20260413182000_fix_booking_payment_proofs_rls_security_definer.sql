-- Storage signed URLs can return "Object not found" when RLS denies SELECT.
-- Some setups also fail when the policy's EXISTS() subquery touches tables with RLS.
-- Use a SECURITY DEFINER helper to check ownership without being blocked by RLS.

create or replace function public.can_read_booking_payment_proof(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  traveler_id_text text;
  booking_id_text text;
  booking_id uuid;
begin
  uid := auth.uid();
  if uid is null then
    return false;
  end if;

  traveler_id_text := split_part(object_name, '/', 1);
  if traveler_id_text = uid::text then
    return true;
  end if;

  booking_id_text := split_part(object_name, '/', 2);
  if booking_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  booking_id := booking_id_text::uuid;

  -- Owner of the business for this booking can read.
  return exists (
    select 1
    from public.bookings bk
    join public.businesses b on b.id = bk.business_id
    where bk.id = booking_id
      and b.owner_id = uid
  );
end;
$$;

-- Ensure function owner can bypass RLS in its checks.
alter function public.can_read_booking_payment_proof(text) set row_security = off;

drop policy if exists "booking proofs select parties" on storage.objects;
create policy "booking proofs select parties"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-payment-proofs'
    and (
      public.is_admin()
      or public.can_read_booking_payment_proof(name)
    )
  );

notify pgrst, 'reload schema';

