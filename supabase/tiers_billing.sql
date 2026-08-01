-- ============================================================
-- Sonnaع — Subscription billing tweaks
-- Run ONCE in the Supabase SQL editor, AFTER tiers.sql. Safe to re-run.
--
--  • Granting a tier manually (admin) now records a subscription row with a
--    start (created_at) and end (current_period_end) date, so it shows up in
--    the admin Subscriptions tab like a paid one.
--  • Changing a plan (paid OR manual) cancels the previous active subscription
--    first, then starts a fresh one with a new 30-day period.
-- ============================================================

-- Amounts mirror the display prices (whole EGP, matching kashier-checkout).
create or replace function public.plan_price_egp(p text)
returns int language sql immutable as $$
  select case p when 'basic' then 500 when 'gold' then 1200 when 'platinum' then 2500 else 0 end;
$$;

-- ---------- Admin: grant / change a tier manually (no payment) ----------
create or replace function public.admin_set_plan(p_factory uuid, p_plan text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_plan not in ('basic','gold','platinum') then raise exception 'bad plan'; end if;
  select owner into v_owner from public.factories where id = p_factory;
  v_end := now() + interval '30 days';

  -- End any current subscription, then start a fresh one.
  update public.subscriptions set status = 'cancelled', updated_at = now()
   where factory_id = p_factory and status = 'active';

  update public.factories
     set plan = p_plan, verified = true, plan_expires = v_end,
         verification_status = case when verification_status = 'unverified' then 'active_pending_visit' else verification_status end
   where id = p_factory;

  insert into public.subscriptions (owner, factory_id, plan, status, provider, amount_cents, currency, current_period_end)
  values (v_owner, p_factory, p_plan, 'active', 'manual', public.plan_price_egp(p_plan), 'EGP', v_end);
  return true;
end $$;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;

-- ---------- Apply a successful payment (cancels the prior plan on change) ----------
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

  -- Subscription tier: cancel any current one, then start a fresh 30-day period.
  period_end := now() + interval '30 days';
  if pi.factory_id is not null then
    update public.subscriptions set status = 'cancelled', updated_at = now()
     where factory_id = pi.factory_id and status = 'active';
  end if;

  insert into public.subscriptions (owner, factory_id, plan, status, provider, provider_ref, amount_cents, currency, current_period_end, sub_name, sub_phone, sub_email)
  values (pi.owner, pi.factory_id, pi.plan, 'active', coalesce(p_provider, 'kashier'), p_provider_ref, pi.amount_cents, pi.currency, period_end, pi.sub_name, pi.sub_phone, pi.sub_email);

  if pi.factory_id is not null then
    update public.factories
       set verified = true, plan = pi.plan, plan_expires = period_end,
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
