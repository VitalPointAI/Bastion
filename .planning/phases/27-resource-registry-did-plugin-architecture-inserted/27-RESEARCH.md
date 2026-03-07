# Phase 27: Resource Registry & DID Plugin Architecture - Research

**Researched:** 2026-03-06
**Domain:** Plugin architecture, DID identity, spatial queries, real-time telemetry, military symbology
**Confidence:** HIGH

## Summary

Phase 27 elevates resources from simple CRUD data rows to first-class DID-bearing entities with a plugin-based type system, queryable registry, resource grouping, and COP integration. The project already has proven patterns for every major subsystem: agent DIDs (HKDF derivation in `agent-did.ts`), registries (AgentRegistry singleton), tool registration (ToolRegistry), team grouping (TeamRegistry), WebSocket real-time delivery (`ws` library), COP rendering (Leaflet + milsymbol), and state machines (`xstate` already a dependency). The implementation is primarily cloning and extending these established patterns with resource-specific domain logic.

The existing resource system has 6 categories (`vehicles`, `weapons`, `communications`, `sensors`, `medical`, `other`), FMC/PMC/NMC status tracking, SIDC field for MIL-STD-2525D symbology, location coordinates, and a JSONB specifications field. The plugin architecture wraps each category with schema validation, state machine definitions, capability declarations, COP rendering instructions, and telemetry feed handlers. No new major dependencies are required -- all building blocks exist in the codebase.

