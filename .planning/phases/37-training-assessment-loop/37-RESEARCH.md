# Phase 37: Training Assessment Loop - Research

**Researched:** 2026-03-08
**Domain:** Training assessment (AAR, METL proficiency), operational MOE/MOP tracking, mode-conditional Assess tab
**Confidence:** HIGH

## Summary

Phase 37 transforms the existing AssessTab placeholder into a fully functional assessment system serving two distinct modes: (1) Training mode with AAR capture, METL proficiency tracking (T/P/U), and upward aggregation from training events through exercises to training strategy, and (2) Operational mode with MOE/MOP tracking linked to Design tab objectives and OPORD tasks, feeding into the existing Reframing governance gate.

The codebase provides strong foundations for this work. The `AssessTab` already has sidebar-based navigation via `TabLayout`, mode context via `ModeContext.isTraining`, echelon metadata via `ProblemSetContext.activeProblemSet.echelon`, and the `PlanEchelonRouter` pattern for echelon-based view switching. The existing `aar_events` table (Phase 22) captures low-level event telemetry but is NOT the doctrinal AAR format required here -- new tables are needed for structured AARs, METL tasks, proficiency assessments, MOEs, and MOPs. The Design tab already has `LineOfEffort.objectiveId` and `OperationalApproach` data that MOEs can link to, and the OPORD/task structures from the exercise module provide MOP linkage targets.

**Primary recommendation:** Build an AssessEchelonRouter (mirroring PlanEchelonRouter) that combines mode-conditional AND echelon-conditional sidebar items, backed by new PostgreSQL tables for structured AARs, METL assessments, MOEs, and MOPs with corresponding backend CRUD services and API routes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AAR Capture Flow:**
- Structured template with 4 doctrinal AAR sections: What was planned? What happened? Why? Sustain/Improve observations
- Each observation is linked to a specific METL task
- O/C (Observer/Controller) or Commander initiates and leads the AAR -- other participants can add observations but don't initiate
- AI staff agent pre-populates suggested sustain/improve observations based on planned vs actual; O/C reviews and accepts/rejects/edits each suggestion
- AAR lifecycle: Draft -> In Review -> Finalized (locked, read-only after finalization)
- Finalized AARs become historical records; new observations require a new AAR at a new training event

**METL Proficiency Model:**
- METL tasks are inherited from Training Strategy (strategic problem set) down to exercises and training events
- Each lower level (exercise/training event) CAN add supplemental tasks for secondary learning objectives
- Supplemental tasks are tracked locally -- visible in that exercise/event's assessment but do NOT aggregate to the strategic METL dashboard unless explicitly promoted
- O/C assigns T/P/U rating per METL task, with AI suggesting ratings based on linked AAR observations
- Commander can override O/C ratings
- Time-based proficiency decay: ratings degrade if a task isn't re-assessed (e.g., T->P, P->U)
- Decay thresholds are configurable per task or competency (not global-only)
- Most recent assessment rating wins as the current authoritative rating; full history preserved for trend analysis

**Upward Aggregation:**
- Training Strategy Assess tab: Heat map matrix -- METL tasks as rows, time periods/exercises as columns, cells show T/P/U with color coding (green/yellow/red), decay warnings highlighted
- Exercise Assess tab: Chronological event timeline showing which METL tasks were assessed per event with their T/P/U ratings, clickable to drill into the AAR, plus exercise-wide aggregate
- Aggregation is automatic on AAR finalization -- no manual publish step
- When AAR is finalized: ratings propagate up to exercise aggregate and training strategy METL dashboard; decay timers reset

**Assess Tab Adaptation:**
- Same AssessTab component, mode-conditional sidebar items based on ModeContext (isTraining)
- Operational mode: sidebar now includes functional MOE/MOP tracking + Reframing
- Training mode: sidebar items vary by echelon level:
  - Training Strategy (strategic): METL Dashboard, Readiness Overview, Trends
  - Exercise (operational): Event Timeline, Exercise METL Aggregate
  - Training Event (tactical): AAR, Task Assessment
- Echelon resolved from problem set metadata via ProblemSetContext (same pattern as PlanEchelonRouter)

**Operational MOE/MOP Tracking:**
- MOEs linked to operational objectives (from Design tab) -- measure changes in conditions/system behavior
- MOPs linked to tasks (from OPORD) -- measure task completion against standards
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

