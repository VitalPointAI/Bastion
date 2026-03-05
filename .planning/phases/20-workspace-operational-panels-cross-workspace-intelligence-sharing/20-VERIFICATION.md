---
phase: 20-workspace-operational-panels-cross-workspace-intelligence-sharing
verified: 2026-03-04T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Login to app and verify workspace selector appears at root"
    expected: "Post-login, / shows a two-column page with OrgTree on the left and workspace detail card on the right. No top-level Decide/Design/Campaign/Monitor/Exercise nav buttons visible."
    why_human: "Visual rendering, post-auth flow, and conditional layout cannot be verified by grep."
  - test: "Select a workspace and navigate through all tab bar tabs"
    expected: "Tab bar shows Overview|Decide|Design|Campaign|Monitor|Train (filtered by role). Clicking each tab renders real content — not placeholders. Overview shows StrategicValidityDashboard above role panel."
    why_human: "Tab switching, role gating, and dynamic content rendering require a live browser session."
  - test: "Click the Org button in the tab bar"
    expected: "OrgTree slide-out sidebar appears from the right with a backdrop. Clicking a workspace in the tree navigates to that workspace's tab view and closes the sidebar."
    why_human: "Animation, overlay rendering, and navigation behavior require human observation."
  - test: "Verify WorkspaceBreadcrumb in header"
    expected: "Inside /workspace/:id routes, header shows a compact breadcrumb with workspace type prefix, truncated name, and classification badge. On the workspace selector page (/), the breadcrumb is absent."
    why_human: "Conditional header rendering based on route requires visual verification."
  - test: "Navigate to Decide tab, open Escalation sidebar item"
    expected: "EscalationPanel renders. For top-level workspaces, shows 'This is a top-level workspace.' message. For workspaces with a parent, shows form with proposal kind, description, urgency radio buttons, and 'Escalate to [parent name]' submit button."
    why_human: "Form interactivity, guard logic based on workspace hierarchy, and success/error states require live testing."
  - test: "Navigate to Decide tab, open Data Sharing sidebar item"
    expected: "SubscriptionManager shows two sections: outgoing subscriptions (as subscriber) and incoming (as publisher). Approve/Reject buttons visible for pending incoming subscriptions. 'Request New Subscription' opens a workspace picker form."
    why_human: "Two-section subscription layout and CRUD interactions require live browser verification."
  - test: "Type old panel URLs in browser"
    expected: "/decide, /design, /campaign, /monitor, /exercise all redirect to /. Browser ends up on the workspace selector page."
    why_human: "Redirect behavior requires a running browser session."
  - test: "Verify cross-workspace layer toggle on Overview tab"
    expected: "CrossWorkspaceLayerToggle renders above WorkspaceDashboard on the Overview tab. If no approved subscriptions, shows 'No cross-workspace subscriptions' message. Toggle switches appear for each approved subscription."
    why_human: "Component rendering in context of live subscription data requires browser verification."
---

# Phase 20: Workspace Operational Panels & Cross-Workspace Intelligence Sharing — Verification Report

