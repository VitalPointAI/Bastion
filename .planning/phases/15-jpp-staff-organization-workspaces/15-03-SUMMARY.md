---
phase: 15-jpp-staff-organization-workspaces
plan: 03
subsystem: exercise-frontend-backend
tags: [frontend, react, staff-workspaces, product-editor, pre-population, hybrid-template]
dependency_graph:
  requires: [15-01, 15-02]
  provides:
    - StaffProduct hybrid editor component (structured fields + narrative textarea)
    - NewProductModal (template library with role-filtered product types)
    - PRODUCT_TYPE_REGISTRY in frontend types (mirrors backend, pure data)
    - seedRoleWorkspace() on StaffProductStore (idempotent Phase 14 pre-population)
    - Seed-on-first-access behavior in GET /staff-products endpoint
  affects:
    - frontend/src/components/exercise/RoleDashboard.tsx (product navigation wired)
    - frontend/src/types/exercise.ts (PRODUCT_TYPE_REGISTRY added)
    - backend/src/exercise/staff-product-store.ts (seedRoleWorkspace added)
    - backend/src/api/exercise.ts (GET staff-products now seeds on first access)
tech_stack:
  added:
    - StaffProduct (React component with hybrid layout, UnitTable, NewProductModal)
    - PRODUCT_TYPE_REGISTRY (frontend pure-data mirror of backend registry)
    - StaffProductStore.seedRoleWorkspace() (Phase 14 data cross-reference seeding)
  patterns:
    - Hybrid editor: structured fields grid (top) + freeform textarea (below)
    - Seed-on-first-access: idempotent seeding triggered by first GET with roleKey
    - Reference IDs only in structured field (no Phase 14 data duplication)
    - RoleDashboard delegates to StaffProductEditor on product card click
key_files:
  created:
    - frontend/src/components/exercise/StaffProduct.tsx
    - frontend/src/components/exercise/StaffProduct.css
  modified:
    - frontend/src/components/exercise/RoleDashboard.tsx (product editor navigation)
    - frontend/src/types/exercise.ts (PRODUCT_TYPE_REGISTRY + type defs)
    - backend/src/exercise/staff-product-store.ts (seedRoleWorkspace method)
    - backend/src/api/exercise.ts (seed-on-first-access in GET endpoint)
decisions:
  - PRODUCT_TYPE_REGISTRY duplicated to frontend as pure data (no backend import possible in React app)
  - seedRoleWorkspace uses this.pool (no external pool parameter needed — store has pool in constructor)
  - Auto-save before publish: if isDirty when user clicks Publish, save is called first then publish
  - Commander pre-population queries COAs with commander_decision not null (avoids empty decision rows)
  - Default-title for seeded products uses registry label not productType key string
metrics:
  duration: 5 minutes
  completed: 2026-03-02
  tasks_completed: 2
  files_created: 2
  files_modified: 4
---

# Phase 15 Plan 03: Staff Product Template Editor and Pre-Population Summary

Hybrid doctrinal product editor (structured fields on top, freeform narrative textarea below) with role-based template library modal for creating new products, and idempotent seed-on-first-access pre-population from Phase 14 IPB/COA/order data.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | StaffProduct hybrid editor + RoleDashboard product navigation | 1fa81b3 |
| 2 | Backend seedRoleWorkspace + seed-on-first-access in GET endpoint | 79c689e |

## What Was Built

### Task 1: StaffProduct Hybrid Editor

**`frontend/src/components/exercise/StaffProduct.tsx`** (466 lines):

- `StaffProduct` component: Props `{ product, roleKey, scenarioId, onSave, onPublish, onBack }`
- State: `structuredData`, `content`, `title`, `isDirty`, `isSaving`, `isPublishing`, `publishedBanner`
- **Header bar** (sticky): Back button, inline-editable title, status badge (draft=amber/published=green), version badge, "Save Draft" (disabled if !isDirty), "Publish" button
- **Structured fields section**: `PRODUCT_TYPE_REGISTRY[product.productType].structuredFields` drives rendering. Field types: `text` (input), `textarea` (4 rows), `select` (options list), `number`, `date`, `unit_table` (UnitTable mini component)
- **UnitTable**: 4-column table (Unit Name / Size / Location / Status) with add/remove row buttons, stored as array in structured data
- **Narrative divider**: Visual separator labeled "Narrative Analysis"
- **Freeform textarea**: Full-width, min-height 200px, monospace font, auto-growing via CSS resize:vertical
- Auto-save before publish: if `isDirty` when Publish clicked, saves first then publishes
- Published banner: 3-second green notification after successful publish

**`frontend/src/components/exercise/StaffProduct.css`** (530 lines):
- Sticky header bar with stacked layout
- Status badge colors: draft=amber, published=green
- sp-fields-grid: CSS Grid auto-fill, textarea/unit_table fields span full width
- UnitTable mini table with add/remove row controls
- Narrative divider with flex line decorators
- Modal overlay with sp-type-list product selection

**`NewProductModal`** (exported from StaffProduct.tsx):
- Filters PRODUCT_TYPE_REGISTRY by `roles.includes(roleKey)` — role-appropriate types only
- Each type button shows label + structured field count
- On selection: calls `exerciseService.createStaffProduct()`, navigates to new product

