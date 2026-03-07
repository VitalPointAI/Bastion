# Phase 27: Resource Registry & DID Plugin Architecture - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Elevate resources from simple data rows to first-class DID-bearing entities with a plugin registration system for resource types, a queryable registry with capability/area/status queries, resource grouping, and full COP integration with real-time updates. Creating new resource types beyond the 6 built-in categories, DAO governance integration, and AI staff integration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Plugin Scope & Boundaries
- All 6 existing resource categories get full plugin treatment (vehicles, weapons, communications, sensors, medical, other)
- Each plugin defines: schema & validation (zod), state machine (states + transitions), capabilities declaration (queryable tags), COP renderer (symbol + info popup + telemetry overlay), and data feed handler (telemetry/position ingestion)
- Plugins registered via convention-based auto-discovery — files in a known directory (e.g., `plugins/resources/`) are auto-loaded at startup
- Built-in plugins: AutonomousVehiclePlugin, SensorPlatformPlugin, WeaponSystemPlugin, CommsPlugin, LogisticsPlugin (medical + other combined or separate — Claude's discretion)

### DID Identity Model
- Same HKDF derivation pattern as agent DIDs: `did:near:resource-{id}` with blindedKey/publicKey, reusing `agent-did.ts` approach with different context string
- Tiered trust model: active resources (autonomous/AI-enabled) get trust tiers and team membership like agents; passive resources get capabilities only
- Active vs passive determined by: plugin declares the default for its type, but individual resources can override via a per-resource toggle
- Existing RES-{uuid} resources auto-migrate on startup — DID generated for any resource without one; RES-{uuid} stays as primary key, DID is additional identity field

### Registry & Query Design
- DB-backed registry with in-memory cache — PostgreSQL as source of truth (extends existing resources table), cache for fast capability/area queries
- All four query types essential: by capability, by area/location (spatial), by type & status, by DID
- AI agents access registry via tool functions (like existing raft-tools.ts pattern): findResourcesByCapability(), findResourcesInArea(), getResourceStatus()
- Resource grouping supported — resources can be grouped into units/formations; groups are queryable as single entities with aggregate capabilities

### COP Integration & Rendering
- Symbology: MIL-STD-2525D from SIDC when available, fallback to plugin-provided custom icons when SIDC not set
- Real-time position updates via WebSocket — plugin data feed handler processes incoming position data, pushes to COP
- Resource popup/detail panel shows all four info categories: identity & status, capabilities & specs, telemetry & feeds, assignment & grouping
- Clustering at low zoom levels with count badges — click to expand

### Claude's Discretion
- Exact plugin interface shape and base class design
- Cache invalidation strategy for DB-backed registry
- Spatial query implementation (PostGIS vs application-level)
- WebSocket channel design for resource telemetry
- Clustering algorithm and zoom thresholds
- How to combine medical + other into LogisticsPlugin (or keep separate)
- State machine library choice or custom implementation

</decisions>

<specifics>
## Specific Ideas

- Plugin auto-discovery mirrors how agent roles are seeded — convention over configuration
- Agent DID pattern (HKDF with context string) is the proven model — resource DIDs follow the same crypto path
- Resource groups should be queryable as aggregate entities (e.g., "platoon has ISR + fires capability" from member resources)
- Active/passive is a hybrid: plugin sets the default, per-resource override allows exceptions (e.g., a manually-operated vehicle in the autonomous category)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/agents/agent-did.ts`: HKDF key derivation, `did:near:agent-{id}` format — clone for resource DIDs with different context string
- `backend/src/agents/registry.ts`: AgentRegistry singleton pattern — reference for registry API design (registerAgent, lookup, capability queries)
- `backend/src/agents/team-registry.ts`: Team membership model — reference for resource grouping
- `backend/src/resources/resource-store.ts`: Existing CRUD store with PostgreSQL, RES-{uuid} IDs, categories, SIDC field already in schema
- `backend/src/api/resources.ts`: REST API for resources — extend with registry/DID endpoints
- `frontend/src/components/mission/resources/ResourceCatalog.tsx`: Tabbed UI with @tanstack/react-table — extend for DID display and plugin-specific fields
- `frontend/src/components/mission/resources/ResourceForm.tsx`: Zod-validated form — extend with plugin-provided schema fields
- `backend/src/graph/tools/raft-tools.ts`: Agent tool function pattern — reference for resource registry tools

### Established Patterns
- DID creation: HKDF with system secret, context-specific info string, 64-byte derivation (32 blinded + 32 public)
- Registry: Singleton with Map-based storage, async initialization, ensureInitialized() guard
- Agent tools: Function definitions registered with tool registry, called by AI agents during planning
- Data store: PostgreSQL with init table function, class-based store with ensureInitialized()

### Integration Points
- Resource registry tools register with existing tool registry (`backend/src/agents/tool-registry.ts`)
- COP rendering connects to existing map component (WebSocket for real-time updates)
- Resource DIDs stored alongside existing RES-{uuid} in resources table (new columns: did, blinded_key, public_key, is_autonomous)
- Plugin-specific schemas extend the existing `specifications JSONB` field
- Message bus (`backend/src/messaging/message-bus.ts`) for telemetry event distribution

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-resource-registry-did-plugin-architecture-inserted*
*Context gathered: 2026-03-06*
