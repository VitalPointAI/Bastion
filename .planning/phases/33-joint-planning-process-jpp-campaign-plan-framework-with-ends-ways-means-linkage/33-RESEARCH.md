# Phase 33: Joint Planning Process (JPP) Campaign Plan Framework with Ends-Ways-Means Linkage - Research

**Researched:** 2026-03-08
**Domain:** Military planning workflow (JP 5-0), collaborative document authoring, graph visualization, OSINT integration
**Confidence:** HIGH

## Summary

Phase 33 builds a full 7-step JPP workflow within the existing Plan tab, producing COAs and annex-based campaign plans with E-W-M linkage. The codebase already has extensive infrastructure supporting this: JP 5-0 step types, COA stores, operational plan stores with annex structure, entity resolution tools, OSINT event stores, objective tools, agent manifests, and the TabLayout sidebar pattern used by Design tab. The primary work is composing these existing primitives into a collaborative JPP workflow UI with role-gated sections, designated AI agents per step, and two new visualization surfaces (E-W-M hierarchical tree and Sankey diagram).

The existing `operational_plans` table already tracks JP 5-0 steps and step statuses, COA storage with red-team results and comparison scores exists, and the OSINT event system (stores, tools, agents) is fully defined. Entity resolution tools (`search_entities`, `create_entity_alias`, `merge_entities`, `get_entity_references`) and the Entity Resolution Agent already exist. The frontend `TabLayout` sidebar pattern from DesignTab provides the exact sub-tab navigation model needed. `recharts` (already installed) includes a built-in `Sankey` component. `react-d3-tree` (already installed) can be adapted for E-W-M hierarchical tree, or the CoGTree SVG pattern can be reused directly.

**Primary recommendation:** Restructure PlanTab to use TabLayout with 8 sidebar items (7 JPP steps + E-W-M Overview), wire existing backend stores/tools into step-specific React components with role-gated sections, and add Argus webhook ingestion endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full 7-step JPP: Planning Initiation, Mission Analysis, COA Development, COA Analysis (Wargame), COA Comparison, COA Approval, Plan/Order Development
- Presented as sub-tabs within the Plan tab (alongside a dedicated E-W-M Overview tab)
- Free-flow navigation -- all steps accessible at all times, no blocking gates
- Doctrinal governance gates at COA decision points: info briefs and decision briefs for COA development, selection, and affirmation
- LOEs from Operational Design (Phase 25) flow into JPP as the primary input for COA development
- Role-gated sections within each JPP step -- staff roles (J2, J3, J4, J5, etc.) see/edit their assigned sections, view others read-only
- AI agents can draft for their assigned role within each section
- Staff can work across steps freely; governance gates only block formal product approval
- Designated AI Agents Per Step:
  - Step 1 (Planning Init): Commander's Staff Agent
  - Step 2 (Mission Analysis): Intel Agent (IPB), Ops Agent (tasks)
  - Step 3 (COA Development): Plans Agent (COA draft)
  - Step 4 (COA Analysis): Red Team Agent
  - Step 5 (COA Comparison): Decision Support Agent
  - Step 6 (COA Approval): Briefing Agent
  - Step 7 (Plan/Order Dev): Plans Agent (OPLAN generation)
  - Agents auto-draft when step begins; staff reviews/edits
- Per problem set JPP instances -- theater-level gets campaign-level JPP, subordinate gets operational JPPs
- Parent problem set JPP products auto-inherit as "higher headquarters guidance" in child JPP Step 1
- Default: Annex-based OPLAN/CONPLAN structure (Base plan + Annexes A-Z)
- Also produce an experimental alternative format if a more efficient method is identified
- Two complementary E-W-M views:
  - Hierarchical tree: Interactive editing surface -- drag-and-drop, click nodes, collapsible. Strategic Objectives (Ends) -> LOEs/COAs (Ways) -> Forces/Resources (Means)
  - Sankey/flow diagram: Read-only analytical view -- left-to-right flow, width shows resource weight, hover to highlight paths
