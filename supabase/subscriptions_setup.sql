-- ============================================================
-- Sonnaع — CONSOLIDATED subscriptions / tiers / billing / enforcement
-- ============================================================
-- Run this ONE file (safe to re-run any time). It is the single source of
-- truth for everything subscription-related and SUPERSEDES these older files —
-- do NOT run them again, or they'll revert this logic:
--     payments.sql, subscription_details.sql, consultations.sql,
--     tiers.sql, tiers_enforce.sql, tiers_billing.sql
--
-- Prerequisites (run once, earlier — not superseded):
--     admin_and_security.sql  (public.is_admin)
--     notifications.sql       (public.notify, base notify_match)
--     chat_and_requests.sql   (messages, requests)
--     rfq.sql                 (rfqs, quotes)
-- ============================================================

-- ---------- Factories: verification + plan columns ----------
alter table public.factories add column if not exists verification_status text not null default 'unverified';
alter table public.factories add column if not exists plan         text not null default 'none';
alter table public.factories add column if not exists plan_expires  timestamptz;
update public.factories set verification_status = 'visited' where verified = true and verification_status = 'unverified';

-- Owners may write only these columns. verified / verification_status / plan /
-- plan_expires are protected (set only by the security-definer RPCs below).
revoke update on public.factories from anon, authenticated;
grant update (name, sector, gov, data, verification_requested, deletion_requested)
  on public.factories to authenticated;

-- Guard: owners can't flip the featured flag inside data.
drop trigger if exists trg_protect_factory_verified on public.factories;
create or replace function public.factories_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{featured}',
      coalesce(old.data -> 'featured', 'false'::jsonb), true);
  end if;
  return new;
end $$;
drop trigger if exists factories_guard_trg on public.factories;
create trigger factories_guard_trg before update on public.factories
  for each row execute function public.factories_guard();

-- ---------- Per-tier limits (mirrors assets/js/data.js) ----------
create table if not exists public.plan_limits (
  plan text primary key,
  photos int not null default 0, videos int not null default 0, video_max_sec int not null default 0,
  products int not null default 0, request_delay_hours int not null default 0, rfq_per_month int not null default 0
);
insert into public.plan_limits (plan, photos, videos, video_max_sec, products, request_delay_hours, rfq_per_month) values
  ('none',     0, 0,   0,       0,  0, 0),
  ('basic',    3, 0,   0,      20, 12, 20),
  ('gold',     7, 1,  60,     100,  1, 75),
  ('platinum',20, 1, 300, 1000000,  0, 1000000)
on conflict (plan) do update set
  photos=excluded.photos, videos=excluded.videos, video_max_sec=excluded.video_max_sec,
  products=excluded.products, request_delay_hours=excluded.request_delay_hours, rfq_per_month=excluded.rfq_per_month;
alter table public.plan_limits enable row level security;
drop policy if exists plan_limits_read on public.plan_limits;
create policy plan_limits_read on public.plan_limits for select using (true);

create or replace function public.plan_price_egp(p text)
returns int language sql immutable as $$
  select case p when 'basic' then 500 when 'gold' then 1200 when 'platinum' then 2500 else 0 end;
$$;

-- ---------- Subscriptions + payment intents + consultations ----------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  factory_id uuid references public.factories(id) on delete set null,
  plan text not null default 'basic',
  status text not null default 'active',        -- active | expired | cancelled
  provider text not null default 'kashier',
  provider_ref text, amount_cents int, currency text not null default 'EGP',
  current_period_end timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists subscriptions_owner_idx on public.subscriptions (owner, created_at desc);
alter table public.subscriptions add column if not exists sub_name text;
alter table public.subscriptions add column if not exists sub_phone text;
alter table public.subscriptions add column if not exists sub_email text;
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select
  using (owner = auth.uid() or public.is_admin());

create table if not exists public.payment_intents (
  ref text primary key, owner uuid not null, factory_id uuid,
  plan text not null default 'basic', amount_cents int, currency text not null default 'EGP',
  status text not null default 'pending', created_at timestamptz not null default now()
);
alter table public.payment_intents add column if not exists sub_name text;
alter table public.payment_intents add column if not exists sub_phone text;
alter table public.payment_intents add column if not exists sub_email text;
alter table public.payment_intents add column if not exists kind text not null default 'subscription';
alter table public.payment_intents add column if not exists consultation_id uuid;
alter table public.payment_intents enable row level security;

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users(id) on delete set null,
  name text not null, company text, phone text, whatsapp text, email text,
  sector text, city text, needs text, preferred_at text,
  sample_urls jsonb not null default '[]'::jsonb,
  amount_cents int, currency text not null default 'EGP',
  status text not null default 'pending_payment', provider text, provider_ref text,
  created_at timestamptz not null default now()
);
create index if not exists consultations_owner_idx on public.consultations (owner, created_at desc);
alter table public.consultations enable row level security;
drop policy if exists consultations_insert on public.consultations;
create policy consultations_insert on public.consultations for insert with check (owner = auth.uid());
drop policy if exists consultations_select on public.consultations;
create policy consultations_select on public.consultations for select using (owner = auth.uid() or public.is_admin());

