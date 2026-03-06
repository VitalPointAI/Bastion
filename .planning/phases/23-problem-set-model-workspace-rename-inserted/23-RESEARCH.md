# Phase 23: Problem Set Model & Workspace Rename - Research

**Researched:** 2026-03-05
**Domain:** Full-stack terminology rename + echelon model addition
**Confidence:** HIGH

## Summary

This phase is a comprehensive rename of "workspace" to "problem set" across the entire application (frontend, backend, database, routes, types, localStorage) plus the addition of an echelon classification system (strategic/operational/tactical) that replaces the current `WorkspaceType` (Organization/Unit/Team). The rename touches approximately 68+ frontend files and 70+ backend files, 12 database tables, multiple API routes, and the frontend routing system.

The scope is well-defined and mechanical in nature, but requires careful ordering: database migrations must run first, then backend types/stores, then API routes, then frontend service layer, then components/context. Two distinct "workspace" systems exist: the main DAO-backed workspace system and the graph workspace system (intelligence analysis). Both need renaming per the "full rename everywhere" decision.

**Primary recommendation:** Execute as a layered rename starting from the data layer (DB + types) outward to the UI, with echelon model integrated at the type/DB layer. Use PostgreSQL `ALTER TABLE RENAME` and `ALTER COLUMN RENAME` for clean migrations rather than creating new tables.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Full rename everywhere** -- workspace -> problem set in all code, types, DB columns, API endpoints, routes, and UI labels. No dual terminology.
- **Drop WorkspaceType hierarchy** -- Organization/Unit/Team is removed. Echelon (strategic/operational/tactical) replaces it entirely as the classification.
- **DAO ID format** -- New problem sets use `ps-{uuid}` prefix. Existing DAOs keep old IDs (no on-chain rename possible).
- **ID prefixes** -- `WS-{uuid}` -> `PS-{uuid}` for problem sets, `WM-{uuid}` -> `PM-{uuid}` for problem set members. Other prefixes (WI-, WA-, etc.) follow the same pattern.
- **Required field** -- Echelon (strategic/operational/tactical) is required when creating a problem set. No default.
- **Strict hierarchy** -- Strategic can only contain operational, operational can only contain tactical. No skipping levels, no same-level nesting.
- **Tag only for now** -- Echelon is stored and displayed but doesn't change available tools, tabs, or behavior. Phases 24-26 will activate echelon-based behavior.
- **Echelon-specific role templates** -- Role templates differ by echelon level (replaces the Organization/Unit/Team role templates). Claude designs appropriate doctrinal roles per echelon based on JP 5-0 staff structures.
- **Military echelon icons** -- Use doctrinal military unit symbols (XX, III, etc.) as echelon indicators on tree nodes, not color badges.
- **Keep parent-child tree** -- OrgTree retains its hierarchical tree structure. Echelon icons appear on each node but hierarchy is the organizing principle.
- **Redesigned detail card** -- Detail card redesigned to emphasize the problem set concept: show problem statement, echelon, child count, active staff. "Enter Workspace" becomes "Enter Problem Set".
- **Redirect old routes** -- `/workspace/*` redirects to `/problem-set/*` for backward compatibility with bookmarks.
- **Full API rename** -- `/api/workspaces` -> `/api/problem-sets`. Frontend is the only client, no external compat needed.
- **Full DB column rename** -- Tables and columns renamed via migration (e.g., `workspace_id` -> `problem_set_id`). Clean slate.
- **localStorage migration** -- Rename keys (`workspace-*` -> `problem-set-*`) with one-time migration code to copy old keys on first load.

### Claude's Discretion
- Landing page title (e.g., "Select Problem Set" vs "Problem Set Overview")
- Echelon-specific role template design per JP 5-0 doctrinal staff structures
- DB migration ordering and strategy
- Component/file renaming approach (batch vs incremental)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Architecture Patterns

### Two Workspace Systems Requiring Rename

**Critical discovery:** The codebase has TWO distinct "workspace" systems, both needing rename:

