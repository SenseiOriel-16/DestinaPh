-- Consumer usernames on profiles + resolve username → email for password login (Supabase signInWithPassword requires email).

alter table public.profiles
  add column if not exists username text;

drop index if exists public.profiles_username_lower_idx;

create unique index profiles_username_lower_idx
  on public.profiles (lower(trim(username)))
  where username is not null and btrim(username) <> '';

-- Map "email or username" to the auth email used by signInWithPassword.
create or replace function public.login_identifier_to_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v text := trim(p_identifier);
  v_email text;
begin
  if v = '' then
    return null;
  end if;
  if position('@' in v) > 0 then
    return lower(v);
  end if;
  select au.email into v_email
  from auth.users au
  inner join public.profiles p on p.id = au.id
  where p.username is not null
    and lower(trim(p.username)) = lower(v)
  limit 1;
  return v_email;
end;
$$;

revoke all on function public.login_identifier_to_email(text) from public;
grant execute on function public.login_identifier_to_email(text) to anon, authenticated;

-- Optional pre-check for sign-up UX (not security-critical).
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.profiles p
    where p.username is not null
      and btrim(p.username) <> ''
      and lower(trim(p.username)) = lower(trim(p_username))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_role text := coalesce(new.raw_user_meta_data->>'role', 'consumer');
  approval text := 'approved';
  uname text := nullif(trim(lower(coalesce(new.raw_user_meta_data->>'username', ''))), '');
begin
  if desired_role not in ('admin', 'business_owner', 'consumer') then
    desired_role := 'consumer';
  end if;

  if desired_role = 'business_owner' then
    approval := 'pending';
  end if;

  insert into public.profiles (
    id,
    full_name,
    username,
    role,
    owner_approval_status,
    registration_business_name,
    registration_phone
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    uname,
    desired_role,
    approval,
    nullif(trim(coalesce(new.raw_user_meta_data->>'business_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '')
  );
  return new;
end;
$$;
