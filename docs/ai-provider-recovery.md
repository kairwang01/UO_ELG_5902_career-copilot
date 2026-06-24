# Runbook — restore AI when "all AI tools are unavailable"

**Symptom.** Every AI tool fails for candidates with *"AI features are temporarily
unavailable."* The admin dashboard (`/admin → Dashboard`) shows a red banner:
**"No AI provider keys are configured — all AI tools are currently failing."**

**Root cause.** `aiProxy` resolves the model key from `platform_config/llm`
(set via the admin console) with a `process.env.GEMINI_API_KEY` fallback. When
both are empty, `getGeminiApiKey()` throws `"...API_KEY is not set"` and every AI
call returns `unavailable`. This is a **configuration/runtime** state, not a code
bug — no deploy of app code turns AI back on; a provider key must be present.

This is an expected state after a fresh environment or if the `platform_config/llm`
doc was cleared. Recovery is ~2 minutes and needs no app rebuild.

---

## Prerequisite: you must be a SUPER admin

Provider-key management (`Models & Keys`) is **super-only** (`admin.keys` /
`admin.models` permissions). A regular `admin` can SEE the red dashboard banner
but cannot edit keys. Confirm/obtain super:

- **Env bootstrap:** add your uid to the `ADMIN_UIDS` functions env var → resolves
  to `super` (see `functions/src/admin/roles.ts`). Requires a functions redeploy.
- **Or** an existing super sets `platform_config/access.admins.<uid> = { role:
  "super", status: "active" }`.

(Legacy `platform_config/access.admin_uids[]` only grants `admin`, not super.)

---

## Steps

1. **Deploy the latest functions** so the key-save path works. `adminUpdateLlmConfig`
   previously returned **500** when saving a provider with a blank fallback/base-URL
   (it wrote `undefined`, which Firestore rejects); that fix must be live before
   re-entering keys. Deploy targeted (NEVER `deploy --only functions` wholesale):

   ```sh
   firebase deploy --only functions:adminUpdateLlmConfig,functions:adminGetDashboard,functions:aiProxy
   ```

2. **Re-enter the key(s).** As a super admin: `/admin → Models & Keys`. In the
   **Provider** dropdown pick **Gemini** (free tier — the platform default), paste
   the API key into **New API key**, optionally set the model, then **Save**.
   Repeat for **KairLLM** (paid) / **DeepSeek** (business) if your tiers use them.

3. **Verify.** `adminUpdateLlmConfig` calls `refreshPlatformCaches()`, so the
   change is immediate (the `aiProxy` cache TTL is 60s on other instances). The
   dashboard banner clears and the **AI providers** row shows the provider as
   configured. Run any AI tool (e.g. resume analysis) to confirm a real response.

### Alternative (no console)

Set `GEMINI_API_KEY` (and `KAIRLLM_API_KEY` / `DEEPSEEK_API_KEY` as needed) in the
functions environment / `functions/.env`, then redeploy the affected functions.
The Firestore `platform_config/llm` value takes precedence over the env fallback.

---

## Guardrails (so this can't silently recur)

- `e2e/admin-keys-recovery.spec.ts` locks the full chain: red banner visible →
  super saves a key with a blank fallback → **no 500** → key persists.
- The dashboard provider-health banner makes the outage visible to any admin.
- Open product decision: provider-key *editing* is super-only by design. If
  day-to-day operators are `admin`, consider granting `admin` the
  `admin.models`/`admin.keys` permissions so ops can self-recover.
