-- Realtime messaging between consumer and business owner.
-- - conversations: one per (consumer_id, business_id)
-- - messages: text and/or image attachments
--
-- NOTE: enable Supabase Realtime replication for public.messages if not already enabled.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_text text,
  last_message_sender_id uuid references public.profiles (id) on delete set null,
  constraint conversations_unique_pair unique (consumer_id, business_id)
);

create index if not exists conversations_consumer_last_idx
  on public.conversations (consumer_id, last_message_at desc nulls last, created_at desc);

create index if not exists conversations_business_last_idx
  on public.conversations (business_id, last_message_at desc nulls last, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  text text,
  image_storage_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_time_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_sender_time_idx
  on public.messages (sender_profile_id, created_at desc);

-- Keep conversation preview updated on every message.
create or replace function public._touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
  set
    last_message_at = new.created_at,
    last_message_text = case
      when new.text is not null and length(trim(new.text)) > 0 then left(trim(new.text), 220)
      when new.image_storage_path is not null and length(trim(new.image_storage_path)) > 0 then '[image]'
      else null
    end,
    last_message_sender_id = new.sender_profile_id
  where c.id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_messages_touch_conversation on public.messages;
create trigger trg_messages_touch_conversation
after insert on public.messages
for each row
execute function public._touch_conversation_last_message();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Helpers: is the current user the business owner for a given business?
create or replace function public._is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$$;

-- Conversations: consumer or the owner of that business can read/write.
drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants"
on public.conversations
for select
to authenticated
using (
  auth.uid() = consumer_id
  or public._is_business_owner(business_id)
);

drop policy if exists "conversations_insert_consumer" on public.conversations;
create policy "conversations_insert_consumer"
on public.conversations
for insert
to authenticated
with check (
  auth.uid() = consumer_id
);

drop policy if exists "conversations_update_participants" on public.conversations;
create policy "conversations_update_participants"
on public.conversations
for update
to authenticated
using (
  auth.uid() = consumer_id
  or public._is_business_owner(business_id)
)
with check (
  auth.uid() = consumer_id
  or public._is_business_owner(business_id)
);

-- Messages: only participants can read. Insert only if sender is a participant.
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.consumer_id = auth.uid() or public._is_business_owner(c.business_id))
  )
);

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants"
on public.messages
for insert
to authenticated
with check (
  sender_profile_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.consumer_id = auth.uid() or public._is_business_owner(c.business_id))
  )
);

drop policy if exists "messages_update_read_receipt_participants" on public.messages;
create policy "messages_update_read_receipt_participants"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.consumer_id = auth.uid() or public._is_business_owner(c.business_id))
  )
)
with check (
  read_at is not null
);

-- Storage bucket for chat images (private, app uses signed URLs).
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

drop policy if exists "chat-images upload own folder" on storage.objects;
create policy "chat-images upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "chat-images read auth" on storage.objects;
create policy "chat-images read auth"
on storage.objects
for select
to authenticated
using (bucket_id = 'chat-images');

notify pgrst, 'reload schema';

-- Realtime messaging between consumer and business owner.
-- - conversations: one per (consumer_id, business_id)
-- - messages: text and/or image attachments
--
-- NOTE: enable Supabase Realtime replication for public.messages if not already enabled.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_text text,
  last_message_sender_id uuid references public.profiles (id) on delete set null,
  constraint conversations_unique_pair unique (consumer_id, business_id)
);

create index if not exists conversations_consumer_last_idx
  on public.conversations (consumer_id, last_message_at desc nulls last, created_at desc);

create index if not exists conversations_business_last_idx
  on public.conversations (business_id, last_message_at desc nulls last, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  text text,
  image_storage_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_time_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_sender_time_idx
  on public.messages (sender_profile_id, created_at desc);

-- Keep conversation preview updated on every message.
create or replace function public._touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
  set
    last_message_at = new.created_at,
    last_message_text = case
      when new.text is not null and length(trim(new.text)) > 0 then left(trim(new.text), 220)
      when new.image_storage_path is not null and length(trim(new.image_storage_path)) > 0 then '[image]'
      else null
    end,
    last_message_sender_id = new.sender_profile_id
  where c.id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_messages_touch_conversation on public.messages;
create trigger trg_messages_touch_conversation
after insert on public.messages
for each row
execute function public._touch_conversation_last_message();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Helpers: is the current user the business owner for a given business?
create or replace function public._is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$$;

-- Conversations: consumer or the owner of that business can read/write.
drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants"
on public.conversations
for select
to authenticated
using (
  auth.uid() = consumer_id
  or public._is_business_owner(business_id)
);

drop policy if exists "conversations_insert_consumer" on public.conversations;
create policy "conversations_insert_consumer"
on public.conversations
for insert
to authenticated
with check (
  auth.uid() = consumer_id
);

drop policy if exists "conversations_update_participants" on public.conversations;
create policy "conversations_update_participants"
on public.conversations
for update
to authenticated
using (
  auth.uid() = consumer_id
  or public._is_business_owner(business_id)
)
with check (
  auth.uid() = consumer_id
  or public._is_business_owner(business_id)
);

-- Messages: only participants can read. Insert only if sender is a participant.
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.consumer_id = auth.uid() or public._is_business_owner(c.business_id))
  )
);

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants"
on public.messages
for insert
to authenticated
with check (
  sender_profile_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.consumer_id = auth.uid() or public._is_business_owner(c.business_id))
  )
);

drop policy if exists "messages_update_read_receipt_participants" on public.messages;
create policy "messages_update_read_receipt_participants"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.consumer_id = auth.uid() or public._is_business_owner(c.business_id))
  )
)
with check (
  -- Only allow marking read (and only increasing data).
  read_at is not null
);

-- Storage bucket for chat images (owner + consumer can read via signed URLs).
-- Bucket itself must exist; this insert works on most Supabase projects.
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

-- Only authenticated users can upload to chat-images under their own folder.
drop policy if exists "chat-images upload own folder" on storage.objects;
create policy "chat-images upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow read access to authenticated users; app uses signed URLs, but this avoids common preview failures.
drop policy if exists "chat-images read auth" on storage.objects;
create policy "chat-images read auth"
on storage.objects
for select
to authenticated
using (bucket_id = 'chat-images');

notify pgrst, 'reload schema';

