# Phase 36: Strategic Guidance Workflow - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build strategic-level Plan tab workflow — lighter than JPP. Follows a 3-step doctrinal flow: Strategic Assessment → Operational Approach → Commander's Planning Guidance/Directive. The directive output becomes the initiating directive for child campaign JPP (Step 1). Connects to Phase 25.2 strategic document containers as input and Phase 27 resource registry for force data.

</domain>

<decisions>
## Implementation Decisions

### Workflow Structure & Steps
- 3-step doctrinal flow: **Strategic Assessment** (situation review, center of gravity analysis, key assumptions, strategic environment from Phase 25.2 containers) → **Operational Approach** (lines of effort/operation, objectives hierarchy, force apportionment, constraints/restraints) → **Commander's Planning Guidance/Directive** (commander's intent, planning guidance, directive draft & export)
- Reuse PlanTab's TabLayout + sidebar pattern with 3 sidebar items and status badges
- **Free navigation** — all 3 steps accessible from the start, no sequential gating. Status badges track progress (not_started/in_progress/ready) but don't block access
- **Replaces Plan tab at strategic echelon** — when problem set echelon is 'strategic', Plan tab shows the 3-step strategic guidance workflow instead of the 7-step JPP. Campaign/tactical echelons continue to get JPP
- Per-step AI agent assist with ability to assign additional AI agents or agent teams as the commander deems necessary. Each step has default AI advisors (strategic analyst, operational planner, directive reviewer) plus flexible agent assignment

### Directive Format & Output
- **Hybrid format** based on Commander's Planning Guidance: structured doctrinal sections (commander's intent, objectives, force apportionment, constraints) plus free-form commander's guidance sections for additional direction as the commander deems necessary
- **Auto-populate child campaign JPP Step 1** when directive is finalized — commander's intent, objectives, constraints, and force apportionment flow down to child campaign problem sets' Planning Initiation step
- **Notification with acknowledgement** — child campaign problem sets receive notification of new/updated directive and must acknowledge receipt before content is incorporated
- **Versioned updates** — each directive revision creates a new version. Child campaigns re-notified on updates with diff highlighting showing what changed. Uses existing inheritance changelog pattern
- **Exportable via Phase 33 engine** — add STRATEGIC_DIRECTIVE template to existing DocumentGenerator. Exports as PDF/DOCX with military document formatting

### Force Apportionment Model
- **Extend EWM framework + LOE-based allocation** — Objectives = Ends, LOEs = Ways, Forces = Means. Visual LOE-based allocation showing forces assigned to each line of effort
- **Forces sourced from Phase 27 resource registry** with ability to add missing entries on the fly — adding an unregistered force triggers a requirement for staff to connect the relevant resource data in the registry
- **Priority tiers** on each force allocation: Main Effort, Supporting Effort, Reserve, Economy of Force. Visual distinction (color/badge) for each tier
- **Dashboard summary** showing total force commitment across all LOEs, forces committed vs available, over-allocation warnings, main effort balance overview

### Constraint & Assumption Handling
- **Doctrinal taxonomy**: Constraints (must do), Restraints (must not do), Assumptions, Limitations — standard JP 5-0 categories
- Each entry includes: type, source authority (e.g., SECDEF, POTUS, GFMAP), and applicability (time/phase-bounded or standing)
- **Auto-inherit to child campaigns** via Phase 26 inheritance system — strategic constraints automatically appear in child campaign JPP as inherited constraints. Campaign staff must acknowledge. Cannot delete inherited constraints but can add campaign-specific ones
- **Assumption validity triggers** — each assumption can have conditions that would invalidate it (e.g., "if Phase transitions to Crisis"). When triggered, system flags for review and notifies relevant staff
- **AI-assisted validation** — conflict detection between constraints, assumption validation against strategic environment data (Phase 25.2 containers), and suggestions for missing assumptions. Uses existing conflict detection agent pattern

### Claude's Discretion
- Exact component layout and spacing within each step view
- Loading states and skeleton designs
- Error handling and validation UX
- Specific AI agent prompt engineering for strategic advisors
- Database schema design for strategic guidance data model
- How to handle edge cases in version diffing

</decisions>

<specifics>
## Specific Ideas

- Strategic Assessment should pull from Phase 25.2 strategic document containers as the input foundation — the commander reviews what's already been organized in the strategic environment
- Force apportionment visualization should combine EWM structure with a visual LOE-based layout — not just a table, something that shows the relationship between ends/ways/means visually
- Directive versioning should use the same changelog pattern as Phase 26 inheritance — diff highlighting so campaign staff can quickly see what changed between versions
- The "add missing force" workflow should create a visible staff action item to properly register the force in Phase 27's resource registry — not just a free-text workaround

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PlanTab TabLayout + sidebar pattern** (`frontend/src/components/tabs/PlanTab.tsx`): Sidebar with status badges, main content area — reuse for 3-step strategic workflow
- **JPP types and step tracking** (`backend/src/jpp/types.ts`): StepStatus enum, step product storage, parent JPP inheritance — extend for strategic guidance steps
- **EWM types** (`backend/src/jpp/types.ts`): EWMEnd, EWMWay, EWMMean with allocation percentages — extend for strategic-level force apportionment
- **ObjectiveStore** (`backend/src/strategic/objectives/store.ts`): Strategic objectives with EWM, DIME instruments, constraints[], assumptions[] — reuse for Step 1 objectives
- **Commander's Intent type** (`backend/src/planning/types.ts`): purpose, keyTasks, endState, constraints, criticalFactors — reuse for directive content
- **DocumentGenerator** (`backend/src/planning/document-generator.ts`): PDF/DOCX export with templates — add STRATEGIC_DIRECTIVE template
- **Inheritance system** (`backend/src/inheritance/inheritance-service.ts`): Auto-inheritance chain, acknowledgements, changelog, cache invalidation — use for constraint propagation and directive versioning
- **Container store** (`backend/src/strategic/containers/store.ts`): Strategic environments, actor categories, document containers — input source for Strategic Assessment step
- **Staff agent framework** (`backend/src/agents/langgraph/staff-agent-seeder.ts`): 108 agents with rich character enrichment, per-container agent assignment — extend for per-step strategic advisors
- **Conflict detection agents** (`backend/src/graph/agents/`): Strategic fusion, conflict detection, validity assessment — reuse for constraint conflict detection

### Established Patterns
- **Echelon-based routing**: Problem set echelon (strategic/operational/tactical) already determines behavior — extend for Plan tab content switching
- **Step status tracking**: not_started → in_progress → ready → approved pattern with badge mapping
- **JSONB flexible content**: Step products store flexible content per role/step — use for strategic guidance step content
- **Agent assignment**: Container-level and step-level agent assignment with auto-process capabilities

### Integration Points
- **PlanTab.tsx**: Echelon check to switch between strategic guidance workflow and JPP
- **JPP Step 1 (Planning Initiation)**: Auto-populate from strategic directive
- **Phase 26 inheritance**: Constraint/assumption propagation to child problem sets
- **Phase 25.2 containers**: Strategic environment data as input to Strategic Assessment
- **Phase 27 resource registry**: Force data source for apportionment (with fallback add-on-the-fly)
- **Phase 33 document generator**: New STRATEGIC_DIRECTIVE template type

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-strategic-guidance-workflow*
*Context gathered: 2026-03-08*
