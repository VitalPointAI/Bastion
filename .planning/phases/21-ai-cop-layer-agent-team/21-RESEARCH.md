# Phase 21: AI COP Layer Agent Team - Research

**Researched:** 2026-03-05
**Domain:** Multi-agent orchestration, MIL-STD-2525 symbology, SVG layer generation, CCO ontology, graph-based entity linkage
**Confidence:** HIGH

## Summary

Phase 21 builds an autonomous agent team that monitors workspace sections, parses strategic documents and plans, extracts entities/locations/resources/intent, and generates interactive MIL-STD-2525 SVG overlay layers for a Common Operating Picture (COP). The system uses a hybrid coordinator architecture where a COP coordinator agent orchestrates requests to existing JPP staff agents (J2, J3, J4, C2) who each manage domain-specific COP layer-type sub-agents.

The project already has substantial infrastructure to build on: milsymbol library (v3.0.3) for SIDC-to-SVG rendering, COASketchMap with SVG overlays on Leaflet, IPBLayerControls for GIS-style layer toggling, 31 JPP staff agent definitions with the StaffAgentDef pattern, a full RAFT graph database in Neo4j with entity resolution, LangGraph.js (v1.1.0) for stateful agent workflows, and workspace-scoped data isolation. The primary engineering challenge is coordinating the agent team with a message-driven architecture, implementing the 4-state layer lifecycle (Draft->Review->Published->COP), and overlaying CCO ontology on the existing RAFT graph for cross-section interoperability.

**Primary recommendation:** Extend existing patterns -- StaffAgentDef for COP agent definitions, LangGraph StateGraph for coordinator workflow, COASketchMap SVG overlay approach for layer rendering, IPBLayerControls for layer management UI, and Neo4j RAFT stores for CCO-augmented entity storage. Use DOMPurify for SVG sanitization and shadow DOM for sandboxed rendering.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ontology & Linkages:**
- Adopt Common Core Ontology (CCO) as overlay on existing RAFT graph in Neo4j -- not a replacement, but a standardization layer
- Strict CCO compliance: every entity must map to a CCO class before committing to graph
- All four CCO modules in scope: Core+Geospatial, Agent Ontology, Event Ontology, Artifact+Information Entity
- CCO schema maintained as external OWL/RDF file -- agents load at startup for validation, data stays in Neo4j
- Hybrid entity discovery: graph traversal for known relationships + embedding similarity (text-embedding-3-large) for discovering new linkages
- Auto-commit linkages above confidence threshold (e.g., 0.85); lower confidence queued for human review
- Entity-data linkages visible via summary tooltip on hover (name + affiliation + key linked entities); click opens detail view

**Agent Team Design:**
- Hybrid coordinator architecture: separate COP coordinator agent orchestrates requests to existing JPP staff agents for domain-specific layers
- Warfighting function leads (J2, J3, J4, C2) as agent leads for their domain, with COP layer-type sub-agents (Force Disposition, Objectives, Control Measures, etc.) that prepare specific parts for assembly by the lead
- Single responsibility principle: each agent does one thing deterministically
- Triple trigger model: on document commit (primary), manual trigger (staff-initiated), periodic polling (for autonomous AI teams/sensors)
- Message queue coordination with observability -- agent activity visible in existing workspace activity feed
- Pool-with-affinity scoping: shared agent pool with section affinity, agents develop context for assigned section over time
- Low-power watch state during inactivity (not full dormancy) -- agents stay active in reduced polling mode
- Agent definitions stored as database + config seed: defaults from config file, seeded into DB on init, customizable per workspace
- Conflict resolution: source authority ranking with human review flag -- most authoritative symbol highlighted, staff sees conflict and makes final decision

**Layer Generation & SVG:**
- Hybrid generation: declarative JSON spec (entity type, position, SIDC, relationships) for standard symbols via milsymbol; LLM-generated SVG fragments for custom annotations, movement arrows, boundary sketches
- Phase slider + animated playback for temporal changes -- manual scrub control plus play button for automatic animation with smooth transitions
- Friendly/adversary perspectives via toggle view (Friendly/Adversary/Combined switch) combined with overlay opacity sliders for fine-grained control
- SVG security: strict validation against allowlisted elements/attributes PLUS sandboxed rendering (iframe/shadow DOM) -- belt and suspenders for military-grade security

