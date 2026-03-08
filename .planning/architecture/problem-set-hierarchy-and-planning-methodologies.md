# Problem Set Hierarchy & Planning Methodologies

**Status:** Design Document (Draft)
**Date:** 2026-03-08
**Scope:** End-to-end architecture for hierarchical planning across strategic, operational, and tactical levels
**Related:** Phase 33 (JPP Campaign Plan Framework) — fully planned, ready for execution

## 1. Overview

BASTION's problem set hierarchy must mirror doctrinal planning levels, with each level using its appropriate planning methodology and producing outputs that flow as inputs to the next level down. The same hierarchy applies in both operational and training modes, with training mode adding an assessment feedback loop.

## 2. The Hierarchical Model

### 2.1 Operational Mode

```
Strategic Problem Set
│   Methodology: Strategic guidance development
│   Outputs: Strategic directives, objectives, end states, force apportionment
│
├── Campaign A (operational problem set, child)
│   Methodology: JPP (JP 5-0)
│   Outputs: CONPLAN → OPLAN → OPORD (with mission assignments)
│   │
│   ├── Mission 1 (tactical problem set, child)
│   │   Methodology: MDMP (ATP 5-0.1)
│   │   Outputs: Unit OPORD, WARNOs, FRAGOs
│   │   └── (can recurse: sub-missions for subordinate echelons)
│   │
│   ├── Mission 2 (tactical problem set, child)
│   │   Methodology: MDMP
│   │   └── ...
│   │
│   └── Mission N
│
├── Campaign B (operational problem set, child)
│   Methodology: JPP
│   └── ...
│
└── Campaign N
```

### 2.2 Training Mode (parallel terminology)

```
Training Strategy (strategic problem set)
│   Methodology: Training guidance development (FM 7-0)
│   Outputs: Training guidance, readiness objectives, METL assessment
│
├── Exercise A (operational problem set, child)
│   Methodology: JPP (practiced)
│   Outputs: Exercise OPORD, STARTEX criteria
│   │
│   ├── Training Event 1 (tactical problem set, child)
│   │   Methodology: MDMP (practiced, with assessment overlay)
│   │   Outputs: Unit OPORD + AAR + assessment
│   │   │
│   │   └── Assessment feeds back UP to Training Strategy
│   │
│   └── Training Event N
│
└── Exercise N
```

### 2.3 Key Principles

- **Mode toggle switches the entire tree** — no mixed operational/training branches
- **Same planning processes in both modes** — "train as you fight"
- **Methodology is derived from `echelon × mode`** — not manually selected
- **One-to-many at each level** — a strategic PS can have multiple campaigns; a campaign can have multiple missions
- **Missions bridge levels** — they are outputs of JPP (assigned in OPORD) and inputs to MDMP

## 3. Inputs & Outputs by Level

### 3.1 Strategic Level

| Attribute | Operational Mode | Training Mode |
|-----------|-----------------|---------------|
| **Name** | Strategic Problem Set | Training Strategy |
| **Methodology** | Strategic guidance development | Training management (FM 7-0) |
| **Primary Tab** | Design (operational approach) | Understand (training gaps) + Assess (readiness) |

**Inputs:**
- National security objectives / theater strategy
- Geopolitical context and intelligence assessments
- Force structure and capability inventory
- Policy constraints (ROE frameworks, alliance commitments)

**Outputs (cascade to operational level):**
- Strategic directive / initiating directive
- Strategic objectives and desired end states
- Force apportionment / resource allocation priorities
- Constraints and restraints
- Key assumptions
- Theater/strategic context (intelligence, OOBs, geopolitical factors)

**Training Mode Additions:**
- METL (Mission Essential Task List) with proficiency ratings
- Training objectives and readiness goals
- Training resource allocation
- Assessment criteria and standards

### 3.2 Operational Level (Campaign / Exercise)

| Attribute | Operational Mode | Training Mode |
|-----------|-----------------|---------------|
| **Name** | Campaign | Exercise |
| **Methodology** | JPP (JP 5-0) | JPP (practiced) |
| **Primary Tab** | Plan (JPP workflow) | Plan (JPP workflow) + Assess (exercise assessment) |

**Inputs (inherited from strategic parent):**
- Strategic directive (triggers Planning Initiation — JPP Step 1)
- Strategic objectives and end states
- Force apportionment
- Constraints, restraints, assumptions
- Strategic context

