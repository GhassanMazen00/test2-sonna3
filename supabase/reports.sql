-- ============================================================
-- Sonnaع — Report system (factories, requests, messages)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter      uuid references auth.users(id) on delete set null,
  reporter_name text not null default '',
  target_type   text not null,               -- 'factory' | 'request' | 'message'
  target_id     text not null,
  reason        text not null default '',     -- a ready-made reason or a custom one
  details       text not null default '',
  context       text not null default '',     -- name/title/excerpt of the target (admin aid)
  status        text not null default 'open', -- open | resolved | dismissed
  created_at    timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;

drop policy if exists reports_insert on public.reports;
drop policy if exists reports_select on public.reports;
drop policy if exists reports_update on public.reports;
drop policy if exists reports_delete on public.reports;

-- Any logged-in user can file a report (as themselves). Only admins can read
-- and manage them.
create policy reports_insert on public.reports for insert with check (reporter = auth.uid());
create policy reports_select on public.reports for select using (public.is_admin());
create policy reports_update on public.reports for update using (public.is_admin()) with check (public.is_admin());
create policy reports_delete on public.reports for delete using (public.is_admin());