**Publish & Promotion:**
- 4-state layer lifecycle: Draft -> Review -> Published -> COP
- Staff review includes feedback loop: inline spatial annotations on specific entities/areas + free-text comments for general guidance; agents receive both and regenerate affected portions
- Any authorized staff member (with publish permission in that section) can promote layers to top-level COP
- Stacked layers with conflict detection: sections' promoted layers stack independently on COP (like IPBLayerControls pattern), with automatic flagging of overlapping/contradictory entities across sections for staff resolution
- Full version history: every publish/promote creates a snapshot; staff can browse COP at any point in time for post-operation analysis
- Recall with audit: authorized staff can pull a layer back from COP to review state; requires a reason, creates audit trail entry

### Claude's Discretion
- Specific confidence threshold value for auto-commit linkages (suggested 0.85)
- Message queue technology choice (in-process vs external broker)
- Exact animation timing and easing curves for playback
- SVG allowlist specifics (which elements/attributes permitted)
- Low-power polling interval for dormant agents
- Version snapshot storage format and retention policy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| milsymbol | ^3.0.3 | MIL-STD-2525D SIDC to SVG generation | Already in use in MilSymbolMarker and COASketchMap; 1000 symbols in <20ms; supports 2525C/D/E and APP-6 |
| @langchain/langgraph | ^1.1.0 | Stateful multi-agent coordinator graph | Already used for strategy-reviewer-graph; StateGraph + Annotation pattern established |
| @langchain/anthropic | ^1.3.10 | LLM calls for agent reasoning | Project standard AI provider |
| @langchain/openai | ^1.2.2 | text-embedding-3-large for entity similarity | Required by decision: hybrid entity discovery with embeddings |
| neo4j-driver | (installed) | RAFT graph storage with CCO overlay | Existing Neo4j client with workspace-scoped isolation |
| react-leaflet | ^5.0.0 | Map rendering with SVG overlays | Existing map infrastructure |
| leaflet | ^1.9.4 | Core mapping library | Already integrated |
| zod | (installed) | Schema validation for agent state and layer specs | Project-wide validation standard |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dompurify | ^3.3.2 | SVG sanitization with allowlist | Belt-and-suspenders SVG security; sanitize all LLM-generated SVG before rendering |
| @types/dompurify | ^3.2.0 | TypeScript types for DOMPurify | Development dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DOMPurify | sanitize-html | DOMPurify has native SVG profile support (`USE_PROFILES: {svg: true}`); sanitize-html is HTML-only |
| In-process message queue | BullMQ/Redis | In-process EventEmitter is simpler for single-server deployment; BullMQ adds Redis dependency but supports persistence and horizontal scaling |
| Shadow DOM sandboxing | iframe sandboxing | Shadow DOM is lighter weight and integrates better with React; iframe is stronger isolation but harder to style/interact with |

**Discretion recommendation (message queue):** Use in-process EventEmitter with typed event bus for v1. The project runs single-server (Phase 17 targets Hetzner single-server deployment). An EventEmitter wrapped in a typed class provides observability hooks (emit to ActivityFeed) without external infrastructure. The interface can be swapped to BullMQ later if horizontal scaling is needed.