1. **Main workspace system** (`backend/src/workspace/`) -- DAO-backed, 12 tables, the core problem set model
   - Tables: `workspaces`, `workspace_members`, `workspace_invites`, `workspace_activity`, `workspace_roles`, `workspace_compartments`, `workspace_member_compartments`, `workspace_panel_config`, `workspace_subscriptions`, `workspace_data_cache`, `workspace_escalation_rules`
   - Plus `exercise_scenarios.workspace_id` FK column

2. **Graph workspace system** (`backend/src/graph/workspace/`) -- intelligence analysis workspaces
   - Table: `graph_workspaces`
   - Types: `WorkspaceType = 'country' | 'adversary' | 'region' | 'topic' | 'coalition' | 'custom'`
   - This is a separate concept (graph analysis scoping) but uses "workspace" terminology

**Decision needed for planner:** The graph workspace system should also be renamed to "graph problem set" for consistency with the "no dual terminology" decision.

### Recommended Execution Order

```
Layer 1: Database Migration
  - ALTER TABLE RENAME for all 12+ tables
  - ALTER COLUMN RENAME for workspace_id, workspace_type, parent_workspace_id columns
  - Add echelon column (TEXT NOT NULL) to problem_sets table
  - Add echelon validation constraint
  - Update indexes

Layer 2: Backend Types & Models
  - Rename types.ts: Workspace -> ProblemSet, WorkspaceType -> Echelon, etc.
  - Replace WorkspaceType ('Organization'|'Unit'|'Team') with Echelon ('strategic'|'operational'|'tactical')
  - Redesign MILITARY_ROLE_TEMPLATES keyed by Echelon
  - Update all interfaces and type exports

Layer 3: Backend Stores
  - Rename all 10 store files: workspace-store.ts -> problem-set-store.ts, etc.
  - Rename class names: WorkspaceStore -> ProblemSetStore
  - Update SQL queries to use new table/column names
  - Rename singleton exports: workspaceStore -> problemSetStore

Layer 4: Backend API Routes
  - Rename workspaces.ts -> problem-sets.ts
  - Change route prefix: /api/workspaces -> /api/problem-sets
  - Update all parameter names and response shapes
  - Update API registration in server entry point

Layer 5: Frontend Service Layer
  - Rename workspace-service.ts -> problem-set-service.ts
  - Update all API URLs from /api/workspaces to /api/problem-sets
  - Rename types: WorkspaceMembership -> ProblemSetMembership, etc.
  - Rename exports: workspaceService -> problemSetService

Layer 6: Frontend Context & State
  - Rename WorkspaceContext.tsx -> ProblemSetContext.tsx
  - Rename provider: WorkspaceProvider -> ProblemSetProvider
  - Rename hook: useWorkspace -> useProblemSet
  - Update localStorage keys with migration code
  - Rename ModeContext references

Layer 7: Frontend Components
  - Rename component directory: workspace/ -> problem-set/
  - Rename all component files and their exports
  - Update all imports across the app
  - Update UI labels and text strings

Layer 8: Frontend Routing
  - Update App.tsx: /workspace/* -> /problem-set/*
  - Add redirect: /workspace/* -> /problem-set/* for backward compat
  - Update all navigate() calls
  - Update WorkspaceBreadcrumb -> ProblemSetBreadcrumb
```

### File Rename Map (Key Files)

