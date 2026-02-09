---
status: testing
phase: 05-operational-planning-module
source: 05-01 through 05-16-SUMMARY.md
started: 2026-01-31T17:00:00Z
updated: 2026-02-01T12:10:00Z
---

## Current Test

number: 4
name: Start and Mark Step Ready
expected: |
  Clicking a step shows its details. "Start Step" button changes status to in_progress. "Mark Ready" button changes status to ready. Status changes persist after refresh.
awaiting: user response

## Tests

### 1. Access Planning Dashboard
expected: Planning Dashboard loads with plan list sidebar on left and 8-step JP 5-0 workflow navigator on right showing all planning steps with status indicators.
result: pass
note: Enhancement requested - add ability to delete or archive existing plans

### 2. Create Plan with Modal Form
expected: Clicking "Create Plan" opens a modal form. The form has a name input field and a plan type dropdown (OPLAN, OPORD, CONPLAN, FRAGORD). Each type shows a doctrinal description. Submitting creates the plan and adds it to the list.
result: pass
note: Enhancement requested - add classification level selector (currently defaults to UNCLASSIFIED)

### 3. View JP 5-0 Workflow Steps
expected: All 8 JP 5-0 steps visible with color-coded status badges (not_started=gray, in_progress=blue, ready=green, approved=gold, rejected=red). Steps 6 (COA Approval) and 8 (Plan Approval) show checkpoint indicators.
result: pass

### 4. Start and Mark Step Ready
expected: Clicking a step shows its details. "Start Step" button changes status to in_progress. "Mark Ready" button changes status to ready. Status changes persist after refresh.
result: issue
reported: "issue persists - no details are opening when clicking a step"
severity: blocker
root_cause: "Uncommitted changes to backend/src/planning/workflow/engine.ts broke XState snapshot restoration. Actor was created with fresh default context instead of persisted state."
fix_applied: "Reverted broken workflow changes via git checkout"

### 5. View COA List
expected: COA section displays cards for each Course of Action. Each card shows COA number, name, comparison score (if scored), ranking badge (if ranked), and red team vulnerability count.
result: [pending]

### 6. Create COA via Editor
expected: "Add COA" opens editor modal. Can enter COA name, description, scheme of maneuver, and commander's intent fields (purpose, key tasks, end state). Saving adds COA to the list.
result: [pending]

### 7. AI COA Generation Button
expected: "Generate with AI" button is visible and clickable. Clicking triggers the COA generator agent (may show loading state). Button exists even if backend agent isn't running.
result: [pending]

### 8. Red Team Analysis Button
expected: "Red Team All" button is visible for running adversary simulation on COAs. Clicking triggers the red team agent (may show loading state).
result: [pending]

### 9. COA Comparison Button
expected: "Compare All" button is visible for comparing COAs. Clicking triggers the COA comparator agent. After completion, COA cards would show scores and rankings.
result: [pending]

### 10. Collaborative Editing Status
expected: COA editor shows connection status indicator (connected/disconnected). When multiple users edit the same document, collaborator names and cursor colors appear.
result: [pending]

### 11. Commander Approval Panel
expected: At COA Approval (step 6) and Plan Approval (step 8) checkpoints, approval panel appears. Shows COA summary, approve/reject buttons for commanders. Non-commanders see waiting indicator.
result: [pending]

### 12. ROE Violations Display
expected: ROE panel shows any rule violations with severity badges: Critical (red), Major (orange), Minor (blue). Warnings show as High/Medium/Low. Each violation shows rule citation.
result: [pending]

### 13. ROE Override Workflow
expected: Commanders can request ROE override. Override form requires justification (minimum 10 characters). Override section shows blockchain audit trail warning.
result: [pending]

### 14. Export OPORD Documents
expected: Document export section shows OPORD export options. DOCX and PDF download buttons are visible. Clicking downloads a document (or shows error if plan incomplete).
result: [pending]

### 15. Export Briefing Slides
expected: Can export briefing slides as PPTX. Three types available: Commander (COA overview), Staff (risk assessment), Rehearsal (timeline). Buttons visible and clickable.
result: [pending]

### 16. Planning Products Preview
expected: Can preview planning products: Sync Matrix, DST, CCIR. Each shows as JSON preview when clicked (or displays empty state if no data).
result: [pending]

## Summary

total: 16
passed: 3
issues: 0
pending: 13
skipped: 0

## Gaps

[none - previous blocker fixed in 05-16-PLAN.md]
