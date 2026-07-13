# Sonnaع — Email, verification & notification emails

This covers three things you asked for:

1. **Email verification on sign-up** (required for new users)
2. **Optional phone verification** (only if the user adds a phone)
3. **Notification emails** (new message, matching post, request updates, factory updates)

Everything the app needs is already in the code. What's left is **account setup you
do once** (Resend for email, optionally Twilio for SMS) and **pasting keys into
Supabase**. Follow the steps in order.

> **Do these in order.** The confirmation and unsubscribe emails link back to
> `https://sonna3.net`, so the site has to be live at that domain **first**
> (Step 1) — otherwise those links land on a dead page. Email hosting (Step 2+)
> and site hosting (Step 1) use *different, non-conflicting* DNS records on the
> same domain, so you can set them all up in one sitting at your registrar.

**At a glance:**

| Step | What | Where |
|---|---|---|
| 1 | Point `sonna3.net` at the site | GitHub Pages + registrar DNS |
| 2 | Email sender | Resend |
| 3 | Require email verification | Supabase Auth |
| 4 | Notification emails | SQL + Edge Function + Webhook |
| 5 | Optional phone verification | Twilio |

---

## 1. Point `sonna3.net` at your site (GitHub Pages)

Your files are on GitHub Pages, so first make the domain serve the site. This is
what the confirmation/unsubscribe links (and eventually everything) point at.

### 1a. Keep the custom domain sticky (repo file)
GitHub Pages needs a `CNAME` file containing `sonna3.net` in the served root, or
it drops the custom domain on the next deploy. **This repo already has one** (see
`CNAME` at the root). If you ever change the domain, edit that file.

### 1b. Turn it on in the repo
1. Repo **Settings → Pages**.
2. Note the **branch/folder** Pages builds from (usually `main` / root).
3. **Custom domain** → enter `sonna3.net` → **Save**. GitHub verifies the domain
   and starts issuing an HTTPS certificate.

### 1c. DNS at your registrar
Add these records for `sonna3.net` (they coexist with the email records in Step 2):

| Type | Name / Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `<your-github-username>.github.io` |

> If your registrar doesn't allow `AAAA` or an apex `CNAME`, the four `A` records
> alone are enough. The `www` CNAME is optional but recommended.

### 1d. Confirm
Wait for DNS to propagate (minutes–hours), then:
- Repo **Settings → Pages** shows the domain as verified.
- Tick **Enforce HTTPS**.
- `https://sonna3.net` loads the site with a valid padlock.

Only once `https://sonna3.net` actually loads should you set it as the Supabase
**Site URL** (Step 3) — that's what makes the email links resolve.

---

## 2. Email sender (Resend)

Your domain is **`sonna3.net`**, so you'll send from **`no-reply@sonna3.net`** and
your Site URL is **`https://sonna3.net`**. (Adjust if you host on `www.` instead.)

1. Create an account at **resend.com** (free tier is plenty to start).
2. **Domains → Add domain** → add **`sonna3.net`**.
3. Add the **DNS records** it shows you (SPF + DKIM) at your registrar. Wait for **Verified**.
4. **API Keys → Create** → copy the key (starts `re_…`). Keep it secret.

You now have: a verified domain + an API key. Everything below uses them.

> **Want to test before the DNS verifies?** You can. Skip the domain for now and
> use Resend's built-in sender **`onboarding@resend.dev`** with just the API key.
> The one limit: it only delivers to the email address you signed up to Resend
> with — perfect for testing the whole flow against your own inbox. Switch to
> `no-reply@sonna3.net` once the domain shows **Verified** (only the sender
> address / SMTP password change — no code changes).

---

## 3. Email verification on sign-up  (no code deploy — dashboard only)

Supabase Auth already does this; you just turn it on and point it at Resend so the
emails are branded and reliable.

1. **Supabase → Authentication → Providers → Email** → enable **Confirm email**.
2. **Supabase → Project Settings → Authentication → SMTP Settings** → **Enable custom SMTP** and enter Resend's SMTP:
   - Host: `smtp.resend.com`   Port: `465`
   - Username: `resend`
   - Password: your Resend **API key** (`re_…`)
   - Sender email: `no-reply@sonna3.net`   Sender name: `Sonnaع`
     (or `onboarding@resend.dev` while you're still testing)
3. **Authentication → URL Configuration** → set **Site URL** to `https://sonna3.net` and add it to **Redirect URLs**. (This is where the confirm link sends people.)
4. (Optional) **Authentication → Email Templates → Confirm signup** → tweak the wording/branding.

That's it. The app is already built for this: after sign-up the user sees a
"check your inbox" screen with a **Resend email** button, and they can't get a
session until they confirm (Supabase blocks login until then). New sign-ups are
now email-verified.

---

## 4. Notification emails  (deploy one Edge Function + one webhook)

We already write in-app notifications to the `notifications` table (new message,
matching request, review, view, etc.). This step emails them too, respecting each
user's preferences.

### 4a. Run the SQL
Run **`supabase/email_notifications.sql`** in the SQL editor. It adds per-user email
preferences + an unsubscribe token, and an `unsubscribe_all(token)` RPC.

### 4b. Deploy the Edge Function
`supabase/functions/notify-email/` is ready to deploy.

```bash
# one-time
npm i -g supabase
supabase login
supabase link --project-ref qtphintmxyncwlpxenha

# set secrets the function needs
supabase secrets set RESEND_API_KEY=re_your_key
supabase secrets set FROM_EMAIL="Sonnaع <no-reply@sonna3.net>"
supabase secrets set SITE_URL=https://sonna3.net
# (while testing, FROM_EMAIL can be "Sonnaع <onboarding@resend.dev>")

# deploy
supabase functions deploy notify-email --no-verify-jwt
```

### 4c. Fire it on every new notification (Database Webhook)
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

## 5. Optional phone verification  (needs an SMS provider — Twilio)

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
