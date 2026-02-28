# Phase 14: Friendly & Adversary IPB Complete Cycle - Research

**Researched:** 2026-02-28
**Domain:** Military Exercise Scenario Simulation — Document-to-IPB-to-Orders pipeline with dual-perspective wargaming
**Confidence:** HIGH (codebase verified; architecture understood; all key decisions locked in CONTEXT.md)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Document-to-Scenario Pipeline
- Single scenario package upload — user uploads entire directory structure; system parses folder hierarchy to determine side (blue/red) and exercise phase assignment automatically
- Full auto-extraction — AI extracts OOBs, timelines, objectives, force dispositions, key events, and presents a complete structured scenario; human reviews the result (no per-extraction confirmation gates)
- All document types extracted with equal priority — OOBs, ALERTORDs, SITREPs, Campaign Plans (PPTX), FRAGOs, Country Policy Sheets, and Planning Maps all contribute essential information
- Extend Phase 4's existing ingestion/extraction pipeline — make it generic enough for both operational and exercise scenarios with a designation tag ("operational" vs "training/exercise")
- Support PDF, DOCX, and PPTX document types from the exercise package

#### Dual-Perspective IPB Presentation
- Toggle-based perspective switching (Blue/Red) as the primary view mode — single IPB view with perspective selector
- Layered overlay capability — users can toggle individual layers on/off (blue forces, red forces, terrain, key features, etc.) similar to GIS layer management
- Two Red perspective modes: "Red as Blue sees them" (standard IPB) and "Red as Red sees themselves" (wargaming mode)
- Extend existing ValidityMap component — add IPB-specific layers (AOs, avenues of approach, key terrain, NAIs, engagement areas, obstacle overlays)
- Standard geographic maps (Leaflet/Stadia dark tile) as primary format — convert hex-based exercise planning maps to equivalent geographic overlays, no hex grid rendering

#### COA Scoring & Commander Decisions
- Combined scoring model — doctrinal evaluation criteria (feasibility, acceptability, suitability, distinguishability, completeness) plus wargaming results from Phase 5.2's adversary modeler
- Decision matrix + editable AI-generated narrative for COA comparison
- Staff can edit the AI-generated narrative before presenting to commander
- Full commander decision workflow — accept, reject, modify, combine elements, or send back for more analysis
- Hybrid recording — commander decisions in PostgreSQL; hash anchored on NEAR blockchain for tamper-evident verification

#### WARNORD & Order Generation
- Both AI-generated and manual authoring modes
- Full 5-paragraph OPORD for major phase transitions; simplified FRAGO for within-phase updates
- Orders create actionable tasks assigned to planning teams (Blue staff, Red cell, exercise control) with role-based assignment, status tracking, deadlines, and completion gates
- WARNORD serves as the exercise initiation mechanism — loading + publishing kicks off planning cycle
- Order sequence follows doctrine: WARNORD → OPORD → FRAGOs
- Orders versioned and linked to exercise phase timeline
- Per-team order generation — Blue orders contain only Blue-visible information; Red orders contain only Red-visible information; exercise controller sees both
- Respects information barriers

#### Concurrent Operations & Phasing
- Timeline + gates — master timeline for visualization; phase transitions are explicit decisions (not automatic time-based triggers); gates control when new information becomes available
- Interleaved planning with information barriers — Blue cannot see Red's internal planning and vice versa; exercise controller/admin sees both sides
- Incremental overlay + automatic impact flagging for new SITREPs
- Version history preserved when assessments are updated

### Claude's Discretion
- Specific folder structure parsing heuristics for the scenario package
- IPB layer styling and color coding conventions
- Exact scoring weight defaults for the doctrinal criteria
- SITREP delta detection algorithms and confidence thresholds
- Exercise controller dashboard layout and controls

### Deferred Ideas (OUT OF SCOPE)
- Full negotiation phase support — Phase 14 tracks negotiation outcomes only as inputs to final assessment; a dedicated negotiation support phase is roadmap backlog
- Real-time multi-user exercise execution — Phase 14 builds the scenario and planning tools; live multi-user exercise play with simultaneous teams is a separate capability
</user_constraints>

---

## Summary

Phase 14 builds the exercise scenario management capability on top of BASTION's existing strategic planning, document ingestion, operational planning, and wargaming infrastructure. The phase extends and generalizes existing systems rather than building new foundations — the document parser, extraction service, wargaming engine, planning stores, Leaflet/milsymbol map stack, and OPORD generators all exist and need extension or composition, not replacement.

The primary engineering challenge is information architecture: dual-perspective data isolation (Blue sees only Blue data; Red sees only Red data; controller sees both) implemented through row-level security patterns at the PostgreSQL layer, enforced at the API layer. A second major challenge is the scenario package ingestion pipeline — parsing multi-document directory structures to auto-derive side, phase, and document type assignments using AI extraction with minimal user confirmation gates.

The WARNORD/OPORD/FRAGO order generation system needs to compose the existing OPORD docx/pdf generators with a new exercise-specific schema that understands team perspective, exercise phase gates, and planning board task assignment. The existing milsymbol + Leaflet + react-leaflet stack (react-leaflet v5, leaflet v1.9.4, leaflet-draw v1.0.4) is the correct choice for all map overlays, including the extended IPB layers.

