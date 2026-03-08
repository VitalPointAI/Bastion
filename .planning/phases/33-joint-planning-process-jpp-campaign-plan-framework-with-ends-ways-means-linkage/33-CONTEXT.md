# Phase 33: Joint Planning Process (JPP) Campaign Plan Framework with Ends-Ways-Means Linkage - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the full 7-step Joint Planning Process (JPP) workflow as a collaborative planning framework within the Plan tab. LOEs from Operational Design (Phase 25) feed into JPP as input. JPP produces COAs and a campaign plan (annex-based OPLAN) as output with full Ends-Ways-Means linkage to strategic objectives. Includes entity resolution for consistent entity references across documents and OSINT feed integration (primarily Argus) for real-time intelligence surfacing.

</domain>

<decisions>
## Implementation Decisions

### JPP Workflow Structure
- Full 7-step JPP: Planning Initiation, Mission Analysis, COA Development, COA Analysis (Wargame), COA Comparison, COA Approval, Plan/Order Development
- Presented as sub-tabs within the Plan tab (alongside a dedicated E-W-M Overview tab)
- Free-flow navigation — all steps accessible at all times, no blocking gates
- Doctrinal governance gates at COA decision points: info briefs and decision briefs for COA development, selection, and affirmation
- LOEs from Operational Design (Phase 25) flow into JPP as the primary input for COA development

### Staff Collaboration Model
- Role-gated sections within each JPP step — staff roles (J2, J3, J4, J5, etc.) see/edit their assigned sections, view others read-only
- AI agents can draft for their assigned role within each section
- Staff can work across steps freely; governance gates only block formal product approval

### Designated AI Agents Per Step
- Step 1 (Planning Init): Commander's Staff Agent
- Step 2 (Mission Analysis): Intel Agent (IPB), Ops Agent (tasks)
- Step 3 (COA Development): Plans Agent (COA draft)
- Step 4 (COA Analysis): Red Team Agent
- Step 5 (COA Comparison): Decision Support Agent
- Step 6 (COA Approval): Briefing Agent
- Step 7 (Plan/Order Dev): Plans Agent (OPLAN generation)
- Agents auto-draft when step begins; staff reviews/edits

### Problem Set Scoping
- Per problem set JPP instances — theater-level problem set gets campaign-level JPP, subordinate problem sets get operational JPPs
- Parent problem set JPP products auto-inherit as "higher headquarters guidance" in child JPP Step 1 (read-only reference, leveraging Phase 26 inheritance)

### Campaign Plan Output Format
- Default: Annex-based OPLAN/CONPLAN structure (Base plan + Annexes A-Z)
- Also produce an experimental alternative format if a more efficient method is identified during implementation — offered as an alternative pathway for consideration

### E-W-M Linkage Visualization
- Two complementary views:
  - **Hierarchical tree**: Interactive editing surface — drag-and-drop to create linkages, click nodes to edit, collapsible. Similar to existing CoG tree pattern. Strategic Objectives (Ends) → LOEs/COAs (Ways) → Forces/Resources (Means)
  - **Sankey/flow diagram**: Read-only analytical view — left-to-right flow showing how objectives flow through ways to means, width shows resource weight, hover to highlight paths
- Dedicated "E-W-M Overview" view as a top-level item in the Plan tab (alongside JPP step sub-tabs)
- Auto-highlight gaps: unlinked objectives, unsupported LOEs, over-allocated resources, orphan forces — color-coded warnings with AI agent suggesting fixes

### Entity Resolution
- Four entity types: Nations/state actors, Military forces/units, Geographic locations, Organizations/alliances
- AI resolves with human confirmation: high-confidence matches (>90%) auto-resolve, low-confidence queued for staff review, staff can always override
- Hybrid seeding: pre-seed with well-known base entities (major nations, alliances), discover force-specific and location-specific entities organically from document processing
- Global registry per exercise — all problem sets share the same canonical entities
- MCP tools: search_entities, create_entity_alias, merge_entities, get_entity_references

### OSINT Feed Integration
- Primary source: Argus (https://argus.vitalpoint.ai) via webhook push (primary) + RSS polling (fallback/catch-up)
- Additional sources: RSS/news feeds, social media/OSINT APIs, government/military feeds, custom/simulated exercise feeds
- Surfacing: Contextual alerts within JPP steps (e.g., new PRC intel appears in J2's Mission Analysis section with relevance score) + COP geographic/temporal overlays
- Relevance scoring: Configurable per problem set
  - Default: Entity + objective matching (use entity registry to match OSINT mentions → score relevance against active objectives/LOEs)
  - Opt-in: AI semantic matching for deeper contextual relevance
- MCP tools: fetch_osint_feeds, create_osint_event, link_event_to_objective

### Claude's Discretion
- Specific visualization library choices (D3, React Flow, etc.)
- Sankey diagram implementation approach
- Entity resolution confidence threshold tuning
- OSINT polling interval configuration
- Webhook endpoint security/authentication pattern
- Internal data schema design for JPP step products
- Step transition animation/UX details

</decisions>

<specifics>
## Specific Ideas

- Operational Design produces LOEs, NOT COAs — COAs are developed within the JPP (doctrinal correctness critical)
- Argus integration is the priority OSINT path — it's VitalPoint's own tool and provides curated, high-signal articles
- Annex-based OPLAN is the default output format, but explore a potentially more efficient alternative format as an experimental option
- Parent problem set campaign plans auto-flow as higher HQ guidance to child problem sets — mirrors real-world command hierarchy
- For training exercises, simulated OSINT feeds (scenario controller pushes events) are critical for Pacific Strategy AY26

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StrategicObjectiveSchema` (backend/src/strategic/schemas/strategic-objective.ts): Full E-W-M breakdown with DIME categorization — direct input for campaign plan linkage
- `EndsWaysMeansSchema` (backend/src/strategic/schemas/ends-ways-means.ts): Established schema for ends/ways/means structure
- `objectiveToolHandlers` (backend/src/graph/tools/objective-tools.ts): MCP tools for query, save, link, theme-based filtering of objectives
- `StrategicFusionAgent` (backend/src/graph/agents/strategic-fusion-agent.ts): Pattern for AI agent with document consolidation capabilities — model for JPP step agents
- `CoGTree` component (frontend/src/components/design/CoGTree.tsx): Tree visualization pattern reusable for E-W-M hierarchical tree
- `LOETimelineSection` component (frontend/src/components/design/LOETimelineSection.tsx): LOE display pattern — input to JPP

### Established Patterns
- MCP tool registration via `MCPToolInput` definitions with Zod schemas
- Agent manifests with Eliza-compatible character definitions, autonomy levels, and tool assignments
- Role-based access via staff roles (31 JPP staff roles already defined)
- Problem set scoping and Phase 26 strategic inheritance for parent→child data flow

### Integration Points
- Plan tab (Phase 24 restructure): JPP sub-tabs integrate here
- Operational Design (Phase 25): LOEs feed into JPP Step 3
- Strategic inheritance (Phase 26): Parent JPP products flow to child problem sets
- AI staff integration (Phase 29): Agent routing and contextual AI per tab
- COP tab: OSINT events plot as intelligence overlays

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-joint-planning-process-jpp-campaign-plan-framework-with-ends-ways-means-linkage*
*Context gathered: 2026-03-08*
