# FlexiDash — Production Deployment & KV Provisioning Guide
**Target Platform**: Cloudflare Workers (via `@wix/astro-wix-hosting-adapter` / `@astrojs/cloudflare`)  

---

## 1. Environment Variables Specification

The following variables must be configured in your production deployment environment (e.g., Cloudflare Workers environment variables or Wix Cloud hosting secrets):

| Variable Name | Required | Default / Example | Purpose & Security Constraint |
|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Enforces production mode and disables development mocks. |
| `WIX_CLIENT_ID` | **Yes** | `fed82166-29ac-...` | Registered Wix App ID from the Wix Developers Center. |
| `WIX_CLIENT_SECRET` | **Yes** | `wix_sec_...` | App Secret used for HMAC-SHA256 signature verification of signed instances and webhooks. |
| `WIX_CLIENT_INSTANCE_ID` | Conditional | UUID | Default instance ID (used when running inside a single-tenant container). |
| `FLEXIDASH_AUTH_MODE` | **Yes** | `wix-native` | `wix-native` (Production). Setting `dev-mock` in production fails closed immediately. |
| `FLEXIDASH_JWT_SECRET` | **Yes** | Min 32 chars | Secret key for signing FlexiDash session JWTs. Must be cryptographically strong. |
| `FLEXIDASH_JWT_ISSUER` | No | `flexidash.wix.app` | Identifies token issuer claim (`iss`). |
| `FLEXIDASH_JWT_AUDIENCE` | No | `flexidash:api` | Identifies token audience claim (`aud`). |
| `FLEXIDASH_JWT_EXPIRES_IN` | No | `3600` | Inactivity lifetime of session JWTs in seconds (default: 1 hour). |

---

## 2. Cloudflare KV Namespaces Provisioning

Because Cloudflare Workers execute on an ephemeral, stateless edge runtime without persistent disk storage, **all persistent data MUST be backed by Cloudflare Workers KV** in production.

### Required KV Namespaces

Provision the following KV namespaces using Wrangler:

```bash
# 1. Primary App Storage KV (Layouts, Roles, Tenant Configurations, Audit Logs)
wrangler kv namespace create FLEXIDASH_KV
wrangler kv namespace create FLEXIDASH_KV --preview

# 2. Wix Astro Hosting Session KV (required by @wix/astro-wix-hosting-adapter)
wrangler kv namespace create SESSION
wrangler kv namespace create SESSION --preview
```

### Wrangler Configuration (`wrangler.jsonc` or `wrangler.toml`)

Bind the provisioned namespaces in your Cloudflare deployment configuration:

```jsonc
{
  "name": "flexidash",
  "main": "./dist/_worker.js",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    {
      "binding": "FLEXIDASH_KV",
      "id": "<YOUR_PROVISIONED_FLEXIDASH_KV_ID>",
      "preview_id": "<YOUR_PREVIEW_FLEXIDASH_KV_ID>"
    },
    {
      "binding": "SESSION",
      "id": "<YOUR_PROVISIONED_SESSION_KV_ID>",
      "preview_id": "<YOUR_PREVIEW_SESSION_KV_ID>"
    }
  ]
}
```

### Deployment Commands by Hosting Target

#### Option A: Wix CLI Managed Hosting (Standard Wix App Pipeline)
The application is pre-configured with `@wix/astro-wix-hosting-adapter` and `wix.config.json`:
```bash
# 1. Compile production server and client bundles
npm run build     # executes 'wix build'

# 2. Release to Wix Managed App Hosting
npm run release   # executes 'wix release'
```

#### Option B: Standalone Cloudflare Workers Deployment
For organizations hosting their own worker backend on Cloudflare:
```bash
# 1. Compile production worker
npm run build

# 2. Deploy to Cloudflare Workers
npx wrangler deploy
```

---

## 3. Storage Key Partitioning & Schemas