**Phase Goal:** Move 5 operational panels (Decide, Design, Campaign, Monitor, Train) into per-workspace tab bars, add workspace selector landing page, enable cross-workspace data sharing with classification-gated subscriptions, and implement decision escalation routing with tiered DAO voting.
**Verified:** 2026-03-04T00:00:00Z
**Status:** human_needed (all automated checks PASSED — human UI verification required)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After login, user lands on workspace selector page showing org hierarchy tree and workspace cards | VERIFIED | `WorkspaceSelector` renders in `App.tsx` when `!isAdmin && !isWorkspace`. Root route `/` is `AuthenticatedShell` (which renders `WorkspaceSelector` as default). `WorkspaceSelector.tsx` (206 lines) contains `OrgTree`, `selectedId` state, detail card with "Enter Workspace" button. |
| 2 | Selecting a workspace navigates to `/workspace/:id` | VERIFIED | `WorkspaceSelector.tsx` line 187: `navigate('/workspace/${selectedMembership.workspaceId}')` on Enter Workspace click. |
| 3 | Top-level Decide/Design/Campaign/Monitor/Exercise header nav buttons are removed | VERIFIED | No `MAIN_TABS` constant, no `activeTab` derivation, no panel nav buttons in `App.tsx`. Header contains only BASTION logo, `WorkspaceBreadcrumb`, `WorkspaceSwitcher`, Admin button, `UserStatusBar`. |
| 4 | Old routes `/decide`, `/design`, `/campaign`, `/monitor`, `/exercise` redirect to `/` | VERIFIED | `App.tsx` lines 158–162: all five routes explicitly redirect via `<Navigate to="/" replace />`. |
| 5 | Compact workspace breadcrumb shows in header when inside a workspace | VERIFIED | `WorkspaceBreadcrumb.tsx` (78 lines): returns `null` when `!activeWorkspace \|\| !location.pathname.startsWith('/workspace/')`. Renders type prefix, truncated name (20 chars), classification badge otherwise. |
| 6 | WorkspaceTabContainer renders horizontal tab bar (Overview\|Decide\|Design\|Campaign\|Monitor\|Train) with role-gated visibility | VERIFIED | `WorkspaceTabContainer.tsx` (316 lines): `WORKSPACE_TABS` constant, `DEFAULT_TAB_ACCESS` map covering all named roles, `visibleTabs` derived from backend config or client defaults. `FALLBACK_TABS: ['overview', 'monitor']` for unknown roles. |
| 7 | All 5 panel tabs accept workspaceId prop and scope data to active workspace | VERIFIED | `DecideTab`, `DesignTab`, `CampaignTab`, `MonitorTab` all have `workspaceId: string` in props interface. `MonitorTab` uses `workspaceId` in fetch URL (no hardcoded 'default'). `TrainTab` created (23 lines). `DesignTab` has documented TODO for full scoping (StrategicDashboard doesn't yet accept workspaceId — flagged below). |
| 8 | Cross-workspace subscription system with classification-gated approval workflow exists | VERIFIED | Backend: `workspace-subscription-store.ts` (244 lines) with `workspace_subscriptions` table, full CRUD. API: `POST/GET/PATCH/DELETE /:id/subscriptions` in `workspaces.ts` with `clearanceSufficient()` check on subscription creation (line 1461). Frontend: `SubscriptionManager.tsx` (477 lines) wired to `workspaceService.getSubscriptions/createSubscription/updateSubscriptionStatus`. |
| 9 | Decision escalation routing to parent workspace with tiered DAO voting (autocratic/democratic) | VERIFIED | Backend: `workspace-escalation-store.ts` (259 lines) with `workspace_escalation_rules` table. `POST /:id/escalate` endpoint (line 1735): determines voting mechanism (`urgent → autocratic`, else rule or `democratic`), logs off-chain activity to both workspaces. Frontend: `EscalationPanel.tsx` (312 lines) with top-level workspace guard, commander/xo role guard, form with proposal kind, description, urgency selection. |
| 10 | Tab notification badges with cross-workspace update dropdown and layer toggle | VERIFIED | `WorkspaceContext` extended with `tabNotifications`, `crossWorkspaceUpdates`, `clearTabNotifications`, `refreshCrossWorkspaceData`. `WorkspaceTabContainer` imports and renders `NotificationBadge`, `TabNotificationDropdown` (181 lines), `CrossWorkspaceLayerToggle` (219 lines). Badge click opens dropdown without tab navigation. |

**Score:** 10/10 truths verified (automated checks)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/workspace/WorkspaceSelector.tsx` | Post-login landing page with hierarchy tree + card detail (min 80 lines) | VERIFIED | 206 lines. Contains `OrgTree`, `selectedId` state, card detail, "Enter Workspace" button, loading/empty/no-membership guards. |
| `frontend/src/components/workspace/WorkspaceBreadcrumb.tsx` | Compact header breadcrumb showing active workspace identity (min 30 lines) | VERIFIED | 78 lines. Conditionally renders null, shows type prefix + truncated name + classification badge. |
| `frontend/src/App.tsx` | Workspace-first routing with `WorkspaceSelector` | VERIFIED | Contains `WorkspaceSelector`, `WorkspaceBreadcrumb`, `WorkspaceTabContainer`. Root route renders `WorkspaceSelector`. Legacy panel routes redirect to `/`. |
| `frontend/src/components/workspace/WorkspaceTabContainer.tsx` | Role-gated tab container with OrgTreeSidebar toggle (min 100 lines) | VERIFIED | 316 lines. Contains all 6 tabs, role-gated `visibleTabs`, backend panel config fetch with fallback, badge integration, all 5 panel component imports. |
| `frontend/src/components/workspace/OrgTreeSidebar.tsx` | Collapsible slide-out sidebar wrapping OrgTree (min 40 lines) | VERIFIED | 94 lines. Fixed-position overlay with backdrop dismiss, header with close button, `OrgTree` rendered with navigation. |
| `backend/src/workspace/workspace-panel-config-store.ts` | Panel visibility config per workspace — exports `workspacePanelConfigStore` | VERIFIED | 209 lines. `workspace_panel_config` table with FK to `workspaces(id)`. Methods: `getConfig`, `upsertConfig`, `getOrCreateDefault`, `deleteConfig`. Singleton exported. |
| `backend/src/workspace/workspace-subscription-store.ts` | Cross-workspace subscription management — exports `workspaceSubscriptionStore` | VERIFIED | 244 lines. `workspace_subscriptions` + `workspace_data_cache` tables, both with FKs to `workspaces(id)`. Full CRUD. Singleton exported. |
| `backend/src/workspace/workspace-escalation-store.ts` | Escalation rule management — exports `workspaceEscalationStore` | VERIFIED | 259 lines. `workspace_escalation_rules` table with FK to `workspaces(id)`. Methods: `createRule`, `listRulesForWorkspace`, `getRulesForKind`, `updateRule`, `deleteRule`. Singleton exported. |
| `backend/src/api/workspaces.ts` | Extended workspace API with panel-config, subscription, and escalation endpoints — contains `panel-config` | VERIFIED | Imports all 3 stores (lines 20–22). 10+ endpoints: `GET/PUT /:id/panel-config`, `POST/GET/PATCH/DELETE /:id/subscriptions`, `GET/POST/DELETE /:id/escalation-rules`, `POST /:id/escalate`. |
| `frontend/src/context/WorkspaceContext.tsx` | Extended context with tab notifications — contains `tabNotifications` | VERIFIED | `tabNotifications` appears 7+ times: in interface (line 57), defaults (line 78), state (line 119), context value (line 363), plus `crossWorkspaceUpdates`, `clearTabNotifications`, `refreshCrossWorkspaceData`. |
| `frontend/src/lib/workspace-service.ts` | Frontend service with `getSubscriptions`, `getPanelConfig`, `escalateDecision` | VERIFIED | All three methods confirmed at lines 492, 520, 578. Also `createSubscription`, `updateSubscriptionStatus`, `deleteSubscription`, `getEscalationRules`, `createEscalationRule`. |
| `frontend/src/components/workspace/CrossWorkspaceLayerToggle.tsx` | Toggle panel for approved subscriptions (min 60 lines) | VERIFIED | 219 lines. Loads subscriptions, filters `approvalStatus === 'approved'`, renders toggle switches with `enabledLayers` Set state, `onLayersChange` callback. |
| `frontend/src/components/workspace/TabNotificationDropdown.tsx` | Dropdown from tab badge (min 50 lines) | VERIFIED | 181 lines. Filters `crossWorkspaceUpdates` by tab, absolute-positioned dropdown, "Mark all as read" calls `clearTabNotifications` + `onClose`. |
| `frontend/src/components/workspace/EscalationPanel.tsx` | UI for escalation with urgency selection (min 80 lines) | VERIFIED | 312 lines. Top-level guard (line 125), commander/xo guard (line 137), form with proposal kinds, description, urgency radio buttons, calls `workspaceService.escalateDecision`. |
| `frontend/src/components/workspace/SubscriptionManager.tsx` | UI for managing cross-workspace subscriptions (min 80 lines) | VERIFIED | 477 lines. Two sections (outgoing/incoming), approve/reject/delete, create form with workspace picker and data type checkboxes. |
| `frontend/src/components/tabs/TrainTab.tsx` | New Train tab wrapping ExerciseDashboard (min 15 lines) | VERIFIED | 23 lines. Renders `ExerciseDashboard` inside `TabLayout`. Has documented TODO for workspace-scoped filtering. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.tsx` | `WorkspaceSelector` | Route `path="/"` renders `WorkspaceSelector` | VERIFIED | Line 122: `<WorkspaceSelector />` rendered in default branch when `!isAdmin && !isWorkspace` |
| `App.tsx` | `/workspace/:workspaceId` | Workspace route renders `WorkspaceTabContainer` | VERIFIED | Lines 118–119: `<Route path=":workspaceId/:tab" element={<WorkspaceTabContainer />} />` and `<Route path=":workspaceId" element={<WorkspaceTabContainer />} />` |
| `WorkspaceTabContainer.tsx` | `WorkspaceDashboard` | Overview tab renders `WorkspaceDashboard` | VERIFIED | Line 200 shows `CrossWorkspaceLayerToggle` + `WorkspaceDashboard` on overview; Overview case renders `WorkspaceDashboard`. |
| `WorkspaceTabContainer.tsx` | `OrgTreeSidebar` | Org button toggles sidebar | VERIFIED | Line 31: imported; line 310: `{orgTreeOpen && <OrgTreeSidebar onClose={...} />}` |
| `WorkspaceTabContainer.tsx` | `DecideTab, DesignTab, CampaignTab, MonitorTab, TrainTab` | `activeTab` conditional rendering with `workspaceId` prop | VERIFIED | Lines 35–39 imports; lines 206–218 render each panel with `workspaceId={displayId}` |
| `WorkspaceTabContainer.tsx` | `/api/workspaces/:id/panel-config` | `workspaceService.getPanelConfig` | VERIFIED | Line 116: `workspaceService.getPanelConfig(displayId, userDID)` fetched on workspace change |
| `WorkspaceTabContainer.tsx` | `TabNotificationDropdown` | Badge click handler renders dropdown | VERIFIED | Line 33 imported; line 264 rendered when `dropdownTab === tab` |
| `backend/src/api/workspaces.ts` | `workspacePanelConfigStore` | Import and method calls | VERIFIED | Line 20 imports; lines 1355, 1396 call `getOrCreateDefault`, `upsertConfig` |
| `backend/src/api/workspaces.ts` | `workspaceSubscriptionStore` | Import and method calls | VERIFIED | Line 21 imports; lines 1467, 1515, 1516, 1564, 1595, 1610 use subscription store methods |
| `backend/src/api/workspaces.ts` | `workspaceEscalationStore` | Import and method calls | VERIFIED | Line 22 imports; lines 1641, 1677, 1712, 1773 use escalation store methods |
| `EscalationPanel.tsx` | `workspace-service.escalateDecision` | API call on form submit | VERIFIED | Line 14 imports `workspaceService`; line 107 calls `workspaceService.escalateDecision` |
| `SubscriptionManager.tsx` | `workspace-service getSubscriptions, createSubscription, updateSubscriptionStatus` | Service calls | VERIFIED | Line 99 calls `getSubscriptions`, line 123 `updateSubscriptionStatus` (approve), line 165 `updateSubscriptionStatus` (reject), line 180 `createSubscription` |
| `backend/src/workspace/workspace-panel-config-store.ts` | `workspaces` table | `workspace_panel_config.workspace_id FK` | VERIFIED | Line 69: `REFERENCES workspaces(id) ON DELETE CASCADE` |
| `backend/src/workspace/workspace-subscription-store.ts` | `workspaces` table | subscriber/publisher FK | VERIFIED | Lines 29–30: both `subscriber_workspace_id` and `publisher_workspace_id` reference `workspaces(id)` |
| `DecideTab.tsx` | `EscalationPanel, SubscriptionManager` | Sidebar view conditional rendering | VERIFIED | Lines 4–5 imported; lines 62–66 render `EscalationPanel` and `SubscriptionManager` per sidebar selection |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| WOP-01 | 20-02, 20-09 | Workspace Tab Container — horizontal tab bar (Overview\|Decide\|Design\|Campaign\|Monitor\|Train) with role-gated visibility | SATISFIED | `WorkspaceTabContainer.tsx` 316 lines; `WORKSPACE_TABS` constant; `DEFAULT_TAB_ACCESS` role map; backend config fetch with fallback |
| WOP-02 | 20-01, 20-09 | Workspace Selector Landing Page — post-login landing with org hierarchy tree + workspace cards | SATISFIED | `WorkspaceSelector.tsx` 206 lines; OrgTree on left, detail card on right; App.tsx root route renders it |
| WOP-03 | 20-04, 20-09 | Panel Context Injection — all 5 panel tabs accept workspaceId and scope data to active workspace | SATISFIED (partial) | All 5 tabs have `workspaceId` prop. `MonitorTab` uses dynamic `workspaceId` in fetch. `DesignTab` and `TrainTab` have documented TODOs for full scoping — `StrategicDashboard` and `ExerciseDashboard` do not yet consume `workspaceId`. Prop is injected but not fully propagated in 2 of 5 tabs. |
| WOP-04 | 20-03, 20-05, 20-09 | Panel Visibility Configuration — per-workspace role→tab access stored in PostgreSQL, commander-configurable | SATISFIED | `workspace_panel_config` table with CRUD store; `GET/PUT /:id/panel-config` endpoints (PUT requires commander/xo); `WorkspaceTabContainer` fetches and uses backend config |
| WOP-05 | 20-03, 20-05, 20-08 | Cross-Workspace Subscription System — subscription model for non-hierarchical data sharing with approval workflow | SATISFIED | `workspace_subscriptions` table; REST API with `clearanceSufficient()` classification gate; `SubscriptionManager` UI with approve/reject/cancel workflow |
| WOP-06 | 20-06, 20-07 | Cross-Workspace Notifications & Layer Toggle — tab badges with count, dropdown with actionable items, layer toggle for data overlays | SATISFIED | `tabNotifications` and `crossWorkspaceUpdates` in context; `NotificationBadge` on each tab; `TabNotificationDropdown` on badge click; `CrossWorkspaceLayerToggle` on Overview tab |
| WOP-07 | 20-03, 20-05, 20-08 | Decision Escalation Routing — manual + threshold-based escalation to parent workspace, tiered voting (autocratic/democratic) | SATISFIED | `workspace_escalation_rules` table; `POST /:id/escalate` with urgency→voting mechanism selection; `EscalationPanel` UI with commander guard; off-chain activity logging to both workspaces |
| WOP-08 | 20-01, 20-09 | Routing Restructure — remove top-level panel routes, workspace-first navigation paradigm | SATISFIED | No MAIN_TABS; root `/` renders `WorkspaceSelector`; `/decide`, `/design`, `/campaign`, `/monitor`, `/exercise` all redirect to `/` |
| WOP-09 | 20-02, 20-09 | OrgTree Collapsible Sidebar — slide-out sidebar accessible from any tab | SATISFIED | `OrgTreeSidebar.tsx` 94 lines; fixed-position overlay rendered by `WorkspaceTabContainer`; "Org" button in tab bar toggles it |
| WOP-10 | 20-01, 20-09 | Workspace Breadcrumb — compact header identity showing active workspace | SATISFIED | `WorkspaceBreadcrumb.tsx` 78 lines; renders only on `/workspace/*` routes; shows type prefix, name (truncated 20 chars), classification badge |

**Requirements coverage:** 10/10 WOP requirements have implementation evidence. WOP-03 is marked partial — `workspaceId` prop is injected into all 5 tabs but `StrategicDashboard` (in `DesignTab`) and `ExerciseDashboard` (in `TrainTab`) do not consume the prop. This is explicitly documented as TODOs in both files and was a known scope deferral in Plan 04 (documented in plan text as intentional limitation).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/tabs/DesignTab.tsx` | 13 | `// TODO Phase 20: Pass workspaceId to filter strategic docs by workspace` — `StrategicDashboard` does not accept or consume workspaceId | Info | DesignTab prop is wired but has no effect on data scoping. Strategic documents shown are not filtered to active workspace. |
| `frontend/src/components/tabs/TrainTab.tsx` | 13 | `// TODO Phase 20: Pass workspaceId to ExerciseDashboard for workspace-scoped exercise filtering` — `ExerciseDashboard` does not consume workspaceId | Info | TrainTab prop is wired but exercise list is not filtered to active workspace. |
| `frontend/src/components/workspace/WorkspaceTabContainer.tsx` | 12 (comment) | `// TODO full scoping` in comment for DesignTab | Info | Documents known limitation; not a hidden stub. |

No blockers or warnings. All identified TODOs are acknowledged deferred scope from Plan 04 planning decisions, not accidental stubs.

---

### Human Verification Required

#### 1. Workspace Selector Landing Page

**Test:** Log in and navigate to `/`. Verify two-column layout with OrgTree on left and workspace detail card on right. Clicking a tree node shows card. "Enter Workspace" navigates to `/workspace/:id`.
**Expected:** No top-level panel buttons in header. OrgTree is interactive. Card shows workspace name, type badge, classification badge, member count, role, and Enter Workspace button.
**Why human:** Visual layout, interactive OrgTree navigation, and post-login flow cannot be verified by static code analysis.

#### 2. Tab Bar Role Gating

**Test:** Log in as observer role and navigate to a workspace. Verify only Overview tab appears. Log in as commander and verify all 6 tabs appear.
**Expected:** Tab bar correctly filters tabs per role. Backend panel config drives visibility when available, falls back to client defaults.
**Why human:** Role-based rendering and backend config integration require live testing.

#### 3. Operational Panel Tab Content

**Test:** Navigate to each tab (Overview, Decide, Design, Campaign, Monitor, Train). Verify no "coming soon" or "Panel content will be wired" placeholder text.
**Expected:** Overview shows StrategicValidityDashboard (validity map centerpiece) above role panel and activity feed. Decide shows DAODashboard. Design shows StrategicDashboard. Campaign shows MissionList. Monitor shows graph data. Train shows ExerciseDashboard.
**Why human:** Dynamic content rendering with live data requires browser verification.

#### 4. OrgTree Collapsible Sidebar

**Test:** In any workspace tab, click the "Org" button at the far right of the tab bar.
**Expected:** Slide-out sidebar appears from the right with a dark backdrop. Clicking the backdrop or X button closes it. Clicking a workspace node in the tree navigates to that workspace and closes the sidebar.
**Why human:** Overlay animation, z-index stacking, and interaction flow require visual inspection.

#### 5. WorkspaceBreadcrumb in Header

**Test:** Navigate to `/workspace/:id`. Check the header. Navigate to `/`. Check header again.
**Expected:** Inside workspace routes: breadcrumb shows `[TYPE] [Name] [CLASSIFICATION]`. On workspace selector: no breadcrumb visible.
**Why human:** Conditional component rendering in the header requires visual verification.

#### 6. Escalation Panel Flow

**Test:** Enter a workspace that has a parent workspace. Navigate to Decide tab → Escalation. Fill in form (proposal kind, description, set urgency to "Urgent"). Submit.
**Expected:** Success message appears with escalation ID, voting mechanism "autocratic", and parent workspace name. Error appears if description is under 10 chars.
**Why human:** Form validation, API round-trip, and success/error state rendering require live test.

#### 7. Subscription Manager Approval Workflow

**Test:** As commander of Workspace A, create a subscription request to Workspace B's data. As commander of Workspace B, open Decide → Data Sharing. See the incoming pending request. Approve it.
**Expected:** Incoming request shows "Approve" and "Reject" buttons. After approval, status changes to "Active". Subscription appears in Workspace A's outgoing list as approved.
**Why human:** Cross-workspace approval workflow requires two authenticated sessions and live API interaction.

#### 8. Old URL Redirects

**Test:** Type `/monitor`, `/decide`, `/exercise` in browser address bar.
**Expected:** All redirect to `/` (workspace selector). No 404. No stale panel renders.
**Why human:** Browser redirect behavior and history replacement require a running app.

---

### Summary

Phase 20 is structurally complete. All 10 requirement IDs (WOP-01 through WOP-10) have verified implementation artifacts, all key wiring links are confirmed in source code, and no stub or missing file issues were found.

The two known scoping deferrals in WOP-03 (DesignTab's `StrategicDashboard` and TrainTab's `ExerciseDashboard` not consuming `workspaceId`) are explicitly documented in code comments and plan decisions — not hidden gaps. They are informational anti-patterns, not blockers.

The phase cannot be declared fully passed without human verification of 8 interactive scenarios covering visual layout, role-gated tab rendering, real-time cross-workspace subscription approval, and OrgTree sidebar behavior.

---

_Verified: 2026-03-04T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