- Dedicated "E-W-M Overview" view as a top-level item in Plan tab
- Auto-highlight gaps: unlinked objectives, unsupported LOEs, over-allocated resources, orphan forces -- color-coded warnings with AI agent suggesting fixes
- Four entity types: Nations/state actors, Military forces/units, Geographic locations, Organizations/alliances
- AI resolves with human confirmation: high-confidence (>90%) auto-resolve, low-confidence queued for staff review
- Hybrid seeding: pre-seed with well-known base entities, discover force-specific and location-specific entities organically
- Global registry per exercise -- all problem sets share canonical entities
- MCP tools: search_entities, create_entity_alias, merge_entities, get_entity_references
- Primary OSINT source: Argus (https://argus.vitalpoint.ai) via webhook push (primary) + RSS polling (fallback)
- Additional sources: RSS/news feeds, social media/OSINT APIs, government/military feeds, custom/simulated exercise feeds
- Contextual alerts within JPP steps with relevance score + COP overlays
- Default relevance scoring: Entity + objective matching; Opt-in: AI semantic matching
- MCP tools: fetch_osint_feeds, create_osint_event, link_event_to_objective

### Claude's Discretion
- Specific visualization library choices (D3, React Flow, etc.)
- Sankey diagram implementation approach
- Entity resolution confidence threshold tuning
- OSINT polling interval configuration
- Webhook endpoint security/authentication pattern
- Internal data schema design for JPP step products
- Step transition animation/UX details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18 | UI framework | Project standard |
| recharts | ^3.8.0 | Sankey diagram (built-in `<Sankey>` component) | Already installed, has native Sankey support |
| react-d3-tree | ^3.6.6 | Hierarchical tree base (optional -- CoGTree SVG pattern may be better) | Already installed |
| Zod | ^3 | Schema validation for JPP step data | Project standard for all schemas |
| PostgreSQL | - | JPP step data, COA storage, OPLAN storage, OSINT events | Project standard |
| Neo4j | - | RAFT graph for entity resolution and knowledge graph | Project standard for graph data |

### Supporting (No New Dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TabLayout component | internal | Sidebar sub-tab navigation | Plan tab restructure -- same pattern as DesignTab |
| DecisionGateBanner | internal | Governance gate display | COA decision points |
| GateSubmitButton | internal | Gate submission UI | COA selection/approval gates |
| CoGTree SVG pattern | internal | Reuse for E-W-M hierarchical tree | Interactive tree with node editing |
| OSINT event store | internal | OSINT event CRUD | Already has full table schema and store |
| Entity tools | internal | Entity resolution MCP tools | Already defined with handlers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts Sankey | D3-sankey directly | More control but more code; recharts already installed and has Sankey |
| CoGTree SVG pattern for E-W-M | react-d3-tree | react-d3-tree has drag-and-drop but CoGTree pattern gives more control over styling and is proven in the codebase |
| Custom webhook auth | HMAC signature verification | Keep simple with shared secret HMAC -- standard for webhook authentication |

**No new npm dependencies required.** All visualization and data management is covered by existing libraries.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
  components/
    plan/                          # NEW: JPP step components
      JPPStepLayout.tsx            # Shared step layout with role-gated sections
      PlanningInitiation.tsx       # Step 1
      MissionAnalysis.tsx          # Step 2
      COADevelopment.tsx           # Step 3
      COAAnalysis.tsx              # Step 4
      COAComparison.tsx            # Step 5
      COAApproval.tsx              # Step 6
      PlanOrderDevelopment.tsx     # Step 7
      EWMOverview.tsx              # E-W-M Overview (tree + Sankey)
      EWMTree.tsx                  # Interactive hierarchical tree
      EWMSankey.tsx                # Read-only Sankey diagram
      EntityResolutionPanel.tsx    # Entity review queue
      OSINTAlertBanner.tsx         # Contextual OSINT alerts per step
      RoleGatedSection.tsx         # Role access control wrapper
    tabs/
      PlanTab.tsx                  # MODIFIED: Add JPP sidebar items

  lib/
    jpp-service.ts                 # API client for JPP data
    ewm-service.ts                 # E-W-M linkage data service
    osint-service.ts               # OSINT feed/alert service
    entity-service.ts              # Entity resolution service

backend/src/
  jpp/                             # NEW: JPP domain module
    types.ts                       # JPP step product types, E-W-M linkage types
    jpp-store.ts                   # PostgreSQL CRUD for JPP instances and step products
    ewm-store.ts                   # E-W-M linkage storage
    jpp-service.ts                 # Business logic: step transitions, product generation
  api/
    jpp.ts                         # REST endpoints for JPP CRUD
    osint-webhook.ts               # Argus webhook receiver endpoint
  graph/
    agents/
      jpp-planning-init-agent.ts   # Step 1 agent (Commander's Staff)
      jpp-mission-analysis-agent.ts # Step 2 agents (Intel + Ops)
      jpp-coa-dev-agent.ts         # Step 3 agent (Plans)
      jpp-coa-analysis-agent.ts    # Step 4 agent (Red Team -- may extend existing)
      jpp-coa-comparison-agent.ts  # Step 5 agent (Decision Support)
      jpp-briefing-agent.ts        # Step 6 agent (Briefing)
      jpp-plan-dev-agent.ts        # Step 7 agent (Plans -- OPLAN generation)
    tools/
      jpp-tools.ts                 # JPP-specific MCP tools
      ewm-tools.ts                 # E-W-M linkage tools
```

### Pattern 1: TabLayout Sidebar Navigation (Proven Pattern)
**What:** Reuse the exact same TabLayout sidebar pattern from DesignTab for JPP sub-tabs
**When to use:** PlanTab restructure -- 8 sidebar items (7 steps + E-W-M Overview)
**Example:**
```typescript
// Source: frontend/src/components/tabs/DesignTab.tsx (existing pattern)
const JPP_ITEMS: SidebarItem[] = [
  { id: 'planning-initiation', label: '1. Planning Initiation', status: getStepStatus('planning_initiation') },
  { id: 'mission-analysis', label: '2. Mission Analysis', status: getStepStatus('mission_analysis') },
  { id: 'coa-development', label: '3. COA Development', status: getStepStatus('coa_development') },
  { id: 'coa-analysis', label: '4. COA Analysis', status: getStepStatus('coa_analysis') },
  { id: 'coa-comparison', label: '5. COA Comparison', status: getStepStatus('coa_comparison') },
  { id: 'coa-approval', label: '6. COA Approval', status: getStepStatus('coa_approval') },
  { id: 'plan-development', label: '7. Plan/Order Dev', status: getStepStatus('plan_development') },
  { id: 'ewm-overview', label: 'E-W-M Overview' },
];

// Inside PlanTab, use TabLayout exactly like DesignTab:
<TabLayout items={JPP_ITEMS} selectedItem={selectedView} onSelectItem={setSelectedView}>
  {selectedView === 'planning-initiation' && <PlanningInitiation ... />}
  ...
</TabLayout>
```

### Pattern 2: Role-Gated Section Component
**What:** Wrapper component that shows/hides edit controls based on staff role
**When to use:** Every JPP step has sections owned by different staff roles
**Example:**
```typescript
// Pattern: Check user's staff role against section's allowed roles
interface RoleGatedSectionProps {
  allowedRoles: string[];    // e.g., ['j2', 'j2x']
  currentRole: string;       // User's assigned staff role
  title: string;
  children: React.ReactNode;
}

function RoleGatedSection({ allowedRoles, currentRole, title, children }: RoleGatedSectionProps) {
  const canEdit = allowedRoles.includes(currentRole);
  return (
    <section>
      <h3>{title} {!canEdit && <span className="text-gray-400">(read-only)</span>}</h3>
      <div className={canEdit ? '' : 'pointer-events-none opacity-75'}>
        {children}
      </div>
    </section>
  );
}
```

### Pattern 3: Agent Manifest Per Step (Proven Pattern)
**What:** Create agent manifests following the StrategicFusionAgent/EntityResolutionAgent pattern
**When to use:** Each JPP step gets designated AI agents
**Example:**
```typescript
// Source: backend/src/graph/agents/strategic-fusion-agent.ts (existing pattern)
export const JPP_PLANS_AGENT_MANIFEST: Omit<AgentManifest, ...> = {
  agentId: 'jpp-plans-agent',
  name: 'JPP Plans Agent',
  description: 'Drafts COAs and generates OPLAN from selected COA',
  phase: 'Support' as AgentPhase,
  capabilities: ['COADrafting' as AgentCapability, 'OPLANGeneration' as AgentCapability],
  maxAutonomy: AutonomyLevel.SemiAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: [],
  active: true,
};
```

### Pattern 4: Webhook Receiver for Argus OSINT
**What:** Express endpoint receiving Argus webhook pushes, validating with HMAC, and creating OSINT events
**When to use:** Primary OSINT ingestion path
**Example:**
```typescript
// backend/src/api/osint-webhook.ts
router.post('/api/osint/webhook/argus', async (req, res) => {
  // 1. Verify HMAC signature from X-Argus-Signature header
  const signature = req.headers['x-argus-signature'] as string;
  const expectedSig = crypto.createHmac('sha256', ARGUS_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body)).digest('hex');
  if (signature !== expectedSig) return res.status(401).json({ error: 'Invalid signature' });

  // 2. Transform Argus article to OSINT event format
  const event = transformArgusToOSINTEvent(req.body);

  // 3. Store via existing osintEventStore
  const { eventId } = await osintToolHandlers.create_osint_event(event);

  // 4. Trigger relevance scoring (entity + objective matching)
  await scoreAndLinkEvent(eventId);

  res.json({ eventId, status: 'received' });
});
```

### Pattern 5: E-W-M Data Model
**What:** Linkage data structure connecting Ends (objectives) -> Ways (LOEs/COAs) -> Means (forces/resources)
**When to use:** Core data model for E-W-M visualization and gap analysis
**Example:**
```typescript
// backend/src/jpp/types.ts
interface EWMLinkage {
  id: string;
  problemSetId: string;
  jppInstanceId: string;

