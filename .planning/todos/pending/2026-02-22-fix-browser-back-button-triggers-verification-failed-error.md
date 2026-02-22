---
created: 2026-02-22T19:06:10.468Z
title: Fix browser back button triggers verification failed error
area: auth
files:
  - frontend/src/components/auth/AuthWrapper.tsx
  - backend/src/api/auth.ts
---

## Problem

When the user clicks the browser back button, the app shows "Verification Failed" with `{"error":"Verification failed"}` and redirects back to the login page. This suggests the session/token verification endpoint is failing when navigating backward, likely because:

1. The session token is not being sent correctly on back-navigation (stale fetch headers)
2. The AuthWrapper re-triggers verification on mount and the session has expired or the verification request fails
3. Browser back restores a cached page state but the auth context re-initializes and fails verification

The user should remain authenticated when using browser back navigation within the app.

## Solution

TBD — Investigate:
- Check if AuthWrapper's session verification fires on every mount vs only on initial load
- Check if the verification endpoint returns proper error codes vs generic "Verification failed"
- Consider caching auth state in sessionStorage to survive back-navigation without re-verification
- Check React Router's behavior with browser history and AuthWrapper re-mounting
