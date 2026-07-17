// Sonnaع — kashier-consult-checkout Edge Function
// Books a consultation: records the submitted details + a payment_intents row
// (kind = 'consultation'), then returns a SIGNED Kashier Hosted Payment Page
// URL. The fee is decided SERVER-SIDE. On a successful, signature-verified
// redirect, the shared kashier-confirm function calls apply_subscription_payment
// which flips the consultation to 'paid' and notifies the submitter.
//
// Deploy:  supabase functions deploy kashier-consult-checkout
// Secrets: KASHIER_MID, KASHIER_PAYMENT_API_KEY, KASHIER_MODE (test|live),
//          KASHIER_CONSULT_AMOUNT (EGP, optional — defaults to 500), SITE_URL
//
// Cannot be exercised in the app's Node harness — test with Kashier test keys.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const MID = Deno.env.get("KASHIER_MID") ?? "";
const PAYMENT_API_KEY = Deno.env.get("KASHIER_PAYMENT_API_KEY") ?? "";
const MODE = Deno.env.get("KASHIER_MODE") ?? "test";
const AMOUNT = Deno.env.get("KASHIER_CONSULT_AMOUNT") ?? "500"; // EGP
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "method" }, 405);
    if (!MID || !PAYMENT_API_KEY) return json({ error: "Payments are not configured yet." }, 200);

    // Authenticate the caller.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "auth" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false },
    });
    const { data: uWrap, error: uErr } = await userClient.auth.getUser();
    const user = uWrap?.user;
    if (uErr || !user) return json({ error: "Please log in again." }, 200);

    const body = await req.json().catch(() => ({}));
    const str = (v: unknown) => String(v ?? "").trim();
    const name = str(body?.name);
    const company = str(body?.company);
    const phone = str(body?.phone);
    const whatsapp = str(body?.whatsapp);
    const email = str(body?.email);
    const city = str(body?.city);
    const sector = str(body?.sector);
    const preferred = str(body?.preferred_at);
    const needs = str(body?.needs);
    // Every field is required except the sample upload.
    if (!name || !company || !phone || !whatsapp || !email || !city || !sector || !preferred || !needs) {
      return json({ error: "Please fill in all fields (only the samples are optional)." }, 200);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Please enter a valid email address." }, 200);
    }

    // Sample uploads (already stored client-side); keep only http(s) URLs.
    let samples: string[] = [];
    if (Array.isArray(body?.sample_urls)) {
      samples = body.sample_urls.map((u: unknown) => String(u)).filter((u: string) => /^https?:\/\//i.test(u)).slice(0, 12);
    }

    const amount = String(AMOUNT);
    const currency = "EGP";

    // Record the booking (pending payment).
    const { data: cons, error: cErr } = await admin.from("consultations").insert({
      owner: user.id,
      name,
      company,
      phone,
      whatsapp,
      email,
      sector,
      city,
      needs,
      preferred_at: preferred,
      sample_urls: samples,
      amount_cents: Math.round(Number(amount)),
      currency,
      status: "pending_payment",
    }).select("id").single();
    if (cErr || !cons) return json({ error: "Could not save your booking: " + (cErr?.message ?? "") }, 200);

    const orderId = crypto.randomUUID();
    const { error: piErr } = await admin.from("payment_intents").insert({
      ref: orderId, owner: user.id, kind: "consultation", consultation_id: cons.id,
      plan: "consultation", amount_cents: Math.round(Number(amount)), currency, status: "pending",
      sub_name: name, sub_phone: phone || whatsapp, sub_email: email,
    });
    if (piErr) return json({ error: "Could not start checkout: " + piErr.message }, 200);

    // Kashier order hash: HMAC-SHA256 of the payment path with the Payment API Key.
    const path = `/?payment=${MID}.${orderId}.${amount}.${currency}`;
    const hash = await hmacSha256Hex(PAYMENT_API_KEY, path);

    const params = new URLSearchParams({
      merchantId: MID,
      orderId,
      amount,
      currency,
      hash,
      mode: MODE,
      merchantRedirect: `${SITE_URL}/payment-return.html?type=consult`,
      serverWebhook: `${SUPABASE_URL}/functions/v1/kashier-webhook`,
      allowedMethods: "card",
      redirectMethod: "get",
      display: "en",
      type: "external",
    });

    return json({ url: `https://checkout.kashier.io/?${params.toString()}` });
  } catch (e) {
    return json({ error: "Checkout failed: " + String(e) }, 200);
  }
});
