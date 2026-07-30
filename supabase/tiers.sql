-- ============================================================
-- Sonnaع — Subscription tiers (Basic / Gold / Platinum)
-- Run ONCE in the Supabase SQL editor, AFTER payments.sql,
-- subscription_details.sql and consultations.sql. Safe to re-run.
--
-- Adds a protected `plan` + `plan_expires` to factories, charges/records the
-- chosen tier, expires lapsed subscriptions on a daily schedule, gives admins
-- manage actions, and gates instant "matching request" notifications to the
-- Gold/Platinum tiers.
-- ============================================================

-- ---------- Protected plan columns on factories ----------
-- Owners can't write these (only the safe columns are granted to authenticated,
-- so `plan`/`plan_expires` are updatable only by the security-definer RPCs).
alter table public.factories add column if not exists plan         text not null default 'none';
alter table public.factories add column if not exists plan_expires timestamptz;

-- ---------- Apply a successful payment (subscription tiers OR consultation) ----------
-- Canonical version — supersedes the definitions in payments.sql /
-- subscription_details.sql / consultations.sql.
create or replace function public.apply_subscription_payment(p_ref text, p_provider_ref text, p_provider text default 'kashier')
returns boolean language plpgsql security definer set search_path = public as $$
declare pi public.payment_intents; f_owner uuid; period_end timestamptz;
begin
  select * into pi from public.payment_intents where ref = p_ref;
  if not found then return false; end if;
  if pi.status = 'paid' then return true; end if;   -- idempotent
  update public.payment_intents set status = 'paid' where ref = p_ref;

  -- Consultation booking.
  if pi.kind = 'consultation' then
    if pi.consultation_id is not null then
      update public.consultations
         set status = 'paid', provider = coalesce(p_provider, 'kashier'), provider_ref = p_provider_ref
       where id = pi.consultation_id;
      perform public.notify(pi.owner, 'consult',
        'Consultation booked',
        'Payment received. One of our industry consultants will contact you soon to arrange your session.',
        'index.html');
    end if;
    return true;
  end if;

  -- Subscription tier: record it and verify + tag the factory with its plan.
  period_end := now() + interval '30 days';
  insert into public.subscriptions (owner, factory_id, plan, status, provider, provider_ref, amount_cents, currency, current_period_end, sub_name, sub_phone, sub_email)
  values (pi.owner, pi.factory_id, pi.plan, 'active', coalesce(p_provider, 'kashier'), p_provider_ref, pi.amount_cents, pi.currency, period_end, pi.sub_name, pi.sub_phone, pi.sub_email);

  if pi.factory_id is not null then
    update public.factories
       set verified = true,
           plan = pi.plan,
           plan_expires = period_end,
           verification_status = case when verification_status = 'visited' then 'visited' else 'active_pending_visit' end
     where id = pi.factory_id;
    select owner into f_owner from public.factories where id = pi.factory_id;
    perform public.notify(coalesce(f_owner, pi.owner), 'factory',
      'You''re verified — welcome aboard!',
      'Your ' || initcap(coalesce(pi.plan, 'plan')) || ' subscription is active and your factory is now verified. Our team will schedule an on-site visit soon.',
      'my-factory.html');
  end if;
  return true;
end $$;
revoke all on function public.apply_subscription_payment(text, text, text) from anon, authenticated;

-- ---------- Daily expiry: lapse subscriptions and downgrade factories ----------
create or replace function public.expire_subscriptions()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.subscriptions
     set status = 'expired', updated_at = now()
   where status = 'active' and current_period_end is not null and current_period_end < now();

  update public.factories f
     set verified = false, verification_status = 'unverified', plan = 'none', plan_expires = null
   where f.plan_expires is not null and f.plan_expires < now()
     and not exists (
       select 1 from public.subscriptions s
       where s.factory_id = f.id and s.status = 'active'
         and s.current_period_end is not null and s.current_period_end > now());
end $$;
revoke all on function public.expire_subscriptions() from anon, authenticated;

-- Schedule it daily at 03:00 UTC. Requires the pg_cron extension — if the next
-- two lines error, enable pg_cron in Supabase (Database → Extensions), then
-- re-run this file. Expiry still works if you call expire_subscriptions()
-- manually; the cron just automates it.
create extension if not exists pg_cron;
select cron.unschedule('sonna-expire-subscriptions')
  where exists (select 1 from cron.job where jobname = 'sonna-expire-subscriptions');
select cron.schedule('sonna-expire-subscriptions', '0 3 * * *', $$select public.expire_subscriptions();$$);

-- ---------- Admin manage actions ----------
create or replace function public.admin_cancel_subscription(p_factory uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.subscriptions set status = 'cancelled', updated_at = now()
   where factory_id = p_factory and status = 'active';
  update public.factories
     set verified = false, verification_status = 'unverified', plan = 'none', plan_expires = null
   where id = p_factory;
  return true;
end $$;
grant execute on function public.admin_cancel_subscription(uuid) to authenticated;

create or replace function public.admin_extend_subscription(p_factory uuid, p_days int default 30)
returns boolean language plpgsql security definer set search_path = public as $$
declare new_end timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  new_end := greatest(coalesce((select plan_expires from public.factories where id = p_factory), now()), now()) + make_interval(days => p_days);
  update public.factories set verified = true, plan_expires = new_end,
         plan = case when plan = 'none' then 'basic' else plan end,
         verification_status = case when verification_status = 'unverified' then 'active_pending_visit' else verification_status end
   where id = p_factory;
  update public.subscriptions set status = 'active', current_period_end = new_end, updated_at = now()
   where factory_id = p_factory
     and created_at = (select max(created_at) from public.subscriptions where factory_id = p_factory);
  return true;
end $$;
grant execute on function public.admin_extend_subscription(uuid, int) to authenticated;

create or replace function public.admin_set_plan(p_factory uuid, p_plan text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_plan not in ('basic','gold','platinum') then raise exception 'bad plan'; end if;
  update public.factories set plan = p_plan, verified = true,
         plan_expires = greatest(coalesce(plan_expires, now()), now() + interval '30 days'),
         verification_status = case when verification_status = 'unverified' then 'active_pending_visit' else verification_status end
   where id = p_factory;
  return true;
end $$;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;

-- ---------- Instant matching-request notifications: Gold & Platinum only ----------
create or replace function public.notify_match() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sector is not null then
    insert into public.notifications (user_id, type, title, body, link)
    select f.owner, 'match', 'New buyer request in your sector', coalesce(new.title, ''),
           'request-detail.html?id=' || new.id
    from public.factories f
    where f.sector = new.sector and f.owner is not null and f.owner <> new.owner
      and f.verified = true and f.plan in ('gold','platinum');
  end if;
  return new;
end $$;
drop trigger if exists notify_match_trg on public.requests;
create trigger notify_match_trg after insert on public.requests for each row execute function public.notify_match();