-- ---------- Apply a successful payment (subscription tier OR consultation) ----------
create or replace function public.apply_subscription_payment(p_ref text, p_provider_ref text, p_provider text default 'kashier')
returns boolean language plpgsql security definer set search_path = public as $$
declare pi public.payment_intents; f_owner uuid; period_end timestamptz;
begin
  select * into pi from public.payment_intents where ref = p_ref;
  if not found then return false; end if;
  if pi.status = 'paid' then return true; end if;
  update public.payment_intents set status = 'paid' where ref = p_ref;

  if pi.kind = 'consultation' then
    if pi.consultation_id is not null then
      update public.consultations set status = 'paid', provider = coalesce(p_provider,'kashier'), provider_ref = p_provider_ref
       where id = pi.consultation_id;
      perform public.notify(pi.owner, 'consult', 'Consultation booked',
        'Payment received. One of our industry consultants will contact you soon to arrange your session.', 'index.html');
    end if;
    return true;
  end if;

  period_end := now() + interval '30 days';
  if pi.factory_id is not null then
    update public.subscriptions set status = 'cancelled', updated_at = now()
     where factory_id = pi.factory_id and status = 'active';
  end if;
  insert into public.subscriptions (owner, factory_id, plan, status, provider, provider_ref, amount_cents, currency, current_period_end, sub_name, sub_phone, sub_email)
  values (pi.owner, pi.factory_id, pi.plan, 'active', coalesce(p_provider,'kashier'), p_provider_ref, pi.amount_cents, pi.currency, period_end, pi.sub_name, pi.sub_phone, pi.sub_email);

  if pi.factory_id is not null then
    update public.factories set verified = true, plan = pi.plan, plan_expires = period_end,
      verification_status = case when verification_status = 'visited' then 'visited' else 'active_pending_visit' end
     where id = pi.factory_id;
    select owner into f_owner from public.factories where id = pi.factory_id;
    perform public.notify(coalesce(f_owner, pi.owner), 'factory', 'You''re verified — welcome aboard!',
      'Your ' || initcap(coalesce(pi.plan,'plan')) || ' subscription is active and your factory is now verified. Our team will schedule an on-site visit soon.', 'my-factory.html');
  end if;
  return true;
end $$;
revoke all on function public.apply_subscription_payment(text, text, text) from anon, authenticated;

-- ---------- Daily expiry (auto-unverify lapsed factories) ----------
create or replace function public.expire_subscriptions()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.subscriptions set status='expired', updated_at=now()
   where status='active' and current_period_end is not null and current_period_end < now();
  update public.factories f set verified=false, verification_status='unverified', plan='none', plan_expires=null
   where f.plan_expires is not null and f.plan_expires < now()
     and not exists (select 1 from public.subscriptions s where s.factory_id=f.id and s.status='active' and s.current_period_end>now());
end $$;
revoke all on function public.expire_subscriptions() from anon, authenticated;
create extension if not exists pg_cron;
select cron.unschedule('sonna-expire-subscriptions') where exists (select 1 from cron.job where jobname='sonna-expire-subscriptions');
select cron.schedule('sonna-expire-subscriptions', '0 3 * * *', $$select public.expire_subscriptions();$$);