**Primary recommendation:** Clone the agent DID/registry pattern exactly, build plugins as convention-loaded modules in `backend/src/resources/plugins/`, extend the existing resources table with DID columns, and leverage the existing WebSocket infrastructure for telemetry push.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 6 existing resource categories get full plugin treatment (vehicles, weapons, communications, sensors, medical, other)
- Each plugin defines: schema & validation (zod), state machine (states + transitions), capabilities declaration (queryable tags), COP renderer (symbol + info popup + telemetry overlay), and data feed handler (telemetry/position ingestion)
- Plugins registered via convention-based auto-discovery -- files in a known directory (e.g., `plugins/resources/`) are auto-loaded at startup
- Built-in plugins: AutonomousVehiclePlugin, SensorPlatformPlugin, WeaponSystemPlugin, CommsPlugin, LogisticsPlugin (medical + other combined or separate -- Claude's discretion)
- Same HKDF derivation pattern as agent DIDs: `did:near:resource-{id}` with blindedKey/publicKey, reusing `agent-did.ts` approach with different context string
- Tiered trust model: active resources (autonomous/AI-enabled) get trust tiers and team membership like agents; passive resources get capabilities only
- Active vs passive determined by: plugin declares the default for its type, but individual resources can override via a per-resource toggle
- Existing RES-{uuid} resources auto-migrate on startup -- DID generated for any resource without one; RES-{uuid} stays as primary key, DID is additional identity field
- DB-backed registry with in-memory cache -- PostgreSQL as source of truth (extends existing resources table), cache for fast capability/area queries
- All four query types essential: by capability, by area/location (spatial), by type & status, by DID
- AI agents access registry via tool functions (like existing raft-tools.ts pattern): findResourcesByCapability(), findResourcesInArea(), getResourceStatus()
- Resource grouping supported -- resources can be grouped into units/formations; groups are queryable as single entities with aggregate capabilities
- Symbology: MIL-STD-2525D from SIDC when available, fallback to plugin-provided custom icons when SIDC not set
- Real-time position updates via WebSocket -- plugin data feed handler processes incoming position data, pushes to COP
- Resource popup/detail panel shows all four info categories: identity & status, capabilities & specs, telemetry & feeds, assignment & grouping
- Clustering at low zoom levels with count badges -- click to expand

### Claude's Discretion
- Exact plugin interface shape and base class design
- Cache invalidation strategy for DB-backed registry
- Spatial query implementation (PostGIS vs application-level)
- WebSocket channel design for resource telemetry
- Clustering algorithm and zoom thresholds
- How to combine medical + other into LogisticsPlugin (or keep separate)
- State machine library choice or custom implementation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | (existing) | Plugin schema validation | Already used for all forms and API validation |
| xstate | (existing) | Resource state machines | Already a backend dependency, battle-tested FSM library |
| ws | ^8.19.0 | WebSocket for telemetry push | Already used for message bus real-time delivery |
| milsymbol | ^3.0.3 | MIL-STD-2525D symbol rendering | Already used in COP map for military symbols |
| leaflet / react-leaflet | ^1.9.4 / ^5.0.0 | COP map rendering | Already the COP rendering engine |
| leaflet-realtime | ^2.2.0 | Real-time position updates on map | Already installed, designed for live tracking |
| @noble/hashes | (existing) | HKDF key derivation for DIDs | Already used for agent DID derivation |
| pg | (existing) | PostgreSQL queries | Already the database layer |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | (existing) | Resource catalog table UI | Already used in ResourceCatalog.tsx |
| react-hook-form | (existing) | Resource forms | Already used in ResourceForm.tsx |
| pg-boss | (existing) | Job queue for async operations | Telemetry processing, batch DID migration |

### New Dependencies Required
None. All required libraries are already installed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Application-level spatial queries | PostGIS extension | PostGIS is more performant for complex geo queries but adds deployment complexity; application-level bounding box is sufficient for resource area queries with hundreds/low-thousands of resources |
| xstate for state machines | Custom switch-based FSM | xstate adds type safety, visualization, and guards; already a dependency so no cost |
| Separate MedicalPlugin + OtherPlugin | Combined LogisticsPlugin | Keep separate -- MedicalPlugin has distinct states (sterile/contaminated) and capabilities (CASEVAC, triage) vs OtherPlugin which is a catch-all. 6 plugins for 6 categories is cleaner |

## Architecture Patterns

### Recommended Project Structure
```
backend/src/resources/
  plugins/                    # Convention-based auto-discovery directory
    base-plugin.ts            # Abstract base class / interface
    plugin-loader.ts          # Auto-discovery loader (scans directory)
    plugin-registry.ts        # Maps category -> plugin instance
    vehicle-plugin.ts         # AutonomousVehiclePlugin
    sensor-plugin.ts          # SensorPlatformPlugin
    weapon-plugin.ts          # WeaponSystemPlugin
    comms-plugin.ts           # CommsPlugin
    medical-plugin.ts         # MedicalPlugin
    other-plugin.ts           # OtherPlugin (general-purpose)
  resource-did.ts             # DID creation (clone of agent-did.ts)
  resource-registry.ts        # DB-backed registry with cache
  resource-group-store.ts     # Resource grouping (units/formations)
  resource-telemetry.ts       # Telemetry ingestion and WebSocket push
  resource-store.ts           # (existing) CRUD store - extended
  types.ts                    # (existing) types - extended
backend/src/graph/tools/
  resource-tools.ts           # AI agent tool functions for registry
frontend/src/components/cop/
  COPResourceLayer.tsx         # Resource symbols on COP map
  COPResourceDetail.tsx        # Resource detail panel (4-tab)
  COPResourceCluster.tsx       # Clustering at low zoom
frontend/src/lib/
  resource-registry-service.ts # Frontend API client for registry
```

### Pattern 1: Plugin Interface (Strategy Pattern)
**What:** Each resource type plugin implements a standard interface defining schema, state machine, capabilities, COP renderer config, and feed handler
**When to use:** For every resource category
**Example:**
```typescript
// Source: Derived from existing agent/tool patterns in codebase
import { z } from 'zod';
import { createMachine } from 'xstate';

export interface ResourcePlugin {
  /** Unique category identifier */
  readonly category: string;
  /** Human-readable name */
  readonly displayName: string;
  /** Whether resources of this type default to active (autonomous) */
  readonly defaultIsAutonomous: boolean;
  /** Zod schema for plugin-specific specifications */
  readonly specificationsSchema: z.ZodType;
  /** XState machine definition for status transitions */
  readonly stateMachine: ReturnType<typeof createMachine>;
  /** Capability tags this resource type can have */
  readonly capabilities: string[];
  /** Default SIDC prefix for MIL-STD-2525D rendering */
  readonly defaultSIDCPrefix?: string;
  /** Custom icon config when no SIDC is set */
  readonly fallbackIcon?: { url: string; size: [number, number] };
  /** Process incoming telemetry data */
  processTelemetry?(resourceId: string, data: unknown): Promise<void>;
  /** Validate specifications against plugin schema */
  validateSpecifications(specs: unknown): z.SafeParseReturnType<unknown, unknown>;
}
```

### Pattern 2: Convention-Based Plugin Auto-Discovery
**What:** Plugin loader scans a directory for files exporting `ResourcePlugin` implementations, registers them by category
**When to use:** At server startup
**Example:**
```typescript
// Source: Mirrors agent seeding pattern in agents/langgraph/agent-seeder.ts
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { ResourcePlugin } from './base-plugin.js';

const PLUGIN_DIR = new URL('./', import.meta.url).pathname;
const SKIP_FILES = ['base-plugin', 'plugin-loader', 'plugin-registry'];

export async function loadPlugins(): Promise<Map<string, ResourcePlugin>> {
  const plugins = new Map<string, ResourcePlugin>();
  const files = await readdir(PLUGIN_DIR);

  for (const file of files) {
    if (!file.endsWith('-plugin.ts') && !file.endsWith('-plugin.js')) continue;
    const baseName = file.replace(/\.(ts|js)$/, '');
    if (SKIP_FILES.includes(baseName)) continue;

    const mod = await import(join(PLUGIN_DIR, file));
    const plugin: ResourcePlugin = mod.default || mod.plugin;
    if (plugin?.category) {
      plugins.set(plugin.category, plugin);
    }
  }
  return plugins;
}
```

### Pattern 3: DB-Backed Registry with In-Memory Cache
**What:** PostgreSQL as source of truth, Map-based cache for fast queries, cache invalidation on writes
**When to use:** ResourceRegistry singleton -- all resource lookups go through this
**Example:**
```typescript
// Source: Extends AgentRegistry pattern (backend/src/agents/registry.ts)
export class ResourceRegistry {
  private cache: Map<string, RegisteredResource> = new Map();
  private didIndex: Map<string, string> = new Map(); // did -> resourceId
  private capabilityIndex: Map<string, Set<string>> = new Map(); // capability -> resourceIds
  private initialized = false;

  async ensureInitialized(): Promise<void> { /* load from DB */ }

  async registerResource(manifest: ResourceManifest): Promise<RegisteredResource> {
    // 1. Generate DID via resource-did.ts
    // 2. Insert/update in PostgreSQL
    // 3. Update cache + indexes
  }

  getByDID(did: string): RegisteredResource | undefined {
    return this.cache.get(this.didIndex.get(did) ?? '');
  }

  findByCapability(capability: string): RegisteredResource[] {
    const ids = this.capabilityIndex.get(capability) ?? new Set();
    return [...ids].map(id => this.cache.get(id)!).filter(Boolean);
  }

  findInArea(bounds: { north: number; south: number; east: number; west: number }): RegisteredResource[] {
    // Application-level bounding box filter on cached resources with location
    return [...this.cache.values()].filter(r =>
      r.location &&
      r.location.lat >= bounds.south && r.location.lat <= bounds.north &&
      r.location.lng >= bounds.west && r.location.lng <= bounds.east
    );
  }
}
```

### Pattern 4: Resource DID Creation (Clone of Agent DID)
**What:** HKDF derivation with resource-specific context string
**When to use:** When registering any resource (new or migrating existing)
**Example:**
```typescript
// Source: Direct clone of backend/src/agents/agent-did.ts
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const RESOURCE_KEY_CONTEXT = 'bastion-resource-did-v1';

function deriveResourceKeys(resourceId: string): { blindedKey: string; publicKey: string } {
  const systemSecret = process.env.ENCRYPTION_KEY || 'dev-secret-key';
  const info = utf8ToBytes(`${RESOURCE_KEY_CONTEXT}:${resourceId}`);
  const derived = hkdf(sha256, utf8ToBytes(systemSecret), undefined, info, 64);
  return {
    blindedKey: bytesToHex(derived.slice(0, 32)),
    publicKey: bytesToHex(derived.slice(32, 64)),
  };
}

export async function createResourceDID(resourceId: string): Promise<{
  did: string; blindedKey: string; publicKey: string;
}> {
  const keys = deriveResourceKeys(resourceId);
  return { did: `did:near:resource-${resourceId}`, ...keys };
}
```

### Pattern 5: XState Resource State Machine
**What:** Each plugin defines an xstate machine for its resource type's status transitions
**When to use:** For status validation, transition guards, and audit trail
**Example:**
```typescript
// Source: xstate already a project dependency
import { createMachine } from 'xstate';

export const vehicleStateMachine = createMachine({
  id: 'vehicleStatus',
  initial: 'FMC',
  states: {
    FMC: { on: { DEGRADE: 'PMC', FAIL: 'NMC', DEPLOY: 'deployed' } },
    PMC: { on: { REPAIR: 'FMC', FAIL: 'NMC' } },
    NMC: { on: { REPAIR: 'PMC', CONDEMN: 'condemned' } },
    deployed: { on: { RETURN: 'FMC', DEGRADE: 'PMC', DAMAGE: 'NMC' } },
    condemned: { type: 'final' },
  },
});
```

### Anti-Patterns to Avoid
- **Building a second registry for resources that doesn't follow the AgentRegistry pattern:** The existing patterns are proven. Clone, don't reinvent.
- **Using PostGIS for spatial queries at this scale:** The project doesn't use PostGIS anywhere. Application-level bounding box filtering on cached resources (likely hundreds, not millions) is simpler and sufficient.
- **Creating a separate WebSocket server for telemetry:** Reuse the existing `ws` server with a dedicated channel/topic prefix (e.g., `resource:telemetry:{id}`).
- **Plugin schemas that don't extend the base specifications JSONB field:** The existing `specifications JSONB` column is the right place for plugin-specific data. Don't create per-plugin tables.
- **Hardcoding resource types instead of using plugin system:** Even the built-in types should go through the plugin interface to ensure the system is truly extensible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machines | Custom if/switch status transitions | xstate (already installed) | Guards, history, serialization, visualization |
| DID key derivation | Custom crypto | @noble/hashes HKDF (existing pattern) | Proven pattern in agent-did.ts, audited library |
| Schema validation | Manual type checking | zod (existing pattern) | Runtime validation, TypeScript inference, error messages |
| Military symbology | Custom SVG rendering | milsymbol (already installed) | MIL-STD-2525D compliant, handles all symbol types |
| Map clustering | Custom clustering algorithm | leaflet.markercluster | Widely used Leaflet plugin for marker clustering |
| Real-time updates | Polling | ws WebSocket (existing infrastructure) | Already set up in messaging API, proven pattern |
| Job queue | Custom async processing | pg-boss (already installed) | Already used for message delivery, handles retries |

**Key insight:** Every major subsystem this phase needs already exists in the codebase in an analogous form. The work is cloning patterns and adding domain-specific logic, not building infrastructure.

## Common Pitfalls

### Pitfall 1: Category Mismatch Between Frontend and Backend
**What goes wrong:** Frontend uses `vehicles | weapons | communications | sensors | medical | other` but backend types.ts uses `weapon_system | vehicle | equipment | communication`. They're out of sync.
**Why it happens:** Frontend was updated independently of backend types. The frontend enum is the source of truth (used in forms).
**How to avoid:** Align the backend `ResourceCategory` type with the frontend's 6 categories. The migration must handle mapping old category values to new ones. Plugin categories map 1:1 to these 6 values.
**Warning signs:** Resources created in the UI don't appear with correct categories when queried.

### Pitfall 2: DID Migration Breaking Existing Resources
**What goes wrong:** Auto-migration generates DIDs for all existing resources on startup, but if the system secret changes or is different between environments, DIDs become inconsistent.
**Why it happens:** HKDF derivation is deterministic per system secret. Different secrets = different DIDs for same resource ID.
**How to avoid:** DIDs once generated should be stored in the database (not re-derived). The migration is a one-time operation that writes DIDs to new columns. After migration, the stored DID is authoritative.
**Warning signs:** DID verification fails, or resources show different DIDs after environment changes.

### Pitfall 3: Cache Staleness in Multi-Instance Deployment
**What goes wrong:** In-memory cache diverges across server instances if the project runs multiple backend processes.
**Why it happens:** Currently single-instance deployment (Hetzner), but could become an issue.
**How to avoid:** For now, single-instance is fine. Design cache invalidation with pg-boss events or LISTEN/NOTIFY so it can scale later. Keep TTL-based cache refresh as backup (e.g., 60 second refresh).
**Warning signs:** Resource changes visible on one request but stale on the next.

### Pitfall 4: WebSocket Channel Flooding from Telemetry
**What goes wrong:** High-frequency telemetry updates (e.g., GPS at 1Hz from 100 resources) overwhelm WebSocket connections.
**Why it happens:** No throttling or batching of position updates.
**How to avoid:** Batch telemetry updates into periodic frames (e.g., aggregate all position updates every 2-5 seconds), send as single batch message per frame. Client-side interpolation smooths movement.
**Warning signs:** UI lag, dropped WebSocket frames, browser memory growth.

### Pitfall 5: Plugin Loading Order Dependencies
**What goes wrong:** Plugins that depend on the registry being initialized fail because plugin loading happens before registry init.
**Why it happens:** Circular dependency between plugin registration and registry initialization.
**How to avoid:** Two-phase init: 1) load plugin modules (pure definitions), 2) register plugins with registry after DB is ready. Plugins should be stateless definitions, not singletons with side effects.
**Warning signs:** Startup crashes or undefined registry errors during plugin registration.

