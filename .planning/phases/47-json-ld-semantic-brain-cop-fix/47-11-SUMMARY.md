---
phase: 47-json-ld-semantic-brain-cop-fix
plan: 11
subsystem: ui
tags: [json-ld, provenance, entity-resolution, react, typescript, neo4j, cco, bfo]

# Dependency graph
requires:
  - phase: 47-json-ld-semantic-brain-cop-fix
    plan: 03
    provides: actor-store JSON-LD fields (jsonldType, confidence, assertedVia, validFrom, validTo)
  - phase: 47-json-ld-semantic-brain-cop-fix
    plan: 10
    provides: graph API /api/graph/actors returning JSON-LD enriched actors with confidenceTier
provides:
  - JPP entity search API returning JSON-LD enriched entities (jsonldType, confidence, confidenceTier, assertedVia, validFrom, validTo)
  - Frontend Entity interface with optional JSON-LD fields and formatSourceMethod() helper
  - EntityResolutionPanel provenance badge row (confidence tier, source method, ontology type)
  - DesignAIPanel graph confidence warning banner for low-confidence entity data
  - OperationalAssess Intelligence Quality sidebar view with tier distribution and contradiction count
affects: [plan-tab, design-tab, assess-tab, entity-resolution, cop, brain-viz]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON-LD field passthrough: entity-tools shapes data; jpp.ts normalizes to frontend Entity interface"
    - "Graph confidence fetch pattern: fetch /api/graph/actors on mount; derive summary metrics client-side"
    - "Graceful degradation: JSON-LD fields are optional on Entity interface; UI shows badges only when fields are present"

key-files:
  created: []
  modified:
    - backend/src/api/jpp.ts
    - frontend/src/lib/entity-service.ts
    - frontend/src/components/plan/EntityResolutionPanel.tsx
    - frontend/src/components/design/DesignAIPanel.tsx
    - frontend/src/components/assess/OperationalAssess.tsx

key-decisions:
  - "Normalize entity field names in jpp.ts (name->canonicalName, type->entityType) so search results match frontend Entity interface without client-side remapping"
  - "Add Intelligence Quality as fourth sidebar item in OperationalAssess rather than embedding in MOE/MOP views — keeps separation of concerns"
  - "Lazy-load graph confidence in DesignAIPanel and OperationalAssess to avoid blocking initial render"

patterns-established:
  - "Entity provenance badge pattern: conditionally render badge row only when JSON-LD fields are present (graceful degradation for pre-migration entities)"
  - "Graph confidence summary pattern: fetch actors, compute avg/tier counts client-side, show amber warning when hasLowConfidence is true"

requirements-completed: [WIRE-01]

# Metrics
duration: 12min
completed: 2026-03-16
---

# Phase 47 Plan 11: Wire Design/Plan/Assess Tabs to JSON-LD Provenance Summary

**JPP entity search enriched with JSON-LD fields; plan tab shows confidence tier/source/ontology badges; design tab warns on low-confidence entities; assess tab has Intelligence Quality view with tier distribution and contradiction count**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-16T17:10:00Z
- **Completed:** 2026-03-16T17:22:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- JPP entity search API now returns `jsonldType`, `confidence`, `confidenceTier`, `assertedVia`, `validFrom`, `validTo` for every entity result, and normalizes field names to match the frontend `Entity` interface
- `entity-service.ts` Entity interface extended with optional JSON-LD fields and `formatSourceMethod()` helper added
- `EntityResolutionPanel` shows a provenance badge row for each entity: colored confidence tier badge (green/amber/red), source method label, and readable ontology type derived from CCO namespace
- `DesignAIPanel` fetches entity confidence summary on open; shows amber warning banner when any entity has confidence < 0.5
- `OperationalAssess` gains an "Intelligence Quality" sidebar view with average confidence bar, tier distribution cards (high/medium/low counts), and unresolved contradiction count

## Task Commits

1. **Task 1: Update JPP entity API + entity-service client with JSON-LD fields** - `35b24daf` (feat)
2. **Task 2: Wire design, plan, assess tabs to display JSON-LD provenance data** - `5f4e5cbe` (feat)

## Files Created/Modified
- `backend/src/api/jpp.ts` - Entity search response enriched with JSON-LD fields; field names normalized to frontend interface
- `frontend/src/lib/entity-service.ts` - Entity interface extended with optional JSON-LD fields; formatSourceMethod() helper added
- `frontend/src/components/plan/EntityResolutionPanel.tsx` - Provenance badge row with confidence tier, source method, ontology type
- `frontend/src/components/design/DesignAIPanel.tsx` - Graph confidence fetch on open; amber warning banner for low-confidence data
- `frontend/src/components/assess/OperationalAssess.tsx` - Intelligence Quality sidebar view with confidence summary

## Decisions Made
- Normalized entity field names (`name` -> `canonicalName`, `type` -> `entityType`) in `jpp.ts` rather than in the frontend client — keeps the API response consistent with the `Entity` type contract
- Added "Intelligence Quality" as a new sidebar item rather than embedding it into existing MOE/MOP views — cleaner separation of concerns for assessors
- Used lazy loading for graph confidence fetches (only fetch when view/panel is opened) to avoid unnecessary API calls on initial tab load

## Deviations from Plan

None - plan executed exactly as written. The entity-tools handler already returned JSON-LD fields; jpp.ts just needed to reshape and pass them through.

## Issues Encountered
None - all files compiled cleanly on both backend and frontend TypeScript checks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7+ downstream consumers from CONTEXT.md are now wired to the JSON-LD graph (COP, brain viz covered in plan 10; design/plan/assess tabs covered here)
- Phase 47 complete — JSON-LD semantic graph integration is end-to-end

---
*Phase: 47-json-ld-semantic-brain-cop-fix*
*Completed: 2026-03-16*
