-- ============================================================
-- Sonnaع — Factory dashboard helper
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- How many users have shortlisted a factory. Aggregate only (favorites rows
-- themselves stay private to each user). Security-definer so it can count.
create or replace function public.factory_save_count(p_factory uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.favorites where factory_id = p_factory;
$$;
grant execute on function public.factory_save_count(uuid) to authenticated;
