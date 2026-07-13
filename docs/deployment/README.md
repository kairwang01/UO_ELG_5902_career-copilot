# Firebase and VM Deployment Guide

This is the production runbook for Career CoPilot. It covers the Firebase backend and the Ubuntu VM that serves the web application at `copilot.kairwang.cloud`.

Follow the sections in order for a new environment. For an ordinary release, use the shorter checklist in [Routine releases](#routine-releases).

The commands below assume:

- the repository is checked out at `/var/www/uottawa-copilot` on the VM;
- the Firebase project is `career-copilot-a3168`;
- Cloud Functions run in `us-central1`;
- the public domain is `copilot.kairwang.cloud`;
- the static server listens on `127.0.0.1:9050` behind nginx.

Replace those values when creating another environment. Never copy production keys into a staging project.

## What runs where

The application is split across two deployment targets:

| Part | Runs on | How it is released |
| --- | --- | --- |
| React/Vite frontend | Ubuntu VM, behind nginx | Build `dist/`, replace it atomically, restart `uottawa-copilot.service` |
| Callable and HTTP APIs | Firebase Cloud Functions, Node.js 22 | `firebase deploy --only functions:<name>` |
| Firestore security | Cloud Firestore | `firebase deploy --only firestore:rules` |
| Firestore indexes | Cloud Firestore | `firebase deploy --only firestore:indexes` |
| Resume and avatar storage rules | Firebase Storage | `firebase deploy --only storage` |
| Storage browser CORS | Google Cloud Storage bucket | `gcloud storage buckets update ... --cors-file=storage.cors.json` |
| Firebase default site | Firebase Hosting | A redirect only; it sends `*.web.app` traffic to the VM domain |

Firebase Hosting is not the production frontend host. Running `firebase deploy --only hosting` updates the redirect, not the application shown at `copilot.kairwang.cloud`.

## Values to collect before starting

Keep this worksheet outside the repository. A password manager or the deployment system's secret store is the right place.

| Value | Example | Secret? | Used by |
| --- | --- | --- | --- |
| Firebase project ID | `career-copilot-a3168` | No | CLI, frontend, Functions |
| Functions region | `us-central1` | No | Frontend Functions client |
| Firebase Web API key | Firebase console value | No | Frontend Firebase SDK |
| Firebase auth domain | `<project>.firebaseapp.com` | No | Frontend Firebase SDK |
| Firebase app ID | `1:...:web:...` | No | Frontend Firebase SDK |
| Firebase storage bucket | `<project>.firebasestorage.app` | No | Frontend Firebase SDK |
| Gemini API key | Provider key | Yes | Admin model registry or Functions fallback |
| Stripe secret key | `sk_test_...` or `sk_live_...` | Yes | Secret Manager |
| Stripe webhook secret | `whsec_...` | Yes | Secret Manager |
| Stripe publishable key | `pk_test_...` or `pk_live_...` | No | Frontend checkout |
| Stripe Price IDs | `price_...` | No | Functions billing config |
| Public app URL | `https://copilot.kairwang.cloud` | No | Redirects, email links, Stripe returns |
| VM public IP | IPv4 address | No | DNS A record |

The Firebase Web API key is an application identifier, not a server secret. Its safety comes from Firebase Auth, Firestore/Storage rules, API restrictions, and authorized domains. Gemini and Stripe secret keys must never appear in a `VITE_*` variable or a browser bundle.

## 1. Install the command-line tools

### Local workstation

Install Node.js 22, npm, Git, the Firebase CLI, and the Google Cloud CLI.

```bash
node --version
npm --version
git --version
firebase --version
gcloud --version
```

The Functions package declares Node.js 22 in `functions/package.json`. Use the same major version locally and in CI.

Install or update the Firebase CLI:

```bash
npm install --global firebase-tools@15.22.1
```

Authenticate interactively:

```bash
firebase login
gcloud auth login
gcloud auth application-default login
```

On a headless VM, use:

```bash
firebase login --no-localhost
```

Do not put a personal Firebase refresh token in the repository. CI should use Workload Identity Federation or a narrowly scoped service account.

### Ubuntu VM packages

```bash
sudo apt-get update
sudo apt-get install --yes nginx certbot python3-certbot-nginx rsync git curl ca-certificates
```

Install Node.js 22 using the package source approved for the VM, then confirm:

```bash
node --version
npm --version
```

The output of `node --version` must start with `v22`.

## 2. Create and prepare the Firebase project

Create the project in the Firebase console or select an existing Google Cloud project and add Firebase to it.

Confirm that the CLI can see it:

```bash
firebase projects:list
firebase use --add
firebase use
```

`firebase use --add` writes the project alias to `.firebaserc`. This repository uses:

```json
{
  "projects": {
    "default": "career-copilot-a3168"
  }
}
```

Always pass `--project` in production commands even when the default alias is correct. It prevents an accidental deploy to whichever project was selected in another terminal.

For a brand-new environment, the CLI equivalents are:

```bash
firebase projects:create YOUR_PROJECT_ID
firebase apps:create WEB "Career CoPilot Web" --project YOUR_PROJECT_ID
firebase apps:list WEB --project YOUR_PROJECT_ID
firebase apps:sdkconfig WEB YOUR_FIREBASE_WEB_APP_ID --project YOUR_PROJECT_ID
```

List valid Firestore regions and create the default database if it does not exist:

```bash
firebase firestore:locations
firebase firestore:databases:create '(default)' \
  --project YOUR_PROJECT_ID \
  --location us-central1 \
  --edition standard
```

Database creation is permanent with respect to location. Choose it before writing production data.

### Enable Firebase products

In the Firebase console:

1. Enable Email/Password in **Authentication > Sign-in method**.
2. Add the production domain under **Authentication > Settings > Authorized domains**.
3. Create a Firestore database in Native mode.
4. Create the default Storage bucket.
5. Register a Web App and copy its public configuration values.

Cloud Functions deployment enables most required Google Cloud APIs automatically. The project must allow these services:

- Cloud Functions
- Cloud Build
- Artifact Registry
- Cloud Run
- Eventarc
- Pub/Sub
- Cloud Scheduler
- Secret Manager
- Firestore
- Firebase Storage

If an organization policy prevents automatic enablement, an administrator must enable the blocked API before the deploy is retried.

## 3. Understand the repository Firebase configuration

### `.firebaserc`

Maps the local `default` alias to the real Firebase project ID. It contains no credentials.

### `firebase.json`

The file has five sections:

#### `functions`

```json
{
  "source": "functions",
  "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
}
```

- `source` tells Firebase where the Functions package lives.
- `predeploy` compiles TypeScript before an upload. A type error stops the release.

#### `hosting`

`public` points to `dist`, but this project's Hosting rules redirect every path to `https://copilot.kairwang.cloud`. The `rewrites` entry is retained as a safe SPA fallback if the redirect is removed later.

The currently deployed default site may be an older meta-refresh page rather than the 301 declared in `firebase.json`. Test a preview channel before replacing it:

```bash
firebase hosting:channel:deploy redirect-check \
  --expires 1h \
  --project career-copilot-a3168
```

Open the preview URL and test `/`, `/workspace`, and one unknown SPA path. Deploy the redirect only after the preview behaves as intended:

```bash
firebase deploy --project career-copilot-a3168 --only hosting
```

Verify both headers and body because an older meta-refresh release can return HTTP 200:

```bash
curl -sSI https://career-copilot-a3168.web.app/
curl -sS https://career-copilot-a3168.web.app/ | head
```

#### `firestore`

Points at `firestore.rules` and `firestore.indexes.json`. Rules control authorization. Indexes support the compound queries used by usage reporting, messages, and interviews.

#### `storage`

Points at `storage.rules`. Browser CORS is separate and is configured on the bucket with `storage.cors.json`.

#### `emulators`

The default local ports are:

| Emulator | Port |
| --- | ---: |
| Auth | 9199 |
| Functions | 5001 |
| Firestore | 8080 |
| Storage | 9197 |
| Emulator UI | 4001 |

`firebase.qa.json` uses alternate ports for QA scripts that must run alongside another emulator session.

## 4. Configure the frontend

Copy the example file:

```bash
cp .env.example .env.local
chmod 600 .env.local
```

Set the Firebase Web App values:

```dotenv
VITE_FIREBASE_API_KEY=replace_with_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=career-copilot-a3168.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=career-copilot-a3168
VITE_FIREBASE_STORAGE_BUCKET=career-copilot-a3168.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=replace_with_sender_id
VITE_FIREBASE_APP_ID=replace_with_app_id
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_replace_me
```

What each value does:

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Identifies the Firebase web project |
| `VITE_FIREBASE_AUTH_DOMAIN` | Hosts Firebase Auth redirects and session helpers |
| `VITE_FIREBASE_PROJECT_ID` | Selects Firestore and Functions project resources |
| `VITE_FIREBASE_STORAGE_BUCKET` | Selects the resume/avatar bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Part of the Firebase Web App identity |
| `VITE_FIREBASE_APP_ID` | Unique Firebase Web App identifier |
| `VITE_FIREBASE_FUNCTIONS_REGION` | Must match `setGlobalOptions` in `functions/src/index.ts` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Opens Stripe checkout in the browser; a `pk_*` value only |

Do not add any of these:

```dotenv
VITE_API_KEY=...
VITE_GEMINI_API_KEY=...
VITE_STRIPE_SECRET_KEY=...
```

Every `VITE_*` value is eligible for inclusion in the browser build. Server keys belong in Firestore admin configuration, Functions environment files, or Secret Manager.

## 5. Configure Cloud Functions

Install and compile the Functions package:

```bash
npm --prefix functions ci
npm --prefix functions run build
```

The runtime is defined in `functions/package.json`:

```json
{
  "engines": {
    "node": "22"
  }
}
```

### Project-specific environment file

Firebase automatically loads `functions/.env.<project-id>` during deployment. For production, the path is:

```text
functions/.env.career-copilot-a3168
```

The repository ignores `.env` and `.env.*` files. Confirm before every commit:

```bash
git status --short
git check-ignore -v functions/.env.career-copilot-a3168
```

A production file can contain non-secret runtime choices and compatibility fallbacks:

```dotenv
APP_BASE_URL=https://copilot.kairwang.cloud
ALLOWED_REDIRECT_ORIGINS=https://copilot.kairwang.cloud
BILLING_SIMULATION=false
OPPORTUNITY_USE_GOOGLE_SEARCH=true
GEMINI_MODEL=gemini-3.5-flash
LLM_SPEED_ROUTE_ATTEMPT_TIMEOUT_MS=30000
LLM_SPEED_ROUTE_TOTAL_TIMEOUT_MS=45000
LLM_QUALITY_REPAIR_START_BEFORE_MS=25000

STRIPE_PRICE_ESSENTIALS=price_replace_me
STRIPE_PRICE_ACCELERATOR=price_replace_me
STRIPE_PRICE_EXECUTIVE=price_replace_me
STRIPE_PRICE_STARTER=price_replace_me
STRIPE_PRICE_GROWTH=price_replace_me
STRIPE_PRICE_PRO=price_replace_me
STRIPE_PRICE_SINGLE_POST=price_replace_me
STRIPE_PRICE_JOB_PACK=price_replace_me
STRIPE_PRICE_PACK_100=price_replace_me
STRIPE_PRICE_PACK_500=price_replace_me
STRIPE_PRICE_PACK_1000=price_replace_me
```

| Variable | Meaning |
| --- | --- |
| `APP_BASE_URL` | Fallback domain for Stripe return URLs and server-built links |
| `ALLOWED_REDIRECT_ORIGINS` | Comma-separated extra origins allowed for safe post-payment returns |
| `BILLING_SIMULATION` | `true` uses the demo checkout path; production billing requires `false` |
| `OPPORTUNITY_USE_GOOGLE_SEARCH` | Enables Gemini Search grounding when not set to `false` |
| `GEMINI_MODEL` | Environment fallback when Firestore has no model setting |
| `GEMINI_FALLBACK_MODEL` | Optional model retry target; omit to disable |
| `LLM_SPEED_ROUTE_ATTEMPT_TIMEOUT_MS` | Maximum time for one speed-pool member attempt |
| `LLM_SPEED_ROUTE_TOTAL_TIMEOUT_MS` | Total deadline for a speed-pool generation call |
| `LLM_QUALITY_REPAIR_START_BEFORE_MS` | Latest point at which a second-pass quality repair may start |
| `STRIPE_PRICE_*` | Stripe Price IDs for candidate and employer plans |
| `SENTRY_DSN` | Optional server-side Sentry project DSN |
| `SENTRY_TRACES_RATE` | Optional server trace sampling rate, for example `0.1` |

`BILLING_SIMULATION=true` is a demo setting. It must not be described as a live Stripe deployment.

`STRIPE_PRICE_PACK_100`, `STRIPE_PRICE_PACK_500`, and `STRIPE_PRICE_PACK_1000` are one-time credit-pack prices. The other `STRIPE_PRICE_*` values cover subscriptions and employer posting products.

### Secret Manager

Stripe Functions bind Secret Manager values directly. Set them with:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY --project career-copilot-a3168
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project career-copilot-a3168
firebase functions:secrets:list --project career-copilot-a3168
```

The first two commands prompt for the secret value without putting it on the command line. Redeploy the Functions that bind a changed secret:

```bash
firebase deploy --project career-copilot-a3168 \
  --only functions:createCheckoutSession,functions:createBillingPortalSession,functions:stripeWebhook
```

The current AI provider resolution order is:

1. `platform_config/llm` in Firestore, managed through the Admin Portal;
2. the matching Functions environment variable as a fallback.

The supported fallback environment variables are:

```dotenv
GEMINI_API_KEY=
KAIRLLM_API_KEY=
KAIRLLM_BASE_URL=https://ai.gogosling.ca/v1
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

Do not duplicate working provider keys across several configuration layers without a reason. It makes rotation and incident response harder. Prefer the Admin Portal for the current model registry and keep only an intentional emergency fallback in the Functions environment.

## 6. Configure Firestore runtime settings

The protected `platform_config` collection holds operational settings that can change without a code release.

| Document | Contents |
| --- | --- |
| `platform_config/llm` | Gemini, KairLLM, and DeepSeek keys/models/base URLs |
| `platform_config/models` | Model registry, default model, routing pools, module routes |
| `platform_config/quotas` | Plan quotas, tool costs, token caps, feature gates |
| `platform_config/prompts` | Published prompt overrides |
| `platform_config/access` | Admin role assignments |
| `platform_config/app` | Canonical public URL |
| `platform_config/web3` | Optional Web3 module configuration |

Set the canonical domain in `platform_config/app`:

```json
{
  "app_base_url": "https://copilot.kairwang.cloud"
}
```

Use the Admin Portal for LLM keys, models, routing pools, prompts, quotas, and admin roles. The portal masks stored credentials and writes an audit record for mutations.

Bootstrap the first super administrator only after that person has a Firebase Auth account. Always pass the email explicitly; the script has a development-era default that must not be used accidentally:

```bash
gcloud auth application-default login
export GCLOUD_PROJECT=career-copilot-a3168
cd functions
node scripts/grantSuper.js administrator@example.com
```

For the default Gemini route:

- model: `gemini-3.5-flash`;
- speed-route thinking: `low`, except deterministic resume reformatting, which uses `minimal`;
- speed attempt timeout: 30 seconds;
- speed total timeout: 45 seconds;
- add a tested fallback member before relying on automatic pool failover.

## 7. Configure Storage CORS

`storage.rules` controls authorization. `storage.cors.json` controls which browser origins may send upload requests to the bucket. Both are required.

Apply CORS:

```bash
gcloud storage buckets update \
  gs://career-copilot-a3168.firebasestorage.app \
  --cors-file=storage.cors.json \
  --project=career-copilot-a3168
```

Inspect it:

```bash
gcloud storage buckets describe \
  gs://career-copilot-a3168.firebasestorage.app \
  --format='yaml(cors_config)' \
  --project=career-copilot-a3168
```

Test the browser preflight:

```bash
curl -i -X OPTIONS \
  -H 'Origin: https://copilot.kairwang.cloud' \
  -H 'Access-Control-Request-Method: PUT' \
  -H 'Access-Control-Request-Headers: content-type' \
  'https://firebasestorage.googleapis.com/v0/b/career-copilot-a3168.firebasestorage.app/o/deploy-check'
```

The response should be successful and include an allowed origin matching the request.

## 8. Run the release gate

Install dependencies from the lockfiles:

```bash
npm ci
npm --prefix functions ci
```

Run the non-destructive checks:

```bash
npm run localization:check
npx tsc --noEmit
npm --prefix functions run build
npx vitest run
npm run build
```

Run emulator-backed checks before a release that changes auth, rules, billing, storage, or callables:

```bash
npm run test:rules
npm run test:callables
npm run smoke:runtime-critical
npm run smoke:tool-execution
npm run smoke:account-profile
npm run test:e2e
```

The emulator tests require Java. On Ubuntu, install a supported JRE and set `JAVA_HOME` to the VM's actual Java path rather than copying the macOS path found in older package scripts.

## 9. Deploy Firebase resources

### Rules and indexes

Run a dry run first:

```bash
firebase deploy --dry-run \
  --project career-copilot-a3168 \
  --only firestore:rules,firestore:indexes,storage
```

Then deploy:

```bash
firebase deploy \
  --project career-copilot-a3168 \
  --only firestore:rules,firestore:indexes,storage
```

Wait for every composite index to become ready:

```bash
gcloud firestore indexes composite list \
  --project=career-copilot-a3168 \
  --database='(default)' \
  --format='table(name.basename(),queryScope,state)'
```

For a production database, decide whether to enable delete protection and point-in-time recovery. Both can affect operating cost and recovery procedures:

```bash
firebase firestore:databases:update '(default)' \
  --project career-copilot-a3168 \
  --delete-protection ENABLED \
  --point-in-time-recovery ENABLED
```

### Cloud Functions

This production project still contains legacy per-tool Functions that are not exported by the current source tree. Do not run a forced, untargeted Functions deployment. It can offer to delete those functions.

Review the production table without dumping environment variables:

```bash
firebase functions:list --project career-copilot-a3168
```

Deploy only the changed functions:

```bash
firebase deploy --project career-copilot-a3168 \
  --only functions:aiProxy,functions:analyzeResume,functions:generateCoverLetter
```

Shared-module changes require every importing function to be named. For changes under `functions/src/llm`, a typical AI release includes:

```bash
firebase deploy --project career-copilot-a3168 --only \
functions:aiProxy,\
functions:analyzeResume,\
functions:mockInterview,\
functions:generateCoverLetter,\
functions:generateCareerPath,\
functions:careerCoach,\
functions:extractTextFromUrl,\
functions:generateHeadshot,\
functions:generateProfessionalHeadshot,\
functions:discoverTalent,\
functions:listJobApplicants,\
functions:publicApi
```

Confirm the selected functions are active:

```bash
gcloud functions list --v2 \
  --regions=us-central1 \
  --project=career-copilot-a3168 \
  --format='table(name.basename(),updateTime,state,buildConfig.runtime)'
```

Avoid `firebase functions:list --json` in shared logs. The raw output can include ordinary runtime environment variables.

## 10. Prepare the VM

### DNS

Create an A record:

```text
copilot.kairwang.cloud -> VM_PUBLIC_IPV4
```

Wait until it resolves from outside the VM:

```bash
dig +short copilot.kairwang.cloud
```

### Repository

Create a dedicated service account and clone the production branch:

```bash
sudo useradd --system --no-create-home \
  --home-dir /var/www/uottawa-copilot \
  --shell /usr/sbin/nologin \
  copilot
sudo mkdir -p /var/www/uottawa-copilot
sudo chown "$USER":"$USER" /var/www/uottawa-copilot
git clone --branch main git@github.com:abhishek-ip/Career-CoPilot-uOttawa.git /var/www/uottawa-copilot
cd /var/www/uottawa-copilot
npm ci
npm --prefix functions ci
sudo chown -R copilot:copilot /var/www/uottawa-copilot
```

Create `/var/www/uottawa-copilot/.env.local`, set only the public frontend values from [Configure the frontend](#4-configure-the-frontend), and apply:

```bash
sudo chown copilot:copilot /var/www/uottawa-copilot/.env.local
sudo chmod 600 /var/www/uottawa-copilot/.env.local
```

### systemd service

Create `/etc/systemd/system/uottawa-copilot.service`:

```ini
[Unit]
Description=Career CoPilot static SPA on port 9050
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/uottawa-copilot
Environment=PORT=9050
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node /var/www/uottawa-copilot/static-server.mjs
Restart=on-failure
RestartSec=3
User=copilot
Group=copilot
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

The checked-in `static-server.mjs` serves hashed assets with long-lived caching, serves other files with `no-cache`, and falls back to `index.html` for client-side routes.

Load and enable the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable uottawa-copilot.service
```

Build once before starting the service:

```bash
cd /var/www/uottawa-copilot
sudo -u copilot npm run build
sudo systemctl start uottawa-copilot.service
sudo systemctl status uottawa-copilot.service --no-pager
curl -I http://127.0.0.1:9050/
```

If the repository must remain owned by a deployment user, grant `copilot` read/execute access only to `dist/` and `static-server.mjs`. Do not run the public service as root on a new VM.

## 11. Configure nginx and TLS

Create `/etc/nginx/sites-available/uottawa-copilot`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name copilot.kairwang.cloud;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:9050;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and test it:

```bash
sudo ln -s /etc/nginx/sites-available/uottawa-copilot /etc/nginx/sites-enabled/uottawa-copilot
sudo nginx -t
sudo systemctl reload nginx
```

Issue and install the certificate:

```bash
sudo certbot --nginx -d copilot.kairwang.cloud
sudo certbot renew --dry-run
```

Allow only the expected public ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Port 9050 stays bound to `127.0.0.1`; it should not be exposed by the firewall or cloud security group.

## 12. Publish the frontend atomically

Do not build directly over the live `dist/` directory. A browser can request a new `index.html` while old assets are being deleted, causing a temporary blank page.

From the repository root:

```bash
set -euo pipefail

ROOT=/var/www/uottawa-copilot
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
STAGE="$ROOT/dist.release-$STAMP"
BACKUP="$ROOT/dist.rollback-$STAMP"

mkdir "$STAGE"
npm run build -- --outDir "$STAGE"

test -s "$STAGE/index.html"
ENTRY=$(sed -n 's/.*src="\/\(assets\/index-[^"]*\.js\)".*/\1/p' "$STAGE/index.html")
test -n "$ENTRY"
test -s "$STAGE/$ENTRY"

mv "$ROOT/dist" "$BACKUP"
mv "$STAGE" "$ROOT/dist"
sudo systemctl restart uottawa-copilot.service

curl --fail --silent --show-error \
  --retry 4 --retry-all-errors --retry-delay 1 \
  https://copilot.kairwang.cloud/ >/dev/null

echo "Rollback directory: $BACKUP"
```

The retry is intentional. nginx can return one brief 502 while systemd replaces the Node process.

After the release, keep the newest known-good rollback directory. Remove older rollbacks only after the new version has been observed in production.

## 13. Verify production

### Frontend routes

```bash
for path in / /pricing /employers /sample-report /workspace /privacy.html /robots.txt; do
  curl -sS -o /dev/null -w "$path %{http_code}\n" "https://copilot.kairwang.cloud$path"
done
```

Expected result: every path returns `200`.

### API authorization boundary

An unauthenticated callable request must not return application data:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H 'content-type: application/json' \
  -d '{"data":{"tool":"convertResumeFormat"}}' \
  'https://us-central1-career-copilot-a3168.cloudfunctions.net/aiProxy'
```

Expected result: `401`.

The public API should also reject a missing API key:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'https://us-central1-career-copilot-a3168.cloudfunctions.net/publicApi/v1/jobs'
```

Expected result: `401`.

### Service and proxy

```bash
sudo systemctl is-active uottawa-copilot.service
sudo nginx -t
sudo journalctl -u uottawa-copilot.service --since '15 minutes ago' --no-pager
sudo tail -n 100 /var/log/nginx/uottawa-copilot.error.log
```

### Functions logs

Use narrow, non-secret fields for an AI error review:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="aiproxy" AND severity>=ERROR' \
  --project=career-copilot-a3168 \
  --limit=50 \
  --format='table(timestamp,severity,jsonPayload.event,jsonPayload.tool,jsonPayload.errorCode)'
```

### Authenticated smoke test

Use a dedicated QA account with a small credit balance. Check at least:

1. one `aiProxy` structured tool;
2. one Google Search-grounded tool;
3. resume analysis;
4. cover letter generation;
5. headshot generation;
6. Admin Portal model connection test;
7. candidate and employer navigation on a mobile viewport.

Do not use a production customer's account for release testing.

## 14. Roll back

### Frontend rollback

```bash
set -euo pipefail

ROOT=/var/www/uottawa-copilot
BAD="$ROOT/dist.failed-$(date -u +%Y%m%dT%H%M%SZ)"
GOOD="$ROOT/dist.rollback-REPLACE_WITH_TIMESTAMP"

sudo systemctl stop uottawa-copilot.service
mv "$ROOT/dist" "$BAD"
mv "$GOOD" "$ROOT/dist"
sudo systemctl start uottawa-copilot.service
curl --fail --retry 4 --retry-all-errors https://copilot.kairwang.cloud/
```

### Functions rollback

Cloud Functions revisions are managed by Google Cloud. The safest code rollback is to check out the last known-good commit, run the release gate, and redeploy the same explicit function list.

```bash
git checkout LAST_KNOWN_GOOD_COMMIT
npm --prefix functions ci
npm --prefix functions run build
firebase deploy --project career-copilot-a3168 \
  --only functions:aiProxy,functions:generateCoverLetter
```

Do not roll back Firestore rules independently from code unless the old rules remain compatible with all documents written by the current release.

### Secret rollback

Secret Manager keeps versions. Disable a compromised version only after the replacement secret has been set and every function that binds it has been redeployed.

## 15. Routine releases

### Promote `dev` to `main`

`main` is the production branch. Keep promotion fast-forward-only:

```bash
git checkout dev
git pull --ff-only origin dev

npm ci
npm --prefix functions ci
npm run localization:check
npx tsc --noEmit
npm --prefix functions run build
npx vitest run
npm run build

git checkout main
git pull --ff-only origin main
git merge --ff-only dev
git push origin main
```

If `git merge --ff-only dev` fails, stop and inspect the branch graph. Do not force-push `main` to hide a divergence.

### Point the VM auto-deployer at `main`

The optional VM timer uses `/usr/local/bin/uottawa-copilot-autodeploy.sh`. If a VM was originally set up to track `dev`, change these items before enabling it:

1. set `BRANCH=main` in the script;
2. update the systemd service and timer descriptions so they no longer say `origin/dev`;
3. replace a dev-only fetch refspec with a main refspec:

```bash
cd /var/www/uottawa-copilot
git config --unset-all remote.origin.fetch
git config --add remote.origin.fetch '+refs/heads/main:refs/remotes/origin/main'
git fetch origin main
```

Keep the timer disabled until all of these checks pass:

```bash
cd /var/www/uottawa-copilot
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain)"
git merge-base --is-ancestor HEAD origin/main
sudo systemctl daemon-reload
```

Then enable it deliberately:

```bash
sudo systemctl enable --now uottawa-copilot-autodeploy.timer
systemctl list-timers uottawa-copilot-autodeploy.timer
```

The deploy script intentionally aborts on a dirty working tree. Rollback directories are ignored by this repository, but source edits on the VM must still be reviewed and committed elsewhere before the timer can run.

### Backend release

```bash
firebase deploy --dry-run \
  --project career-copilot-a3168 \
  --only firestore:rules,firestore:indexes,storage

firebase deploy \
  --project career-copilot-a3168 \
  --only firestore:rules,firestore:indexes,storage

firebase deploy \
  --project career-copilot-a3168 \
  --only functions:REPLACE_WITH_CHANGED_FUNCTIONS
```

### VM frontend release

```bash
cd /var/www/uottawa-copilot
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci
```

Then run the atomic publish procedure from [Publish the frontend atomically](#12-publish-the-frontend-atomically).

## Production hardening still worth enabling

These settings are not required for the first deploy, but they should be explicit launch decisions:

- enable Firestore delete protection;
- enable Firestore point-in-time recovery if the plan and region support it;
- configure budget alerts for Cloud Functions, Cloud Run, Firestore, Storage, Gemini, and Stripe;
- install and configure the Firebase Trigger Email extension if the application is expected to consume documents written to the `mail` collection;
- move the live systemd service from `root` to a dedicated unprivileged account;
- keep Storage in the intended region (`us-east1` in the current production project) and Functions in their declared regions;
- review the one legacy `us-east1`/generation-1 auth trigger before changing global region or runtime assumptions.

### Transactional email extension

Application notifications write email jobs to the Firestore `mail` collection. Email is sent only when the Firebase **Trigger Email from Firestore** extension is installed and connected to an SMTP provider.

```bash
cp extensions/firestore-send-email.env.example extensions/firestore-send-email.env
chmod 600 extensions/firestore-send-email.env
firebase ext:install firebase/firestore-send-email \
  --project career-copilot-a3168
firebase ext:list --project career-copilot-a3168
```

During installation:

- keep the collection name as `mail`;
- use `us-central1`;
- configure an authenticated SMTP service;
- use a verified sender domain;
- keep the SMTP password in Secret Manager, not in Git.

After installation, trigger an applicant status email and verify delivery, bounce handling, and the reply-to address.

## 16. Common failures

### `firebase deploy` wants to delete functions

Cause: production has functions that are not exported by the checked-out source tree.

Action: answer no, then rerun with an explicit `functions:<name>` list. Do not use `--force`.

### The VM site returns 502

Check the service and local port:

```bash
sudo systemctl status uottawa-copilot.service --no-pager
sudo journalctl -u uottawa-copilot.service -n 100 --no-pager
curl -I http://127.0.0.1:9050/
sudo nginx -t
```

### A deep link returns 404

The checked-in static server supplies the SPA fallback only for paths without file extensions. Confirm systemd starts `static-server.mjs`, not a generic file server.

### Resume upload fails in the browser

Check all three layers:

1. `storage.rules` is deployed;
2. `storage.cors.json` is applied to the real bucket;
3. `VITE_FIREBASE_STORAGE_BUCKET` names that same bucket.

### AI requests fail near 20 seconds

Confirm the latest Functions revision is active and the speed-route defaults are present:

```dotenv
LLM_SPEED_ROUTE_ATTEMPT_TIMEOUT_MS=30000
LLM_SPEED_ROUTE_TOTAL_TIMEOUT_MS=45000
```

For Gemini 3.5 Flash, use `minimal` thinking for deterministic transformations and `low` for tasks that need evaluation or writing quality. Do not solve a timeout by raising every request to several minutes; that hides unhealthy routing and produces poor user feedback.

### A yellow AI status banner stays visible

The frontend treats the banner as a 30-second recent-request incident. A successful AI request, browser reconnection, account change, or the expiry timer clears it. If it persists on an old tab, reload once to fetch the latest frontend assets.

### Stripe checkout stays in simulation

Check:

```dotenv
BILLING_SIMULATION=false
```

Then confirm real `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and every `STRIPE_PRICE_*` value are configured. Placeholder Price IDs are not a live billing setup.

## 17. Security rules for operators

- Never commit `.env`, `.env.*`, `.env.local`, service-account JSON, provider keys, Stripe secrets, or Firebase CLI credentials.
- Never put a Gemini, KairLLM, DeepSeek, or Stripe secret key in a `VITE_*` variable.
- Build production frontend assets from an allow-listed environment, not from an operator's full shell environment.
- Use a named Functions deployment list on this project; do not use a forced full deployment.
- Keep the VM's application port private and expose only nginx.
- Use separate Firebase and Stripe projects for production and staging.
- Rotate a leaked key before deleting evidence needed to understand the incident.
- Keep one tested frontend rollback directory until the replacement release has been observed.
- Review Firestore and Storage rules as code. Console edits are temporary and will be overwritten by the next deployment.