  // Ends: Strategic objectives
  ends: Array<{
    objectiveId: string;    // References strategic_objectives
    description: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }>;

  // Ways: LOEs and COAs that support ends
  ways: Array<{
    id: string;
    type: 'loe' | 'coa';
    sourceId: string;       // LOE ID from Design or COA ID from JPP
    name: string;
    linkedEndIds: string[]; // Which objectives this way supports
  }>;

  // Means: Forces and resources allocated to ways
  means: Array<{
    id: string;
    type: 'force' | 'capability' | 'resource';
    name: string;
    allocation: number;     // 0-100 percentage
    linkedWayIds: string[]; // Which ways this means supports
  }>;
}
```

### Anti-Patterns to Avoid
- **Blocking step navigation:** User explicitly requires free-flow. Never disable/grey out step tabs. Governance gates only block formal approval actions (submit brief, approve COA), not navigation.
- **Conflating LOEs with COAs:** Operational Design produces LOEs (Ways to achieve objectives). JPP Step 3 develops COAs (specific courses of action). LOEs are input; COAs are output. Different constructs per doctrine.
- **Duplicating existing stores:** COA, operational plan, OSINT event stores already exist. Extend or compose them, do not recreate.
- **Monolithic step components:** Each step should be a composition of role-gated sections, not a single large component. This enables role-based rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sankey diagram rendering | Custom SVG Sankey layout | `recharts` `<Sankey>` component | Already installed, handles node/link layout, hover interactions |
| Hierarchical tree visualization | Custom tree layout algorithm | Adapt CoGTree SVG pattern from DesignTab | Already proven in codebase, handles node positioning, edge rendering, click-to-edit |
| OSINT event storage | Custom event table schema | Existing `osint_events` table + `OSINTEventStore` | Full CRUD already implemented with PostgreSQL |
| Entity resolution | Custom entity matching | Existing entity tools + EntityResolutionAgent | `search_entities`, `merge_entities`, `create_entity_alias` already implemented |
| Governance gates at COA points | Custom approval workflow | Existing `DecisionGateBanner` + `GateSubmitButton` + `gate-store` | Full gate system already built in Phase 5.1 |
| JP 5-0 step tracking | Custom step state machine | Existing `JP50Step` type + `operational_plans.step_statuses` | Step types and status tracking already in planning types |
| Sidebar navigation | Custom sub-tab system | `TabLayout` component | Exact pattern needed, proven in DesignTab |
| Webhook signature verification | Custom auth scheme | Standard HMAC-SHA256 | Industry standard for webhook security |

**Key insight:** This phase is primarily a composition/integration phase. Most building blocks exist -- the work is wiring them into the JPP workflow and building the UI layer.

## Common Pitfalls

### Pitfall 1: LOE vs COA Confusion
**What goes wrong:** Treating LOEs and COAs as interchangeable, or having COAs come from Operational Design
**Why it happens:** Both are "ways" in E-W-M framework, but they're different doctrinal constructs
**How to avoid:** LOEs come from Design tab (Phase 25) as input to JPP. COAs are developed in JPP Step 3. LOEs describe broad approaches; COAs are specific, executable plans with task org.
**Warning signs:** If COA Development step doesn't reference LOEs as input, or if Design tab generates COAs

### Pitfall 2: Blocking Navigation vs. Blocking Approval
**What goes wrong:** Disabling sidebar tabs for "incomplete" steps, preventing staff from working ahead
**Why it happens:** Natural instinct to enforce sequential workflow
**How to avoid:** All 7 steps + E-W-M Overview are always accessible. Only governance gates at formal decision points (COA selection brief, COA approval, plan approval) block formal submission -- and even those only block the submit button, not navigation.
**Warning signs:** If any sidebar item is disabled/greyed out based on step status

### Pitfall 3: Over-Scoping Step Components
**What goes wrong:** Building each JPP step as a massive monolithic component
**Why it happens:** Each step has substantial doctrinal content
**How to avoid:** Each step is a composition of role-gated sections. The `JPPStepLayout` wrapper handles the common structure (step title, status, AI agent panel, OSINT alerts); step-specific sections plug in as children.
**Warning signs:** Step component files exceeding 300 lines

### Pitfall 4: Ignoring Existing Plan Store Schema
**What goes wrong:** Creating a parallel plan storage system instead of extending the existing one
**Why it happens:** JPP has specific products per step that seem like new entities
**How to avoid:** The `operational_plans` table already has `step`, `step_statuses`, `situation`, `mission_statement`, `execution`, `sustainment`, `command_signal`, `annexes` columns. JPP step products should map to these columns. Add a `jpp_instances` table for per-problem-set JPP tracking, but reuse the plan structure.
**Warning signs:** Creating tables that duplicate `operational_plans` columns

### Pitfall 5: Entity Resolution Performance
**What goes wrong:** Running entity matching against entire registry on every document mention
**Why it happens:** Naive implementation checks every mention against all entities
**How to avoid:** Use blocking strategies (match by entity type first), cache recent lookups, batch process document mentions. The EntityResolutionAgent already specifies Jaro-Winkler and Levenshtein algorithms with a 0.85 threshold.
**Warning signs:** Entity resolution taking > 2s per document

### Pitfall 6: Sankey Data Format Mismatch
**What goes wrong:** Recharts Sankey expects `{nodes: [...], links: [{source: idx, target: idx, value: N}]}` but passing entity IDs instead of array indices
**Why it happens:** Natural to use IDs, but Sankey component needs numeric indices
**How to avoid:** Build a transformation layer: collect unique nodes, assign indices, map links to index pairs. The `value` field determines visual width -- use resource allocation percentage.
**Warning signs:** Sankey rendering empty or erroring on data load

## Code Examples

### E-W-M Hierarchical Tree (Adapting CoGTree Pattern)
```typescript
// Source: frontend/src/components/design/CoGTree.tsx (existing pattern)
// Adapt the CoGTree SVG pattern for E-W-M:
// - Level 0 (top): Ends -- Strategic Objectives (red nodes)
// - Level 1 (middle): Ways -- LOEs/COAs (blue nodes)
// - Level 2 (bottom): Means -- Forces/Resources (green nodes)
// Reuse: flattenTree, computePositions, SVG edge rendering, HTML node overlays
// Add: drag-and-drop linking (onDrop creates linkage), gap highlighting (orphan nodes glow amber)

