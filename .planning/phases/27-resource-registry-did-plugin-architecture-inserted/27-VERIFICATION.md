---
phase: 27-resource-registry-did-plugin-architecture-inserted
verified: 2026-03-07T01:30:00Z
status: gaps_found
score: 14/15 must-haves verified
gaps:
  - truth: "AI agents can query resources by capability and area via tool functions"
    status: partial
    reason: "resourceToolDefinitions defined but not registered in tools/index.ts or agent-seeder.ts"
    artifacts:
      - path: "backend/src/graph/tools/resource-tools.ts"
        issue: "ORPHANED - file exists with 3 MCP tool definitions but is not imported by tools/index.ts or agents/langgraph/agent-seeder.ts"
    missing:
      - "Import resourceToolDefinitions in backend/src/graph/tools/index.ts and spread into allToolDefinitions array"
      - "OR import in backend/src/agents/langgraph/agent-seeder.ts alongside raftToolDefinitions"
---

# Phase 27: Resource Registry & DID Plugin Architecture Verification Report

**Phase Goal:** Elevate resources from data records to first-class entities with DIDs, a plugin registration system for resource types, and full integration with the COP, DAO governance, and AI agent ecosystem
**Verified:** 2026-03-07T01:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ResourceCategory type uses 6 canonical categories matching frontend | VERIFIED | `types.ts` line 11: `'vehicles' \| 'weapons' \| 'communications' \| 'sensors' \| 'medical' \| 'other'`; `schemas.ts` line 23 also aligned |
| 2 | Resource DID can be generated deterministically from resource ID | VERIFIED | `resource-did.ts` uses HKDF with `bastion-resource-did-v1` context, returns `did:near:resource-{id}` |
| 3 | Plugin interface defines all 5 required plugin facets | VERIFIED | `base-plugin.ts` defines `specificationsSchema`, `stateMachine`, `capabilities`, `processTelemetry?`, `getDetailSections?` |
| 4 | All 6 resource categories have corresponding plugin implementations | VERIFIED | 6 files exist: vehicle, sensor, weapon, comms, medical, other (66-91 lines each, all substantive) |
| 5 | Plugins auto-discover from the plugins directory at startup | VERIFIED | `plugin-loader.ts` scans for `*-plugin.ts` files, skips infrastructure files |
| 6 | Plugin registry maps category string to plugin instance | VERIFIED | `plugin-registry.ts` singleton with `getPlugin(category)`, `getCategories()` |
| 7 | Each plugin defines zod schema, xstate state machine, and capability tags | VERIFIED | vehicle-plugin.ts confirmed: `z.object({...})`, `setup().createMachine()`, `capabilities: [...]` |
| 8 | Resources can be registered with DID auto-generation | VERIFIED | `resource-registry.ts:registerResource()` calls `createResourceDID()` after DB insert |
| 9 | Registry supports all 4 query types: by capability, by area, by type+status, by DID | VERIFIED | `getByDID()`, `findByCapability()`, `findByTypeAndStatus()`, `findInArea()` all implemented |
| 10 | Resources can be grouped into units/formations with aggregate capabilities | VERIFIED | `resource-group-store.ts` has full CRUD, `updateAggregateCapabilities()` uses batch unnest |
| 11 | Existing resources auto-migrate to get DIDs on first registry initialization | VERIFIED | `migrateExistingResources()` called during `ensureInitialized()` |
| 12 | AI agents can query resources by capability and area via tool functions | PARTIAL | Tool definitions exist in `resource-tools.ts` but NOT wired into `tools/index.ts` or `agent-seeder.ts` |
| 13 | Telemetry data ingested via API, batched and pushed to COP via WebSocket | VERIFIED | `resource-telemetry.ts` batches at 3s, broadcasts `resource:position_batch`; API route `POST /telemetry` returns 202 |
| 14 | API endpoints exist for registry queries, DID lookup, groups, and telemetry ingestion | VERIFIED | `api/resources.ts` imports all registries, 13+ new endpoints wired |
| 15 | Resources render as MIL-STD-2525D symbols on the COP map | VERIFIED | `COPResourceLayer.tsx` uses `ms.Symbol(sidc)` from milsymbol, wired into COPMapView |

