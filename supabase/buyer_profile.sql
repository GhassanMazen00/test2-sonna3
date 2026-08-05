-- ============================================================
-- Sonnaع — Buyer / company mini-profile
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Adds a light buyer profile (company + what they source) so factory
-- owners can see who is contacting them, and stamps the buyer's company
-- onto each request they post so it shows on the request page.
-- ============================================================

alter table public.profiles add column if not exists company  text;
alter table public.profiles add column if not exists sourcing text;

alter table public.requests add column if not exists owner_company text;