**Backend:**
| Old Path | New Path |
|----------|----------|
| `backend/src/workspace/types.ts` | `backend/src/problem-set/types.ts` |
| `backend/src/workspace/workspace-store.ts` | `backend/src/problem-set/problem-set-store.ts` |
| `backend/src/workspace/workspace-member-store.ts` | `backend/src/problem-set/problem-set-member-store.ts` |
| `backend/src/workspace/workspace-invite-store.ts` | `backend/src/problem-set/problem-set-invite-store.ts` |
| `backend/src/workspace/workspace-activity-store.ts` | `backend/src/problem-set/problem-set-activity-store.ts` |
| `backend/src/workspace/workspace-role-store.ts` | `backend/src/problem-set/problem-set-role-store.ts` |
| `backend/src/workspace/workspace-compartment-store.ts` | `backend/src/problem-set/problem-set-compartment-store.ts` |
| `backend/src/workspace/workspace-panel-config-store.ts` | `backend/src/problem-set/problem-set-panel-config-store.ts` |
| `backend/src/workspace/workspace-subscription-store.ts` | `backend/src/problem-set/problem-set-subscription-store.ts` |
| `backend/src/workspace/workspace-escalation-store.ts` | `backend/src/problem-set/problem-set-escalation-store.ts` |
| `backend/src/api/workspaces.ts` | `backend/src/api/problem-sets.ts` |
| `backend/src/graph/workspace/` | `backend/src/graph/problem-set/` |

**Frontend:**
| Old Path | New Path |
|----------|----------|
| `frontend/src/context/WorkspaceContext.tsx` | `frontend/src/context/ProblemSetContext.tsx` |
| `frontend/src/lib/workspace-service.ts` | `frontend/src/lib/problem-set-service.ts` |
| `frontend/src/components/workspace/` | `frontend/src/components/problem-set/` |

### Database Table Rename Map

| Old Table | New Table |
|-----------|-----------|
| `workspaces` | `problem_sets` |
| `workspace_members` | `problem_set_members` |
| `workspace_invites` | `problem_set_invites` |
| `workspace_activity` | `problem_set_activity` |
| `workspace_roles` | `problem_set_roles` |
| `workspace_compartments` | `problem_set_compartments` |
| `workspace_member_compartments` | `problem_set_member_compartments` |
| `workspace_panel_config` | `problem_set_panel_config` |
| `workspace_subscriptions` | `problem_set_subscriptions` |
| `workspace_data_cache` | `problem_set_data_cache` |
| `workspace_escalation_rules` | `problem_set_escalation_rules` |
| `graph_workspaces` | `graph_problem_sets` |

### Column Renames (across all tables)

| Old Column | New Column |
|------------|------------|
| `workspace_id` | `problem_set_id` |
| `workspace_type` | `echelon` |
| `parent_workspace_id` | `parent_problem_set_id` |
| `subscriber_workspace_id` | `subscriber_problem_set_id` |
| `publisher_workspace_id` | `publisher_problem_set_id` |
| `consumer_workspace_id` | `consumer_problem_set_id` |
| `source_workspace_id` | `source_problem_set_id` |
| `linked_workspace_ids` | `linked_problem_set_ids` |

### ID Prefix Migration

| Old Prefix | New Prefix | Context |
|------------|------------|---------|
| `WS-` | `PS-` | Problem set IDs |
| `WM-` | `PM-` | Problem set member IDs |
| `WI-` | `PI-` | Problem set invite IDs |
| `WA-` | `PA-` | Problem set activity IDs |
| `WKS-` | `GPS-` | Graph problem set IDs |

**Note:** Existing on-chain DAO IDs (e.g., `ws-organization-{uuid}`) cannot be renamed. New problem sets will use `ps-{echelon}-{uuid}` format. The ID mapping from old to new only affects newly created records; existing records in DB can have their `id` column values updated since these are off-chain.

### Echelon Model Design

**Type definition (replaces WorkspaceType):**
```typescript
export type Echelon = 'strategic' | 'operational' | 'tactical';
```

**Hierarchy enforcement:**
```typescript
// Valid parent-child echelon relationships
const VALID_ECHELON_HIERARCHY: Record<Echelon, Echelon | null> = {
  strategic: null,          // strategic has no parent (or another strategic as root)
  operational: 'strategic', // operational must be under strategic
  tactical: 'operational',  // tactical must be under operational
};
```

**Database column:**
```sql
-- Add to problem_sets table (formerly workspaces)
ALTER TABLE problem_sets ADD COLUMN echelon TEXT NOT NULL DEFAULT 'operational';
-- Remove workspace_type column after data migration
-- Update: echelon replaces workspace_type, so rename the column and update values
```

