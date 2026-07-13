-- ============================================================
-- Sonnaع — Email notification preferences, unsubscribe, phone verification
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ---------- Per-user email preferences + unsubscribe token ----------
alter table public.profiles add column if not exists notify_messages boolean not null default true;
alter table public.profiles add column if not exists notify_matches  boolean not null default true;
alter table public.profiles add column if not exists notify_requests boolean not null default true;
alter table public.profiles add column if not exists notify_factory  boolean not null default true;
alter table public.profiles add column if not exists unsub_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_unsub_token_idx on public.profiles (unsub_token);

-- One-click unsubscribe from the email footer (no login). Turns every email
-- category off for the profile that owns the token.
create or replace function public.unsubscribe_all(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.profiles
     set notify_messages = false, notify_matches = false, notify_requests = false, notify_factory = false
   where unsub_token = p_token;
  get diagnostics n = row_count;
  return n > 0;
end $$;
grant execute on function public.unsubscribe_all(uuid) to anon, authenticated;

-- ---------- Phone verification (optional) ----------
-- The phone-otp Edge Function writes here with the service role after a
-- successful OTP check. Users can only read their own row (so the UI can show a
-- verified badge); they cannot write it, so it can't be faked.
create table if not exists public.verified_phones (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  phone       text not null,
  verified_at timestamptz not null default now()
);
alter table public.verified_phones enable row level security;
drop policy if exists verified_phones_select on public.verified_phones;
create policy verified_phones_select on public.verified_phones for select using (user_id = auth.uid());
-- No insert/update/delete policies: only the service-role Edge Function writes here.


-- ---------- Extra notification events (so they also generate emails) ----------
-- New chat message -> recipient (bell + email).
-- If the message is tagged with a request the recipient owns, it's an update
-- on a request they posted -> type 'request' (gated by notify_requests) and it
-- deep-links to that request. Otherwise it's a plain 'message'.
create or replace function public.notify_message() returns trigger language plpgsql security definer set search_path = public as $$
declare is_own_request boolean := false;
begin
  if new.request_id is not null then
    select exists(select 1 from public.requests r where r.id = new.request_id and r.owner = new.recipient)
      into is_own_request;
  end if;

  if is_own_request then
    perform public.notify(new.recipient, 'request',
      coalesce(new.sender_name, 'Someone') || ' replied about your request',
      left(coalesce(new.body, new.attachment_name, ''), 140),
      'request-detail.html?id=' || new.request_id);
  else
    perform public.notify(new.recipient, 'message',
      'New message from ' || coalesce(new.sender_name, 'someone'),
      left(coalesce(new.body, new.attachment_name, ''), 140), 'messages.html');
  end if;
  return new;
end $$;
drop trigger if exists notify_message_trg on public.messages;
create trigger notify_message_trg after insert on public.messages for each row execute function public.notify_message();

-- Factory just verified -> owner (a meaningful update to their page).
create or replace function public.notify_factory_verified() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verified = true and coalesce(old.verified, false) = false then
    perform public.notify(new.owner, 'factory', 'Your factory is verified',
      'Your page is now live in the directory.', 'my-factory.html');
  end if;
  return new;
end $$;
drop trigger if exists notify_factory_verified_trg on public.factories;
create trigger notify_factory_verified_trg after update on public.factories for each row execute function public.notify_factory_verified();
