-- ============================================================
-- Sonnaع — Consultation bookings (pay-to-book an industry consultant)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- Run this AFTER payments.sql and subscription_details.sql — it redefines
-- apply_subscription_payment() to also handle consultation payments, so it is
-- the canonical version of that function.
--
-- Model: the visitor fills the consultation form, pays through Kashier, and the
-- SAME signed-redirect confirm path (kashier-confirm) applies the payment. A
-- payment_intent with kind = 'consultation' points at the consultation row, so
-- on success we flip it to 'paid' and notify the submitter. Admins see every
-- booking in the admin panel to arrange the session. Payment is never trusted
-- from the browser.
-- ============================================================

-- ---------- Consultation bookings ----------
create table if not exists public.consultations (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid references auth.users(id) on delete set null,
  name         text not null,
  company      text,
  phone        text,
  whatsapp     text,
  email        text,
  sector       text,
  city         text,
  needs        text,
  preferred_at text,
  sample_urls  jsonb not null default '[]'::jsonb,   -- uploaded photos / PDFs
  amount_cents int,
  currency     text not null default 'EGP',
  status       text not null default 'pending_payment',  -- pending_payment | paid
  provider     text,
  provider_ref text,
  created_at   timestamptz not null default now()
);
create index if not exists consultations_owner_idx on public.consultations (owner, created_at desc);
alter table public.consultations enable row level security;

-- Submitter may create their own booking and read it; admins read all. The
-- flip to 'paid' happens through the service-role RPC, never from the browser.
drop policy if exists consultations_insert on public.consultations;
create policy consultations_insert on public.consultations
  for insert with check (owner = auth.uid());
drop policy if exists consultations_select on public.consultations;
create policy consultations_select on public.consultations
  for select using (owner = auth.uid() or public.is_admin());

-- ---------- Extend payment_intents to cover consultations ----------
alter table public.payment_intents add column if not exists kind text not null default 'subscription';
alter table public.payment_intents add column if not exists consultation_id uuid;

-- ---------- Apply a successful payment (subscription OR consultation) ----------
-- Called by the signature-verified confirm/webhook path (service role). This is
-- the canonical version and supersedes the definitions in payments.sql and
-- subscription_details.sql.
create or replace function public.apply_subscription_payment(p_ref text, p_provider_ref text, p_provider text default 'kashier')
returns boolean language plpgsql security definer set search_path = public as $$
declare pi public.payment_intents; f_owner uuid;
begin
  select * into pi from public.payment_intents where ref = p_ref;
  if not found then return false; end if;
  if pi.status = 'paid' then return true; end if;   -- idempotent
  update public.payment_intents set status = 'paid' where ref = p_ref;

  -- Consultation booking: mark it paid and let the submitter know.
  if pi.kind = 'consultation' then
    if pi.consultation_id is not null then
      update public.consultations
         set status = 'paid',
             provider = coalesce(p_provider, 'kashier'),
             provider_ref = p_provider_ref
       where id = pi.consultation_id;
      perform public.notify(pi.owner, 'consult',
        'Consultation booked',
        'Payment received. One of our industry consultants will contact you soon to arrange your session.',
        'index.html');
    end if;
    return true;
  end if;

  -- Subscription (default): record it and verify the factory.
  insert into public.subscriptions (owner, factory_id, plan, status, provider, provider_ref, amount_cents, currency, current_period_end, sub_name, sub_phone, sub_email)
  values (pi.owner, pi.factory_id, pi.plan, 'active', coalesce(p_provider, 'kashier'), p_provider_ref, pi.amount_cents, pi.currency, now() + interval '30 days', pi.sub_name, pi.sub_phone, pi.sub_email);

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