**Value mapping from old WorkspaceType:**
| Old WorkspaceType | New Echelon |
|-------------------|-------------|
| Organization | strategic |
| Unit | operational |
| Team | tactical |

### Echelon-Specific Role Templates (JP 5-0 Doctrinal)

**Strategic echelon** (replaces Organization): Theater/combatant command level
```typescript
strategic: [
  { label: 'commander', daoRole: 'council', permissions: [...] },    // CCDR
  { label: 'deputy_commander', daoRole: 'council', permissions: [...] }, // DCCDR
  { label: 'chief_of_staff', daoRole: 'council', permissions: [...] },  // COS
  { label: 'j1', daoRole: 'member', permissions: [...] },  // Personnel
  { label: 'j2', daoRole: 'member', permissions: [...] },  // Intelligence
  { label: 'j3', daoRole: 'member', permissions: [...] },  // Operations
  { label: 'j4', daoRole: 'member', permissions: [...] },  // Logistics
  { label: 'j5', daoRole: 'member', permissions: [...] },  // Plans/Strategy
  { label: 'j6', daoRole: 'member', permissions: [...] },  // C4/Cyber
  { label: 'j7', daoRole: 'member', permissions: [...] },  // Information Ops
  { label: 'j8', daoRole: 'member', permissions: [...] },  // Finance
  { label: 'j9', daoRole: 'member', permissions: [...] },  // Civil-Military
  { label: 'polad', daoRole: 'member', permissions: [...] }, // Political Advisor
  { label: 'legad', daoRole: 'member', permissions: [...] }, // Legal Advisor
]
```

**Operational echelon** (replaces Unit): Corps/division level
```typescript
operational: [
  { label: 'commander', daoRole: 'council', permissions: [...] },
  { label: 'deputy_commander', daoRole: 'council', permissions: [...] },
  { label: 'chief_of_staff', daoRole: 'council', permissions: [...] },
  { label: 'g2', daoRole: 'member', permissions: [...] },  // Intelligence
  { label: 'g3', daoRole: 'member', permissions: [...] },  // Operations
  { label: 'g4', daoRole: 'member', permissions: [...] },  // Logistics
  { label: 'g5', daoRole: 'member', permissions: [...] },  // Plans
  { label: 'fires', daoRole: 'member', permissions: [...] }, // Fire Support
]
```

**Tactical echelon** (replaces Team): Brigade/battalion level
```typescript
tactical: [
  { label: 'commander', daoRole: 'council', permissions: [...] },
  { label: 'xo', daoRole: 'council', permissions: [...] },
  { label: 's2', daoRole: 'member', permissions: [...] },  // Intelligence
  { label: 's3', daoRole: 'member', permissions: [...] },  // Operations
  { label: 's4', daoRole: 'member', permissions: [...] },  // Logistics
  { label: 'fso', daoRole: 'member', permissions: [...] }, // Fire Support Officer
]
```

### Military Echelon Icons (SVG Symbols)

Doctrinal NATO/US military unit size indicators for tree nodes:

| Echelon | Symbol | Description |
|---------|--------|-------------|
| Strategic | `XX` or `XXX` | Division (XX) or Corps (XXX) size marker -- two/three X's above unit rectangle |
| Operational | `III` | Regiment/Group size marker -- three vertical bars |
| Tactical | `II` | Battalion size marker -- two vertical bars |

These should be rendered as text or simple SVG above each tree node, replacing the current colored type badges (Organization/Unit/Team). The OrgTree SVG custom node already renders badges -- replace the type badge rect+text with echelon symbol text.

### localStorage Migration Pattern

