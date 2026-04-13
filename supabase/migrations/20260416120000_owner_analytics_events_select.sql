-- Allow business owners to read analytics events for their own listings (for client-web Analytics).

drop policy if exists "business_analytics_events owner select" on public.business_analytics_events;
create policy "business_analytics_events owner select"
  on public.business_analytics_events for select to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_analytics_events.business_id
        and b.owner_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