**Process — JPP Steps (7 steps per Phase 33 / JP 5-0):**
1. **Planning Initiation** — Receive strategic directive, issue initial WARNO, higher HQ guidance (inherited from parent JPP)
2. **Mission Analysis** — IPB (J2), specified/implied/essential tasks (J3/J5), mission statement (5W), commander's intent (Klein 7 facets)
3. **COA Development** — Develop minimum 3 COAs with sketches, LOEs from Design tab as input, E-W-M linkage, info brief governance gate
4. **COA Analysis (Wargaming)** — Red Team Agent wargames each COA, adversary actions, vulnerabilities, decision points
5. **COA Comparison** — Decision matrix scoring (FASDC: feasibility, acceptability, suitability, distinguishability, completeness), decision brief governance gate
6. **COA Approval** — Auto-assembled briefing package, commander selects/modifies COA, decision gate
7. **Plan/Order Development** — 5-paragraph order (OPLAN/OPORD/CONPLAN/FRAGORD), annexes A-Z, E-W-M gap check, plan approval gate, document generation & distribution to child problem sets

**E-W-M (Ends-Ways-Means) Linkage** — Cross-cutting feature across JPP:
- **Ends**: Strategic/operational objectives
- **Ways**: LOEs and COAs (bridged from Design tab)
- **Means**: Forces and resources (from Resource Registry)
- E-W-M Overview tab (8th sidebar item in Plan tab) with tree and Sankey visualizations
- Gap analysis: unlinked objectives, unsupported LOEs, over-allocated/orphan resources
- Gaps must be resolved before plan approval in Step 7

**OSINT Integration** — Real-time intelligence feeds:
- Argus webhook push + RSS polling fallback
- OSINT alerts surface in each JPP step as contextual banners
- Entity resolution links nations, forces, locations across documents

**Navigation Model**: Free-flow (all 7 steps + E-W-M Overview always accessible, no blocking gates on navigation)

**Role-Gated Sections**: Staff roles (J2, J3, J4, J5, etc.) see/edit assigned sections; others view read-only

**Designated AI Agents Per Step**:
- Step 1: Commander's Staff Agent
- Step 2: Intel Agent (IPB) + Ops Agent (tasks)
- Step 3: Plans Agent
- Step 4: Red Team Agent
- Step 5: Decision Support Agent
- Step 6: Briefing Agent
- Step 7: Plans Agent

**Outputs (cascade to tactical level):**
- OPORD (matured from CONPLAN → OPLAN → OPORD):
  - Commander's intent (purpose, key tasks, end state)
  - Concept of operations
  - Task organization
  - **Mission assignments** — task + purpose per subordinate unit
  - CCIRs / PIRs
  - Rules of engagement
  - Coordinating instructions
  - Service support
- Synchronization matrix
- Decision support matrix / template
- Targeting guidance
- WARNOs (issued throughout process)

**Training Mode Additions:**
- Exercise scenario / inject schedule
- STARTEX / ENDEX criteria
- Observer/controller guidance
- Training objectives mapped to METL tasks

### 3.3 Tactical Level (Mission / Training Event)

| Attribute | Operational Mode | Training Mode |
|-----------|-----------------|---------------|
| **Name** | Mission | Training Event |
| **Methodology** | MDMP (ATP 5-0.1) | MDMP (practiced, with assessment) |
| **Primary Tab** | Plan (MDMP workflow) | Plan (MDMP workflow) + Assess (AAR) |

**Inputs (inherited from operational parent + mission assignment):**
- Mission assignment from parent OPORD (task + purpose)
- Commander's intent (own level + 2 levels up)
- Task organization / attached units
- Constraints, restraints, ROE
- CCIRs / PIRs relevant to this mission
- Coordinating instructions
- Available intelligence specific to AO
- Timeline / phase triggers from synchronization matrix

**Process — MDMP Steps:**
1. **Receipt of Mission** — Receive mission from parent OPORD, issue initial WARNO, begin timeline
2. **Mission Analysis** — IPB at tactical level, determine tasks, develop restated mission, identify COG
3. **COA Development** — Develop COAs with tactical detail (formations, movement, fires)
4. **COA Analysis (Wargaming)** — Action-reaction-counteraction against threat COAs
5. **COA Comparison** — Score using weighted criteria
6. **COA Approval** — Commander decision (governance gate)
7. **Orders Production** — Produce unit OPORD with annexes

**Outputs:**
- Unit OPORD (5-paragraph format)
- WARNOs (throughout process)
- FRAGOs (during execution, as situation changes)
- Execution checklists
- Can spawn child missions (recurse to lower echelons)

