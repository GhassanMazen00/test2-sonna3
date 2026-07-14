# Sonnaع — Payments & pay-to-verify (Paymob)

When a factory owner subscribes, they pay through **Paymob**, a signed webhook
confirms the payment, and the factory is flipped to **Verified — visit pending**
immediately. You then visit them and an admin marks them **Visited**.

Everything in the app is built. What's left is your **Paymob account + pasting
keys into Supabase**, then testing in Paymob's test mode.

> **Security:** verification is only ever granted by the signed webhook
> (`paymob-webhook`), never by the browser. The amount is decided server-side.
> Don't skip the HMAC secret — it's what proves a callback really came from Paymob.

---

## 1. Create a Paymob account
1. Sign up at **paymob.com** (Egypt) and complete merchant onboarding (business
   docs + bank account for EGP settlement).
2. In the dashboard, note these from **Settings / Developers**:
   - **Secret key** (`egy_sk_…`) and **Public key** (`egy_pk_…`) — the Unified Intention API.
   - **Integration ID** for the **card** payment method (a number). Add wallets /
     Fawry integrations later and pass their IDs the same way.
   - **HMAC secret** (Developers → HMAC).

## 2. Run the SQL
Run **`supabase/payments.sql`** in the SQL editor. It adds `verification_status`
to factories, the `subscriptions` and `payment_intents` tables, the
`apply_subscription_payment()` RPC the webhook calls, `mark_factory_visited()`
for admins, and relaxes the factory guard so only the trusted server (service
role) can flip verification.

## 3. Set the secrets
**Supabase → Edge Functions → Secrets:**

| Secret | Value |
|---|---|
| `PAYMOB_SECRET_KEY` | your `egy_sk_…` |
| `PAYMOB_PUBLIC_KEY` | your `egy_pk_…` |
| `PAYMOB_INTEGRATION_ID` | the card integration ID (number) |
| `PAYMOB_HMAC_SECRET` | your HMAC secret |
| `PAYMOB_VERIFIED_AMOUNT` | price in **piasters** (e.g. `50000` = 500.00 EGP) — optional, defaults to 50000 |
| `SITE_URL` | `https://sonna3.net` |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are injected automatically.

## 4. Deploy the two Edge Functions
Dashboard → Edge Functions → **Deploy via Editor** (paste each `index.ts`):
- **`paymob-checkout`** — leave "Verify JWT" **on** (called by logged-in owners).
- **`paymob-webhook`** — turn "Verify JWT" **off** (Paymob calls it, no user token).

## 5. Point Paymob at the webhook
In Paymob → your integration / Developers → **Transaction processed callback**,
set the URL to your deployed function:

```
https://<your-project-ref>.functions.supabase.co/paymob-webhook
```

(Also set the **Transaction response callback** — the browser redirect — to
`https://sonna3.net/payment-return.html`; the app also passes this as
`redirection_url`.)

## 6. Test in Paymob test mode
1. Use Paymob's **test** keys and a test card.
2. On a factory's page, click **Subscribe & get verified** → you land on Paymob →
   pay with the test card.
3. Watch the `paymob-webhook` **Logs** in Supabase — it should log `ok`. The
   factory flips to **Verified — visit pending**, the owner gets a notification,
   and `payment-return.html` shows the success screen.
4. In **Admin → Factories**, the factory shows a **Visit pending** chip and a
   **Mark visited** button — click it after your real visit to upgrade the badge.

Switch to live keys when it all works end-to-end.

---

## How the badge works
- **unverified** → grey, locked page.
- **active_pending_visit** (just paid) → **Verified** badge live, page unlocked,
  can respond to RFQs. Owner sees "Verified — visit being scheduled."
- **visited** (after your on-site visit, admin click) → full **Verified**.

Buyers see both paid states as verified; "visited" just carries more weight.

## Recurring / renewals
This charges a one-time 30-day subscription per payment (`current_period_end`).
For automatic monthly renewal, use Paymob's saved-card / MOTO tokenization later
and add a scheduled job that re-charges before `current_period_end` — the same
`apply_subscription_payment` path extends the period.

## International cards
Paymob accepts foreign Visa/Mastercard on the same integration. For full
multi-currency / non-Egyptian payouts, add Stripe or Paddle behind a
non-Egyptian entity later — the `subscriptions` model already supports a
different `provider`.
