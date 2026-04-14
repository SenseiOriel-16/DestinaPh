-- Fix RLS for `booking-payment-proofs` signed URL creation:
-- Storage may return "Object not found" when RLS denies SELECT.
-- Use split_part(name,'/',N) instead of storage.foldername(name) for robustness.

drop policy if exists "booking proofs select parties" on storage.objects;
create policy "booking proofs select parties"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-payment-proofs'
    and (
      -- Traveler can read their own folder: `{userId}/...`
      split_part(name, '/', 1) = auth.uid()::text
      -- Business owner can read proofs for bookings under their businesses:
      or exists (
        select 1
        from public.bookings bk
        join public.businesses b on b.id = bk.business_id
        where split_part(name, '/', 2) = bk.id::text
          and b.owner_id = auth.uid()
      )
      -- Admin can read all proofs
      or public.is_admin()
    )
  );

notify pgrst, 'reload schema';

