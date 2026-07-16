// Sonnaع — kashier-checkout Edge Function
// Builds a signed Kashier Hosted Payment Page URL for the signed-in factory
// owner's "Verified" subscription and returns it. Amount is decided
// SERVER-SIDE. A payment_intents row (keyed by our orderId) lets the webhook
// know exactly what was paid for.
//
// Deploy:  supabase functions deploy kashier-checkout
// Secrets: KASHIER_MID, KASHIER_PAYMENT_API_KEY, KASHIER_MODE (test|live),
//          KASHIER_VERIFIED_AMOUNT (EGP, optional), SITE_URL
//
// Cannot be exercised in the app's Node harness — test with Kashier test keys.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const MID = Deno.env.get("KASHIER_MID") ?? "";
const PAYMENT_API_KEY = Deno.env.get("KASHIER_PAYMENT_API_KEY") ?? "";
const MODE = Deno.env.get("KASHIER_MODE") ?? "test";
const AMOUNT = Deno.env.get("KASHIER_VERIFIED_AMOUNT") ?? "500"; // EGP
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
    console.log("checkout: start", { hasMID: !!MID, hasKey: !!PAYMENT_API_KEY, mode: MODE, site: SITE_URL });
    if (!MID || !PAYMENT_API_KEY) { console.log("checkout: missing Kashier secrets"); return json({ error: "Payments are not configured yet." }, 200); }

    // Authenticate the caller.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) { console.log("checkout: no auth header"); return json({ error: "auth" }, 401); }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false },
    });
    const { data: uWrap, error: uErr } = await userClient.auth.getUser();
    const user = uWrap?.user;
    if (uErr || !user) { console.log("checkout: no user", uErr?.message); return json({ error: "Please log in again." }, 200); }
    console.log("checkout: user", user.id);

    const amount = String(AMOUNT);
    const currency = "EGP";
    const plan = "verified";

    // Subscriber contact details (required; the client validates too).
    const body = await req.json().catch(() => ({}));
    const subName = String(body?.name ?? "").trim();
    const subPhone = String(body?.phone ?? "").trim();
    if (!subName) return json({ error: "Your full name is required." }, 200);
    if (!subPhone) return json({ error: "A mobile number is required." }, 200);

    // The caller's factory (so the webhook verifies exactly this factory).
    const { data: fac, error: facErr } = await admin
      .from("factories").select("id").eq("owner", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (facErr) { console.log("checkout: factories query error", facErr.message); return json({ error: "Could not read your factory: " + facErr.message }, 200); }
    if (!fac) { console.log("checkout: no factory for owner"); return json({ error: "Create your factory page first." }, 200); }
    console.log("checkout: factory", fac.id);

    const orderId = crypto.randomUUID();
    const { error: piErr } = await admin.from("payment_intents").insert({
      ref: orderId, owner: user.id, factory_id: fac.id, plan, amount_cents: Math.round(Number(amount)), currency, status: "pending",
      sub_name: subName, sub_phone: subPhone, sub_email: user.email ?? null,
    });
    if (piErr) { console.log("checkout: payment_intents insert error", piErr.message); return json({ error: "Could not start checkout: " + piErr.message }, 200); }

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
      merchantRedirect: `${SITE_URL}/payment-return.html`,
      serverWebhook: `${SUPABASE_URL}/functions/v1/kashier-webhook`,
      allowedMethods: "card",
      redirectMethod: "get",
      display: "en",
      type: "external",
    });

    const url = `https://checkout.kashier.io/?${params.toString()}`;
    console.log("checkout: created url ok");
    return json({ url });
  } catch (e) {
    console.log("checkout: EXCEPTION", String(e));
    return json({ error: "Checkout failed: " + String(e) }, 200);
  }
});
