# Email deliverability — known limitation (verification & password reset)

**Status:** unresolved by design during the test/beta phase. Tracked here so it is
not re-diagnosed as a bug and is not forgotten before launch.

## Current situation

Firebase Auth sends its transactional emails — **email verification** and
**password reset** (same sender) — from the project default:

- Sender: `noreply@career-copilot-a3168.firebaseapp.com`
- Config (`notification.sendEmail.method`): `DEFAULT` — no custom SMTP, no custom
  sender domain. Verified via the Identity Toolkit admin config API on 2026-07-01.

The client-side send itself works: signup calls `sendEmailVerification()`
(`components/Auth.tsx`, `components/business/BusinessSignUpModal.tsx`) and the
request returns `200`. **The problem is delivery, not sending.**

## Root cause

The shared `firebaseapp.com` sender domain has no SPF / DKIM / DMARC records that
this project controls. Strict receivers cannot verify the mail against a domain
reputation we own, so they filter, quarantine, or silently drop it.

## Impact (who does / doesn't receive it)

| Receiver | Likelihood of delivery |
| --- | --- |
| Chinese ISPs (163.com, qq.com) | Very low — usually dropped silently |
| Corporate mailboxes (Microsoft 365 / Exchange, security gateways like Proofpoint / Mimecast / Barracuda) | Low — often quarantined or blocked; on average worse than consumer Gmail |
| Consumer Gmail | Mostly delivered (may land in spam/promotions). Not empirically confirmed for this project — only that the send request returns 200. |

Because the client's real users are on **company-suffix email addresses**, expect
low deliverability for them until this is fixed.

## Why this is not blocking right now

Email verification is **non-blocking**: it does not gate access. A signed-in user
with `emailVerified === false` is only shown a reminder toast
(`CareerApp.tsx` — the `emailVerified === false` branch) and is let straight into
the workspace/portal. So users who never receive the email can still use the app.

> Do **not** turn verification into a hard gate while delivery is unreliable, or
> 163/qq and corporate users get locked out.

Note that **password reset** shares the same sender and is a *hard* dependency — a
locked-out user cannot reset their password if the email never arrives.

## Why the fix is deferred

The fix is domain-bound (SPF/DKIM/DMARC + provider domain verification live on the
sending domain). A demo-stage VM domain is temporary and should be replaced, so
configuring delivery now would have to be redone after the switch.

**Decision (2026-07-01):** keep the default sender for now; revisit once the
permanent domain is chosen. Treat proper sender setup as a **pre-launch
requirement** for client-facing use — not optional polish.

## Interim workaround (testing / demo)

Generate a verification (or password-reset) link on demand via the Admin API and
hand it to the user directly, bypassing delivery:

```
POST https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode
Authorization: Bearer <admin token>
{ "requestType": "VERIFY_EMAIL", "email": "<user>", "returnOobLink": true,
  "targetProjectId": "career-copilot-a3168" }
```

The response `oobLink` is the official verification link for that account.

## What to do when the permanent domain is set (pre-launch)

1. Pick a transactional sender (SendGrid / Mailgun / Amazon SES) or an SMTP on the
   permanent domain.
2. Configure SPF, DKIM, and DMARC DNS records for the sending domain.
3. Point Firebase Auth `notification.sendEmail` at that custom SMTP (admin API or
   Firebase console). **No app code change is required** — the existing
   `sendEmailVerification()` / password-reset flows keep working; only delivery
   changes.

The verification-link *landing* domain (the action URL, for example the value
resolved from `platform_config/app.app_base_url`) is a
separate concern and does **not** affect deliverability.

## Related

- Code fix that made the verification email actually fire (a mount-guard race was
  skipping it): commit `201a883`.
- Launch prerequisites also live in `docs/deploy-checklist.md`.
