-- ============================================================
-- Sonnaع — Auto-renewal + saved payment methods
--
-- Run ONCE in the Supabase SQL editor, AFTER deploying the (updated)
-- kashier-checkout, kashier-webhook and renewal-reminder Edge Functions.
-- Safe to re-run.
--
-- What this adds (the real auto-renewal you asked for):
--   * payment_methods: one saved Kashier CARD TOKEN per owner (never the card
--     number or CVV — Kashier holds those; we only keep a token + last4/brand).
--   * subscriptions.auto_renew: whether we auto-charge this owner's saved card.
--   * A daily pg_cron job -> renewal-reminder function that, a few days before
--     a plan ends, either auto-charges the saved token (opted in) or emails a
--     "renew now" link (everyone else).
--
-- Requires pg_cron + pg_net (Database -> Extensions).
-- ============================================================

-- ---------- Saved cards (Kashier tokens) ----------
create table if not exists public.payment_methods (
  owner uuid primary key references auth.users(id) on delete cascade,
  card_token text not null,          -- Kashier card token (safe to store)
  card_brand text,                   -- e.g. VISA / MASTERCARD
  card_last4 text,                   -- last 4 digits, for display only
  card_exp text,                     -- MM/YY, for display only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
-- Owners may read and delete their own saved card. Inserts/updates happen only
-- through the security-definer RPC below (called by the payment webhook), so a
-- client can never write a token directly.
drop policy if exists pm_select on public.payment_methods;
create policy pm_select on public.payment_methods for select using (owner = auth.uid());
drop policy if exists pm_delete on public.payment_methods;
create policy pm_delete on public.payment_methods for delete using (owner = auth.uid());

-- ---------- New columns ----------
alter table public.subscriptions add column if not exists auto_renew boolean not null default false;
alter table public.subscriptions add column if not exists renewal_reminded_at timestamptz;

alter table public.payment_intents add column if not exists save_card boolean not null default false;
alter table public.payment_intents add column if not exists auto_renew boolean not null default false;

-- ---------- Store the card token after a successful payment ----------
-- Called by kashier-webhook AFTER apply_subscription_payment. Reads the intent
-- to learn who paid and whether they opted in, then upserts the token and sets
-- auto_renew on the just-created active subscription.
create or replace function public.store_payment_method(
  p_ref text, p_card_token text, p_card_brand text default null,
  p_card_last4 text default null, p_card_exp text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pi public.payment_intents;
begin
  select * into pi from public.payment_intents where ref = p_ref;
  if not found then return; end if;

  -- Save the token only if the buyer ticked "save card" AND Kashier returned one.
  if pi.save_card and p_card_token is not null and p_card_token <> '' then
    insert into public.payment_methods(owner, card_token, card_brand, card_last4, card_exp, updated_at)
    values (pi.owner, p_card_token, p_card_brand, p_card_last4, p_card_exp, now())
    on conflict (owner) do update set
      card_token = excluded.card_token, card_brand = excluded.card_brand,
      card_last4 = excluded.card_last4, card_exp = excluded.card_exp, updated_at = now();
  end if;

  -- Auto-renew only when they opted in AND a card is actually on file.
  update public.subscriptions s
     set auto_renew = (pi.auto_renew and exists(select 1 from public.payment_methods pm where pm.owner = pi.owner)),
         updated_at = now()
   where s.owner = pi.owner and s.status = 'active'
     and s.created_at = (select max(created_at) from public.subscriptions where owner = pi.owner and status='active');
end $$;
revoke all on function public.store_payment_method(text, text, text, text, text) from anon, authenticated;

-- ---------- Account controls ----------
create or replace function public.set_auto_renew(p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_on and not exists(select 1 from public.payment_methods where owner = auth.uid()) then
    raise exception 'A saved card is required to turn on auto-renew.';
  end if;
  update public.subscriptions set auto_renew = p_on, updated_at = now()
   where owner = auth.uid() and status = 'active';
  return true;
end $$;
grant execute on function public.set_auto_renew(boolean) to authenticated;

create or replace function public.remove_payment_method()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.payment_methods where owner = auth.uid();
  update public.subscriptions set auto_renew = false, updated_at = now()
   where owner = auth.uid() and status = 'active';
  return true;
end $$;
grant execute on function public.remove_payment_method() to authenticated;

-- ---------- Apply a successful auto-renewal charge ----------
-- Called by the renewal-reminder function (service role) after Kashier confirms
-- a token charge. Extends the period by 30 days and keeps the factory verified.
create or replace function public.apply_renewal(p_sub uuid, p_provider_ref text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare s public.subscriptions; new_end timestamptz;
begin
  select * into s from public.subscriptions where id = p_sub;
  if not found then return false; end if;
  new_end := greatest(coalesce(s.current_period_end, now()), now()) + interval '30 days';
  update public.subscriptions
     set status='active', current_period_end=new_end, renewal_reminded_at=null,
         provider_ref=coalesce(p_provider_ref, provider_ref), updated_at=now()
   where id = p_sub;
  if s.factory_id is not null then
    update public.factories set verified=true, plan=s.plan, plan_expires=new_end,
      verification_status = case when verification_status='unverified' then 'active_pending_visit' else verification_status end
     where id = s.factory_id;
    perform public.notify(s.owner, 'factory', 'Subscription renewed',
      'Your ' || initcap(coalesce(s.plan,'plan')) || ' plan was auto-renewed for another 30 days.', 'my-factory.html');
  end if;
  return true;
end $$;
revoke all on function public.apply_renewal(uuid, text) from anon, authenticated;

-- ---------- Daily renewal run (auto-charge opted-in cards + remind the rest) ----------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sonna-renewal-reminder')
  where exists (select 1 from cron.job where jobname = 'sonna-renewal-reminder');

-- Daily at 09:00 UTC.
select cron.schedule('sonna-renewal-reminder', '0 9 * * *', $$
  select net.http_post(
    url     := 'https://qtphintmxyncwlpxenha.supabase.co/functions/v1/renewal-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cGhpbnRteHluY3dscHhlbmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDA3OTksImV4cCI6MjA5OTA3Njc5OX0.B4e6ghhmUHnrN0whaEAniVpBcE8wYhqAemnUj-SE1nw'
    ),
    body    := '{}'::jsonb
  );
$$);
