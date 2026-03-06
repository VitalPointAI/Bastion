---
phase: quick-9
plan: 01
subsystem: exercise-positions
tags: [exercise, positions, phase-mapping, roster, training]
dependency_graph:
  requires: [problem-sets, exercise-scenarios]
  provides: [exercise-positions-api, team-roster-ui, position-seed-script]
  affects: [understand-tab, problem-sets-api]
tech_stack:
  added: []
  patterns: [position-store, position-service, side-grouped-ui]
key_files:
  created:
    - backend/src/db/migrations/025-exercise-positions.sql
    - backend/src/exercise/position-types.ts
    - backend/src/exercise/position-store.ts
    - frontend/src/lib/position-service.ts
    - frontend/src/components/exercise/TeamRoster.tsx
    - frontend/src/components/exercise/TeamRoster.css
    - scripts/seed-positions.ts
  modified:
    - backend/src/api/problem-sets.ts
    - frontend/src/components/tabs/UnderstandTab.tsx
decisions:
  - Full replacement strategy for phase mappings (DELETE+INSERT) rather than per-mapping CRUD
  - AWC template hardcoded in both TeamRoster component and seed script for independence
  - Position form uses inline editing pattern rather than modal dialog
metrics:
  duration: 9 min
  completed: "2026-03-06T12:38:00Z"
---

# Quick Task 9: Custom Exercise Positions with Phase-Transition Mapping Summary

Flexible per-exercise position roster with side grouping (blue/red/neutral/green), phase-transition mapping, and AWC template loading via bulk API and standalone seed script.

## What Was Built

### Backend (Task 1)
- **Database schema**: Two tables (`exercise_positions`, `exercise_position_phase_mappings`) with CASCADE deletes, proper indexes, and side CHECK constraint
- **Position types**: TypeScript interfaces for ExercisePosition, PositionPhaseMapping, CreatePositionInput, UpdatePositionInput
- **PositionStore**: Full CRUD following ScenarioStore pattern, plus `setPhaseMappings` (full replacement), `bulkCreate`, and eager-loaded `findByProblemSet`
- **6 API endpoints** added to problem-sets.ts router with zod validation:
  - `GET /:id/positions` - List with phase mappings
  - `POST /:id/positions` - Create single
  - `PATCH /:id/positions/:positionId` - Update
  - `DELETE /:id/positions/:positionId` - Delete (204)
  - `PUT /:id/positions/:positionId/phase-mappings` - Replace mappings
  - `POST /:id/positions/bulk` - Bulk create for template loading

### Frontend (Task 2)
- **PositionService**: API client mirroring ProblemSetService pattern with full CRUD, phase mapping, and bulk operations
- **TeamRoster component**: Side-grouped collapsible sections with color coding, inline edit form with title/duties/side/assignedTo/sortOrder fields, expandable phase mapping editor per exercise phase, delete confirmation, and "Load Template" button
- **AWC position template**: 22 positions (7 neutral, 7 blue, 8 red) with 18 phase mappings hardcoded as component constant
- **UnderstandTab integration**: "Team Roster" sidebar item visible in training mode, with mode-switch reset handling

### Seed Script (Task 3)
- **scripts/seed-positions.ts**: Standalone script (`npx tsx scripts/seed-positions.ts <problemSetId>`) that loads the full AWC "A Way" template using transactional INSERT, logs position counts by side and total phase mappings

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Backend TypeScript compiles cleanly
- Frontend TypeScript compiles cleanly
- Migration SQL is syntactically correct (tables could not be created locally due to missing prerequisite `problem_sets` table in local dev DB)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 9c94f60 | DB schema, types, store, and API endpoints |
| 2 | 235a729 | TeamRoster UI, position service, Understand tab integration |
| 3 | 58789c1 | AWC position template seed script |

## Self-Check: PASSED

All 8 created/modified files verified present. All 3 task commits verified in git log.
