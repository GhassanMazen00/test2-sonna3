-- ============================================================
-- Sonnaع — Weekly digest schedule (pg_cron -> weekly-digest function)
-- Run ONCE in the Supabase SQL editor, AFTER deploying the weekly-digest
-- Edge Function. Safe to re-run (unschedules the old job first).
--
-- Requires the pg_cron and pg_net extensions (Database -> Extensions).
-- ============================================================

select cron.unschedule('sonna-weekly-digest')
  where exists (select 1 from cron.job where jobname = 'sonna-weekly-digest');

-- Mondays 08:00 UTC.
select cron.schedule('sonna-weekly-digest', '0 8 * * 1', $$
  select net.http_post(
    url     := 'https://qtphintmxyncwlpxenha.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cGhpbnRteHluY3dscHhlbmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDA3OTksImV4cCI6MjA5OTA3Njc5OX0.B4e6ghhmUHnrN0whaEAniVpBcE8wYhqAemnUj-SE1nw'
    ),
    body    := '{}'::jsonb
  );
$$);
