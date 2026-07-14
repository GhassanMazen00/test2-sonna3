// Sonnaع — kashier-webhook Edge Function
// Kashier's server-to-server payment callback. This is the ONLY thing that
// grants verification: it validates Kashier's signature, and on a successful
// payment calls apply_subscription_payment() (service role) which records the
// subscription and flips the factory to verified.
//
// Deploy:  supabase functions deploy kashier-webhook --no-verify-jwt
// Secrets: KASHIER_PAYMENT_API_KEY   (same key used to hash the order)
// Set this function's URL as the payment webhook in your Kashier dashboard
// (and it's also passed as serverWebhook at checkout time).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYMENT_API_KEY = Deno.env.get("KASHIER_PAYMENT_API_KEY") ?? "";

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
    if (req.method !== "POST") return new Response("method", { status: 405 });
    if (!PAYMENT_API_KEY) return new Response("not configured", { status: 200 });

    const body = await req.json().catch(() => null);
    const data = body?.data ?? body;
    if (!data) return new Response("ignored", { status: 200 });

    // Validate the Kashier signature: HMAC-SHA256 of the signatureKeys fields
    // (in order, as a query string) using the Payment API Key.
    const signature: string = (data.signature || "").toLowerCase();
    const keys: string[] = Array.isArray(data.signatureKeys) ? data.signatureKeys : [];
    if (!signature || keys.length === 0) return new Response("no signature", { status: 401 });

    const qp = new URLSearchParams();
    for (const k of keys) qp.append(k, data[k] == null ? "" : String(data[k]));
    const expected = await hmacSha256Hex(PAYMENT_API_KEY, qp.toString());
    if (expected !== signature) return new Response("bad signature", { status: 401 });

    // Only act on a genuinely successful payment.
    const status = String(data.status || data.paymentStatus || "").toUpperCase();
    if (status !== "SUCCESS") return new Response("not a successful payment", { status: 200 });

    // The orderId we generated at checkout comes back as merchantOrderId.
    const ref = data.merchantOrderId || data.orderId;
    if (!ref) return new Response("no reference", { status: 200 });

    const { error } = await admin.rpc("apply_subscription_payment", {
      p_ref: String(ref),
      p_provider_ref: String(data.transactionId ?? data.kashierOrderId ?? ""),
      p_provider: "kashier",
    });
    if (error) return new Response(`apply error: ${error.message}`, { status: 200 });
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 200 });
  }
});