All entities stored in `FLEXIDASH_KV` follow strict multi-tenant key prefixes:

| Entity | Key Scheme | Description |
|---|---|---|
| **Site Layout** | `layout:{instanceId}:site_default` | Default dashboard grid for the tenant. |
| **Member Custom Layout** | `layout:{instanceId}:user:{userId}` | Personalized widget layout for specific member. |
| **Role Matrix** | `roles:{instanceId}:list` | List of system and custom roles with permission maps. |
| **Member Assignments** | `roles:{instanceId}:assignments` | Role assignments per user in the tenant. |
| **Audit Log Trail** | `audit:{instanceId}:events` | Immutable chronological array of security audit events. |
| **Tenant Configuration** | `tenant:{instanceId}:config` | Installation lifecycle status, plan ID, and site metadata. |

---

## 4. Storage Concurrency, Scaling & Backup Limitations

### A. KV Consistency Model & Eventual Consistency
Cloudflare Workers KV provides high-performance global read access with eventual consistency. Writes to a KV namespace are immediately consistent in the region of origin and propagate globally to all Cloudflare edge data centers within 60 seconds.

**Operational Implications:**
1. **Layout & Role Reads**: Cached edge reads return in sub-10ms.
2. **Concurrent Writes**: Cloudflare KV uses a *last-writer-wins* conflict resolution strategy. Rapid concurrent writes to the exact same key (e.g. two administrators editing the same custom role simultaneously) will result in the latest write prevailing.
3. **Audit Event Capping**: Audit logs are capped at 2,000 most recent events per tenant (`slice(0, 2000)`), keeping value payload sizes (~400 KB) well below Cloudflare KV's 25 MiB single-value ceiling. For enterprise retention requirements (>2,000 events or multi-year legal hold), Cloudflare Logpush or Cloudflare R2 bucket archival should be configured.

### B. Backup, Recovery & Retention
1. **Snapshot Backup**: Tenants' configuration and layouts can be backed up using the Wrangler CLI:
   ```bash
   # Export tenant configuration
   wrangler kv key get --binding=FLEXIDASH_KV "tenant:<INSTANCE_ID>:config" > backup-tenant.json
   # Export role definitions
   wrangler kv key get --binding=FLEXIDASH_KV "roles:<INSTANCE_ID>:list" > backup-roles.json
   ```
2. **Disaster Recovery**: To restore a corrupted or deleted tenant configuration:
   ```bash
   wrangler kv key put --binding=FLEXIDASH_KV "tenant:<INSTANCE_ID>:config" "$(cat backup-tenant.json)"
   ```
3. **Uninstall Retention**: When an app is uninstalled (`wix.app.removed`), the tenant's status is marked as `UNINSTALLED` and cached session states are invalidated, while audit trails and layout schemas are preserved for 30 days to facilitate re-installation before automatic lifecycle purging.

---

## 5. Production Fail-Closed Invariants

1. **No Silent Disk Fallback**: When `NODE_ENV === 'production'`, `validateProductionStorage()` will immediately throw a `ConfigurationError` if neither `FLEXIDASH_KV` nor `SESSION` is resolved. It will NEVER silently fall back to an ephemeral worker filesystem.
2. **Missing Secrets Validation**: If `WIX_CLIENT_ID` or `WIX_CLIENT_SECRET` is omitted in production, application startup aborts.
3. **Session Secret Minimum Entropy**: `FLEXIDASH_JWT_SECRET` must be at least 32 characters in length in production.
4. **Unsigned Webhooks Blocked**: In production, `POST /api/flexidash/webhooks/app-lifecycle` strictly requires a cryptographically verified `x-wix-instance` or `instanceToken`. Unverified payloads with raw `instanceId` are rejected with `401 Unauthorized`.
5. **JWT Algorithm Enforcement**: Only HMAC-SHA256 (`HS256`) is accepted; `alg: none` and foreign algorithms fail closed with `401 Unauthorized`.

