-- Resolve PSGC-style location picks into taxonomy rows (UUIDs) for businesses FKs.
-- Slugs: psgc-{provinceCode}, psgc-{municipalityCode}, psgc-{barangayCode}

create or replace function public.ensure_address_from_psgc(
  p_province_code text,
  p_municipality_code text,
  p_barangay_code text,
  p_province_name text,
  p_municipality_name text,
  p_barangay_name text
)
returns table (out_province_id uuid, out_municipality_id uuid, out_barangay_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prov_code text := nullif(trim(p_province_code), '');
  v_mun_code text := nullif(trim(p_municipality_code), '');
  v_brgy_code text := nullif(trim(p_barangay_code), '');
  v_prov_slug text;
  v_mun_slug text;
  v_brgy_slug text;
  v_pid uuid;
  v_mid uuid;
  v_bid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'business_owner'
      and p.owner_approval_status = 'approved'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Only approved business owners can save listings';
  end if;

  if v_prov_code is null or v_mun_code is null then
    raise exception 'Province and city/municipality are required';
  end if;

  v_prov_slug := 'psgc-' || v_prov_code;
  v_mun_slug := 'psgc-' || v_mun_code;
  if v_brgy_code is not null then
    v_brgy_slug := 'psgc-' || v_brgy_code;
  else
    v_brgy_slug := null;
  end if;

  insert into public.provinces (name, slug)
  values (trim(p_province_name), v_prov_slug)
  on conflict (slug) do update
    set name = excluded.name
  returning id into v_pid;

  insert into public.municipalities (province_id, name, slug)
  values (v_pid, trim(p_municipality_name), v_mun_slug)
  on conflict (slug) do update
    set name = excluded.name,
        province_id = excluded.province_id
  returning id into v_mid;

  if v_brgy_slug is not null and trim(coalesce(p_barangay_name, '')) <> '' then
    insert into public.barangays (municipality_id, name, slug)
    values (v_mid, trim(p_barangay_name), v_brgy_slug)
    on conflict (municipality_id, slug) do update
      set name = excluded.name
    returning id into v_bid;
  else
    v_bid := null;
  end if;

  return query select v_pid, v_mid, v_bid;
end;
$$;

revoke all on function public.ensure_address_from_psgc(text, text, text, text, text, text) from public;
grant execute on function public.ensure_address_from_psgc(text, text, text, text, text, text) to authenticated;
