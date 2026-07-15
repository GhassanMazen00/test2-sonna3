# Sonnaع — Payments & pay-to-verify

When a factory owner subscribes, they pay through a gateway, a **signed webhook**
confirms the payment, and the factory is flipped to **Verified — visit pending**
immediately. You then visit them and an admin marks them **Visited**.

The app supports **Kashier** (default) and **Paymob**. Pick your provider by
setting `window.PAYMENT_CHECKOUT_FN` in `assets/js/supabase-config.js`
(`'kashier-checkout'` or `'paymob-checkout'`) and deploying that provider's two
Edge Functions.

> **Security:** verification is only ever granted by the signed webhook, never by
> the browser. The amount is decided server-side. Never paste your keys in code,
> chat, or commits — they live only in **Supabase → Edge Functions → Secrets**.

---

# Kashier (default)

## 1. Get your Kashier keys
From the Kashier dashboard: your **Merchant ID (MID)**, your **Payment API Key**
(the iframe/order-hash key), and note **test vs live** mode. Start in **test**.

## 2. Run the SQL
Run **`supabase/payments.sql`** in the SQL editor (adds `verification_status`,
the `subscriptions` + `payment_intents` tables, the `apply_subscription_payment`
and `mark_factory_visited` RPCs, and relaxes the factory guard so only the
trusted server can flip verification).

## 3. Set the secrets
**Supabase → Edge Functions → Secrets:**

| Secret | Value |
|---|---|
| `KASHIER_MID` | your Merchant ID (e.g. `MID-xxxx`) |
| `KASHIER_PAYMENT_API_KEY` | your Payment API Key |
| `KASHIER_MODE` | `test` (switch to `live` later) |
| `KASHIER_VERIFIED_AMOUNT` | price in **EGP** (e.g. `500`) — optional, defaults to 500 |
| `SITE_URL` | `https://sonna3.net` |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are injected automatically.

> Your **Secret Key** isn't needed for this hosted-checkout flow (the Payment API
> Key both signs the order and validates the webhook). Keep it for later if you
> add server-to-server calls like refunds.

## 4. Deploy the Edge Functions
Dashboard → Edge Functions → **Deploy via Editor** (paste each `index.ts`):
- **`kashier-checkout`** — leave "Verify JWT" **on** (called by logged-in owners).
- **`kashier-confirm`** — turn "Verify JWT" **off**. This verifies the signed
  redirect Kashier sends back and flips the factory to verified. It's the
  primary path and does **not** need Kashier's webhook to be configured.
- **`kashier-webhook`** — turn "Verify JWT" **off** (optional backup: fires if
  you configure Kashier's server webhook; same result).

## 5. Point Kashier at the webhook
The checkout already passes `serverWebhook` = your function URL. Also set it in
the Kashier dashboard's webhook settings to be safe:

```
https://<your-project-ref>.functions.supabase.co/kashier-webhook
```

And confirm `window.PAYMENT_CHECKOUT_FN` is `'kashier-checkout'` (it is by default).

## 6. Test in Kashier test mode
1. On a factory's page, click **Subscribe & get verified** → you land on Kashier →
   pay with a Kashier **test card**.
2. Watch the `kashier-webhook` **Logs** in Supabase — it should log `ok`. The
   factory flips to **Verified — visit pending**, the owner gets a notification,
   and `payment-return.html` shows the success screen.
3. In **Admin → Factories**, the factory shows a **Visit pending** chip and a
   **Mark visited** button — click it after your real visit to upgrade the badge.

> If the webhook logs `bad signature`, the signature format differs slightly for
> your account — check the raw webhook payload in the logs and confirm Kashier's
> `signatureKeys` / `signature` fields; the validation is in
> `kashier-webhook/index.ts`.

Switch `KASHIER_MODE` to `live` (and use live keys) when it all works.

---

# Paymob (alternative)

Same model, different provider. Set `window.PAYMENT_CHECKOUT_FN = 'paymob-checkout'`,
deploy `paymob-checkout` / `paymob-webhook`, and set these secrets instead:
`PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_INTEGRATION_ID`,
`PAYMOB_HMAC_SECRET`, `PAYMOB_VERIFIED_AMOUNT` (piasters), `SITE_URL`. Point
Paymob's "Transaction processed callback" at the `paymob-webhook` URL.

---

## How the badge works
- **unverified** → grey, locked page.
- **active_pending_visit** (just paid) → **Verified** badge live, page unlocked,
  can respond to RFQs. Owner sees "Verified — visit being scheduled."
- **visited** (after your on-site visit, admin click) → full **Verified**.

Buyers see both paid states as verified; "visited" just carries more weight.

## Recurring / renewals
Each payment is a one-time 30-day subscription (`current_period_end`). For
automatic monthly renewal, add saved-card/token charging later and a scheduled
job that re-charges before the period ends — the same `apply_subscription_payment`
path extends it.
