# API Platform — backend callable contract

Status: **implemented.** The admin console calls the Cloud Functions listed
below through `services/apiPlatformClient.ts`. Keep both files in sync when
adding new platform capabilities.

## Callables

| Callable | Client method | Permission (server-enforced) |
|---|---|---|
| `apiPlatformListApplications` | `listApplications()` | `admin.apiplatform.read` |
| `apiPlatformCreateApplication` | `createApplication(input)` | `admin.apiplatform.manage` |
| `apiPlatformListKeys` | `listApiKeys()` | `admin.apiplatform.read` |
| `apiPlatformCreateKey` | `createApiKey(input)` | `admin.apiplatform.manage` |
| `apiPlatformRevokeKey` | `revokeApiKey(keyId)` | `admin.apiplatform.manage` |
| `apiPlatformUpdateKeyStatus` | `updateApiKeyStatus(keyId, status)` | `admin.apiplatform.manage` |
| `apiPlatformGetUsage` | `getUsageSummary()` | `admin.apiplatform.read` |
| `apiPlatformListUsageLogs` | `listUsageLogs()` | `admin.apiplatform.read` |

Permission strings map to the client registry (`lib/access/permissions.ts`):
`admin.apiplatform.read` = role admin or super; `admin.apiplatform.manage` =
super only. Enforce via the same role resolution used by `adminWhoAmI` /
`requireAdmin` middleware — never trust a role claim from the request payload.
When org-scoped access lands, `owner_org_id` filters list responses and an
`requireOrgAdmin(orgId)` check guards mutations on org-owned applications.

## Data model (Firestore)

- `api_applications/{appId}`: name, description, environment
  (`development|production`, immutable after create), owner_org_id (nullable),
  created_by, created_at.
- `api_keys/{keyId}`: app_id, name, prefix, **secret_hash (SHA-256)**,
  environment (inherited from app), scopes[], status
  (`active|disabled|revoked`), created_by, created_at, last_used_at,
  rate_limit_per_min, monthly_quota.
- `api_usage_logs/{entryId}`: timestamp, key_prefix, endpoint, status,
  latency_ms. Paginated reads; 90-day retention is enough at current scale.

## Security requirements (non-negotiable)

1. **Secret generation is server-side only.** `apiPlatformCreateKey` generates
   the secret, returns it once in the response, stores only the SHA-256 hash
   (same pattern as `llm/models.ts` `keyHash()` for provider key health).
2. **No raw secret anywhere else**: not in Firestore, not in logs, not in
   audit details, not in any list/read response. List responses carry `prefix`
   only.
3. **Scope + quota validation per request** in the public API gateway: a key
   must carry the scope for the endpoint it calls; rate limit and monthly
   quota are enforced server-side (reuse the quotas pattern in
   `admin/usageLog.ts`).
4. **Revocation is immediate and irreversible** (`failed-precondition` when
   re-enabling a revoked key).
5. **Every mutation writes `admin_audit_log`** (actions:
   `api_app_create`, `api_key_create`, `api_key_revoke`,
   `api_key_status_change`) with key prefix only in details.
6. **Provider keys stay out of scope**: the API platform never reads
   `platform_config/llm` or model-registry keys; partner traffic goes through
   `resolveProvider()` like first-party traffic so tiering/pooling apply.

## Error contract

Use callable `HttpsError` codes; the client surfaces `error.message` directly:
`permission-denied` (missing permission), `not-found` (unknown app/key),
`failed-precondition` (revoked key, empty scopes), `resource-exhausted`
(quota), `invalid-argument` (validation).

## Deliberately deferred

Webhooks (`api_webhooks`) — no consumer exists yet; add when a partner needs
push delivery. Quota rules stay per-key fields rather than a separate rules
collection at this scale.
