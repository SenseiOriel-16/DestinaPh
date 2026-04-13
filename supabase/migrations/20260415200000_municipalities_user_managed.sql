-- Admin Municipalities screen: only rows added through the admin tool (user_managed = true).
-- Drops legacy init/PSGC seed municipalities when no business references them (municipality or barangay).

alter table public.municipalities
  add column if not exists user_managed boolean not null default false;

comment on column public.municipalities.user_managed is
  'True when created from DestinaPH Admin Municipalities form. False for PSGC RPC rows and legacy seeds.';

-- Legacy Camarines Sur seed slugs + any PSGC-style municipality slug.
delete from public.municipalities m
where m.user_managed = false
  and (
    m.slug in ('naga-city', 'pili', 'iriga-city', 'camarines-sur')
    or m.slug like 'psgc-%'
  )
  and not exists (
    select 1
    from public.businesses b
    where b.municipality_id = m.id
       or b.barangay_id in (select br.id from public.barangays br where br.municipality_id = m.id)
  );

-- Auto-slug admin rows (mun-…) are always user catalog entries.
update public.municipalities
set user_managed = true
where slug like 'mun-%';

notify pgrst, 'reload schema';