**Primary recommendation:** Build incrementally on existing infrastructure — scenario package → exercise store → dual-perspective IPB service → COA scoring with wargame evidence → WARNORD/OPORD/FRAGO with planning board tasks. Information barrier enforcement via PostgreSQL row-level security is the critical pattern that unlocks safe dual-perspective play.

---

## Standard Stack

### Core (Existing — Already Installed)
| Library | Version | Purpose | Status in Codebase |
|---------|---------|---------|-------------|
| `unpdf` | `^1.4.0` | PDF text extraction (server-side) | Used in `document-parser.ts` |
| `officeparser` | `^6.0.4` | DOCX/PPTX text extraction | Used in `document-parser.ts` |
| `leaflet` | `^1.9.4` | Map rendering engine | Used in `ValidityMap.tsx`, `COASketchMap.tsx` |
| `react-leaflet` | `^5.0.0` | React bindings for Leaflet | Used in `ValidityMap.tsx` |
| `leaflet-draw` | `^1.0.4` | Freehand drawing, polygon tools on Leaflet | Installed, used in COASketchMap |
| `milsymbol` | `^3.0.3` | MIL-STD-2525D symbol rendering | Used in `symbol-renderer.ts`, `MilSymbolMarker.tsx` |
| `docx` | `^9.5.1` | DOCX order generation | Used in `docx-generator.ts` |
| `pdfkit` | `^0.17.2` | PDF order generation | Used in `pdf-generator.ts` |
| `pptxgenjs` | `^4.0.1` | PPTX generation if needed for briefings | Installed |
| `xstate` | `^5.25.1` | State machine for planning workflow (JP50 machine) | Used in `jp50-machine.ts` |
| `pg` | `^8.16.3` | PostgreSQL client | Used throughout |
| `pg-boss` | `^12.5.4` | Background job queue for async extraction | Used in `message-bus.ts`, `blockchain-sync.ts` |
| `@anthropic-ai/sdk` | `^0.71.2` | LLM calls (multi-provider via `providers/` abstraction) | Used in extraction service |
| `openai` | `^6.16.0` | OpenAI-compatible LLM calls | Used in extraction providers |
| `zod` | `^4.3.5` | Schema validation | Used throughout |
| `uuid` | `^13.0.0` | ID generation | Used throughout |

### Supporting (Existing)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gantt-task-react` | `^0.3.9` | Gantt chart for exercise phase timeline visualization | Planning board timeline view |
| `react-leaflet-draw` | `^0.21.0` | React binding for leaflet-draw polygon tools | IPB overlay drawing |
| `yjs` + `y-websocket` | `^13.6.29` / `^3.0.0` | Collaborative document editing | Order authoring co-editing |
| `@langchain/langgraph` | `^1.1.0` | AI agent graph execution for extraction/analysis | Scenario extraction agent graph |
| `@near-js/*` | `^2.5.x` | NEAR blockchain anchoring for commander decisions | Decision record hashing |
| `json-rules-engine` | `^7.3.1` | Rule evaluation (existing ROE engine, adaptable for gate logic) | Phase gate conditions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stadia Maps dark tiles (existing) | Mapbox satellite | Mapbox would need API key upgrade; Stadia already configured |
| `officeparser` for PPTX | `pptxgenjs` parse mode | `officeparser` is already integrated and parses PPTX text; pptxgenjs is for generation |
| PostgreSQL row-level security (RLS) | Application-layer filter only | RLS is more robust and harder to accidentally bypass; use both |
| Single `exercise_documents` table with `team` column | Separate `blue_documents` / `red_documents` tables | Single table with `team` enum + RLS policy is simpler and consistent with existing schema style |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Database Tables (New for Phase 14)

