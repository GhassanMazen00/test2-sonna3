-- ============================================================
-- Sonnaع — Extended user profile
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Adds richer "about you" fields so members look credible and factories can
-- see who's contacting them. All optional; owners edit them in their account.
-- (profiles already has a row-level update policy from the base setup, so no
-- new RLS is needed — these columns inherit it.)
-- ============================================================

alter table public.profiles add column if not exists account_type text;   -- buyer | supplier | both
alter table public.profiles add column if not exists job_title    text;   -- e.g. Procurement Manager
alter table public.profiles add column if not exists sector       text;   -- industry id (from INDUSTRIES)
alter table public.profiles add column if not exists city         text;   -- governorate index (from GOVS)
alter table public.profiles add column if not exists bio          text;

-- Stamp a little more buyer context onto each request so it shows on the
-- request page alongside owner_company.
alter table public.requests add column if not exists owner_job    text;
alter table public.requests add column if not exists owner_sector text;
