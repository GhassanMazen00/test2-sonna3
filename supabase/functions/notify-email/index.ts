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
  consult: "notify_factory",
};

// Per-notification-type look: emoji badge, accent colour, tint, CTA label.
const TYPE_STYLE: Record<string, { emoji: string; accent: string; tint: string; cta: string; kicker: string }> = {
  message: { emoji: "💬", accent: "#0E6B5E", tint: "#E4F0EE", cta: "Open the chat", kicker: "New message" },
  rfq:     { emoji: "📋", accent: "#0E6B5E", tint: "#E4F0EE", cta: "View the request", kicker: "New quote request" },
  match:   { emoji: "🎯", accent: "#C98A2B", tint: "#FBF1E2", cta: "View the request", kicker: "Matching request" },
  request: { emoji: "📢", accent: "#0E6B5E", tint: "#E4F0EE", cta: "View the request", kicker: "Request update" },
  review:  { emoji: "⭐", accent: "#C98A2B", tint: "#FBF1E2", cta: "View your page", kicker: "New review" },
  factory: { emoji: "✅", accent: "#1FA855", tint: "#E7F6EC", cta: "View my factory", kicker: "You're verified" },
  consult: { emoji: "🗓️", accent: "#0E6B5E", tint: "#E4F0EE", cta: "Go to Sonnaع", kicker: "Consultation booked" },
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
    const st = TYPE_STYLE[n.type as string] || TYPE_STYLE.message;

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#eef2f1;-webkit-text-size-adjust:100%;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${st.kicker} — ${body || title}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f1;padding:30px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e9e7;">
  <tr><td style="background:#0E6B5E;padding:18px 28px;">
    <span style="color:#ffffff;font-size:21px;font-weight:800;letter-spacing:.3px;">Sonna<span style="color:#8fe3d6;">ع</span></span>
  </td></tr>
  <tr><td style="height:4px;background:${st.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:34px 28px 0;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="width:60px;height:60px;background:${st.tint};border-radius:50%;text-align:center;vertical-align:middle;font-size:28px;line-height:60px;">${st.emoji}</td></tr></table>
    <div style="margin-top:16px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${st.accent};">${esc(st.kicker)}</div>
  </td></tr>
  <tr><td style="padding:8px 32px 0;text-align:center;">
    <h1 style="margin:0;font-size:21px;line-height:1.3;color:#15221f;font-weight:800;">${title}</h1>
  </td></tr>
  ${body ? `<tr><td style="padding:12px 32px 0;text-align:center;"><p style="margin:0;font-size:15px;line-height:1.65;color:#4a5a56;">${body}</p></td></tr>` : ""}
  <tr><td style="padding:26px 28px 34px;text-align:center;">
    <a href="${esc(link)}" style="display:inline-block;background:${st.accent};color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:700;font-size:15px;">${esc(st.cta)} &rarr;</a>
  </td></tr>
  <tr><td style="padding:18px 28px;border-top:1px solid #eef0ef;background:#fafbfb;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa7a3;text-align:center;">
      You're receiving this because you have notifications on for Sonnaع.<br>
      <a href="${esc(unsub)}" style="color:#7c8a86;text-decoration:underline;">Unsubscribe</a>&nbsp;&nbsp;·&nbsp;&nbsp;© Sonnaع
    </p>
  </td></tr>
</table>
<p style="margin:14px 0 0;font-size:11px;color:#b3bebb;">sonna3.net — Egypt's manufacturing directory</p>
</td></tr>
</table>
</body></html>`;

    // Plain-text alternative (multipart mail scores better with spam filters).
    const text = `${n.title || "New notification"}\n\n${n.body ? n.body + "\n\n" : ""}Open Sonnaع: ${link}\n\nUnsubscribe: ${unsub}`;
    const REPLY_TO = Deno.env.get("REPLY_TO") ?? "";

    const payload: Record<string, unknown> = {
      from: FROM_EMAIL,
      to: [email],
      subject: n.title || "New notification — Sonnaع",
      html,
      text,
      // A real List-Unsubscribe header is a strong deliverability signal.
      headers: { "List-Unsubscribe": `<${unsub}>` },
    };
    if (REPLY_TO) payload.reply_to = REPLY_TO;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