**Training Mode Additions:**
- AAR (After Action Review) — sustain/improve observations
- Task proficiency assessment (T/P/U per METL task)
- Individual/collective task evaluation
- Feedback flows UP to Training Strategy to update readiness posture

## 4. Mission Creation Flow

Missions are the critical bridge between operational and tactical levels. They are **created from** the OPORD development step of JPP.

### 4.1 How Missions Spawn

```
Campaign Problem Set → Plan Tab → JPP Step 7 (Plan/Order Development)
    │
    │  During OPORD development, commander/staff define:
    │  - Paragraph 3 (Execution) assigns missions to subordinate units
    │  - Each mission = task + purpose for a specific subordinate
    │
    ├── "Create Mission" action per subordinate task assignment
    │   │
    │   │  System creates:
    │   │  1. New tactical problem set (child of this campaign)
    │   │  2. Pre-populated with inherited context:
    │   │     - Mission statement (task + purpose from OPORD)
    │   │     - Commander's intent (from parent + grandparent)
    │   │     - Task org (forces assigned to this mission)
    │   │     - Constraints/restraints/ROE
    │   │     - CCIRs/PIRs
    │   │     - AO boundaries
    │   │  3. MDMP workflow initialized at "Receipt of Mission"
    │   │  4. Relevant members invited/assigned
    │   │
    │   └── Mission problem set ready for MDMP execution
    │
    └── Repeat for each subordinate mission assignment
```

### 4.2 Upward Reporting

Tactical missions report back to the operational level:
- Execution status updates → parent campaign COP tab
- FRAGOs and situation changes → parent campaign Assess tab
- Completed missions → campaign assessment of progress toward objectives

## 5. Data Model Changes

### 5.1 Problem Set Extensions

The existing `problem_sets` table needs:

```sql
ALTER TABLE problem_sets ADD COLUMN planning_methodology TEXT;
-- Values: 'strategic_guidance' | 'jpp' | 'mdmp' | NULL (derived from echelon)
-- NULL = system derives from echelon; explicit value = override

ALTER TABLE problem_sets ADD COLUMN operational_label TEXT;
-- Training mode labels: 'training_strategy' | 'exercise' | 'training_event'
-- Operational mode labels: 'strategic' | 'campaign' | 'mission'
-- Display label that changes with mode

ALTER TABLE problem_sets ADD COLUMN parent_mission_assignment JSONB;
-- For tactical problem sets: stores the mission assignment from parent OPORD
-- { taskStatement, purpose, commandersIntent, taskOrg, constraints, ccirs, roe, ao }
```

### 5.2 Plan Maturity Lifecycle

Campaign-level plans need a maturity lifecycle:

