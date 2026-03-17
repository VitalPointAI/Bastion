# Phase 49: Align Design Tab Operational Approach with Plan Tab - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove duplicate operational design content from the Plan tab, establish the Design tab as the single source of truth for operational design artifacts (CoG, LOEs, problem framing, operational approach), and wire Design tab outputs as the automatic starting point for campaign planning in the Plan tab. Restructure the Strategic Guidance workflow to remove its Operational Approach step and add an Alignment step. Build a generic fork-and-merge revision system so Plan tab can propose changes to Design artifacts through DAO governance.

</domain>

<decisions>
## Implementation Decisions

### Strategic Guidance Cleanup
- Remove Strategic Guidance Step 2 (Operational Approach) entirely — the Design tab IS the operational approach workspace
- Strategic Guidance becomes a 3-step workflow: **Assessment → Alignment → Directive**
  - Assessment: Auto-syncs from Understand tab's knowledge graph (strategic documents, actor analysis, environmental factors)
  - Alignment: AI agents assist staff in mapping national/political objectives to operational-level ends — agents surface relevant strategic documents, propose linkages, highlight gaps; staff reviews and confirms
  - Directive: Commander's intent and planning guidance flows down as higher HQ guidance to subordinate problem sets
- Strategic Assessment's simplified CoG section is removed — Design tab owns full CoG analysis

### Design-to-Plan Automatic Sync
- Replace the manual "Push to Plan Tab" button with automatic real-time sync — Design outputs flow to Plan tab without user action
- Replace the push button with a passive status indicator showing which Design sections are complete and syncing to Plan tab
- Design-sourced fields in Plan tab are read-only — to change them, user clicks "Propose Revision" (fork-and-merge workflow)
- Targeted placement of Design outputs in JPP steps:
  - Step 2 (Mission Analysis): Problem statement + CoG analysis
  - Step 3 (COA Development): Lines of Effort
  - Step 7 (Plan/Order Development): Phases/transitions
- No changes to the 8 JPP steps themselves — only addition of read-only Design context panels

### Fork-and-Merge Revision System
- Build a **generic revision layer** that can wrap any Design artifact (CoG, LOEs, problem framing, operational approach)
- Plan tab can propose revisions to any Design artifact when planning reveals new insights
- Proposed revisions require **DAO governance gate** approval before merging back to Design tab
- Visual diff display when reviewing proposed revisions — side-by-side or inline highlighting of added/removed/changed elements
- This enables the doctrinal cycle of continuous assessment and revision between design and planning

### LOE Single Source of Truth
- Design tab is the canonical LOE source — Plan tab references via auto-sync
- Strategic Guidance's LOE content removed along with Step 2
- Force concepts mapped to correct doctrinal locations:
  - **Assignment** (standing forces) → Resource Registry (Phase 27)
  - **Apportionment** (notional planning assumptions) → JPP Step 3 (COA Development)
  - **Allocation** (real forces for execution) → JPP Step 7 (Plan/Order Development)

### Claude's Discretion
- Exact auto-sync implementation mechanism (WebSocket, polling, shared state)
- Generic revision layer data schema design
- Visual diff rendering approach for different artifact types (structured trees vs text narratives)
- AI agent selection and prompt design for the Strategic Alignment step
- Status indicator design and placement in Design tab
- Understand-to-Strategic-Assessment sync mechanism details

</decisions>

<specifics>
## Specific Ideas

- CoG analysis is doctrinally iterative — planning reveals need to refine design, design updates flow back to planning. The fork-and-merge pattern captures this cycle
- Force assignment/apportionment/allocation are distinct doctrinal concepts: Assignment = what you always have (standing forces), Apportionment = what you can plan with (notional), Allocation = what you actually get (real forces for execution)
- Strategic Alignment step is about AI agents actively assisting staff — not just displaying data, but proposing national-to-operational objective linkages for staff review
- Strategic workflow bridges Understand tab's knowledge graph (strategic environment) to actionable guidance flowing to operational planning
- The entire tab flow should feel like: Understand → Design → Plan, with data flowing forward and revisions flowing backward through governance

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DesignTab.tsx` + 5 section components (DesignOverview, ProblemFramingSection, CoGAnalysisSection, LOETimelineSection, OperationalApproachSection): Design tab is well-structured, canonical source for all operational design artifacts
- `design-service.ts`: Frontend service with getDesign, getHandoff, pushHandoff — handoff mechanism exists, needs refactoring from push to sync model
- `PlanEchelonRouter.tsx`: Echelon-based routing (operational/tactical/strategic) — Strategic Guidance view needs restructuring
- `StrategicGuidancePlanView.tsx`: Current 3-step strategic workflow — Step 2 (OperationalApproach) to be removed, Alignment step to be added
- `TabLayout.tsx` + `SidebarItem`: Reusable sidebar pattern for new Strategic Alignment step
- Existing DAO governance patterns (Phase 28): Governance gate approval flow reusable for revision merge approval

### Established Patterns
- `operational_designs` table with handoff_payload/handoff_pushed_at columns — adapt for continuous sync model
- D3/SVG for custom visualizations (CoG trees, LOE timelines) — diff visualization can extend these
- MCP tool registration with Zod schemas — for revision proposal/approval tools
- Agent confidence bounds pattern — for AI alignment suggestions

### Integration Points
- `DesignTab` → `PlanTab`: Auto-sync replaces manual push; read-only panels in JPP Steps 2, 3, 7
- `UnderstandTab` knowledge graph → `StrategicGuidancePlanView` Strategic Assessment: New auto-sync connection
- DAO governance system → revision merge approval: New integration for fork-and-merge proposals
- `COADevelopment.tsx`: Currently fetches design data via designService.getDesign() — needs update to use sync'd read-only pattern
- `OperationalApproach.tsx` (Plan tab strategic step): File to be deleted
- Backend `design.ts` API: Needs revision proposal endpoints

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point*
*Context gathered: 2026-03-17*
