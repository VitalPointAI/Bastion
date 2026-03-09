# Phase 37: Training Assessment Loop - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

AAR capture at tactical training events. METL proficiency tracking (T/P/U per task). Upward aggregation: training events → exercise trends → training strategy readiness updates. Training Strategy Assess tab shows METL dashboard. Exercise Assess tab shows event-level trends. Assessment flows UP through the hierarchy (distinct from operational Assess which measures campaign objective progress). Operational MOE/MOP tracking is NOW in scope — replaces existing placeholders with functional objective-linked measures and reframing integration.

</domain>

<decisions>
## Implementation Decisions

### AAR Capture Flow
- Structured template with 4 doctrinal AAR sections: What was planned? What happened? Why? Sustain/Improve observations
- Each observation is linked to a specific METL task
- O/C (Observer/Controller) or Commander initiates and leads the AAR — other participants can add observations but don't initiate
- AI staff agent pre-populates suggested sustain/improve observations based on planned vs actual; O/C reviews and accepts/rejects/edits each suggestion
- AAR lifecycle: Draft → In Review → Finalized (locked, read-only after finalization)
- Finalized AARs become historical records; new observations require a new AAR at a new training event

### METL Proficiency Model
- METL tasks are inherited from Training Strategy (strategic problem set) down to exercises and training events
- Each lower level (exercise/training event) CAN add supplemental tasks for secondary learning objectives
- Supplemental tasks are tracked locally — visible in that exercise/event's assessment but do NOT aggregate to the strategic METL dashboard unless explicitly promoted
- O/C assigns T/P/U rating per METL task, with AI suggesting ratings based on linked AAR observations
- Commander can override O/C ratings
- Time-based proficiency decay: ratings degrade if a task isn't re-assessed (e.g., T→P, P→U)
- Decay thresholds are configurable per task or competency (not global-only)
- Most recent assessment rating wins as the current authoritative rating; full history preserved for trend analysis

### Upward Aggregation
- Training Strategy Assess tab: Heat map matrix — METL tasks as rows, time periods/exercises as columns, cells show T/P/U with color coding (green/yellow/red), decay warnings highlighted
- Exercise Assess tab: Chronological event timeline showing which METL tasks were assessed per event with their T/P/U ratings, clickable to drill into the AAR, plus exercise-wide aggregate
- Aggregation is automatic on AAR finalization — no manual publish step
- When AAR is finalized: ratings propagate up to exercise aggregate and training strategy METL dashboard; decay timers reset

### Assess Tab Adaptation
- Same AssessTab component, mode-conditional sidebar items based on ModeContext (isTraining)
- Operational mode: sidebar now includes functional MOE/MOP tracking + Reframing
- Training mode: sidebar items vary by echelon level:
  - Training Strategy (strategic): METL Dashboard, Readiness Overview, Trends
  - Exercise (operational): Event Timeline, Exercise METL Aggregate
  - Training Event (tactical): AAR, Task Assessment
- Echelon resolved from problem set metadata via ProblemSetContext (same pattern as PlanEchelonRouter)

### Operational MOE/MOP Tracking
- MOEs linked to operational objectives (from Design tab) — measure changes in conditions/system behavior
- MOPs linked to tasks (from OPORD) — measure task completion against standards
- Each MOE/MOP has: status (green/yellow/red), trend (improving/stable/declining), linked indicators/observations
- Status updates: manual entry by staff + AI-assisted suggestions from COP data and OSINT feeds; commander or assessment officer approves
- MOE/MOP data feeds into Reframing decision gate: when multiple MOEs show declining trends or critical MOPs miss targets, system auto-suggests a reframing assessment to the commander
- Operational Assess sidebar: MOE Overview, MOP Overview, Reframing (existing gate enhanced with assessment data)

### Claude's Discretion
- AAR form layout and styling details
- AI observation suggestion algorithm and prompt design
- Exact heat map visualization library/approach
- Decay timer notification UX (banner vs badge vs inline)
- Database schema for AAR and METL assessment records
- API route structure for assessment data
- Database schema for MOE/MOP records and observation history
- MOE/MOP dashboard layout and card design
- Reframing auto-trigger threshold logic

</decisions>

<specifics>
## Specific Ideas

- AAR structure follows FM 7-0 doctrinal format (4 questions)
- Heat map matrix for METL dashboard inspired by military readiness reporting
- Supplemental tasks at lower levels can be "promoted" to the strategic METL if they prove important
- Per-task decay configuration allows different readiness windows for different competency types (e.g., perishable skills decay faster)
- MOE/MOP tracking follows JP 5-0 assessment framework: MOEs measure effectiveness (conditions), MOPs measure performance (tasks)
- Reframing auto-suggestion connects assessment data to the existing governance gate — closes the doctrinal assess→adapt loop

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AssessTab` (frontend/src/components/tabs/AssessTab.tsx): Existing Assess tab with operational placeholders — will be extended with mode-conditional rendering
- `TabLayout` + `SidebarItem` (frontend/src/components/tabs/TabLayout.tsx): Sidebar pattern with id/label/tooltip/status — training sidebar items follow this pattern
- `ModeContext` (frontend/src/context/ModeContext.tsx): Provides `isTraining` boolean and `mode` state — drives mode-conditional content
- `DecisionGateBanner` / `GateSubmitButton`: Existing governance components in AssessTab — remain for operational mode
- `AIStaffProvider` / `AIStaffPanel`: Existing AI staff integration — can be leveraged for AI-suggested AAR observations
- `PlanEchelonRouter` (frontend/src/components/plan/PlanEchelonRouter.tsx): Existing echelon-based routing pattern — Assess tab can follow the same pattern for echelon-specific views

### Established Patterns
- Mode-conditional rendering: ModeContext provides `isTraining` for conditional logic (used in governance, problem set store)
- Sidebar-driven navigation: TabLayout with SidebarItem array, selectedItem state, onSelectItem handler
- Problem set hierarchy: Parent-child relationships with echelon metadata already in problem set data model
- Training badge pattern: `<span className="training-badge">TRAINING</span>` used in governance components

### Integration Points
- `ProblemSetTabContainer` renders `<AssessTab problemSetId={displayId} />` — no changes needed at container level
- Problem set echelon metadata available via `useProblemSet()` context
- Backend problem set store already filters by mode (`mode` column)
- New backend routes needed: AAR CRUD, METL assessment CRUD, aggregation queries, MOE/MOP CRUD
- OSINT integration (existing) can feed MOE/MOP status suggestions
- Design tab objectives (existing) serve as linkage targets for MOEs
- OPORD tasks (from Plan tab) serve as linkage targets for MOPs

</code_context>

<deferred>
## Deferred Ideas

- Individual task evaluation (beyond collective METL) — could be its own phase
- AAR comparison across units (horizontal comparison) — future capability

</deferred>

---

*Phase: 37-training-assessment-loop*
*Context gathered: 2026-03-08*
