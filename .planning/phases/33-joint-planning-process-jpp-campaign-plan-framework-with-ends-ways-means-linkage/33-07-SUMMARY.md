---
phase: 33-joint-planning-process-jpp-campaign-plan-framework-with-ends-ways-means-linkage
plan: 07
subsystem: frontend
tags: [typescript, react, jpp, coa, wargaming, plan-development]

requires:
  - phase: 33-joint-planning-process-jpp-campaign-plan-framework-with-ends-ways-means-linkage
    provides: "JPPStepLayout, RoleGatedSection, jppService, ewmService"

provides:
  - "COAAnalysis wargaming component (Step 4)"
  - "COAComparison decision matrix component (Step 5)"
  - "COAApproval commander briefing component (Step 6)"
  - "PlanOrderDevelopment 5-paragraph order component (Step 7)"
---

## Self-Check: PASSED

## What Was Built
JPP Steps 4-7 UI components covering COA evaluation through plan production.

- **COAAnalysis (Step 4)**: Action-reaction-counteraction wargaming with turn tracking, vulnerability identification, and modified COA recommendations.
- **COAComparison (Step 5)**: Weighted decision matrix with configurable criteria, scoring visualization, and staff recommendation generation.
- **COAApproval (Step 6)**: Commander decision briefing package with approve/modify/reject actions and governance gate.
- **PlanOrderDevelopment (Step 7)**: 5-paragraph order generation with annexes A-Z, E-W-M gap validation, and plan type selection (OPLAN/CONPLAN/OPORD).

## Key Files

### key-files.created
- frontend/src/components/plan/COAAnalysis.tsx
- frontend/src/components/plan/COAComparison.tsx
- frontend/src/components/plan/COAApproval.tsx
- frontend/src/components/plan/PlanOrderDevelopment.tsx

## Deviations
None.
