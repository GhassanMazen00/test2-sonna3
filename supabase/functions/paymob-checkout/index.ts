// Sonnaع — paymob-checkout Edge Function
// Creates a Paymob payment (Unified Intention API) for the signed-in factory
// owner's "Verified" subscription and returns a hosted checkout URL.
//
// The amount is decided SERVER-SIDE (never trust the client). We store a
// payment_intents row keyed by a unique reference we send to Paymob as
// special_reference; the webhook uses it to know what was paid for.
//
// Deploy:  supabase functions deploy paymob-checkout
// Secrets: PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_INTEGRATION_ID,
//          PAYMOB_VERIFIED_AMOUNT (optional, piasters), SITE_URL
//
// Cannot be exercised in the app's Node harness — test with Paymob test keys
// after deploying.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SECRET_KEY = Deno.env.get("PAYMOB_SECRET_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("PAYMOB_PUBLIC_KEY") ?? "";
const INTEGRATION_ID = Number(Deno.env.get("PAYMOB_INTEGRATION_ID") ?? "0");
const VERIFIED_AMOUNT = Number(Deno.env.get("PAYMOB_VERIFIED_AMOUNT") ?? "50000"); // 500.00 EGP
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SECRET_KEY || !PUBLIC_KEY || !INTEGRATION_ID) {
    return json({ error: "Payments are not configured yet." }, 200);
  }

  // Authenticate the caller.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "auth" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false },
  });
  const { data: uWrap } = await userClient.auth.getUser();
  const user = uWrap?.user;
  if (!user) return json({ error: "auth" }, 401);

  // The plan (only "verified" for now) and its server-side amount.
  const amount = VERIFIED_AMOUNT;
  const plan = "verified";

  // The caller's factory (so the webhook verifies exactly this factory).
  const { data: fac } = await admin
    .from("factories").select("id, name").eq("owner", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!fac) return json({ error: "Create your factory page first." }, 200);

  // Profile for billing data.
  const { data: prof } = await admin
    .from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
  const name = (prof?.full_name || user.email || "Customer").toString();
  const first = name.split(" ")[0] || "Customer";
  const last = name.split(" ").slice(1).join(" ") || "-";

  const ref = crypto.randomUUID();
  const { error: piErr } = await admin.from("payment_intents").insert({
    ref, owner: user.id, factory_id: fac.id, plan, amount_cents: amount, currency: "EGP", status: "pending",
  });
  if (piErr) return json({ error: "Could not start checkout." }, 200);

  // Create the Paymob intention.
  const intentBody = {
    amount,
    currency: "EGP",
    payment_methods: [INTEGRATION_ID],
    special_reference: ref,
    items: [{ name: "Sonnaع Verified plan", amount, description: "Verified factory subscription", quantity: 1 }],
    billing_data: {
      first_name: first, last_name: last,
      email: user.email ?? "buyer@example.com",
      phone_number: (prof?.phone || "+201000000000").toString(),
      country: "EG", city: "Cairo", street: "-", building: "-", floor: "-", apartment: "-",
    },
    extras: { factory_id: fac.id, owner: user.id, plan },
    redirection_url: `${SITE_URL}/payment-return.html`,
  };

  const res = await fetch("https://accept.paymob.com/v1/intention/", {
    method: "POST",
    headers: { Authorization: `Token ${SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(intentBody),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.client_secret) {
    return json({ error: data?.detail || "Payment provider error." }, 200);
  }

  const url = `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(PUBLIC_KEY)}&clientSecret=${encodeURIComponent(data.client_secret)}`;
  return json({ url });
});
