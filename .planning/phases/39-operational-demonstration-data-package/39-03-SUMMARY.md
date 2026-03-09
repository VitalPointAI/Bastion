---
phase: 39-operational-demonstration-data-package
plan: 03
subsystem: scripts, database
tags: [seed-data, bash, documents, operational-design, jp5-0, exercise-api, design-api]

requires:
  - phase: 39-operational-demonstration-data-package
    provides: "Foundation seed scripts (problem sets, units, cleanup, orchestrator) from plan 01"
  - phase: 25-operational-design-workspace
    provides: "Design API (PATCH /api/design/:psId/:section) and operational design types"
  - phase: 14-friendly-adversary-ipb-complete-cycle
    provides: "Exercise API document upload endpoint (POST /scenarios/:id/upload)"

provides:
  - "10-document manifest mapping scenario/ PDFs/DOCX to DEMO problem sets"
  - "Document upload seed script using exercise API multipart upload"
  - "Theater-level (INDOPACOM) operational design with all 4 JP 5-0 sections"
  - "Component-level (CJTF-WestPac) operational design with all 4 JP 5-0 sections"
  - "Operational design seed script using design API PATCH per section"

affects: [39-05, 39-06]

tech-stack:
  added: []
  patterns:
    - "Multipart document upload via curl to exercise API with tags JSON"
    - "Design section seeding via PATCH per section with JSON fixture extraction"
    - "Document manifest pattern: JSON array mapping source files to problem sets with metadata"

key-files:
  created:
    - scripts/seed-documents.sh
    - scripts/demo-data/documents/document-manifest.json
    - scripts/seed-design.sh
    - scripts/demo-data/design/theater-design.json
    - scripts/demo-data/design/component-design.json
  modified: []

key-decisions:
  - "Selected 10 documents spanning blue team, red team, and scenario phases for balanced coverage"
  - "Used exercise API multipart upload (not direct psql) because documents need NLP extraction pipeline"
  - "Created scenario entries per problem set when needed (exercise_scenarios FK required for uploads)"
  - "Design fixtures match TypeScript types exactly (ProblemFramingData, CoGAnalysis, LineOfEffort, OperationalApproach)"
  - "COG analysis uses Strange's CG-CC-CR-CV model with realistic military analysis at both echelons"

patterns-established:
  - "Document manifest: JSON array with id, filename, sourcePath, problemSetId, team, phase, docType"
  - "Design fixture: JSON matching OperationalDesign TypeScript interface sections"
  - "Section seeding: extract section from fixture JSON, PATCH via curl to design API"

requirements-completed: [DEMO-03, DEMO-04]

duration: 7min
completed: 2026-03-09
---

# Phase 39 Plan 03: Documents and Operational Design Summary

**10-document upload manifest with exercise API integration, plus theater and component JP 5-0 operational design content covering problem framing, COG analysis, LOE/LOO, and operational approach**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-09T02:32:18Z
- **Completed:** 2026-03-09T02:39:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created 10-document manifest mapping real scenario/ files (PDFs, DOCX, PPTX) to DEMO problem sets with team/phase/docType metadata
- Built seed-documents.sh with exercise API multipart upload, automatic scenario creation, idempotent skip-if-exists logic, and 120s timeout for extraction
- Created comprehensive theater-level INDOPACOM design covering deterrence of PRC coercion against Taiwan with all 4 JP 5-0 sections
- Created component-level CJTF-WestPac design covering cross-strait denial operations with COG trees, 4 LOEs, and 4-phase operational approach
- Both design fixtures follow Strange's CG-CC-CR-CV model with realistic critical capabilities, requirements, and vulnerabilities

## Task Commits

Each task was committed atomically:

1. **Task 1: Create document upload seed script with scenario PDF manifest** - `8405553` (feat)
2. **Task 2: Create operational design seed script with Design tab content** - `dc2b95e` (feat)

## Files Created/Modified
- `scripts/seed-documents.sh` - Document upload via exercise API with multipart/form-data
- `scripts/demo-data/documents/document-manifest.json` - 10 documents mapped to problem sets with metadata
- `scripts/seed-design.sh` - Operational design seeding via PATCH per section
- `scripts/demo-data/design/theater-design.json` - INDOPACOM theater design (problem framing, COG, 4 LOEs, 5-phase approach)
- `scripts/demo-data/design/component-design.json` - CJTF-WestPac component design (tactical COG, 4 LOEs, 4-phase approach)

## Decisions Made
- Selected 10 documents (3 blue team, 3 red team, 3 scenario, 1 strategic directive) for balanced coverage across teams and phases
- Used exercise API for document upload rather than direct psql because documents need the NLP extraction pipeline (DocumentParser + ExtractionService)
- Design fixtures typed to match the exact TypeScript interfaces in backend/src/design/types.ts
- Theater design covers Shape/Deter/Seize Initiative/Dominate/Stabilize phasing; component covers Alert & Deploy/Seize Initiative/Dominate/Conflict Termination
- COG analysis includes adversary critical vulnerability of concentrated embarkation points and civilian fleet dependency — key targeting insights for demo narrative

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Document manifest ready for upload when backend is running (seed-documents.sh)
- Design content ready for PATCH calls when backend is running (seed-design.sh)
- Plan 05 (AI agent outputs) can reference uploaded documents for pre-computed analysis results
- Master orchestrator (seed-demo.sh) has placeholder slots for both new scripts

---
*Phase: 39-operational-demonstration-data-package*
*Completed: 2026-03-09*