**Installation:**
```bash
npm install dompurify @types/dompurify
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── cop/
│   ├── agents/
│   │   ├── cop-coordinator.ts        # LangGraph StateGraph orchestrator
│   │   ├── layer-sub-agents/
│   │   │   ├── force-disposition.ts   # J3 sub-agent: unit positions + SIDC
│   │   │   ├── objectives-overlay.ts  # J35 sub-agent: objective markers
│   │   │   ├── control-measures.ts    # J3 sub-agent: boundaries, phase lines
│   │   │   ├── intel-overlay.ts       # J2 sub-agent: threat assessment layer
│   │   │   ├── logistics-overlay.ts   # J4 sub-agent: supply routes, LOCs
│   │   │   └── c2-overlay.ts          # C2 sub-agent: command relationships
│   │   ├── agent-definitions.ts       # StaffAgentDef[] seed data for COP agents
│   │   └── agent-pool.ts             # Pool-with-affinity manager
│   ├── cco/
│   │   ├── cco-validator.ts           # CCO class mapping validation
│   │   ├── cco-schema-loader.ts       # Load OWL/RDF at startup
│   │   └── cco-types.ts              # TypeScript interfaces for CCO classes
│   ├── layers/
│   │   ├── layer-store.ts             # PostgreSQL: layer CRUD + lifecycle
│   │   ├── layer-types.ts             # COP layer type definitions
│   │   ├── layer-assembler.ts         # Merge sub-agent outputs into layer
│   │   ├── conflict-detector.ts       # Cross-section entity conflict detection
│   │   └── version-store.ts           # Snapshot storage for version history
│   ├── svg/
│   │   ├── svg-spec-builder.ts        # Declarative JSON -> SVG via milsymbol
│   │   ├── svg-sanitizer.ts           # DOMPurify wrapper with SVG allowlist
│   │   ├── svg-fragment-generator.ts  # LLM-generated custom annotations
│   │   └── svg-allowlist.ts           # Permitted elements/attributes config
│   ├── messaging/
│   │   ├── event-bus.ts               # Typed EventEmitter for agent coordination
│   │   ├── trigger-handler.ts         # Triple trigger: commit/manual/polling
│   │   └── activity-bridge.ts         # Forward agent events to ActivityFeed
│   ├── linkage/
│   │   ├── entity-linker.ts           # Hybrid graph traversal + embedding similarity
│   │   ├── confidence-threshold.ts    # Auto-commit vs human review logic
│   │   └── linkage-store.ts           # Entity-data linkage persistence
│   └── index.ts
│
frontend/src/
├── components/cop/
│   ├── COPMapView.tsx                 # Main COP map with stacked layers
│   ├── COPLayerControls.tsx           # Layer toggle panel (extends IPBLayerControls pattern)
│   ├── COPLayerLifecycle.tsx          # Draft/Review/Published/COP state UI
│   ├── COPPhaseSlider.tsx             # Temporal playback control
│   ├── COPPerspectiveToggle.tsx       # Friendly/Adversary/Combined switch
│   ├── COPEntityTooltip.tsx           # Hover tooltip (name + affiliation + linkages)
│   ├── COPEntityDetail.tsx            # Click detail view (full entity data)
│   ├── COPReviewPanel.tsx             # Staff review with spatial annotations + comments
│   ├── COPVersionBrowser.tsx          # Historical snapshot browser
│   ├── COPConflictBanner.tsx          # Cross-section conflict alerts
│   └── COPAgentActivity.tsx           # Agent activity feed integration
├── types/cop.ts                       # COP-specific TypeScript interfaces
└── lib/cop-service.ts                 # API client for COP endpoints
```

### Pattern 1: COP Coordinator as LangGraph StateGraph
**What:** The COP coordinator is a LangGraph StateGraph that receives triggers, routes to domain-lead agents, collects results, and assembles layers.
**When to use:** Every layer generation request flows through this coordinator.
**Example:**
```typescript
// Follows existing StrategyReviewerState pattern from backend/src/agents/langgraph/state.ts
import { Annotation, StateGraph, END } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

export const COPCoordinatorState = Annotation.Root({
  workspaceId: Annotation<string>,
  sectionId: Annotation<string>,
  triggeredBy: Annotation<'commit' | 'manual' | 'polling'>,
  triggerContext: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => next,
    default: () => ({}),
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  layerSpecs: Annotation<LayerSpec[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  assembledLayer: Annotation<COPLayer | null>({
    reducer: (prev, next) => next,
    default: () => null,
  }),
  status: Annotation<'routing' | 'generating' | 'assembling' | 'validating' | 'complete' | 'error'>({
    reducer: (prev, next) => next,
    default: () => 'routing' as const,
  }),
});

const graph = new StateGraph(COPCoordinatorState)
  .addNode('route', routeToLeads)
  .addNode('generate_layers', generateSubAgentLayers)
  .addNode('assemble', assembleLayers)
  .addNode('validate_cco', validateCCOCompliance)
  .addNode('persist', persistDraftLayer)
  .addEdge('__start__', 'route')
  .addEdge('route', 'generate_layers')
  .addEdge('generate_layers', 'assemble')
  .addEdge('assemble', 'validate_cco')
  .addEdge('validate_cco', 'persist')
  .addEdge('persist', END);
```

