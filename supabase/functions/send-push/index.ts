// Sonnaع — send-push Edge Function
// Fired by a Database Webhook on INSERT into public.notifications (the same
// event that drives notify-email). Looks up the recipient's device tokens with
// the service role and delivers a push via Firebase Cloud Messaging (HTTP v1).
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secrets: FCM_SERVICE_ACCOUNT  (the full service-account JSON, one line)
//          FCM_PROJECT_ID       (optional — falls back to the JSON's project_id)
//
// Database Webhook: Table public.notifications, event Insert, type Supabase
//   Edge Function, function send-push. (Mirror the notify-email webhook.)
//
// Runs on Supabase's servers, not in the app. Verify after deploying by
// inserting a test notification and watching a real device.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "";

// Page-view pings stay in-app only — too noisy to push (matches notify-email).
const SKIP_TYPES = new Set(["view"]);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// ---- Google OAuth2 access token from the service account (RS256 JWT) ----
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(str: string): string {
  return b64url(new TextEncoder().encode(str));
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let _tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && _tokenCache.exp - 60 > now) return _tokenCache.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64urlStr(JSON.stringify(header)) + "." + b64urlStr(JSON.stringify(claim));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + "." + b64url(new Uint8Array(sig));

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt,
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error("token exchange failed: " + JSON.stringify(j));
  _tokenCache = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

Deno.serve(async (req) => {
  try {
    if (!SA_RAW) return new Response("FCM_SERVICE_ACCOUNT not set", { status: 200 });
    const sa = JSON.parse(SA_RAW);
    const projectId = Deno.env.get("FCM_PROJECT_ID") || sa.project_id;

    const payload = await req.json();
    const n = payload?.record ?? payload;   // Database Webhook shape
    if (!n || !n.user_id || SKIP_TYPES.has(n.type)) return new Response("skip", { status: 200 });

    // Recipient's devices.
    const { data: rows } = await admin
      .from("device_tokens")
      .select("token")
      .eq("user_id", n.user_id);
    const tokens: string[] = (rows ?? []).map((r: any) => r.token).filter(Boolean);
    if (!tokens.length) return new Response("no devices", { status: 200 });

    const accessToken = await getAccessToken(sa);
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const title = String(n.title || "Sonnaع");
    const body = String(n.body || "");
    const link = String(n.link || "");

    let sent = 0;
    const dead: string[] = [];
    for (const token of tokens) {
      const message = {
        message: {
          token,
          notification: { title, body },
          data: { link, type: String(n.type || "") },
          android: { priority: "HIGH", notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      };
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (r.ok) {
        sent++;
      } else {
        // Prune tokens FCM reports as gone so the table stays clean.
        const errBody = await r.text();
        if (r.status === 404 || /UNREGISTERED|InvalidRegistration|NotRegistered/i.test(errBody)) {
          dead.push(token);
        }
      }
    }
    if (dead.length) await admin.from("device_tokens").delete().in("token", dead);

    return new Response(JSON.stringify({ sent, pruned: dead.length }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("error: " + (e?.message || String(e)), { status: 200 });
  }
});
