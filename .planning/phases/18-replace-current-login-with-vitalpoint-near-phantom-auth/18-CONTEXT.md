# Phase 18: Replace Current Login with @vitalpoint/near-phantom-auth - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the entire custom passkey/magic-link/TOTP authentication system with the `@vitalpoint/near-phantom-auth` package (v0.4.2). This covers: installing the package, configuring server and client, replacing all auth routes/middleware/components, updating session handling from Bearer tokens to HttpOnly cookies, and removing all legacy auth code. The existing DID system and NEAR account funding service are preserved.

</domain>

<decisions>
## Implementation Decisions

### Identity model
- Email is **required** at registration (not anonymous/codename-based)
- Admin setting to restrict registration to a specific email domain (securely checked server-side) — open registration (any domain) is default
- User chooses their own display name; defaults to email if not chosen
- **No codenames** — skip the package's codename feature
- DID continues to be derived from NEAR accountId (existing pattern preserved)

### Session mechanism
- Adopt **HttpOnly cookie sessions** (package default) — replace Bearer tokens in localStorage
- All frontend fetch calls updated to use `credentials: 'include'` instead of `Authorization` headers
- CORS configuration updated for cookie-based auth (credentials, sameSite, secure)

### Auth middleware
- Use the package's built-in `requireAuth` middleware for **all** protected backend routes
- `req.anonUser` provides authenticated user context
- Replace all existing `Authorization: Bearer` header checking throughout backend routes

### Route mounting
- Mount package router at `/api/auth` (same path as current)
- Package provides: `/register/start`, `/register/finish`, `/login/start`, `/login/finish`, `/logout`, `/session`, `/recovery/*`
- Old route structure (`/passkey/*`, `/magic-link/*`, `/totp/*`) is fully replaced

### Database
- Drop all old auth tables (users, passkeys, sessions, challenges, magic_link_tokens, totp_secrets, etc.)
- Package's `auth.initialize()` creates its own PostgreSQL schema
- Clean slate — no data migration

### Features dropped
- **Magic link login** — removed entirely (passkey-only authentication)
- **TOTP 2FA** — removed (passkeys are phishing-resistant by design)
- **Email-based recovery** — replaced by password+IPFS recovery
- **PRF extension handling** — package handles WebAuthn internally
- **MigrationFlow component** — removed (no legacy users after clean break)

### Recovery
- **Password + IPFS only** (no wallet recovery — users won't have NEAR wallets)
- IPFS pinning provider: **Pinata** (PINATA_API_KEY + PINATA_API_SECRET env vars)
- Users set a strong password + receive an IPFS CID for recovery

### NEAR account funding
- **Keep existing funding-service.ts** — package creates MPC accounts, existing service handles NEAR transfers
- Package's built-in treasury funding is NOT used
- Existing mpc-account.ts preserved for funding logic

### Migration strategy
- **Clean break** — all users re-register
- Delete all old auth code completely (~15 backend files, ~8 frontend components)
- No archive branch — git history is sufficient
- No parallel auth period

</decisions>

<specifics>
## Specific Ideas

- Admin domain restriction should be a runtime setting (not hardcoded) — configurable from admin dashboard
- Domain check must be server-side only (never trust client-side email validation for domain restriction)
- Package version: `@vitalpoint/near-phantom-auth@0.4.2`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/hooks/useAuth.tsx` — Will be replaced by package's `useAnonAuth()` hook via `AnonAuthProvider`
- `frontend/src/context/UserContext` — Preserved, but populated from package's auth state instead of custom auth
- `frontend/src/lib/identity.ts` (buildDID, hasUserDID, emitEntityRegistered) — Preserved, DID still derived from NEAR accountId
- `backend/src/auth/funding-service.ts` — Preserved for NEAR account funding
- `backend/src/auth/mpc-account.ts` — Preserved for MPC integration with funding

### Files to remove (backend)
- `backend/src/auth/magic-link-service.ts`
- `backend/src/auth/magic-link-store.ts`
- `backend/src/auth/migration-service.ts`
- `backend/src/auth/passkey-service.ts`
- `backend/src/auth/passkey-store.ts`
- `backend/src/auth/platform-settings-store.ts`
- `backend/src/auth/prf-did-integration.ts`
- `backend/src/auth/recovery-service.ts`
- `backend/src/auth/session-store.ts`
- `backend/src/auth/totp-service.ts`
- `backend/src/auth/totp-store.ts`
- `backend/src/auth/types.ts`
- `backend/src/auth/user-store.ts`
- `backend/src/api/auth.ts` (replaced by package router)

### Files to remove (frontend)
- `frontend/src/components/LoginPage.tsx` + CSS
- `frontend/src/components/RegisterPage.tsx` + CSS
- `frontend/src/components/LoginButton.tsx`
- `frontend/src/components/PasskeySetup.tsx` + CSS
- `frontend/src/components/MagicLinkVerify.tsx`
- `frontend/src/components/MigrationFlow.tsx`
- `frontend/src/lib/auth-service.ts`
- `frontend/src/lib/passkey.ts`

### Files to modify
- `frontend/src/App.tsx` — Replace AuthProvider/routes with package's AnonAuthProvider
- `frontend/src/components/AuthWrapper.tsx` — Use package's useAnonAuth() instead of custom useAuth()
- `frontend/src/hooks/useAuth.tsx` — Replace with re-export of package's useAnonAuth or remove
- `backend/src/index.ts` — Mount package's auth.router instead of custom authRouter
- All backend routes using `Authorization: Bearer` header checks — switch to package's requireAuth middleware

### Established Patterns
- Express router mounting at `/api/*` paths
- React context providers wrapping the app (AuthProvider → UserProvider)
- `credentials: 'include'` already used in some fetch calls

### Integration Points
- `backend/src/index.ts` line 85: `app.use('/api/auth', authRouter)` — swap to package router
- `frontend/src/App.tsx` — AuthProvider wraps all routes
- `frontend/src/components/AuthWrapper.tsx` — DID initialization after auth (preserved, rewired)
- Admin dashboard domain restriction setting — new integration point

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth*
*Context gathered: 2026-03-03*
