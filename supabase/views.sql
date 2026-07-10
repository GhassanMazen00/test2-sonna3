-- ============================================================
-- Sonnaع — Page view counts (once per account)
-- Run this once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- One row per (item, viewer): a viewer is counted at most once per item.
-- item_type is 'factory' or 'request'; item_id is the factory/request id.
create table if not exists public.page_views (
  item_type  text not null,
  item_id    text not null,
  viewer     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_type, item_id, viewer)
);
alter table public.page_views enable row level security;
-- No direct policies: access is only via the security-definer RPCs below,
-- which never expose who viewed what — only the totals.

-- Record a view for the current user (no-op if already viewed, or if the
-- caller is anonymous) and return the item's total view count.
create or replace function public.record_view(p_type text, p_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare cnt bigint;
begin
  if auth.uid() is not null then
    insert into public.page_views (item_type, item_id, viewer)
    values (p_type, p_id, auth.uid())
    on conflict do nothing;
  end if;
  select count(*) into cnt from public.page_views
    where item_type = p_type and item_id = p_id;
  return cnt;
end;
$$;
grant execute on function public.record_view(text, text) to anon, authenticated;

-- Read-only total (used where we don't want to record a view).
create or replace function public.get_view_count(p_type text, p_id text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*) from public.page_views
    where item_type = p_type and item_id = p_id;
$$;
grant execute on function public.get_view_count(text, text) to anon, authenticated;
