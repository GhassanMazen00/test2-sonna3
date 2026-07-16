-- ============================================================
-- Sonnaع — Capture subscriber contact details (name + phone + email)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Collected at checkout, stored on the payment_intent, copied to the
-- subscription on success, so admins can contact the factory to arrange a visit.
-- ============================================================

alter table public.payment_intents add column if not exists sub_name  text;
alter table public.payment_intents add column if not exists sub_phone text;
alter table public.payment_intents add column if not exists sub_email text;
alter table public.subscriptions   add column if not exists sub_name  text;
alter table public.subscriptions   add column if not exists sub_phone text;
alter table public.subscriptions   add column if not exists sub_email text;

-- Copy the contact details from the intent onto the subscription.
create or replace function public.apply_subscription_payment(p_ref text, p_provider_ref text, p_provider text default 'kashier')
returns boolean language plpgsql security definer set search_path = public as $$
declare pi public.payment_intents; f_owner uuid;
begin
  select * into pi from public.payment_intents where ref = p_ref;
  if not found then return false; end if;
  if pi.status <> 'paid' then
    update public.payment_intents set status = 'paid' where ref = p_ref;
    insert into public.subscriptions (owner, factory_id, plan, status, provider, provider_ref, amount_cents, currency, current_period_end, sub_name, sub_phone, sub_email)
    values (pi.owner, pi.factory_id, pi.plan, 'active', coalesce(p_provider, 'kashier'), p_provider_ref, pi.amount_cents, pi.currency, now() + interval '30 days', pi.sub_name, pi.sub_phone, pi.sub_email);
  end if;
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
