---
phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
plan: 01
subsystem: auth
tags: [near, phantom-auth, webauthn, passkey, ipfs, pinata, postgres, express, cookie-session]

# Dependency graph
requires:
  - phase: 1.2-passkey-authentication-near-implicit-accounts
    provides: "legacy auth tables (auth_users, passkeys, user_sessions, etc.) that are dropped here"
provides:
  - "@vitalpoint/near-phantom-auth@0.4.2 installed in backend and frontend"
  - "createAnonAuth instance initialized at backend startup with postgres + Pinata IPFS recovery"
  - "auth.router mounted at /api/auth (replaces old ./api/auth.ts router)"
  - "Legacy auth tables dropped via migration-drop-legacy.ts"
  - "CORS updated for cookie-based auth (Authorization header removed)"
  - "DeploymentConfig extracted to deployment-types.ts (preserves platform-settings-store.ts)"
affects:
  - "18-02 through 18-05 — all downstream plans in Phase 18 depend on this bootstrap"

# Tech tracking
tech-stack:
  added:
    - "@vitalpoint/near-phantom-auth@0.4.2 (backend and frontend)"
  patterns:
    - "createAnonAuth factory pattern — returns auth instance with router, requireAuth, initialize()"
    - "auth.initialize() creates anon_users, anon_passkeys, anon_sessions, anon_challenges, anon_recovery tables"
    - "req.anonUser attached by auth.middleware (type: AnonUser with codename, nearAccountId, mpcPublicKey, derivationPath)"
    - "Sessions stored server-side; client receives HttpOnly cookie (no JWT in headers)"
    - "Recovery via Pinata IPFS: createAnonAuth recovery.ipfs config with apiKey + apiSecret"

key-files:
  created:
    - backend/src/auth/deployment-types.ts
    - backend/src/auth/migration-drop-legacy.ts
  modified:
    - backend/src/index.ts
    - backend/src/auth/platform-settings-store.ts

key-decisions:
  - "Use createAnonAuth from @vitalpoint/near-phantom-auth/server (not the bare index export)"
  - "auth.initialize() called AFTER dropLegacyAuthTables() in server startup — ordering critical"
  - "rp.id is 'localhost' in dev, APP_URL hostname in production — dynamic via NODE_ENV"
  - "recovery.wallet disabled (false); IPFS Pinata recovery enabled via PINATA_API_KEY/SECRET"
  - "DeploymentConfig extracted to deployment-types.ts rather than deleted — preserves platform-settings-store.ts for phased removal in Plan 18-05"
  - "Authorization removed from CORS allowedHeaders — package uses HttpOnly cookies, no bearer tokens"

patterns-established:
  - "AnonUser shape: { id, type: 'anonymous', codename, nearAccountId, mpcPublicKey, derivationPath, createdAt, lastActiveAt }"
  - "OAuthUser shape: { id, type: 'standard', email, name, nearAccountId, mpcPublicKey, derivationPath, providers[] }"
  - "auth.requireAuth middleware: 401 if not authenticated; auth.middleware: optional attach"
  - "Legacy auth tables drop pattern: migration-drop-legacy.ts runs once at startup with IF EXISTS"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-03-03
---

# Phase 18 Plan 01: Bootstrap @vitalpoint/near-phantom-auth Summary

**@vitalpoint/near-phantom-auth@0.4.2 installed and bootstrapped — createAnonAuth with Pinata IPFS recovery replaces legacy passkey/session auth router; legacy DB tables dropped at startup.**

## Performance

- **Duration:** ~35 min (including Task 1 checkpoint + Task 2 execution)
- **Started:** 2026-03-03T00:00:00Z
- **Completed:** 2026-03-03T03:30:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 files modified, 2 files created

## Accomplishments

- Installed @vitalpoint/near-phantom-auth@0.4.2 in both backend and frontend via pnpm
- Replaced old `./api/auth.ts` router with `auth.router` from the package (createAnonAuth factory)
- Added auth.initialize() + dropLegacyAuthTables() to server startup sequence
- Extracted DeploymentConfig to deployment-types.ts to preserve platform-settings-store.ts during transition
- Updated CORS: removed Authorization from allowedHeaders (cookie-based auth, credentials: true kept)
- Documented the actual package API surface (AnonUser shape, OAuthUser shape, requireAuth vs middleware)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @vitalpoint/near-phantom-auth@0.4.2** - `57776b8` (chore)
2. **Task 2: Bootstrap backend — DB migration, package init, CORS update** - `5d170c1` (feat)

**Plan metadata:** `[docs commit hash]` (docs: complete plan)

## Files Created/Modified

- `backend/src/index.ts` — Replaced authRouter with createAnonAuth + auth.router; added migration + auth.initialize() calls; removed Authorization from CORS allowedHeaders
- `backend/src/auth/deployment-types.ts` — Created: DeploymentConfig interface extracted from types.ts; preserves platform-settings-store.ts import chain
- `backend/src/auth/migration-drop-legacy.ts` — Created: dropLegacyAuthTables() drops 7 legacy auth tables using IF EXISTS CASCADE
- `backend/src/auth/platform-settings-store.ts` — Updated import from `./types.js` to `./deployment-types.js`
- `backend/package.json` — Added @vitalpoint/near-phantom-auth@0.4.2
- `frontend/package.json` — Added @vitalpoint/near-phantom-auth@0.4.2

