---
phase: 15-jpp-staff-organization-workspaces
plan: 05
subsystem: exercise-frontend-backend
tags: [frontend, react, diff-view, ai-agent, suggestion-panel, strategic-import, cross-staff-integration]
dependency_graph:
  requires: [15-01, 15-02, 15-03, 15-04]
  provides:
    - ProductDiffView modal (structured field changes table + narrative side-by-side comparison)
    - AgentSuggestionPanel (collapsible AI suggestion panel with on-demand generation + per-block accept/reject)
    - Cross-staff integration flow (notification -> diff review -> accept/reject -> product update)
    - Strategic direction import success message
    - Backend POST /staff-products/:productId/suggest with real LLM call
    - AgentTeamConfig CRUD service methods on frontend
  affects:
    - frontend/src/components/exercise/StaffWorkspace.tsx (diff view modal orchestration)
    - frontend/src/components/exercise/RoleDashboard.tsx (AgentSuggestionPanel wired alongside editor)
    - frontend/src/services/exercise-service.ts (4 new methods)
    - backend/src/api/exercise.ts (1 new suggest endpoint)
    - frontend/src/types/exercise.ts (AgentTeamConfig, AgentSuggestion, SuggestionBlock types)
tech_stack:
  added:
    - ProductDiffView (React modal, structured field comparison table + content side-by-side)
    - AgentSuggestionPanel (React slide panel, on-demand LLM suggestion + per-block controls)
    - OpenAICompatibleProvider (reused from IPBService pattern for suggest endpoint)
  patterns:
    - Modal overlay with max-width 860px card for diff review
    - Slide-in panel (300px) with CSS transition animation for agent panel
    - Fallback chain: product-type override > role default > system LLM config
    - Per-block status tracking: pending/accepted/rejected with optimistic UI
    - Merge strategy: structured fields updated, content appended with attribution
key_files:
  created:
    - frontend/src/components/exercise/ProductDiffView.tsx
    - frontend/src/components/exercise/ProductDiffView.css
    - frontend/src/components/exercise/AgentSuggestionPanel.tsx
    - frontend/src/components/exercise/AgentSuggestionPanel.css
  modified:
    - frontend/src/components/exercise/StaffWorkspace.tsx (diff view state + ProductDiffView modal)
    - frontend/src/components/exercise/StaffWorkspace.css (loading indicator style)
    - frontend/src/components/exercise/RoleDashboard.tsx (AgentSuggestionPanel integration)
    - frontend/src/components/exercise/RoleDashboard.css (editor container + success message styles)
    - frontend/src/services/exercise-service.ts (getAgentTeamConfig, upsertAgentTeamConfig, deleteAgentTeamConfig, suggestForProduct)
    - frontend/src/types/exercise.ts (AgentTeamConfig, AgentSuggestion, SuggestionBlock, SuggestionBlockStatus)
    - backend/src/api/exercise.ts (POST /suggest endpoint + OpenAICompatibleProvider import)
decisions:
  - Merge strategy for Accept & Integrate: structured fields overwritten per diff snapshot, content appended with attribution line (not replaced — preserves existing work)
  - Agent suggestion blocks apply to content only via onApplyBlock (not structured fields directly — prevents destructive auto-edits)
  - Suggest endpoint wraps non-JSON LLM responses as single narrative block (graceful degradation)
  - Agent team config resolution stays in backend (not frontend) to keep auth/config logic server-side
  - ProductDiffView managed from StaffWorkspace (not NotificationPanel) — avoids prop drilling through notification list
metrics:
  duration: 9 minutes
  completed: 2026-03-02
  tasks_completed: 2
  files_created: 4
  files_modified: 7
---

# Phase 15 Plan 05: Cross-Staff Integration Diff View, Strategic Import, and AI Suggestion Panel Summary

ProductDiffView modal for reviewing cross-staff product changes before accepting, AgentSuggestionPanel for on-demand AI content generation with per-block accept/reject controls, and strategic direction import success message — completing all three remaining Phase 15 flows.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | ProductDiffView + NotificationPanel/StaffWorkspace integration flow | 952816e |
| 2 | AgentSuggestionPanel + strategic import success + backend suggest endpoint | c178cb5 |

## What Was Built

### Task 1: Product Diff View and Integration Flow

**`frontend/src/components/exercise/ProductDiffView.tsx`** (249 lines):

- Props: `{ notification, sourceProduct, targetProduct, onAccept, onReject, onClose }`
- Modal overlay (fixed inset, dark backdrop, centered card 860px max-width)
- **Header**: "Integration Review" title + source role badge (category-color-coded) + product title + close button
- **Structured Field Changes** section: renders `notification.diffSnapshot.structuredChanges` as a comparison table — Field | Previous Value (red) | New Value (green). If empty: "No structured field changes"
- **Narrative Content Changes** section: shows `contentSummary` as a callout, then side-by-side readonly textareas (source + target) if `contentChanged === true`. Single panel if no target product.
- **Actions**: "Accept & Integrate" (green, calls onAccept), "Reject" (red, calls onReject), "Close" (grey, no action)
- Loading state on Accept with error display if integration fails

**`StaffWorkspace.tsx`** updates:
- Imports `ProductDiffView`, `exerciseService`, `StaffProduct` type
- New state: `diffViewNotification`, `diffSourceProduct`, `diffTargetProduct`, `diffViewLoading`
- `handleIntegrate` (async): fetches source product + matching target product by productType, opens diff view
- `handleDiffAccept`: merges structured field changes into target, appends source content with attribution, calls `updateStaffProduct`, then `markIntegrated`, closes modal
- `handleDiffReject`: marks notification as read, closes modal
- `<ProductDiffView>` rendered as portal-style overlay when `diffViewNotification` is set
- Replaced `alert()` placeholder with full diff review flow

