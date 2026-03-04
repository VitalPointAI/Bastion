---
phase: quick-6
plan: 1
subsystem: workspace-ui
tags: [ui, css, workspace, auth, restyle]
dependency_graph:
  requires: []
  provides: [styled-create-wizard, workspace-dropdown, user-logout]
  affects: [frontend/src/App.tsx, frontend/src/components/workspace, frontend/src/components/UserStatusBar.tsx]
tech_stack:
  added: []
  patterns: [plain-css-modules, dropdown-outside-click, useAuth-logout]
key_files:
  created:
    - frontend/src/components/workspace/CreateWorkspaceWizard.css
    - frontend/src/components/workspace/WorkspaceSwitcher.css
  modified:
    - frontend/src/components/workspace/CreateWorkspaceWizard.tsx
    - frontend/src/components/workspace/WorkspaceSwitcher.tsx
    - frontend/src/App.tsx
    - frontend/src/components/UserStatusBar.tsx
    - frontend/src/components/UserStatusBar.css
decisions:
  - "Plain CSS files (no Tailwind) for wizard and switcher — matches project which has no Tailwind installed"
  - "WorkspaceSwitcher trigger uses 2-letter workspace abbreviation as label with caret dropdown indicator"
  - "Sign Out button placed in its own .dropdown-actions section with red-accent styling to signal destructive action"
metrics:
  duration: "12 min"
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 7
---

# Quick Task 6: Fix Workspace UI — Restyle Create Wizard and Relocate Switcher

**One-liner:** Replaced non-functional Tailwind classes in CreateWorkspaceWizard with a plain CSS dark-theme stylesheet, converted WorkspaceSwitcher from a 64px permanent sidebar to a compact nav-bar dropdown, and added a Sign Out button to the UserStatusBar dropdown using useAuth().logout().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restyle CreateWorkspaceWizard and relocate WorkspaceSwitcher | 81d4bb8 | CreateWorkspaceWizard.tsx, CreateWorkspaceWizard.css, WorkspaceSwitcher.tsx, WorkspaceSwitcher.css, App.tsx |
| 2 | Add logout button to UserStatusBar dropdown | 0cefbae | UserStatusBar.tsx, UserStatusBar.css |

## What Was Built

### Task 1: CreateWorkspaceWizard — Plain CSS Restyle

Created `CreateWorkspaceWizard.css` (~290 lines) with a complete dark-theme stylesheet:

- `.wizard-overlay` — fixed inset overlay with dark backdrop
- `.wizard-modal` — dark bg (#1a1a2e), border, rounded-12, max-width 520px
- `.step-indicator` / `.step-circle` — numbered circles with `.active` (blue-600), `.completed` (blue-900/blue-300 with checkmark), `.upcoming` (gray-700) states; `.step-connector` line between circles
- `.type-card-group` / `.type-card` — flex row of workspace type cards; `.type-card-name` and `.type-card-desc` are separate `display:block` spans so "Organization" and "Top-level" render on separate lines (fixes "OrganizationTop-level" jammed text bug)
- `.radio-option` / `.radio-dot` / `.radio-label` / `.radio-desc` — styled radio option cards for classification, invite mode, discoverability
- `.wizard-input`, `.wizard-textarea`, `.wizard-select` — dark bg (#2a2a3e), border, focus ring
- `.wizard-review-panel` / `.review-row` — review step layout
- `.wizard-footer` / `.wizard-btn-*` — footer buttons (cancel, back, next, create) with disabled states

Rewrote `CreateWorkspaceWizard.tsx`:
- Removed all Tailwind className strings (bg-gray-900, rounded-xl, text-white, etc.)
- Added `import './CreateWorkspaceWizard.css'`
- All JSX className attributes now reference the new CSS classes
- All logic, state management, validation, and event handlers preserved exactly

### Task 1: WorkspaceSwitcher — Sidebar to Nav Dropdown

Created `WorkspaceSwitcher.css` with dropdown button styles:
- `.ws-switcher-trigger` — matches `.nav-button` styling from App.css
- `.ws-switcher-dropdown` — absolute-positioned dropdown panel, dark bg, border, shadow, z-1000
- `.ws-item` / `.ws-item-icon` / `.ws-item.active` — workspace list items with icon, name, type badge
- `.ws-create-btn` / `.ws-create-icon` — dashed "+" create button at bottom

Rewrote `WorkspaceSwitcher.tsx`:
- Removed `<aside style="width: 64px; minHeight: 100vh">` sidebar
- Added `useRef`/`useEffect` for outside-click close (same pattern as UserStatusBar)
- Trigger button shows active workspace 2-letter abbreviation + notification dot + caret
- Dropdown lists all workspaces with icon tiles, type badges, primary star, active indicator, notification count
- Clicking workspace calls `handleWorkspaceClick` and closes dropdown
- "+" button opens CreateWorkspaceWizard and closes dropdown
- All existing sorting, navigation, workspace creation logic preserved

Updated `App.tsx`:
- Moved `<WorkspaceSwitcher />` from sidebar flex wrapper into `<nav className="app-nav">`, placed before Admin button (after nav-spacer)
- Removed the `<div style={{ display: 'flex', flex: 1, minHeight: 0 }}>` wrapper div and the nested aside layout
- `<main className="app-main">` now renders directly after `</header>`

### Task 2: UserStatusBar Logout Button

Updated `UserStatusBar.tsx`:
- Added `import { useNavigate } from 'react-router-dom'`
- Added `import { useAuth } from '../hooks/useAuth'`
- Extracted `logout` from `useAuth()`
- Added `handleLogout = async () => { await logout(); navigate('/login'); }`
- Added `<div className="dropdown-actions">` with `<button className="logout-btn">Sign Out</button>` after `.dropdown-details`

Updated `UserStatusBar.css`:
- `.dropdown-actions` — padding 12px 16px, border-top rgba(255,255,255,0.1)
- `.logout-btn` — red-tinted background (rgba 239,68,68,0.15), red text (#ef4444), red border
- `.logout-btn:hover` — deeper red background and border

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript compilation: PASSES (0 errors, 0 warnings)
- CreateWorkspaceWizard.css: EXISTS, 291 lines
- WorkspaceSwitcher.css: EXISTS, 175 lines
- No Tailwind classes remain in CreateWorkspaceWizard.tsx or WorkspaceSwitcher.tsx
- App.tsx: WorkspaceSwitcher in nav bar (not sidebar), sidebar flex wrapper removed
- UserStatusBar.tsx: imports useAuth, calls logout(), useNavigate for redirect

## Self-Check

- [x] CreateWorkspaceWizard.css exists at frontend/src/components/workspace/CreateWorkspaceWizard.css
- [x] WorkspaceSwitcher.css exists at frontend/src/components/workspace/WorkspaceSwitcher.css
- [x] Commit 81d4bb8 exists (Task 1)
- [x] Commit 0cefbae exists (Task 2)
- [x] TypeScript: 0 errors