```sql
-- Exercise scenarios (extends existing plan/mission concepts)
exercise_scenarios (
  id TEXT PK,
  name TEXT,
  designation TEXT, -- 'training/exercise' | 'operational'
  exercise_phases TEXT[],  -- ['Competition', 'Crisis', 'Conflict Day 4', ...]
  current_phase_index INT,
  status TEXT,  -- 'draft' | 'active' | 'complete'
  created_by TEXT,  -- DID
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Ingested scenario documents with side/phase tagging
scenario_documents (
  id TEXT PK,
  scenario_id TEXT FK → exercise_scenarios,
  team TEXT,  -- 'blue' | 'red' | 'controller'
  exercise_phase TEXT,  -- 'Competition', 'Crisis', etc.
  document_type TEXT,  -- 'ALERTORD' | 'SITREP' | 'CAMPAIGN_PLAN' | 'FRAGO' | 'COUNTRY_POLICY' | 'OOB' | 'OTHER'
  filename TEXT,
  mime_type TEXT,
  text_content TEXT,
  extracted_data JSONB,  -- structured extraction result
  extraction_confidence FLOAT,
  created_at TIMESTAMPTZ
)

-- Dual-perspective IPB assessments
ipb_assessments (
  id TEXT PK,
  scenario_id TEXT FK → exercise_scenarios,
  team TEXT,  -- 'blue' | 'red'
  perspective TEXT,  -- 'own' | 'enemy_assessment'
  exercise_phase TEXT,
  area_of_operations JSONB,  -- GeoJSON bounds
  terrain_analysis JSONB,    -- OAKOCAnalysis structure
  threat_assessment JSONB,   -- ThreatAssessment structure
  civil_considerations JSONB,
  named_areas_of_interest JSONB[],
  force_dispositions JSONB,  -- OOB with geo positions
  overlay_layers JSONB,      -- layer definitions for ValidityMap
  version INT,
  parent_version_id TEXT,    -- for history tracking
  created_by TEXT,
  created_at TIMESTAMPTZ
)

-- COAs with exercise-specific wargame-informed scoring
scenario_coas (
  id TEXT PK,
  scenario_id TEXT FK → exercise_scenarios,
  team TEXT,  -- 'blue' | 'red'
  exercise_phase TEXT,
  number INT,
  name TEXT,
  description TEXT,
  scheme TEXT,
  doctrinal_scores JSONB,  -- {feasibility, acceptability, suitability, distinguishability, completeness}
  wargame_evidence JSONB,  -- from wargaming engine
  combined_score FLOAT,
  narrative TEXT,          -- AI-generated + staff editable
  commander_decision TEXT, -- 'accepted' | 'rejected' | 'modified' | 'combined' | 'returned'
  commander_decision_notes TEXT,
  decision_hash TEXT,      -- SHA-256 of decision record
  blockchain_tx TEXT,      -- NEAR tx hash
  selected BOOLEAN,
  created_by TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- WARNORD/OPORD/FRAGO orders
exercise_orders (
  id TEXT PK,
  scenario_id TEXT FK → exercise_scenarios,
  team TEXT,        -- 'blue' | 'red' | 'both' (controller-level only)
  order_type TEXT,  -- 'WARNORD' | 'OPORD' | 'FRAGO'
  exercise_phase TEXT,
  version INT,
  content JSONB,    -- full order structure (5-para for OPORD)
  status TEXT,      -- 'draft' | 'published'
  published_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ
)

-- Planning board tasks created by published orders
planning_tasks (
  id TEXT PK,
  order_id TEXT FK → exercise_orders,
  scenario_id TEXT FK → exercise_scenarios,
  team TEXT,        -- 'blue' | 'red' | 'controller'
  assigned_role TEXT,  -- 'blue_staff' | 'red_cell' | 'exercise_control'
  title TEXT,
  description TEXT,
  deadline TIMESTAMPTZ,
  status TEXT,      -- 'pending' | 'in_progress' | 'complete'
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Exercise phase gates
exercise_gates (
  id TEXT PK,
  scenario_id TEXT FK → exercise_scenarios,
  exercise_phase TEXT,
  gate_type TEXT,   -- 'info_release' | 'phase_transition' | 'order_required'
  condition_description TEXT,
  is_open BOOLEAN,
  opened_by TEXT,
  opened_at TIMESTAMPTZ
)
```

### Recommended Project Structure (New Files)
```
backend/src/
├── exercise/                        # New module
│   ├── types.ts                     # ExerciseScenario, ScenarioDocument, IPBAssessment, ExerciseOrder, PlanningTask
│   ├── schemas.ts                   # Zod schemas
│   ├── scenario-store.ts            # CRUD for exercise_scenarios
│   ├── document-store.ts            # CRUD for scenario_documents (extends strategic ingestion)
│   ├── ipb-store.ts                 # CRUD for ipb_assessments with version history
│   ├── coa-store.ts                 # CRUD for scenario_coas with scoring
│   ├── order-store.ts               # CRUD for exercise_orders
│   ├── task-store.ts                # CRUD for planning_tasks
│   ├── gate-store.ts                # CRUD for exercise_gates
│   ├── package-parser.ts            # Directory structure → side/phase/type heuristics
│   ├── extraction-service.ts        # Extends strategic ExtractionService for exercise context
│   ├── ipb-service.ts               # Dual-perspective IPB assembly from documents
│   ├── coa-scoring-service.ts       # Doctrinal + wargame evidence → combined score
│   ├── order-generator.ts           # WARNORD/OPORD/FRAGO generation with team perspective
│   ├── planning-board-service.ts    # Task creation, assignment, notification
│   └── information-barrier.ts      # Middleware/policy: blue sees blue, red sees red
│
├── api/
│   └── exercise.ts                  # New REST routes for all exercise operations
│
frontend/src/
├── components/
│   ├── exercise/                    # New module
│   │   ├── ScenarioPackageUpload.tsx   # Drag-and-drop directory upload + extraction review
│   │   ├── ExerciseDashboard.tsx       # Main container, perspective toggle, phase timeline
│   │   ├── IPBPanel.tsx                # IPB view with Blue/Red toggle + layer controls
│   │   ├── IPBLayerControls.tsx        # GIS-style layer toggler
│   │   ├── COAScoringPanel.tsx         # Decision matrix + editable narrative
│   │   ├── CommanderDecisionPanel.tsx  # Accept/reject/modify/combine workflow
│   │   ├── OrderEditor.tsx             # WARNORD/OPORD/FRAGO authoring with AI assistance
│   │   ├── PlanningBoard.tsx           # Kanban-style task board by team/role
│   │   ├── ExerciseTimeline.tsx        # Phase timeline using gantt-task-react
│   │   ├── GateControl.tsx             # Exercise controller gate management
│   │   └── index.ts
│   └── validity/
│       └── ValidityMap.tsx              # EXTENDED — new IPB layer types
```

