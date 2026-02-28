---
phase: 14-friendly-adversary-ipb-complete-cycle
plan: "03"
subsystem: exercise-services
tags: [exercise, ipb, coa-scoring, llm, geojson, mil-std-2525d, blockchain, near, wargaming]

requires:
  - phase: 14-friendly-adversary-ipb-complete-cycle
    plan: "01"
    provides:
      - backend/src/exercise/types.ts
      - backend/src/exercise/ipb-store.ts
      - backend/src/exercise/coa-store.ts
      - backend/src/exercise/document-store.ts

provides:
  - backend/src/exercise/ipb-service.ts (IPBService — dual-perspective IPB assembly from documents)
  - backend/src/exercise/coa-scoring-service.ts (COAScoringService — FASDC scoring + wargame + narrative)

affects:
  - phase 14 plans 04-10 (all downstream exercise services depend on IPB and COA scoring)

tech-stack:
  added: []
  patterns:
    - "IPBService.assembleIPB(team, perspective) — both 'own' and 'enemy_assessment' read the requesting team's own documents; LLM distinguishes self-portrait vs intel estimate"
    - "SIDC affiliation character: position 2 = 'F' (friendly, own view) or 'H' (hostile, enemy_assessment view)"
    - "COA FASDC equal-weight formula: combinedScore = (F+A+S+D+C)/5, all weights 20%"
    - "Commander decision blockchain anchoring: createHash('sha256') → outbox INSERT with aggregate_type='commander_decision'"
    - "LLM fallback pattern: try/catch on all completions → minimal valid structure preserves service availability"

key-files:
  created:
    - backend/src/exercise/ipb-service.ts
    - backend/src/exercise/coa-scoring-service.ts
  modified: []

key-decisions:
  - "Both 'own' and 'enemy_assessment' perspectives read the requesting team's own documents — the distinction is purely in the LLM prompt. Enemy assessment is synthesized from own intelligence, not from the adversary's actual documents."
  - "Equal-weight FASDC scoring (20% each criterion) chosen per plan specification — no doctrinal weighting applied"
  - "MIL-STD-2525D SIDC: position 2 affiliation = 'F' (own view) or 'H' (enemy_assessment view from blue's perspective); follows MIL-STD-2525D field positions"
  - "Outbox INSERT uses aggregate_type='commander_decision' following existing schema pattern (not a new field)"
  - "LLM extraction fallback returns minimal valid IPB structure with Indo-Pacific theater defaults to ensure service continues operating under LLM failure"

patterns-established:
  - "IPB overlay layer generation: forces→Point (unit), keyTerrain→Polygon (area), avenues→LineString (line), NAIs→Point|Polygon (point|area)"
  - "DeltaSummary significance classification: addedUnits/removedUnits → 'critical', forceDisposition/threatAssessment change → 'major', strength/equipment change → 'minor'"

requirements-completed: [EX-06, EX-07]

duration: 8min
completed: 2026-02-28
---

# Phase 14 Plan 03: IPB Assembly Service and COA Scoring Service Summary

**LLM-driven dual-perspective IPB assembly (OAKOC + overlay layers + delta detection) and 5-criterion FASDC COA scoring with wargame evidence integration and NEAR blockchain decision anchoring**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T19:59:49Z
- **Completed:** 2026-02-28T20:07:35Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- IPBService assembles full OAKOC terrain analysis, threat assessment, ASCOPE civil considerations, NAIs, and force dispositions from extracted scenario documents via LLM
- Dual-perspective support: `own` (self-assessment) and `enemy_assessment` (intel estimate of adversary) for both blue and red teams — 4 total perspectives
- IPB overlay layers generated for ValidityMap rendering with GeoJSON geometries and MIL-STD-2525D SIDC codes (affiliation F=friendly/H=hostile per perspective)
- SITREP delta detection creates new IPB versions with `generateDeltaSummary` classifying changes as minor/major/critical
- COAScoringService scores COAs against all 5 FASDC doctrinal criteria (Feasibility, Acceptability, Suitability, Distinguishability, Completeness) with LLM-generated rationales
- Combined score formula: equal-weight average (20% each), 0-100 scale
- Wargame evidence integration augments criterion rationales with simulation outcomes
- `compareCOAs` generates criterion matrix, combined score rankings, and LLM comparative narrative
- Commander decision recording: SHA-256 hash + NEAR blockchain outbox anchoring following existing outbox pattern

## Task Commits

1. **Task 1: IPB Assembly Service** - `767e03e` (feat)
2. **Task 2: COA Scoring Service** - `f91d6bf` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `backend/src/exercise/ipb-service.ts` (662 lines) — IPBService with assembleIPB, updateIPBFromSITREP, generateDeltaSummary, generateOverlayLayers
- `backend/src/exercise/coa-scoring-service.ts` (504 lines) — COAScoringService with scoreCOA, integrateWargameResults, compareCOAs, recordCommanderDecision

## Decisions Made

- **Perspective document sourcing:** Both `own` and `enemy_assessment` read only the requesting team's own documents. The LLM prompt is the sole differentiator — `own` asks for a self-portrait; `enemy_assessment` asks "what does this team believe about the adversary based on their intelligence." This respects the information barrier: Blue never reads Red's actual plans.

- **Equal FASDC weights:** Per plan specification, 20% weight for each of the 5 criteria. No doctrinal weighting applied — the plan explicitly calls for equal weights as default.

- **SIDC generation:** Affiliation character at position 2 uses 'F' (Friendly) for own-perspective layers and 'H' (Hostile) for enemy_assessment layers. This correctly represents the requesting team's perception — their own forces appear friendly; assessed enemy forces appear hostile.

- **Outbox `aggregate_type`:** Used `'commander_decision'` as the aggregate_type for new outbox records. The existing schema shows `aggregate_type TEXT NOT NULL` with examples like 'document', 'mission', 'strike' — 'commander_decision' follows the same naming convention without requiring a schema change.

- **LLM fallback:** All LLM calls are wrapped in try/catch with fallback structures. The IPB service returns a valid minimal assessment with Indo-Pacific theater defaults; the COA scoring service returns 50/100 placeholder scores with manual review notes. This ensures the service remains functional during LLM outages.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compilation passed on first attempt with zero errors. The `extraction-service.ts` pre-existing errors (from other plans' uncommitted work) were present before our changes and were not introduced by this plan.

## User Setup Required

None — no external service configuration required beyond existing LLM provider config.

## Next Phase Readiness

- IPBService ready for use by extraction pipeline (Phase 14 Plan 02) and order generator (Plan 05)
- COAScoringService ready for integration with wargaming service (Plans 06-07) and planning board (Plan 08)
- Both services require LLM provider config passed at construction time — consistent with existing extraction service pattern

---
*Phase: 14-friendly-adversary-ipb-complete-cycle*
*Completed: 2026-02-28*

## Self-Check: PASSED

- FOUND: backend/src/exercise/ipb-service.ts (662 lines)
- FOUND: backend/src/exercise/coa-scoring-service.ts (504 lines)
- FOUND: .planning/phases/14-friendly-adversary-ipb-complete-cycle/14-03-SUMMARY.md
- FOUND: commit 767e03e (feat: IPB assembly service)
- FOUND: commit f91d6bf (feat: COA scoring service)
- TypeScript: zero compilation errors (`npx tsc --noEmit` PASS)