### Pitfall 6: Resource Grouping N+1 Queries
**What goes wrong:** Querying aggregate capabilities for a resource group triggers individual queries for each member resource.
**Why it happens:** Naive implementation that fetches each member separately.
**How to avoid:** Use batch query (`WHERE id = ANY($1)`) for group member resolution. Cache aggregated capabilities on the group record itself, invalidate on member change.
**Warning signs:** Slow group queries, increasing latency with larger groups.

## Code Examples

### Existing Agent DID Pattern (to clone)
```typescript
// Source: backend/src/agents/agent-did.ts (lines 21-35)
function deriveAgentKeys(agentId: string): { blindedKey: string; publicKey: string } {
  const systemSecret = process.env.ENCRYPTION_KEY || 'dev-secret-key';
  const info = utf8ToBytes(`${AGENT_KEY_CONTEXT}:${agentId}`);
  const derived = hkdf(sha256, utf8ToBytes(systemSecret), undefined, info, 64);
  return {
    blindedKey: bytesToHex(derived.slice(0, 32)),
    publicKey: bytesToHex(derived.slice(32, 64)),
  };
}
```

### Existing Registry Singleton Pattern (to clone)
```typescript
// Source: backend/src/agents/registry.ts (lines 554-564)
let registryInstance: AgentRegistry | null = null;
export function getAgentRegistry(): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry();
  }
  return registryInstance;
}
```

