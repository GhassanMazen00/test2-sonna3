-- ============================================================
-- Sonnaع — One-shot fix: make paid factories actually verify
-- Run this WHOLE script once in the Supabase SQL editor.
--
-- It (1) makes the factories_guard honor the trusted-server bypass flag,
-- (2) ensures apply_subscription_payment sets that flag, and (3) retroactively
-- verifies any factory that already has an active subscription. Safe to re-run.
-- ============================================================

-- 1) Guard honors the bypass flag; owners still can't self-verify.
create or replace function public.factories_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('sonna.bypass_guard', true) = '1' then
    return new;
  end if;
  if not public.is_admin() then
    new.verified := old.verified;
    new.verification_status := old.verification_status;
    new.data := jsonb_set(
      coalesce(new.data, '{}'::jsonb), '{featured}',
      coalesce(old.data -> 'featured', 'false'::jsonb), true);
  end if;
  return new;
end $$;

drop trigger if exists factories_guard_trg on public.factories;
create trigger factories_guard_trg before update on public.factories
  for each row execute function public.factories_guard();

-- 2) The webhook/confirm RPC sets the flag before flipping verification.
create or replace function public.apply_subscription_payment(p_ref text, p_provider_ref text, p_provider text default 'kashier')
returns boolean language plpgsql security definer set search_path = public as $$
declare pi public.payment_intents; f_owner uuid;
begin
  select * into pi from public.payment_intents where ref = p_ref;
  if not found then return false; end if;
  if pi.status = 'paid' then return true; end if;

  update public.payment_intents set status = 'paid' where ref = p_ref;
  perform set_config('sonna.bypass_guard', '1', true);

  insert into public.subscriptions (owner, factory_id, plan, status, provider, provider_ref, amount_cents, currency, current_period_end)
  values (pi.owner, pi.factory_id, pi.plan, 'active', coalesce(p_provider, 'kashier'), p_provider_ref, pi.amount_cents, pi.currency, now() + interval '30 days');

  if pi.factory_id is not null then
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

-- 3) Retroactively verify every factory that already has an active subscription.
select set_config('sonna.bypass_guard', '1', false);
update public.factories f
   set verified = true,
       verification_status = case when f.verification_status = 'visited' then 'visited'
                                  else 'active_pending_visit' end
 where exists (select 1 from public.subscriptions s where s.factory_id = f.id and s.status = 'active');
select set_config('sonna.bypass_guard', '0', false);

-- 4) Confirm: these should now be verified.
select f.id, f.name, f.verified, f.verification_status
from public.factories f
join public.subscriptions s on s.factory_id = f.id and s.status = 'active';
