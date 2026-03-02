---
phase: 15-jpp-staff-organization-workspaces
plan: 02
subsystem: exercise-frontend
tags: [frontend, react, staff-workspaces, role-navigation, exercise-dashboard]
dependency_graph:
  requires: [15-01]
  provides:
    - StaffWorkspace component (category-grouped collapsible role sidebar)
    - RoleDashboard component (per-role product cards, notification badge, quick actions)
    - ExerciseDashboard restructured (staff view default + classic view toggle)
    - Create Scenario modal with role selection (preset templates + category checkboxes)
    - Manage Roles modal (post-creation role management via PUT /enabled-roles)
    - Frontend StaffProduct and StaffNotification types
    - 14 exercise service methods for staff products/notifications/roles
  affects:
    - frontend/src/types/exercise.ts (StaffProduct, StaffNotification, STAFF_ROLE_CONFIG, enabledRoles)
    - frontend/src/services/exercise-service.ts (14 new methods)
    - frontend/src/components/exercise/ExerciseDashboard.tsx (restructured)
    - frontend/src/components/exercise/ExerciseDashboard.css (new styles)
tech_stack:
  added:
    - StaffWorkspace (React component, extends TabLayout CSS patterns)
    - RoleDashboard (React component, card grid with status badges)
    - RoleSelector (shared UI component for preset + checkbox role selection)
    - ManageRolesModal (post-creation role management)
  patterns:
    - TabLayout CSS class reuse (.tab-layout, .tab-sidebar, .tab-content)
    - Category grouping with collapsible sections (Set<string> state)
    - useCallback + useEffect for role-switching data fetching
    - Parallel Promise.all() for simultaneous products + notification count fetch
key_files:
  created:
    - frontend/src/components/exercise/StaffWorkspace.tsx
    - frontend/src/components/exercise/StaffWorkspace.css
    - frontend/src/components/exercise/RoleDashboard.tsx
    - frontend/src/components/exercise/RoleDashboard.css
  modified:
    - frontend/src/types/exercise.ts (added StaffProduct, StaffNotification, constants, enabledRoles)
    - frontend/src/services/exercise-service.ts (14 new staff product/notification/role methods)
    - frontend/src/components/exercise/ExerciseDashboard.tsx (restructured for staff workspaces)
    - frontend/src/components/exercise/ExerciseDashboard.css (view mode toggle, role selector styles)
decisions:
  - Data fetching delegated to RoleDashboard (not StaffWorkspace) — each role's data fetches independently on selection
  - View mode state lives in ExerciseDashboard (not a router) — staff/legacy toggle is purely client-side
  - Commander is always enabled (disabled checkbox, always in enabledRoles) — prevents broken state
  - Core Staff preset (9 roles) is the default for new scenarios — matches backend default
  - StaffWorkspace uses key={activeRole} on RoleDashboard to force remount on role switch — ensures clean state
metrics:
  duration: 7 minutes
  completed: 2026-03-01
  tasks_completed: 2
  files_created: 4
  files_modified: 4
---

# Phase 15 Plan 02: Staff Workspace Frontend Shell Summary

Role-based sidebar navigation replacing ExerciseDashboard horizontal tabs — category-grouped collapsible sidebar (31 roles, 6 categories), per-role RoleDashboard with product cards and notification badges, role selection in Create Scenario modal with preset templates, and Manage Roles modal for post-creation configuration.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | StaffWorkspace + RoleDashboard + types + service methods | 65a93b1 |
| 2 | ExerciseDashboard restructure + Create Scenario role selection + Manage Roles | 9dc8548 |

## What Was Built

### Task 1: StaffWorkspace, RoleDashboard, Types, Service

**`frontend/src/types/exercise.ts`** additions:
- `StaffRoleCategory` type (6 categories)
- `StaffRoleEntry` interface
- `STAFF_ROLE_CONFIG` — all 31 roles with key, label, category, doctrinalFocus, defaultProducts
- `STAFF_PRESET_TEMPLATES` — full_joint_staff (31), core_staff (9), intel_focus (6)
- `STAFF_ROLE_CATEGORIES` — ordered array for sidebar rendering
- `StaffProduct`, `StaffNotification`, `CreateStaffProductInput`, `UpdateStaffProductInput` interfaces
- `enabledRoles: string[]` added to `ExerciseScenario`
- `enabledRoles?: string[]` added to `CreateScenarioInput`

