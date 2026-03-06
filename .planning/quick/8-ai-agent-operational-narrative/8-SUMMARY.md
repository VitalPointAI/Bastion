---
phase: quick-8
plan: 1
subsystem: design-ai
tags: [ai-agent, narrative-synthesis, operational-design, design-tab]
dependency-graph:
  requires: [cog-analysis-agent, loe-gap-analysis-agent, design-api]
  provides: [narrative-synthesis-agent, operational-approach-ai-panel]
  affects: [design-tab, operational-approach-section]
tech-stack:
  added: []
  patterns: [rule-based-agent, ai-panel-integration, section-renderer]
key-files:
  created:
    - backend/src/agents/narrative-synthesis.ts
  modified:
    - backend/src/api/design.ts
    - frontend/src/components/design/OperationalApproachSection.tsx
    - frontend/src/components/design/DesignAIPanel.tsx
decisions:
  - Rule-based v1 agent (no LLM call) matching existing cog-analysis and loe-gap-analysis pattern
  - Two draft variants: objective-focused (primary) and phasing-focused (alternative)
  - Apply callback inserts full narrative text into textarea, triggering auto-save via updateApproach
metrics:
  duration: 8 min
  completed: "2026-03-06"
---

# Quick Task 8: AI Agent Operational Narrative Summary

Rule-based narrative synthesis agent that drafts operational narratives from all design data (problem framing, CoG, LOEs, phases, decision points) with frontend AI panel integration in OperationalApproachSection.

## What Was Built

### Backend: Narrative Synthesis Agent
- **narrative-synthesis.ts**: New agent following the exact pattern of `cog-analysis.ts` and `loe-gap-analysis.ts`
- Exports `synthesizeNarrative()` function and `NarrativeSynthesisOutput` type
- Takes full design context (problem framing, CoG analysis, LOEs, operational approach)
- Generates 2 draft narratives:
  - **Draft 1 (objective-focused)**: Opens with problem statement/end state, then CoG, LOEs, phasing, decision points
  - **Draft 2 (phasing-focused)**: Leads with temporal flow, integrating LOE activities per phase
- Calculates `completenessScore` (0-1) based on how many of 5 sections have substantive data
- Conservative confidence: 0.5 base with bounds {0.3, 0.7} per INVARIANT 5

### Backend: Analyze Endpoint Extension
- Added `operational-approach` case to `POST /api/design/:problemSetId/analyze`
- Fetches full design data from store (needs all sections for synthesis)
- Calls `synthesizeNarrative()` and returns output

### Frontend: DesignAIPanel Extension
- Added `NarrativeDraft` interface mirroring backend output
- Added `onApplyNarrative` prop to `DesignAIPanelProps`
- Added `renderOperationalApproachResults()` function:
  - ScoreBar for Design Completeness
  - Synthesis notes showing what data was used/missing
  - Draft cards with confidence badge, section previews (100 char), Apply/Dismiss buttons
- Added `operational-approach` to the results area JSX and unsupported section guard

### Frontend: OperationalApproachSection Integration
- Imported `DesignAIPanel` component
- Added `aiPanelOpen` state
- Added `handleApplyNarrative` callback that sets narrative via `updateApproach` (triggers auto-save)
- Wrapped existing JSX in flex layout (`<div className="flex gap-0">`) matching CoGAnalysisSection pattern
- Passes `activeSection="operational-approach"` and full design data to panel

## Verification

- TypeScript compilation: Zero errors in both frontend (`tsc --noEmit` via project config) and backend (no errors in modified files)
- All 4 design sections now handled by analyze endpoint (problem-framing, cog-analysis, lines-of-effort, operational-approach)
- Apply flow: clicking Apply on a draft calls `onApplyNarrative` -> `updateApproach` -> sets narrative -> triggers debounced auto-save

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create narrative synthesis backend agent and wire analyze endpoint | 2040201 | backend/src/agents/narrative-synthesis.ts, backend/src/api/design.ts |
| 2 | Add AI panel to OperationalApproachSection and render narrative results | c4ea4db | frontend/src/components/design/OperationalApproachSection.tsx, frontend/src/components/design/DesignAIPanel.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All 4 files verified present. Both commit hashes (2040201, c4ea4db) confirmed in git log.
