-- ============================================================
-- Sonnaع — Consultation progress tracking
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Adds a workflow "stage" to each consultation so the admin can move it through
-- a pipeline (new -> contacted -> scheduled -> in_progress -> completed /
-- cancelled) and filter by where it is. `status` stays as the PAYMENT state
-- (pending_payment | paid); `stage` is the fulfilment progress.
-- ============================================================

alter table public.consultations add column if not exists stage text not null default 'new';
alter table public.consultations add column if not exists admin_note text;

-- Admins may update a consultation's stage / notes.
drop policy if exists consultations_admin_update on public.consultations;
create policy consultations_admin_update on public.consultations
  for update using (public.is_admin()) with check (public.is_admin());