const EWM_COLORS = {
  end: '#ef4444',   // red -- objectives
  way: '#3b82f6',   // blue -- LOEs/COAs
  mean: '#10b981',  // green -- forces/resources
};
```

### Recharts Sankey for E-W-M Flow
```typescript
// Source: https://recharts.github.io/en-US/api/Sankey/
import { Sankey, Tooltip } from 'recharts';

function EWMSankey({ linkageData }: { linkageData: EWMLinkage }) {
  // Transform EWMLinkage to Sankey format
  const nodes = [
    ...linkageData.ends.map(e => ({ name: e.description })),
    ...linkageData.ways.map(w => ({ name: w.name })),
    ...linkageData.means.map(m => ({ name: m.name })),
  ];

  const links: Array<{ source: number; target: number; value: number }> = [];
  const endOffset = 0;
  const wayOffset = linkageData.ends.length;
  const meanOffset = wayOffset + linkageData.ways.length;

  // End -> Way links
  linkageData.ways.forEach((way, wi) => {
    way.linkedEndIds.forEach(endId => {
      const ei = linkageData.ends.findIndex(e => e.objectiveId === endId);
      if (ei >= 0) links.push({ source: endOffset + ei, target: wayOffset + wi, value: 1 });
    });
  });

  // Way -> Mean links
  linkageData.means.forEach((mean, mi) => {
    mean.linkedWayIds.forEach(wayId => {
      const wi = linkageData.ways.findIndex(w => w.id === wayId);
      if (wi >= 0) links.push({ source: wayOffset + wi, target: meanOffset + mi, value: mean.allocation || 1 });
    });
  });

  return (
    <Sankey
      data={{ nodes, links }}
      width={960}
      height={500}
      nodeWidth={10}
      nodePadding={30}
      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
    >
      <Tooltip />
    </Sankey>
  );
}
```

### Argus Webhook Integration
```typescript
// backend/src/api/osint-webhook.ts
import crypto from 'crypto';
import { Router } from 'express';
import { osintToolHandlers } from '../graph/tools/osint-tools.js';
import { entityToolHandlers } from '../graph/tools/entity-tools.js';

