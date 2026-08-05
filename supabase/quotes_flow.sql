-- ============================================================
-- Sonnaع — Formal quote flow (accept / decline)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- Requires rfq.sql (quotes + rfqs tables).
-- ============================================================

alter table public.quotes add column if not exists status text not null default 'pending';  -- pending | accepted | declined
alter table public.quotes add column if not exists moq    text;

-- The buyer who owns the parent RFQ may accept or decline a quote. Accepting a
-- quote closes the RFQ. Runs as definer so it can update rows the buyer can't
-- write directly (quotes are owned by the factory).
create or replace function public.set_quote_status(p_quote uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rfq uuid; v_buyer uuid;
begin
  if p_status not in ('accepted', 'declined', 'pending') then return; end if;
  select q.rfq_id into v_rfq from public.quotes q where q.id = p_quote;
  if v_rfq is null then return; end if;
  select r.buyer into v_buyer from public.rfqs r where r.id = v_rfq;
  if v_buyer is null or v_buyer <> auth.uid() then return; end if;   -- only the buyer decides
  update public.quotes set status = p_status where id = p_quote;
  if p_status = 'accepted' then
    update public.rfqs set status = 'closed' where id = v_rfq;
  end if;
end $$;

grant execute on function public.set_quote_status(uuid, text) to authenticated;
