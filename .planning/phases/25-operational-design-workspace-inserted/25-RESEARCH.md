# Phase 25: Operational Design Workspace - Research

**Researched:** 2026-03-06
**Domain:** Frontend workspace UI (React/TypeScript), SVG visualization, backend CRUD/persistence, AI agent integration
**Confidence:** HIGH

## Summary

Phase 25 transforms the Design tab from a `DoctrinalPlaceholder` into a full operational design workspace with five sequential sub-sections: Overview, Problem Framing, CoG Analysis, Lines of Effort/Operation, and Operational Approach. The codebase already has all the foundational patterns needed: `TabLayout` + `SidebarItem` for sidebar navigation (used by UnderstandTab), inline SVG for diagrams (EffectChainDiagram pattern), `react-d3-tree` for tree visualizations (OrgTree), `useYjsDocument` for collaborative editing, and a complete `problem-framing.ts` agent with typed outputs ready to wire into the AI panel.

The backend follows a consistent store-per-domain pattern: PostgreSQL table with `CREATE TABLE IF NOT EXISTS`, `getPool()` from `../../lib/database.js`, JSONB columns for flexible structured data, and Express router endpoints in `backend/src/api/`. The frontend uses service classes in `frontend/src/lib/` that call these APIs. No new libraries are needed -- everything can be built with installed dependencies (`react-d3-tree`, `yjs`, `y-websocket`, inline SVG).

**Primary recommendation:** Build a new `operational_designs` PostgreSQL table (one row per problem set) with JSONB columns for each sub-section's data (problem framing, CoG analysis, LOEs, operational approach). Frontend components follow the EffectChainDiagram inline SVG pattern for CoG trees and LOE timelines, with `react-d3-tree` available as fallback for the CoG tree if inline SVG proves too complex.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sequential sidebar following doctrinal workflow: Overview > Problem Framing > CoG Analysis > Lines of Effort/Operation > Operational Approach
- Reuse existing TabLayout sidebar pattern from UnderstandTab
- Status badges on each sidebar item: not started, in-progress, complete
- Overview landing page as default view -- dashboard showing all sections with status, key outputs, and quick-jump links
- Explicit "Push to Plan Tab" handoff action in Operational Approach section
- Structured form + AI panel layout: left side has structured fields, right side shows AI-generated alternative framings
- JP 5-0 standard field set for problem framing: Current State, Desired End State, Problem Statement (auto-generated), Key Tensions/Contradictions, Obstacles, Opportunities, Assumptions, Constraints/Restraints
- AI alternative framings are interactive cards with Adopt/Merge/Dismiss actions
- Auto-populate from scenario/strategic documents when available, with mandatory user review
- Structured tree diagram for CoG analysis using SVG/D3 (matches existing codebase patterns)
- Strange's CG-CC-CR-CV model: CoG at root > Critical Capabilities > Critical Requirements > Critical Vulnerabilities
- Side-by-side friendly and adversary CoG trees
- Interactive nodes -- click to edit, drag to reorder
- Horizontal timeline with lanes for LOE/LOO visualization
- Explicit links between LOE/decisive points and CoG elements (CVs)
- Collapsible split-pane AI panel on the right side, section-aware
- Explicit trigger model -- user clicks "Analyze" to run AI, no auto-run
- Phase 25 AI: alternative problem framings, CoG suggestion/validation, LOE gap analysis
- Confidence scores as High/Medium/Low badges on AI suggestions
- Phase 29 deferred: conversational interface, cross-tab awareness, agent attribution, activity feed

### Claude's Discretion
- Exact SVG/D3 implementation details for tree diagrams and timeline visualization
- Overview dashboard card layout and metrics displayed
- Form field validation and auto-save behavior
- Loading states and error handling patterns
- Exact spacing, typography, and color theming within the dark UI
- Collaborative editing (Yjs) integration depth

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | (project version) | UI framework | Already used throughout |
| TypeScript | (project version) | Type safety | Already used throughout |
| Tailwind CSS | (project version) | Styling (dark UI: bg-gray-800, border-gray-700, text-gray-200) | Established pattern |
| react-d3-tree | ^3.6.6 | Tree visualization (potential use for CoG trees) | Already installed, used in OrgTree |
| yjs | ^13.6.29 | Collaborative editing CRDT | Already installed |
| y-websocket | ^3.0.0 | WebSocket provider for Yjs | Already installed |
| PostgreSQL + pg | (project version) | Data persistence | Established backend pattern |
| Express | (project version) | API routes | Established backend pattern |
| zod | (project version) | Request validation | Used in problem-sets.ts API |

