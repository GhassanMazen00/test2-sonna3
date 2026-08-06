-- ============================================================
-- Sonnaع — Renewal reminders (pg_cron -> renewal-reminder function)
--
-- Run ONCE in the Supabase SQL editor, AFTER deploying the renewal-reminder
-- Edge Function. Safe to re-run (adds the column only if missing, and
-- unschedules the old job first).
--
-- Requires the pg_cron and pg_net extensions (Database -> Extensions).
--
-- What this gives you (the "reminders now, auto-charge later" plan):
--   * 3 days before a factory's 30-day period ends, its owner gets an email
--     with a "Renew now" button that opens the normal Kashier checkout.
--   * No cards are stored anywhere. Nothing is charged automatically.
--   * Each subscription is reminded at most once per period.
-- ============================================================

-- Track the last reminder so we never double-send within one period.
alter table public.subscriptions
  add column if not exists renewal_reminded_at timestamptz;

-- Daily at 09:00 UTC.
select cron.unschedule('sonna-renewal-reminder')
  where exists (select 1 from cron.job where jobname = 'sonna-renewal-reminder');

select cron.schedule('sonna-renewal-reminder', '0 9 * * *', $$
  select net.http_post(
    url     := 'https://qtphintmxyncwlpxenha.supabase.co/functions/v1/renewal-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cGhpbnRteHluY3dscHhlbmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDA3OTksImV4cCI6MjA5OTA3Njc5OX0.B4e6ghhmUHnrN0whaEAniVpBcE8wYhqAemnUj-SE1nw'
    ),
    body    := '{}'::jsonb
  );
$$);