## Actual Package API Discovered (for downstream plans 18-02 through 18-05)

### Server-side (from `@vitalpoint/near-phantom-auth/server`)

```typescript
import { createAnonAuth } from '@vitalpoint/near-phantom-auth/server';

const auth = createAnonAuth({
  nearNetwork: 'testnet' | 'mainnet',
  sessionSecret: string,               // SESSION_SECRET env var
  database: {
    type: 'postgres',
    connectionString: string,          // DATABASE_URL env var
  },
  rp: {
    name: string,                      // Relying Party name for WebAuthn
    id: string,                        // Domain hostname (e.g. 'localhost')
    origin: string,                    // Full origin (e.g. 'http://localhost:5173')
  },
  recovery: {
    wallet?: boolean,                  // false = disabled
    ipfs?: {
      pinningService: 'pinata',
      apiKey?: string,                 // PINATA_API_KEY
      apiSecret?: string,              // PINATA_API_SECRET
    },
  },
});

await auth.initialize();              // Creates DB schema (anon_* tables)
app.use('/api/auth', auth.router);    // Passkey auth endpoints
app.use('/api/auth/oauth', auth.oauthRouter);  // Optional OAuth endpoints
app.get('/protected', auth.requireAuth, handler);  // req.anonUser attached
```

### AnonAuthInstance exports

- `auth.router` — Express router for passkey endpoints
- `auth.oauthRouter` — Optional OAuth router
- `auth.middleware` — Optional middleware (attaches user if authenticated, no 401)
- `auth.requireAuth` — Strict middleware (401 if not authenticated)
- `auth.initialize()` — Creates anon_* schema tables
- `auth.db` — DatabaseAdapter
- `auth.sessionManager` — SessionManager
- `auth.passkeyManager` — PasskeyManager
- `auth.mpcManager` — MPCAccountManager
- `auth.ipfsRecovery` — IPFSRecoveryManager (if configured)

### User types on req.anonUser

```typescript
// Anonymous user (passkey-only, HUMINT source)
interface AnonUser {
  id: string;
  type: 'anonymous';
  codename: string;          // Auto-generated (nato-phonetic or animals style)
  nearAccountId: string;     // MPC-created NEAR account
  mpcPublicKey: string;
  derivationPath: string;
  createdAt: Date;
  lastActiveAt: Date;
}

// OAuth user (standard user with email)
interface OAuthUser {
  id: string;
  type: 'standard';
  email: string;
  name?: string;
  nearAccountId: string;
  providers: OAuthProvider[];
  ...
}
```

### DB schema created by auth.initialize()

Tables created: `anon_users`, `oauth_users`, `oauth_providers`, `anon_passkeys`, `anon_sessions`, `anon_challenges`, `anon_recovery`

### Legacy tables dropped by dropLegacyAuthTables()

Tables dropped: `user_sessions`, `passkey_challenges`, `passkeys`, `magic_link_tokens`, `totp_credentials`, `recovery_tokens`, `auth_users`

## Decisions Made

- Used `createAnonAuth` from `/server` entry (not bare index) — server-side only, keeps client bundle clean
- auth.initialize() placed AFTER dropLegacyAuthTables() — prevents FK conflicts during migration
- rp.id dynamically derived from APP_URL hostname in production, hardcoded 'localhost' in dev
- recovery.wallet = false — Phantom wallet recovery disabled initially; IPFS Pinata enabled
- DeploymentConfig extracted to deployment-types.ts (not deleted) — phased migration; types.ts will be deleted in Plan 18-05

## Deviations from Plan

None - plan executed exactly as written. The continuation context provided the actual package API which matched the implementation approach.

## Issues Encountered

- Task 1 required a human-action checkpoint: package `@vitalpoint/near-phantom-auth@0.4.2` was not on public npm. User provided the package via local/private registry. SESSION_SECRET, PINATA_API_KEY, and PINATA_API_SECRET env vars were also provided by user before Task 2 could proceed.

## User Setup Required

The following env vars were added to `backend/.env` before Task 2:
- `SESSION_SECRET` — generated secure random string for cookie signing
- `PINATA_API_KEY` — from Pinata Dashboard API Keys
- `PINATA_API_SECRET` — from Pinata Dashboard API Keys

## Next Phase Readiness

- Backend compiles successfully (`pnpm build` passes in backend/)
- auth.router mounted at /api/auth with all WebAuthn endpoints
- auth.initialize() will create anon_* schema on first server start
- Legacy auth tables will be dropped on first server start (idempotent)
- Plan 18-02 can proceed: Frontend AnonAuthProvider integration
- Plans 18-03 through 18-05 depend on actual req.anonUser shape documented above

---
*Phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth*
*Completed: 2026-03-03*
