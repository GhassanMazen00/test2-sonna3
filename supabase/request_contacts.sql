-- ============================================================
-- Sonnaع — Separate contact methods on buyer requests
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Requests used a single free-text `contact`. This adds three optional,
-- structured contact fields (phone / WhatsApp / email). The old `contact`
-- column is kept so existing requests still show their contact.
-- ============================================================

alter table public.requests add column if not exists contact_phone    text;
alter table public.requests add column if not exists contact_whatsapp text;
alter table public.requests add column if not exists contact_email    text;
