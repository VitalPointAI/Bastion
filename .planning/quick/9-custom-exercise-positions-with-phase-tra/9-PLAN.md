---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/db/migrations/025-exercise-positions.sql
  - backend/src/exercise/position-store.ts
  - backend/src/exercise/position-types.ts
  - backend/src/api/problem-sets.ts
  - frontend/src/lib/position-service.ts
  - frontend/src/components/exercise/TeamRoster.tsx
  - frontend/src/components/exercise/TeamRoster.css
  - frontend/src/components/tabs/UnderstandTab.tsx
  - scripts/seed-positions.ts
autonomous: true
requirements: [POS-01, POS-02, POS-03, POS-04, POS-05]
must_haves:
  truths:
    - "Positions can be created for a problem set with side, title, duties, and optional member assignment"
    - "Each position can have different title/duties per scenario phase via phase mappings"
    - "Team Roster UI shows positions grouped by side with phase-transition editing"
    - "A starter template of positions can be loaded from seed data"
  artifacts:
    - path: "backend/src/db/migrations/025-exercise-positions.sql"
      provides: "exercise_positions and exercise_position_phase_mappings tables"
      contains: "CREATE TABLE exercise_positions"
    - path: "backend/src/exercise/position-store.ts"
      provides: "CRUD for positions and phase mappings"
      exports: ["PositionStore"]
    - path: "backend/src/api/problem-sets.ts"
      provides: "REST endpoints for positions under problem set routes"
    - path: "frontend/src/components/exercise/TeamRoster.tsx"
      provides: "Team roster UI with side grouping and phase mapping editor"
    - path: "frontend/src/lib/position-service.ts"
      provides: "Frontend API client for position endpoints"
  key_links:
    - from: "frontend/src/components/exercise/TeamRoster.tsx"
      to: "/api/problem-sets/:id/positions"
      via: "position-service.ts fetch calls"
      pattern: "positionService\\."
    - from: "frontend/src/components/tabs/UnderstandTab.tsx"
      to: "TeamRoster.tsx"
      via: "sidebar item in training mode"
      pattern: "TeamRoster"
    - from: "backend/src/api/problem-sets.ts"
      to: "position-store.ts"
      via: "store method calls"
      pattern: "positionStore\\."
---

<objective>
Build a custom exercise position roster system with phase-transition mapping. Positions belong to a problem set, have a side (blue/red/neutral/green), title, duties, and optional NEAR account assignment. Each position can map to different titles/duties per exercise phase (Competition, Crisis, Conflict, etc.) reflecting how roles transform as scenarios escalate.

Purpose: Replace the hardcoded 31 JPP staff roles with flexible per-exercise position rosters that support multi-sided wargaming with evolving responsibilities across scenario phases.

Output: Database tables, backend CRUD API, frontend Team Roster panel in Understand tab (training mode), and seed template script.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/src/exercise/scenario-store.ts (store pattern to follow)
@backend/src/exercise/types.ts (ExerciseScenario.exercisePhases — the phase list positions map to)
@backend/src/api/problem-sets.ts (API route pattern — positions nest here)
@frontend/src/lib/problem-set-service.ts (frontend service pattern)
@frontend/src/components/tabs/UnderstandTab.tsx (where TeamRoster sidebar item goes)
@backend/src/db/migrations/024-doctrinal-tabs.sql (migration file naming pattern)

<interfaces>
<!-- Key types the executor needs -->

From backend/src/exercise/types.ts:
```typescript
export interface ExerciseScenario {
  id: string;
  name: string;
  designation: 'training/exercise' | 'operational';
  exercisePhases: string[];  // e.g. ["Competition", "Crisis", "Conflict Day 4", ...]
  currentPhaseIndex: number;
  // ...
}
```

From backend/src/exercise/scenario-store.ts (store pattern):
```typescript
export class ScenarioStore {
  private pool = getPool();
  // Uses rowToX mapper, getPool() from '../lib/database.js', randomUUID
  // Standard CRUD: create, findById, findAll, update, delete
}
```

From backend/src/api/problem-sets.ts (route pattern):
```typescript
// Uses: Router, z (zod), requireAuth, stores imported at top
// Routes nested under /api/problem-sets/:problemSetId/...
// Auth via requireAuth middleware, X-DID header
```

From frontend/src/lib/problem-set-service.ts (service pattern):
```typescript
class ProblemSetService {
  private baseUrl = `${API_BASE}/api/problem-sets`;
  private async fetchJSON<T>(url: string, options?: RequestInit): Promise<T> { ... }
  // Methods: async methodName(problemSetId, ..., userDID): Promise<T>
}
export const problemSetService = new ProblemSetService();
```