### Deferred Ideas (OUT OF SCOPE)
- Individual task evaluation (beyond collective METL) -- could be its own phase
- AAR comparison across units (horizontal comparison) -- future capability
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | Frontend UI components | Already in use across all tabs |
| Express | 4.x | Backend API routes | Already in use for all backend routes |
| PostgreSQL | (deployed) | Persistent storage for AARs, METL, MOE/MOP | Project standard, all stores use `getPool()` |
| Zod | 3.x | Request validation schemas | Already used in problem-set API and other routes |
| TypeScript | 5.x | Type definitions | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS (custom) | N/A | Component styling | All tab components use `.css` files (no CSS framework) |
| uuid/crypto.randomUUID | built-in | ID generation | All stores use `randomUUID()` for IDs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS heat map | d3.js / recharts | Adds dependency; simple T/P/U grid doesn't warrant charting library -- CSS grid with conditional classes is sufficient |
| Separate AAR microservice | Express routes in exercise module | Keep it in existing backend structure to avoid complexity |

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/components/assess/
  AssessEchelonRouter.tsx      # Mode + echelon routing (replaces current AssessTab)
  TrainingStrategicAssess.tsx   # METL Dashboard, Readiness Overview, Trends
  TrainingExerciseAssess.tsx    # Event Timeline, Exercise METL Aggregate
  TrainingTacticalAssess.tsx    # AAR form, Task Assessment
  OperationalAssess.tsx         # MOE Overview, MOP Overview, Reframing
  AARForm.tsx                   # Structured 4-section AAR form
  AARObservationCard.tsx        # Individual observation with METL task link
  METLDashboard.tsx             # Heat map matrix component
  METLTaskAssessment.tsx        # T/P/U rating assignment per task
  MOECard.tsx                   # Individual MOE status card
  MOPCard.tsx                   # Individual MOP status card
  AssessEchelonRouter.css

backend/src/assessment/
  types.ts                      # AAR, METL, MOE, MOP type definitions
  aar-structured-store.ts       # Structured AAR CRUD (distinct from existing aar_events)
  metl-store.ts                 # METL task and proficiency assessment CRUD
  moe-store.ts                  # MOE CRUD and status tracking
  mop-store.ts                  # MOP CRUD and status tracking
  aggregation-service.ts        # Upward aggregation logic on AAR finalization
  decay-service.ts              # Proficiency decay calculation

backend/src/api/
  assessment-routes.ts          # REST endpoints for all assessment data
```

### Pattern 1: AssessEchelonRouter (Mode + Echelon Routing)
**What:** A top-level router component that reads both `ModeContext.isTraining` and `ProblemSetContext.activeProblemSet.echelon` to determine which sidebar items and content panels to render.
**When to use:** Replacing the current static AssessTab.
**Example:**
```typescript
// Source: Mirrors PlanEchelonRouter pattern from frontend/src/components/plan/PlanEchelonRouter.tsx
export function AssessEchelonRouter({ problemSetId }: { problemSetId: string }) {
  const { isTraining } = useMode();
  const { activeProblemSet } = useProblemSet();
  const echelon = activeProblemSet?.echelon ?? 'operational';

  if (isTraining) {
    switch (echelon) {
      case 'strategic':
        return <TrainingStrategicAssess problemSetId={problemSetId} />;
      case 'operational':
        return <TrainingExerciseAssess problemSetId={problemSetId} />;
      case 'tactical':
        return <TrainingTacticalAssess problemSetId={problemSetId} />;
    }
  }
  return <OperationalAssess problemSetId={problemSetId} />;
}
```

### Pattern 2: Store Class with init() Self-Migration
**What:** Backend store classes that auto-create tables on first access via `init()`, following the existing store pattern.
**When to use:** All new stores (aar-structured-store, metl-store, moe-store, mop-store).
**Example:**
```typescript
// Source: Follows pattern from backend/src/exercise/aar-store.ts
class METLStore {
  private initialized = false;

  async init(): Promise<void> {
    if (!this.initialized) {
      await initMETLTables();
      this.initialized = true;
    }
  }

