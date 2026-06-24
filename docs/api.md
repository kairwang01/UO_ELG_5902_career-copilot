# Career CoPilot API

The Career CoPilot API lets approved partners call platform capabilities from
their own servers using a scoped API key.

## Authentication

Every request needs a key in the `Authorization` header:

```
Authorization: Bearer cc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are minted by a platform admin in **Admin → API Platform** (each key is
scoped, rate-limited, and tied to an application). The full secret is shown
once at creation — store it securely; only its prefix is ever displayed again.
Test keys are prefixed `cc_dev_`, live keys `cc_live_`.

## Base URL

```
https://<region>-<your-project-id>.cloudfunctions.net/publicApi
```

All responses are JSON. Success is `{ "ok": true, "data": … }`; failure is
`{ "ok": false, "error": { "code": "…", "message": "…" } }` with an HTTP status
that matches the error code.

## Endpoints

### `GET /v1/jobs` — scope `jobs.read`

Returns currently-active job postings (public fields only).

```bash
curl -H "Authorization: Bearer $CC_API_KEY" \
  https://<region>-<project-id>.cloudfunctions.net/publicApi/v1/jobs
```

```json
{
  "ok": true,
  "data": {
    "jobs": [
      {
        "id": "abc123",
        "title": "Frontend Engineer",
        "company_name": "Acme Inc.",
        "location": "Toronto, ON",
        "work_mode": "hybrid",
        "employment_type": "full_time",
        "salary_range": "$110k–140k CAD",
        "created_at": "2026-06-24T16:39:53.716Z"
      }
    ],
    "count": 1
  }
}
```

### `POST /v1/resume/analyze` — scope `resume.analyze`

Runs a structured resume analysis (ATS readiness, keywords, strengths,
improvements) for a target market.

Body:
- `resume_text` (string, required) — full resume text (max 50,000 chars).
- `market` (string, optional) — target market, e.g. `Canadian`, `United States`. Defaults to `Canadian`.

```bash
curl -X POST \
  -H "Authorization: Bearer $CC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resume_text":"Jane Doe — Software Engineer…","market":"Canadian"}' \
  https://<region>-<project-id>.cloudfunctions.net/publicApi/v1/resume/analyze
```

Returns `{ "ok": true, "data": { "analysis": { … } } }`.

### `POST /v1/cover-letter` — scope `tools.generate`

Generates a tailored cover letter from a resume + job description.

Body:
- `resume_text` (string, required) — full resume text (max 50,000 chars).
- `job_description` (string, required) — target job description (max 50,000 chars).
- `market` (string, optional) — target market. Defaults to `Canadian`.

```bash
curl -X POST \
  -H "Authorization: Bearer $CC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resume_text":"Jane Doe…","job_description":"Senior React role…"}' \
  https://<region>-<project-id>.cloudfunctions.net/publicApi/v1/cover-letter
```

Returns `{ "ok": true, "data": { "cover_letter": { … } } }`.

### `GET /v1/usage` — scope `usage.read`

Returns the calling key's own limits, current usage, and most recent requests.

```json
{
  "ok": true,
  "data": {
    "rate_limit_per_min": 60,
    "monthly_quota": 10000,
    "minute_used": 2,
    "month_used": 2,
    "recent": [
      { "timestamp": "2026-06-24T16:51:38.864Z", "endpoint": "GET /v1/jobs", "status": 200, "latency_ms": 84 }
    ]
  }
}
```

## Rate limits & quota

Each key carries a per-minute rate limit and a monthly request quota (defaults
60/min and 10,000/month; an admin can adjust per key). Exceeding either returns
`429` with code `rate_limited` or `quota_exceeded`.

## Error codes

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Missing/invalid body (e.g. no `resume_text`). |
| 401 | `missing_authorization` | No `Authorization: Bearer` header. |
| 401 | `invalid_key` | Key not recognized. |
| 403 | `key_inactive` | Key is disabled or revoked. |
| 403 | `insufficient_scope` | Key lacks the endpoint's scope. |
| 404 | `not_found` | No endpoint matches the method/path. |
| 429 | `rate_limited` / `quota_exceeded` | Per-minute or monthly limit hit. |
| 502 | `ai_error` | The analysis provider failed; retry. |
| 503 | `ai_unavailable` | No AI provider is configured; try later. |
| 500 | `internal_error` | Unexpected server error. |

```json
{ "ok": false, "error": { "code": "insufficient_scope", "message": "This key is missing the required 'resume.analyze' scope." } }
```
