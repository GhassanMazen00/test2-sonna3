-- ============================================================
-- Sonnaع — RFQ (request for quote) → quotes, + request matching
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- A buyer sends a structured quote request to one factory. Names are
-- denormalised so each side can display the other without extra reads.
create table if not exists public.rfqs (
  id            uuid primary key default gen_random_uuid(),
  buyer         uuid not null references auth.users(id) on delete cascade,
  buyer_name    text not null default '',
  factory_id    uuid not null references public.factories(id) on delete cascade,
  factory_name  text not null default '',
  factory_owner uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  details       text not null default '',
  qty           text,
  target_price  text,
  needed_by     text,
  status        text not null default 'open',   -- open | quoted | closed
  created_at    timestamptz not null default now()
);
create index if not exists rfqs_buyer_idx on public.rfqs (buyer, created_at desc);
create index if not exists rfqs_owner_idx on public.rfqs (factory_owner, created_at desc);
alter table public.rfqs enable row level security;

drop policy if exists rfqs_select on public.rfqs;
drop policy if exists rfqs_insert on public.rfqs;
drop policy if exists rfqs_update on public.rfqs;
drop policy if exists rfqs_delete on public.rfqs;

-- Both parties (buyer + the addressed factory owner) can see the RFQ.
create policy rfqs_select on public.rfqs for select
  using (buyer = auth.uid() or factory_owner = auth.uid());
-- Buyer creates it, addressed to the factory's real owner, not their own factory.
create policy rfqs_insert on public.rfqs for insert with check (
  buyer = auth.uid()
  and factory_owner = (select owner from public.factories where id = factory_id)
  and (select owner from public.factories where id = factory_id) <> auth.uid()
);
-- Either party can update status (buyer close / owner mark quoted).
create policy rfqs_update on public.rfqs for update
  using (buyer = auth.uid() or factory_owner = auth.uid())
  with check (buyer = auth.uid() or factory_owner = auth.uid());
create policy rfqs_delete on public.rfqs for delete using (buyer = auth.uid());


-- A factory's quote in response to an RFQ.
create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  rfq_id        uuid not null references public.rfqs(id) on delete cascade,
  factory_owner uuid not null references auth.users(id) on delete cascade,
  price         text,
  lead_time     text,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists quotes_rfq_idx on public.quotes (rfq_id, created_at desc);
alter table public.quotes enable row level security;

drop policy if exists quotes_select on public.quotes;
drop policy if exists quotes_insert on public.quotes;

-- Visible to whoever can see the parent RFQ.
create policy quotes_select on public.quotes for select using (
  exists (select 1 from public.rfqs r where r.id = rfq_id and (r.buyer = auth.uid() or r.factory_owner = auth.uid()))
);
-- Only the addressed factory owner may quote.
create policy quotes_insert on public.quotes for insert with check (
  factory_owner = auth.uid()
  and factory_owner = (select factory_owner from public.rfqs where id = rfq_id)
);


-- Request matching: give public requests an optional sector so factory owners
-- can be shown requests that match their sector / governorate.
alter table public.requests add column if not exists sector text;
