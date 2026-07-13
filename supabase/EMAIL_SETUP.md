# Sonnaع — Email, verification & notification emails

This covers three things you asked for:

1. **Email verification on sign-up** (required for new users)
2. **Optional phone verification** (only if the user adds a phone)
3. **Notification emails** (new message, matching post, request updates, factory updates)

Everything the app needs is already in the code. What's left is **account setup you
do once** (Resend for email, optionally Twilio for SMS) and **pasting keys into
Supabase**. Follow the steps in order.

---

## 0. Prerequisite — an email sender (Resend)

Deliverability requires sending from your own domain.

1. Create an account at **resend.com** (free tier is plenty to start).
2. **Domains → Add domain** → add your domain (e.g. `sonnaa.com`).
3. Add the **DNS records** it shows you (SPF + DKIM) at your registrar. Wait for **Verified**.
4. **API Keys → Create** → copy the key (starts `re_…`). Keep it secret.

You now have: a verified domain + an API key. Everything below uses them.

---

## 1. Email verification on sign-up  (no code deploy — dashboard only)

Supabase Auth already does this; you just turn it on and point it at Resend so the
emails are branded and reliable.

1. **Supabase → Authentication → Providers → Email** → enable **Confirm email**.
2. **Supabase → Project Settings → Authentication → SMTP Settings** → **Enable custom SMTP** and enter Resend's SMTP:
   - Host: `smtp.resend.com`   Port: `465`
   - Username: `resend`
   - Password: your Resend **API key** (`re_…`)
   - Sender email: `no-reply@yourdomain`   Sender name: `Sonnaع`
3. **Authentication → URL Configuration** → set **Site URL** to your site (e.g. `https://yourdomain`) and add it to **Redirect URLs**. (This is where the confirm link sends people.)
4. (Optional) **Authentication → Email Templates → Confirm signup** → tweak the wording/branding.

That's it. The app is already built for this: after sign-up the user sees a
"check your inbox" screen with a **Resend email** button, and they can't get a
session until they confirm (Supabase blocks login until then). New sign-ups are
now email-verified.

---

## 2. Notification emails  (deploy one Edge Function + one webhook)

We already write in-app notifications to the `notifications` table (new message,
matching request, review, view, etc.). This step emails them too, respecting each
user's preferences.

### 2a. Run the SQL
Run **`supabase/email_notifications.sql`** in the SQL editor. It adds per-user email
preferences + an unsubscribe token, and an `unsubscribe_all(token)` RPC.

### 2b. Deploy the Edge Function
`supabase/functions/notify-email/` is ready to deploy.

```bash
# one-time
npm i -g supabase
supabase login
supabase link --project-ref qtphintmxyncwlpxenha

# set secrets the function needs
supabase secrets set RESEND_API_KEY=re_your_key
supabase secrets set FROM_EMAIL="Sonnaع <no-reply@yourdomain>"
supabase secrets set SITE_URL=https://yourdomain

# deploy
supabase functions deploy notify-email --no-verify-jwt
```

### 2c. Fire it on every new notification (Database Webhook)
**Supabase → Database → Webhooks → Create a new hook**
- Table: `public.notifications`  ·  Events: **Insert**
- Type: **Supabase Edge Function** → `notify-email`
- (Method POST, default headers are fine.)

Now: message → in-app bell **and** an email (if that user hasn't opted out). The
function looks up the recipient's email + prefs with the service role, maps the
notification `type` to a preference, and sends via Resend. Every email has an
**unsubscribe** link (`/unsubscribe.html?token=…`) — the page is already in the app.

> Note: the `view` notification type is intentionally **not** emailed (it would be
> noisy). Messages / matches / request-updates / factory-updates are.

Each user controls exactly which of these they receive by email from **Account →
Verification & notifications** (four toggles: messages & quotes, sector matches,
updates on their requests, factory updates). Those toggles are the
`notify_messages / notify_matches / notify_requests / notify_factory` columns the
function checks before sending.

---

## 3. Optional phone verification  (needs an SMS provider — Twilio)

Only do this when you want phone verification. Email works without it.

1. Create a **Twilio** account → **Verify → Services → Create** → copy the **Verify Service SID** (`VA…`), plus your **Account SID** and **Auth Token**.
2. Run the phone part of `supabase/email_notifications.sql` (the `verified_phones`
   table is already in that file).
3. Deploy the OTP function:
   ```bash
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxx
   supabase secrets set TWILIO_AUTH_TOKEN=your_token
   supabase secrets set TWILIO_VERIFY_SID=VAxxxx
   supabase functions deploy phone-otp
   ```
The account page already has **Add phone → Send code → Enter code → Verified**. It
calls `phone-otp` (`action:"start"` then `action:"check"`); on success the function
records the number in `verified_phones` (service role), and the profile shows a
**Verified** badge. Phone stays optional — nothing is blocked if a user skips it.

---

## Costs / notes
- Resend free tier: ~3k emails/mo, 100/day. Plenty early; scales cheaply.
- Twilio Verify is pay-per-verification (a few US cents each).
- Marketing/newsletters are a separate concern — when you get there, Resend
  Broadcasts or Brevo/Mailchimp, using the same verified domain + the
  `notify_*` opt-ins as your consent record.
