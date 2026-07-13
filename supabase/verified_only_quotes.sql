-- ============================================================
-- Sonnaع — Only VERIFIED factories may reply to buyer RFQs (send quotes)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Enforces the plan rule at the database level so it can't be bypassed from
-- the client: a quote is only accepted if the factory the RFQ is addressed to
-- is verified. The UI (dashboard) also hides the reply button for unverified
-- factories, but this is the real guard.
-- ============================================================

drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert on public.quotes for insert with check (
  factory_owner = auth.uid()
  and factory_owner = (select factory_owner from public.rfqs where id = rfq_id)
  -- the addressed factory must be verified
  and exists (
    select 1
    from public.rfqs r
    join public.factories f on f.id = r.factory_id
    where r.id = rfq_id and f.verified = true
  )
);
