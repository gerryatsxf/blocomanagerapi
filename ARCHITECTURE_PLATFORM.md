# Platform-Centric Architecture

> Last updated: April 2026

## Core Principle

**The platform is not a tenant.** BlocoManager is the engine that spawns, configures, and manages tenant instances. It was previously modeled as just another tenant (`blocomanager`) in the same config maps — this led to ambiguity in auth flows, role checks, and domain resolution. That model has been replaced.

```
┌─────────────────────────────────────────────────┐
│                   PLATFORM                      │
│          (PLATFORM_ID = 'blocomanager')          │
│                                                 │
│  Roles: platformOwner · platformManager         │
│  Domains: admin.blocomanager.com                │
│           blocomanager.com                      │
│           api.blocomanager.com                  │
│                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────┐  │
│  │ Tenant A    │ │ Tenant B    │ │ Tenant …  │  │
│  │ aprendecoding│ │ pedrorivero │ │ (dynamic) │  │
│  │ Shared      │ │ Shared      │ │           │  │
│  └─────────────┘ └─────────────┘ └──────────┘  │
└─────────────────────────────────────────────────┘
```

## Identity Model

| Concept | ID / Value | Where it lives |
|---|---|---|
| Platform | `PLATFORM_ID` (`'blocomanager'`) | `src/common/platform.constants.ts` |
| Platform Owner | `UserRole.PLATFORM_OWNER` (`'platformOwner'`) | `user.entity.ts` — max 3 accounts |
| Platform Manager | `UserRole.PLATFORM_MANAGER` (`'platformManager'`) | `user.entity.ts` — delegated ops |
| Tenant | any other `tenantId` string | `TENANT_CONFIGS` / MongoDB `tenants` collection |
| Tenant Admin | `UserRole.TENANT_ADMIN` (`'tenantAdmin'`) | `user.entity.ts` — per-tenant |

Platform users have **no `tenant` field** on their User record. Their authority comes from their role, not from tenant membership.

## Domain Resolution

Request → extract `Origin` hostname → resolve identity:

1. **Is it a platform domain?** (`isPlatformDomain()` in `platform.config.ts`)
   → return `PLATFORM_ID`
2. **Is it in `TENANT_DOMAIN_MAPPING`?**
   → return mapped `tenantId`
3. **Fallback** (unknown domain, no origin)
   → return `PLATFORM_ID`

This happens identically in both the `@Tenant()` decorator and `TenantService.extractTenantFromRequest()`.

## Guards

| Guard | Allows | Typical use |
|---|---|---|
| `PlatformOwnerGuard` | `platformOwner` only | Destructive admin ops: grant roles, purge tenants |
| `PlatformGuard` | `platformOwner` + `platformManager` | Day-to-day admin panel: view tenants, manage subscriptions |
| `AdminOrTenantAdminGuard` | any platform role + `tenantAdmin` | Endpoints shared between admin panel and tenant panels |
| `TenantGuard` | any valid tenant (or platform) | Tenant-scoped public/visitor endpoints |

## Google OAuth — Two Paths

The `handleCallback()` in `google-oauth.service.ts` branches on `requestedTenant`:

```
requestedTenant === PLATFORM_ID?
  ├── YES → verify user exists + isPlatformRole()
  │         store tokens under PLATFORM_ID
  │         redirect to admin panel
  │
  └── NO  → standard tenant flow
            find user → filter by user.tenant
            store tokens under actualTenant
            redirect to tenant panel
```

This fixes the previous bug where platform owners had `tenant: null` and the tenant-lookup produced an empty array → "not associated with any tenant."

## Infrastructure Types

Each tenant has an `infrastructureType` field:

| Internal value | User-facing label | Behavior |
|---|---|---|
| `'shared'` (default) | Shared Server | Runs on shared platform droplet. Traffic blocked at Caddy when subscription lapses. |
| `'dedicated'` | Dedicated Server | Own droplet. Full orchestration shutdown when off. **Currently placeholder — UI shown as disabled.** |

## Tenant Resources

Each tenant also has a `resources` object:

```json
{
  "adminPanel": { "enabled": true },
  "visitorSite": { "enabled": true },
  "dedicatedServer": { "enabled": false }
}
```

These represent toggleable platform-managed resources. The `dedicatedServer` resource is disabled and shown as "Coming Soon" in the UI.

## File Map

```
src/common/
  platform.constants.ts        # PLATFORM_ID, isPlatformId(), isPlatformRole()

src/tenant/config/
  platform.config.ts           # PLATFORM_DOMAINS, PLATFORM_CONFIG, isPlatformDomain()
  tenant.config.ts             # TENANT_CONFIGS, TENANT_DOMAIN_MAPPING (no 'blocomanager')
  tenant-email.config.ts       # Email provider config (platform entry keyed by PLATFORM_ID value)

src/admin/guards/
  platform-owner.guard.ts      # platformOwner only
  platform.guard.ts            # platformOwner + platformManager

src/admin/entities/
  platform-owner-grant.entity.ts  # 6-digit grant code for promoting users

src/admin/dto/
  platform-owner-grant.dto.ts

src/tenant/schemas/
  tenant.schema.ts             # +infrastructureType, +resources fields

scripts/
  migrate-platform-roles.js    # One-time: superAdmin → platformOwner in DB
  set-platform-owner.js        # Utility: promote a user to platformOwner
```

## Migration Checklist

Before deploying this version:

1. **Run DB migration** — converts existing `superAdmin` users to `platformOwner`:
   ```bash
   node scripts/migrate-platform-roles.js
   # For production: NODE_ENV=production node scripts/migrate-platform-roles.js
   ```

2. **Rebuild & deploy API** — the renamed guards, entities, and endpoints are breaking changes.

3. **Rebuild & deploy tenant frontend** — the Tenants.tsx Infrastructure card requires the new schema fields.

4. The old `set-super-admin.js` script still works but is superseded by `set-platform-owner.js`.
