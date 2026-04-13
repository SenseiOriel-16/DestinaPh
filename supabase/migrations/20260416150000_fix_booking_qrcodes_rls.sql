-- Fix Storage RLS for booking-qrcodes uploads.
-- Some projects have issues with storage.foldername(name) evaluation; use a simple prefix match instead.

drop policy if exists "booking qrcodes owner write" on storage.objects;
create policy "booking qrcodes owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-qrcodes'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and name like (b.id::text || '/%')
    )
  );

drop policy if exists "booking qrcodes owner update" on storage.objects;
create policy "booking qrcodes owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'booking-qrcodes'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and name like (b.id::text || '/%')
    )
  );

drop policy if exists "booking qrcodes owner delete" on storage.objects;
create policy "booking qrcodes owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-qrcodes'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and name like (b.id::text || '/%')
    )
  );

notify pgrst, 'reload schema';