### Pattern 1: Information Barrier via PostgreSQL RLS + API Layer
**What:** Each API route for exercise data enforces team visibility. Blue users can only read `team = 'blue'` or `team = 'controller'` rows. Red users can only read `team = 'red'` or `team = 'controller'` rows. Exercise controller role can read all.
**When to use:** Every exercise data query.
**Example:**
```typescript
// Source: Backend pattern from existing planning API + ABAC filter
// backend/src/exercise/information-barrier.ts

export type ExerciseRole = 'blue_staff' | 'red_cell' | 'exercise_control';

export function getVisibleTeams(role: ExerciseRole): string[] {
  switch (role) {
    case 'exercise_control': return ['blue', 'red', 'controller'];
    case 'blue_staff': return ['blue', 'controller'];
    case 'red_cell': return ['red', 'controller'];
  }
}

// In API middleware:
export async function withExerciseBarrier(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const role = req.user.exerciseRole as ExerciseRole;
  req.visibleTeams = getVisibleTeams(role);
  next();
}

// In store queries:
await pool.query(
  `SELECT * FROM scenario_documents WHERE scenario_id = $1 AND team = ANY($2)`,
  [scenarioId, req.visibleTeams]
);
```

### Pattern 2: Scenario Package Upload — Directory Structure Parsing
**What:** Inspect the uploaded file collection's folder names and filenames to derive `team`, `exercise_phase`, and `document_type` tags automatically before sending to LLM extraction.
**When to use:** During scenario package upload before AI extraction.
**Example:**
```typescript
// Source: Derived from scenario/ directory structure in repo
// scenario/blue team/Team BLUE/ → team='blue'
// scenario/red team/1. RED CRISIS Situation Update/ → team='red', phase='Crisis', type='SITREP'
// scenario/scenario phases/04. Phases 3-5 (Conflict Days 4, 10 & 22)/ → phase='Conflict Day 4/10/22'

const TEAM_HEURISTICS = [
  { pattern: /blue[\s_-]?team|team[\s_-]?blue/i, team: 'blue' },
  { pattern: /red[\s_-]?team|team[\s_-]?red/i, team: 'red' },
  { pattern: /scenario[\s_-]?phases?|exercise[\s_-]?control|excon/i, team: 'controller' },
];

const PHASE_HEURISTICS = [
  { pattern: /competition|phase[\s_-]?1/i, phase: 'Competition' },
  { pattern: /crisis|phase[\s_-]?2/i, phase: 'Crisis' },
  { pattern: /day[\s_-]?4|conflict[\s_-]?day[\s_-]?4|phase[\s_-]?3/i, phase: 'Conflict Day 4' },
  { pattern: /day[\s_-]?10|conflict[\s_-]?day[\s_-]?10|phase[\s_-]?4/i, phase: 'Conflict Day 10' },
  { pattern: /day[\s_-]?22|conflict[\s_-]?day[\s_-]?22|phase[\s_-]?5/i, phase: 'Conflict Day 22' },
  { pattern: /negotiation|phase[\s_-]?6/i, phase: 'Negotiation' },
];

const TYPE_HEURISTICS = [
  { pattern: /sitrep|situation[\s_-]?report|situation[\s_-]?update/i, type: 'SITREP' },
  { pattern: /alertord|alert[\s_-]?order/i, type: 'ALERTORD' },
  { pattern: /frago|fragmentary/i, type: 'FRAGO' },
  { pattern: /oob|order[\s_-]?of[\s_-]?battle/i, type: 'OOB' },
  { pattern: /campaign[\s_-]?plan/i, type: 'CAMPAIGN_PLAN' },
  { pattern: /policy[\s_-]?sheet|country[\s_-]?policy/i, type: 'COUNTRY_POLICY' },
  { pattern: /directive/i, type: 'ALERTORD' },
];
```

### Pattern 3: Extending ValidityMap for IPB Layers
**What:** Add new layer types to the existing `ValidityMap` component using Leaflet `LayersControl.Overlay` for each IPB layer. Use `L.Polygon`, `L.Polyline`, and existing `L.divIcon` markers styled with the new force affiliation colors.
**When to use:** All IPB overlay rendering.
**Example:**
```typescript
// Source: Extends existing ValidityMap.tsx pattern
// Blue force color: #4a9eff (existing actor color for 'nation')
// Red force color: #ff6b6b (existing contradicting event color)
// IPB-specific layers follow the same LayersControl pattern:

const IPB_LAYER_COLORS = {
  blue_forces: '#0066cc',        // Blue force disposition
  red_forces: '#cc0000',         // Red force disposition (as assessed)
  red_self: '#990000',           // Red as Red sees themselves
  key_terrain: '#50c878',        // Key terrain
  avenue_of_approach: '#ffa500', // Avenues of approach
  named_area: '#ffcc00',         // Named Areas of Interest (NAI)
  engagement_area: '#ff00ff',    // Engagement Areas
  obstacle: '#888888',           // Obstacles
};

// Add to ValidityMap props:
interface IPBLayer {
  id: string;
  name: string;
  type: 'unit' | 'area' | 'line' | 'point';
  team: 'blue' | 'red';
  layerType: 'forces' | 'key_terrain' | 'avenue_of_approach' | 'nai' | 'engagement_area' | 'obstacle';
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
  sidc?: string; // MIL-STD-2525D for force symbols
}
```

