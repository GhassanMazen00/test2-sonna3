-- ============================================================
-- Sonnaع — Notifications (bell) + event triggers
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Generates a notification for a factory owner when:
--   * someone views their factory page (a new unique view)
--   * a quote request (RFQ) comes in
--   * they receive a review
--   * a new buyer request is posted in their sector
-- ============================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                 -- view | rfq | review | match
  title      text not null default '',
  body       text not null default '',
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
-- Users only ever see and manage their own notifications. Inserts happen via the
-- security-definer helpers/triggers below (which bypass RLS), so there is no
-- public insert policy.
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());

-- Insert helper used by the triggers / RPCs.
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user, p_type, p_title, p_body, p_link where p_user is not null;
$$;

-- ---- RFQ -> factory owner ----
create or replace function public.notify_rfq() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.factory_owner, 'rfq', 'New quote request',
    coalesce(new.buyer_name, 'A buyer') || ': ' || coalesce(new.title, ''), 'dashboard.html');
  return new;
end $$;
drop trigger if exists notify_rfq_trg on public.rfqs;
create trigger notify_rfq_trg after insert on public.rfqs for each row execute function public.notify_rfq();

-- ---- Review -> factory owner ----
create or replace function public.notify_review() returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  select owner into owner_id from public.factories where id = new.factory_id;
  perform public.notify(owner_id, 'review', 'New review',
    coalesce(new.reviewer_name, 'Someone') || ' rated you ' || new.rating || '★',
    'factory-detail.html?id=' || new.factory_id);
  return new;
end $$;
drop trigger if exists notify_review_trg on public.reviews;
create trigger notify_review_trg after insert on public.reviews for each row execute function public.notify_review();

-- ---- New request -> verified factory owners in the same sector ----
create or replace function public.notify_match() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sector is not null then
    insert into public.notifications (user_id, type, title, body, link)
    select f.owner, 'match', 'New buyer request in your sector', coalesce(new.title, ''),
           'request-detail.html?id=' || new.id
    from public.factories f
    where f.sector = new.sector and f.owner is not null and f.owner <> new.owner and f.verified = true;
  end if;
  return new;
end $$;
drop trigger if exists notify_match_trg on public.requests;
create trigger notify_match_trg after insert on public.requests for each row execute function public.notify_match();

-- ---- Factory view -> owner (only on a NEW unique view) ----
-- Rewrites record_view to also drop a notification for the owner.
create or replace function public.record_view(p_type text, p_id text)
returns bigint language plpgsql security definer set search_path = public as $$
declare cnt bigint; inserted int; owner_id uuid;
begin
  if auth.uid() is not null then
    insert into public.page_views (item_type, item_id, viewer)
    values (p_type, p_id, auth.uid())
    on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted > 0 and p_type = 'factory' then
      select owner into owner_id from public.factories where id::text = p_id;
      if owner_id is not null and owner_id <> auth.uid() then
        perform public.notify(owner_id, 'view', 'Your page got a new view', '', 'dashboard.html');
      end if;
    end if;
  end if;
  select count(*) into cnt from public.page_views where item_type = p_type and item_id = p_id;
  return cnt;
end $$;
grant execute on function public.record_view(text, text) to anon, authenticated;
