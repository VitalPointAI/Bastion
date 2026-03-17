---
phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
plan: "02"
subsystem: plan-tab / design-tab
tags: [design-sync, jpp, design-context-panel, read-only-integration, ux]
dependency_graph:
  requires: []
  provides: [DesignContextPanel, DesignSyncIndicator, design-auto-sync-to-plan]
  affects: [MissionAnalysis, COADevelopment, PlanOrderDevelopment, DesignOverview, OperationalApproachSection]
tech_stack:
  added: []
  patterns: [fetch-on-render, read-only-context-panel, design-to-plan-auto-sync]
key_files:
  created:
    - frontend/src/components/plan/DesignContextPanel.tsx
    - frontend/src/components/plan/DesignContextPanel.css
    - frontend/src/components/design/DesignSyncIndicator.tsx
  modified:
    - frontend/src/components/plan/MissionAnalysis.tsx
    - frontend/src/components/plan/COADevelopment.tsx
    - frontend/src/components/plan/PlanOrderDevelopment.tsx
    - frontend/src/components/design/DesignOverview.tsx
    - frontend/src/components/design/OperationalApproachSection.tsx
decisions:
  - Used `linesOfEffort` key (not `loeTimeline` from plan context) matching actual DesignStatus type
  - Preserved designService.pushHandoff() method for backward compat; removed UI trigger only
  - DesignSyncIndicator uses arrow-flow visual (not dots) to distinguish from DesignStatusBadge
metrics:
  duration: ~18 min
  completed: "2026-03-17"
  tasks_completed: 2
  files_created: 3
  files_modified: 5
---

# Phase 49 Plan 02: DesignContextPanel + Design Auto-Sync to JPP Steps Summary

**One-liner:** Blue-tinted read-only DesignContextPanel wired into JPP Steps 2/3/7 via fetch-on-render; DesignSyncIndicator added to Design overview; manual "Push to Plan" button removed.

## What Was Built

### DesignContextPanel (new component)

Reusable read-only panel that renders Design tab artifacts inside JPP steps with a blue tint (`rgba(30, 58, 138, 0.15)`) and lock icon to visually signal the content is sourced from the Design tab and is not editable in the Plan tab.

Supports 4 artifact types:
- `problem-statement` — renders problem statement text paragraph
- `cog-analysis` — renders friendly/adversary CoG trees with CC/CR/CV children in labeled sections
- `lines-of-effort` — numbered list with LOE name and description
- `phases` — ordered list of phase names with descriptions and transition conditions

Handles all states: empty (not-started), loading (skeleton pulse animation), in-progress (amber notice), and complete.

Footer includes a disabled "Propose Revision" button placeholder with tooltip "Coming soon" (Plan 04 will enable it).

### DesignSyncIndicator (new component)

Shows which Design sections flow to which Plan tab JPP steps using arrow-flow visual language (not dots, to avoid confusion with DesignStatusBadge). Four rows:
- Problem Framing → Plan Step 2: Mission Analysis
- CoG Analysis → Plan Step 2: Mission Analysis
- Lines of Effort → Plan Step 3: COA Development
- Operational Approach → Plan Step 7: Plan/Order Development

Each row shows the section status as color-coded text (green for complete, amber for in-progress, gray for not-started).

### JPP Step Wiring

**MissionAnalysis (Step 2):** Fetches `designService.getDesign()` + `designService.getStatus()` on mount (parallel with Promise.all). Two DesignContextPanels rendered at the top: Problem Statement and CoG Analysis.

**COADevelopment (Step 3):** Extended existing design fetch to also fetch status. Added DesignContextPanel for Lines of Effort at the top as a read-only reference panel; existing editable LOE sections remain below for COA development work.

**PlanOrderDevelopment (Step 7):** Fetches design data on mount. DesignContextPanel for Operational Phases & Transitions rendered before the Five-Paragraph Order sections.

### Design Overview

DesignSyncIndicator added below the DesignProgressBar in DesignOverview with section heading "Plan Tab Sync Status" and explanatory text.

### Push-to-Plan Button Removed

Removed the "Design-to-Plan Handoff" section from OperationalApproachSection.tsx (HandoffState type, state variables, handlePushHandoff function, and UI block). The `designService.pushHandoff()` method is preserved in the service layer for backward compatibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected loeTimeline → linesOfEffort**
- **Found during:** Task 2
- **Issue:** Plan context showed `designStatus?.loeTimeline` but the actual `DesignStatus` type uses `linesOfEffort` as the key
- **Fix:** Used correct key `linesOfEffort` in COADevelopment DesignContextPanel props
- **Files modified:** `frontend/src/components/plan/COADevelopment.tsx`
- **Commit:** 1848e385

## Verification

```
npx tsc --noEmit: PASSED — zero errors
grep DesignContextPanel frontend/src/components/plan/: MissionAnalysis, COADevelopment, PlanOrderDevelopment
grep designService.getDesign frontend/src/components/plan/: all three files
grep pushHandoff frontend/src/components/design/: only design-service.ts (method preserved, no UI triggers)
```

## Commits

| Hash | Description |
|------|-------------|
| ee65166d | feat(49-02): create DesignContextPanel and DesignSyncIndicator components |
| 1848e385 | feat(49-02): wire DesignContextPanels into JPP steps 2, 3, 7; add sync indicator to Design overview |

## Self-Check: PASSED

All created files confirmed present on disk. Both task commits verified in git log.
TypeScript compilation clean (zero errors).
