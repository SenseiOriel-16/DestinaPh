-- Enable Supabase Realtime replication for owner rating notifications.
-- Required so `postgres_changes` subscriptions receive INSERT/UPDATE/DELETE events.
do $$
begin
  -- Supabase default publication used by Realtime.
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'business_ratings'
  ) then
    alter publication supabase_realtime add table public.business_ratings;
  end if;
end;
$$;

