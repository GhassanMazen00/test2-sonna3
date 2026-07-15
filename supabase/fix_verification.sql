-- ============================================================
-- Sonnaع — Complete verification fix. Run the WHOLE script once
-- in the Supabase SQL editor. Safe to re-run.
--
-- Sets BOTH the guard and the payment RPC to their correct versions, then
-- retroactively verifies any factory that already has an active subscription.
-- ============================================================

-- 1) Guard: trusted RPCs may verify (via the bypass flag). Owners still can't.
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

-- 2) Payment RPC: sets the flag (works because a function is one transaction).
--    Also re-flips the factory even if the payment was already recorded, so a
--    previously-stuck payment heals on the next call.
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

-- 3) Retroactively verify existing paid factories. The SQL editor runs pooled
--    statements, so the flag won't reach the trigger here — disable it instead.
alter table public.factories disable trigger user;
update public.factories
   set verified = true,
       verification_status = case when verification_status = 'visited' then 'visited' else 'active_pending_visit' end
 where id in (select factory_id from public.subscriptions where status = 'active' and factory_id is not null);
alter table public.factories enable trigger user;

-- 4) Confirm
select id, name, verified, verification_status from public.factories order by created_at desc limit 10;