### Pattern 2: StaffAgentDef Extension for COP Agents
**What:** COP agents follow the same StaffAgentDef interface as the 31 JPP staff agents, seeded from config into database.
**When to use:** Defining new COP layer sub-agents.
**Example:**
```typescript
// Follows backend/src/exercise/agent-library.ts pattern
const COP_LAYER_AGENTS: StaffAgentDef[] = [
  {
    id: 'cop-force-disposition-001',
    roleKey: 'cop_j3_force',
    name: 'MAJ D. Torres',
    rank: 'MAJ',
    branch: 'IN',
    specialty: 'Force Disposition Overlay',
    focus: 'Produces COP force disposition layer with unit positions, SIDC codes, and movement paths from current OPORD/FRAGO data.',
    tools: ['read_orders', 'query_raft_graph', 'generate_layer_spec', 'validate_cco'],
    personality: ['precise', 'systematic', 'detail-oriented'],
    systemPromptHint: 'You produce the force disposition overlay for the COP. Extract unit positions, generate correct MIL-STD-2525D SIDC codes, and track movement paths. Output is a declarative JSON layer spec.',
    isDefault: true,
  },
  // ... additional sub-agents for each layer type
];
```

### Pattern 3: SVG Layer Spec (Declarative JSON)
**What:** Standard symbols use a declarative JSON spec that the frontend renders via milsymbol; LLM generates SVG fragments only for custom annotations.
**When to use:** All layer generation follows this hybrid approach.
**Example:**
```typescript
interface COPLayerSpec {
  layerId: string;
  layerType: 'force_disposition' | 'objectives' | 'control_measures' | 'intel' | 'logistics' | 'c2';
  workspaceId: string;
  sectionId: string;
  symbols: COPSymbolSpec[];
  controlMeasures: COPControlMeasureSpec[];
  customAnnotations: COPAnnotationSpec[]; // LLM-generated SVG fragments
  temporalPhases: COPPhaseSpec[];
  metadata: {
    generatedBy: string; // agent ID
    generatedAt: string;
    sourceDocumentIds: string[];
    ccoValidated: boolean;
  };
}

interface COPSymbolSpec {
  entityId: string;       // Links to RAFT graph entity
  sidc: string;           // MIL-STD-2525D 20-digit code
  position: { lat: number; lng: number };
  designation: string;
  affiliation: 'friendly' | 'enemy' | 'neutral' | 'unknown';
  movementPath?: Array<{ phase: number; position: { lat: number; lng: number } }>;
  linkedEntities: string[]; // RAFT entity IDs for hover/click detail
  ccoClass: string;         // CCO class URI for validation
  confidence: number;       // Agent confidence in placement
  sourceAuthority: string;  // For conflict resolution ranking
}
```

### Pattern 4: 4-State Layer Lifecycle with Version Snapshots
**What:** Layers progress through Draft -> Review -> Published -> COP states, with snapshots at each transition.
**When to use:** All layer state management.
**Example:**
```typescript
type LayerState = 'draft' | 'review' | 'published' | 'cop';

interface COPLayer {
  id: string;
  workspaceId: string;
  sectionId: string;
  layerType: string;
  state: LayerState;
  currentVersion: number;
  spec: COPLayerSpec;
  reviewFeedback?: ReviewFeedback[];
  promotedBy?: string;
  promotedAt?: Date;
  recalledBy?: string;
  recalledAt?: Date;
  recallReason?: string;
  auditTrail: AuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

interface LayerSnapshot {
  id: string;
  layerId: string;
  version: number;
  state: LayerState;
  spec: COPLayerSpec;      // Full spec frozen at transition time
  transitionedBy: string;
  transitionedAt: Date;
  previousState: LayerState;
}
```

### Pattern 5: IPBLayerControls-Style COP Layer Panel
**What:** Extends the IPBLayerControls grouping/toggle pattern for COP layers with additional lifecycle state badges.
**When to use:** COP layer visibility management on the map view.
**Example:**
```typescript
// Extends frontend/src/components/exercise/IPBLayerControls.tsx pattern
interface COPLayerControlsProps {
  layers: COPLayer[];
  layerVisibility: Record<string, boolean>;
  layerOpacity: Record<string, number>;    // Opacity sliders per layer
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
  currentPerspective: 'friendly' | 'adversary' | 'combined';
  onPerspectiveChange: (perspective: string) => void;
}
```

