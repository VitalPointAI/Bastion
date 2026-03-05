---
phase: 21-ai-cop-layer-agent-team
plan: 01
subsystem: types, security, ontology
tags: [cop, cco, svg, dompurify, milstd2525, ontology, sanitizer]

# Dependency graph
requires: []
provides:
  - COP TypeScript type system (COPLayerSpec, COPSymbolSpec, COPLayer, LayerState, etc.)
  - CCO class lookup map with 48 curated classes across 6 modules
  - CCO entity validator and RAFT-to-CCO class suggester
  - SVG sanitizer with military-grade allowlist using DOMPurify
  - SVG safety pre-scanner for attack vector detection
  - Backend COP directory structure (agents, cco, layers, svg, messaging, linkage)
affects: [21-02, 21-03, 21-04, 21-05, 21-06, 21-07, 21-08, 21-09]

# Tech tracking
tech-stack:
  added: [dompurify, jsdom, "@types/dompurify", "@types/jsdom"]
  patterns: [cco-class-map-lookup, svg-allowlist-sanitization, belt-and-suspenders-svg-security]

key-files:
  created:
    - frontend/src/types/cop.ts
    - backend/src/cop/cco/cco-types.ts
    - backend/src/cop/cco/cco-classes.json
    - backend/src/cop/cco/cco-schema-loader.ts
    - backend/src/cop/cco/cco-validator.ts
    - backend/src/cop/cco/cco-schema-loader.test.ts
    - backend/src/cop/layers/layer-types.ts
    - backend/src/cop/svg/svg-allowlist.ts
    - backend/src/cop/svg/svg-sanitizer.ts
    - backend/src/cop/svg/svg-sanitizer.test.ts
  modified:
    - backend/package.json
    - frontend/package.json

key-decisions:
  - "Bundled curated CCO classes as JSON instead of parsing OWL/Turtle files to avoid n3 dependency"
  - "Re-declared shared COP types in backend layer-types.ts to maintain frontend/backend module boundary"
  - "Used jsdom for DOMPurify Node.js support with any-cast for TypeScript compatibility"

patterns-established:
  - "CCO class map: load JSON at startup into Map for O(1) lookup"
  - "SVG belt-and-suspenders: validateSVGSafety (detection) + sanitizeSVG (enforcement) + shadow DOM (isolation)"
  - "RAFT-to-CCO mapping: record type with fallback to cco:Entity for unknown types"

requirements-completed: [COP-TYPES, CCO-SCHEMA, SVG-SECURITY]

# Metrics
duration: 9min
completed: 2026-03-05
---

# Phase 21 Plan 01: Foundation Types & Security Summary

**COP type system with 15+ interfaces, CCO ontology loader with 48 curated classes, and DOMPurify SVG sanitizer with strict military-grade allowlist**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-05T19:38:32Z
- **Completed:** 2026-03-05T19:47:34Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- All COP TypeScript interfaces defined and compiling (COPLayerSpec, COPSymbolSpec, COPLayer, LayerState, ReviewFeedback, AuditEntry, COPConflict, COPLayerControlsProps, etc.)
- CCO schema loads 48 curated classes from bundled JSON; validator maps all RAFT entity types to CCO classes and rejects unknown classes
- SVG sanitizer strips all dangerous content (script, event handlers, javascript: URIs, external references, foreignObject) while preserving valid military symbology SVG
- 37 tests pass across CCO and SVG test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: COP type contracts and CCO types** - `e95e5e9` (feat)
2. **Task 2: CCO schema loader and validator** - `824779e` (test:RED), `6507030` (feat:GREEN)
3. **Task 3: SVG sanitizer with military-grade allowlist** - `7142196` (test:RED), `2bc5a46` (feat:GREEN), `9fb8bd3` (fix:TS-compat)

## Files Created/Modified
- `frontend/src/types/cop.ts` - All shared COP TypeScript interfaces (15+ types)
- `backend/src/cop/cco/cco-types.ts` - CCO class mapping types and RAFT-to-CCO map
- `backend/src/cop/cco/cco-classes.json` - 48 curated CCO classes across 6 modules
- `backend/src/cop/cco/cco-schema-loader.ts` - Loads CCO JSON into Map at startup
- `backend/src/cop/cco/cco-validator.ts` - Validates CCO class existence and suggests classes for RAFT entities
- `backend/src/cop/cco/cco-schema-loader.test.ts` - 18 tests for schema loader and validator
- `backend/src/cop/layers/layer-types.ts` - Backend layer input/query types
- `backend/src/cop/svg/svg-allowlist.ts` - SVG allowed/forbidden tags and attributes
- `backend/src/cop/svg/svg-sanitizer.ts` - DOMPurify wrapper with strict SVG profile
- `backend/src/cop/svg/svg-sanitizer.test.ts` - 19 tests for sanitizer and safety validator

## Decisions Made
- **Bundled CCO as JSON**: Used a hand-curated JSON file of 48 relevant CCO classes instead of parsing OWL/Turtle files. Avoids n3 dependency while maintaining CCO compliance for entity standardization.
- **Re-declared types in backend**: Backend layer-types.ts re-declares shared COP types locally rather than importing from frontend, maintaining the module boundary (backend never imports from frontend in this project).
- **DOMPurify type workaround**: Used `any` cast for jsdom window to satisfy DOMPurify's WindowLike type which is incompatible with jsdom's Window type in TypeScript strict mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DOMPurify TypeScript type incompatibility**
- **Found during:** Task 3 (SVG sanitizer verification)
- **Issue:** DOMPurify v3 WindowLike type is incompatible with jsdom's Window type in strict TypeScript
- **Fix:** Used `any` cast with eslint-disable comment
- **Files modified:** backend/src/cop/svg/svg-sanitizer.ts
- **Verification:** `tsc --noEmit` passes; all 19 SVG tests still pass
- **Committed in:** 9fb8bd3

**2. [Rule 3 - Blocking] Backend cannot import from frontend module**
- **Found during:** Task 1 (layer-types.ts compilation)
- **Issue:** Backend tsconfig does not include frontend source paths; import from `../../../frontend/src/types/cop.js` fails
- **Fix:** Re-declared shared COP types locally in layer-types.ts instead of cross-module import
- **Files modified:** backend/src/cop/layers/layer-types.ts
- **Verification:** `tsc --noEmit` passes for both frontend and backend
- **Committed in:** e95e5e9

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- jsdom not pre-installed in backend; added as dependency for DOMPurify Node.js support (expected, per plan instructions)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type contracts ready for all downstream plans (21-02 through 21-09)
- CCO schema loader ready for entity validation in layer generation
- SVG sanitizer ready for LLM-generated annotation security
- All directories created for subsequent plan implementation

## Self-Check: PASSED

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