### Pattern 4: COA Combined Scoring
**What:** Take the 5 doctrinal criteria scores (feasibility, acceptability, suitability, distinguishability, completeness) from existing `COAComparisonScore` structure and augment each criterion's score using wargaming outcomes from the existing `WargamingSession.outcomes`.
**When to use:** After wargaming session completes for a COA pair.
**Example:**
```typescript
// Source: Combines existing planning/types.ts COAComparisonScore + wargaming/types.ts
export interface ExerciseCOAScore {
  // 5 doctrinal criteria (0-100 each) — default weights discretionary
  feasibility: { score: number; rationale: string; wargameEvidence?: string };
  acceptability: { score: number; rationale: string; wargameEvidence?: string };
  suitability: { score: number; rationale: string; wargameEvidence?: string };
  distinguishability: { score: number; rationale: string; wargameEvidence?: string };
  completeness: { score: number; rationale: string; wargameEvidence?: string };
  // Combined score — weights are Claude's discretion (default: equal 20% each)
  combinedScore: number;
  // AI narrative synthesis (staff-editable before presenting to commander)
  narrative: string;
  // Wargaming session reference for traceability
  wargamingSessionId?: string;
}
```

### Pattern 5: WARNORD/OPORD/FRAGO with Team Perspective
**What:** Extend the existing OPORD 5-paragraph structure with exercise-specific fields. Generate separate instances for Blue and Red, each populated only with that team's visible intelligence. Use the existing `docx-generator.ts` and `pdf-generator.ts` generators.
**When to use:** Every order generation call.
**Example:**
```typescript
// Source: Extends backend/src/planning/types.ts OperationalPlan
export interface ExerciseOrder {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red';       // Which team this order is for
  orderType: 'WARNORD' | 'OPORD' | 'FRAGO';
  exercisePhase: string;       // 'Competition' | 'Crisis' | etc.
  version: number;
  // For OPORD: full 5-para structure (existing SituationParagraph, etc.)
  // For WARNORD: condensed situation + mission + initial tasks
  // For FRAGO: only changed paragraphs
  content: WARNORDContent | OPORDContent | FRAGOContent;
  // Tasks created from this order for the planning board
  taskAssignments: PlanningTask[];
  status: 'draft' | 'published';
  publishedAt?: Date;
}

// WARNORD content structure
export interface WARNORDContent {
  situation: string;           // Brief operational situation
  missionStatement: string;    // Initial mission
  commandersIntent: string;    // Early intent guidance
  initialTasks: Array<{
    assignedTo: 'blue_staff' | 'red_cell' | 'exercise_control';
    task: string;
    purpose: string;
    deadline?: string;
  }>;
  timelineSummary: string;
  serviceAndSupport: string;
  commandAndSignal: string;
}
```

### Pattern 6: Planning Board Task Lifecycle
**What:** When an order is published, automatically create `planning_tasks` rows for each task in the order's `taskAssignments`. Track status through 'pending' → 'in_progress' → 'complete'. Notify assigned teams via existing `MessageBus`.
**When to use:** Every order publication event.
**Example:**
```typescript
// Source: Integrates with backend/src/messaging/message-bus.ts
async function publishOrder(orderId: string, bus: MessageBus) {
  const order = await orderStore.findById(orderId);

  // Create planning tasks
  for (const task of order.taskAssignments) {
    await taskStore.create({
      orderId: order.id,
      scenarioId: order.scenarioId,
      team: order.team,
      assignedRole: task.assignedTo,
      title: task.task,
      description: task.purpose,
      deadline: task.deadline ? new Date(task.deadline) : undefined,
      status: 'pending',
    });
  }

  // Mark order published
  await orderStore.markPublished(orderId);

  // Notify via message bus
  await bus.publish('exercise.order.published', {
    orderId,
    team: order.team,
    orderType: order.orderType,
    exercisePhase: order.exercisePhase,
    taskCount: order.taskAssignments.length,
  });
}
```

### Anti-Patterns to Avoid
- **Implementing hex grid rendering:** CONTEXT.md explicitly defers this — convert hex map zones to geographic polygon overlays using the hex map's named regions (e.g., "Western Pacific 200nm hex" → `L.Polygon` over the approximate geographic area).
- **Storing Blue data visible to Red in the same unguarded query:** Always add `AND team = ANY($visibleTeams)` to every scenario data query. Never return unfiltered JSONB columns that might contain cross-team data.
- **One upload → one document:** The package upload endpoint must accept multi-file (directory) uploads. Use `multer.array()` or a zip upload + server-side unzip, not single-file upload. The `multer` library (v2.0.2 installed) supports `array()` mode.
- **Auto-triggering phase transitions:** CONTEXT.md explicitly locks this: phase transitions are explicit commander/controller decisions, not automatic. Do not build timer-based phase advancement.
- **Ignoring the scenario designation tag:** All exercise documents must carry `designation: 'training/exercise'` so they are not confused with real operational documents in the existing strategic planning system.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF/DOCX/PPTX text extraction | Custom parsers | `unpdf` + `officeparser` (already in `document-parser.ts`) | Already handles multi-page PDFs, PPTX slides, DOCX paragraphs; battle-tested |
| LLM-based structured extraction | Custom LLM loop | Existing `ExtractionService` + new system prompt for exercise context | Multi-provider, chunked, dedup, audit log, progress callbacks already implemented |
| Map rendering | Custom canvas renderer | react-leaflet v5 + Leaflet v1.9.4 (already configured with Stadia Maps) | Full GIS feature set; existing `ValidityMap` pattern ready to extend |
| Military symbol rendering | SVG hand-drawing | `milsymbol` v3.0.3 (already in `symbol-renderer.ts` and frontend) | Full MIL-STD-2525D; battle-tested; used throughout codebase |
| Order document generation | Template strings → HTML | `docx` + `pdfkit` generators (already in `docx-generator.ts`, `pdf-generator.ts`) | Styled military-format documents; re-use existing OPORD template |
| Workflow state management | Custom state flags | `xstate` v5 (already in `jp50-machine.ts`) | Formal state machine prevents invalid transitions |
| Background job processing | `setTimeout` loops | `pg-boss` (already installed, used in `message-bus.ts`) | Reliable delivery, retry logic, PostgreSQL-backed persistence |
| COA wargaming | New simulation engine | Existing `WargamingService` / `WargamingEngine` in `backend/src/wargaming/` | Already implements automated cycles + interactive what-if; just call it |
| Information messaging | WebSockets direct | Existing `MessageBus` (`pg-boss` backed) in `messaging/message-bus.ts` | ABAC-filtered, persistent, already deployed |
| Blockchain anchoring | Direct NEAR SDK calls | Existing `outbox` table + blockchain-sync pattern | Consistent with existing commander decision recording approach |

