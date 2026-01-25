---
phase: 05
plan: 10
subsystem: operational-planning
tags: [graphics, api, milsymbol, geojson, rest]
requires: ["05-01", "05-04"]
provides:
  - Operational graphics generator with milsymbol
  - MIL-STD-2525D tactical graphics
  - GeoJSON export for map integration
  - Comprehensive planning REST API
affects: ["05-11", "05-12"]
tech-stack:
  added: [milsymbol]
  patterns: [symbol-rendering, geojson-generation, rest-api]
key-files:
  created:
    - backend/src/planning/graphics/symbol-renderer.ts
    - backend/src/planning/graphics/operational-graphics.ts
    - backend/src/planning/graphics/index.ts
    - backend/src/api/planning.ts
  modified:
    - backend/src/planning/documents/index.ts
    - backend/src/index.ts
decisions:
  - decision: "MIL-STD-2525D SIDC codes for tactical graphics"
    rationale: "Standard military symbology compliance"
    context: "Symbol rendering"
  - decision: "GeoJSON FeatureCollection for export"
    rationale: "Industry standard for geographic data interchange"
    context: "Graphics export"
  - decision: "Auto-generate graphics from plan data"
    rationale: "Reduce manual graphics creation burden"
    context: "Operational overlay generation"
metrics:
  duration: 7min
  completed: 2026-01-25
---

# Phase 05 Plan 10: Operational Graphics Generator & Planning API Summary

Operational graphics generator with milsymbol and comprehensive planning REST API.

## What Was Built

### Task 1: Operational Graphics Generator (f133f8b)

**Symbol Renderer (`backend/src/planning/graphics/symbol-renderer.ts`):**
- `renderSymbol()` - Renders MIL-STD-2525D symbols to data URL
- `getSymbolAnchor()` - Gets symbol anchor point for positioning
- `getSymbolSize()` - Gets symbol dimensions
- `GRAPHIC_SIDC` constants for common tactical graphics:
  - Points: OBJECTIVE, TARGET, NAMED_AREA, DECISION_POINT
  - Lines: PHASE_LINE, FCL, LOA, LD, FLOT
  - Areas: ASSEMBLY_AREA, ATTACK_POSITION, AXIS_OF_ADVANCE, ENGAGEMENT_AREA

**Operational Graphics (`backend/src/planning/graphics/operational-graphics.ts`):**
- `generateOperationalGraphics()` - Auto-generates overlay from plan data:
  - Phase lines from execution phases
  - Objectives from selected COA tasks
  - Axis of advance for decisive operation
  - Engagement areas from risks mentioning enemy/ambush
- `graphicsToGeoJSON()` - Exports as GeoJSON FeatureCollection
- Calculates bounding box from all graphics

### Task 2: Planning REST API (a56973d)

**Router at `/api/planning` with 25+ endpoints:**

**Plan CRUD:**
- `POST /plans` - Create operational plan
- `GET /plans/:id` - Get plan by ID
- `GET /missions/:missionId/plans` - Get plans by mission
- `PATCH /plans/:id` - Update plan
- `DELETE /plans/:id` - Delete plan

**Workflow:**
- `GET /plans/:id/workflow` - Get workflow state and checkpoint status
- `POST /plans/:id/workflow/events` - Send workflow event
- `GET /plans/:id/workflow/history` - Get workflow history

**COAs:**
- `POST /plans/:planId/coas` - Create COA (updates workflow COA count)
- `GET /plans/:planId/coas` - Get COAs for plan
- `POST /plans/:planId/coas/:coaId/select` - Select COA (updates workflow)

**AI Agents:**
- `POST /plans/:planId/coas/generate` - Generate COAs via AI
- `POST /plans/:planId/red-team` - Run red team simulation
- `POST /plans/:planId/coas/compare` - Compare COAs via AI

**ROE:**
- `GET /missions/:missionId/roe` - Get ROE rules for mission
- `POST /missions/:missionId/roe` - Create ROE rule (invalidates cache)
- `POST /roe/check` - Check action against ROE (logs to audit)
- `POST /roe/override` - Request ROE override

**Documents:**
- `GET /plans/:id/documents/opord.docx` - Generate OPORD DOCX
- `GET /plans/:id/documents/opord.pdf` - Generate OPORD PDF
- `GET /plans/:id/documents/briefing.pptx` - Generate briefing slides
- `GET /plans/:id/documents/sync-matrix` - Generate sync matrix
- `GET /plans/:id/documents/dst` - Generate DST
- `GET /plans/:id/documents/ccir` - Generate CCIR

**Graphics:**
- `GET /plans/:id/graphics` - Get operational graphics overlay
- `GET /plans/:id/graphics/geojson` - Get graphics as GeoJSON

**Versions:**
- `GET /plans/:id/versions` - Get plan version history

## Key Implementation Details

### Graphics Generation Algorithm
1. Extract phases from `plan.execution.conceptOfOperations.phases`
2. Generate phase lines distributed across AO latitude
3. Extract tasks from selected COA
4. Distribute objectives in grid pattern
5. Generate axis of advance from decisive operation
6. Create engagement areas from high-risk enemy threats
7. Calculate bounding box from all geometries

### Symbol Rendering
- Uses milsymbol library for MIL-STD-2525D compliance
- Renders symbols to data URL for embedding in GeoJSON properties
- Supports unique designation and staff comments

### API Integration
- Express 5.x parameter type assertions (`as string`)
- Zod schema validation on all inputs
- Automatic workflow updates on COA operations
- ROE cache invalidation on rule changes

## Files Changed

| File | Change | Purpose |
|------|--------|---------|
| `backend/src/planning/graphics/symbol-renderer.ts` | Created | MIL-STD-2525D symbol rendering |
| `backend/src/planning/graphics/operational-graphics.ts` | Created | Graphics generation from plan data |
| `backend/src/planning/graphics/index.ts` | Created | Module exports |
| `backend/src/api/planning.ts` | Created | Comprehensive planning REST API |
| `backend/src/planning/documents/index.ts` | Modified | Export OPORD generators |
| `backend/src/index.ts` | Modified | Mount planning router |

## Technical Decisions

### MIL-STD-2525D SIDC Format
```
G*GPGPO---****X
│ │││ │
│ │││ └── Version: X (any)
│ │││
│ │└└──── Modifier: ****
│ │
│ └────── Function: PO (Point/Objective)
│
└──────── Schema: G (Tactical Graphics)
```

### GeoJSON Structure
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "id": "OBJ-1",
    "geometry": { "type": "Point", "coordinates": [lng, lat] },
    "properties": {
      "name": "OBJ Alpha",
      "sidc": "G*GPGPO---****X",
      "symbolDataUrl": "data:image/svg+xml;base64,..."
    }
  }]
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 05 Plan 10 establishes:
- Graphics generation infrastructure for map overlays
- Complete REST API for operational planning features
- Foundation for planning UI components (05-11, 05-12)

Ready for:
- Planning UI wizard and dashboard
- Real-time collaborative editing
- Map integration with operational graphics