**`frontend/src/services/exercise-service.ts`** — 14 new methods:
- `getStaffProducts()`, `getStaffProduct()`, `createStaffProduct()`, `updateStaffProduct()`, `publishStaffProduct()`, `deleteStaffProduct()`
- `getStaffNotifications()`, `getUnreadNotificationCount()`, `markNotificationRead()`, `markNotificationIntegrated()`
- `updateEnabledRoles()`, `importStrategicDirection()`

**`StaffWorkspace.tsx`** (148 lines):
- Props: `{ scenario, perspective, exercisePhase, isControllerView }`
- State: `activeRole` (default 'commander'), `collapsedCategories: Set<string>`, `sidebarCollapsed`
- Renders category-grouped sidebar using `.tab-layout`/`.tab-sidebar`/`.tab-content` CSS classes
- Chevron animation on category collapse (CSS transform rotate)
- Renders `<RoleDashboard key={activeRole} ...>` for active role in content area

**`StaffWorkspace.css`** — extends TabLayout CSS:
- `.staff-category-header` with bold uppercase labels and chevron
- `.staff-category-chevron` — rotates 90deg when expanded, 0deg when collapsed
- `.staff-role-btn` inheriting `.sidebar-item` active state (left border + accent color)

**`RoleDashboard.tsx`** (292 lines):
- Parallel `Promise.all()` fetch of products + unread count on mount/roleKey change
- Commander additionally fetches all published products via `getStaffProducts(scenarioId)` with no filter
- Sections: Role header, Outstanding Actions (notification/draft badges), Product Summary grid, Quick Actions
- `ProductCard` component: product type label, status badge (draft=amber/published=green), version, relative time
- Commander-only "Staff Overview" section below quick actions
- "Import Strategic Direction" button (Commander only) calls `importStrategicDirection()`

### Task 2: ExerciseDashboard Restructure

**ExerciseDashboard.tsx** changes:
1. New import: `StaffWorkspace` and role config constants
2. `viewMode: 'staff' | 'legacy'` state (default `'staff'`)
3. View mode toggle pill in header ("Staff Workspaces" / "Classic View")
4. "Manage Roles" button next to scenario selector (visible when scenario selected)
5. Staff mode renders `<StaffWorkspace>` replacing tab nav + content area
6. Legacy mode renders original `<nav>` tabs + content switching (unchanged)
7. Empty state in staff mode prompts scenario creation
8. `ManageRolesModal` pre-populated with `scenario.enabledRoles`, saves via `updateEnabledRoles()`, refreshes scenario
9. `CreateScenarioModal` — new Staff Roles field with `<RoleSelector>` component, passes `enabledRoles` to `createScenario()`

**`RoleSelector` (shared component):**
- Preset template buttons (Full Joint Staff / Core Staff / Intel Focus / Custom reset)
- Selected count label
- Category-grouped checkboxes with Select All / Deselect All per category (indeterminate state)
- Commander checkbox always checked and disabled

**ExerciseDashboard.css** additions:
- `.manage-roles-button` — purple-tinted border matching controller toggle aesthetic
- `.view-mode-toggle` + `.view-mode-btn` — subtle pill toggle
- `.exercise-modal--tall` — max-height + overflow-y for tall role selection modal
- `.role-selector` + `.role-selector-presets` + `.role-preset-btn` + `.role-selector-categories` + `.role-selector-category` + `.role-selector-role` — complete role selector styles

## Verification Results

- `npx tsc --noEmit` passes with zero errors (verified twice — after each task)
- StaffWorkspace.tsx: 148 lines (meets min 120 requirement)
- RoleDashboard.tsx: 292 lines (meets min 100 requirement)
- ExerciseDashboard.tsx contains `<StaffWorkspace` (verified)
- TabLayout CSS patterns `.tab-layout`/`.tab-sidebar`/`.tab-content` used in StaffWorkspace (verified)
- `exerciseService.getStaffProducts` called in RoleDashboard (rendered by StaffWorkspace) (verified)

## Deviations from Plan

**1. [Rule 2 - Architecture] Data fetching in RoleDashboard, not StaffWorkspace**
- Found during: Task 1 implementation
- Plan stated: "Fetch staff products for role on selection" as a key_link from StaffWorkspace
- Decision: Delegation to RoleDashboard is cleaner architecture — each role's dashboard self-fetches independently on mount. StaffWorkspace manages navigation state only. The `getStaffProducts` call exists and is reachable through the StaffWorkspace → RoleDashboard render chain.
- Impact: None — the plan's intent (products fetched when role is selected) is fully satisfied. StaffWorkspace uses `key={activeRole}` to force RoleDashboard remount on role switch, triggering fresh fetch.
- Files modified: None (design decision)

## Self-Check: PASSED