**Key insight:** Phase 14 is a composition phase. Every individual technical capability already exists — the work is wiring them together with the exercise-specific schema, information barriers, and dual-perspective data model.

---

## Common Pitfalls

### Pitfall 1: PPTX Extraction Loses Slide Structure
**What goes wrong:** `officeparser` extracts PPTX as flat text, losing slide order and visual relationships between text boxes. Campaign Plans in PPTX format (like `AY26 Pacific Strategy_Student Slides.pptx`) may have information encoded in slide layout (e.g., a red box on slide 4 denotes "Red force objective").
**Why it happens:** `OfficeParser.parseOffice()` calls `.toText()` which flattens the entire presentation.
**How to avoid:** Accept the limitation — use the extracted text for LLM extraction, but prompt the LLM to look for slide markers like "SLIDE N:" or numbered sections. For critical structural data (OOBs, force dispositions), prioritize PDF and DOCX sources over PPTX. The LLM extraction prompt should explicitly note "this content is from a slide deck; slide boundaries may not be preserved."
**Warning signs:** Extracted text from PPTX has no structure, or items from different slides are run together without context separators.

### Pitfall 2: Information Barrier Leaks via JSONB Columns
**What goes wrong:** PostgreSQL JSONB columns on `ipb_assessments` might embed cross-team data (e.g., Red force dispositions stored in Blue's assessment object from a lazy extraction). When the Blue IPB is serialized and sent to the client, it inadvertently carries Red-visible intelligence.
**Why it happens:** The extraction service processes all documents and stores results; if the JSONB content is not filtered before storage or retrieval, leakage occurs at the data layer.
**How to avoid:** IPB assessments must be stored with strict `team` column tagging and generated per-team from only that team's visible documents. Never generate a single "combined" IPB and then filter at display time — generate two separate IPB assessments at write time.
**Warning signs:** Blue staff can see exact Red unit positions that they shouldn't know.

### Pitfall 3: Multi-File Upload Filename Collisions
**What goes wrong:** Multiple teams may have files with the same name (e.g., both Blue and Red have a `Day4_SITREP.pdf`). If the upload stores files by filename, they collide or overwrite each other.
**Why it happens:** Standard multer single-file upload patterns use original filename.
**How to avoid:** Store files by UUID (already done via `randomUUID()` pattern in existing stores). Always use `id` as the storage key, not filename. Preserve original filename in `filename` column for display only.
**Warning signs:** Only one of two similarly-named files appears after upload.

### Pitfall 4: Leaflet Map Performance with Many IPB Layers
**What goes wrong:** Rendering 20+ IPB layers (all force units, NAIs, avenues of approach, terrain overlays) simultaneously causes Leaflet to drop to low frame rates, especially on the Western Pacific scale (~5000nm radius).
**Why it happens:** Each layer adds DOM elements; at the 200nm hex scale, the map is zoomed out far and many elements overlap.
**How to avoid:** Use `L.LayerGroup` for each category and respect the layer toggle pattern already established in `ValidityMap.tsx`. Apply `maxZoom`/`minZoom` visibility guards: show detailed unit icons only at zoom >= 7, show AO outlines at all zoom levels. For OOBs with 100+ units, use cluster markers via `leaflet.markercluster` (not installed — see below).
**Warning signs:** Map freezes or stutters when toggling on Blue Forces layer with full OOB.

**Note on `leaflet.markercluster`:** Not currently installed. If OOBs exceed ~50 markers, install `leaflet.markercluster` + `@types/leaflet.markercluster`. This is a LOW risk — the Indo-Pacific OOB at this scale won't hit 50+ geo-distinct positions.

### Pitfall 5: Wargaming Session State Lost Between Phase Transitions
**What goes wrong:** The existing `WargamingService` stores sessions in-memory (`private sessions: Map<string, WargamingSession>`). When the server restarts or a new session begins a new exercise phase, prior wargaming results are lost.
**Why it happens:** Phase 5.2 wargaming is explicitly noted as in-memory with TODO for PostgreSQL migration.
**How to avoid:** For Phase 14, create wargaming sessions linked to `scenario_coas` and persist session results into the `scenario_coas.wargame_evidence` JSONB column after session completion. Don't rely on the in-memory WargamingService across requests.
**Warning signs:** COA comparison scores lose their wargame evidence after server restart.

### Pitfall 6: OPORD Generator Expects Existing Plan Structure
**What goes wrong:** The existing `generateOPORDDocx()` and `generateOPORDPdf()` generators read from the `operational_plans` PostgreSQL table via `planStore.findById()`. For exercise orders, there is no `operational_plans` row.
**Why it happens:** Generator is tightly coupled to `planStore`.
**How to avoid:** Create new exercise-specific order generators that accept the `ExerciseOrder` type directly, or refactor the existing generators to accept a data object (not a DB ID lookup). Given the extent of exercise-specific fields, a new generator that reuses the existing template structure is cleaner.
**Warning signs:** Calling `generateOPORDDocx(exerciseOrderId)` throws "Plan not found".

---

## Code Examples

Verified patterns from existing codebase sources:

### Extending DocumentParser for Multi-File Upload
```typescript
// Source: backend/src/strategic/ingestion/document-parser.ts (existing)
// For package upload, use multer.array() and call parse() on each file:
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
router.post('/scenario/upload', upload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  for (const file of files) {
    const tags = inferTagsFromPath(file.originalname, file.fieldname);
    const content = await parser.parse(file.buffer, file.mimetype);
    await scenarioDocumentStore.create({ ...tags, textContent: content.text });
  }
});
```

### Extending ValidityMap with IPB Layers
```typescript
// Source: frontend/src/components/validity/ValidityMap.tsx (existing)
// Add to props interface:
interface ValidityMapProps {
  // ... existing props ...
  ipbLayers?: IPBLayer[];
  perspective?: 'blue' | 'red';
  onPerspectiveChange?: (p: 'blue' | 'red') => void;
}

// Add LayersControl.Overlay for each IPB layer type:
<LayersControl.Overlay checked name="Blue Force Dispositions">
  <LayerGroup>
    {ipbLayers?.filter(l => l.layerType === 'forces' && l.team === 'blue').map(layer => (
      <Marker key={layer.id} position={...} icon={createMilSymbolIcon(layer.sidc)} />
    ))}
  </LayerGroup>
</LayersControl.Overlay>
```

### Calling Existing Wargaming Engine for COA Scoring Evidence
```typescript
// Source: backend/src/wargaming/wargaming-service.ts (existing)
import { wargamingService } from '../wargaming/wargaming-service.js';

async function runCOAWargame(coaId: string, adversaryCOAId: string) {
  const session = await wargamingService.createSession({
    friendlyCOA: { id: coaId, description: '...' },
    adversaryCOAs: [{ id: adversaryCOAId, description: '...' }],
    cycles: 5,
    autoRunFirst: true,
  }, userDID);

  const completed = await wargamingService.startAutoRun(session.id);
  const finalized = await wargamingService.completeSession(session.id);

  // Store outcomes in scenario_coas.wargame_evidence
  await coaStore.updateWargameEvidence(coaId, {
    sessionId: session.id,
    outcomes: finalized.outcomes,
    decisionPoints: finalized.allDecisionPoints,
  });
}
```

### Commander Decision NEAR Blockchain Anchoring
```typescript
// Source: Pattern from backend/src/lib/blockchain-sync.ts + planning/roe/audit.ts
import { createHash } from 'crypto';

async function recordCommanderDecision(coaId: string, decision: CommanderDecision) {
  // Persist to PostgreSQL
  await coaStore.recordDecision(coaId, decision);

  // Hash the decision record for tamper-evidence
  const record = JSON.stringify({ coaId, decision, timestamp: new Date().toISOString() });
  const hash = createHash('sha256').update(record).digest('hex');

  // Write to outbox for blockchain anchoring (existing pattern)
  await pool.query(
    `INSERT INTO outbox (aggregate_id, payload) VALUES ($1, $2)`,
    [coaId, JSON.stringify({ type: 'commander_decision', hash, coaId })]
  );

  await coaStore.updateDecisionHash(coaId, hash);
}
```

### Exercise-Context Extraction System Prompt
```typescript
// Source: Extends backend/src/strategic/extraction/extractor.ts EXTRACTION_SYSTEM_PROMPT
const EXERCISE_EXTRACTION_SYSTEM_PROMPT = `You are a military exercise analyst extracting structured data from exercise scenario documents.

This document is from a training/exercise package (designation: training/exercise).
Team context: {team} | Exercise phase: {exercisePhase} | Document type: {documentType}

Extract the following based on document type:
- OOB: Force composition, unit designations, equipment types, strength estimates, echelon
- SITREP/FRAGO: Situation updates, force movements, key events, changed objectives
- CAMPAIGN_PLAN: Strategic objectives, operational phasing, COA descriptions
- ALERTORD: Mission assignment, task organization, timeline, initial tasks
- COUNTRY_POLICY: Access/basing/overflight status for {team} forces, conditions, limitations

Use the extract_exercise_data tool to provide structured output.
Do NOT mix intelligence visible to {team} with information they would not have.`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-team planning (Phase 5) | Dual-team exercise environment with information barriers | Phase 14 (now) | Requires new information architecture |
| Generic strategic docs extraction | Exercise-typed extraction with side/phase/type tagging | Phase 14 (now) | New extraction system prompt and schema |
| ValidityMap shows only OSINT events | ValidityMap extended with IPB military layers + perspective toggle | Phase 14 (now) | Component props expansion, new layer types |
| In-memory WargamingSession | Wargame results persisted to scenario_coas JSONB | Phase 14 (now) | Required for cross-request durability |
| planStore-coupled OPORD generators | Exercise-specific order generators | Phase 14 (now) | New generator accepting ExerciseOrder type |

**Deprecated/outdated in this context:**
- `StrategicDocumentLevel` enum (NSS/NDS/NMS/etc.): Exercise documents use a new `ExerciseDocumentType` enum (OOB, SITREP, ALERTORD, etc.) — don't force exercise docs into the strategic hierarchy.
- Single-upload modal from `DocumentUpload.tsx`: Phase 14 needs multi-file (directory) upload with preview of inferred tags before extraction.

---

## Open Questions

1. **Zip vs individual file upload for scenario package**
   - What we know: `multer.array()` supports multiple files in a single POST; browser File System Access API allows directory selection; multer v2 in use
   - What's unclear: The web standard `<input type="file" webkitdirectory>` attribute allows directory selection in modern browsers but does not preserve subdirectory path in `file.name` consistently across browsers (Chrome: includes full relative path; Firefox: varies)
   - Recommendation: Use zip upload (single file) + server-side unzip using the `adm-zip` npm package (not installed, simple to add, ~100KB). This preserves directory structure reliably. Alternatively, send relative path as a hidden field alongside each file upload. Research the browser behavior before implementing.

2. **Leaflet marker clustering for dense OOBs**
   - What we know: `leaflet.markercluster` is not installed; standard Leaflet handles up to ~200 markers comfortably at moderate zoom levels; Indo-Pacific exercise has ~20-40 distinct geo units
   - What's unclear: Whether the PPTX/PDF OOB extraction will produce precise geo coordinates or named locations requiring geocoding
   - Recommendation: Proceed without clustering. Use named location → approximate coordinate mapping for the Western Pacific theater (Taiwan Strait, South China Sea, etc.). If coordinates are missing, render units at a theater-level location with popup showing disposition data.

3. **SITREP Delta Detection Algorithm**
   - What we know: CONTEXT.md marks SITREP delta thresholds as Claude's discretion; IPB version history must be preserved
   - What's unclear: The optimal algorithm for detecting "significant" changes between SITREP extractions
   - Recommendation: Simple approach — compare extracted JSON fields for each SITREP against the previous version; flag changes where force disposition, objectives, or key events differ by more than a configurable threshold (default: any change = flag). Don't build semantic similarity; use field-level equality checks and AI summary of diffs.

---

## Sources

### Primary (HIGH confidence)
- **Codebase direct inspection** — `backend/src/strategic/ingestion/document-parser.ts`, `extractor.ts`, `wargaming/wargaming-service.ts`, `wargaming-engine.ts`, `planning/stores/plan-store.ts`, `planning/graphics/symbol-renderer.ts`, `planning/documents/generators/docx-generator.ts`, `raft/templates/mdmp-ipb-analysis.ts`, `messaging/message-bus.ts`, `lib/blockchain-sync.ts`
- **Frontend codebase** — `frontend/src/components/validity/ValidityMap.tsx`, `COASketchMap.tsx`, `mission/map/MilSymbolMarker.tsx`, `App.tsx`, tab components
- **Existing type definitions** — `planning/types.ts`, `mdmp/types.ts`, `planning/schemas.ts`
- **Package manifests** — `backend/package.json`, `frontend/package.json` (verified all libraries)
- **Scenario directory** — `scenario/` structure inspected: blue team/, red team/, scenario phases/ confirmed

### Secondary (MEDIUM confidence)
- **CONTEXT.md locked decisions** — all architectural choices verified against codebase capabilities
- **ATP 2-01.3 IPB doctrine** (represented in `mdmp-ipb-analysis.ts` RAFT template) — OAKOC, ASCOPE, NAI, threat assessment structures verified in existing code
- **react-leaflet v5 documentation patterns** — confirmed compatible with existing `ValidityMap.tsx` usage of `LayersControl`, `LayerGroup`, `MapContainer`

### Tertiary (LOW confidence — note for validation)
- `adm-zip` npm package for zip extraction — not installed; verify current version and API before implementing zip-based package upload
- `leaflet.markercluster` — not needed for current scale but noted as option if OOB density grows

---

## Metadata

**Confidence breakdown:**
- Document-to-Scenario Pipeline: HIGH — existing `DocumentParser` and `ExtractionService` verified; multi-file upload pattern is standard multer; heuristic tagging is novel but low-risk
- Dual-Perspective IPB Map: HIGH — `ValidityMap`, react-leaflet, milsymbol all verified in codebase; extension is additive
- COA Scoring: HIGH — existing `COAComparisonScore` structure matches; `WargamingService` verified; combination pattern is clear
- Order Generation: HIGH — existing OPORD generators verified; new exercise-specific generator design is clean extension
- Information Barriers: HIGH — PostgreSQL row-level pattern is established; team-filtered query pattern is straightforward
- Planning Board: HIGH — `pg-boss` + `MessageBus` already installed; task table schema is simple
- Commander Decision + Blockchain: HIGH — existing outbox + blockchain-sync pattern verified; NEAR hashing straightforward

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable dependencies; doctrine-aligned; 30 days)
