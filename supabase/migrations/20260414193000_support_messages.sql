-- Support messaging between business owners and admins.
-- Client (business owner) can message admin; admin can reply.

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create unique index if not exists support_conversations_owner_id_key
  on public.support_conversations(owner_id);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('business_owner', 'admin')),
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  is_read_by_admin boolean not null default false,
  is_read_by_owner boolean not null default false
);

create index if not exists support_messages_conversation_created_at_idx
  on public.support_messages(conversation_id, created_at);

create index if not exists support_messages_unread_admin_idx
  on public.support_messages(is_read_by_admin, created_at)
  where sender_role = 'business_owner';

create index if not exists support_messages_unread_owner_idx
  on public.support_messages(is_read_by_owner, created_at)
  where sender_role = 'admin';

create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
    set last_message_at = now()
    where id = new.conversation_id;
  return new;
end;
$$;

alter function public.touch_support_conversation() set row_security = off;

drop trigger if exists trg_support_messages_touch_conv on public.support_messages;
create trigger trg_support_messages_touch_conv
after insert on public.support_messages
for each row execute function public.touch_support_conversation();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

-- Conversations: owner can read their own; admin can read all.
drop policy if exists "support conv select" on public.support_conversations;
create policy "support conv select"
  on public.support_conversations for select
  using (owner_id = auth.uid() or public.is_admin());

-- Owner creates/ensures their conversation. Admin may also create (rare, but harmless).
drop policy if exists "support conv insert" on public.support_conversations;
create policy "support conv insert"
  on public.support_conversations for insert to authenticated
  with check (owner_id = auth.uid() or public.is_admin());

-- Keep last_message_at editable by system/admin only (client shouldn't need it).
drop policy if exists "support conv update admin" on public.support_conversations;
create policy "support conv update admin"
  on public.support_conversations for update
  using (public.is_admin())
  with check (public.is_admin());

-- Messages: owner sees messages in their conversation; admin sees all.
drop policy if exists "support msg select" on public.support_messages;
create policy "support msg select"
  on public.support_messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.owner_id = auth.uid()
    )
  );

-- Insert: sender must be current user, and must belong to the conversation (owner) or be admin.
drop policy if exists "support msg insert" on public.support_messages;
create policy "support msg insert"
  on public.support_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.support_conversations c
        where c.id = support_messages.conversation_id
          and c.owner_id = auth.uid()
      )
    )
  );

-- Update read flags: admin can mark read_by_admin, owner can mark read_by_owner.
drop policy if exists "support msg update read flags" on public.support_messages;
create policy "support msg update read flags"
  on public.support_messages for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.owner_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';