```typescript
// One-time migration on app init
function migrateLocalStorageKeys(): void {
  const migrations: [string, string][] = [
    ['workspace-active-id-training', 'problem-set-active-id-training'],
    ['workspace-active-id-operational', 'problem-set-active-id-operational'],
    ['workspace-last-seen', 'problem-set-last-seen'],
  ];

  const migrated = localStorage.getItem('ps-migration-done');
  if (migrated) return;

  for (const [oldKey, newKey] of migrations) {
    const value = localStorage.getItem(oldKey);
    if (value !== null) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  }

  localStorage.setItem('ps-migration-done', '1');
}
```

### Route Redirect Pattern

```typescript
// In App.tsx -- add redirect route
<Route path="/workspace/*" element={<Navigate to={location.pathname.replace('/workspace', '/problem-set')} replace />} />
```

### Detail Card Redesign

The current detail card shows: name, type badge, classification badge, member count, role, DAO role, primary status, and "Enter Workspace" button.

Redesigned card should emphasize:
- **Problem statement** -- new text field showing what operational problem this set addresses
- **Echelon indicator** -- military unit symbol (XX/III/II) instead of Organization/Unit/Team badge
- **Child problem set count** -- how many sub-problem sets exist
- **Active staff count** -- number of active members
- **Classification** -- retained
- **"Enter Problem Set"** button

This requires adding a `problem_statement` column to the `problem_sets` table (nullable TEXT, set during creation or edited later).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB table/column rename | Manual DROP/CREATE table sequences | PostgreSQL `ALTER TABLE RENAME TO` and `ALTER TABLE RENAME COLUMN` | Atomic, preserves data, preserves FKs, preserves indexes |
| Bulk file rename | Manual file-by-file git mv | Single plan per layer with git mv commands | Ensures git tracks renames properly |
| Import path updates | Manual find-and-replace | IDE/tooling-assisted -- but since this is automated, systematic file reads + writes per layer | Prevents missed references |
| Route redirects | Custom redirect middleware | React Router `<Navigate>` component | Built-in, handles path params |

## Common Pitfalls

### Pitfall 1: Foreign Key Cascade During Table Rename
**What goes wrong:** Renaming tables with FK references fails if done in wrong order.
**Why it happens:** PostgreSQL FK constraints reference table names. Renaming a parent table before renaming the FK references causes constraint violations.
**How to avoid:** Use `ALTER TABLE RENAME` which automatically updates FK references in PostgreSQL. Rename the parent table first, then child tables. PostgreSQL handles FK name updates automatically.
**Warning signs:** Migration errors mentioning "relation does not exist."

### Pitfall 2: Lazy Init Pattern Creates Tables with Old Names
**What goes wrong:** The `ensureInitialized()` pattern in every store creates tables with `CREATE TABLE IF NOT EXISTS`. After renaming tables, if old code runs before new code deploys, it recreates old tables.
**Why it happens:** Each store has its own `initXxxTables()` function that runs on first access. The table creation SQL is inline in these functions.
**How to avoid:** Update ALL store init functions in the same deployment. The `CREATE TABLE IF NOT EXISTS` with new names will be no-ops if migration already ran. Remove old table names from init code completely.
**Warning signs:** Duplicate tables appearing (old and new names).

### Pitfall 3: Graph Workspace vs Main Workspace Confusion
**What goes wrong:** The graph module has its own `WorkspaceType`, `Workspace` interface, and `WorkspaceStore` class with different semantics.
**Why it happens:** Two independent "workspace" concepts evolved separately.
**How to avoid:** Rename both but keep them in separate modules. Graph problem set types (`country`, `adversary`, etc.) are NOT echelons -- they're analysis scoping categories.
**Warning signs:** Type conflicts between `problem-set/types.ts` and `graph/problem-set/types.ts`.

### Pitfall 4: Circular Import After Rename
**What goes wrong:** Renaming files and imports in a large codebase can introduce circular dependencies.
**Why it happens:** The workspace module is imported by almost every other module (COP agents, exercise, graph, missions, planning).
**How to avoid:** Rename files in dependency order (leaf modules first, shared types first). Verify `tsc --noEmit` after each layer.
**Warning signs:** TypeScript compilation errors about "cannot find module."

