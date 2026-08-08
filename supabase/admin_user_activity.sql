-- ============================================================
-- Sonnaع — Admin: full per-user activity dossier
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Returns EVERYTHING a single user has done on the platform, as one JSON blob,
-- for the admin "click a user → see all their activity" view. is_admin()-guarded
-- so only admins can read it. Large streams (messages, page views, notifications)
-- are capped to the most recent N with a total count kept where it matters.
-- ============================================================

create or replace function public.admin_user_activity(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in', u.last_sign_in_at,
        'full_name', p.full_name, 'user_role', p.user_role, 'company', p.company,
        'phone', p.phone, 'sourcing', p.sourcing, 'bio', p.bio, 'city', p.city
      ) from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user
    ),
    'factories', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id, 'name', f.name, 'sector', f.sector, 'verified', f.verified,
        'plan', f.plan, 'created_at', f.created_at) order by f.created_at desc), '[]')
      from public.factories f where f.owner = p_user),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'qty', r.qty, 'budget', r.budget,
        'gov', r.gov, 'contact', r.contact, 'created_at', r.created_at) order by r.created_at desc), '[]')
      from public.requests r where r.owner = p_user),
    'rfqs_sent', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'factory_name', q.factory_name, 'title', q.title, 'qty', q.qty,
        'target_price', q.target_price, 'status', q.status, 'created_at', q.created_at) order by q.created_at desc), '[]')
      from public.rfqs q where q.buyer = p_user),
    'rfqs_received', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'buyer_name', q.buyer_name, 'factory_name', q.factory_name, 'title', q.title,
        'status', q.status, 'created_at', q.created_at) order by q.created_at desc), '[]')
      from public.rfqs q where q.factory_owner = p_user),
    'quotes_given', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', qt.id, 'rfq_id', qt.rfq_id, 'price', qt.price, 'lead_time', qt.lead_time,
        'notes', qt.notes, 'created_at', qt.created_at) order by qt.created_at desc), '[]')
      from public.quotes qt where qt.factory_owner = p_user),
    'messages', (select coalesce(jsonb_agg(m order by (m->>'created_at') desc), '[]') from (
        select jsonb_build_object(
          'direction', case when sender = p_user then 'sent' else 'received' end,
          'sender_name', sender_name, 'recipient_name', recipient_name,
          'body', body, 'request_title', request_title,
          'created_at', created_at, 'read_at', read_at) as m
        from public.messages where sender = p_user or recipient = p_user
        order by created_at desc limit 200) t),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', rv.id, 'factory_id', rv.factory_id, 'rating', rv.rating, 'body', rv.body,
        'created_at', rv.created_at) order by rv.created_at desc), '[]')
      from public.reviews rv where rv.reviewer = p_user),
    'favorites', (select coalesce(jsonb_agg(jsonb_build_object(
        'factory_id', fv.factory_id, 'created_at', fv.created_at) order by fv.created_at desc), '[]')
      from public.favorites fv where fv.user_id = p_user),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', rp.id, 'target_type', rp.target_type, 'reason', rp.reason, 'status', rp.status,
        'created_at', rp.created_at) order by rp.created_at desc), '[]')
      from public.reports rp where rp.reporter = p_user),
    'subscriptions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'plan', s.plan, 'status', s.status, 'amount_cents', s.amount_cents,
        'current_period_end', s.current_period_end, 'auto_renew', s.auto_renew,
        'created_at', s.created_at) order by s.created_at desc), '[]')
      from public.subscriptions s where s.owner = p_user),
    'consultations', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'sector', c.sector, 'status', c.status, 'created_at', c.created_at) order by c.created_at desc), '[]')
      from public.consultations c where c.owner = p_user),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object(
        'ref', pi.ref, 'plan', pi.plan, 'amount_cents', pi.amount_cents, 'status', pi.status,
        'kind', pi.kind, 'created_at', pi.created_at) order by pi.created_at desc), '[]')
      from public.payment_intents pi where pi.owner = p_user),
    'notifications', (select coalesce(jsonb_agg(n order by (n->>'created_at') desc), '[]') from (
        select jsonb_build_object('type', type, 'title', title, 'body', body,
          'read_at', read_at, 'created_at', created_at) as n
        from public.notifications where user_id = p_user
        order by created_at desc limit 100) t),
    'buyer_alerts', (select coalesce(jsonb_agg(jsonb_build_object(
        'sector', ba.sector, 'created_at', ba.created_at) order by ba.created_at desc), '[]')
      from public.buyer_alerts ba where ba.user_id = p_user),
    'page_views', jsonb_build_object(
        'total', (select count(*) from public.page_views where viewer = p_user),
        'recent', (select coalesce(jsonb_agg(jsonb_build_object(
            'item_type', pv.item_type, 'item_id', pv.item_id, 'created_at', pv.created_at) order by pv.created_at desc), '[]')
          from (select * from public.page_views where viewer = p_user order by created_at desc limit 60) pv))
  ) into result;

  return result;
end $$;
revoke all on function public.admin_user_activity(uuid) from public, anon;
grant execute on function public.admin_user_activity(uuid) to authenticated;
