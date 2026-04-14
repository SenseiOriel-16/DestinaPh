-- Thesis / demo: allow travelers to create booking rows for any approved listing (not only is_premium).

drop policy if exists "bookings insert consumer" on public.bookings;
create policy "bookings insert consumer"
  on public.bookings for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'consumer'
    )
    and exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.status = 'approved'
    )
    and status in ('pending_review', 'requested')
  );

notify pgrst, 'reload schema';
