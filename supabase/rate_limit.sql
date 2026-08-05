-- ============================================================
-- Sonnaع — Anti-spam rate limits on posting
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- BEFORE-INSERT guards that cap how much a single account can post per hour.
-- The app surfaces the raised message through its normal error handling.
-- ============================================================

-- Buyer requests: max 10 per hour per account.
create or replace function public.rl_requests() returns trigger
language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  select count(*) into cnt from public.requests
   where owner = new.owner and created_at > now() - interval '1 hour';
  if cnt >= 10 then
    raise exception 'Too many requests in a short time. Please try again later.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists rl_requests_trg on public.requests;
create trigger rl_requests_trg before insert on public.requests
  for each row execute function public.rl_requests();

-- Quote requests (RFQs): max 20 per hour per buyer.
create or replace function public.rl_rfqs() returns trigger
language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  select count(*) into cnt from public.rfqs
   where buyer = new.buyer and created_at > now() - interval '1 hour';
  if cnt >= 20 then
    raise exception 'Too many quote requests in a short time. Please try again later.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists rl_rfqs_trg on public.rfqs;
create trigger rl_rfqs_trg before insert on public.rfqs
  for each row execute function public.rl_rfqs();

-- Factory quotes: max 40 per hour per factory owner.
create or replace function public.rl_quotes() returns trigger
language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  select count(*) into cnt from public.quotes
   where factory_owner = new.factory_owner and created_at > now() - interval '1 hour';
  if cnt >= 40 then
    raise exception 'Too many quotes in a short time. Please try again later.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists rl_quotes_trg on public.quotes;
create trigger rl_quotes_trg before insert on public.quotes
  for each row execute function public.rl_quotes();
