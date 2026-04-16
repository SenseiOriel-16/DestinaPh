-- Owner/admin helper: rating breakdown counts (5→1 stars) for one listing.
-- Used by client-web Manage Listings dropdown.

create or replace function public.business_rating_breakdown(p_business_id uuid)
returns table (
  stars int,
  count int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  ok boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id = p_business_id
        and b.owner_id = auth.uid()
    )
  into ok;

  if not ok then
    raise exception 'forbidden';
  end if;

  return query
  with agg as (
    select br.stars::int as stars, count(*)::int as count
    from public.business_ratings br
    where br.business_id = p_business_id
    group by br.stars
  )
  select s.stars, coalesce(a.count, 0)::int as count
  from generate_series(1, 5) as s(stars)
  left join agg a on a.stars = s.stars
  order by s.stars desc;
end;
$$;

revoke all on function public.business_rating_breakdown(uuid) from public;
grant execute on function public.business_rating_breakdown(uuid) to authenticated;

notify pgrst, 'reload schema';

