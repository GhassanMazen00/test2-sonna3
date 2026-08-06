// Sonnaع — renewal-reminder Edge Function (renewal runner)
// Runs daily (pg_cron, see supabase/auto_renew.sql). For every active
// subscription whose 30-day period ends within the next few days it does ONE
// of two things:
//
//   * AUTO-RENEW (owner ticked "save card" + "auto-renew"): charges the saved
//     Kashier card token server-side — no CVV — and, on success, extends the
//     plan 30 days. On failure it emails the owner to renew manually.
//   * REMINDER (everyone else): emails a "renew now" link. If the owner has a
//     saved card, renewal is one-tap fast (card pre-filled; they add CVV).
//
// SAFETY GATE: real charging only happens when KASHIER_RECURRING_ENABLED=true.
// Until you confirm Kashier has activated recurring/token charges on your
// account, leave that secret unset — then EVERYONE simply gets a reminder and
// nothing is ever charged automatically.
//
// Deploy:  supabase functions deploy renewal-reminder --no-verify-jwt
// Secrets: RESEND_API_KEY, FROM_EMAIL, SITE_URL   (already configured)
//          KASHIER_RECURRING_ENABLED, KASHIER_MID, KASHIER_PAYMENT_API_KEY,
//          KASHIER_MODE   (only needed once you switch auto-charge on)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Sonnaع <no-reply@example.com>";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

const RECURRING_ON = (Deno.env.get("KASHIER_RECURRING_ENABLED") ?? "").toLowerCase() === "true";
const MID = Deno.env.get("KASHIER_MID") ?? "";
const PAYMENT_API_KEY = Deno.env.get("KASHIER_PAYMENT_API_KEY") ?? "";
const MODE = Deno.env.get("KASHIER_MODE") ?? "test";

// Days before period end to email a reminder.
const LEAD_DAYS = 3;
// Days before period end to actually charge an auto-renew card. Kept >= the gap
// to the daily expiry cron so a plan is renewed BEFORE it can lapse/unverify.
const CHARGE_LEAD_DAYS = 1;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
const PLAN_LABEL: Record<string, string> = { basic: "Basic", gold: "Gold", platinum: "Platinum" };
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
}

function shell(inner: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#15221F">${inner}` +
    `<p style="color:#8a9a96;font-size:12px;margin-top:24px">You're receiving this because you have an active factory subscription on Sonnaع.</p></div>`;
}
function btn(label: string): string {
  return `<p style="margin:22px 0"><a href="${SITE_URL}/subscribe.html" style="background:#0E6B5E;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${esc(label)}</a></p>`;
}