**PRODUCT_TYPE_REGISTRY added to `frontend/src/types/exercise.ts`**:
- All 25 product types mirrored from backend (commander_intent, coa_decision, strategic_guidance, ipb_assessment, threat_assessment, oob, intel_summary, pir, sync_matrix, coa_sketch, task_org, roe, execute_order, coa_development, coa_analysis, staff_estimate, campaign_plan, logistics_estimate, css_annex, supply_plan, strategic_estimate, strategic_direction, campaign_objectives, comms_plan, c2_architecture, network_diagram, personnel_estimate, manning_status, casualty_tracking)
- `StructuredFieldDef`, `ProductTypeDef`, `StructuredFieldType` types exported

**`RoleDashboard.tsx`** updated:
- `selectedProduct` state drives product editor vs dashboard view
- `ProductCard.onClick` → `setSelectedProduct(product)` — opens editor
- "New Product" button (previously disabled) now enabled — opens `NewProductModal`
- `handleProductSave` / `handleProductPublish` update product in local `products` array
- Commander Staff Overview cards also clickable (navigate to editor)

### Task 2: Pre-Population Backend

**`StaffProductStore.seedRoleWorkspace(scenarioId, roleKey)`** added:

- **Idempotency**: first calls `findByRole()` — if products exist, returns immediately
- **j2**: queries `ipb_assessments WHERE scenario_id = $1`, creates one `ipb_assessment` product per row with `{ ipbAssessmentId, team, perspective, exercisePhase }` in structured
- **j35**: queries `scenario_coas WHERE scenario_id = $1`, creates one `coa_development` per row with `{ coaId, team, exercisePhase, status }` in structured
- **j3**: queries `exercise_orders WHERE scenario_id = $1`, creates one `execute_order` per row with `{ orderId, orderType, exercisePhase }` in structured
- **commander**: queries `scenario_coas WHERE commander_decision IS NOT NULL`, creates `coa_decision` products with decision reference in structured
- **all other roles**: iterates `STAFF_ROLE_CONFIG[roleKey].defaultProducts`, creates empty products using `PRODUCT_TYPE_REGISTRY[type].label` as title

**Anti-pattern compliance**: Content field left empty for all seeded products. Only reference IDs stored in structured — prevents sync problems per research pitfall #4.

**`GET /scenarios/:id/staff-products` in exercise.ts** updated:
- When `roleKey` query param provided, calls `staffProductStore.seedRoleWorkspace(scenarioId, roleKey)` before returning results
- Idempotent: second call returns existing products, no duplicates created
- Implements RESEARCH.md "trigger on first GET to workspace endpoint" recommendation

## Verification Results

- `npx tsc --noEmit` passes in both frontend/ and backend/ with zero errors
- StaffProduct.tsx: 466 lines (plan min_lines: 200 — satisfied)
- Key link 1: `<StaffProduct` appears 4 times in RoleDashboard.tsx (verified)
- Key link 2: `exerciseService.updateStaffProduct` + `exerciseService.publishStaffProduct` both in StaffProduct.tsx (verified)
- Key link 3: `seedRoleWorkspace` called in exercise.ts GET endpoint (verified)

## Deviations from Plan

**1. [Rule 2 - Missing Functionality] PRODUCT_TYPE_REGISTRY added to frontend types**
- Found during: Task 1 (StaffProduct component needs registry for structured fields)
- Issue: Plan references `PRODUCT_TYPE_REGISTRY[product.productType].structuredFields` in the component but this constant only existed in backend types — not importable in React frontend
- Fix: Added full registry to `frontend/src/types/exercise.ts` with all 25+ product types, matching backend exactly. Added `StructuredFieldDef`, `ProductTypeDef`, `StructuredFieldType` type exports.
- Files modified: `frontend/src/types/exercise.ts`

**2. [Rule 1 - Bug] seedRoleWorkspace uses this.pool instead of external Pool parameter**
- Found during: Task 2 (StaffProductStore already has getPool() in constructor)
- Issue: Plan specified `async seedRoleWorkspace(scenarioId, roleKey, pool: Pool)` but the store class already has `private pool = getPool()` — passing in an external pool would bypass the established store pattern
- Fix: Removed the `pool` parameter, used `this.pool` throughout (consistent with all other store methods)
- Files modified: `backend/src/exercise/staff-product-store.ts` — no impact on callers since exercise.ts only calls `staffProductStore.seedRoleWorkspace(scenarioId, roleKey)` with two parameters

**3. [Rule 2 - Missing Functionality] Auto-save before publish**
- Found during: Task 1 (UX correctness)
- Issue: If user edits fields and immediately clicks "Publish" without saving first, their edits would be lost (publish call does not include current form state)
- Fix: handlePublish checks `isDirty` — if true, calls updateStaffProduct first, then publishStaffProduct. Error on save aborts the publish.
- Files modified: `frontend/src/components/exercise/StaffProduct.tsx`

## Self-Check: PASSED

All files created/modified and commits verified:

| Item | Status |
|------|--------|
| `frontend/src/components/exercise/StaffProduct.tsx` | FOUND |
| `frontend/src/components/exercise/StaffProduct.css` | FOUND |
| `frontend/src/components/exercise/RoleDashboard.tsx` (modified) | FOUND |
| `frontend/src/types/exercise.ts` (modified) | FOUND |
| `backend/src/exercise/staff-product-store.ts` (modified) | FOUND |
| `backend/src/api/exercise.ts` (modified) | FOUND |
| `.planning/phases/15-.../15-03-SUMMARY.md` | FOUND |
| Commit 1fa81b3 (Task 1) | FOUND |
| Commit 79c689e (Task 2) | FOUND |