### Supporting (no new installs needed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| Inline SVG (React) | Custom diagrams (CoG tree, LOE timeline) | Primary visualization approach per EffectChainDiagram pattern |
| useYjsDocument hook | Real-time collaborative editing | For collaborative design artifact editing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG for CoG tree | react-d3-tree | react-d3-tree handles layout automatically but offers less visual control; inline SVG matches EffectChainDiagram precedent and allows full custom styling |
| Inline SVG for LOE timeline | Canvas/WebGL | Timeline is fundamentally a 2D layout with lanes; SVG is simpler and sufficient |
| Custom auto-save | Yjs persistence | Yjs handles real-time sync but adds complexity; simple debounced PATCH may suffice for single-user editing |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── design/                        # NEW: All Design tab sub-components
│   │   ├── DesignOverview.tsx         # Overview dashboard landing page
│   │   ├── ProblemFramingSection.tsx   # Problem framing form + AI panel
│   │   ├── CoGAnalysisSection.tsx     # CoG tree container (friendly + adversary)
│   │   ├── CoGTree.tsx               # Single CoG tree SVG component
│   │   ├── CoGNodeEditor.tsx         # Modal/popover for editing CoG nodes
│   │   ├── LOETimelineSection.tsx    # LOE/LOO timeline visualization
│   │   ├── LOELane.tsx               # Single LOE lane in timeline
│   │   ├── DecisivePointNode.tsx     # Decisive point on timeline
│   │   ├── OperationalApproachSection.tsx  # Synthesis + handoff
│   │   ├── DesignAIPanel.tsx         # Collapsible right-side AI panel
│   │   ├── AIFramingCard.tsx         # Interactive framing suggestion card
│   │   └── DesignStatusBadge.tsx     # Status badge component (not-started/in-progress/complete)
│   └── tabs/
│       └── DesignTab.tsx             # MODIFY: Replace DoctrinalPlaceholder with TabLayout + sections
├── lib/
│   └── design-service.ts            # NEW: API client for operational design CRUD
│
backend/src/
├── design/                           # NEW: Operational design domain
│   ├── design-store.ts              # PostgreSQL CRUD for operational_designs table
│   └── types.ts                     # TypeScript interfaces for design artifacts
├── api/
│   └── design.ts                    # NEW: Express routes for /api/design/*
└── db/
    └── migrations/
        └── 025-operational-design.sql  # NEW: Table creation
```

### Pattern 1: TabLayout Sidebar (from UnderstandTab)
**What:** Reuse `TabLayout` + `SidebarItem` for sub-section navigation within Design tab
**When to use:** Exactly how UnderstandTab works -- define sidebar items, track selected view, render corresponding component
**Example:**
```typescript
// Source: frontend/src/components/tabs/UnderstandTab.tsx (existing pattern)
const DESIGN_ITEMS: SidebarItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'problem-framing', label: 'Problem Framing' },
  { id: 'cog-analysis', label: 'CoG Analysis' },
  { id: 'lines-of-effort', label: 'Lines of Effort' },
  { id: 'operational-approach', label: 'Operational Approach' },
];

