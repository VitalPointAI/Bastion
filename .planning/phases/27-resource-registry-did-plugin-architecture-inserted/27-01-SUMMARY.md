---
phase: 27-resource-registry-did-plugin-architecture-inserted
plan: 01
subsystem: api
tags: [did, hkdf, xstate, zod, plugin-architecture, resource-management, postgresql]

# Dependency graph
requires:
  - phase: 4.4
    provides: "Original resource types and resource-store CRUD"
  - phase: 4.2
    provides: "Agent DID pattern (agent-did.ts) used as template for resource DIDs"
provides:
  - "Aligned 6-category ResourceCategory type (vehicles, weapons, communications, sensors, medical, other)"
  - "Resource DID system with HKDF-based key derivation"
  - "ResourcePlugin interface with 5 facets (schema, state machine, capabilities, COP config, telemetry)"
  - "Extended resource-store with DID, capabilities, grouping, spatial query methods"
  - "ResourceGroup table for unit/formation/task_force grouping"
affects: [27-02, 27-03, 27-04, 27-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Resource DID derivation via HKDF (parallels agent DID)", "Plugin interface contract with zod+xstate", "GIN index for array-contains capability queries"]

key-files:
  created:
    - backend/src/resources/resource-did.ts
    - backend/src/resources/plugins/base-plugin.ts
  modified:
    - backend/src/resources/types.ts
    - backend/src/resources/resource-store.ts
    - backend/src/resources/schemas.ts

key-decisions:
  - "Used AnyStateMachine from xstate instead of fully parameterized StateMachine<14 generics> for plugin interface simplicity"
  - "Defined SafeParseResult locally instead of importing from zod v4 internal path (zod/v4/classic/parse not resolvable with bundler moduleResolution)"
  - "Category migration is idempotent SQL in initResourceTable, runs on every server start"

patterns-established:
  - "Resource DID format: did:near:resource-{resourceId}"
  - "Plugin interface contract: category, displayName, defaultIsAutonomous, specificationsSchema, stateMachine, capabilities, optional processTelemetry/getDetailSections"
  - "Idempotent DO $$ BEGIN / IF NOT EXISTS pattern for ALTER TABLE column additions"

requirements-completed: [RES-DID, RES-PLUGIN-IFACE, RES-CATEGORY-ALIGN]

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 27 Plan 01: Foundation Types, DID System, and Plugin Interface Summary

**HKDF-based resource DID system, 6-category aligned types, ResourcePlugin interface with zod+xstate facets, and extended resource-store with capability/spatial queries**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T00:31:59Z
- **Completed:** 2026-03-07T00:37:51Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Aligned backend ResourceCategory to frontend's 6 canonical categories (vehicles, weapons, communications, sensors, medical, other)
- Created resource DID system cloning the proven agent DID HKDF pattern
- Defined ResourcePlugin interface with all 5 facets: schema validation, state machine, capabilities, COP renderer config, telemetry handler
- Extended resource-store with DID columns, capability array (GIN-indexed), grouping, and spatial bounding-box queries

## Task Commits

Each task was committed atomically:

1. **Task 1: Extended types, plugin interface, and resource DID** - `18c8615` (feat)
2. **Task 2: Database migration and resource-store update for new columns** - `6375c14` (feat)

## Files Created/Modified
- `backend/src/resources/types.ts` - Extended with DID fields, RegisteredResource, ResourceManifest, ResourceGroup, ResourceTrustTier
- `backend/src/resources/resource-did.ts` - New: HKDF-based DID derivation for resources (createResourceDID, resolveResourceDID, verifyResourceDID)
- `backend/src/resources/plugins/base-plugin.ts` - New: ResourcePlugin interface, DetailSection type, SafeParseResult type
- `backend/src/resources/resource-store.ts` - Extended with new columns, indexes, category migration, updateResource, findByDID, findByCapabilities, findInArea
- `backend/src/resources/schemas.ts` - Updated category enum to 6 canonical values

## Decisions Made
- Used `AnyStateMachine` from xstate instead of `StateMachine<14 generics>` for plugin interface — keeps the contract simple while still being type-safe
- Defined `SafeParseResult<T>` locally rather than importing from zod v4 internal path — the bundler moduleResolution cannot resolve `zod/v4/classic/parse`
- Category migration runs idempotently in `initResourceTable()` — safe to execute on every server start, only updates rows with old category values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated schemas.ts category enum to match new 6-value type**
- **Found during:** Task 2 (resource-store update)
- **Issue:** `schemas.ts` still had old 4-value enum `['weapon_system', 'vehicle', 'equipment', 'communication']` which would reject valid new category values
- **Fix:** Updated enum to `['vehicles', 'weapons', 'communications', 'sensors', 'medical', 'other']`
- **Files modified:** backend/src/resources/schemas.ts
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** 6375c14 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for correctness — validation schema must accept the same categories as the type system. No scope creep.

## Issues Encountered
- xstate v5 `StateMachine` requires 14 type parameters — resolved by using `AnyStateMachine` type alias
- zod v4 `SafeParseReturnType` not accessible via external import path — resolved by defining compatible local type

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation types, DID system, and plugin interface ready for 27-02 (concrete plugin implementations)
- resource-store extended and ready for 27-03 (registration API endpoints)
- All new columns are idempotently added; safe for deployment

---
*Phase: 27-resource-registry-did-plugin-architecture-inserted*
*Completed: 2026-03-07*
