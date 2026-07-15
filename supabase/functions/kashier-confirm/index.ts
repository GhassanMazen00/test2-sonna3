// Sonnaع — kashier-confirm Edge Function
// Verifies the SIGNED redirect Kashier sends back to payment-return.html and,
// if the payment is genuinely successful, applies the subscription (flips the
// factory to verified). This is signature-verified, so it can't be faked, and
// it doesn't depend on Kashier's server webhook being configured.
//
// Deploy:  supabase functions deploy kashier-confirm --no-verify-jwt
// Secrets: KASHIER_PAYMENT_API_KEY   (same key that signed the order)
//
// Kashier's redirect signature = HMAC-SHA256 of the returned query params
// (in the order received, EXCLUDING `signature` and `mode`) with the Payment
// API Key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYMENT_API_KEY = Deno.env.get("KASHIER_PAYMENT_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

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
    if (!PAYMENT_API_KEY) return json({ error: "not configured" }, 200);

    const body = await req.json().catch(() => ({}));
    // Accept the raw querystring (e.g. "?paymentStatus=...") from the return page.
    const rawQuery: string = String(body.query ?? "").replace(/^\?/, "");
    if (!rawQuery) return json({ error: "no query" }, 200);

    const usp = new URLSearchParams(rawQuery);
    const received = (usp.get("signature") || "").toLowerCase();
    if (!received) return json({ error: "no signature" }, 200);

    // Rebuild the signed string: all params in order, minus `signature` and `mode`.
    const parts: string[] = [];
    for (const [k, v] of usp.entries()) {
      if (k === "signature" || k === "mode") continue;
      parts.push(`${k}=${v}`);
    }
    const message = parts.join("&");
    const expected = await hmacSha256Hex(PAYMENT_API_KEY, message);
    console.log("confirm: sig", { message, expected, received, match: expected === received });
    if (expected !== received) return json({ error: "bad signature" }, 200);

    if (String(usp.get("paymentStatus") || "").toUpperCase() !== "SUCCESS") {
      return json({ error: "not successful", status: usp.get("paymentStatus") }, 200);
    }

    const ref = usp.get("merchantOrderId");
    if (!ref) return json({ error: "no reference" }, 200);

    const { data, error } = await admin.rpc("apply_subscription_payment", {
      p_ref: ref,
      p_provider_ref: String(usp.get("transactionId") ?? ""),
      p_provider: "kashier",
    });
    if (error) { console.log("confirm: apply error", error.message); return json({ error: error.message }, 200); }
    console.log("confirm: applied", data);
    // apply_subscription_payment returns false only if the order ref is unknown.
    return json({ ok: true, verified: data !== false });
  } catch (e) {
    console.log("confirm: EXCEPTION", String(e));
    return json({ error: String(e) }, 200);
  }
});