// Status badges require extending SidebarItem interface or wrapping labels
```

### Pattern 2: Inline SVG Diagram (from EffectChainDiagram)
**What:** Custom SVG visualization using React JSX, not a charting library
**When to use:** CoG tree and LOE timeline -- both need custom node rendering, click handlers, and domain-specific styling
**Key patterns from EffectChainDiagram:**
- Layout constants at top (swimLaneHeight, nodeWidth, columnSpacing, etc.)
- Manual position calculation into a `Map<string, { x: number; y: number }>`
- SVG `<path>` elements for edges with `<marker>` arrowheads
- HTML `<div>` elements positioned absolutely over SVG for interactive node content
- Click handlers for node selection with detail popover
- Domain-specific color mapping (getDomainColor pattern)

### Pattern 3: Backend Store (from plan-store.ts, problem-set-panel-config-store.ts)
**What:** PostgreSQL store class with lazy table initialization
**When to use:** New operational_designs table
**Key patterns:**
- `CREATE TABLE IF NOT EXISTS` in init function
- `getPool()` from `../../lib/database.js`
- JSONB columns for flexible structured data
- `randomUUID()` for ID generation
- Row-to-model mapping function
- Singleton export

### Pattern 4: Frontend Service (from problem-set-service.ts)
**What:** API client class with fetch calls to backend
**When to use:** New design-service.ts for CRUD operations
**Key patterns:**
- `const API_BASE = import.meta.env.VITE_BACKEND_API_URL || ''`
- Methods return typed response objects
- Error handling with try/catch

### Pattern 5: AI Agent Integration (from problem-framing.ts)
**What:** Wire existing `generateFramings()` function into Design tab AI panel
**When to use:** Problem Framing section AI panel
**Key patterns:**
- Agent output has `confidenceBounds: { lower: number; upper: number }`
- `AlternativeFraming` interface already defines framing card data structure
- `PerspectiveType` enum covers military/diplomatic/economic/informational/social/legal/adversary/coalition/local/historical
- Agent is `HYBRID_HUMAN_LED` -- AI offers alternatives, human selects
- `FramingComparison` provides overlap/contradiction analysis between framings

### Anti-Patterns to Avoid
- **Do NOT install D3.js library:** The project uses inline SVG (EffectChainDiagram) or react-d3-tree (OrgTree). Raw D3 would introduce a third paradigm.
- **Do NOT build a generic graph/diagram component:** Each visualization (CoG tree, LOE timeline) has unique domain requirements. Build purpose-specific components.
- **Do NOT auto-run AI analysis:** User decision is explicit trigger model. No useEffect that fires AI on mount or data change.
- **Do NOT store Design tab data in the panel_config table:** That table is for tab visibility config only. Create a dedicated operational_designs table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree layout algorithm | Custom recursive positioning | react-d3-tree OR manual grid layout | react-d3-tree already handles collapse/expand, centering, zoom; manual grid (like EffectChainDiagram) works for fixed-depth trees |
| Real-time collaboration | Custom WebSocket sync | useYjsDocument hook + Y.Map/Y.Array | Already built and tested in COAEditor |
| Problem framing analysis | Custom AI prompt logic | `generateFramings()` from problem-framing.ts | Already has typed outputs, confidence bounds, perspective types |
| Form auto-save | Custom timer/debounce | Debounced PATCH with 1-2s delay | Simple enough to inline; Yjs overkill for single-user form editing |
| Status badge logic | Custom state machine | Derived from data presence checks | "not started" = no data, "in-progress" = partial data, "complete" = all required fields filled |

## Common Pitfalls

### Pitfall 1: SVG Scaling and Responsiveness
**What goes wrong:** SVG diagrams with fixed dimensions overflow or clip on different screen sizes
**Why it happens:** EffectChainDiagram uses fixed pixel values for layout constants
**How to avoid:** Use a container ref to measure available width, calculate layout proportionally. Add horizontal scroll wrapper (EffectChainDiagram already does this with `effect-chain-diagram-scroll`).
**Warning signs:** Diagram looks fine on developer's screen but clips on smaller displays

### Pitfall 2: CoG Tree Depth Management
**What goes wrong:** Strange's CG-CC-CR-CV model is 4 levels deep. If users add many nodes at each level, the tree becomes unreadable.
**Why it happens:** No node count limits, and horizontal space grows exponentially with branching
**How to avoid:** Limit visible depth, use collapse/expand per level, implement horizontal scrolling. Consider max 5-6 nodes per parent as a soft guide.
**Warning signs:** Tree nodes overlap or text truncates severely

### Pitfall 3: Design-to-Plan Handoff Data Shape
**What goes wrong:** The "Push to Plan Tab" button packages data, but the Plan tab expects a different shape
**Why it happens:** No shared interface between Design and Plan data models
**How to avoid:** Define the handoff interface early. The Plan tab already has `OperationalPlan` with `missionId`, `objectiveIds`, `situation`. Design outputs (CoG analysis, LOEs, operational approach) should map to Plan tab inputs.
**Warning signs:** Handoff button works but Plan tab ignores or misinterprets the data

### Pitfall 4: AI Panel State Management
**What goes wrong:** AI panel shows stale results from a previous section when user switches sidebar items
**Why it happens:** AI panel state is shared across sections instead of section-scoped
**How to avoid:** Key AI panel state by active section ID. When section changes, either clear results or restore cached results for that section.
**Warning signs:** Switching from Problem Framing to CoG Analysis still shows framing suggestions

### Pitfall 5: SidebarItem Status Badge Extension
**What goes wrong:** The existing `SidebarItem` interface only has `id`, `label`, and `tooltip`. Adding status badges requires extending it.
**Why it happens:** TabLayout was built for simple navigation, not workflow tracking
**How to avoid:** Extend `SidebarItem` to include optional `status` field, or create a `DesignSidebarItem` that adds status. Update `TabLayout` to render status badge if present, or wrap label with badge in the Design tab's item list.
**Warning signs:** Hacking status into label string, e.g., "Problem Framing (In Progress)"

### Pitfall 6: LOE-to-CoG Linkage Data Model
**What goes wrong:** Links between LOE decisive points and CoG vulnerabilities are stored but not queryable or visualizable
**Why it happens:** Treating links as simple foreign keys without a dedicated join structure
**How to avoid:** Model links explicitly: `{ loeId, decisivePointId, cogNodeId, cogNodeType }`. Store in a JSONB array on the operational_designs row.
**Warning signs:** Cannot answer "which LOEs address which vulnerabilities" without complex client-side traversal

## Code Examples

### DesignTab with TabLayout (extending UnderstandTab pattern)
```typescript
// Source: based on frontend/src/components/tabs/UnderstandTab.tsx
import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';

