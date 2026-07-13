// Sonnaع — phone-otp Edge Function
// Optional phone verification via Twilio Verify.
//   action:"start"  { phone }        -> Twilio sends an SMS code
//   action:"check"  { phone, code }  -> verifies; on success records the number
//                                        in verified_phones (service role)
//
// Deploy:  supabase functions deploy phone-otp
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID
//
// Requires a logged-in user: the caller's JWT is verified so a number is only
// ever bound to the person who proved they control it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SID") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function normalizePhone(p: string): string {
  const t = String(p ?? "").trim();
  if (!t) return "";
  // Keep a leading + then digits only.
  const digits = t.replace(/[^\d]/g, "");
  return t.startsWith("+") ? "+" + digits : "+" + digits;
}

async function twilio(path: string, form: Record<string, string>) {
  const body = new URLSearchParams(form);
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${SID}:${TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  if (!SID || !TOKEN || !VERIFY_SID) {
    return json({ error: "Phone verification is not configured yet." }, 200);
  }

  // Authenticate the caller.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "auth" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: uWrap } = await userClient.auth.getUser();
  const user = uWrap?.user;
  if (!user) return json({ error: "auth" }, 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const action = payload?.action;
  const phone = normalizePhone(payload?.phone ?? "");
  if (!phone || phone.length < 8) return json({ error: "Enter a valid phone number." }, 200);

  if (action === "start") {
    const { ok, data } = await twilio("Verifications", {
      To: phone,
      Channel: "sms",
    });
    if (!ok) return json({ error: data?.message || "Could not send code." }, 200);
    return json({ ok: true, status: data?.status });
  }

  if (action === "check") {
    const code = String(payload?.code ?? "").trim();
    if (!code) return json({ error: "Enter the code." }, 200);
    const { ok, data } = await twilio("VerificationCheck", {
      To: phone,
      Code: code,
    });
    if (!ok || data?.status !== "approved") {
      return json({ error: "That code is incorrect or expired." }, 200);
    }
    // Bind the verified number to the caller (service role bypasses RLS).
    const { error } = await admin
      .from("verified_phones")
      .upsert({ user_id: user.id, phone, verified_at: new Date().toISOString() });
    if (error) return json({ error: "Could not save. Try again." }, 200);
    return json({ ok: true, verified: true, phone });
  }

  return json({ error: "unknown action" }, 400);
});
