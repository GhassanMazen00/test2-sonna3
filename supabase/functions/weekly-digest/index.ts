// Sonnaع — weekly-digest Edge Function
// Emails buyers who follow a sector a weekly summary of the factories that
// became verified in that sector over the last 7 days. Triggered by pg_cron
// (see supabase/digest_cron.sql), or can be invoked manually to test.
//
// Deploy:  supabase functions deploy weekly-digest --no-verify-jwt
// Secrets: RESEND_API_KEY, FROM_EMAIL, SITE_URL
//
// Runs on Supabase's servers. Verify after deploying by invoking it once and
// watching the Resend dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Sonnaع <no-reply@example.com>";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: to, subject: subject, html: html }),
  });
}

Deno.serve(async () => {
  try {
    // New factories verified in the last 7 days.
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: facs } = await admin
      .from("factories")
      .select("id,name,sector,created_at,verified")
      .eq("verified", true)
      .gte("created_at", since);
    const newFacs = facs ?? [];
    if (!newFacs.length) return new Response("no new factories", { status: 200 });

    const bySector: Record<string, any[]> = {};
    for (const f of newFacs) {
      if (!f.sector) continue;
      (bySector[f.sector] = bySector[f.sector] || []).push(f);
    }

    // Everyone following a sector.
    const { data: alerts } = await admin.from("buyer_alerts").select("user_id,sector");
    const byUser: Record<string, Set<string>> = {};
    for (const a of alerts ?? []) {
      if (bySector[a.sector]) (byUser[a.user_id] = byUser[a.user_id] || new Set()).add(a.sector);
    }

    let sent = 0;
    for (const userId of Object.keys(byUser)) {
      // Collect this user's matching factories.
      const items: any[] = [];
      for (const sector of byUser[userId]) items.push(...bySector[sector]);
      if (!items.length) continue;

      const { data: u } = await admin.auth.admin.getUserById(userId);
      const email = u?.user?.email;
      if (!email) continue;

      const rows = items.slice(0, 12).map((f) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">` +
        `<a href="${SITE_URL}/factory-detail.html?id=${encodeURIComponent(f.id)}" style="color:#0E6B5E;font-weight:600;text-decoration:none">${esc(f.name || "A factory")}</a>` +
        `</td></tr>`
      ).join("");

      const html =
        `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#15221F">` +
        `<h2 style="color:#0E6B5E">New factories on Sonnaع this week</h2>` +
        `<p>New verified factories joined in sectors you follow:</p>` +
        `<table style="width:100%;border-collapse:collapse">${rows}</table>` +
        `<p style="margin-top:20px"><a href="${SITE_URL}/factories.html" style="background:#0E6B5E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Browse factories</a></p>` +
        `<p style="color:#8a9a96;font-size:12px;margin-top:24px">You're receiving this because you follow sectors on Sonnaع. Manage alerts in your account.</p>` +
        `</div>`;

      await sendEmail(email, "New factories in sectors you follow · Sonnaع", html);
      sent++;
    }
    return new Response(JSON.stringify({ sent }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response("error: " + (e?.message || String(e)), { status: 200 });
  }
});
