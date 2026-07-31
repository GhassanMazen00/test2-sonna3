-- ============================================================
-- Sonnaع — SERVER-SIDE tier enforcement
-- Run ONCE in the Supabase SQL editor, AFTER tiers.sql. Safe to re-run.
--
-- Makes the tier limits impossible to bypass from the browser:
--  • factories: photos / videos / video length / products are capped by the
--    plan on every write (a BEFORE trigger trims anything over the limit)
--  • messages: contacting a buyer request is blocked until it's old enough for
--    the sender's tier (access-speed perk)
--  • quotes: monthly quote-reply cap per tier
--
-- These run as the database, so they hold even if someone calls the API
-- directly. (Video *length* is best-effort — the browser stamps each video's
-- duration and the server rejects anything over the cap, but true frame-level
-- verification would need media processing we don't run here.)
-- ============================================================

-- ---------- Canonical limits table (must match assets/js/data.js) ----------
create table if not exists public.plan_limits (
  plan                text primary key,
  photos              int not null default 0,
  videos              int not null default 0,
  video_max_sec       int not null default 0,
  products            int not null default 0,
  request_delay_hours int not null default 0,
  rfq_per_month       int not null default 0
);
-- 1000000 == "unlimited".
insert into public.plan_limits (plan, photos, videos, video_max_sec, products, request_delay_hours, rfq_per_month) values
  ('none',     0, 0,   0,       0, 0,  0),
  ('basic',    3, 0,   0,      20, 12, 20),
  ('gold',     7, 1,  60,     100, 1,  75),
  ('platinum',20, 1, 300, 1000000, 0,  1000000)
on conflict (plan) do update set
  photos = excluded.photos, videos = excluded.videos, video_max_sec = excluded.video_max_sec,
  products = excluded.products, request_delay_hours = excluded.request_delay_hours, rfq_per_month = excluded.rfq_per_month;

alter table public.plan_limits enable row level security;
drop policy if exists plan_limits_read on public.plan_limits;
create policy plan_limits_read on public.plan_limits for select using (true);

-- ---------- factories: cap media + products to the plan on every write ----------
create or replace function public.factory_enforce_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim public.plan_limits;
  d jsonb; el jsonb;
  out_media jsonb := '[]'::jsonb; photo_n int := 0; video_n int := 0; dur int;
  out_prod  jsonb := '[]'::jsonb; prod_n int := 0;
begin
  -- Only enforce for paid, verified factories. Unverified / expired factories
  -- are hidden anyway; don't touch their stored data.
  if new.plan is null or new.plan not in ('basic','gold','platinum') then
    return new;
  end if;
  select * into lim from public.plan_limits where plan = new.plan;
  if not found then return new; end if;
  d := coalesce(new.data, '{}'::jsonb);

  -- Media: keep photos up to lim.photos, and videos up to lim.videos whose
  -- stamped duration is within lim.video_max_sec (missing duration is allowed).
  if jsonb_typeof(d->'media') = 'array' then
    for el in select value from jsonb_array_elements(d->'media') loop
      if (el->>'type') = 'video' then
        dur := coalesce(nullif(el->>'dur','')::numeric, 0)::int;
        if video_n < lim.videos and (lim.video_max_sec = 0 or dur <= lim.video_max_sec) then
          out_media := out_media || el; video_n := video_n + 1;
        end if;
      else
        if photo_n < lim.photos then out_media := out_media || el; photo_n := photo_n + 1; end if;
      end if;
    end loop;
    d := jsonb_set(d, '{media}', out_media, true);
  end if;

  -- Products: keep up to lim.products.
  if jsonb_typeof(d->'productItems') = 'array' then
    for el in select value from jsonb_array_elements(d->'productItems') loop
      if prod_n < lim.products then out_prod := out_prod || el; prod_n := prod_n + 1; end if;
    end loop;
    d := jsonb_set(d, '{productItems}', out_prod, true);
  end if;

  new.data := d;
  return new;
end $$;
drop trigger if exists factory_enforce_limits_trg on public.factories;
create trigger factory_enforce_limits_trg before insert or update on public.factories
  for each row execute function public.factory_enforce_limits();

-- ---------- messages: verified owner + tier access-delay on request contact ----------
drop policy if exists "messages_insert_self" on public.messages;
create policy "messages_insert_self" on public.messages
  for insert with check (
    auth.uid() = sender
    and sender <> recipient
    and (
      request_id is null
      or exists (
        select 1
        from public.factories f
        join public.plan_limits pl on pl.plan = f.plan
        where f.owner = auth.uid()
          and f.verified = true
          and coalesce(f.deletion_requested, false) = false
          and f.plan in ('basic','gold','platinum')
          and exists (
            select 1 from public.requests r
            where r.id = messages.request_id
              and r.created_at <= now() - make_interval(hours => pl.request_delay_hours)
          )
      )
    )
  );

-- ---------- quotes: per-tier monthly reply cap ----------
create or replace function public.quote_enforce_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; cap int; used int;
begin
  select f.plan into p from public.factories f where f.owner = new.factory_owner
   order by f.created_at desc limit 1;
  if p is null or p not in ('basic','gold','platinum') then return new; end if;
  select rfq_per_month into cap from public.plan_limits where plan = p;
  if cap is null or cap >= 1000000 then return new; end if;   -- unlimited
  select count(*) into used from public.quotes
   where factory_owner = new.factory_owner and created_at >= date_trunc('month', now());
  if used >= cap then
    raise exception 'Monthly quote limit for your plan (%) reached.', cap using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists quote_enforce_limit_trg on public.quotes;
create trigger quote_enforce_limit_trg before insert on public.quotes
  for each row execute function public.quote_enforce_limit();
