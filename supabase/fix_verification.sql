-- ============================================================
-- Sonnaع — Verification fix (v3, bulletproof: column privileges)
-- Run the WHOLE script once in the Supabase SQL editor. Safe to re-run.
--
-- No more trigger races or bypass flags. Owners simply lack permission to
-- change `verified` / `verification_status`; only the payment RPC and admin
-- RPCs (which run as the DB owner) can. The guard trigger now only protects
-- the `featured` flag inside `data`.
-- ============================================================

-- 1) Guard protects ONLY data.featured now.
create or replace function public.factories_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.data := jsonb_set(
      coalesce(new.data, '{}'::jsonb), '{featured}',
      coalesce(old.data -> 'featured', 'false'::jsonb), true);
  end if;
  return new;
end $$;
drop trigger if exists factories_guard_trg on public.factories;
create trigger factories_guard_trg before update on public.factories
  for each row execute function public.factories_guard();

-- 2) Owners may update only these columns. verified / verification_status are
--    off-limits to everyone except the security-definer functions below.
revoke update on public.factories from anon, authenticated;
grant update (name, sector, gov, data, verification_requested, deletion_requested)
  on public.factories to authenticated;

-- 3) Payment RPC (runs as owner → may set verified; no flag needed).
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

-- 4) Admin verify / unverify via RPC (owners/admins can't touch the columns directly now).
create or replace function public.admin_set_verification(p_factory uuid, p_verified boolean, p_status text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.factories
     set verified = p_verified,
         verification_requested = case when p_verified then false else verification_requested end,
         verification_status = coalesce(p_status, case when p_verified then 'visited' else 'unverified' end)
   where id = p_factory;
  return true;
end $$;
grant execute on function public.admin_set_verification(uuid, boolean, text) to authenticated;

-- 5) mark_factory_visited stays valid (runs as owner).
create or replace function public.mark_factory_visited(p_factory uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.factories set verification_status = 'visited', verified = true where id = p_factory;
  return true;
end $$;
grant execute on function public.mark_factory_visited(uuid) to authenticated;

-- 6) Retroactively verify existing paid factories (plain update; nothing reverts it now).
update public.factories
   set verified = true,
       verification_status = case when verification_status = 'visited' then 'visited' else 'active_pending_visit' end
 where id in (select factory_id from public.subscriptions where status = 'active' and factory_id is not null);

-- 7) Confirm
select id, name, verified, verification_status from public.factories order by created_at desc limit 10;