### Anti-Patterns to Avoid
- **Monolithic agent:** Do NOT build a single agent that generates the entire COP. Each sub-agent handles one layer type deterministically. The coordinator orchestrates, never generates.
- **Raw LLM SVG for standard symbols:** Never have the LLM generate SVG for standard MIL-STD-2525D symbols. milsymbol handles this deterministically. LLM-generated SVG is ONLY for custom annotations (arrows, boundaries, text notes).
- **Unbounded SVG from LLM:** Never inject LLM-generated SVG directly into DOM. Always sanitize with DOMPurify AND render in shadow DOM.
- **Replacing RAFT with CCO:** CCO is an overlay/validation layer, not a replacement for the existing RAFT graph. RAFT entities get CCO class annotations; the data model stays the same.
- **Polling-only triggers:** The primary trigger is document commit events. Polling is the fallback for autonomous sensor data, not the primary mechanism.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Military symbology rendering | Custom SVG symbol generator | milsymbol library (already installed) | Supports MIL-STD-2525C/D/E, APP-6 B/D/E; handles 1000+ symbol variations; <20ms per 1000 |
| SVG sanitization | Custom regex-based SVG cleaner | DOMPurify with `USE_PROFILES: {svg: true}` | Battle-tested XSS prevention; handles mXSS attacks, namespace confusion, event handler stripping |
| Agent state management | Custom state machine | LangGraph StateGraph with Annotation | Already established pattern; handles checkpointing, reducers, conditional edges |
| Entity resolution | Custom string matching | Existing resolution-service.ts + embedding similarity | Entity resolution pipeline already built with string-matcher.ts and blocking.ts |
| Map rendering | Custom canvas/WebGL map | React-Leaflet with SVG overlays | Existing COASketchMap pattern handles symbol placement, control measures, phase filtering |
| Ontology validation | Custom schema checker | CCO OWL files + simple class-membership check | CCO provides standard class hierarchy; validate entity -> CCO class mapping, don't rebuild ontology logic |
| Layer toggle UI | Custom checkbox tree | Extend IPBLayerControls pattern | Already handles grouped toggles, color swatches, visible/total counts, indeterminate checkboxes |

**Key insight:** This phase is primarily an integration and orchestration challenge, not a from-scratch build. Nearly every component has an existing pattern or library in the project.

## Common Pitfalls

### Pitfall 1: SIDC Code Generation Errors
**What goes wrong:** LLM generates invalid or incorrect 20-digit SIDC codes, producing wrong symbols or rendering failures.
**Why it happens:** MIL-STD-2525D SIDC is a 20-character numeric code where each position has strict meaning (version, identity, symbol set, status, HQ/TF/FD, echelon, etc.). LLMs can hallucinate valid-looking but incorrect codes.
**How to avoid:** Build a deterministic SIDC generator that maps entity type + affiliation + echelon + function to correct SIDC. Never let the LLM generate SIDC codes directly. Use lookup tables validated against milsymbol.
**Warning signs:** Symbols rendering as "unknown" or with wrong affiliation colors.

### Pitfall 2: SVG Injection via LLM-Generated Fragments
**What goes wrong:** LLM-generated SVG contains script elements, event handlers (onclick, onload), or external references (xlink:href to external URLs) that bypass sanitization.
**Why it happens:** LLMs trained on web content may include interactive SVG patterns that are legitimate in general web development but dangerous in a security context.
**How to avoid:** DOMPurify with strict SVG allowlist (path, rect, circle, ellipse, line, polyline, polygon, text, g, defs, use, marker, only internal references). FORBID all event attributes. Render in shadow DOM. Double-validate: sanitize on backend before storage AND on frontend before render.
**Warning signs:** SVG containing `<script>`, `on*` attributes, `javascript:` URIs, or external `xlink:href`.

### Pitfall 3: Agent Coordination Deadlocks
**What goes wrong:** COP coordinator waits for sub-agent responses that never come because the sub-agent is waiting for data from another sub-agent.
**Why it happens:** Circular dependencies in agent data requirements (e.g., force disposition needs intel threat positions, intel needs force disposition for context).
**How to avoid:** Strict DAG ordering of sub-agent execution. Define explicit dependency graph. Use timeouts (30s per sub-agent) with fallback to previous version. Independent sub-agents run in parallel; dependent ones run sequentially.
**Warning signs:** Layer generation hanging indefinitely; timeout errors in agent activity feed.

### Pitfall 4: CCO Validation Bottleneck
**What goes wrong:** Every entity must be CCO-validated before graph commit, creating a bottleneck that slows layer generation.
**Why it happens:** CCO has hundreds of classes; OWL reasoning can be expensive if done naively.
**How to avoid:** Pre-compute a CCO class lookup map at startup (load OWL once, build flat Map<string, CCOClass>). Entity-to-CCO mapping should be a simple lookup, not ontological reasoning. Cache validated mappings. The CCO schema is relatively stable -- reload only on explicit refresh.
**Warning signs:** Layer generation >10s; CCO validation appearing as hot path in profiling.

