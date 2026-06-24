# Runbook — canonical app domain (`APP_BASE_URL`)

**Symptom.** After paying, Stripe returns the user to
`https://<project>.web.app/...` instead of the site they started from. Candidate
notification emails ("Open Career CoPilot") link to the same wrong domain.

**Root cause.** Server-built absolute URLs read a single configured domain, not
the request:

- Stripe `success_url` / `cancel_url` and the billing-portal `return_url`
  (`functions/src/handlers/stripeBilling.ts`) — via `appBaseUrl()`:
  `APP_BASE_URL || PUBLIC_APP_URL || WEB_APP_URL`.
- The interview-progress email link (`functions/src/handlers/notifications.ts`
  → `email/interviewProgress.ts`) — via `APP_BASE_URL` (with a hardcoded
  fallback if unset).

If `APP_BASE_URL` (or `PUBLIC_APP_URL`/`WEB_APP_URL`) is set to the Firebase
`*.web.app` domain while users actually browse a custom domain, every
server-built link points at `*.web.app`.

---

## Fix (one config change)

Set `APP_BASE_URL` to your real public domain in the functions environment and
redeploy. It has the highest precedence, so it overrides the other two vars and
is the value the email path reads:

```sh
# functions/.env (or your secret/CI env)
APP_BASE_URL=https://your-canonical-domain.example.com

firebase deploy --only functions
```

This fixes, in one place:
1. Stripe checkout success/cancel redirects,
2. the billing-portal return URL,
3. notification email links.

---

## Multi-domain (optional)

Checkout/portal redirects also prefer the **origin the request came from**, when
it's allow-listed — so a user who starts checkout on domain A returns to A, on B
returns to B (`resolveAppBaseUrl` in `stripeBilling.ts`). Allow-listed =
the `APP_BASE_URL` host + this project's `*.web.app`/`*.firebaseapp.com` +
`localhost` (dev). To trust additional custom domains, set:

```sh
ALLOWED_REDIRECT_ORIGINS=https://app.example.com,https://careers.example.com
```

A non-allow-listed origin falls back to `APP_BASE_URL` (this is deliberate — an
unvalidated origin would be an open redirect after payment). Emails always use
`APP_BASE_URL` (they're sent server-side, with no request origin to read).

---

## Verify

1. Start checkout from your canonical domain; the Stripe page's cancel link and
   the post-payment return should both be on that domain.
2. Trigger an application-status change and confirm the email's
   "Open Career CoPilot" button points at the canonical domain.

Covered by `tests/stripeRedirectUrl.test.ts` (origin allow-list + fallback).