**Score:** 14/15 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/resources/types.ts` | Aligned ResourceCategory, extended Resource with DID | VERIFIED | 138 lines, all types present |
| `backend/src/resources/resource-did.ts` | HKDF-based DID derivation | VERIFIED | 76 lines, exports createResourceDID, resolveResourceDID, verifyResourceDID |
| `backend/src/resources/plugins/base-plugin.ts` | ResourcePlugin interface | VERIFIED | 83 lines, 5 facets defined |
| `backend/src/resources/resource-store.ts` | Extended with DID/capability/group columns | VERIFIED | 428 lines, findByDID, findByCapabilities, findInArea, updateResource |
| `backend/src/resources/plugins/vehicle-plugin.ts` | Vehicle plugin with states | VERIFIED | substantive, zod + xstate + capabilities |
| `backend/src/resources/plugins/sensor-plugin.ts` | Sensor plugin | VERIFIED | 82 lines |
| `backend/src/resources/plugins/weapon-plugin.ts` | Weapon plugin | VERIFIED | 88 lines |
| `backend/src/resources/plugins/comms-plugin.ts` | Comms plugin | VERIFIED | 91 lines |
| `backend/src/resources/plugins/medical-plugin.ts` | Medical plugin | VERIFIED | 88 lines |
| `backend/src/resources/plugins/other-plugin.ts` | Other plugin | VERIFIED | 66 lines |
| `backend/src/resources/plugins/plugin-loader.ts` | Auto-discovery loader | VERIFIED | 57 lines, convention-based scanning |
| `backend/src/resources/plugins/plugin-registry.ts` | Singleton registry | VERIFIED | 101 lines, getPluginRegistry() |
| `backend/src/resources/resource-registry.ts` | DB-backed registry with cache | VERIFIED | 416 lines, 4 query types, auto-migration |
| `backend/src/resources/resource-group-store.ts` | Group CRUD | VERIFIED | 244 lines, aggregate capabilities |
| `backend/src/graph/tools/resource-tools.ts` | AI agent tool definitions | ORPHANED | 99 lines, 3 tools defined but NOT imported by tools/index.ts |
| `backend/src/resources/resource-telemetry.ts` | Telemetry ingestion | VERIFIED | 175 lines, batched WebSocket push |
| `backend/src/api/resources.ts` | Extended REST API | VERIFIED | Imports all registries, 13+ endpoints |
| `frontend/src/lib/resource-registry-service.ts` | Frontend registry client | VERIFIED | 349 lines, searchRegistry, groups, WebSocket |
| `frontend/src/components/cop/COPResourceLayer.tsx` | Resource symbols on map | VERIFIED | 312 lines, milsymbol + clustering |
| `frontend/src/components/cop/COPResourceDetail.tsx` | 4-tab detail panel | VERIFIED | 472 lines, identity/capabilities/telemetry/grouping tabs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| resource-did.ts | @noble/hashes | HKDF derivation | WIRED | `import { hkdf } from '@noble/hashes/hkdf.js'` |
| base-plugin.ts | zod, xstate | Plugin schema types | WIRED | `import { z } from 'zod'`, `import type { AnyStateMachine } from 'xstate'` |
| plugin-loader.ts | *-plugin.ts | Dynamic import | WIRED | Scans directory, `await import(modulePath)` |
| plugin-registry.ts | plugin-loader.ts | loadPlugins() | WIRED | `import { loadPlugins }`, called in ensureInitialized |
| resource-registry.ts | resource-did.ts | createResourceDID | WIRED | `import { createResourceDID }`, used in registerResource + migrateExisting |
| resource-registry.ts | plugin-registry.ts | Plugin lookup | WIRED | `import { getPluginRegistry }`, used for validation + capability defaults |
| resource-registry.ts | resource-store.ts | DB operations | WIRED | `import { resourceStore }`, used throughout |
| resource-tools.ts | resource-registry.ts | Registry queries | NOT_WIRED | File exports `resourceToolDefinitions` but nothing imports it |
| resource-telemetry.ts | WebSocket | Position batch broadcast | WIRED | Sends `resource:position_batch` via ws.send() |
| api/resources.ts | resource-registry.ts | Registry queries | WIRED | `import { getResourceRegistry }` |
| COPResourceLayer.tsx | resource-registry-service.ts | Fetch resources | WIRED | `import { resourceRegistryService }` |
| COPResourceLayer.tsx | milsymbol | Symbol generation | WIRED | `import ms from 'milsymbol'`, `new ms.Symbol(sidc)` |
| COPMapView.tsx | COPResourceLayer.tsx | Layer rendering | WIRED | `import { COPResourceLayer }`, rendered inside MapContainer |
| COPTab.tsx | COPResourceDetail.tsx | Detail panel | WIRED | `import { COPResourceDetail }`, rendered with selectedResource |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| RES-DID | 27-01 | Resource DID system | SATISFIED | resource-did.ts with HKDF, did:near:resource-{id} format |
| RES-PLUGIN-IFACE | 27-01 | Plugin interface contract | SATISFIED | base-plugin.ts with 5 facets |
| RES-CATEGORY-ALIGN | 27-01 | Category alignment (6 values) | SATISFIED | types.ts + schemas.ts aligned to frontend |
| RES-PLUGINS | 27-02 | Built-in resource type plugins | SATISFIED | 6 plugins with zod, xstate, capabilities |
| RES-PLUGIN-DISCOVERY | 27-02 | Plugin auto-discovery | SATISFIED | plugin-loader.ts convention-based scanning |
| RES-REGISTRY | 27-03 | Resource registry singleton | SATISFIED | resource-registry.ts with write-through cache |
| RES-QUERY | 27-03 | 4 query types | SATISFIED | DID, capability, type+status, area queries |
| RES-GROUPING | 27-03 | Resource groups | SATISFIED | resource-group-store.ts with aggregate capabilities |
| RES-MIGRATION | 27-03 | Auto-migrate existing resources | SATISFIED | migrateExistingResources() in registry init |
| RES-AI-TOOLS | 27-04 | AI agent resource tools | PARTIAL | Tool definitions exist but not registered in tool index |
| RES-TELEMETRY | 27-04 | Telemetry ingestion and push | SATISFIED | 3s batched WebSocket broadcast |
| RES-API | 27-04 | Extended REST API | SATISFIED | 13+ new endpoints in api/resources.ts |
| RES-COP | 27-05 | COP map integration | SATISFIED | COPResourceLayer rendered in COPMapView |
| RES-SYMBOLOGY | 27-05 | MIL-STD-2525D symbols | SATISFIED | milsymbol integration with fallback icons |
| RES-REALTIME | 27-05 | Real-time position updates | SATISFIED | WebSocket subscription + marker position update |
| RES-FRONTEND | 27-05 | Frontend registry service | SATISFIED | resource-registry-service.ts singleton |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| COPResourceDetail.tsx | 348 | "Live telemetry graph placeholder" | Info | Intentional per plan -- telemetry tab shows position data, graph is future |
| COPResourceDetail.tsx | 419 | "Group management actions placeholder" | Info | Intentional per plan -- grouping tab shows group info, actions are future |
| resource-tools.ts | 14 | Orphaned export (not imported anywhere) | Warning | AI tools exist but agents cannot use them at runtime |

### Human Verification Required

### 1. COP Resource Rendering

**Test:** Navigate to a problem set with resources, open the COP tab
**Expected:** Resource markers appear on the map with military symbols (SIDC) or colored fallback circles
**Why human:** Visual rendering of milsymbol SVGs and map marker positioning cannot be verified programmatically

### 2. Zoom-Based Clustering

**Test:** Add multiple resources near each other, zoom out below level 12
**Expected:** Individual markers consolidate into blue cluster badges with count numbers
**Why human:** Clustering behavior depends on map zoom interaction and visual confirmation

### 3. Resource Detail Panel

**Test:** Click a resource marker on the COP map
**Expected:** 4-tab detail panel opens showing identity, capabilities, telemetry, and grouping information
**Why human:** Panel rendering, tab switching, and dark theme styling need visual confirmation

### 4. Real-Time Position Updates

**Test:** POST telemetry to /api/resources/telemetry while COP is open
**Expected:** Resource marker moves on the map within 3 seconds
**Why human:** WebSocket real-time behavior and marker animation require runtime observation

### 5. Resource Registration via API

**Test:** POST to /api/resources/registry/register with valid manifest
**Expected:** 201 response with DID in body, resource appears in registry search
**Why human:** End-to-end database + DID generation requires running server

### Gaps Summary

One gap identified: **AI agent resource tools are orphaned.** The file `backend/src/graph/tools/resource-tools.ts` defines 3 MCP tool definitions (find_resources_by_capability, find_resources_in_area, get_resource_status) but is not imported by `backend/src/graph/tools/index.ts` (which aggregates all tool definitions) or `backend/src/agents/langgraph/agent-seeder.ts` (which seeds tools for agents). The raft-tools.ts file follows a pattern of being imported into both of these files. Without this wiring, AI agents have no access to resource query tools at runtime.

This is a straightforward wiring fix -- the tool definitions themselves are well-formed and follow the established MCPToolInput pattern.

All other 14 truths are fully verified. The backend types, DID system, plugin architecture, resource registry, group store, telemetry service, API routes, frontend service, COP rendering, and milsymbol integration are all substantive and properly wired.

---

_Verified: 2026-03-07T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
