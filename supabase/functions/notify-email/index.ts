// Sonnaع — notify-email Edge Function
// Fired by a Database Webhook on INSERT into public.notifications.
// Looks up the recipient's email + email preferences with the service role,
// decides whether this notification type should be emailed, and (if so) sends
// a branded email via Resend with a one-click unsubscribe link.
//
// Deploy:  supabase functions deploy notify-email --no-verify-jwt
// Secrets: RESEND_API_KEY, FROM_EMAIL, SITE_URL
//
// This runs on Supabase's servers, not in the app. It cannot be exercised in
// the app's Node test harness — verify it after deploying by inserting a test
// notification and watching the Resend dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Sonnaع <no-reply@example.com>";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

// notification type -> the profiles preference column that gates it.
// "view" is deliberately absent: page-view notifications stay in-app only
// (too noisy for email).
const TYPE_TO_PREF: Record<string, string> = {
  message: "notify_messages",
  rfq: "notify_messages",
  match: "notify_matches",
  request: "notify_requests",
  review: "notify_factory",
  factory: "notify_factory",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhook shape: { type:'INSERT', table, record:{...}, ... }
    const n = payload?.record ?? payload;
    if (!n || !n.user_id || !n.type) {
      return new Response("ignored", { status: 200 });
    }

    const prefCol = TYPE_TO_PREF[n.type];
    if (!prefCol) {
      // Unknown / non-emailable type (e.g. "view").
      return new Response("skipped: not an emailable type", { status: 200 });
    }

    // Preferences + unsubscribe token.
    const { data: profileData } = await admin
      .from("profiles")
      .select(`${prefCol}, unsub_token`)
      .eq("id", n.user_id)
      .single();
    const profile = profileData as Record<string, unknown> | null;

    if (profile && profile[prefCol] === false) {
      return new Response("skipped: user opted out", { status: 200 });
    }

    // Recipient email from auth.
    const { data: userWrap, error: uErr } = await admin.auth.admin.getUserById(
      n.user_id
    );
    const email = userWrap?.user?.email;
    if (uErr || !email) {
      return new Response("skipped: no email", { status: 200 });
    }

    if (!RESEND_API_KEY) {
      // Function deployed but Resend not configured yet.
      return new Response("skipped: RESEND_API_KEY not set", { status: 200 });
    }

    const link = n.link ? `${SITE_URL}/${String(n.link).replace(/^\/+/, "")}` : SITE_URL;
    const unsub = profile?.unsub_token
      ? `${SITE_URL}/unsubscribe.html?token=${profile.unsub_token}`
      : `${SITE_URL}/account.html`;

    const title = esc(n.title || "New notification");
    const body = esc(n.body || "");

    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7e5e4">
    <div style="background:#0f766e;padding:18px 24px;color:#fff;font-weight:700;font-size:18px">Sonnaع</div>
    <div style="padding:24px">
      <h1 style="margin:0 0 8px;font-size:18px;line-height:1.3">${title}</h1>
      ${body ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#44403c">${body}</p>` : ""}
      <a href="${esc(link)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:600;font-size:14px">Open Sonnaع</a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f0efee;font-size:12px;color:#a8a29e;line-height:1.5">
      You're receiving this because you have notifications on for Sonnaع.<br>
      <a href="${esc(unsub)}" style="color:#a8a29e">Unsubscribe from these emails</a>
    </div>
  </div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: n.title || "New notification — Sonnaع",
        html,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(`resend error: ${t}`, { status: 200 });
    }
    return new Response("sent", { status: 200 });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 200 });
  }
});
