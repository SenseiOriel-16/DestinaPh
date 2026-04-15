-- Body edits only within 5 minutes of message creation (UI matches this rule).

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
    if now() > old.created_at + interval '5 minutes' then
      raise exception 'Message can only be edited within 5 minutes of sending';
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

notify pgrst, 'reload schema';
