// Sonnaع — renewal-reminder Edge Function
// Emails factory owners a few days before their 30-day subscription period
// ends, with a one-tap "Renew now" link back to the existing Kashier checkout
// flow (subscribe.html). This is the "reminders now, auto-charge later" path:
// no stored cards, no Kashier recurring dependency — the owner clicks through
// and pays once, exactly like their first subscription.
//
// Deploy:  supabase functions deploy renewal-reminder --no-verify-jwt
// Secrets: RESEND_API_KEY, FROM_EMAIL, SITE_URL (all already configured)
//
// Scheduled daily by pg_cron (see supabase/renewal_cron.sql). Idempotent:
// each subscription is reminded at most once per period via
// subscriptions.renewal_reminded_at, so running it twice in a day is safe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Sonnaع <no-reply@example.com>";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

// How many days before period end to send the reminder.
const LEAD_DAYS = 3;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

const PLAN_LABEL: Record<string, string> = {
  basic: "Basic",
  gold: "Gold",
  platinum: "Platinum",
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: to, subject: subject, html: html }),
  });
}

function reminderHtml(plan: string, factoryName: string, endDate: string): string {
  const planName = PLAN_LABEL[plan] || plan;
  const when = new Date(endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#15221F">` +
    `<h2 style="color:#0E6B5E">Your Sonnaع subscription renews soon</h2>` +
    `<p>Hi,</p>` +
    `<p>Your <strong>${esc(planName)}</strong> plan${factoryName ? ` for <strong>${esc(factoryName)}</strong>` : ""} ends on <strong>${esc(when)}</strong>.</p>` +
    `<p>To keep your factory verified and visible to buyers without interruption, renew before then:</p>` +
    `<p style="margin:22px 0"><a href="${SITE_URL}/subscribe.html" style="background:#0E6B5E;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Renew now</a></p>` +
    `<p style="color:#8a9a96;font-size:13px">If your plan lapses, your factory listing is hidden until you renew. You can renew any time from your account.</p>` +
    `<p style="color:#8a9a96;font-size:12px;margin-top:24px">You're receiving this because you have an active factory subscription on Sonnaع.</p>` +
    `</div>`
  );
}

Deno.serve(async () => {
  try {
    const now = Date.now();
    const windowEnd = new Date(now + LEAD_DAYS * 864e5).toISOString();
    const nowIso = new Date(now).toISOString();

    // Active subscriptions whose period ends within the next LEAD_DAYS and that
    // haven't been reminded for this period yet.
    const { data: subs, error } = await admin
      .from("subscriptions")
      .select("id,owner,factory_id,plan,current_period_end,sub_email,renewal_reminded_at")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .gt("current_period_end", nowIso)
      .lte("current_period_end", windowEnd);
    if (error) return new Response("query error: " + error.message, { status: 200 });

    const due = (subs ?? []).filter((s) => {
      if (!s.renewal_reminded_at) return true;
      // Re-remind only if the last reminder predates this period's start
      // (i.e. it belongs to an earlier cycle): reminded_at < period_end - 30d.
      const periodStart = new Date(s.current_period_end).getTime() - 30 * 864e5;
      return new Date(s.renewal_reminded_at).getTime() < periodStart;
    });

    let sent = 0;
    for (const s of due) {
      // Resolve an email: prefer the subscription's stored email, fall back to
      // the auth account, then the factory name for the message body.
      let email = s.sub_email || "";
      if (!email && s.owner) {
        const { data: u } = await admin.auth.admin.getUserById(s.owner);
        email = u?.user?.email || "";
      }
      if (!email) continue;

      let factoryName = "";
      if (s.factory_id) {
        const { data: f } = await admin.from("factories").select("name").eq("id", s.factory_id).maybeSingle();
        factoryName = f?.name || "";
      }

      await sendEmail(
        email,
        "Your Sonnaع subscription renews soon",
        reminderHtml(s.plan, factoryName, s.current_period_end),
      );

      await admin.from("subscriptions").update({ renewal_reminded_at: nowIso }).eq("id", s.id);
      sent++;
    }

    return new Response(JSON.stringify({ checked: (subs ?? []).length, sent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("error: " + (e?.message || String(e)), { status: 200 });
  }
});