type DesignView = 'overview' | 'problem-framing' | 'cog-analysis' | 'lines-of-effort' | 'operational-approach';

// Extended sidebar item with status
interface DesignSidebarItem extends SidebarItem {
  status?: 'not-started' | 'in-progress' | 'complete';
}

const DESIGN_ITEMS: DesignSidebarItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'problem-framing', label: 'Problem Framing', status: 'not-started' },
  { id: 'cog-analysis', label: 'CoG Analysis', status: 'not-started' },
  { id: 'lines-of-effort', label: 'Lines of Effort', status: 'not-started' },
  { id: 'operational-approach', label: 'Operational Approach', status: 'not-started' },
];

export function DesignTab({ problemSetId }: { problemSetId: string }) {
  const [selectedView, setSelectedView] = useState<DesignView>('overview');
  // Status would be derived from loaded data

  return (
    <TabLayout
      items={DESIGN_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DesignView)}
    >
      {/* Render active section component */}
    </TabLayout>
  );
}
```

### CoG Tree Node (inline SVG pattern from EffectChainDiagram)
```typescript
// Source: based on frontend/src/components/escalation/EffectChainDiagram.tsx
interface CoGNode {
  id: string;
  type: 'cog' | 'critical-capability' | 'critical-requirement' | 'critical-vulnerability';
  label: string;
  children: CoGNode[];
}

const COG_TYPE_COLORS: Record<CoGNode['type'], string> = {
  'cog': '#ef4444',                  // red — center of gravity
  'critical-capability': '#f59e0b',  // amber — what it can do
  'critical-requirement': '#3b82f6', // blue — what it needs
  'critical-vulnerability': '#10b981', // green — where it's weak
};

// Layout: vertical tree, CoG at top, expanding downward
// Each level gets a horizontal row, nodes spread within row
```

### Backend Store Pattern
```typescript
// Source: based on backend/src/planning/stores/plan-store.ts
import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';