### Pitfall 5: Version Snapshot Storage Bloat
**What goes wrong:** Every layer state transition creates a full snapshot of the layer spec, leading to rapid storage growth.
**Why it happens:** Complex layers with many symbols generate large JSON specs; 4 state transitions per layer lifecycle.
**How to avoid:** Store full snapshot only at COP promotion (the authoritative version). For Draft->Review->Published transitions, store a diff (JSON patch) against the previous version. Set retention policy: keep all COP snapshots indefinitely; prune Draft/Review snapshots after 90 days.
**Warning signs:** cop_layer_snapshots table growing faster than 100MB/month.

### Pitfall 6: Cross-Section Conflict Detection False Positives
**What goes wrong:** Entity deduplication flags too many "conflicts" across workspace sections, overwhelming staff.
**Why it happens:** Different sections may refer to the same entity with different names, abbreviations, or levels of detail that aren't true conflicts.
**How to avoid:** Use the existing entity resolution pipeline (resolution-service.ts) to identify same entities before conflict detection. Only flag genuine contradictions: same entity, same attribute, different values (e.g., different positions for same unit). Provide source authority ranking to help staff resolve quickly.
**Warning signs:** >20 conflict flags per COP promotion; staff ignoring conflict alerts.

## Code Examples

### SVG Sanitizer with Military-Grade Allowlist
```typescript
// backend/src/cop/svg/svg-sanitizer.ts
import DOMPurify from 'dompurify';

const SVG_ALLOWED_TAGS = [
  'svg', 'g', 'defs', 'use', 'symbol',
  'path', 'rect', 'circle', 'ellipse', 'line',
  'polyline', 'polygon', 'text', 'tspan',
  'marker', 'clipPath', 'mask',
  'linearGradient', 'radialGradient', 'stop',
  'pattern', 'image', // image only for data: URIs
];

const SVG_ALLOWED_ATTRS = [
  'viewBox', 'xmlns', 'xmlns:xlink',
  'x', 'y', 'width', 'height', 'rx', 'ry',
  'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2',
  'd', 'points', 'transform', 'fill', 'stroke',
  'stroke-width', 'stroke-dasharray', 'stroke-linecap',
  'opacity', 'fill-opacity', 'stroke-opacity',
  'font-size', 'font-family', 'font-weight', 'text-anchor',
  'id', 'class', 'data-entity-id', 'data-layer-id',
  'marker-start', 'marker-mid', 'marker-end',
  'clip-path', 'mask', 'offset', 'stop-color', 'stop-opacity',
  'gradientUnits', 'gradientTransform', 'patternUnits',
  'href', // Internal references only -- DOMPurify handles external blocking
];

export function sanitizeSVG(svgString: string): string {
  return DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: false },
    ALLOWED_TAGS: SVG_ALLOWED_TAGS,
    ALLOWED_ATTR: SVG_ALLOWED_ATTRS,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus'],
    ALLOW_DATA_ATTR: true, // For data-entity-id, data-layer-id
    ADD_URI_SAFE_ATTR: [],
  });
}
```

### Typed Event Bus for Agent Coordination
```typescript
// backend/src/cop/messaging/event-bus.ts
import { EventEmitter } from 'events';

interface COPEvents {
  'document:committed': { workspaceId: string; sectionId: string; documentId: string };
  'layer:generation:start': { workspaceId: string; sectionId: string; triggeredBy: string };
  'layer:generation:complete': { layerId: string; status: 'success' | 'error' };
  'layer:state:transition': { layerId: string; from: LayerState; to: LayerState; by: string };
  'agent:activity': { agentId: string; action: string; detail: string };
  'conflict:detected': { layerId: string; conflictingLayerId: string; entities: string[] };
  'linkage:discovered': { entityId: string; linkedEntityId: string; confidence: number };
}

export class COPEventBus {
  private emitter = new EventEmitter();

  on<K extends keyof COPEvents>(event: K, handler: (data: COPEvents[K]) => void): void {
    this.emitter.on(event, handler);
  }

  emit<K extends keyof COPEvents>(event: K, data: COPEvents[K]): void {
    this.emitter.emit(event, data);
  }
}

// Singleton
export const copEventBus = new COPEventBus();
```