-- ---------- Admin RPCs ----------
create or replace function public.mark_factory_visited(p_factory uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.factories set verification_status='visited', verified=true where id=p_factory;
  return true;
end $$;
grant execute on function public.mark_factory_visited(uuid) to authenticated;

create or replace function public.admin_set_verification(p_factory uuid, p_verified boolean, p_status text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.factories set verified=p_verified,
    verification_requested = case when p_verified then false else verification_requested end,
    verification_status = coalesce(p_status, case when p_verified then 'visited' else 'unverified' end)
   where id=p_factory;
  return true;
end $$;
grant execute on function public.admin_set_verification(uuid, boolean, text) to authenticated;

create or replace function public.admin_cancel_subscription(p_factory uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.subscriptions set status='cancelled', updated_at=now() where factory_id=p_factory and status='active';
  update public.factories set verified=false, verification_status='unverified', plan='none', plan_expires=null where id=p_factory;
  return true;
end $$;
grant execute on function public.admin_cancel_subscription(uuid) to authenticated;

create or replace function public.admin_extend_subscription(p_factory uuid, p_days int default 30)
returns boolean language plpgsql security definer set search_path = public as $$
declare new_end timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  new_end := greatest(coalesce((select plan_expires from public.factories where id=p_factory), now()), now()) + make_interval(days => p_days);
  update public.factories set verified=true, plan_expires=new_end,
    plan = case when plan='none' then 'basic' else plan end,
    verification_status = case when verification_status='unverified' then 'active_pending_visit' else verification_status end
   where id=p_factory;
  update public.subscriptions set status='active', current_period_end=new_end, updated_at=now()
   where factory_id=p_factory and created_at=(select max(created_at) from public.subscriptions where factory_id=p_factory);
  return true;
end $$;
grant execute on function public.admin_extend_subscription(uuid, int) to authenticated;

create or replace function public.admin_set_plan(p_factory uuid, p_plan text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_plan not in ('basic','gold','platinum') then raise exception 'bad plan'; end if;
  select owner into v_owner from public.factories where id=p_factory;
  v_end := now() + interval '30 days';
  update public.subscriptions set status='cancelled', updated_at=now() where factory_id=p_factory and status='active';
  update public.factories set plan=p_plan, verified=true, plan_expires=v_end,
    verification_status = case when verification_status='unverified' then 'active_pending_visit' else verification_status end
   where id=p_factory;
  insert into public.subscriptions (owner, factory_id, plan, status, provider, amount_cents, currency, current_period_end)
  values (v_owner, p_factory, p_plan, 'active', 'manual', public.plan_price_egp(p_plan), 'EGP', v_end);
  return true;
end $$;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;

-- ---------- Server-side tier enforcement ----------
create or replace function public.factory_enforce_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim public.plan_limits; d jsonb; el jsonb;
  out_media jsonb := '[]'::jsonb; photo_n int := 0; video_n int := 0; dur int;
  out_prod jsonb := '[]'::jsonb; prod_n int := 0;
begin
  if new.plan is null or new.plan not in ('basic','gold','platinum') then return new; end if;
  select * into lim from public.plan_limits where plan=new.plan;
  if not found then return new; end if;
  d := coalesce(new.data, '{}'::jsonb);
  if jsonb_typeof(d->'media')='array' then
    for el in select value from jsonb_array_elements(d->'media') loop
      if (el->>'type')='video' then
        dur := coalesce(nullif(el->>'dur','')::numeric,0)::int;
        if video_n < lim.videos and (lim.video_max_sec=0 or dur <= lim.video_max_sec) then out_media := out_media || el; video_n := video_n+1; end if;
      else
        if photo_n < lim.photos then out_media := out_media || el; photo_n := photo_n+1; end if;
      end if;
    end loop;
    d := jsonb_set(d, '{media}', out_media, true);
  end if;
  if jsonb_typeof(d->'productItems')='array' then
    for el in select value from jsonb_array_elements(d->'productItems') loop
      if prod_n < lim.products then out_prod := out_prod || el; prod_n := prod_n+1; end if;
    end loop;
    d := jsonb_set(d, '{productItems}', out_prod, true);
  end if;
  new.data := d;
  return new;
end $$;
drop trigger if exists factory_enforce_limits_trg on public.factories;
create trigger factory_enforce_limits_trg before insert or update on public.factories
  for each row execute function public.factory_enforce_limits();

drop policy if exists "messages_insert_self" on public.messages;
create policy "messages_insert_self" on public.messages for insert with check (
  auth.uid() = sender and sender <> recipient
  and (request_id is null or exists (
    select 1 from public.factories f join public.plan_limits pl on pl.plan=f.plan
    where f.owner=auth.uid() and f.verified=true and coalesce(f.deletion_requested,false)=false
      and f.plan in ('basic','gold','platinum')
      and exists (select 1 from public.requests r where r.id=messages.request_id and r.created_at <= now() - make_interval(hours => pl.request_delay_hours))
  ))
);

create or replace function public.quote_enforce_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; cap int; used int;
begin
  select f.plan into p from public.factories f where f.owner=new.factory_owner order by f.created_at desc limit 1;
  if p is null or p not in ('basic','gold','platinum') then return new; end if;
  select rfq_per_month into cap from public.plan_limits where plan=p;
  if cap is null or cap >= 1000000 then return new; end if;
  select count(*) into used from public.quotes where factory_owner=new.factory_owner and created_at >= date_trunc('month', now());
  if used >= cap then raise exception 'Monthly quote limit for your plan (%) reached.', cap using errcode='P0001'; end if;
  return new;
end $$;
drop trigger if exists quote_enforce_limit_trg on public.quotes;
create trigger quote_enforce_limit_trg before insert on public.quotes for each row execute function public.quote_enforce_limit();

-- ---------- Instant matching notifications: Gold & Platinum only ----------
create or replace function public.notify_match() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sector is not null then
    insert into public.notifications (user_id, type, title, body, link)
    select f.owner, 'match', 'New buyer request in your sector', coalesce(new.title,''), 'request-detail.html?id='||new.id
    from public.factories f
    where f.sector=new.sector and f.owner is not null and f.owner<>new.owner
      and f.verified=true and f.plan in ('gold','platinum');
  end if;
  return new;
end $$;
drop trigger if exists notify_match_trg on public.requests;
create trigger notify_match_trg after insert on public.requests for each row execute function public.notify_match();
