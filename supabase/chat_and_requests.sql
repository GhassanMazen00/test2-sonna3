-- ============================================================
-- Sonnaع — Messaging + live Requests
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: it drops/recreates policies and uses IF NOT EXISTS.
-- ============================================================

-- ---------- MESSAGES (1:1 direct messages) ----------
-- A single row per message. Two users share a "thread_key" made of their two
-- ids sorted and joined with ':' (computed on the client). Sender/recipient
-- display names are denormalised so the chat never needs to read other users'
-- profiles. A message may reference a request (tag/mention) via request_id.
create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  thread_key     text not null,
  sender         uuid not null references auth.users(id) on delete cascade,
  recipient      uuid not null references auth.users(id) on delete cascade,
  sender_name    text not null default '',
  recipient_name text not null default '',
  body           text not null,
  request_id     uuid,
  request_title  text,
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);
create index if not exists messages_thread_idx    on public.messages (thread_key, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient, read_at);
create index if not exists messages_sender_idx     on public.messages (sender);

alter table public.messages enable row level security;

drop policy if exists "messages_select_own"  on public.messages;
drop policy if exists "messages_insert_self"  on public.messages;
drop policy if exists "messages_update_recipient" on public.messages;

-- You can read a message only if you are one of the two parties.
create policy "messages_select_own" on public.messages
  for select using (auth.uid() = sender or auth.uid() = recipient);

-- You may only send messages as yourself, and not to yourself. A message that
-- references a buyer request (request_id set) may only be sent by the owner of a
-- VERIFIED factory — only verified factories can contact buyers who post requests.
create policy "messages_insert_self" on public.messages
  for insert with check (
    auth.uid() = sender
    and sender <> recipient
    and (
      request_id is null
      or exists (
        select 1 from public.factories f
        where f.owner = auth.uid()
          and f.verified = true
          and coalesce(f.deletion_requested, false) = false
      )
    )
  );

-- Only the recipient may update a message (used to stamp read_at).
create policy "messages_update_recipient" on public.messages
  for update using (auth.uid() = recipient) with check (auth.uid() = recipient);


-- ---------- REQUESTS (buyer manufacturing requests) ----------
-- Publicly readable so any logged-in user can browse them. owner_name is
-- denormalised for display and for chat. media is an array of
-- { url, type } objects (type = 'image' | 'video').
create table if not exists public.requests (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  owner_name  text not null default '',
  title       text not null,
  description text not null default '',
  qty         text,
  budget      text,
  material    text,
  gov         int,
  contact     text,
  media       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists requests_created_idx on public.requests (created_at desc);

alter table public.requests enable row level security;

drop policy if exists "requests_select_all"    on public.requests;
drop policy if exists "requests_insert_own"     on public.requests;
drop policy if exists "requests_update_own"     on public.requests;
drop policy if exists "requests_delete_own"     on public.requests;

-- Anyone (even the public anon key) may read requests.
create policy "requests_select_all" on public.requests
  for select using (true);

-- Only a logged-in user may post, and only as themselves.
create policy "requests_insert_own" on public.requests
  for insert with check (auth.uid() = owner);

-- Owners may edit / delete their own requests.
create policy "requests_update_own" on public.requests
  for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "requests_delete_own" on public.requests
  for delete using (auth.uid() = owner);


-- ---------- STORAGE: allow logged-in users to upload sample media ----------
-- Reuses the existing public 'media' bucket. User uploads go under 'requests/'.
-- If your bucket is named differently, change 'media' below to match
-- window.SUPABASE_BUCKET in assets/js/supabase-config.js.
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

drop policy if exists "media_public_read"  on storage.objects;
drop policy if exists "media_auth_upload"   on storage.objects;

create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

create policy "media_auth_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