### SIDC Deterministic Generator
```typescript
// backend/src/cop/svg/sidc-builder.ts
// MIL-STD-2525D uses 20-character numeric SIDC
// Never let LLM generate these -- use lookup tables

interface SIDCParams {
  version: '10';                    // MIL-STD-2525D = version 10
  identity: 'friendly' | 'hostile' | 'neutral' | 'unknown';
  symbolSet: 'land_unit' | 'air' | 'sea_surface' | 'land_equipment' | 'land_installation';
  status: 'present' | 'planned' | 'anticipated';
  hqTfFd: 'none' | 'hq' | 'task_force' | 'feint_dummy';
  echelon: 'team' | 'squad' | 'platoon' | 'company' | 'battalion' | 'brigade' | 'division' | 'corps';
  entity: string;     // 6-digit entity code from MIL-STD-2525D table
  modifier1: string;  // 2-digit modifier
  modifier2: string;  // 2-digit modifier
}

const IDENTITY_MAP: Record<string, string> = {
  friendly: '03', hostile: '06', neutral: '04', unknown: '01',
};

const SYMBOL_SET_MAP: Record<string, string> = {
  land_unit: '10', air: '01', sea_surface: '30', land_equipment: '15', land_installation: '20',
};

export function buildSIDC(params: SIDCParams): string {
  // Version (2) + Identity (2) + Symbol Set (2) + Status (1) + HQ/TF/FD (1) + Echelon (2) + Entity (6) + Mod1 (2) + Mod2 (2) = 20
  return `${params.version}${IDENTITY_MAP[params.identity]}${SYMBOL_SET_MAP[params.symbolSet]}...`;
  // Full implementation maps all fields to correct digit positions
}
```