// Reminder for owners who renew manually. Mentions the saved card if they have one.
function manualHtml(plan: string, factory: string, endDate: string, hasCard: boolean): string {
  const p = PLAN_LABEL[plan] || plan;
  return shell(
    `<h2 style="color:#0E6B5E">Your Sonnaع subscription renews soon</h2>` +
    `<p>Your <strong>${esc(p)}</strong> plan${factory ? ` for <strong>${esc(factory)}</strong>` : ""} ends on <strong>${esc(fmtDate(endDate))}</strong>.</p>` +
    `<p>Renew before then to keep your factory verified and visible to buyers:</p>` +
    btn("Renew now") +
    (hasCard
      ? `<p style="color:#8a9a96;font-size:13px">Your saved card will be pre-filled — you'll just confirm the security code (CVV).</p>`
      : `<p style="color:#8a9a96;font-size:13px">If your plan lapses, your listing is hidden until you renew.</p>`),
  );
}
// Heads-up for auto-renew owners: tells them the exact date we'll charge.
function autoNoticeHtml(plan: string, factory: string, endDate: string, last4: string): string {
  const p = PLAN_LABEL[plan] || plan;
  return shell(
    `<h2 style="color:#0E6B5E">Your Sonnaع plan renews automatically</h2>` +
    `<p>Your <strong>${esc(p)}</strong> plan${factory ? ` for <strong>${esc(factory)}</strong>` : ""} will auto-renew on <strong>${esc(fmtDate(endDate))}</strong>.</p>` +
    `<p>We'll charge your saved card${last4 ? ` ending in <strong>${esc(last4)}</strong>` : ""} for another 30 days — no action needed.</p>` +
    `<p style="color:#8a9a96;font-size:13px">Want to stop auto-renew or change the card? Open <strong>Account → Payment methods</strong> any time before that date.</p>`,
  );
}
function autoFailedHtml(plan: string, factory: string): string {
  const p = PLAN_LABEL[plan] || plan;
  return shell(
    `<h2 style="color:#B4442F">We couldn't auto-renew your plan</h2>` +
    `<p>We tried to renew your <strong>${esc(p)}</strong> plan${factory ? ` for <strong>${esc(factory)}</strong>` : ""} but the charge didn't go through.</p>` +
    `<p>Please renew manually so your factory stays verified:</p>` +
    btn("Renew now"),
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

// Merchant-initiated token charge. Returns { ok, ref }.
// NOTE: this is the ONE place that talks to Kashier's recurring API. The exact
// endpoint/field names must be confirmed from your Kashier dashboard once
// recurring is activated — kept isolated here so that's a small edit. Guarded
// by KASHIER_RECURRING_ENABLED so it never runs until you're ready.
async function chargeSavedCard(token: string, amountEgp: number, customerRef: string): Promise<{ ok: boolean; ref: string }> {
  if (!RECURRING_ON || !MID || !PAYMENT_API_KEY) return { ok: false, ref: "" };
  const orderId = crypto.randomUUID();
  const amount = String(amountEgp);
  const path = `/?payment=${MID}.${orderId}.${amount}.EGP`;
  const hash = await hmacSha256Hex(PAYMENT_API_KEY, path);
  try {
    const res = await fetch("https://api.kashier.io/v3/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: PAYMENT_API_KEY },
      body: JSON.stringify({
        merchantId: MID, orderId, amount, currency: "EGP", mode: MODE,
        hash, cardToken: token, customerReference: customerRef,
        interactionSource: "MOTO", // merchant-initiated, no CVV
      }),
    });
    const j = await res.json().catch(() => ({}));
    const status = String(j?.status ?? j?.paymentStatus ?? (res.ok ? "SUCCESS" : "FAILED")).toUpperCase();
    return { ok: status === "SUCCESS", ref: String(j?.transactionId ?? j?.orderId ?? orderId) };
  } catch (_e) {
    return { ok: false, ref: "" };
  }
}

Deno.serve(async () => {
  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const windowEnd = new Date(now + LEAD_DAYS * 864e5).toISOString();

    const { data: subs, error } = await admin
      .from("subscriptions")
      .select("id,owner,factory_id,plan,amount_cents,current_period_end,auto_renew,sub_email,renewal_reminded_at")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .lte("current_period_end", windowEnd);
    if (error) return new Response("query error: " + error.message, { status: 200 });

    let charged = 0, reminded = 0, failed = 0;

    for (const s of subs ?? []) {
      // Resolve email + factory name once.
      let email = s.sub_email || "";
      if (!email && s.owner) {
        const { data: u } = await admin.auth.admin.getUserById(s.owner);
        email = u?.user?.email || "";
      }
      let factory = "";
      if (s.factory_id) {
        const { data: f } = await admin.from("factories").select("name").eq("id", s.factory_id).maybeSingle();
        factory = f?.name || "";
      }
      const { data: pm } = await admin.from("payment_methods").select("card_token,card_last4").eq("owner", s.owner).maybeSingle();

      const endMs = new Date(s.current_period_end).getTime();
      const chargeNow = endMs <= now + CHARGE_LEAD_DAYS * 864e5; // within charge window
      const amountEgp = Number(s.amount_cents) || 0;

      if (s.auto_renew && pm?.card_token && RECURRING_ON) {
        // Charge shortly BEFORE the period ends so the plan never lapses. Until
        // then, send the "will auto-charge on <date>" heads-up once per period.
        if (!chargeNow) {
          if (email && !s.renewal_reminded_at) {
            await sendEmail(email, "Your Sonnaع plan renews automatically", autoNoticeHtml(s.plan, factory, s.current_period_end, pm.card_last4 || ""));
            await admin.from("subscriptions").update({ renewal_reminded_at: nowIso }).eq("id", s.id);
          }
          continue;
        }
        const r = await chargeSavedCard(pm.card_token, amountEgp, s.owner);
        if (r.ok) {
          await admin.rpc("apply_renewal", { p_sub: s.id, p_provider_ref: r.ref });
          charged++;
        } else {
          if (email) await sendEmail(email, "We couldn't auto-renew your Sonnaع plan", autoFailedHtml(s.plan, factory));
          failed++;
        }
        continue;
      }

      // Manual path: one reminder per period, only in the lead window.
      if (email && !s.renewal_reminded_at) {
        await sendEmail(email, "Your Sonnaع subscription renews soon", manualHtml(s.plan, factory, s.current_period_end, !!pm?.card_token));
        await admin.from("subscriptions").update({ renewal_reminded_at: nowIso }).eq("id", s.id);
        reminded++;
      }
    }

    return new Response(JSON.stringify({ checked: (subs ?? []).length, charged, reminded, failed, recurring: RECURRING_ON }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("error: " + (e?.message || String(e)), { status: 200 });
  }
});