```sql
CREATE TABLE plan_lifecycle (
    id TEXT PRIMARY KEY,
    problem_set_id TEXT REFERENCES problem_sets(id),
    plan_type TEXT NOT NULL,           -- 'conplan' | 'oplan' | 'opord'
    status TEXT NOT NULL,              -- 'draft' | 'review' | 'approved' | 'superseded'
    version INTEGER DEFAULT 1,
    promoted_from TEXT REFERENCES plan_lifecycle(id),  -- tracks CONPLAN→OPLAN→OPORD
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    content JSONB NOT NULL,            -- the plan content (5-paragraph format + annexes)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 Mission Assignment Table

```sql
CREATE TABLE mission_assignments (
    id TEXT PRIMARY KEY,
    source_opord_id TEXT REFERENCES plan_lifecycle(id),  -- which OPORD assigned this
    target_problem_set_id TEXT REFERENCES problem_sets(id),  -- the mission PS created
    task_statement TEXT NOT NULL,
    purpose TEXT NOT NULL,
    commanders_intent JSONB,           -- inherited from parent
    task_organization JSONB,           -- forces assigned
    constraints JSONB,
    restraints JSONB,
    ccirs JSONB,
    roe_references TEXT[],
    area_of_operations JSONB,          -- geographic bounds
    timeline JSONB,                    -- phase triggers, NLT/NET times
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.4 Training Assessment Tables

```sql
CREATE TABLE training_assessments (
    id TEXT PRIMARY KEY,
    problem_set_id TEXT REFERENCES problem_sets(id),
    assessment_type TEXT NOT NULL,      -- 'aar' | 'metl_rating' | 'task_evaluation'
    content JSONB NOT NULL,
    assessed_by TEXT,                   -- DID of assessor
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- METL proficiency tracking (rolls up to training strategy level)
CREATE TABLE metl_proficiency (
    id TEXT PRIMARY KEY,
    training_strategy_ps_id TEXT REFERENCES problem_sets(id),
    task_name TEXT NOT NULL,
    proficiency TEXT NOT NULL,          -- 'T' (trained) | 'P' (practiced) | 'U' (untrained)
    assessed_at TIMESTAMPTZ,
    source_event_ps_id TEXT REFERENCES problem_sets(id),  -- which training event
    notes TEXT
);
```

## 6. Plan Tab Behavior by Echelon

The Plan tab adapts its workflow based on the problem set's echelon:

| Echelon | Workflow Shown | Steps | Key Outputs |
|---------|---------------|-------|-------------|
| **Strategic** | Strategic Guidance | Objective setting, force apportionment, directive drafting | Strategic directive |
| **Operational** | JPP (JP 5-0) | 7 steps + E-W-M Overview (Phase 33) | CONPLAN → OPLAN → OPORD |
| **Tactical** | MDMP (ATP 5-0.1) | 7 steps (existing mdmp/ module) | Unit OPORD |

### 6.1 Implementation Approach

The Plan tab component should:
1. Read `activeProblemSet.echelon` from ProblemSetContext
2. Render the appropriate workflow component:
   - `strategic` → `StrategicGuidanceWorkflow` (new)
   - `operational` → `JPPWorkflow` (wraps existing jp50-machine + PlanningDashboard)
   - `tactical` → `MDMPWorkflow` (wraps existing mdmp/ module + components)
3. Each workflow manages its own step progression, governance gates, and output generation

### 6.2 Code Mapping (Existing + Phase 33 Planned)

**Existing infrastructure:**

| What Exists | Where It Lives | How It Maps |
|------------|----------------|-------------|
| JP 5-0 state machine | `backend/src/planning/workflow/jp50-machine.ts` | → Operational level Plan tab (Phase 33 builds on this) |
| MDMP workflow service | `backend/src/mdmp/workflow-service.ts` | → Tactical level Plan tab |
| MDMP activity registry | `backend/src/mdmp/activity-registry.ts` | → Tactical level MDMP steps |
| COA generator agent | `backend/src/planning/agents/coa-generator.ts` | → Both operational (JPP) and tactical (MDMP) |
| COA comparator agent | `backend/src/planning/agents/coa-comparator.ts` | → Both levels |
| Red team simulator | `backend/src/planning/agents/red-team-simulator.ts` | → Both levels (wargaming step) |
| OPORD generator | `backend/src/planning/documents/generators/opord.ts` | → Both levels produce OPORDs |
| Planning dashboard | `frontend/src/components/planning/PlanningDashboard.tsx` | → Operational level (Phase 33 replaces) |
| Mission module | `backend/src/mission/` | → Mission = tactical problem set (merge/align) |
| MDMP governance panel | `frontend/src/components/governance/MDMPGovernancePanel.tsx` | → Tactical level governance gates |
| Safety enforcement | `backend/src/mdmp/safety-enforcement.ts` | → Both levels |
| COA sketch/map | `backend/src/operational-planning/coa-sketch.ts` | → Both levels |

**Phase 33 planned additions (10 plans, not yet executed):**

| Planned | Plans | What It Adds |
|---------|-------|-------------|
| JPP domain foundation | Plan 01 | `backend/src/jpp/types.ts`, `jpp-store.ts`, `ewm-store.ts` — JPPInstance, step products, E-W-M types |
| OSINT ingestion | Plan 02 | `backend/src/api/osint-webhook.ts` — Argus webhook, per-PS feed config |
| AI agent manifests | Plan 03 | 7 agent manifests (one per JPP step) + 12 MCP tools (6 JPP + 6 E-W-M) |
| REST API + frontend services | Plan 04 | `backend/src/api/jpp.ts`, `jpp-service.ts`, `ewm-service.ts`, `osint-service.ts`, `entity-service.ts` |
| Navigation shell | Plan 05 | PlanTab restructure with 8 sidebar items, `JPPStepLayout`, `RoleGatedSection`, `OSINTAlertBanner` |
| JPP Steps 1-3 UI | Plan 06 | `PlanningInitiation.tsx`, `MissionAnalysis.tsx`, `COADevelopment.tsx` |
| JPP Steps 4-7 UI | Plan 07 | `COAAnalysis.tsx`, `COAComparison.tsx`, `COAApproval.tsx`, `PlanOrderDevelopment.tsx` |
| E-W-M visualizations | Plan 08 | `EWMOverview.tsx`, `EWMTree.tsx` (interactive), `EWMSankey.tsx` (analytical) |
| Final wiring + verification | Plan 09 | `EntityResolutionPanel.tsx`, full PlanTab wiring, human verification checkpoint |
| Document generation | Plan 10 | Templates, PDF/DOCX export, version lifecycle (Draft→Coordinating Draft→Final), **distribution to child problem sets** |

**Critical Phase 33 integration points:**
- Design tab LOEs → COA Development (Step 3) via `get_loes_from_design` MCP tool
- Parent JPP products → child Step 1 as read-only "Higher HQ Guidance"
- Plan 10 document distribution = the mechanism for OPORD→Mission spawning
- Resource Registry (Phase 27) → E-W-M "Means" layer

## 7. Inheritance Mechanism

Phase 26 (Strategic Environment Inheritance) becomes the backbone of this hierarchy. Context flows downward:

```
Strategic PS
│  publishes: strategic context, directives, force structure, intel
│
├── Campaign PS (subscribes to parent)
│   │  inherits: strategic context, objectives, constraints
│   │  adds: campaign-specific planning products
│   │
│   ├── Mission PS (auto-inherits from parent OPORD)
│   │   inherits: mission assignment, commander's intent (2 up),
│   │             task org, ROE, CCIRs, AO
│   │   adds: tactical planning products
│   │
│   └── Mission PS
│       └── Sub-Mission PS (recurse)
│
└── Campaign PS
```

### 7.1 Inheritance Rules

1. **Strategic → Operational**: Uses existing subscription mechanism (Phase 26). Campaign PS subscribes to strategic parent for context updates.
2. **Operational → Tactical**: **Automatic** via mission assignment. When a mission PS is created from an OPORD, all relevant context is copied and linked. Updates to the parent OPORD propagate as notifications (not auto-overwrite — tactical commander decides whether to accept changes).
3. **Override capability**: Child can override inherited values (e.g., tactical commander may have different ROE interpretation), but overrides are flagged for parent visibility.

## 8. Training Mode Assessment Loop

Training mode adds an upward flow that doesn't exist in operational mode:

```
Training Event (tactical)
    │
    │ produces: AAR, task proficiency ratings
    │
    ▼ (assessment flows UP)
Exercise (operational)
    │
    │ aggregates: event assessments, identifies trends
    │
    ▼ (readiness update flows UP)
Training Strategy (strategic)
    │
    │ updates: METL proficiency, identifies training gaps
    │ adjusts: training guidance for next exercise cycle
    │
    └── (cycle repeats)
```

This is distinct from the operational mode Assess tab, which measures progress toward campaign objectives rather than unit proficiency.

## 9. Impact on Existing Phases

### Phase 33 (JPP Campaign Plan Framework) — Already Planned

Phase 33 is fully planned with 10 detailed plans (see `.planning/phases/33-*/`). It builds the complete operational-level JPP workflow. **This design document extends Phase 33's scope** by placing it within the broader echelon hierarchy. Phase 33 should be understood as building the **operational level** Plan tab experience.

**What Phase 33 covers (no duplication needed):**
- JPP domain data layer (types, stores, E-W-M)
- OSINT ingestion pipeline
- AI agent manifests and MCP tools for all 7 JPP steps
- REST API and frontend services
- Plan tab navigation shell with 8 sidebar items
- All 7 JPP step UI components
- E-W-M visualization (tree + Sankey)
- Document generation, versioning, and distribution

**What Phase 33 partially covers (extend, don't duplicate):**
- Document distribution to child problem sets (Plan 10) — needs extension to trigger mission/tactical PS creation
- Parent JPP inheritance (Step 1 Higher HQ Guidance) — needs strategic level to exist as the parent

### Phases That Remain Relevant (reorder/refine)
- **Phase 25.2** (Strategic Document Containers) — still needed; feeds strategic level inputs
- **Phase 25.3** (AI Context Integration) — still needed; scoped per echelon
- **Phase 26** (Inheritance) — becomes more critical; backbone of hierarchy
- **Phase 28** (Embedded DAO Governance) — applies at governance gates in JPP and MDMP
- **Phase 29** (Contextual AI) — scoped per echelon and methodology

### New Work Required (beyond Phase 33)
1. **Plan tab echelon-aware routing** — render JPP (Phase 33) vs MDMP vs Strategic Guidance based on echelon
2. **Mission creation from OPORD** — extend Phase 33 Plan 10 document distribution to spawn tactical child problem sets with MDMP initialized
3. **Strategic guidance workflow** — new workflow for strategic level (lighter than JPP)
4. **MDMP tactical workflow wiring** — wire existing mdmp/ module into Plan tab for tactical echelon (similar to what Phase 33 does for operational)
5. **Training assessment loop** — AAR capture, METL tracking, upward flow
6. **Mission-to-problem-set alignment** — merge existing mission module with tactical problem set concept

### Existing Mission Module Decision

The current `backend/src/mission/` module has its own data model (`mission` table, `mission_participants`, etc.) that is separate from problem sets. Two options:

**Option A: Merge missions into problem sets (recommended)**
- A mission IS a tactical problem set — no separate entity needed
- Mission-specific fields (AO, task statement, purpose) go into `parent_mission_assignment` JSONB or `mission_assignments` table
- Mission participants = problem set members with tactical roles
- Eliminates dual management of what is conceptually one thing

**Option B: Keep missions as linked entities**
- Mission remains a separate table but linked 1:1 to a tactical problem set
- More migration complexity, potential for drift between the two models

**Recommendation: Option A.** Missions become tactical problem sets with mission-specific metadata. The existing mission UI components adapt to work within the problem set framework.

## 10. Proposed Phase Sequence

Based on this design and Phase 33's existing plans, the recommended build order:

### Phase 33: JPP Campaign Plan Framework (already planned — execute as-is)
Builds the complete operational-level JPP workflow in the Plan tab.

### Phase 34 (proposed): Plan Tab Echelon Routing & MDMP Tactical Wiring
- Plan tab reads `echelon` from ProblemSetContext and renders appropriate workflow
- `operational` → Phase 33's JPP components
- `tactical` → Wire existing `backend/src/mdmp/` module + components into Plan tab (mirror Phase 33's pattern for MDMP steps)
- `strategic` → Placeholder for strategic guidance (built in later phase)
- MDMP steps get same treatment as JPP: sidebar navigation, role-gated sections, governance gates, AI agent panels

### Phase 35 (proposed): Mission Creation from OPORD & Problem Set Alignment
- Extend Phase 33 Plan 10's document distribution to trigger tactical problem set creation
- "Create Mission" action in OPORD Step 7 Para 3 (Execution) per subordinate task assignment
- Auto-populate child tactical PS with inherited context (mission statement, commander's intent, task org, ROE, CCIRs, AO)
- Initialize child's MDMP at "Receipt of Mission" step
- Merge existing `backend/src/mission/` module into problem set framework (Option A)
- Mission assignments table linking OPORD → child problem sets

### Phase 36 (proposed): Strategic Guidance Workflow
- Build strategic level Plan tab workflow
- Lighter than JPP: objective setting, force apportionment, constraint definition, directive drafting
- Strategic directive output becomes the initiating directive for child campaign JPP (Step 1)
- Connect to Phase 25.2 strategic document containers as input

### Phase 37 (proposed): Training Assessment Loop
- AAR capture at tactical training events
- METL proficiency tracking (T/P/U per task)
- Upward aggregation: training events → exercise trends → training strategy readiness updates
- Training Strategy Assess tab shows METL dashboard
- Exercise Assess tab shows event-level trends

### Phase 38 (proposed): Inheritance Deepening
- Full context propagation with change notification (not auto-overwrite)
- Override tracking: child overrides flagged for parent visibility
- OPORD update propagation: parent OPORD changes → notification to child missions
- Upward reporting: tactical COP/execution status → parent campaign COP and Assess tabs

Detailed phase planning (ROADMAP updates) should follow once this design is reviewed and approved.

## 11. Open Questions

1. **Echelon depth**: Should tactical problem sets support more than one level of recursion (brigade → battalion → company)? If so, how deep?
2. **Strategic workflow formality**: How formal should the strategic guidance workflow be? Full step-by-step, or more freeform with key outputs?
3. **Cross-campaign coordination**: Can missions span multiple campaigns (e.g., a SOF mission supporting two campaigns simultaneously)?
4. **Exercise replay**: Should training events support "replay" — running the same scenario multiple times with different approaches?
5. **Assessment standards**: What doctrinal assessment framework for METL proficiency? FM 7-0 T/P/U, or something more granular?
