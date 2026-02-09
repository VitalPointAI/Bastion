---
status: diagnosed
trigger: "Diagnose why /strategic doesn't redirect to login when unauthenticated"
created: 2026-02-01T00:00:00Z
updated: 2026-02-01T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - AuthWrapper does not redirect unauthenticated users to login
test: Reviewed AuthWrapper.tsx - it always renders children regardless of isAuthenticated state
expecting: AuthWrapper should check isAuthenticated and redirect to /login when false
next_action: Document root cause and fix approach

## Symptoms

expected: Protected routes redirect to login when unauthenticated
actual: /strategic attempts to load with loading indicators instead of redirecting to login
errors: none (just wrong behavior)
reproduction: Visit /strategic when not logged in
started: unknown

## Eliminated

## Evidence

- timestamp: 2026-02-01T00:01:00Z
  checked: App.tsx route configuration
  found: /strategic route is wrapped in AuthWrapper (line 152-156)
  implication: Route SHOULD be protected

- timestamp: 2026-02-01T00:02:00Z
  checked: AuthWrapper.tsx (lines 21-167)
  found: AuthContent component checks isLoading and isAuthenticated but NEVER redirects
  implication: Missing redirect logic is the root cause

- timestamp: 2026-02-01T00:03:00Z
  checked: useAuth.tsx hook
  found: Hook correctly tracks isAuthenticated state, but it's not used for redirect
  implication: Auth state is available, just not used for access control

## Resolution

root_cause: AuthWrapper DOES have redirect logic (line 31-32) BUT the redirect executes AFTER status-overlay is rendered when status is 'creating-did', keeping spinner visible indefinitely
root_cause_detail: When isLoading becomes false with isAuthenticated=false, the redirect happens. However, the status-overlay with spinner is shown when statusMessage is not null (lines 162-169). The getStatusMessage() returns 'Setting up your secure identity...' when status='creating-did', which persists and blocks the redirect from being visible. When truly unauthenticated, the status should never enter 'creating-did' state (which requires isAuthenticated=true at line 62), but the issue is timing - the overlay blocks visibility even when redirect IS firing.
actual_issue: The redirect works correctly (Navigate component at lines 31-32) when !isLoading && !isAuthenticated. But the spinner appears BEFORE auth finishes checking, then the redirect happens but appears blocked by the overlay.

fix: Remove the status-overlay when redirecting, or add an early return before rendering children to ensure redirect is not blocked by visual elements
verification: Navigate to /strategic unauthenticated, observe redirect to /login without spinner overlay
files_changed:
  - frontend/src/components/AuthWrapper.tsx (lines 162-169, 31-32)