### CCO Class Validator
```typescript
// backend/src/cop/cco/cco-validator.ts

interface CCOClassMapping {
  uri: string;          // e.g., "cco:Agent", "cco:GeospatialRegion"
  label: string;
  module: 'core' | 'geospatial' | 'agent' | 'event' | 'artifact' | 'information_entity';
  parentClass?: string;
}

// Loaded once at startup from OWL/RDF file
let ccoClassMap: Map<string, CCOClassMapping> = new Map();

export function loadCCOSchema(owlFilePath: string): void {
  // Parse OWL/RDF, build flat lookup map
  // Key: class URI, Value: CCOClassMapping
  // This is a one-time startup cost
}

export function validateCCOClass(entityType: string, proposedClass: string): {
  valid: boolean;
  reason?: string;
} {
  const mapping = ccoClassMap.get(proposedClass);
  if (!mapping) {
    return { valid: false, reason: `Unknown CCO class: ${proposedClass}` };
  }
  return { valid: true };
}

export function suggestCCOClass(entityType: string, entityAttributes: Record<string, unknown>): string {
  // Map RAFT entity types to CCO classes:
  // Actor (nation/org) -> cco:Agent or subclass
  // Actor (individual) -> cco:Person
  // Relationship -> cco:ActOfRelating
  // Tension -> cco:ActOfConflict
  // Function -> cco:ActOfPerforming
  // Location -> cco:GeospatialRegion
  // Document -> cco:InformationContentEntity
  // Equipment -> cco:Artifact
  const typeMap: Record<string, string> = {
    'nation': 'cco:GovernmentOrganization',
    'organization': 'cco:Organization',
    'individual': 'cco:Person',
    'non_state_actor': 'cco:Organization',
  };
  return typeMap[entityType] || 'cco:Entity';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual military overlay creation | AI-assisted with human review | 2024-2025 | COP layers generated from document parsing, not manual drawing |
| Static symbol placement | Temporal phase animation | Already in COASketchMap | Phase slider with movement paths already implemented |
| Single-layer military maps | Stacked multi-layer with toggle | Already in IPBLayerControls | GIS-style layer management already established |
| Custom SVG for military symbols | milsymbol library | Already installed (v3.0.3) | Deterministic, standards-compliant symbol generation |
| Flat entity storage | Graph-based RAFT in Neo4j | Already implemented | Relationships, functions, tensions already modeled |
| CCO as academic ontology | DoD baseline standard (2024) | 2024 | IEEE PAR3195.1 standardization in progress |

**Deprecated/outdated:**
- milsymbol v2.x: Project uses v3.0.3 which supports 2525D/E
- Manual SIDC lookup: Build deterministic SIDC generator from entity attributes

## Open Questions

1. **CCO OWL File Source and Format**
   - What we know: CCO is available on GitHub (CommonCoreOntology/CommonCoreOntologies) under BSD-3 license; 11 ontology modules in Turtle (.ttl) format
   - What's unclear: Whether to use full AllCoreOntology.ttl or only the 4 relevant modules; parsing .ttl in Node.js (may need rdflib or n3 library)
   - Recommendation: Use only the 4 relevant modules (Geospatial, Agent, Event, Artifact+Information Entity). Parse with the `n3` npm library which handles Turtle format natively. Build a flat class lookup map at startup rather than full ontological reasoning.

2. **Embedding Model for Entity Similarity**
   - What we know: Decision specifies text-embedding-3-large (OpenAI); project has @langchain/openai installed
   - What's unclear: Embedding storage strategy -- store in Neo4j as vector property, or use a separate vector index
   - Recommendation: Store embeddings as float array properties on Neo4j nodes. Neo4j 5.x supports vector indexes natively. Use cosine similarity in Cypher queries for linkage discovery.

3. **Shadow DOM vs iframe for SVG Sandboxing**
   - What we know: Decision says "iframe/shadow DOM" with belt-and-suspenders approach
   - What's unclear: React's compatibility with shadow DOM for interactive components (tooltips, click handlers)
   - Recommendation: Use shadow DOM with `attachShadow({mode: 'open'})` on a container div. React 18+ works with shadow DOM via a custom wrapper component. Keep interactive elements (tooltips, click handlers) OUTSIDE the shadow DOM boundary -- the shadow DOM only contains the sanitized SVG. Event delegation handles click-to-entity mapping.

## Discretion Recommendations

### Confidence Threshold: 0.85
Rationale: Start at 0.85 as suggested. This is conservative enough to avoid false auto-commits while allowing obvious matches through. Make it configurable per workspace so operators can adjust based on their domain.

### Animation Timing
- Phase transition: 800ms ease-in-out (smooth but not sluggish)
- Movement path animation: 1200ms per phase step
- Layer fade in/out: 300ms ease
- Playback speed: 2 seconds per phase step (adjustable via speed control)

### Low-Power Polling Interval
- Default: 60 seconds between polls during inactivity
- Active watch (recent commit within 5 min): 15 seconds
- Deep idle (no activity for 1 hour): 300 seconds

### Version Snapshot Storage
- Format: JSONB column in PostgreSQL (cop_layer_snapshots table)
- Full snapshots at COP promotion; JSON Patch diffs for intermediate transitions
- Retention: COP snapshots kept indefinitely; Draft/Review diffs pruned after 90 days
- Estimated size: ~5-50KB per snapshot depending on layer complexity

## Sources

### Primary (HIGH confidence)
- Existing codebase: MilSymbolMarker.tsx, COASketchMap.tsx, IPBLayerControls.tsx -- verified patterns for milsymbol, SVG overlay, layer controls
- Existing codebase: agent-library.ts, types.ts -- StaffAgentDef interface and 31 agent definitions
- Existing codebase: graph/raft/ -- Actor, Relationship, ActorFunction, Tension types and stores in Neo4j
- Existing codebase: agents/langgraph/ -- LangGraph StateGraph pattern with Annotation, checkpointing
- [milsymbol GitHub](https://github.com/spatialillusions/milsymbol) -- MIL-STD-2525C/D/E support, pure JS SVG generation
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) -- SVG sanitization with USE_PROFILES: {svg: true}, allowlist/blocklist

### Secondary (MEDIUM confidence)
- [CCO GitHub](https://github.com/CommonCoreOntology/CommonCoreOntologies) -- 11 ontology modules, BSD-3 license, DoD baseline standard
- [LangGraph.js Multi-Agent Concepts](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/) -- Coordinator/supervisor pattern for multi-agent systems
- [IEEE SA CCO Standard](https://standards.ieee.org/ieee/3195.1/11026/) -- CCO standardization under PAR3195.1

### Tertiary (LOW confidence)
- Neo4j 5.x vector index support -- needs verification for specific Neo4j version deployed in this project
- n3 npm library for Turtle parsing -- needs verification for compatibility with CCO OWL files

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries already installed and patterns established in codebase
- Architecture: HIGH -- extends existing patterns (StaffAgentDef, LangGraph StateGraph, COASketchMap, IPBLayerControls)
- Agent coordination: MEDIUM -- multi-agent coordinator pattern is well-documented but project-specific orchestration logic is new
- CCO integration: MEDIUM -- CCO is well-documented but OWL parsing in Node.js and Neo4j overlay is new ground
- SVG security: HIGH -- DOMPurify is battle-tested; shadow DOM approach well-understood
- Pitfalls: HIGH -- based on analysis of existing codebase patterns and known failure modes

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, established libraries)
