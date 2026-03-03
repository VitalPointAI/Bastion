# Phase 18: Replace Current Login with @vitalpoint/near-phantom-auth - Research

**Researched:** 2026-03-03
**Domain:** Authentication system replacement — passkey WebAuthn + HttpOnly cookie sessions + IPFS/password recovery
**Confidence:** MEDIUM (package does not exist yet; API surface inferred from CONTEXT.md decisions and current codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Identity model**
- Email is **required** at registration (not anonymous/codename-based)
- Admin setting to restrict registration to a specific email domain (securely checked server-side) — open registration (any domain) is default
- User chooses their own display name; defaults to email if not chosen
- **No codenames** — skip the package's codename feature
- DID continues to be derived from NEAR accountId (existing pattern preserved)

**Session mechanism**
- Adopt **HttpOnly cookie sessions** (package default) — replace Bearer tokens in localStorage
- All frontend fetch calls updated to use `credentials: 'include'` instead of `Authorization` headers
- CORS configuration updated for cookie-based auth (credentials, sameSite, secure)

**Auth middleware**
- Use the package's built-in `requireAuth` middleware for **all** protected backend routes
- `req.anonUser` provides authenticated user context
- Replace all existing `Authorization: Bearer` header checking throughout backend routes

**Route mounting**
- Mount package router at `/api/auth` (same path as current)
- Package provides: `/register/start`, `/register/finish`, `/login/start`, `/login/finish`, `/logout`, `/session`, `/recovery/*`
- Old route structure (`/passkey/*`, `/magic-link/*`, `/totp/*`) is fully replaced

**Database**
- Drop all old auth tables (users, passkeys, sessions, challenges, magic_link_tokens, totp_secrets, etc.)
- Package's `auth.initialize()` creates its own PostgreSQL schema
- Clean slate — no data migration

**Features dropped**
- **Magic link login** — removed entirely (passkey-only authentication)
- **TOTP 2FA** — removed (passkeys are phishing-resistant by design)
- **Email-based recovery** — replaced by password+IPFS recovery
- **PRF extension handling** — package handles WebAuthn internally
- **MigrationFlow component** — removed (no legacy users after clean break)

**Recovery**
- **Password + IPFS only** (no wallet recovery — users won't have NEAR wallets)
- IPFS pinning provider: **Pinata** (PINATA_API_KEY + PINATA_API_SECRET env vars)
- Users set a strong password + receive an IPFS CID for recovery

**NEAR account funding**
- **Keep existing funding-service.ts** — package creates MPC accounts, existing service handles NEAR transfers
- Package's built-in treasury funding is NOT used
- Existing mpc-account.ts preserved for funding logic

**Migration strategy**
- **Clean break** — all users re-register
- Delete all old auth code completely (~15 backend files, ~8 frontend components)
- No archive branch — git history is sufficient
- No parallel auth period

### Claude's Discretion

None — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 18 replaces the entire custom passkey/magic-link/TOTP authentication system with `@vitalpoint/near-phantom-auth@0.4.2`. This is a **high-impact, surgical replacement** of ~23 files across backend and frontend, touching every layer of the application.

**Critical finding:** `@vitalpoint/near-phantom-auth` is an **internal/private package** that does not exist on npm or anywhere on this machine as of 2026-03-03. It appears to be a package under development by VitalPoint.ai (the same organization). The CONTEXT.md describes its intended API surface in detail — `auth.initialize()`, `auth.router`, `requireAuth` middleware, `AnonAuthProvider`, and `useAnonAuth()` hook — but none of this can be verified against actual package source or documentation. **The package must be built and available (npm install or local tarball) before this phase begins.** This is a hard blocker.

The migration breaks into three orthogonal tracks: (1) backend — swap `backend/src/api/auth.ts` for the package router, update `index.ts`, add `requireAuth` middleware to protected routes, drop old DB tables; (2) frontend — replace `AuthWrapper`/`AuthProvider`/`useAuth` with package equivalents, replace `LoginPage`/`RegisterPage` with package-provided or new UI, update all fetch calls to `credentials: 'include'`; (3) integration — wire the package's user-registration hook to call `funding-service.ts` for NEAR account creation, preserve `UserContext` population, add admin domain restriction to registration flow.

**Primary recommendation:** Before writing a single line of code, confirm the package is installable and read its actual README/API docs. The entire plan depends on the package's real interface, not the projected interface in CONTEXT.md.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vitalpoint/near-phantom-auth` | 0.4.2 | Full auth system (server + client) | This IS the phase |
| `express` | ^5.2.1 (existing) | HTTP server | Already in use |
| `pg` | ^8.16.3 (existing) | PostgreSQL client | Already in use |
| `react` | ^19.2.0 (existing) | Frontend framework | Already in use |
| `react-router-dom` | ^7.0.0 (existing) | Frontend routing | Already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cookie-parser` | TBD | Parse `req.cookies` if package requires it | Only if package doesn't self-manage cookies |
| `pinata` | ^2.5.2 (already in frontend) | IPFS pinning for recovery | Recovery flow — backend uses PINATA_JWT |
| `@simplewebauthn/browser` | ^13.2.2 (existing) | WebAuthn browser API | Only if package re-exposes underlying @simplewebauthn; otherwise package handles it |

**Note:** `@simplewebauthn/server` (^13.2.2) and `@simplewebauthn/browser` (^13.2.2) are already in the project. If the package bundles its own WebAuthn handling, these may become redundant — do not remove them until package behavior is confirmed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@vitalpoint/near-phantom-auth` | Keep custom auth | Not an option — locked decision |
| Pinata IPFS for recovery | NFT.storage, web3.storage | Pinata already configured; PINATA_JWT in .env |

**Installation (projected — verify with actual package docs):**
```bash
# Backend
cd backend && pnpm add @vitalpoint/near-phantom-auth@0.4.2

# Frontend
cd frontend && pnpm add @vitalpoint/near-phantom-auth@0.4.2
```

---

## Architecture Patterns

### Current Architecture (to be removed)

```
backend/src/auth/
├── funding-service.ts       KEEP
├── magic-link-service.ts    DELETE
├── magic-link-store.ts      DELETE
├── migration-service.ts     DELETE
├── mpc-account.ts           KEEP
├── passkey-service.ts       DELETE
├── passkey-store.ts         DELETE
├── platform-settings-store.ts  KEEP (email domain restriction)
├── prf-did-integration.ts   DELETE
├── recovery-service.ts      DELETE
├── session-store.ts         DELETE
├── totp-service.ts          DELETE
├── totp-store.ts            DELETE
├── types.ts                 DELETE (package provides its own types)
└── user-store.ts            DELETE

backend/src/api/auth.ts      DELETE (replaced by package router)

frontend/src/components/
├── LoginPage.tsx + .css     DELETE
├── RegisterPage.tsx + .css  DELETE
├── LoginButton.tsx + .css   DELETE
├── PasskeySetup.tsx + .css  DELETE
├── MagicLinkVerify.tsx + .css  DELETE
└── MigrationFlow.tsx + .css DELETE

frontend/src/lib/
├── auth-service.ts          DELETE
└── passkey.ts               DELETE
```

### Target Architecture

```
backend/src/
├── index.ts                 MODIFY: swap authRouter for auth.router
├── auth/
│   ├── funding-service.ts   KEEP (called in registration hook)
│   └── mpc-account.ts       KEEP (MPC account derivation)
└── (all other auth files deleted)

frontend/src/
├── App.tsx                  MODIFY: replace route structure
├── components/
│   ├── AuthWrapper.tsx       MODIFY: use useAnonAuth() + remove MigrationFlow
│   ├── LoginPage.tsx         REPLACE: new package-based UI (or use package component)
│   └── RegisterPage.tsx      REPLACE: new package-based UI (or use package component)
└── hooks/
    └── useAuth.tsx           REPLACE: re-export useAnonAuth or wrapper
```

### Pattern 1: Backend Package Initialization (projected API)

**What:** Package initializes its own DB tables and exports an Express router
**When to use:** In `backend/src/index.ts` startup

```typescript
// Source: CONTEXT.md decisions (LOW confidence — unverified against actual package)
// backend/src/index.ts
import { auth } from '@vitalpoint/near-phantom-auth';

// Initialize DB schema and dependencies
await auth.initialize({
  database: process.env.DATABASE_URL,
  // ... other config
});

// Mount router (replaces custom authRouter)
app.use('/api/auth', auth.router);
```

**Key question:** What configuration object does `auth.initialize()` accept? What keys are required? This is unknown until package is available.

### Pattern 2: Backend `requireAuth` Middleware (projected API)

**What:** Package middleware that validates HttpOnly cookie session and populates `req.anonUser`
**When to use:** On all protected routes, replacing manual Bearer token extraction

```typescript
// Source: CONTEXT.md decisions (LOW confidence — unverified)
import { requireAuth } from '@vitalpoint/near-phantom-auth';

// Instead of manual getUserDID() functions in each route file:
router.get('/some-protected-route', requireAuth, (req, res) => {
  const { accountId, email } = req.anonUser;
  // ...
});
```

**Current pattern being replaced (HIGH confidence — verified in codebase):**
Every backend API file (strategic.ts, strategic-agents.ts, strategic-tools.ts, missions.ts, admin.ts) contains a local `getUserDID()` function that reads `Authorization: Bearer <token>` header. These ~25 usages must all be replaced with `requireAuth` middleware.

### Pattern 3: Frontend Provider Swap (projected API)

**What:** Replace `AuthProvider` (custom) with `AnonAuthProvider` (package) in AuthWrapper
**When to use:** AuthWrapper wraps all protected routes

```typescript
// Source: CONTEXT.md decisions (LOW confidence — unverified)
import { AnonAuthProvider, useAnonAuth } from '@vitalpoint/near-phantom-auth';

// Current AuthWrapper exports:
export function AuthWrapper({ children }) {
  return (
    <AuthProvider>      {/* DELETE: custom AuthProvider */}
      <AuthContent>{children}</AuthContent>
    </AuthProvider>
  );
}

// Target AuthWrapper:
export function AuthWrapper({ children }) {
  return (
    <AnonAuthProvider config={...}>  {/* PACKAGE: AnonAuthProvider */}
      <AuthContent>{children}</AuthContent>
    </AnonAuthProvider>
  );
}
```

### Pattern 4: Frontend Hook Migration (projected API)

**What:** Replace `useAuth()` with `useAnonAuth()` in AuthWrapper
**When to use:** AuthContent component

```typescript
// Source: CONTEXT.md decisions (LOW confidence — unverified)
// OLD:
const { isLoading, isAuthenticated, accountId, email, prfAvailable } = useAuth();

// NEW (projected):
const { isLoading, isAuthenticated, accountId, email } = useAnonAuth();
// Note: prfAvailable likely not exposed by package (passkeys handle PRF internally)
```

**Key question:** What fields does `useAnonAuth()` return? Does it include `accountId`, `email`, `displayName`? This affects UserContext population which is consumed by ~10 components.

### Pattern 5: Fetch Calls to `credentials: 'include'` (HIGH confidence)

**What:** All fetch calls must include credentials for HttpOnly cookie auth
**When to use:** Every frontend service that calls backend

```typescript
// Source: verified in current codebase — strategic-service.ts, admin-service.ts, etc.
// All service classes have a private fetch() method sending Authorization header
// This changes to credentials: 'include'

// BEFORE (every service's fetch method):
const headers = {};
if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
const response = await fetch(url, { ...options, headers });

// AFTER:
const response = await fetch(url, {
  ...options,
  credentials: 'include',  // Cookie sent automatically
  headers: { 'Content-Type': 'application/json' }
});
```

**Impact:** 5 service files affected:
- `frontend/src/lib/admin-service.ts` — `setAuthToken()` + all fetch calls
- `frontend/src/lib/governance-service.ts` — `setAuthToken()` + all fetch calls (4 WebSocket calls too)
- `frontend/src/lib/command-service.ts` — `setAuthToken()` + fetch calls
- `frontend/src/lib/resource-service.ts` — `setAuthToken()` + fetch calls
- `frontend/src/lib/strategic-service.ts` — `setAuthToken()` + fetch calls (includes FormData uploads)

Also: `frontend/src/components/AuthWrapper.tsx` calls `/api/identity/register` and `/api/auth/migration-status` — both need `credentials: 'include'`.

### Pattern 6: CORS Update for Cookie Auth (HIGH confidence)

**What:** HttpOnly cookies require specific CORS settings
**When to use:** `backend/src/index.ts` CORS configuration

```typescript
// Source: verified in backend/src/index.ts — already has credentials: true
// Additional changes needed for SameSite and Secure in production

app.use(cors({
  origin: allowedOrigins,
  credentials: true,          // Already set — keep
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-DID', 'Accept'],
  // Remove 'Authorization' from allowedHeaders (no longer needed)
}));
```

**Also required:** Cookie settings in production: `sameSite: 'strict'`, `secure: true` (HTTPS). In development: `sameSite: 'lax'`, `secure: false`.

### Pattern 7: NEAR Funding Hook Integration

**What:** After package creates user and NEAR account via MPC, call existing `funding-service.ts`
**When to use:** Package's post-registration hook (exact API unknown)

```typescript
// Source: LOW confidence — depends on package's hook mechanism
// Current pattern (in passkey-service.ts lines 202-213):
const fundingService = getFundingService();
if (fundingService.isEnabled()) {
  const fundingResult = await fundingService.fundAccount(accountId);
  if (!fundingResult.success) {
    throw new Error('Network busy, try again in a few minutes');
  }
}
```

**Key question:** How does the package expose a post-registration hook? Does `auth.initialize()` accept an `onRegistration` callback? Or does the package expose an event system? This is the most critical unknown for preserving NEAR account funding.

### Pattern 8: Admin Domain Restriction Integration

**What:** Email domain validation at registration must use existing `platform-settings-store.ts`
**When to use:** Package's email validation hook (exact API unknown)

```typescript
// Source: verified in platform-settings-store.ts lines 340-360
// Existing validateEmailDomain() method checks allowed domains from DB
import { getPlatformSettingsStore } from './auth/platform-settings-store.js';

// Integration point: package registration hook checks domain
const settingsStore = getPlatformSettingsStore();
const allowed = await settingsStore.validateEmailDomain(email);
if (!allowed) throw new Error('Email domain not allowed');
```

**Note:** `platform-settings-store.ts` should be KEPT (not deleted). It currently has its own PostgreSQL table (`platform_settings`) independent of old auth tables.

### Pattern 9: UserContext Population after Auth

**What:** `UserContext` must be populated from package's auth state, not custom auth
**When to use:** `AuthWrapper.tsx` after successful authentication

```typescript
// Source: verified in AuthWrapper.tsx — UserContextType fields
// Current: accountId from useAuth() → buildDID() → identity API → setUserDID
// Target: accountId from useAnonAuth() → same DID derivation flow preserved

const userContextValue = {
  userDID,           // Still derived via buildDID(accountId) from identity.ts
  accountId,         // From useAnonAuth() — field name to confirm
  email,             // From useAnonAuth() — field name to confirm
  mpcRegistered: true,
  isAuthenticated,   // From useAnonAuth()
};
```

### Anti-Patterns to Avoid

- **Do NOT call `setAuthToken()` on service classes after migration** — these methods become dead code; remove them entirely to avoid confusion.
- **Do NOT add X-DID header for auth** — the package handles session-based auth; DID lookup should be done by routes using `req.anonUser.accountId` → `buildDID()`.
- **Do NOT use `localStorage` for any session data** — package uses HttpOnly cookies; no client-side storage.
- **Do NOT leave old `auth_users`, `user_sessions`, `passkeys`, `challenges` tables** — clean break means dropping them all via SQL migration.
- **Do NOT skip the CORS `credentials: true` check** — cookies require both `credentials: 'include'` on client AND `credentials: true` on CORS config.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebAuthn registration/auth flow | Custom WebAuthn challenge/response | Package's `/register/start`, `/register/finish`, `/login/start`, `/login/finish` | WebAuthn ceremony has ~20 edge cases |
| HttpOnly cookie session management | Custom `Set-Cookie` headers | Package's built-in session handling | SameSite, Secure, expiry, rotation — all complex |
| Passkey credential storage | Custom `passkeys` table | Package's `auth.initialize()` schema | Package manages its own credential format |
| Password + IPFS recovery | Custom recovery flow | Package's `/recovery/*` endpoints | Multi-step recovery state is complex |

**Key insight:** The package is being adopted specifically to avoid owning this complexity. Trust it fully for the WebAuthn ceremony, session lifecycle, and recovery flow.

---

## Common Pitfalls

### Pitfall 1: Package Not Available at Implementation Time
**What goes wrong:** Planning proceeds assuming package is installable, but `pnpm add @vitalpoint/near-phantom-auth@0.4.2` fails because the package doesn't exist on npm.
**Why it happens:** Package is private/internal; npm shows "Not found" as of 2026-03-03.
**How to avoid:** Wave 0 plan must verify the package is available before any other plan executes. Either publish to npm, use a local tarball, or link via `file:` protocol.
**Warning signs:** `npm info @vitalpoint/near-phantom-auth` returns 404.

### Pitfall 2: `req.anonUser` Field Name Mismatch
**What goes wrong:** Backend routes expect `req.anonUser.accountId` but package populates `req.anonUser.nearAccountId` (or vice versa).
**Why it happens:** The CONTEXT.md describes `req.anonUser` but doesn't specify exact field names.
**How to avoid:** Read actual package TypeScript types on first install before writing route middleware replacements.
**Warning signs:** TypeScript errors on `req.anonUser.accountId` — means field is named differently.

### Pitfall 3: Missing `cookie-parser` Middleware
**What goes wrong:** Package sets HttpOnly cookies but `req.cookies` is undefined because `cookie-parser` isn't installed.
**Why it happens:** Express doesn't parse cookies by default; `cookie-parser` is a separate package.
**How to avoid:** Check if package bundles cookie parsing internally (many auth packages do). If not, `pnpm add cookie-parser @types/cookie-parser` in backend.
**Warning signs:** `req.cookies` is `{}` or undefined despite correct Set-Cookie header.

### Pitfall 4: `credentials: 'include'` on WebSocket Connections
**What goes wrong:** WebSocket connections for messaging and orchestration don't send auth cookies.
**Why it happens:** `credentials: 'include'` only applies to `fetch()`. WebSocket uses `new WebSocket(url)`.
**How to avoid:** Check if WebSocket connections need authentication. Current `setupMessageWebSocket` and `setupOrchestrationWebSocket` — verify whether they check session/auth. If yes, they may need a different auth approach (e.g., query param token on WS handshake).
**Warning signs:** WebSocket connections work for unauthenticated users but fail for protected operations.

### Pitfall 5: NEAR Funding Hook API Unknown
**What goes wrong:** Package creates user account but doesn't expose a hook to trigger `funding-service.ts`. Accounts get created but never funded on-chain.
**Why it happens:** The package's registration completion hook API is unknown.
**How to avoid:** Read package source/docs immediately on install. If no hook: wrap `auth.router` middleware to intercept `/register/finish` response and trigger funding.
**Warning signs:** Users can register and log in but their NEAR accountId doesn't appear funded on testnet.

### Pitfall 6: Old DB Tables Still Exist After Migration
**What goes wrong:** `auth.initialize()` creates new tables, but old tables (`auth_users`, `user_sessions`, `passkeys`, `challenges`, etc.) remain. Foreign key conflicts or name collisions if package reuses any table names.
**Why it happens:** DROP TABLE not executed or missed.
**How to avoid:** Write an explicit SQL migration script in Wave 0 that drops all legacy auth tables BEFORE calling `auth.initialize()`.
**Warning signs:** `auth.initialize()` throws duplicate table errors, or old table names conflict.

### Pitfall 7: Admin `requireSystemAdmin` Relies on Bearer Token
**What goes wrong:** `backend/src/api/admin.ts` extracts DID from `Authorization: Bearer` header in `getUserDID()`. After migration, no Bearer header is sent — admin access breaks.
**Why it happens:** Admin auth check is independent of session-based auth; uses DID directly.
**How to avoid:** After adding `requireAuth` to admin routes, derive DID from `req.anonUser.accountId` via `buildDID()` rather than from Bearer header.
**Warning signs:** Admin dashboard shows "Authentication required" for all requests.

### Pitfall 8: `@privy-io/react-auth` and `@privy-io/server-auth` Still in `package.json`
**What goes wrong:** Legacy Privy packages remain installed but unused. No functional impact, but clean-up is expected.
**Why it happens:** These were never removed after the Phase 1.2 migration.
**How to avoid:** Remove both during this phase's cleanup wave. Check nothing still imports from them.
**Warning signs:** `grep -r "@privy-io"` in frontend src returns results.

### Pitfall 9: Governance Service WebSocket Auth
**What goes wrong:** `governance-service.ts` has 4 WebSocket calls with `Authorization: Bearer` header. WebSockets don't support cookie-based auth the same way.
**Why it happens:** WebSocket upgrade requests don't reliably send cookies in all browsers/environments.
**How to avoid:** Check if these WebSocket calls need auth at all. If so, implement initial HTTP auth handshake to get a short-lived WS token, or confirm CORS setup allows cookie forwarding for WS upgrades.
**Warning signs:** DAO governance features break after migration.

---

## Code Examples

### Example 1: Verified — Current Bearer Token Pattern (to be removed)

```typescript
// Source: verified in backend/src/api/missions.ts, strategic.ts, admin.ts, etc.
// This exact pattern appears ~25 times across 5 backend API files

function getUserDID(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const xDid = req.headers['x-did'];
  if (typeof xDid === 'string') return xDid.trim();
  return null;
}

// Usage:
router.post('/some-route', async (req, res) => {
  const userDID = getUserDID(req);
  if (!userDID) return res.status(401).json({ error: 'Authentication required' });
  // ...
});
```

### Example 2: Verified — Frontend Fetch Pattern (to be replaced)

```typescript
// Source: verified in frontend/src/lib/strategic-service.ts, admin-service.ts, etc.
// This pattern appears in all 5 service files

private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (this.token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
  }
  if (this.userDID) {
    (headers as Record<string, string>)['X-DID'] = this.userDID;
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  // ...
}
```

**After migration:**
```typescript
private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  // No Authorization header — cookie is sent automatically
  // DID still sent via X-DID if needed by route
  if (this.userDID) {
    (headers as Record<string, string>)['X-DID'] = this.userDID;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',  // Cookie-based auth
    headers
  });
  // ...
}
```

### Example 3: Verified — Funding Service Integration Point

```typescript
// Source: verified in backend/src/auth/passkey-service.ts lines 196-214
// This pattern must be preserved in the new package integration

import { getFundingService } from './funding-service.js';
import { createMPCAccount } from './mpc-account.js';

// Called after package creates user record, before registration completes:
const { accountId, derivationPath } = await createMPCAccount(userId);
const fundingService = getFundingService();
if (fundingService.isEnabled()) {
  const fundingResult = await fundingService.fundAccount(accountId);
  if (!fundingResult.success) {
    throw new Error('Network busy, try again in a few minutes');
  }
}
```

### Example 4: Verified — CORS Configuration (already correct base)

```typescript
// Source: verified in backend/src/index.ts lines 44-77
// Already has credentials: true — just needs Authorization header removed from allowedHeaders

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) callback(null, origin);
    else if (process.env.NODE_ENV === 'development' &&
             (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))
      callback(null, origin);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,                                    // Keep — required for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-DID', 'Accept'], // Remove 'Authorization'
}));
```

### Example 5: Verified — UserContext Population Pattern

```typescript
// Source: verified in frontend/src/components/AuthWrapper.tsx lines 134-141
// This structure must be preserved — 10+ components depend on useUser()

const userContextValue = {
  userDID,        // Derived via buildDID(accountId) + hasUserDID API check
  accountId,      // From useAnonAuth() — verify field name
  email,          // From useAnonAuth() — verify field name
  mpcRegistered: true,
  isAuthenticated,
};
```

### Example 6: Verified — DB Tables to Drop

```sql
-- Source: verified in backend/src/auth/*.ts table definitions
-- These tables are created by old auth code and must be dropped

DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS passkey_challenges CASCADE;
DROP TABLE IF EXISTS passkeys CASCADE;
DROP TABLE IF EXISTS magic_link_tokens CASCADE;
DROP TABLE IF EXISTS totp_credentials CASCADE;
DROP TABLE IF EXISTS recovery_tokens CASCADE;
DROP TABLE IF EXISTS auth_users CASCADE;

-- Keep:
-- platform_settings (email domain restriction, admin-configurable)
-- All other tables (missions, documents, agents, etc.)
```

---

## Scope Inventory — All Touch Points

### Backend Files to DELETE (13 files)

| File | Reason |
|------|--------|
| `backend/src/api/auth.ts` | Replaced by package router |
| `backend/src/auth/magic-link-service.ts` | Feature dropped |
| `backend/src/auth/magic-link-store.ts` | Feature dropped |
| `backend/src/auth/migration-service.ts` | No migration needed |
| `backend/src/auth/passkey-service.ts` | Package handles passkeys |
| `backend/src/auth/passkey-store.ts` | Package manages credentials |
| `backend/src/auth/prf-did-integration.ts` | Package handles PRF internally |
| `backend/src/auth/recovery-service.ts` | Replaced by package recovery |
| `backend/src/auth/session-store.ts` | Package manages sessions |
| `backend/src/auth/totp-service.ts` | Feature dropped |
| `backend/src/auth/totp-store.ts` | Feature dropped |
| `backend/src/auth/types.ts` | Package provides types |
| `backend/src/auth/user-store.ts` | Package manages users |

### Backend Files to KEEP

| File | Reason |
|------|--------|
| `backend/src/auth/funding-service.ts` | NEAR account funding post-registration |
| `backend/src/auth/mpc-account.ts` | MPC account derivation |
| `backend/src/auth/platform-settings-store.ts` | Email domain restriction + admin settings |

### Backend Files to MODIFY

| File | What Changes |
|------|-------------|
| `backend/src/index.ts` | Replace `authRouter` import/mount with `auth.router`; add `auth.initialize()` call |
| `backend/src/api/admin.ts` | Replace `getUserDID()` / Bearer header logic with `requireAuth` + `req.anonUser` |
| `backend/src/api/strategic.ts` | Replace `getUserDID()` with `requireAuth` middleware |
| `backend/src/api/strategic-agents.ts` | Replace `getUserDID()` with `requireAuth` middleware |
| `backend/src/api/strategic-tools.ts` | Replace `getUserDID()` with `requireAuth` middleware |
| `backend/src/api/missions.ts` | Replace `getUserDID()` with `requireAuth` middleware |

### Frontend Files to DELETE (10 files + 8 CSS)

| File | Reason |
|------|--------|
| `frontend/src/components/LoginPage.tsx + .css` | Replaced by package UI |
| `frontend/src/components/RegisterPage.tsx + .css` | Replaced by package UI |
| `frontend/src/components/LoginButton.tsx + .css` | Replaced by package UI |
| `frontend/src/components/PasskeySetup.tsx + .css` | Package handles setup |
| `frontend/src/components/MagicLinkVerify.tsx + .css` | Feature dropped |
| `frontend/src/components/MigrationFlow.tsx + .css` | No migration needed |
| `frontend/src/lib/auth-service.ts` | Package manages auth API |
| `frontend/src/lib/passkey.ts` | Package handles WebAuthn |

### Frontend Files to MODIFY

| File | What Changes |
|------|-------------|
| `frontend/src/App.tsx` | Remove LoginPage/RegisterPage/MagicLinkVerify routes; replace with package-provided login/register routes |
| `frontend/src/components/AuthWrapper.tsx` | Replace `AuthProvider`/`useAuth` with `AnonAuthProvider`/`useAnonAuth`; remove MigrationFlow; remove `prfAvailable` usage |
| `frontend/src/hooks/useAuth.tsx` | Replace with re-export of `useAnonAuth` from package (or delete entirely) |
| `frontend/src/lib/admin-service.ts` | Remove `setAuthToken()`, change `fetch()` to `credentials: 'include'` |
| `frontend/src/lib/governance-service.ts` | Remove `setAuthToken()`, change all fetches to `credentials: 'include'` (4 WebSocket calls need special handling) |
| `frontend/src/lib/command-service.ts` | Remove `setAuthToken()`, change `fetch()` to `credentials: 'include'` |
| `frontend/src/lib/resource-service.ts` | Remove `setAuthToken()`, change `fetch()` to `credentials: 'include'` |
| `frontend/src/lib/strategic-service.ts` | Remove `setAuthToken()`, change `fetch()` + `fetchFormData()` to `credentials: 'include'` |

### Frontend Files to KEEP (unchanged)

| File | Reason |
|------|--------|
| `frontend/src/context/UserContext.tsx` | Preserved — `useUser()` hook used by 10+ components |
| `frontend/src/lib/identity.ts` | Preserved — `buildDID()`, `hasUserDID()`, `emitEntityRegistered()` |
| All other frontend files | No auth dependency |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Bearer token in localStorage | HttpOnly cookie session | Eliminates XSS token theft vector |
| Custom `auth_users` table | Package-managed schema | Removes 13 files of auth maintenance |
| Manual passkey challenge flow | Package ceremony handling | Eliminates WebAuthn edge cases |
| Email + TOTP recovery | Password + IPFS recovery | Simpler UX; cryptographically stronger |
| `prfAvailable` flag in session | Package handles PRF internally | Simplifies auth state |

---

## Open Questions

1. **Is the package available to install?**
   - What we know: Not on public npm as of 2026-03-03; not present anywhere on this machine
   - What's unclear: When will it be published? Will it be a local tarball, npm scoped package, or `file:` protocol link?
   - Recommendation: **Wave 0 must install the package and read its actual API docs before any other plan can proceed.** This is a hard dependency.

2. **What does `auth.initialize()` accept?**
   - What we know: CONTEXT.md says the package initializes its own PostgreSQL schema
   - What's unclear: Required config keys — DATABASE_URL? Session secret? NEAR network config? WebAuthn rpId/rpName? Pinata credentials?
   - Recommendation: Read package README/source on install; map all required config to existing env vars.

3. **How does `useAnonAuth()` map to `UserContext` fields?**
   - What we know: CONTEXT.md says `req.anonUser` on backend; assumes `useAnonAuth()` on frontend
   - What's unclear: Does `useAnonAuth()` return `accountId`? `nearAccountId`? `email`? `displayName`?
   - Recommendation: Check package TypeScript types immediately on install.

4. **How to hook NEAR account funding into package registration?**
   - What we know: Existing `funding-service.ts.fundAccount()` must be called post-registration
   - What's unclear: Does the package support an `onRegistration` callback? Or must we wrap the `/register/finish` route?
   - Recommendation: If no callback, add Express middleware that intercepts POST `/api/auth/register/finish` response and triggers funding.

5. **What routes does the package provide — exactly?**
   - What we know: CONTEXT.md lists `/register/start`, `/register/finish`, `/login/start`, `/login/finish`, `/logout`, `/session`, `/recovery/*`
   - What's unclear: Are these nested under the mount point? Are there any additional routes? Are UI components bundled?
   - Recommendation: `console.log(auth.router.stack)` after install to enumerate all routes.

6. **Does the admin domain restriction integrate via package hook or must it wrap routes?**
   - What we know: `platform-settings-store.ts.validateEmailDomain()` exists and works
   - What's unclear: Package's extensibility API for registration validation
   - Recommendation: If no hook, add middleware before `auth.router` that pre-validates email domain.

7. **WebSocket auth after cookie migration?**
   - What we know: `governance-service.ts` has 4 WebSocket calls with Bearer auth header
   - What's unclear: Whether these WebSocket endpoints (`/api/dao` routes) actually require auth; whether cookies work for WS upgrades
   - Recommendation: Audit these endpoints; if auth-required, implement WS handshake token pattern.

8. **Does the package require `cookie-parser` or does it self-manage cookies?**
   - What we know: Not in current `backend/package.json`
   - What's unclear: Whether `cookie-parser` needs to be added
   - Recommendation: Check package peerDependencies/readme immediately on install.

9. **What DB env var does the package expect?**
   - What we know: Backend uses `DATABASE_URL=postgresql:///coalition_ops`
   - What's unclear: Does package use `DATABASE_URL` (standard) or a custom key?
   - Recommendation: Check package config schema; likely `DATABASE_URL` is standard.

---

## Validation Architecture

> Nyquist validation is not configured in `.planning/config.json` (no `workflow.nyquist_validation` key). **Skipping this section.**

---

## Sources

### Primary (HIGH confidence)
- Verified directly from codebase — all file analysis above is from direct file reads

### Secondary (MEDIUM confidence)
- `18-CONTEXT.md` — User decisions document describing intended package API; written by project owner who presumably knows the package under development

### Tertiary (LOW confidence)
- `@vitalpoint/near-phantom-auth@0.4.2` API shape — inferred from CONTEXT.md; **not verifiable** until package is available
- `AnonAuthProvider`, `useAnonAuth()`, `requireAuth`, `auth.initialize()`, `auth.router` — all projected from CONTEXT.md decisions, unverified against actual package

---

## Metadata

**Confidence breakdown:**
- Codebase audit (files to delete/modify, current patterns): HIGH — all verified via direct file reads
- Package API shape (`auth.initialize`, `requireAuth`, `useAnonAuth`): LOW — inferred from CONTEXT.md only
- Integration strategy (funding hook, domain restriction, CORS): MEDIUM — pattern is clear, hook API unknown
- Scope inventory (13 backend deletes, 10 frontend deletes, 7 backend modifies, 8 frontend modifies): HIGH — directly enumerated from codebase

**Research date:** 2026-03-03
**Valid until:** Package-dependent; re-verify all LOW confidence items on first `pnpm add @vitalpoint/near-phantom-auth@0.4.2` success. Stable items (codebase patterns) valid indefinitely.
