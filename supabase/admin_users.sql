-- ============================================================
-- Sonnaع — Admin: full user directory + request management
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- The admin panel needs to see EVERY registered user (with their email, which
-- lives in auth.users and is not exposed through the normal API) plus what they
-- are on the platform: a factory owner, a buyer who posts requests, or a
-- passive sign-up. admin_list_users() joins it all together behind an is_admin()
-- guard so only admins can read it.
-- ============================================================

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  user_role text,          -- buyer | supplier | both | null (what they picked at sign-up)
  company text,
  phone text,
  created_at timestamptz,   -- when they registered
  last_sign_in timestamptz,
  has_factory boolean,      -- owns at least one factory page
  factory_verified boolean, -- owns a verified (paid) factory
  plan text,                -- current plan of their verified factory
  request_count bigint,     -- how many manufacturing requests they posted
  sub_status text           -- latest subscription status
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select
    u.id,
    u.email::text,
    p.full_name,
    p.user_role,
    p.company,
    p.phone,
    u.created_at,
    u.last_sign_in_at,
    exists(select 1 from public.factories f where f.owner = u.id),
    exists(select 1 from public.factories f where f.owner = u.id and f.verified),
    (select f.plan from public.factories f where f.owner = u.id and f.verified
       order by f.created_at desc limit 1),
    (select count(*) from public.requests r where r.owner = u.id),
    (select s.status from public.subscriptions s where s.owner = u.id
       order by s.created_at desc limit 1)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end $$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Let admins manage (and delete) any buyer request from the panel.
drop policy if exists requests_admin_all on public.requests;
create policy requests_admin_all on public.requests
  for all using (public.is_admin()) with check (public.is_admin());
