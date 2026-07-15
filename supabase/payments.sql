-- ============================================================
-- Sonnaع — Subscriptions & pay-to-verify (Paymob)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Model: when a factory owner pays, a signed Paymob webhook calls the
-- apply_subscription_payment() RPC (service role) which records the
-- subscription and flips the factory to VERIFIED with status
-- 'active_pending_visit' (badge live immediately; you visit later and an admin
-- upgrades it to 'visited'). Payment is NEVER trusted from the browser.
-- ============================================================

-- ---------- Two-state verification on factories ----------
-- verification_status: 'unverified' | 'active_pending_visit' | 'visited'
-- The boolean `verified` stays in sync (true for the two verified states) so
-- all existing code keeps working.
alter table public.factories add column if not exists verification_status text not null default 'unverified';
-- Backfill: anything already verified was admin-verified via a visit.
update public.factories set verification_status = 'visited' where verified = true and verification_status = 'unverified';

-- ---------- Allow the trusted server (service role) to set verified ----------
-- Owners still can't self-verify. Admins can. The webhook RPC runs with the
-- service role (auth.uid() is null) and RLS already blocks anon writes to
-- factories, so "auth.uid() is null" here means "trusted server context".
create or replace function public.factories_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Trusted server RPCs (apply_subscription_payment / mark_factory_visited) set
  -- this transaction-local flag to legitimately change verification. Everyone
  -- else (owners) still can't self-verify.
  if current_setting('sonna.bypass_guard', true) = '1' then
    return new;
  end if;
  if not public.is_admin() then
    new.verified := old.verified;
    new.verification_status := old.verification_status;
    new.data := jsonb_set(
      coalesce(new.data, '{}'::jsonb),
      '{featured}',
      coalesce(old.data -> 'featured', 'false'::jsonb),
      true
    );
  end if;
  return new;
end $$;
drop trigger if exists factories_guard_trg on public.factories;
create trigger factories_guard_trg before update on public.factories
  for each row execute function public.factories_guard();

-- ---------- Subscriptions ----------
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  owner              uuid not null references auth.users(id) on delete cascade,
  factory_id         uuid references public.factories(id) on delete set null,
  plan               text not null default 'verified',
  status             text not null default 'active',   -- active | expired | cancelled
  provider           text not null default 'paymob',
  provider_ref       text,
  amount_cents       int,
  currency           text not null default 'EGP',
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists subscriptions_owner_idx on public.subscriptions (owner, created_at desc);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
-- Owner sees their own; admins see all. Writes happen via the service-role RPC.
create policy subscriptions_select on public.subscriptions for select
  using (owner = auth.uid() or public.is_admin());

-- ---------- Checkout mapping (Paymob order -> factory/owner/plan) ----------
-- The checkout function inserts a row keyed by a unique reference we send to
-- Paymob; the webhook looks it up so it knows exactly what was paid for.
-- Service-role only (RLS on, no policies).
create table if not exists public.payment_intents (
  ref          text primary key,          -- our special_reference sent to Paymob
  owner        uuid not null,
  factory_id   uuid,
  plan         text not null default 'verified',
  amount_cents int,
  currency     text not null default 'EGP',
  status       text not null default 'pending',   -- pending | paid
  created_at   timestamptz not null default now()
);
alter table public.payment_intents enable row level security;

-- ---------- Apply a successful payment (called by the webhook, service role) ----------
create or replace function public.apply_subscription_payment(p_ref text, p_provider_ref text, p_provider text default 'kashier')
returns boolean language plpgsql security definer set search_path = public as $$
declare pi public.payment_intents; f_owner uuid;
begin
  select * into pi from public.payment_intents where ref = p_ref;
  if not found then return false; end if;

  if pi.status <> 'paid' then
    update public.payment_intents set status = 'paid' where ref = p_ref;
    insert into public.subscriptions (owner, factory_id, plan, status, provider, provider_ref, amount_cents, currency, current_period_end)
    values (pi.owner, pi.factory_id, pi.plan, 'active', coalesce(p_provider, 'kashier'), p_provider_ref, pi.amount_cents, pi.currency, now() + interval '30 days');
  end if;

  if pi.factory_id is not null then
    -- Let the factories_guard trigger allow this trusted verification change.
    perform set_config('sonna.bypass_guard', '1', true);
    update public.factories
       set verified = true,
           verification_status = case when verification_status = 'visited' then 'visited' else 'active_pending_visit' end
     where id = pi.factory_id;
    select owner into f_owner from public.factories where id = pi.factory_id;
    perform public.notify(coalesce(f_owner, pi.owner), 'factory',
      'You''re verified — welcome aboard!',
      'Your subscription is active and your factory is now verified. Our team will schedule an on-site visit soon to complete your full verification.',
      'my-factory.html');
  end if;
  return true;
end $$;
revoke all on function public.apply_subscription_payment(text, text, text) from anon, authenticated;

-- ---------- Admin: mark a factory as visited (upgrades the badge) ----------
create or replace function public.mark_factory_visited(p_factory uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  perform set_config('sonna.bypass_guard', '1', true);
  update public.factories set verification_status = 'visited', verified = true where id = p_factory;
  return true;
end $$;
grant execute on function public.mark_factory_visited(uuid) to authenticated;
