---
phase: 60-rearchitect-ironclaw-integration
plan: 07
subsystem: ironclaw-admin
tags: [ironclaw, admin, self-update, wasm-tools, agent-config, advanced-tab]
dependency_graph:
  requires: [60-06]
  provides: [IC-06-ADVANCED-TAB, IC-06-WEBHOOK-UPDATE, IC-06-WASM-TOOLS]
  affects: [frontend/agent-config-panel, backend/ironclaw-admin-routes, backend/self-update-service]
tech_stack:
  added: []
  patterns: [HMAC-webhook-validation, admin-confirmed-update, graceful-detect-admin-via-fetch]
key_files:
  created:
    - backend/src/api/routes/ironclaw-admin.ts
    - frontend/src/components/agent-config/tabs/AdvancedTab.tsx
  modified:
    - backend/src/ironclaw/self-update-service.ts
    - backend/src/index.ts
    - backend/.env.example
    - frontend/src/components/agent-config/AgentConfigPanel.tsx
decisions:
  - Admin detection in AdvancedTab uses a probe fetch to /api/admin/ironclaw-status — 200 = admin, 403 = not admin. No separate role field needed.
  - Webhook does not require admin auth (GitHub calls it externally); security is provided by HMAC X-Hub-Signature-256 validation.
  - triggerUpdate() reuses existing execDockerRestart/waitForHealthy/execDockerRollback infrastructure from performUpdate() rather than duplicating it.
  - Updates are ALWAYS admin-confirmed per blueprint; webhook only sets the updateAvailable flag.
metrics:
  duration: 5 min
  completed_date: "2026-03-28"
---

# Phase 60 Plan 07: Advanced Tab and Admin Update Controls Summary

Advanced tab with self-expansion capabilities: GitHub release webhook receiver, admin-confirmed container updates, WASM tool builder via natural language, and full system status display completing the 6-tab Agent Config panel.

## Tasks Completed

### Task 1: Create ironclaw-admin routes and enhance self-update service
**Commit:** b10a2d4a

Created `backend/src/api/routes/ironclaw-admin.ts` with:
- `GET /api/admin/ironclaw-status` — Returns `IronclawStatus` (healthy, version, lastCheck, updateAvailable, availableVersion). Protected by admin DID allowlist middleware.
- `POST /api/admin/ironclaw-update` — Triggers admin-confirmed update by calling `selfUpdateService.triggerUpdate()`. Returns `{ status: 'update-initiated', version }`.
- `POST /api/admin/ironclaw-webhook/github-release` — Receives GitHub release webhook events. Validates `X-Hub-Signature-256` HMAC using `GITHUB_WEBHOOK_SECRET` env var. On valid `release.published`, calls `selfUpdateService.handleReleaseWebhook()`. Does NOT auto-update.

Enhanced `backend/src/ironclaw/self-update-service.ts` with three new public methods:
- `handleReleaseWebhook(payload: GitHubReleasePayload): void` — Stores release info, sets `updateAvailable = true`, notifies admin asynchronously.
- `triggerUpdate(): Promise<TriggerUpdateResult>` — Admin-confirmed update path. Reuses existing `execDockerRestart`/`waitForHealthy`/`execDockerRollback` infrastructure. Maintains an audit log (last 20 entries).
- `getStatus(): Promise<IronclawStatus>` — Returns rich status including live health check, version, lastCheck, updateAvailable, availableVersion. Replaces the old simpler `UpdateStatus` return.

The polling fallback also now sets `updateAvailable`/`availableVersion` flags when it detects a new version.

Router mounted at `/api/admin` in `backend/src/index.ts`.

Added `GITHUB_WEBHOOK_SECRET` to `backend/.env.example`.

### Task 2: Build AdvancedTab with version info, WASM tools, and admin controls
**Commit:** a910872d

Created `frontend/src/components/agent-config/tabs/AdvancedTab.tsx` with three sections:

**Section 1 — System Status (all users):**
- Fetches `/api/admin/ironclaw-status` on mount
- Displays health indicator (green/red dot), version, last check timestamp
- Shows "Update Available: vX.Y.Z" amber badge when update is pending
- Refresh button to re-poll status

**Section 2 — WASM Tool Builder (all users):**
- Textarea with descriptive placeholder for natural language tool description
- "Build Tool" button sends `/tool build <description>` to `/api/ironclaw/chat`
- Build progress/result feedback
- Lists user's current custom skills from `config.customSkills`
- Explanatory text per blueprint

**Section 3 — Admin Controls (admin only):**
- Admin detected via probe fetch: `GET /api/admin/ironclaw-status` returning 200 = admin, 403 = not admin
- "Update Ironclaw" button disabled when no update available
- Confirmation dialog before update: "This will restart the container. Active conversations will be interrupted."
- GitHub webhook configuration instructions with endpoint path displayed

Registered AdvancedTab as the 6th tab in `AgentConfigPanel.tsx`:
- TabId type updated to include `'advanced'`
- TABS array has `{ id: 'advanced', label: 'Advanced' }`
- Tab content panel renders `AdvancedTab` when `activeTab === 'advanced'`

### Task 3: Checkpoint — Human Verification
**Status:** AWAITING — see checkpoint below.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `backend/src/api/routes/ironclaw-admin.ts` — FOUND
- `frontend/src/components/agent-config/tabs/AdvancedTab.tsx` — FOUND
- `b10a2d4a` — FOUND (Task 1 commit)
- `a910872d` — FOUND (Task 2 commit)
