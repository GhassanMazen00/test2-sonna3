// Sonnaع — paymob-webhook Edge Function
// Paymob's server-to-server "Transaction processed callback". This is the ONLY
// thing that grants verification: it validates Paymob's HMAC signature, and on
// a successful payment calls apply_subscription_payment() (service role) which
// records the subscription and flips the factory to verified.
//
// Deploy:  supabase functions deploy paymob-webhook --no-verify-jwt
// Secrets: PAYMOB_HMAC_SECRET
// Configure this function's URL as the "Transaction processed callback" in
// Paymob (Developers → Webhooks / your integration).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("PAYMOB_HMAC_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Paymob's documented field order for the transaction-callback HMAC.
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction",
  "id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded",
  "is_standalone_payment", "is_voided", "order.id", "owner", "pending",
  "source_data.pan", "source_data.sub_type", "source_data.type", "success",
];

function pick(obj: Record<string, unknown>, path: string): string {
  const v = path.split(".").reduce<any>((o, k) => (o == null ? o : o[k]), obj);
  if (v === true) return "true";
  if (v === false) return "false";
  return v == null ? "" : String(v);
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha512(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("method", { status: 405 });
    const url = new URL(req.url);
    const receivedHmac = (url.searchParams.get("hmac") || "").toLowerCase();
    const payload = await req.json().catch(() => null);
    const obj = payload?.obj;
    if (!obj || !HMAC_SECRET) return new Response("ignored", { status: 200 });

    // Verify the signature.
    const concatenated = HMAC_FIELDS.map((f) => pick(obj, f)).join("");
    const expected = await hmacSha512(HMAC_SECRET, concatenated);
    if (!receivedHmac || expected !== receivedHmac) {
      return new Response("bad signature", { status: 401 });
    }

    // Only act on a genuinely successful, non-refunded, non-voided payment.
    const ok = obj.success === true && obj.error_occured === false && obj.is_refunded === false && obj.is_voided === false;
    if (!ok) return new Response("not a successful payment", { status: 200 });

    // special_reference is echoed back as order.merchant_order_id.
    const ref = obj?.order?.merchant_order_id || obj?.payment_key_claims?.extra?.ref;
    if (!ref) return new Response("no reference", { status: 200 });

    const { error } = await admin.rpc("apply_subscription_payment", {
      p_ref: String(ref),
      p_provider_ref: String(obj.id ?? ""),
    });
    if (error) return new Response(`apply error: ${error.message}`, { status: 200 });
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 200 });
  }
});