From frontend/src/components/tabs/UnderstandTab.tsx:
```typescript
// Uses TabLayout with SidebarItem[], selectedView state
// Training mode items shown conditionally: ...(mode === 'training' ? [...] : [])
// useMode() from ModeContext
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Database migration, types, store, and API endpoints for exercise positions</name>
  <files>
    backend/src/db/migrations/025-exercise-positions.sql
    backend/src/exercise/position-types.ts
    backend/src/exercise/position-store.ts
    backend/src/api/problem-sets.ts
  </files>
  <action>
**Migration (025-exercise-positions.sql):**

Create two tables:

```sql
CREATE TABLE IF NOT EXISTS exercise_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id UUID NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  side VARCHAR(20) NOT NULL CHECK (side IN ('blue', 'red', 'neutral', 'green')),
  title VARCHAR(200) NOT NULL,
  duties TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  assigned_to VARCHAR(200),  -- NEAR account ID (optional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercise_positions_problem_set ON exercise_positions(problem_set_id);

CREATE TABLE IF NOT EXISTS exercise_position_phase_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES exercise_positions(id) ON DELETE CASCADE,
  exercise_phase VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  duties TEXT,
  UNIQUE(position_id, exercise_phase)
);

CREATE INDEX idx_position_phase_mappings_position ON exercise_position_phase_mappings(position_id);
```

**Types (position-types.ts):**

```typescript
export type PositionSide = 'blue' | 'red' | 'neutral' | 'green';

export interface ExercisePosition {
  id: string;
  problemSetId: string;
  side: PositionSide;
  title: string;
  duties: string | null;
  sortOrder: number;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  phaseMappings?: PositionPhaseMapping[];
}

export interface PositionPhaseMapping {
  id: string;
  positionId: string;
  exercisePhase: string;
  title: string;
  duties: string | null;
}

export interface CreatePositionInput {
  side: PositionSide;
  title: string;
  duties?: string;
  sortOrder?: number;
  assignedTo?: string;
  phaseMappings?: Array<{ exercisePhase: string; title: string; duties?: string }>;
}

export interface UpdatePositionInput {
  side?: PositionSide;
  title?: string;
  duties?: string;
  sortOrder?: number;
  assignedTo?: string | null;
}
```

**Store (position-store.ts):**

Follow the ScenarioStore pattern exactly (getPool, rowToPosition mapper, class with methods).

Methods needed:
- `findByProblemSet(problemSetId: string): Promise<ExercisePosition[]>` — returns all positions for a problem set with their phaseMappings eagerly loaded. Use a LEFT JOIN on exercise_position_phase_mappings, then group in JS (or two queries). ORDER BY side, sort_order, title.
- `create(problemSetId: string, input: CreatePositionInput): Promise<ExercisePosition>` — insert position row, then insert any phaseMappings rows. Return the full position with mappings.
- `update(id: string, input: UpdatePositionInput): Promise<ExercisePosition>` — update position fields. Return with mappings.
- `delete(id: string): Promise<void>` — delete position (cascades to mappings).
- `setPhaseMappings(positionId: string, mappings: Array<{ exercisePhase: string; title: string; duties?: string }>): Promise<PositionPhaseMapping[]>` — DELETE existing mappings for this position, INSERT new ones. Return the new mappings. This is a full replacement strategy (simpler than individual CRUD on mappings).
- `bulkCreate(problemSetId: string, positions: CreatePositionInput[]): Promise<ExercisePosition[]>` — for seed template loading. Wraps multiple create calls.

**API endpoints (add to problem-sets.ts):**

Import PositionStore at top of problem-sets.ts, instantiate as `const positionStore = new PositionStore();`.

Add these routes (all require auth, use problemSetId from params):

- `GET /api/problem-sets/:problemSetId/positions` — returns `{ positions: ExercisePosition[] }` with phaseMappings included.
- `POST /api/problem-sets/:problemSetId/positions` — body: CreatePositionInput. Returns `{ position: ExercisePosition }`.
- `PATCH /api/problem-sets/:problemSetId/positions/:positionId` — body: UpdatePositionInput. Returns `{ position: ExercisePosition }`.
- `DELETE /api/problem-sets/:problemSetId/positions/:positionId` — returns 204.
- `PUT /api/problem-sets/:problemSetId/positions/:positionId/phase-mappings` — body: `{ mappings: Array<{ exercisePhase: string; title: string; duties?: string }> }`. Returns `{ mappings: PositionPhaseMapping[] }`.
- `POST /api/problem-sets/:problemSetId/positions/bulk` — body: `{ positions: CreatePositionInput[] }`. For template loading. Returns `{ positions: ExercisePosition[] }`.

Use zod validation for request bodies (follow existing pattern in problem-sets.ts). Validate side enum, title length (1-200), duties optional text.

Run the migration: `psql $DATABASE_URL -f backend/src/db/migrations/025-exercise-positions.sql` (or use the project's migration runner if one exists; otherwise just run directly).
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && npx tsc --noEmit --project backend/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - Two new database tables created (exercise_positions, exercise_position_phase_mappings)
    - PositionStore with full CRUD + phase mapping replacement + bulk create
    - 6 new API endpoints under /api/problem-sets/:id/positions
    - TypeScript compiles cleanly
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend position service, TeamRoster UI, and Understand tab integration</name>
  <files>
    frontend/src/lib/position-service.ts
    frontend/src/components/exercise/TeamRoster.tsx
    frontend/src/components/exercise/TeamRoster.css
    frontend/src/components/tabs/UnderstandTab.tsx
  </files>
  <action>
**Position service (position-service.ts):**

Follow problem-set-service.ts pattern. Create a PositionService class with:

```typescript
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// Re-export types for frontend use
export interface ExercisePosition { ... } // mirror backend types
export interface PositionPhaseMapping { ... }
export type PositionSide = 'blue' | 'red' | 'neutral' | 'green';

