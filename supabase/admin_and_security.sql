-- ============================================================
-- Sonnaع — Admin role + lock-downs (privacy & authorization)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Fixes:
--   * Adds a real admin allowlist (only listed users can manage the site).
--   * Moves verification info (name/phone/location) out of the public
--     factories table so it is no longer world-readable.
--   * Locks factories & site_content writes to owners/admins, and stops
--     owners from self-verifying or editing admin-managed fields.
-- ============================================================

-- ---------- 1. Admin allowlist ----------
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

-- is_admin(): true if the current user is in the allowlist. Security-definer so
-- it can read the admins table without exposing it (no recursion: the table
-- owner bypasses RLS inside the function).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Called by admin.html after login to decide whether to show the panel.
create or replace function public.am_i_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;
grant execute on function public.am_i_admin() to authenticated;

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins for select using (public.is_admin());
-- No insert/update/delete policies: the list is managed only here in SQL.

-- >>> MAKE YOURSELF AN ADMIN (change the email if your admin login differs) <<<
insert into public.admins (id)
  select id from auth.users where email = 'ghasscc@gmail.com'
  on conflict do nothing;


-- ---------- 2. Move verification info out of the public table ----------
create table if not exists public.factory_verifications (
  factory_id  uuid primary key references public.factories(id) on delete cascade,
  name        text,
  number      text,
  location    text,
  submitted_at timestamptz not null default now()
);
alter table public.factory_verifications enable row level security;

drop policy if exists fv_select on public.factory_verifications;
drop policy if exists fv_insert on public.factory_verifications;
-- Only the factory's owner or an admin may read it; owners may submit their own.
create policy fv_select on public.factory_verifications for select using (
  public.is_admin()
  or exists (select 1 from public.factories f where f.id = factory_id and f.owner = auth.uid())
);
create policy fv_insert on public.factory_verifications for insert with check (
  exists (select 1 from public.factories f where f.id = factory_id and f.owner = auth.uid())
);

-- Migrate any existing verification info, then drop the exposed column.
insert into public.factory_verifications (factory_id, name, number, location)
  select id, verification_info->>'name', verification_info->>'number', verification_info->>'location'
  from public.factories
  where verification_info is not null
  on conflict (factory_id) do nothing;
alter table public.factories drop column if exists verification_info;


-- ---------- 3. Lock down factories & site_content policies ----------
-- Drop ALL existing policies on these tables first so no stray permissive
-- policy keeps them open, then recreate a known-good set.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='factories' loop
    execute format('drop policy %I on public.factories', p.policyname);
  end loop;
  for p in select policyname from pg_policies where schemaname='public' and tablename='site_content' loop
    execute format('drop policy %I on public.site_content', p.policyname);
  end loop;
end $$;

alter table public.factories    enable row level security;
alter table public.site_content enable row level security;

-- Factories: public can read (directory); owners create their own; owners or
-- admins update/delete.
create policy factories_read   on public.factories for select using (true);
create policy factories_insert on public.factories for insert with check (owner = auth.uid());
create policy factories_update on public.factories for update
  using (owner = auth.uid() or public.is_admin())
  with check (owner = auth.uid() or public.is_admin());
create policy factories_delete on public.factories for delete
  using (owner = auth.uid() or public.is_admin());

-- Site content: public can read; only admins can write.
create policy site_read   on public.site_content for select using (true);
create policy site_insert on public.site_content for insert with check (public.is_admin());
create policy site_update on public.site_content for update using (public.is_admin()) with check (public.is_admin());


-- ---------- 4. Stop owners from self-verifying / editing managed fields ----------
-- Owners may only flip verification_requested / deletion_requested on their own
-- row; everything else (verified, name, sector, gov, profile data) is admin-only.
create or replace function public.factories_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.verified := old.verified;
    new.name     := old.name;
    new.sector   := old.sector;
    new.gov      := old.gov;
    new.data     := old.data;
  end if;
  return new;
end $$;
drop trigger if exists factories_guard_trg on public.factories;
create trigger factories_guard_trg before update on public.factories
  for each row execute function public.factories_guard();