async function initDesignTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS operational_designs (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL UNIQUE REFERENCES problem_sets(id) ON DELETE CASCADE,
      problem_framing JSONB NOT NULL DEFAULT '{}',
      cog_analysis JSONB NOT NULL DEFAULT '{"friendly": {}, "adversary": {}}',
      lines_of_effort JSONB NOT NULL DEFAULT '[]',
      operational_approach JSONB NOT NULL DEFAULT '{}',
      status JSONB NOT NULL DEFAULT '{"problemFraming": "not-started", "cogAnalysis": "not-started", "linesOfEffort": "not-started", "operationalApproach": "not-started"}',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_od_problem_set ON operational_designs(problem_set_id);
  `);
}
```

### AI Panel Integration (wiring existing problem-framing agent)
```typescript
// Source: based on backend/src/agents/problem-framing.ts
// The generateFramings() function is already implemented (v1 stub with rule-based analysis)
// Frontend calls backend endpoint, which invokes generateFramings()
// Response maps directly to AlternativeFraming[] for rendering as cards

// Card actions:
// - Adopt: replace problem_framing JSONB with this framing's data
// - Merge: modal to select specific elements to pull in
// - Dismiss: remove from visible suggestions (client-side only)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DoctrinalPlaceholder | Full workspace | Phase 25 | Design tab becomes functional |
| No CoG analysis tool | Interactive CG-CC-CR-CV trees | Phase 25 | Structured analytical framework |
| No LOE visualization | Timeline with lanes | Phase 25 | Visual operational approach |
| Problem framing agent (stub) | Wired into UI | Phase 25 | AI assistance becomes usable |

## Open Questions

1. **TabLayout SidebarItem extension for status badges**
   - What we know: Current `SidebarItem` has `id`, `label`, `tooltip` only
   - What's unclear: Whether to extend `SidebarItem` interface (affects all tabs) or create Design-specific wrapper
   - Recommendation: Extend `SidebarItem` with optional `status` field and update `TabLayout` to render badge when present. Low-risk change since it's additive.

2. **Design-to-Plan handoff data contract**
   - What we know: Plan tab has `OperationalPlan` type. Design produces CoG analysis, LOEs, objectives.
   - What's unclear: Exactly which fields from Design map to which Plan tab inputs
   - Recommendation: Define a `DesignHandoffPayload` interface. Phase 25 writes it; Plan tab reads it when ready (may need Plan tab changes in a future phase).

3. **Auto-populate from strategic documents**
   - What we know: Understand tab has `StrategicDashboard` with document list. Strategic documents are stored in backend.
   - What's unclear: What data from strategic docs maps to which problem framing fields
   - Recommendation: Phase 25 can query strategic documents API and pre-fill Current State and Desired End State from doc summaries. Full auto-populate may require NLP extraction (defer complex extraction to Phase 29 AI enhancements).

4. **Yjs depth for collaborative editing**
   - What we know: `useYjsDocument` hook exists and works with Y.Map, Y.Array, Y.Text
   - What's unclear: Whether to Yjs-enable all design fields or just specific artifacts
   - Recommendation: Start without Yjs (simple CRUD with auto-save). Add Yjs to specific high-collaboration artifacts (CoG tree, LOE timeline) only if users need real-time co-editing. The hook is ready when needed.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/tabs/TabLayout.tsx` - SidebarItem interface, TabLayout pattern
- `frontend/src/components/tabs/UnderstandTab.tsx` - Tab-with-sidebar implementation pattern
- `frontend/src/components/escalation/EffectChainDiagram.tsx` - Inline SVG diagram pattern (410 lines)
- `frontend/src/components/problem-set/OrgTree.tsx` - react-d3-tree usage pattern
- `backend/src/agents/problem-framing.ts` - Problem framing agent with typed outputs
- `frontend/src/lib/yjs-hooks.ts` - Yjs collaborative editing hooks
- `backend/src/planning/stores/plan-store.ts` - PostgreSQL store pattern
- `backend/src/problem-set/problem-set-panel-config-store.ts` - Panel config store pattern
- `frontend/package.json` - Installed dependencies (react-d3-tree ^3.6.6, yjs ^13.6.29, y-websocket ^3.0.0)
- `frontend/src/components/tabs/DesignTab.tsx` - Current placeholder (replacement target)
- `frontend/src/components/problem-set/ProblemSetTabContainer.tsx` - Tab container and routing

### Secondary (MEDIUM confidence)
- Strange's CG-CC-CR-CV framework - standard military analytical framework from JP 5-0 doctrine
- JP 5-0 operational design methodology - doctrinal basis for workflow sequence

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and patterns established in codebase
- Architecture: HIGH - follows existing patterns (TabLayout, store classes, SVG diagrams) with clear precedents
- Pitfalls: HIGH - identified from examining actual codebase implementations and data models
- AI integration: HIGH - problem-framing.ts agent already built with typed interfaces

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- all based on existing codebase patterns, no external API dependencies)
