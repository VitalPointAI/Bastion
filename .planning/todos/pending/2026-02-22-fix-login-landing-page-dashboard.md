---
created: 2026-02-22T11:55
title: Fix login landing page to show dashboard when authenticated
area: ui
files:
  - frontend/src/App.tsx
  - frontend/src/components/LoginPage.tsx
---

## Problem

When a user is already logged in and navigates to the home page (`/`), the app shows a "Login to access your command center" message instead of a useful dashboard. The authenticated user sees the same welcome/login screen as an unauthenticated user, requiring them to manually click a nav button to get anywhere useful.

The home route should detect authentication state and render a dashboard overview (or redirect to Governance/Strategic) instead of the static welcome screen.

## Solution

TBD — Options include:
- Redirect authenticated users from `/` to `/governance` (or a configurable default view)
- Replace the home page content with a command center dashboard summary when authenticated (showing key metrics across governance, strategic, missions)
- Keep the welcome page for unauthenticated users only, swap to dashboard for authenticated