### Existing Tool Registration Pattern (for AI agent tools)
```typescript
// Source: backend/src/graph/tools/raft-tools.ts (lines 19-60)
export const raftToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'create_actor',
    name: 'Create Actor',
    description: 'Add an actor node to the RAFT graph...',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: { /* ... */ },
      required: ['name', 'type'],
    },
  },
];
```

### Database Migration for DID Columns
```sql
-- Add DID columns to existing resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS did TEXT UNIQUE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS blinded_key TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_autonomous BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS capabilities TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS group_id TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Index for DID lookups
CREATE INDEX IF NOT EXISTS idx_resource_did ON resources(did);
-- Index for capability queries (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_resource_capabilities ON resources USING GIN(capabilities);
-- Index for group queries
CREATE INDEX IF NOT EXISTS idx_resource_group ON resources(group_id);

-- Resource groups table
CREATE TABLE IF NOT EXISTS resource_groups (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL, -- 'unit', 'formation', 'task_force', 'custom'
  parent_group_id TEXT REFERENCES resource_groups(id),
  aggregate_capabilities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### WebSocket Telemetry Channel Pattern
```typescript
// Source: Extends pattern from backend/src/api/messaging.ts
// Reuse existing ws server, add resource telemetry topic
const RESOURCE_TELEMETRY_PREFIX = 'resource:telemetry:';
const RESOURCE_POSITION_CHANNEL = 'resource:positions';

