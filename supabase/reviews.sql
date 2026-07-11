-- ============================================================
-- Sonnaع — Reviews (proof-of-interaction) + response stats
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- A user can only review a factory they have actually messaged (there is a
-- message from them to the factory's owner). This is enforced in RLS, so it
-- can't be bypassed from the client.
-- ============================================================

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  factory_id    uuid not null references public.factories(id) on delete cascade,
  reviewer      uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null default '',
  rating        int  not null check (rating between 1 and 5),
  body          text not null default '',
  created_at    timestamptz not null default now(),
  unique (factory_id, reviewer)     -- one review per user per factory
);
create index if not exists reviews_factory_idx on public.reviews (factory_id, created_at desc);
alter table public.reviews enable row level security;

drop policy if exists reviews_select on public.reviews;
drop policy if exists reviews_insert on public.reviews;
drop policy if exists reviews_update on public.reviews;
drop policy if exists reviews_delete on public.reviews;

-- Reviews are public.
create policy reviews_select on public.reviews for select using (true);

-- Insert only as yourself, valid rating, NOT your own factory, and only if you
-- have messaged the factory's owner (proof of interaction).
create policy reviews_insert on public.reviews for insert with check (
  reviewer = auth.uid()
  and rating between 1 and 5
  and (select owner from public.factories where id = factory_id) <> auth.uid()
  and exists (
    select 1 from public.messages m
    where m.sender = auth.uid()
      and m.recipient = (select owner from public.factories where id = factory_id)
  )
);

-- Edit / remove your own review (admins can remove any).
create policy reviews_update on public.reviews for update
  using (reviewer = auth.uid()) with check (reviewer = auth.uid() and rating between 1 and 5);
create policy reviews_delete on public.reviews for delete
  using (reviewer = auth.uid() or public.is_admin());


-- Aggregate rating per factory (public) — used on cards and profiles.
create or replace view public.factory_ratings as
  select factory_id, round(avg(rating)::numeric, 1) as avg, count(*)::int as cnt
  from public.reviews
  group by factory_id;
grant select on public.factory_ratings to anon, authenticated;


-- Response stats for a factory owner, computed from message threads. Returns
-- only aggregates (rate %, avg first-reply minutes, thread count) — never any
-- message content. Security-definer so it can read messages.
create or replace function public.factory_response_stats(p_owner uuid)
returns json language sql stable security definer set search_path = public as $$
  with inbound as (
    select sender as buyer, min(created_at) as first_in
    from public.messages
    where recipient = p_owner and sender <> p_owner
    group by sender
  ),
  firstreply as (
    select i.buyer, i.first_in,
      (select min(m.created_at) from public.messages m
        where m.sender = p_owner and m.recipient = i.buyer and m.created_at >= i.first_in) as first_reply
    from inbound i
  )
  select json_build_object(
    'threads', (select count(*) from inbound),
    'replied', (select count(*) from firstreply where first_reply is not null),
    'rate',    (select case when count(*) = 0 then null
                   else round(100.0 * count(*) filter (where first_reply is not null) / count(*)) end
                from firstreply),
    'avg_minutes', (select round(avg(extract(epoch from (first_reply - first_in)) / 60))
                    from firstreply where first_reply is not null)
  );
$$;
grant execute on function public.factory_response_stats(uuid) to anon, authenticated;
