-- ============================================================
-- Sonnaع — Favorites / shortlist
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  factory_id uuid not null references public.factories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, factory_id)
);
alter table public.favorites enable row level security;

drop policy if exists favorites_select on public.favorites;
drop policy if exists favorites_insert on public.favorites;
drop policy if exists favorites_delete on public.favorites;

-- You only ever see and manage your own shortlist.
create policy favorites_select on public.favorites for select using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert with check (user_id = auth.uid());
create policy favorites_delete on public.favorites for delete using (user_id = auth.uid());
