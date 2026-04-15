-- Allow editing own messages, deleting messages, and deleting whole conversations.
-- Enforces: only the original sender may change body text; read-flag updates stay unrestricted for participants.

alter table public.support_messages
  add column if not exists edited_at timestamptz;

-- Only the sender may edit message body; immutable id/conversation/sender/role/created_at.
create or replace function public.support_messages_before_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  body_changed boolean := new.body is distinct from old.body;
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.sender_role is distinct from old.sender_role
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Cannot change immutable message fields';
  end if;

  if body_changed then
    if auth.uid() is distinct from old.sender_id then
      raise exception 'Only the sender can edit the message text';
    end if;
    if trim(new.body) = '' then
      raise exception 'Message cannot be empty';
    end if;
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_support_messages_before_update on public.support_messages;
create trigger trg_support_messages_before_update
before update on public.support_messages
for each row execute function public.support_messages_before_update();

-- After a message is removed, keep conversation.last_message_at in sync (also runs during CASCADE from conv delete).
create or replace function public.support_messages_after_delete_touch_conv()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations c
  set last_message_at = coalesce(
    (select max(m.created_at) from public.support_messages m where m.conversation_id = old.conversation_id),
    c.created_at
  )
  where c.id = old.conversation_id;
  return old;
end;
$$;

alter function public.support_messages_after_delete_touch_conv() set row_security = off;

drop trigger if exists trg_support_messages_after_delete_touch_conv on public.support_messages;
create trigger trg_support_messages_after_delete_touch_conv
after delete on public.support_messages
for each row execute function public.support_messages_after_delete_touch_conv();

-- DELETE: sender removes own message; admins may remove any (moderation).
drop policy if exists "support msg delete" on public.support_messages;
create policy "support msg delete"
  on public.support_messages for delete to authenticated
  using (
    public.is_admin()
    or sender_id = auth.uid()
  );

-- DELETE conversation: owner wipes their thread; admin may remove any.
drop policy if exists "support conv delete" on public.support_conversations;
create policy "support conv delete"
  on public.support_conversations for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- Realtime: UPDATE/DELETE payloads (filters) need full row identity.
alter table public.support_messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end;
$$;

notify pgrst, 'reload schema';
