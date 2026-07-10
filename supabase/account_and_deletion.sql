-- ============================================================
-- Sonnaع — Account deletion + factory page deletion requests
-- Run this once in the Supabase SQL editor (after chat_and_requests.sql).
-- Safe to re-run.
-- ============================================================

-- ---------- Factory page deletion requests ----------
-- Owners can flag their factory for deletion; admins see the flag in the
-- control panel and delete it there.
alter table public.factories
  add column if not exists deletion_requested boolean not null default false;


-- ---------- Self-service account deletion ----------
-- Lets a logged-in user permanently delete their own account and all their
-- data. Runs as the function owner (security definer) so it can remove the
-- auth.users row; it only ever touches the caller's own id (auth.uid()).
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Remove the user's own data first (works regardless of FK cascade config).
  delete from public.messages  where sender = uid or recipient = uid;
  delete from public.requests  where owner = uid;
  delete from public.factories where owner = uid;
  delete from public.profiles  where id = uid;

  -- Finally remove the auth user itself.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
