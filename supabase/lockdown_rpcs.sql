-- ============================================================
-- Sonnaع — Lock down service-only RPCs (security fix)
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Postgres grants EXECUTE on functions to PUBLIC by default, and an earlier
-- `revoke ... from anon, authenticated` did NOT remove that PUBLIC grant — so
-- these SECURITY DEFINER functions were still callable by anyone through the
-- REST API (/rest/v1/rpc/...). That let a signed-in factory owner grant their
-- own verification/renewal without paying, and let anyone push notifications.
--
-- These functions are only ever meant to run as service_role (the Kashier
-- webhook/confirm functions and pg_cron). service_role keeps EXECUTE regardless
-- of these revokes, and SECURITY DEFINER triggers/other definer functions call
-- them internally as the definer — so nothing legitimate breaks.
-- ============================================================

-- Payment / subscription grants — the free-verification & free-renewal holes.
revoke execute on function public.apply_subscription_payment(text, text, text) from public, anon, authenticated;
revoke execute on function public.apply_renewal(uuid, text)                     from public, anon, authenticated;
revoke execute on function public.store_payment_method(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.expire_subscriptions()                        from public, anon, authenticated;

-- Notifications helper — was callable by anyone (notification spam / phishing).
revoke execute on function public.notify(uuid, text, text, text, text)          from public, anon, authenticated;

-- Admin RPCs are already guarded by is_admin() internally, but remove the
-- public back-door too. Keep the explicit grant to `authenticated` so real
-- admins (who are authenticated) can still call them.
revoke execute on function public.admin_cancel_subscription(uuid)               from public, anon;
revoke execute on function public.admin_extend_subscription(uuid, integer)      from public, anon;
revoke execute on function public.admin_set_plan(uuid, text)                    from public, anon;
revoke execute on function public.admin_set_verification(uuid, boolean, text)   from public, anon;
revoke execute on function public.mark_factory_visited(uuid)                    from public, anon;
