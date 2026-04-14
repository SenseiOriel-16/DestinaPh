-- So Realtime UPDATE payloads include full old row (e.g. old.stars vs new.stars) for owner notifications.
alter table public.business_ratings replica identity full;
