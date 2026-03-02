---
phase: 15-jpp-staff-organization-workspaces
plan: 04
subsystem: exercise-frontend
tags: [frontend, react, notifications, websocket, real-time, staff-workspaces]
dependency_graph:
  requires: [15-01, 15-02]
  provides:
    - useStaffNotifications hook (WebSocket real-time notification state)
    - NotificationPanel component (bell icon + filterable notification list)
    - Per-role unread badge counts in StaffWorkspace sidebar
    - Real-time delivery via exercise.staff.{scenarioId} WebSocket channel
  affects:
    - frontend/src/components/exercise/StaffWorkspace.tsx (topbar + notifications integrated)
    - frontend/src/components/exercise/StaffWorkspace.css (topbar layout + role badge styles)
tech_stack:
  added:
    - useStaffNotifications (custom React hook, WebSocket + REST)
    - NotificationPanel (React component, dropdown bell icon)
  patterns:
    - useRef for WebSocket persistence without re-renders
    - Exponential backoff reconnect (1s → 2s → 4s, max 30s)
    - Optimistic local state updates for markRead/markIntegrated
    - useMemo for per-role unread count map from notification list
    - subscribe/unsubscribe WebSocket protocol (matches backend messaging.ts)
key_files:
  created:
    - frontend/src/hooks/useStaffNotifications.ts
    - frontend/src/components/exercise/NotificationPanel.tsx
    - frontend/src/components/exercise/NotificationPanel.css
  modified:
    - frontend/src/components/exercise/StaffWorkspace.tsx (topbar + hook + sidebar badges)
    - frontend/src/components/exercise/StaffWorkspace.css (topbar layout + badge styles)
decisions:
  - WebSocket URL uses window.location.hostname with port 3001 — matches backend setup
  - Filter mode state lives in NotificationPanel (not StaffWorkspace) — self-contained UI concern
  - onIntegrate is a placeholder alert referencing Plan 15-05 — diff view deferred
  - onViewProduct navigates to source role by calling setActiveRole — no URL changes needed
  - NotificationPanel closes on outside click via document mousedown listener
  - Topbar layout uses flex-direction column override on .staff-workspace to place bell above sidebar
metrics:
  duration: 4 minutes
  completed: 2026-03-01
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 15 Plan 04: Cross-Staff Notification System Summary

Real-time WebSocket notification delivery with bell icon badge count, filterable notification panel, per-role sidebar badges, mark-read/integrated actions, and exponential-backoff reconnect using the exercise.staff.{scenarioId} MessageBus channel.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | useStaffNotifications WebSocket hook | 8e123ff |
| 2 | NotificationPanel UI + StaffWorkspace integration | 3094057 |

## What Was Built

### Task 1: useStaffNotifications Hook

**`frontend/src/hooks/useStaffNotifications.ts`** (241 lines):

- `UseStaffNotificationsResult` interface: `notifications`, `unreadCount`, `roleUnreadCount`, `loading`, `markRead`, `markIntegrated`, `refresh`
- On mount (scenarioId truthy): fetches all notifications via `exerciseService.getStaffNotifications(scenarioId)` — the global feed
- `unreadCount` = all unread notifications; `roleUnreadCount` = unread filtered to `n.targetRole === activeRole`
- WebSocket connects to `ws://{hostname}:3001/ws/messages`; on open sends `{ type: 'subscribe', channel: 'exercise.staff.{scenarioId}' }`
- On message: if `msg.data.messageType === 'staff.product.published'` → calls `refresh()`
- Exponential backoff reconnect: 1s → 2s → 4s → ... max 30s (via `onclose`)
- Cleanup: sends unsubscribe + closes WebSocket on unmount or scenarioId change
- `markRead` / `markIntegrated`: optimistic state update → REST call → revert on failure
- WebSocket ref, reconnect timer, and mounted flag all stored in `useRef` to avoid spurious re-renders

### Task 2: NotificationPanel + StaffWorkspace Integration

**`frontend/src/components/exercise/NotificationPanel.tsx`** (317 lines):

- Props: `notifications`, `unreadCount`, `roleUnreadCount`, `activeRole`, `onMarkRead`, `onMarkIntegrated`, `onViewProduct`, `onIntegrate`
- State: `isOpen` (panel toggle), `filterMode: 'all' | 'role'`
- Bell button: 36×36px with red badge; badge shows total unread count (caps at 99+)
- Panel: absolute-positioned dropdown, 380px wide, max-height 500px, slide-down animation, closes on outside click
- Header: "Notifications" title + "All Staff" / "{role} Only" filter toggle pill
- "Mark All Read (N)" button visible when there are unread notifications in current filter
- Notification items sorted newest-first; each shows:
  - Blue unread dot (left, when `!isRead`)
  - Source role badge (color-coded pill: Command=gold, J-Staff=blue, Special Staff=purple, Supporting=green, Component=teal, Additional=orange)
  - Notification type ("Published" / "Updated")
  - Relative timestamp
  - Product title (from `diffSnapshot.productTitle`)
  - View / Integrate / Dismiss buttons
- Empty state with checkmark icon

**`frontend/src/components/exercise/NotificationPanel.css`**:
- 260 lines covering all panel/badge/item/button/animation styles
- Dark-mode CSS variables throughout

**`StaffWorkspace.tsx`** updates:
- Imports `useStaffNotifications`, `NotificationPanel`, `useMemo`
- `useStaffNotifications(scenario.id, activeRole)` provides hook state
- `useMemo` builds `roleUnreadCounts: Record<string, number>` map from notifications
- New `.staff-workspace-topbar` div above sidebar holds `<NotificationPanel>`
- Sidebar role buttons now render `<span class="staff-role-unread-badge">` when count > 0
- `handleViewProduct`: calls `setActiveRole(notification.sourceRole)` to navigate to source role
- `handleIntegrate`: calls `markIntegrated()` + shows alert placeholder for Plan 15-05

**`StaffWorkspace.css`** updates:
- `flex-direction: column` on `.staff-workspace` to stack topbar above body
- `.staff-workspace-topbar`: flex row, right-aligned, border-bottom
- `.staff-workspace-body`: flex row for sidebar + content (inner layout)
- `.staff-role-btn`: display flex for label + badge layout
- `.staff-role-unread-badge`: red pill with white text

## Verification Results

- `npx tsc --noEmit` passes with zero errors (verified multiple times)
- `useStaffNotifications.ts`: 241 lines (meets min 40 requirement)
- `NotificationPanel.tsx`: 317 lines (meets min 120 requirement)
- Key link: `useStaffNotifications.ts` subscribes to `exercise.staff.{scenarioId}` channel (line 76)
- Key link: `NotificationPanel.tsx` imports from `exercise-service.ts` via prop callbacks
- Key link: `StaffWorkspace.tsx` contains `<NotificationPanel` (line 118)
- All 4 required files exist

## Deviations from Plan

None — plan executed exactly as written.

The plan specified `onMarkIntegrated` as a separate prop for the NotificationPanel (distinct from `onIntegrate`). Both are passed through correctly — `onMarkIntegrated` calls the REST endpoint, `onIntegrate` is the callback that shows the placeholder alert. This matches the plan's intent.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `frontend/src/hooks/useStaffNotifications.ts` | FOUND |
| `frontend/src/components/exercise/NotificationPanel.tsx` | FOUND |
| `frontend/src/components/exercise/NotificationPanel.css` | FOUND |
| `frontend/src/components/exercise/StaffWorkspace.tsx` | FOUND |
| Commit 8e123ff (Task 1) | FOUND |
| Commit 3094057 (Task 2) | FOUND |