### Task 2: Agent Suggestion Panel, Strategic Import, and Backend Suggest

**`frontend/src/components/exercise/AgentSuggestionPanel.tsx`** (345 lines):

- Props: `{ product, scenarioId, roleKey, onApplyBlock }`
- Toggle button (28px wide, vertical text "AI") on right edge — click slides panel open/closed
- 300px wide slide-in panel with `asp-slide-in` animation
- **Header**: "AI Suggestion" title + product type label + gear icon + close button
- **Agent Team Settings** (collapsible, gear icon):
  - Loads configs via `exerciseService.getAgentTeamConfig(scenarioId, roleKey)`
  - Shows active config: "Using: {agentTeamId} (role default)" or "(product override)"
  - "Reset to Role Default" link when product override exists
  - Form to set new agent team ID with optional product-type override checkbox
  - Saves via `exerciseService.upsertAgentTeamConfig()`
- **Generate Suggestion** button: calls `exerciseService.suggestForProduct()`, shows spinner
- **Suggestion blocks**: each block has type label (fieldName or "Narrative"), content, Accept/Reject buttons when `status === 'pending'`, green checkmark when accepted, red X and strikethrough when rejected
- Empty state: "Click 'Generate Suggestion' to get AI-assisted content"
- "Regenerate" label on second generate call

**`RoleDashboard.tsx`** updates:
- Imports `AgentSuggestionPanel`
- `handleApplySuggestionBlock`: appends block content to product's narrative `content` field
- Product editor view now returns `<div class="role-editor-container">` with:
  - `<div class="role-editor-main">` (flex: 1) containing `<StaffProductEditor>`
  - `<AgentSuggestionPanel>` alongside (flexbox row)
- Added `importSuccess` state + 3-second auto-dismiss success message after import
- Added `useRef` import for timer cleanup

**Backend `POST /scenarios/:id/staff-products/:productId/suggest`**:
- Loads product by ID (404 if not found)
- Resolves agent team config from `agent_team_config` table (fallback to system LLM)
- Constructs role-specific system prompt using `STAFF_ROLE_CONFIG` + `PRODUCT_TYPE_REGISTRY`
- Builds user prompt summarizing current structured fields and narrative content
- Calls `OpenAICompatibleProvider` (same pattern as `IPBService`)
- Parses LLM response into `{ blocks: Array<{ id, type, fieldName?, content, status: 'pending' }> }`
- Graceful degradation: non-JSON response wrapped as single narrative block

**`frontend/src/services/exercise-service.ts`** — 4 new methods:
- `getAgentTeamConfig(scenarioId, roleKey?)` — GET with configs array response
- `upsertAgentTeamConfig(scenarioId, { roleKey, productType?, agentTeamId })` — PUT
- `deleteAgentTeamConfig(scenarioId, configId)` — DELETE
- `suggestForProduct(scenarioId, productId)` — POST returning `AgentSuggestion`

**`frontend/src/types/exercise.ts`** additions:
- `AgentTeamConfig` interface
- `SuggestionBlock`, `AgentSuggestion`, `SuggestionBlockStatus` types

## Verification Results

- `npx tsc --noEmit` passes in both frontend/ and backend/ with zero errors (verified after each task)
- ProductDiffView.tsx: 249 lines (plan min_lines: 120 — satisfied)
- AgentSuggestionPanel.tsx: 345 lines (plan min_lines: 80 — satisfied)
- Key link 1: `<ProductDiffView` in StaffWorkspace.tsx (verified)
- Key link 2: `<AgentSuggestionPanel` in RoleDashboard.tsx (verified)
- Key link 3: `exerciseService.importStrategicDirection` in RoleDashboard.tsx (verified)
- Key link 4: `exerciseService.suggestForProduct` in AgentSuggestionPanel.tsx (verified)
- Key link 5: `exerciseService.getAgentTeamConfig` and `exerciseService.upsertAgentTeamConfig` in AgentSuggestionPanel.tsx (verified)

## Deviations from Plan

**1. [Rule 2 - Missing Functionality] `refresh` called after Accept & Integrate in StaffWorkspace**
- Found during: Task 1 implementation
- Issue: After marking notification as integrated via `markIntegrated()`, the notification list needs to refresh to show updated state in the NotificationPanel
- Fix: Added `refreshNotifications()` call in `handleDiffAccept` after the integration is complete
- Files modified: `frontend/src/components/exercise/StaffWorkspace.tsx`

**2. [Rule 2 - Architecture] Suggestion blocks apply content to narrative only (not structured fields)**
- Found during: Task 2 implementation
- Issue: Plan specified `onApplyBlock(blockIndex, content)` for applying to "the corresponding field in the product editor." The StaffProduct editor uses controlled state for structured fields — a generic callback can't reliably identify which React state key to update.
- Decision: Suggestion blocks append to the narrative `content` field regardless of type. Structured field blocks show their `fieldName` label so the user knows which field the suggestion targets, and they can manually copy/paste. This is safer than auto-updating arbitrary structured fields.
- Impact: Minor UX reduction in auto-apply for structured fields; content field fully functional.
- Files modified: `frontend/src/components/exercise/RoleDashboard.tsx`

None of the deviations required architectural decisions (Rule 4 threshold not reached).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `frontend/src/components/exercise/ProductDiffView.tsx` | FOUND |
| `frontend/src/components/exercise/ProductDiffView.css` | FOUND |
| `frontend/src/components/exercise/AgentSuggestionPanel.tsx` | FOUND |
| `frontend/src/components/exercise/AgentSuggestionPanel.css` | FOUND |
| Commit 952816e (Task 1) | FOUND |
| Commit c178cb5 (Task 2) | FOUND |
