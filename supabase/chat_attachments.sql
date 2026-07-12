-- ============================================================
-- Sonnaع — Chat attachments
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table public.messages add column if not exists attachment_url  text;
alter table public.messages add column if not exists attachment_name text;
alter table public.messages add column if not exists attachment_type text;  -- image | video | file
