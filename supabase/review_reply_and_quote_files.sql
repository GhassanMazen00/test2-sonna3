-- ============================================================
-- Sonnaع — Quote attachments + stricter review rule
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Factories may attach a CSV/PDF quote instead of (or with) the ready fields.
alter table public.quotes add column if not exists file_url  text;
alter table public.quotes add column if not exists file_name text;

-- Reviews now require a TWO-WAY conversation: the reviewer messaged the factory
-- AND the factory replied. This keeps reviews tied to a real interaction and
-- lets factories that never engaged avoid drive-by ratings.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (
  reviewer = auth.uid()
  and rating between 1 and 5
  and (select owner from public.factories where id = factory_id) <> auth.uid()
  -- reviewer -> factory owner
  and exists (
    select 1 from public.messages m
    where m.sender = auth.uid()
      and m.recipient = (select owner from public.factories where id = factory_id)
  )
  -- factory owner -> reviewer (the reply)
  and exists (
    select 1 from public.messages m2
    where m2.sender = (select owner from public.factories where id = factory_id)
      and m2.recipient = auth.uid()
  )
);
