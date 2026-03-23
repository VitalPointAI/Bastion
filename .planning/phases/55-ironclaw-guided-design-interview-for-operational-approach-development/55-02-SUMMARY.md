---
phase: 55-ironclaw-guided-design-interview-for-operational-approach-development
plan: 02
subsystem: skills
tags: [langchain, svg, zod, design-skills, ironclaw, visualization, resource-registry]

requires:
  - phase: 25-operational-design-workspace
    provides: OperationalDesign types — OperationalApproach, LineOfEffort, CoGAnalysis
  - phase: 27-resource-registry
    provides: ResourceRegistry.getAllResources() for force availability queries
  - phase: 55-01
    provides: Ironclaw design interview skill infrastructure

provides:
  - "4 design skill .md definitions: overlay-producer, resource-allocator, campaign-visualizer, risk-visualizer"
  - "design-skills.ts: createDesignTools() factory returning 4 DynamicStructuredTool instances"
  - "skill-handler-registry.ts: design skills registered in initializeBuiltinHandlers() fast path"
  - "SVG visualization engine for operational approach overlays, placemats, and risk matrices"

affects:
  - ironclaw-guided-design-interview
  - skill-loader
  - cop-resource-layer
  - skill-handler-registry

tech-stack:
  added: []
  patterns:
    - "Design skill .md: follows exact tactical/assess-threat.md YAML frontmatter format with skillId, name, category, inputSchema, outputSchema, systemPromptFragment, handler"
    - "createDesignTools() factory: matches createTacticalTools() pattern — DynamicStructuredTool array registered via handler map"
    - "SVG generation: template string SVG construction (no DOM), 800x600 viewBox for Leaflet overlays, 1200x850 for placemats, 600x600 for risk matrices"
    - "Risk inference: when no explicit risks provided, infer from decision point criteria and phase transitions as heuristic fallback"

key-files:
  created:
    - backend/src/skills/design/overlay-producer.md
    - backend/src/skills/design/resource-allocator.md
    - backend/src/skills/design/campaign-visualizer.md
    - backend/src/skills/design/risk-visualizer.md
    - backend/src/skills/design-skills.ts
  modified:
    - backend/src/skills/skill-handler-registry.ts

key-decisions:
  - "SVG template strings (no D3/DOM): server-side SVG generation requires no browser globals — pure string construction is portable and lightweight"
  - "resource_allocator uses ResourceRegistry.getAllResources() not queryByCapability(): the registry lacks a queryByCapability method; getAllResources() + category filtering achieves the same result"
  - "Risk inference fallback: risk-visualizer infers risks from transitions and decision points when none explicitly provided — prevents empty visualizations during early design"
  - "designToolHandlerMap at module scope: matches pattern of navToolHandlerMap and tacToolHandlerMap — all maps defined outside initializeBuiltinHandlers() for readability"

patterns-established:
  - "Design skill handlers: all produce JSON.stringify output, matching skill executor contract"
  - "SVG layer separation: overlay_producer returns both combined SVG and per-layer SVGs for COP layer toggling"
  - "Campaign placemat dual output: markdown_spec field provides image-AI generation instructions alongside SVG for polished final products"

requirements-completed: []

duration: 15min
completed: 2026-03-23
---

# Phase 55 Plan 02: Design Skills (overlay-producer, resource-allocator, campaign-visualizer, risk-visualizer) Summary

**4 Ironclaw design skills with SVG visualization handlers registered in initializeBuiltinHandlers() fast path — enabling map overlays, force allocation analysis, campaign placemats, and risk matrices from operational design artifacts**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-23T22:05:00Z
- **Completed:** 2026-03-23T22:18:09Z
- **Tasks:** 2 of 2
- **Files modified:** 6 (4 created .md, 1 created .ts, 1 modified .ts)

## Accomplishments
- 4 skill .md definitions in `backend/src/skills/design/` following exact canonical format from `tactical/assess-threat.md`
- `createDesignTools()` factory in `design-skills.ts` returns 4 `DynamicStructuredTool` instances with full Zod schemas
- SVG visualization engine: overlay maps (800x600, phase bands + LOE arrows + DP markers), campaign placemats (1200x850, CoG tree + LOE swimlanes + phase timeline), risk matrix (5x5 probability/impact grid), timeline and heatmap variants
- `resource_allocator` queries live `ResourceRegistry.getAllResources()`, groups by category, computes FMC counts per phase, surfaces shortfalls
- All 4 handlers registered in `initializeBuiltinHandlers()` via `designToolHandlerMap` — no dynamic LLM fallback

## Task Commits

1. **Task 1: Create 4 design skill .md definitions** - `daaa1258` (feat)
2. **Task 2: Create design-skills.ts handlers and register in skill-handler-registry** - `390ed0bc` (feat)

## Files Created/Modified
- `backend/src/skills/design/overlay-producer.md` - Skill definition for SVG operational approach map overlays
- `backend/src/skills/design/resource-allocator.md` - Skill definition for force-to-phase allocation and shortfall analysis
- `backend/src/skills/design/campaign-visualizer.md` - Skill definition for one-page campaign placemat visuals
- `backend/src/skills/design/risk-visualizer.md` - Skill definition for risk matrix/timeline/heatmap visualizations
- `backend/src/skills/design-skills.ts` - LangChain DynamicStructuredTool handlers for all 4 skills, exports createDesignTools()
- `backend/src/skills/skill-handler-registry.ts` - Added createDesignTools import, designToolHandlerMap, design tool registration block in initializeBuiltinHandlers()

## Decisions Made
- `resource_allocator` uses `registry.getAllResources()` instead of `queryByCapability()` because the ResourceRegistry does not expose a `queryByCapability` method — `getAllResources()` with category filtering achieves equivalent results
- SVG generation uses template string construction (no D3, no JSDOM) — server-side friendly, zero additional dependencies
- `risk_visualizer` infers risks from decision point criteria and transitions when no explicit risks array is provided — prevents empty outputs during early design iteration
- `z.record(z.string(), z.unknown())` required for Zod v4 compatibility (single-arg `z.record()` removed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 z.record() API incompatibility**
- **Found during:** Task 2 (TypeScript compilation of design-skills.ts)
- **Issue:** `z.record(z.unknown())` fails in Zod v4 — requires explicit key schema as first argument
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** backend/src/skills/design-skills.ts
- **Verification:** `npx tsc --noEmit` passes with 0 source errors
- **Committed in:** 390ed0bc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — Zod API version compatibility)
**Impact on plan:** Minimal. Single-line fix required for TypeScript compilation. No scope impact.

## Issues Encountered
- ResourceRegistry does not expose `queryByCapability()` despite the PLAN.md interface snippet suggesting it. Used `getAllResources()` + client-side filtering as equivalent alternative. No behavioral difference in output.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 design skills are registered and available to Ironclaw via the fast-path handler registry
- skill-loader will find .md files in `backend/src/skills/design/` on startup
- SVG outputs from overlay_producer and campaign_visualizer are ready for COP layer rendering
- resource_allocator will return real data as soon as resources are onboarded to the Resource Registry
- Phase 55-03 can build on these skills for the guided interview flow

## Self-Check: PASSED
- All 4 .md skill files confirmed on disk
- design-skills.ts confirmed on disk
- Commits daaa1258 and 390ed0bc confirmed in git log

---
*Phase: 55-ironclaw-guided-design-interview-for-operational-approach-development*
*Completed: 2026-03-23*
