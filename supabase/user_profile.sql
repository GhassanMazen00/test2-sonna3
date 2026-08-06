-- ============================================================
-- Sonnaع — User role ("I'm here to")
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Stores whether a member is here to buy, to supply (own a factory), or both.
-- Collected at sign-up and editable in the account. (profiles already has a
-- row-level update policy from the base setup, so no new RLS is needed.)
-- ============================================================

alter table public.profiles add column if not exists user_role text;   -- buyer | supplier | both