  async createTask(input: CreateMETLTaskInput): Promise<METLTask> {
    await this.init();
    const pool = getPool();
    const id = `METL-${randomUUID()}`;
    // ... INSERT query
  }
}
export const metlStore = new METLStore();
```

### Pattern 3: Sidebar-Driven Tab Views
**What:** Each echelon/mode view uses the existing `TabLayout` with mode-specific `SidebarItem[]` arrays.
**When to use:** Every assessment view panel.
**Example:**
```typescript
// Source: Follows TabLayout pattern from frontend/src/components/tabs/TabLayout.tsx
const TRAINING_STRATEGIC_ITEMS: SidebarItem[] = [
  { id: 'metl-dashboard', label: 'METL Dashboard' },
  { id: 'readiness-overview', label: 'Readiness Overview' },
  { id: 'trends', label: 'Trends' },
];
```

### Pattern 4: Aggregation on Finalization
**What:** When an AAR is finalized (status -> 'finalized'), a backend service automatically propagates T/P/U ratings upward through the problem set hierarchy.
**When to use:** AAR finalization endpoint.
**Example:**
```typescript
// Triggered in the PATCH /api/assessment/aars/:id/finalize endpoint
async function onAARFinalized(aarId: string): Promise<void> {
  const aar = await aarStructuredStore.getById(aarId);
  const assessments = await metlStore.getAssessmentsByAAR(aarId);

  // Get parent problem set (exercise level)
  const problemSet = await problemSetStore.getById(aar.problemSetId);
  if (problemSet.parentProblemSetId) {
    await aggregationService.propagateRatings(
      assessments,
      problemSet.parentProblemSetId
    );
  }

  // Reset decay timers for assessed tasks
  await decayService.resetTimers(assessments.map(a => a.metlTaskId));
}
```

### Anti-Patterns to Avoid
- **Mixing AAR events with structured AARs:** The existing `aar_events` table is an event log (decisions, votes, outcomes). Do NOT repurpose it for the doctrinal 4-section AAR. Create a new `structured_aars` table.
- **Global decay rates:** Decay must be configurable per METL task, not a single global setting. Schema must include per-task decay thresholds.
- **Client-side aggregation:** Aggregation logic (rolling up T/P/U from events to exercises to strategy) MUST run server-side to ensure consistency. The frontend only displays pre-computed aggregates.
- **Coupling MOE/MOP to training mode:** MOE/MOP tracking is operational-mode only. Keep it cleanly separated from METL/AAR code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID scheme | `crypto.randomUUID()` | Project standard, collision-safe |
| Request validation | Manual field checks | Zod schemas | Project standard, type-safe |
| Date arithmetic for decay | Manual Date math | PostgreSQL interval arithmetic | DB handles timezone-aware decay calculations correctly |
| Status color mapping | Inline conditionals | CSS custom properties / class mapping | T/P/U -> green/yellow/red mapping reused across multiple components |

**Key insight:** The existing codebase has strong patterns for store classes, API routes, and TabLayout-driven views. Following these patterns exactly reduces integration risk and keeps the codebase consistent.

## Common Pitfalls

### Pitfall 1: Conflating aar_events with Structured AARs
**What goes wrong:** Trying to add 4-section structured AAR data into the existing `aar_events` table (which is an append-only event log).
**Why it happens:** The table name suggests it holds AARs, but it actually holds exercise telemetry events.
**How to avoid:** Create a completely separate `structured_aars` table with lifecycle states (draft/in_review/finalized) and a `aar_observations` table for individual sustain/improve observations linked to METL tasks.
**Warning signs:** Queries against `aar_events` returning wrong shapes, or trying to add a `status` column to the event log.

### Pitfall 2: METL Task Inheritance Without Scoping
**What goes wrong:** Supplemental METL tasks at exercise/event level accidentally appearing in the strategic METL dashboard.
**Why it happens:** No `scope` or `is_supplemental` flag distinguishing inherited vs. locally-added tasks.
**How to avoid:** METL tasks need a `source_problem_set_id` (where they were defined) and an `is_supplemental` boolean. Aggregation queries filter on `is_supplemental = false` unless the task has been explicitly promoted.
**Warning signs:** Strategic dashboard showing tasks that were only meant for a single exercise.

### Pitfall 3: Decay Calculation Race Conditions
**What goes wrong:** Multiple concurrent AAR finalizations updating the same METL task's decay timer simultaneously.
**Why it happens:** Two training events assessed the same METL task and are finalized near-simultaneously.
**How to avoid:** Use PostgreSQL `FOR UPDATE` row locking on the METL proficiency record during finalization, or use `ON CONFLICT ... DO UPDATE` with `GREATEST(new_assessed_at, existing_assessed_at)` to ensure the most recent assessment wins.
**Warning signs:** Decay timers showing incorrect dates, or proficiency ratings not reflecting the most recent assessment.

### Pitfall 4: MOE/MOP Orphaned References
**What goes wrong:** MOEs linked to Design tab objectives that are later edited or deleted, leaving dangling references.
**Why it happens:** No referential integrity check or soft-delete cascade between operational design and assessment data.
**How to avoid:** Store the objective text snapshot at MOE creation time (for display), plus the live `objectiveId` for linking. If the objective is deleted, the MOE remains with its snapshot but shows a "source removed" warning. Same pattern for MOP-to-OPORD-task links.
**Warning signs:** MOE cards showing "undefined" for their linked objective.

### Pitfall 5: Mode Switch During Active AAR
**What goes wrong:** User switches from training to operational mode while an AAR is in draft state, losing context.
**Why it happens:** Mode switch navigates to problem set selector; no persistence check.
**How to avoid:** AAR draft state is persisted in the database (not in component state). When the user returns to training mode, the draft is still available. No need to block mode switching.
**Warning signs:** Lost AAR data after mode switch.

## Code Examples

### Database Schema: Structured AARs

```sql
-- Structured After-Action Reviews (doctrinal FM 7-0 format)
CREATE TABLE IF NOT EXISTS structured_aars (
  id TEXT PRIMARY KEY,                        -- "AAR-{uuid}"
  problem_set_id TEXT NOT NULL,               -- tactical-level problem set
  training_event_name TEXT NOT NULL,
  initiated_by TEXT NOT NULL,                 -- DID of O/C or Commander
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | in_review | finalized
  what_was_planned TEXT NOT NULL DEFAULT '',
  what_happened TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL DEFAULT '',
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual observations linked to METL tasks
CREATE TABLE IF NOT EXISTS aar_observations (
  id TEXT PRIMARY KEY,                        -- "AARO-{uuid}"
  aar_id TEXT NOT NULL REFERENCES structured_aars(id),
  observation_type TEXT NOT NULL,             -- 'sustain' | 'improve'
  content TEXT NOT NULL,
  metl_task_id TEXT,                          -- FK to metl_tasks
  suggested_by_ai BOOLEAN NOT NULL DEFAULT false,
  ai_accepted BOOLEAN,                       -- null if not AI-suggested
  created_by TEXT NOT NULL,                   -- DID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aar_problem_set ON structured_aars(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_aar_status ON structured_aars(status);
CREATE INDEX IF NOT EXISTS idx_aar_obs_aar ON aar_observations(aar_id);
```

### Database Schema: METL Tasks and Proficiency

```sql
-- METL task definitions (defined at strategic, inherited downward)
CREATE TABLE IF NOT EXISTS metl_tasks (
  id TEXT PRIMARY KEY,                        -- "METL-{uuid}"
  problem_set_id TEXT NOT NULL,               -- where task was defined
  source_problem_set_id TEXT,                 -- strategic PS that owns the canonical task
  task_name TEXT NOT NULL,
  task_description TEXT,
  competency_area TEXT,                       -- grouping for dashboard
  is_supplemental BOOLEAN NOT NULL DEFAULT false,
  promoted_to_strategic BOOLEAN NOT NULL DEFAULT false,
  decay_days INTEGER NOT NULL DEFAULT 90,     -- configurable per-task
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proficiency assessment records (T/P/U per task per event)
CREATE TABLE IF NOT EXISTS metl_assessments (
  id TEXT PRIMARY KEY,                        -- "METLA-{uuid}"
  metl_task_id TEXT NOT NULL REFERENCES metl_tasks(id),
  problem_set_id TEXT NOT NULL,               -- where assessment was made
  aar_id TEXT REFERENCES structured_aars(id), -- linked AAR
  rating TEXT NOT NULL,                       -- 'T' | 'P' | 'U'
  assessed_by TEXT NOT NULL,                  -- DID (O/C or Commander)
  ai_suggested_rating TEXT,                   -- what AI suggested
  commander_override BOOLEAN NOT NULL DEFAULT false,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_metl_tasks_ps ON metl_tasks(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_metl_tasks_source ON metl_tasks(source_problem_set_id);
CREATE INDEX IF NOT EXISTS idx_metl_assess_task ON metl_assessments(metl_task_id);
CREATE INDEX IF NOT EXISTS idx_metl_assess_ps ON metl_assessments(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_metl_assess_date ON metl_assessments(assessed_at);
```

### Database Schema: MOE/MOP

```sql
-- Measures of Effectiveness (linked to operational objectives)
CREATE TABLE IF NOT EXISTS assessment_moes (
  id TEXT PRIMARY KEY,                        -- "MOE-{uuid}"
  problem_set_id TEXT NOT NULL,
  objective_id TEXT,                          -- from Design tab LineOfEffort
  objective_snapshot TEXT NOT NULL,            -- snapshot of objective text at creation
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'green',       -- green | yellow | red
  trend TEXT NOT NULL DEFAULT 'stable',       -- improving | stable | declining
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Measures of Performance (linked to OPORD tasks)
CREATE TABLE IF NOT EXISTS assessment_mops (
  id TEXT PRIMARY KEY,                        -- "MOP-{uuid}"
  problem_set_id TEXT NOT NULL,
  task_id TEXT,                               -- from OPORD/mission tasks
  task_snapshot TEXT NOT NULL,                 -- snapshot of task text at creation
  name TEXT NOT NULL,
  description TEXT,
  standard TEXT,                              -- what "to standard" means
  status TEXT NOT NULL DEFAULT 'green',       -- green | yellow | red
  trend TEXT NOT NULL DEFAULT 'stable',       -- improving | stable | declining
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Observations/indicators for MOE and MOP status updates
CREATE TABLE IF NOT EXISTS assessment_observations (
  id TEXT PRIMARY KEY,                        -- "AOBS-{uuid}"
  target_type TEXT NOT NULL,                  -- 'moe' | 'mop'
  target_id TEXT NOT NULL,                    -- MOE or MOP id
  content TEXT NOT NULL,
  source TEXT,                                -- 'manual' | 'ai_suggestion' | 'osint'
  status_update TEXT,                         -- new status if this observation changes it
  trend_update TEXT,                          -- new trend if this observation changes it
  approved_by TEXT,                           -- DID of approver (null = pending)
  approved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moes_ps ON assessment_moes(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_mops_ps ON assessment_mops(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_aobs_target ON assessment_observations(target_type, target_id);
```

### Aggregation Query: Current METL Proficiency

```sql
-- Get the most recent assessment for each METL task in a problem set hierarchy
-- Uses DISTINCT ON to get the latest rating per task
SELECT DISTINCT ON (mt.id)
  mt.id AS metl_task_id,
  mt.task_name,
  mt.competency_area,
  mt.decay_days,
  ma.rating,
  ma.assessed_at,
  ma.assessed_by,
  ma.commander_override,
  CASE
    WHEN NOW() - ma.assessed_at > (mt.decay_days * INTERVAL '1 day') THEN 'expired'
    WHEN NOW() - ma.assessed_at > (mt.decay_days * 0.75 * INTERVAL '1 day') THEN 'warning'
    ELSE 'current'
  END AS decay_status
FROM metl_tasks mt
LEFT JOIN metl_assessments ma ON ma.metl_task_id = mt.id
WHERE mt.source_problem_set_id = $1  -- strategic problem set ID
  AND mt.is_supplemental = false
ORDER BY mt.id, ma.assessed_at DESC NULLS LAST;
```

### Reframing Auto-Trigger Logic

```typescript
// Source: Enhancement to existing Reframing gate in AssessTab
async function checkReframingTrigger(problemSetId: string): Promise<boolean> {
  const moes = await moeStore.listByProblemSet(problemSetId);
  const mops = await mopStore.listByProblemSet(problemSetId);

  const decliningMOEs = moes.filter(m => m.trend === 'declining').length;
  const redMOPs = mops.filter(m => m.status === 'red').length;

  // Threshold: 2+ declining MOEs OR 3+ red MOPs triggers suggestion
  // These thresholds are configurable -- stored in problem set metadata
  const shouldTrigger = decliningMOEs >= 2 || redMOPs >= 3;

  if (shouldTrigger) {
    // Auto-create a reframing gate suggestion for commander review
    await gateStore.createSuggestion({
      problemSetId,
      gateType: 'reframing',
      reason: `Assessment data indicates potential need for reframing: ${decliningMOEs} declining MOEs, ${redMOPs} critical MOPs`,
      autoTriggered: true,
    });
  }

  return shouldTrigger;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `aar_events` event log | Structured AAR with lifecycle | Phase 37 | Event log remains for telemetry; new structured AAR table for doctrinal format |
| AssessTab placeholder (MOE/MOP "coming soon") | Functional MOE/MOP tracking | Phase 37 | Replaces placeholder cards with live data |
| Static Assess sidebar | Mode + echelon conditional sidebar | Phase 37 | Different views per training/operational and per echelon level |

**Existing assets to preserve:**
- `aar_events` table and `aarStore` -- keep as-is for event telemetry, do NOT modify
- `DecisionGateBanner`, `GateSubmitButton` -- remain in operational Reframing view
- `DecisionGateTimeline` -- remains in both modes

## Open Questions

1. **METL Task Seeding**
   - What we know: METL tasks are defined at the strategic level and inherited downward. The inheritance system (Phase 26) exists for documents and graph summaries.
   - What's unclear: Should METL task inheritance use the existing inheritance subscription system, or a simpler direct parent-child query?
   - Recommendation: Use direct parent-child queries (`parentProblemSetId`) for METL task inheritance since it's simpler than the full subscription/acknowledgment system. METL tasks don't need changelog tracking or RFI threads -- they just flow downward.

2. **AI Observation Suggestion Integration**
   - What we know: The AIStaffProvider/AIStaffPanel exist for AI-assisted content generation. AI should suggest sustain/improve observations and T/P/U ratings.
   - What's unclear: Whether to use the existing AI staff agent pipeline or a simpler inline LLM call for AAR suggestions.
   - Recommendation: Use a simpler inline approach (direct LLM call with AAR context) rather than the full staff agent pipeline. The staff agent system is designed for role-based product generation, which is heavier than what's needed for AAR suggestions.

3. **Decay Computation Timing**
   - What we know: Proficiency decays over time if not re-assessed. Decay thresholds are per-task.
   - What's unclear: Whether to compute decay on read (lazy) or via a background job (eager).
   - Recommendation: Compute on read using PostgreSQL interval arithmetic (see aggregation query above). This avoids needing a cron/background worker and is accurate to the moment of query. The dashboard query already includes decay_status calculation.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/tabs/AssessTab.tsx` -- current Assess tab structure with placeholder MOE/MOP sections
- `frontend/src/components/plan/PlanEchelonRouter.tsx` -- echelon routing pattern to mirror
- `frontend/src/context/ModeContext.tsx` -- mode context providing `isTraining` boolean
- `frontend/src/components/tabs/TabLayout.tsx` -- sidebar-driven tab layout pattern
- `backend/src/exercise/aar-store.ts` -- existing event-log AAR (NOT doctrinal AAR)
- `backend/src/problem-set/types.ts` -- ProblemSet with echelon, mode, hierarchy validation
- `backend/src/design/types.ts` -- OperationalDesign with objectives for MOE linkage
- `backend/src/exercise/types.ts` -- ExerciseOrder/OPORDContent for MOP linkage
- `backend/src/inheritance/inheritance-types.ts` -- inheritance patterns for reference

### Secondary (MEDIUM confidence)
- FM 7-0 AAR format (4 doctrinal questions) -- standard military training doctrine
- JP 5-0 assessment framework (MOE/MOP definitions) -- standard joint planning doctrine

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use in the project
- Architecture: HIGH -- patterns directly mirror PlanEchelonRouter and existing store patterns
- Pitfalls: HIGH -- identified from codebase inspection (aar_events confusion, hierarchy scoping)
- Database schema: MEDIUM -- schema design is Claude's discretion per CONTEXT.md; follows existing ID conventions and store patterns
- AI integration: MEDIUM -- recommendation to use inline LLM calls is pragmatic but untested in this context

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- internal codebase patterns unlikely to change)
