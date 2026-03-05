---
phase: 21-ai-cop-layer-agent-team
plan: 04
subsystem: svg, rendering, milsymbol
tags: [sidc, milstd2525d, milsymbol, svg, annotation, langchain, sanitizer]

# Dependency graph
requires:
  - phase: 21-01
    provides: SVG sanitizer, layer-types with COPSymbolSpec/COPControlMeasureSpec/COPAnnotationSpec
provides:
  - Deterministic MIL-STD-2525D SIDC code builder (buildSIDC, buildSIDCFromEntity)
  - milsymbol render data converter (buildSymbolRenderData)
  - Control measure render data with type-specific styles
  - Movement path render data for phase animation
  - LLM-generated SVG annotation fragments with sanitization pipeline
affects: [21-05, 21-06, 21-07, 21-08, 21-09]

# Tech tracking
tech-stack:
  added: []
  patterns: [deterministic-sidc-generation, milsymbol-render-data-shape, llm-svg-with-sanitization]

key-files:
  created:
    - backend/src/cop/svg/sidc-builder.ts
    - backend/src/cop/svg/sidc-builder.test.ts
    - backend/src/cop/svg/svg-spec-builder.ts
    - backend/src/cop/svg/svg-fragment-generator.ts

key-decisions:
  - "SIDC codes built deterministically from lookup maps, never by LLM"
  - "Used LLM factory createLLMForAgent with cop-annotation-generator agent ID for SVG fragment generation"
  - "Belt-and-suspenders sanitization: sanitizeSVG first, then validateSVGSafety logging for defense in depth"

patterns-established:
  - "SIDC builder: lookup maps for all MIL-STD-2525D fields with buildSIDCFromEntity convenience wrapper"
  - "Render data shape: SymbolRenderData with milsymbol options (size=35, uniqueDesignation, additionalInformation)"
  - "LLM SVG generation: system prompt constrains output, stripCodeFences cleans response, sanitize + validate"

requirements-completed: [SIDC-GENERATION, SVG-HYBRID-RENDERING]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 21 Plan 04: SVG Generation Pipeline Summary

**Deterministic MIL-STD-2525D SIDC builder with 20 entity codes, milsymbol render data converter, and LLM annotation fragment generator with sanitization pipeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T19:50:43Z
- **Completed:** 2026-03-05T19:54:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SIDC builder produces valid 20-digit MIL-STD-2525D codes deterministically from 6 lookup maps (identity, symbol set, status, HQ/TF/FD, echelon, entity codes with 20 types)
- SVG spec builder converts COPSymbolSpec to milsymbol-renderable SymbolRenderData, COPControlMeasureSpec to styled Leaflet data, and movement paths to phase-keyed animation arrays
- LLM fragment generator produces custom SVG annotations via ChatAnthropic with strict system prompt, code fence stripping, and belt-and-suspenders sanitization
- 13 tests pass for SIDC builder covering all identity, symbol set, and echelon combinations

## Task Commits

Each task was committed atomically:

1. **Task 1: Deterministic SIDC builder** - `bf40316` (test:RED), `2c977df` (feat:GREEN)
2. **Task 2: SVG spec builder and LLM fragment generator** - `420fe1c` (feat)

## Files Created/Modified
- `backend/src/cop/svg/sidc-builder.ts` - Deterministic MIL-STD-2525D 20-character SIDC code generator
- `backend/src/cop/svg/sidc-builder.test.ts` - 13 tests for buildSIDC and buildSIDCFromEntity
- `backend/src/cop/svg/svg-spec-builder.ts` - Converts COP specs to milsymbol/Leaflet render data
- `backend/src/cop/svg/svg-fragment-generator.ts` - LLM-generated SVG annotations with sanitization

## Decisions Made
- **Deterministic SIDC only**: SIDC codes are always built from lookup maps, never from LLM output. This ensures MIL-STD-2525D compliance without hallucination risk.
- **LLM factory integration**: Used project's existing `createLLMForAgent` with `cop-annotation-generator` agent ID rather than direct ChatAnthropic instantiation. This respects the project's provider-agnostic LLM configuration.
- **Defense in depth for LLM SVG**: Applied sanitizeSVG (enforcement) first, then validateSVGSafety (detection/logging) for belt-and-suspenders security on LLM-generated SVG fragments.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SIDC builder ready for use by layer generation agents (21-05, 21-06)
- SVG spec builder ready for frontend rendering pipeline
- Fragment generator ready for custom annotation requests
- All exported interfaces match the type contracts from 21-01

## Self-Check: PASSED

All 4 created files verified on disk. All 3 task commits verified in git log.

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
