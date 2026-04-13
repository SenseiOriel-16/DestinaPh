-- Hotfix: allow any authenticated user to upload booking QR codes.
-- Rationale: booking-qrcodes is a public bucket and QR images are not sensitive.
-- This avoids persistent 400 errors caused by policy predicates in some projects.

drop policy if exists "booking qrcodes owner write" on storage.objects;
create policy "booking qrcodes authenticated write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'booking-qrcodes');

drop policy if exists "booking qrcodes owner update" on storage.objects;
create policy "booking qrcodes authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'booking-qrcodes')
  with check (bucket_id = 'booking-qrcodes');

drop policy if exists "booking qrcodes owner delete" on storage.objects;
create policy "booking qrcodes authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'booking-qrcodes');