class PositionService {
  private baseUrl(problemSetId: string) {
    return `${API_BASE}/api/problem-sets/${problemSetId}/positions`;
  }

  private async fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    // Same pattern as ProblemSetService.fetchJSON
  }

  async listPositions(problemSetId: string, userDID: string): Promise<ExercisePosition[]>
  async createPosition(problemSetId: string, input: CreatePositionInput, userDID: string): Promise<ExercisePosition>
  async updatePosition(problemSetId: string, positionId: string, input: UpdatePositionInput, userDID: string): Promise<ExercisePosition>
  async deletePosition(problemSetId: string, positionId: string, userDID: string): Promise<void>
  async setPhaseMappings(problemSetId: string, positionId: string, mappings: PhaseMappingInput[], userDID: string): Promise<PositionPhaseMapping[]>
  async bulkCreate(problemSetId: string, positions: CreatePositionInput[], userDID: string): Promise<ExercisePosition[]>
}

export const positionService = new PositionService();
```

**TeamRoster component (TeamRoster.tsx):**

Props: `{ problemSetId: string }`.

State: positions array, loading boolean, editing position ID, add form visibility, selected phase filter.

Behavior:
1. On mount, fetch positions via positionService.listPositions.
2. Also fetch the linked scenario (via problemSetService.getLinkedScenario) to get the exercisePhases array for phase mapping dropdowns.
3. Display positions grouped by side in collapsible sections. Use side colors: blue=#3b82f6, red=#ef4444, neutral=#6b7280, green=#22c55e. Show count per side in section headers.
4. Each position card shows: title, duties (truncated), assigned member (or "Unassigned"), and a small badge showing the number of phase mappings.
5. Clicking a position opens an inline edit form: title, duties textarea, side dropdown, assigned_to text input (NEAR account), sort order number.
6. A "Phase Mappings" expandable section within the edit form shows a row per exercise phase. Each row has: phase name (read-only label), title input, duties textarea. Pre-fill from existing mappings if any. Save replaces all mappings via setPhaseMappings.
7. "Add Position" button at top opens a creation form (same fields as edit + optional phase mappings).
8. Delete button with confirmation on each position.
9. "Load Template" button that calls bulkCreate with the Army War College position template (hardcode the template data directly in the component or a separate constant file). The template data structure from the reference document:

Competition phase positions (all neutral side initially, single unified roster):
- JPG Lead, Regional Planner - Zone A/B/C, Military Exercise Planner, Economic Advisor, DoS Representative

Then phase mappings for Crisis and Conflict phases showing the blue/red split with different titles per phase per the reference document.

Actually, simpler approach: the "Load Template" creates separate blue and red positions with phase mappings that reflect the AWC document. Include positions for both sides with phase-specific titles from the reference doc.

Style with TeamRoster.css using the project's existing CSS patterns (check neighboring CSS files for patterns). Keep it clean and functional, military-dashboard style.

**UnderstandTab integration:**

Add a new sidebar item in UnderstandTab.tsx:
- ID: `'team-roster'`
- Label: `'Team Roster'`
- Only visible in training mode (add to the `mode === 'training'` conditional spread, alongside training-packages)
- Add the view type to the UnderstandView union: `'team-roster'`
- Import TeamRoster and render it when `selectedView === 'team-roster'`

Also update the useEffect that resets view on mode change to include 'team-roster'.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - PositionService provides full API client for position CRUD and phase mappings
    - TeamRoster component renders positions grouped by side with inline editing
    - Phase mapping editor shows a row per exercise phase with title/duties fields
    - "Load Template" button seeds AWC-style position roster
    - Team Roster appears in Understand tab sidebar when in training mode
    - TypeScript compiles cleanly
  </done>
</task>

<task type="auto">
  <name>Task 3: Seed script for Army War College position template</name>
  <files>
    scripts/seed-positions.ts
  </files>
  <action>
Create a standalone seed script that can be run via `npx tsx scripts/seed-positions.ts <problemSetId>` to load the AWC "A Way" position template into a problem set.

The script should:
1. Accept a problem set ID as CLI argument
2. Use the backend's getPool() directly (import from backend/src/lib/database.ts)
3. Insert the following positions based on the reference document:

**Competition phase (unified roster — all positions are 'neutral' side):**
- JPG Lead (duties: "Leads the Joint Planning Group through all phases")
- Regional Planner - Zone A (duties: "Responsible for regional analysis and planning in Zone A")
- Regional Planner - Zone B
- Regional Planner - Zone C
- Military Exercise Planner (duties: "Plans and coordinates military exercise components")
- Economic Advisor (duties: "Provides economic analysis and policy recommendations")
- DoS Representative (duties: "State Department liaison for interagency coordination")

**Phase mappings for each position — showing how they transform across phases:**

For JPG Lead:
- Competition: title="JPG Lead", duties="Leads the Joint Planning Group"
- Crisis: title="CJ35 Planner" (side stays neutral but duties shift to "Crisis action planning and future operations")
- Conflict: title="CJ5" (duties: "Strategic plans and policy in conflict")

For Regional Planner - Zone C:
- Competition: title="Regional Planner - Zone C"
- Crisis: title="Eastern Theater Cmd LNO" (duties: "Liaison to Eastern Theater Command")
- Conflict: title="Maritime Ops Subcenter" (duties: "Maritime operations coordination")

Also create explicit blue and red side positions for Crisis/Conflict phases:

**Blue positions (side='blue'):**
- Commander (phase mappings: Crisis="Blue Cell Lead", Conflict="Commander")
- USARPAC LNO, PACFLT/MARFORPAC LNO, PACAF LNO, J4/TRANSCOM LNO, Intel/Enablers, DoS Rep
- Conflict additions: CJFLCC, CJFMCC, CJFACC, CJ3

**Red positions (side='red'):**
- Red Cell Lead (phase mappings: Crisis="JPG Lead (Red)", Conflict="Commander (Red)")
- CJ35 Planner (Red), Eastern Theater Cmd LNO, Southern Theater Cmd LNO
- PLA Air Force Planner, PLA Rocket Force Planner, Intel/Enablers (Red), DoS Rep (Red)
- Conflict: Land Ops, Maritime Ops, Air & Air Defense Ops, Conventional Missile Ops subcenters

4. Use a transaction to insert all positions and their phase mappings atomically
5. Log summary: "Loaded X positions (Y blue, Z red, W neutral) with N phase mappings"
6. Exit cleanly

Include clear comments mapping each position back to the reference document structure.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && npx tsc --noEmit scripts/seed-positions.ts 2>&1 | head -10 || echo "Checking syntax..." && node -e "try { require('fs').readFileSync('scripts/seed-positions.ts', 'utf8'); console.log('File exists and readable'); } catch(e) { console.error(e.message); }"</automated>
  </verify>
  <done>
    - Seed script loads the full AWC "A Way" position template for any problem set
    - Covers all three phase structures: Competition (unified), Crisis (blue/red split), Conflict (blue/red with different roles)
    - Uses transaction for atomic insertion
    - Runnable via npx tsx scripts/seed-positions.ts <problemSetId>
  </done>
</task>

</tasks>

<verification>
1. Backend compiles: `cd backend && npx tsc --noEmit`
2. Frontend compiles: `cd frontend && npx tsc --noEmit`
3. Migration runs without error on the database
4. Manual test: Navigate to a training-mode problem set -> Understand tab -> Team Roster sidebar item is visible
5. Manual test: Can add a position, edit it, set phase mappings, delete it
6. Manual test: "Load Template" populates roster with AWC positions grouped by side
</verification>

<success_criteria>
- exercise_positions and exercise_position_phase_mappings tables exist in PostgreSQL
- All 6 API endpoints respond correctly (CRUD + phase mappings + bulk)
- TeamRoster component renders in Understand tab when training mode is active
- Positions display grouped by side (blue/red/neutral/green) with correct color coding
- Phase mappings can be viewed and edited per position
- Load Template creates the full AWC position set with phase transitions
- Seed script runs standalone for bulk loading
</success_criteria>

<output>
After completion, create `.planning/quick/9-custom-exercise-positions-with-phase-tra/9-SUMMARY.md`
</output>
