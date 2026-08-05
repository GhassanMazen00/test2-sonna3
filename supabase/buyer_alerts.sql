-- ============================================================
-- Sonnaع — Buyer alerts (follow a sector, get notified of new factories)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- Requires notifications.sql (notifications table) and the factories table.
--
-- A buyer follows a manufacturing sector; when a factory in that sector
-- becomes verified, they get a notification (which also fans out to push /
-- email through the existing notifications pipeline).
-- ============================================================

create table if not exists public.buyer_alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  sector     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, sector)
);
alter table public.buyer_alerts enable row level security;

drop policy if exists buyer_alerts_rw on public.buyer_alerts;
create policy buyer_alerts_rw on public.buyer_alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Follow / unfollow a sector (idempotent).
create or replace function public.add_buyer_alert(p_sector text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(p_sector, '') = '' then return; end if;
  insert into public.buyer_alerts (user_id, sector) values (auth.uid(), p_sector)
  on conflict (user_id, sector) do nothing;
end $$;
grant execute on function public.add_buyer_alert(text) to authenticated;

-- Notify following buyers when a factory becomes verified (false -> true).
create or replace function public.notify_new_factory() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verified = true and coalesce(old.verified, false) = false and new.sector is not null then
    insert into public.notifications (user_id, type, title, body, link)
    select distinct a.user_id, 'newfactory', 'New factory in a sector you follow',
           coalesce(new.name, 'A factory') || ' just joined',
           'factory-detail.html?id=' || new.id
    from public.buyer_alerts a
    where a.sector = new.sector and a.user_id <> new.owner;
  end if;
  return new;
end $$;
drop trigger if exists notify_new_factory_trg on public.factories;
create trigger notify_new_factory_trg after update on public.factories
  for each row execute function public.notify_new_factory();