// Batch position updates every 3 seconds
let pendingPositions: Map<string, { lat: number; lng: number; timestamp: number }> = new Map();
setInterval(() => {
  if (pendingPositions.size > 0) {
    broadcastToChannel(RESOURCE_POSITION_CHANNEL, {
      type: 'position_batch',
      positions: Object.fromEntries(pendingPositions),
    });
    pendingPositions = new Map();
  }
}, 3000);
```

### Leaflet MarkerCluster for Resource Clustering
```typescript
// Frontend COP resource layer with clustering
import MarkerClusterGroup from 'react-leaflet-cluster';

// Cluster resources at low zoom with count badges
<MarkerClusterGroup
  chunkedLoading
  maxClusterRadius={50}
  disableClusteringAtZoom={12}
  spiderfyOnMaxZoom={true}
  showCoverageOnHover={false}
  iconCreateFunction={(cluster) => {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `<div class="resource-cluster-badge">${count}</div>`,
      className: 'resource-cluster-icon',
      iconSize: L.point(40, 40),
    });
  }}
>
  {resources.map(r => <Marker key={r.id} ... />)}
</MarkerClusterGroup>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple CRUD resources (current) | DID-bearing entities with plugin types | This phase | Resources become addressable, queryable, trackable entities |
| Flat category string | Plugin-defined typed categories | This phase | Each category gets schema, state machine, capabilities |
| Manual status updates | State machine governed transitions | This phase | Prevents invalid transitions, enables audit trail |
| No real-time tracking | WebSocket position updates on COP | This phase | Resources appear and move on the map in real time |
| No grouping | Resource groups with aggregate capabilities | This phase | Units/formations queryable as single entities |