### Pitfall 5: Existing Data ID Migration
**What goes wrong:** Records in the database still have `WS-`, `WM-` prefixed IDs after table rename.
**Why it happens:** Table/column renames don't change data values.
**How to avoid:** Per the locked decision, existing on-chain DAO IDs (`ws-organization-*`) cannot change. Off-chain IDs (`WS-*`, `WM-*`) CAN be updated via `UPDATE` statements in the migration. New records use new prefixes. Code must handle both old and new prefixes during a transition period, OR do a full data migration.
**Warning signs:** 404 errors when accessing existing problem sets.

### Pitfall 6: COP Agent Workspace References
**What goes wrong:** COP agents (backend/src/cop/) extensively reference workspace concepts in agent definitions, coordinators, and sub-agents.
**Why it happens:** COP agents are workspace-scoped and reference workspace IDs in their tool calls, prompts, and store queries.
**How to avoid:** Include COP module in the rename scope. Search for "workspace" in all COP agent files.
**Warning signs:** Agent tools failing to find problem set data.

## Code Examples

### PostgreSQL Table Rename Migration
```sql
-- Rename main table
ALTER TABLE workspaces RENAME TO problem_sets;

-- Rename columns
ALTER TABLE problem_sets RENAME COLUMN workspace_type TO echelon;
ALTER TABLE problem_sets RENAME COLUMN parent_workspace_id TO parent_problem_set_id;

-- Add problem statement field
ALTER TABLE problem_sets ADD COLUMN IF NOT EXISTS problem_statement TEXT;

-- Migrate WorkspaceType values to echelon values
UPDATE problem_sets SET echelon = CASE
  WHEN echelon = 'Organization' THEN 'strategic'
  WHEN echelon = 'Unit' THEN 'operational'
  WHEN echelon = 'Team' THEN 'tactical'
  ELSE 'operational'
END;

-- Rename member table
ALTER TABLE workspace_members RENAME TO problem_set_members;
ALTER TABLE problem_set_members RENAME COLUMN workspace_id TO problem_set_id;

-- Rename indexes (PostgreSQL doesn't auto-rename indexes on table rename)
ALTER INDEX IF EXISTS idx_workspace_parent RENAME TO idx_problem_set_parent;
ALTER INDEX IF EXISTS idx_workspace_classification RENAME TO idx_problem_set_classification;
ALTER INDEX IF EXISTS idx_workspace_type RENAME TO idx_problem_set_echelon;
ALTER INDEX IF EXISTS idx_workspace_mode RENAME TO idx_problem_set_mode;

-- Continue for all other tables...
```

### Echelon Hierarchy Validation (Backend)
```typescript
export type Echelon = 'strategic' | 'operational' | 'tactical';

const ALLOWED_CHILD_ECHELON: Record<Echelon, Echelon | null> = {
  strategic: 'operational',
  operational: 'tactical',
  tactical: null, // tactical cannot have children
};

export function validateEchelonHierarchy(
  parentEchelon: Echelon | null,
  childEchelon: Echelon,
): boolean {
  if (!parentEchelon) {
    // Root problem sets must be strategic
    return childEchelon === 'strategic';
  }
  return ALLOWED_CHILD_ECHELON[parentEchelon] === childEchelon;
}
```

### OrgTree Echelon Symbol Rendering (SVG)
```tsx
const ECHELON_SYMBOLS: Record<string, string> = {
  strategic: 'XX',    // Division-level indicator
  operational: 'III', // Regiment-level indicator
  tactical: 'II',     // Battalion-level indicator
};

// In custom node SVG, replace type badge with:
<text
  x={0}
  y={-nodeHeight / 2 - 6}
  textAnchor="middle"
  style={{ fontSize: '11px', fontWeight: 700, fill: '#94a3b8' }}
>
  {ECHELON_SYMBOLS[nd._echelon ?? ''] ?? ''}
</text>
```

## Cross-Cutting Concerns

### Files Outside workspace/ That Reference "workspace"

