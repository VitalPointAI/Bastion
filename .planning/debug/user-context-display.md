---
status: diagnosed
trigger: "Diagnose user context display issues after authentication"
created: 2026-02-01T00:00:00Z
updated: 2026-02-01T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Multiple data flow issues between backend session and frontend context
test: Traced data from backend /api/auth/session -> auth-service.ts -> useAuth -> UserContext -> UserStatusBar
expecting: Found field name mismatch and missing email propagation
next_action: Return diagnosis

## Symptoms

expected: User context displays NEAR account ID and allows username customization
actual: NEAR account ID not visible. DID shows 'pending'. Cannot change username from default 'user'. Shows 'MPC enabled'.
errors: none reported
reproduction: Authenticate and view user profile/dropdown
started: unknown

## Eliminated

## Evidence

- timestamp: 2026-02-01T00:01:00Z
  checked: backend/src/api/auth.ts GET /api/auth/session endpoint (lines 472-497)
  found: Returns { nearAccountId: session.accountId, ... } - uses field name "nearAccountId"
  implication: Backend sends "nearAccountId" but frontend expects "accountId"

- timestamp: 2026-02-01T00:02:00Z
  checked: frontend/src/lib/auth-service.ts getSession() method (lines 111-135)
  found: Returns { accountId: data.accountId, ... } - expects field name "accountId"
  implication: Field name mismatch causes accountId to be undefined in frontend

- timestamp: 2026-02-01T00:03:00Z
  checked: backend session and auth types
  found: UserSession has email from AuthUser but /api/auth/session does NOT include email in response
  implication: Email is never sent to frontend - causes fallback to "User" display name

- timestamp: 2026-02-01T00:04:00Z
  checked: frontend/src/components/AuthWrapper.tsx (lines 21-108)
  found: email state is initialized but NEVER populated from session - only used in DID creation error path
  implication: email remains null, UserStatusBar shows "User" as default

- timestamp: 2026-02-01T00:05:00Z
  checked: frontend/src/components/UserStatusBar.tsx (lines 36-46, 72-81)
  found: displayName = email || 'User' and accountId shown only if truthy
  implication: With email=null and accountId=undefined, shows "User" and hides Account ID

- timestamp: 2026-02-01T00:06:00Z
  checked: DID initialization in AuthWrapper.tsx (lines 54-105)
  found: userDID only set if hasUserDID returns true OR if DID created successfully with PRF
  implication: If DID check fails or user has no DID, userDID remains null -> shows "Pending"

- timestamp: 2026-02-01T00:07:00Z
  checked: UserContext and AuthSession interfaces
  found: No username field exists - only email. UserContext has no setters/customization hooks.
  implication: Username customization not implemented - only email display with no edit capability

## Resolution

root_cause: Three issues: (1) Backend/frontend field name mismatch (nearAccountId vs accountId) causes NEAR account to be undefined, (2) Email not included in session response and not fetched separately causes display name fallback to "User", (3) DID not resolving due to missing accountId parameter
fix:
verification:
files_changed: []