const router = Router();

// Shared secret from environment
const ARGUS_WEBHOOK_SECRET = process.env.ARGUS_WEBHOOK_SECRET || '';

router.post('/api/osint/webhook/argus', async (req, res) => {
  // Verify HMAC signature
  const signature = req.headers['x-argus-signature'] as string;
  if (ARGUS_WEBHOOK_SECRET) {
    const expected = crypto.createHmac('sha256', ARGUS_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (signature !== `sha256=${expected}`) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // Transform to OSINT event
  const { eventId } = await osintToolHandlers.create_osint_event({
    title: req.body.title,
    description: req.body.summary || req.body.description,
    sourceType: 'news',
    sourceUrl: req.body.url,
    sourceName: 'Argus',
    publishedAt: req.body.publishedAt || new Date().toISOString(),
    actors: req.body.entities || [],
    tags: req.body.tags || [],
    rawContent: req.body.content,
    workspaceId: req.body.problemSetId,
  });

  // Auto-link to entities via entity resolution
  for (const actorName of (req.body.entities || [])) {
    const { entities } = await entityToolHandlers.search_entities({ query: actorName, fuzzy: true });
    // High-confidence matches auto-link
    // Low-confidence queued for review
  }

  res.json({ eventId, status: 'received' });
});
```

### JPP Instance Database Schema
```sql
-- New table: JPP instances per problem set
CREATE TABLE IF NOT EXISTS jpp_instances (
  id TEXT PRIMARY KEY,                    -- JPP-{uuid}
  problem_set_id TEXT NOT NULL,
  parent_jpp_id TEXT,                     -- For parent->child inheritance
  echelon TEXT NOT NULL DEFAULT 'operational',  -- strategic/operational/tactical
  current_step TEXT NOT NULL DEFAULT 'planning_initiation',
  step_products JSONB NOT NULL DEFAULT '{}',    -- Per-step structured products
  ewm_linkage JSONB NOT NULL DEFAULT '{}',      -- E-W-M linkage data
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jpp_problem_set ON jpp_instances(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_jpp_parent ON jpp_instances(parent_jpp_id);

-- New table: E-W-M linkages (separate for graph queries)
CREATE TABLE IF NOT EXISTS ewm_linkages (
  id TEXT PRIMARY KEY,
  jpp_instance_id TEXT NOT NULL REFERENCES jpp_instances(id),
  end_objective_id TEXT NOT NULL,          -- Links to strategic objectives
  way_id TEXT NOT NULL,                    -- LOE ID or COA ID
  way_type TEXT NOT NULL,                  -- 'loe' or 'coa'
  mean_id TEXT,                            -- Force/resource ID (optional)
  mean_type TEXT,                          -- 'force', 'capability', 'resource'
  allocation_pct REAL DEFAULT 0,           -- Resource allocation percentage
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ewm_jpp ON ewm_linkages(jpp_instance_id);
CREATE INDEX IF NOT EXISTS idx_ewm_objective ON ewm_linkages(end_objective_id);
CREATE INDEX IF NOT EXISTS idx_ewm_way ON ewm_linkages(way_id);

-- New table: OSINT feed configuration per problem set
CREATE TABLE IF NOT EXISTS osint_feed_config (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,              -- 'argus_webhook', 'rss', 'api', 'simulated'
  endpoint_url TEXT,
  polling_interval_ms INTEGER DEFAULT 300000,  -- 5 min default
  relevance_mode TEXT DEFAULT 'entity_objective',  -- 'entity_objective' or 'ai_semantic'
  active BOOLEAN DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic plan editor | Step-based JPP workflow with role sections | JP 5-0 doctrine (stable) | Each step gets focused UI |
| Manual objective tracking | E-W-M linkage with gap analysis | BASTION innovation | Auto-detects unlinked objectives, over-allocated resources |
| Separate OSINT dashboard | Contextual OSINT alerts within planning steps | Phase 33 design | Intel surfaces where planners work, not in separate tool |
| Text-based entity references | Entity resolution with canonical registry | Phase 33 design | Consistent entity references across all documents |

**Existing infrastructure reused:**
- `JP50Step` type already defines all 7 steps plus `plan_approval`
- `operational_plans` table has step tracking, annex storage, 5-paragraph order structure
- `coas` table has COA storage with red-team results and comparison scores
- `osint_events` and `objective_evidence` tables are fully built
- Entity resolution tools and agent are fully defined
- `DecisionGateBanner`, `GateSubmitButton`, governance gate system is complete
- `TabLayout` sidebar navigation is proven in DesignTab
- `CoGTree` SVG visualization pattern is proven for tree diagrams

## Open Questions

1. **Argus API Contract**
   - What we know: Argus is at https://argus.vitalpoint.ai, it's VitalPoint's own tool, it curates articles
   - What's unclear: Exact webhook payload schema, authentication method, available RSS endpoint format
   - Recommendation: Design webhook receiver with flexible payload mapping; define a transform function that can be updated when Argus API is finalized. Use HMAC-SHA256 with shared secret as default auth.

2. **Experimental Alternative Plan Format**
   - What we know: User wants annex-based OPLAN as default, plus an experimental alternative
   - What's unclear: What the alternative format should be
   - Recommendation: Build the annex-based OPLAN first. As an experimental alternative, consider a "decision-centric" format that organizes by decision points rather than annexes -- or a structured JSON export that can be rendered multiple ways. Defer the alternative to a late plan (after core OPLAN is working).

3. **Problem Set Echelon Determination**
   - What we know: Theater-level gets campaign JPP, subordinate gets operational JPP
   - What's unclear: How echelon is determined -- is it explicit per problem set, or inferred from parent/child relationship?
   - Recommendation: Use explicit echelon field on problem set (strategic/operational/tactical). Theater-level = strategic, subordinate = operational. The JPP template and products adapt based on echelon.

4. **Agent Auto-Draft Trigger**
   - What we know: Agents should auto-draft when step begins
   - What's unclear: What "step begins" means -- first navigation to the step? Explicit "start" action? Status change?
   - Recommendation: Trigger on first navigation to a step if step status is `not_started`. Set status to `in_progress` and dispatch agent draft. Only auto-draft once; subsequent visits show the draft for review.

## Sources

### Primary (HIGH confidence)
- `backend/src/planning/types.ts` - JP50Step, COA, OperationalPlan, Annex types
- `backend/src/planning/stores/coa-store.ts` - Existing COA CRUD with PostgreSQL
- `backend/src/planning/stores/plan-store.ts` - Existing operational plan CRUD
- `backend/src/graph/tools/entity-tools.ts` - Entity resolution MCP tools (4 tools fully implemented)
- `backend/src/graph/tools/osint-tools.ts` - OSINT MCP tools (4 tools fully implemented)
- `backend/src/graph/tools/objective-tools.ts` - Objective MCP tools (5 tools fully implemented)
- `backend/src/graph/agents/entity-resolution-agent.ts` - Entity Resolution Agent manifest
- `backend/src/graph/agents/osint-monitor-agent.ts` - OSINT Monitor Agent manifest
- `backend/src/graph/osint/types.ts` - OSINT event types with Zod schemas
- `backend/src/graph/osint/event-store.ts` - OSINT event PostgreSQL store
- `backend/src/strategic/schemas/ends-ways-means.ts` - E-W-M Zod schemas
- `backend/src/strategic/schemas/strategic-objective.ts` - Strategic objective schema
- `backend/src/exercise/types.ts` - Staff role configuration (31 roles with doctrinal focus)
- `frontend/src/components/tabs/TabLayout.tsx` - Sidebar navigation component
- `frontend/src/components/tabs/DesignTab.tsx` - Proven TabLayout usage pattern
- `frontend/src/components/tabs/PlanTab.tsx` - Current Plan tab (to be restructured)
- `frontend/src/components/design/CoGTree.tsx` - SVG tree visualization pattern
- `frontend/src/lib/design-service.ts` - DesignHandoffPayload (LOEs as JPP input)
- `frontend/package.json` - Confirms recharts ^3.8.0 and react-d3-tree ^3.6.6 installed

### Secondary (MEDIUM confidence)
- [Recharts Sankey API](https://recharts.github.io/en-US/api/Sankey/) - Built-in Sankey component with nodes/links data format

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed, no new dependencies
- Architecture: HIGH - patterns proven in DesignTab, existing stores/tools/agents cover most needs
- Pitfalls: HIGH - doctrinal distinctions (LOE vs COA) verified against JP 5-0 types in codebase
- E-W-M visualization: MEDIUM - recharts Sankey is documented but untested in this codebase
- OSINT/Argus integration: MEDIUM - webhook pattern is standard but Argus API contract unknown

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain -- military doctrine and existing codebase patterns)
