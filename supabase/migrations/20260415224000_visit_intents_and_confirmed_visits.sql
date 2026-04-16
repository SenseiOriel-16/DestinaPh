-- Visit intent + confirmed visits (geo dwell rules applied client-side).
-- Intent is recorded when user taps Navigate / Open in Google Maps / Start navigation.
-- Confirmed visit is recorded when client proves dwell criteria and calls RPC.

create table if not exists public.user_visit_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  source text not null check (source in ('navigate', 'google_maps', 'in_app_map')),
  created_at timestamptz not null default now()
);

create index if not exists user_visit_intents_user_time_idx
  on public.user_visit_intents (user_id, created_at desc);

create table if not exists public.user_confirmed_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  intent_id uuid references public.user_visit_intents (id) on delete set null,
  method text not null default 'geo' check (method in ('geo', 'food_order_geo')),
  confirmed_at timestamptz not null default now()
);

create index if not exists user_confirmed_visits_user_time_idx
  on public.user_confirmed_visits (user_id, confirmed_at desc);

create index if not exists user_confirmed_visits_business_time_idx
  on public.user_confirmed_visits (business_id, confirmed_at desc);

alter table public.user_visit_intents enable row level security;
alter table public.user_confirmed_visits enable row level security;

-- No direct table access; use RPCs below.

create or replace function public.record_visit_intent(p_business_id uuid, p_source text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  rid uuid;
  role_text text;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select p.role into role_text from public.profiles p where p.id = uid;
  if role_text is null then
    raise exception 'profile missing';
  end if;
  if role_text <> 'consumer' then
    -- Only traveler app users generate visit intent.
    raise exception 'forbidden';
  end if;

  -- Keep existing analytics behavior (click -> intent_visit).
  perform public.track_business_metric(p_business_id, 'click');

  insert into public.user_visit_intents (user_id, business_id, source)
  values (uid, p_business_id, p_source)
  returning id into rid;

  return rid;
end;
$$;

revoke all on function public.record_visit_intent(uuid, text) from public;
grant execute on function public.record_visit_intent(uuid, text) to authenticated;

create or replace function public.record_confirmed_visit(p_business_id uuid, p_intent_id uuid default null, p_method text default 'geo')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  role_text text;
  last_confirm timestamptz;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select p.role into role_text from public.profiles p where p.id = uid;
  if role_text is null then
    raise exception 'profile missing';
  end if;
  if role_text <> 'consumer' then
    raise exception 'forbidden';
  end if;

  -- Prevent spam: only one confirm per user+business per 6 hours.
  select max(cv.confirmed_at) into last_confirm
  from public.user_confirmed_visits cv
  where cv.user_id = uid and cv.business_id = p_business_id;
  if last_confirm is not null and last_confirm >= (now() - interval '6 hours') then
    return;
  end if;

  insert into public.user_confirmed_visits (user_id, business_id, intent_id, method)
  values (uid, p_business_id, p_intent_id, p_method);

  insert into public.business_analytics_events (business_id, event_type)
  values (p_business_id, 'confirm_visit');
end;
$$;

revoke all on function public.record_confirmed_visit(uuid, uuid, text) from public;
grant execute on function public.record_confirmed_visit(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

