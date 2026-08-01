# Sonnaع — email templates

Two email systems, redesigned to share one brand look.

## 1. Notification emails (automatic)
Sent by the `notify-email` Edge Function — new message, quote request, matching
request, request update, new review, factory verified, consultation booked.
Each type has its own accent colour, icon and call-to-action. **Nothing to paste
— just redeploy the function** (`supabase/functions/notify-email/index.ts`).

## 2. Supabase Auth emails (paste these in the dashboard)
Signup confirmation, password reset, magic link and change-email are sent by
Supabase Auth, so their templates live in the dashboard, not in code. To apply
the redesigned versions:

1. Supabase dashboard → **Authentication** → **Emails** (Email Templates).
2. For each template below, open the matching tab, switch the body to **HTML /
   source**, delete what's there, and paste the file's contents:

   | Dashboard template            | File                     |
   |-------------------------------|--------------------------|
   | Confirm signup                | `confirm-signup.html`    |
   | Reset password (Recovery)     | `reset-password.html`    |
   | Magic Link                    | `magic-link.html`        |
   | Change Email Address          | `change-email.html`      |

3. Save each one.

The `{{ .ConfirmationURL }}` / `{{ .Email }}` / `{{ .NewEmail }}` placeholders are
Supabase variables — leave them exactly as they are; Supabase fills them in when
it sends. You can also set a friendlier **Subject** per template, e.g.
"Confirm your email — Sonnaع", "Reset your Sonnaع password".