## Discretion Recommendations

### Spatial Query: Application-Level (not PostGIS)
**Recommendation:** Use application-level bounding box filtering on the in-memory cache.
**Rationale:** The project has zero PostGIS usage. Adding it requires extension installation, deployment changes, and learning curve. For hundreds of resources with lat/lng coordinates, iterating the cache with bounding box math is sub-millisecond. If scale demands it later, PostGIS can be added as an optimization.

### Cache Invalidation: Write-Through with Periodic Refresh
**Recommendation:** Write-through cache (update cache immediately on DB write) plus periodic full refresh every 60 seconds as safety net.
**Rationale:** Single-instance deployment makes write-through reliable. Periodic refresh catches any edge cases (direct DB edits, crash recovery). Use PostgreSQL LISTEN/NOTIFY for future multi-instance support.

### WebSocket Channel Design: Shared Server, Topic-Based Routing
**Recommendation:** Reuse the existing `ws` WebSocket server from `backend/src/api/messaging.ts`. Add resource-specific message types with a `resource:` prefix. Batch position updates every 3 seconds.
**Rationale:** No need for a separate WebSocket server. The messaging infrastructure already handles topic-based routing and authentication.

### Medical + Other: Keep Separate (6 plugins for 6 categories)
**Recommendation:** Create MedicalPlugin and OtherPlugin separately rather than combining into LogisticsPlugin.
**Rationale:** Medical resources have distinct domain concepts (triage capability, CASEVAC, sterile/contaminated states, class VIII supply chain). OtherPlugin is a catch-all for miscellaneous equipment. Combining them conflates two different domains. 6 plugins for 6 categories is the cleanest mapping.

