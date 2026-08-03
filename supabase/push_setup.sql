-- ============================================================
-- Sonnaع — Push notifications: device token registry
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- The native app registers each device's FCM token here (via the
-- register_device_token RPC). The send-push Edge Function reads this table
-- with the service role and delivers a push for every new row in
-- public.notifications (fired by a Database Webhook — see the deploy notes in
-- supabase/functions/send-push/index.ts).
-- ============================================================

create table if not exists public.device_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null default 'unknown',   -- ios | android | web
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Users may see and remove their own device rows. Inserts/updates go through
-- the security-definer RPC below (which bypasses RLS), so there is no public
-- insert policy. The send-push function uses the service role and is exempt.
drop policy if exists device_tokens_select on public.device_tokens;
drop policy if exists device_tokens_delete on public.device_tokens;
create policy device_tokens_select on public.device_tokens for select using (user_id = auth.uid());
create policy device_tokens_delete on public.device_tokens for delete using (user_id = auth.uid());

-- Upsert this device's token for the signed-in user. Re-pointing a token to a
-- new user (shared device / account switch) just moves the row.
create or replace function public.register_device_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_token is null or length(p_token) < 8 then
    return;
  end if;
  insert into public.device_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(nullif(p_platform, ''), 'unknown'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

grant execute on function public.register_device_token(text, text) to authenticated;