These modules import from `workspace/` or use workspace terminology and must be updated:

| Module | Files | Impact |
|--------|-------|--------|
| `backend/src/cop/` | ~15 files | Agent tools, coordinators, sub-agents all reference workspaceId |
| `backend/src/graph/` | ~12 files | Graph tools, entity tools, RAFT tools reference workspaceId |
| `backend/src/exercise/` | ~6 files | Exercise/scenario stores have workspace_id FK |
| `backend/src/mission/` | ~4 files | Mission store/types reference workspaceId |
| `backend/src/planning/` | ~1 file | Planning types reference workspaceId |
| `backend/src/api/` | ~6 files | All API route files import from workspace stores |
| `backend/src/middleware/` | 1 file | mode-context references workspace |
| `frontend/src/components/exercise/` | ~15 files | Exercise components use workspace context |
| `frontend/src/components/tabs/` | ~6 files | Tab components use workspace context |
| `frontend/src/components/cop/` | ~3 files | COP components reference workspace |
| `frontend/src/components/strategic/` | ~3 files | Strategic components reference workspace |
| `frontend/src/services/` | 1 file | exercise-service references workspace |

### Import Update Pattern

Every file that imports from workspace modules needs updating:
```typescript
// Old
import { workspaceStore } from '../workspace/workspace-store.js';
import { useWorkspace } from '../../context/WorkspaceContext';

// New
import { problemSetStore } from '../problem-set/problem-set-store.js';
import { useProblemSet } from '../../context/ProblemSetContext';
```

## Open Questions

1. **Graph workspace rename scope**
   - What we know: Graph workspaces use different type taxonomy (country/adversary/region/etc.) unrelated to echelon
   - What's unclear: Should graph "WorkspaceType" also be renamed? It's a different concept.
   - Recommendation: Rename the module/files/types to "problem-set" for naming consistency, but keep the graph type taxonomy as-is (it's not an echelon). Rename `graph/workspace/types.ts:WorkspaceType` to `GraphProblemSetCategory` or similar to avoid collision.

2. **Existing data ID migration**
   - What we know: Off-chain IDs can be updated, on-chain DAO IDs cannot
   - What's unclear: Whether to update existing `WS-*` IDs in the database or just generate new ones going forward
   - Recommendation: Update existing IDs in the migration SQL (`UPDATE problem_sets SET id = REPLACE(id, 'WS-', 'PS-')`) since these are purely off-chain. This is cleaner than maintaining dual-prefix handling in code.

3. **Problem statement field**
   - What we know: The redesigned detail card should show "what operational problem this set addresses"
   - What's unclear: Whether this is a new DB column or derived from the description field
   - Recommendation: Add a dedicated `problem_statement TEXT` column to `problem_sets`. It's semantically distinct from description (description is admin/meta, problem statement is the doctrinal JP 5-0 problem framing).

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all workspace-related files
- `backend/src/workspace/types.ts` -- current type definitions and role templates
- `backend/src/workspace/workspace-store.ts` -- current DB schema and store pattern
- `backend/src/graph/workspace/types.ts` -- graph workspace types (separate system)
- `frontend/src/context/WorkspaceContext.tsx` -- current context provider pattern
- `frontend/src/App.tsx` -- current routing structure
- `frontend/src/components/workspace/OrgTree.tsx` -- current tree visualization
- `frontend/src/components/workspace/WorkspaceSelector.tsx` -- current selector UI

### Secondary (MEDIUM confidence)
- JP 5-0 staff structure knowledge for echelon role templates (J-staff at strategic, G-staff at operational, S-staff at tactical)
- NATO military unit symbol conventions for echelon indicators

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, pure rename + model change
- Architecture: HIGH -- rename pattern is well-understood, echelon model is straightforward
- Pitfalls: HIGH -- directly observed from codebase structure and dependencies
- Echelon role templates: MEDIUM -- based on general JP 5-0 knowledge, specific permissions are discretionary

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- this is an internal refactor, no external dependencies)