### State Machine: Use xstate (already installed)
**Recommendation:** Use xstate for all plugin state machines.
**Rationale:** Already a project dependency. Provides typed states, guards, actions, serialization, and devtools. Each plugin exports a machine definition; the registry creates instances per resource.

### Clustering: leaflet.markercluster (via react-leaflet-cluster)
**Recommendation:** Use `react-leaflet-cluster` (wrapper around leaflet.markercluster) with `disableClusteringAtZoom: 12` and max cluster radius of 50px.
**Rationale:** Standard Leaflet clustering solution. Handles hundreds of markers efficiently. New frontend dependency but lightweight.

## Open Questions

1. **Frontend category alignment**
   - What we know: Frontend uses `vehicles | weapons | communications | sensors | medical | other`, backend uses `weapon_system | vehicle | equipment | communication` -- these are out of sync
   - What's unclear: Whether existing data in production uses the old backend categories
   - Recommendation: Migration should map old backend categories to the 6 frontend categories (which are the canonical set per CONTEXT.md decisions)

2. **leaflet.markercluster / react-leaflet-cluster compatibility**
   - What we know: Project uses react-leaflet ^5.0.0 (React 18+ compatible)
   - What's unclear: Whether `react-leaflet-cluster` is compatible with react-leaflet v5
   - Recommendation: Verify at implementation time. If incompatible, use Leaflet's built-in MarkerClusterGroup directly or implement simple zoom-level-based visibility toggle

3. **Resource telemetry data format**
   - What we know: Plugins define a `processTelemetry` method for their type
   - What's unclear: The exact telemetry payload schema for each resource type (GPS format, sensor readings, etc.)
   - Recommendation: Define a base telemetry envelope `{ resourceId, timestamp, type, data }` where `data` is plugin-specific. Start with position-only (`{ lat, lng, heading?, speed? }`) as the universal telemetry type

## Sources

### Primary (HIGH confidence)
- `backend/src/agents/agent-did.ts` -- HKDF derivation pattern, DID format, key structure
- `backend/src/agents/registry.ts` -- AgentRegistry singleton, registration, capability queries
- `backend/src/agents/team-registry.ts` -- Team grouping pattern, member management
- `backend/src/resources/resource-store.ts` -- Current resource CRUD, table schema, RES-{uuid} IDs
- `backend/src/resources/types.ts` -- Current ResourceCategory, ResourceStatus, Resource interface
- `frontend/src/lib/resource-service.ts` -- Frontend resource types (6 categories, canonical)
- `frontend/src/components/cop/COPMapView.tsx` -- COP rendering with milsymbol, Leaflet
- `backend/src/api/messaging.ts` -- WebSocket server pattern for real-time delivery
- `backend/src/graph/tools/raft-tools.ts` -- AI agent tool definition pattern
- `backend/package.json` -- Confirmed: xstate, ws, @noble/hashes, milsymbol, pg-boss all installed
- `frontend/package.json` -- Confirmed: milsymbol, leaflet, react-leaflet, leaflet-realtime installed

### Secondary (MEDIUM confidence)
- xstate v5 documentation for createMachine API and TypeScript integration
- leaflet.markercluster documentation for clustering configuration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, versions verified from package.json
- Architecture: HIGH -- every pattern directly clones proven existing code (AgentRegistry, agent-did.ts, TeamRegistry, raft-tools.ts)
- Pitfalls: HIGH -- identified from direct code inspection (category mismatch is verifiable in source)
- COP Integration: HIGH -- COPMapView.tsx and milsymbol patterns inspected directly
- Clustering: MEDIUM -- react-leaflet-cluster compatibility with react-leaflet v5 unverified

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, internal patterns)
