-- Support conversations: allow per-side "clear/delete" without affecting the other party.

alter table public.support_conversations
  add column if not exists owner_cleared_at timestamptz,
  add column if not exists admin_cleared_at timestamptz;

-- Allow owners to update their own conversation (to clear it).
drop policy if exists "support conv update owner" on public.support_conversations;
create policy "support conv update owner"
  on public.support_conversations for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

notify pgrst, 'reload schema';

