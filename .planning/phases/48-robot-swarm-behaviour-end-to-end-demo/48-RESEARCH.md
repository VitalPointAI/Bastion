# Phase 48: Robot Swarm Behaviour End-to-End Demo - Research

**Researched:** 2026-03-16
**Domain:** Integration glue — COP swarm visualization, DAO governance flow, knowledge graph lifecycle events, demo scenario seed data, multi-system wiring
**Confidence:** HIGH (existing code patterns, internal APIs) / MEDIUM (NEAR smart contract specifics for robot authorization)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Demo Scenario & Narrative**
- Scenario: Chinese/Russian incursion into Taipei. Coalition forces (Taiwan, US, Australia) defending. Purpose-built Taiwan defense scenario (NOT Pacific Strategy AY26)
- Full top-down flow (~10 min): Strategic defense directive ingested live by doc-intelligence → AI extracts objectives to brain graph → operational plan generated → tactical missions decomposed → DAO authorizes → robots execute → detections populate COP → DAO authorizes advance → swarm advances → lethal escalation gate → brain timeline playback
- Multi-phase mission sequence: Recon sweep first → detections on COP → DAO authorizes advance → swarm advances in doctrinal formation toward identified threats
- 3 physical robots — no simulated units. System architected for dynamic membership with automatic connection and self-healing mesh (ready to accept a drone later)
- Coalition composition: Taiwan (full authority, home defense), US (ROE restrictions on urban offensive ops), Australia (observer status, recon only). Three distinct national caveat profiles
- Adversary forces: Mixed PLA + Russian — T-99 tanks, ZBD-04 IFVs, T-90 tanks, BTR-82 APCs. Demonstrates coalition adversary identification
- Real Taipei geography — actual coordinates, streets, landmarks. Robot waypoints mapped to real Taipei neighborhoods on COP map
- Pre-authored Taiwan defense strategic directive as seed data, ingested live by doc-intelligence pipeline during demo

**COP Swarm Visualization**
- Formation rendering: Translucent polygon connecting formation members (wedge, line, column, echelon, vee shape) with individual member symbols inside. Leader has distinct icon. Formation type label displayed
- Swarm state: Color-coded formation polygon (blue=forming, green=ready, amber=moving, red=contact) AND detail panel. Click swarm on map to open telemetry panel showing formation, technique, state, member count, mission progress
- Detection display: Standard hostile symbols on dedicated COP layer AND toggleable detection attribution lines showing which robot detected what. Default shows clean layers; toggle reveals attribution
- Movement technique visualization: Animated bounding/overwatch roles — bounding element highlighted with moving arrow, overwatching element shown stationary with overwatch arc/sector. Alternates visually as bounds progress
- Smooth interpolated movement — all position updates on COP use interpolation for smooth transitions between telemetry updates. No position jumps

**DAO Governance Flow**
- Expedited single-signer authorization — commander has delegated authority, single approval click triggers smart contract. Shows governance mechanism without multi-party voting delay
- Coalition caveat enforcement (both proactive + reactive): Pre-flight dashboard shows all robots with green/amber/red caveat status per mission type. If override attempted, system blocks with specific DID caveat details. Suggests alternative asset on rejection → reassign
- Lethal force escalation — both paths demonstrated: Path 1 (Deny) and Path 2 (Approve). Both recorded on blockchain with full audit trail
- Every authorization recorded on NEAR blockchain with auditable decision trail

**Knowledge Graph Integration**
- Full mission lifecycle persisted: Mission authorized (DAO tx), mission dispatched, swarm formed, formation changes, vision detections, escalation requests, authorization decisions (approve/deny), mission complete. Every event with timestamp and provenance
- National provenance tags: Every graph assertion tagged with contributing nation via DID. Brain visualization filterable by nation ("what did US assets contribute vs Taiwan vs Australia")
- Multi-source corroboration: When multiple robots detect same threat, confidence increases per Phase 47 weighted fusion formula. COP symbols transition from ghosted (single detection) to solid (corroborated). Brain viz shows confidence badges
- Timeline playback as demo conclusion: After mission completes, switch to brain visualization, use Phase 47 timeline slider to replay mission evolution

### Claude's Discretion
- Specific Taipei neighborhood selection for operational area
- Exact seed data format for strategic directive document
- Formation polygon rendering implementation (SVG overlay vs Leaflet layer)
- Interpolation algorithm for smooth COP movement (linear vs easing)
- Smart contract specifics for expedited single-signer pattern
- Swarm event schema for JSON-LD graph persistence
- Demo script timing and transition choreography
- COP layer z-ordering (swarm vs hostile vs attribution layers)

### Deferred Ideas (OUT OF SCOPE)
- Drone integration as 4th swarm member
- Voice command interface for mission dispatch
- Split-screen live brain + COP simultaneous display during mission
- Multi-swarm coordination
- Replay/AAR (After Action Review) mode as separate feature beyond timeline playback
</user_constraints>

---

## Summary

Phase 48 is a pure integration and demo assembly phase. All underlying subsystems exist and have been validated in Phases 43-47. The work is: (1) add a COP swarm layer type (formation polygon rendering, state colors, detection attribution toggle, bounding animation), (2) wire `robot-mission-service.ts` → COP layer store → frontend for swarm telemetry events, (3) extend `vision-cop-pipeline.ts` for multi-robot corroboration with confidence fusion, (4) write swarm lifecycle events to the JSON-LD brain graph with PROV-O provenance and national DID tags, (5) build coalition caveat enforcement with a pre-flight dashboard, (6) create demo seed data (Taiwan defense directive, coalition robot profiles, adversary ORBAT), and (7) update the coordinate system so robot room positions map to real Taipei geography.

The COP map already uses Leaflet with react-leaflet and smooth interpolated robot markers (`COPRobotLayer.tsx` with `SmoothRobotMarker`). Formation polygon rendering follows the same Leaflet imperative pattern. The swarm telemetry message types are fully defined in `robot-types.ts` and `swarm/models.py`. The DAO gate type `robot_action_auth` already exists in `gate-types.ts`. The gap is primarily: a new swarm COP layer, brain graph write path for swarm events, coalition DID caveat data model, and demo seed data.

**Primary recommendation:** Organize into six execution waves: (1) demo seed data + Taipei coordinate system, (2) COP swarm layer (polygon, state colors, telemetry panel), (3) detection attribution + corroboration (multi-robot confidence fusion), (4) brain graph swarm event write path with national provenance, (5) coalition caveat enforcement dashboard + lethal escalation gates, (6) end-to-end wiring + timeline playback integration.

---

## Standard Stack

### Core (existing — extend, do not replace)
| Library / Module | Version | Purpose | Status |
|-----------------|---------|---------|--------|
| `react-leaflet` + `leaflet` | (existing) | COP map rendering, marker/polygon/layer management | In use — `COPMapView.tsx`, `COPRobotLayer.tsx` |
| `backend/src/robot/` | custom | Mission service, vision-cop pipeline, robot types | In use — extend for swarm COP layer |
| `backend/src/cop/` | custom | COP coordinator, sub-agents, layer store, event bus | In use — new swarm layer type needed |
| `backend/src/graph/` | custom | Neo4j client, RAFT stores, provenance types | In use — add swarm event write queries |
| `backend/src/gates/` | custom | DAO gate service, `robot_action_auth` gate type | In use — expedited single-signer pattern |
| `backend/src/near/tx-signer.ts` | custom | NEAR transaction signing for gate authorizations | In use — used for blockchain audit trail |
| `robot/swarm/coordinator.py` | custom | SwarmCoordinator, UDP mesh, formation dispatch | In use — no changes needed |
| `robot/swarm/formations.py` | custom | Formation geometry engine, slot offsets | In use — no changes needed |
| `robot/swarm/models.py` | custom | SwarmTelemetry, SwarmMember, FormationType, etc. | In use — no changes needed |
| W3C PROV-O | standard | Provenance for swarm event graph assertions | In use since Phase 47 |

### New for Phase 48
| Component | Purpose | Where |
|-----------|---------|-------|
| `SwarmCOPLayer` (new frontend component) | Formation polygon rendering + swarm telemetry panel | `frontend/src/components/cop/SwarmCOPLayer.tsx` |
| `SwarmDetectionAttributionLayer` (new) | Toggleable attribution lines + bounding animation | Part of `SwarmCOPLayer.tsx` |
| Swarm COP layer type `'swarm'` | New entry in `COPLayerType` union | `backend/src/cop/layers/layer-types.ts` |
| `writeSwarmEventToGraph()` (new) | Brain graph write path for swarm lifecycle events | `backend/src/robot/swarm-graph-writer.ts` |
| Coalition caveat DID profiles | Seed data: Taiwan/US/Australia caveat documents | `backend/data/coalition-profiles.json` |
| Taiwan demo seed data | Strategic directive document, adversary ORBAT, Taipei coordinates | `backend/data/demo-taiwan-seed/` |
| `CoalitionCaveatDashboard` (new) | Pre-flight caveat status for all robots | `frontend/src/components/direct/CoalitionCaveatDashboard.tsx` |
| Taipei calibration profile | Maps robot room coordinates to real Taipei neighborhood lat/lng | `backend/data/calibration-profiles.json` update |

---

## Architecture Patterns

### How the COP Swarm Layer Fits the Existing Architecture

The existing COP stack: `robot-mission-service.ts` receives `swarm:telemetry` WebSocket messages → stores in `swarmStates` Map → currently no COP emission. The gap is a bridge from `handleSwarmTelemetry()` to the COP event bus.

```
swarm:telemetry (WS)
  → robot-mission-service.ts handleSwarmTelemetry()
  → [NEW] emit 'swarm:cop_update' on COP event bus
  → [NEW] SwarmCOPLayer sub-agent converts SwarmTelemetry → layer spec
  → layer-store.ts updateLayerSpec()
  → frontend COPMapView poll or WS push
  → SwarmCOPLayer.tsx renders Leaflet polygon + member markers
```

The pattern mirrors how `vision-cop-pipeline.ts` bridges robot vision messages to the COP adversary layer. Build a parallel `swarm-cop-bridge.ts` service.

### Pattern 1: Leaflet Formation Polygon Rendering

The existing `COPRobotLayer.tsx` uses imperative Leaflet (`L.marker().addTo(map)`) inside a `useMap()` hook, managing markers via refs and requestAnimationFrame for smooth movement. Formation polygons follow the same pattern.

```typescript
// Source: frontend/src/components/cop/COPRobotLayer.tsx (SmoothRobotMarker pattern)
// Formation polygon — rendered imperatively on Leaflet map
const FORMATION_STATE_COLORS: Record<string, string> = {
  forming: '#3b82f6',    // blue
  ready: '#22c55e',      // green
  moving: '#f59e0b',     // amber
  holding: '#22c55e',    // green (same as ready, stationary)
  dispersing: '#6b7280', // gray
  contact: '#ef4444',    // red
};

function SwarmFormationPolygon({ swarm, onSwarmClick }) {
  const map = useMap();
  const polygonRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    // Convert member positions to LatLng hull
    const positions = swarm.members.map(m => roomToLatLng(m.position.x, m.position.y));
    const color = FORMATION_STATE_COLORS[swarm.state] || '#6b7280';
    const polygon = L.polygon(positions, {
      color,
      fillColor: color,
      fillOpacity: 0.15,
      weight: 2,
      dashArray: swarm.state === 'forming' ? '6 4' : undefined,
    }).addTo(map);

    polygon.on('click', () => onSwarmClick?.(swarm.swarm_id));
    polygon.bindTooltip(`${swarm.swarm_id} — ${swarm.formation} (${swarm.state})`);
    polygonRef.current = polygon;
    return () => { polygon.remove(); };
  }, [map, swarm]);

  return null;
}
```

### Pattern 2: Multi-Robot Detection Corroboration

The existing `vision-cop-pipeline.ts` creates one `COPSymbol` per detection per robot. For corroboration, detections from multiple robots that resolve to the same entity should fuse their confidence using the Phase 47 formula:

```typescript
// Source: Phase 47 CONTEXT.md — weighted source fusion formula
// conf = 1 - ∏(1 - w_i) where w_i is source weight per detection
const VISION_PIPELINE_WEIGHT = 0.70; // from Phase 47 provenance-types.ts

function fuseDetectionConfidence(detections: COPSymbol[]): number {
  // Multi-source product formula from Phase 47
  const product = detections.reduce(
    (prod, d) => prod * (1 - d.confidence * VISION_PIPELINE_WEIGHT),
    1,
  );
  return 1 - product;
}
```

COP visual encoding: `confidence < 0.5` → ghosted symbol (40% opacity, dotted border); `0.5-0.85` → amber badge, 70% opacity; `> 0.85` → solid full opacity. This is already the Phase 47 pattern from `layer-types.ts`.

### Pattern 3: Swarm Event → Brain Graph Write Path

Every swarm lifecycle event becomes a JSON-LD assertion in Neo4j with PROV-O provenance. The write path mirrors how `vision-cop-pipeline.ts` calls `updateKnowledgeGraph()`.

```typescript
// Source pattern: backend/src/robot/vision-cop-pipeline.ts updateKnowledgeGraph()
// New file: backend/src/robot/swarm-graph-writer.ts

interface SwarmEventContext {
  swarmId: string;
  eventType: 'mission_authorized' | 'swarm_formed' | 'formation_changed'
    | 'detection_shared' | 'escalation_requested' | 'authorization_granted'
    | 'authorization_denied' | 'mission_complete';
  timestamp: string;
  nationalDid: string;          // Asserting nation's DID
  daoTxHash?: string;           // NEAR blockchain tx hash if DAO-authorized
  members?: string[];           // Robot IDs involved
  payload: Record<string, unknown>;
}

async function writeSwarmEventToGraph(
  workspaceId: string,
  event: SwarmEventContext,
): Promise<void> {
  const { executeWriteQuery } = await import('../graph/neo4j-client.js');
  // Create Event node with PROV-O properties
  await executeWriteQuery(`
    MERGE (e:Event {id: $eventId})
    SET e += {
      "@type": "cco:Process",
      "@context": "bastion:v1",
      "cco:process_type": $eventType,
      "prov:wasGeneratedBy": $generatedBy,
      "prov:wasAttributedTo": $nationalDid,
      "bastion:swarmId": $swarmId,
      "bastion:daoTxHash": $daoTxHash,
      "xsd:validFrom": $timestamp,
      workspaceId: $workspaceId
    }
  `, { /* params */ });
}
```

### Pattern 4: Coalition Caveat Enforcement

DID documents for robot resources already store caveats in the resource DID system (`backend/src/resources/resource-did.ts`). Coalition caveat profiles need a data structure that maps national DID → allowed mission types:

```typescript
// New: backend/data/coalition-profiles.json
{
  "tw-defense": {
    "nation": "Taiwan",
    "did": "did:near:resource-tw-coalition",
    "authority": "full",
    "allowed_missions": ["recon_area", "swarm_recon", "swarm_advance", "find_engage", "swarm_patrol"],
    "restrictions": []
  },
  "us-coalition": {
    "nation": "United States",
    "did": "did:near:resource-us-coalition",
    "authority": "restricted",
    "allowed_missions": ["recon_area", "swarm_recon", "swarm_patrol"],
    "restrictions": [
      { "mission_type": "swarm_advance", "area_type": "urban", "reason": "US national policy: no offensive urban ops" },
      { "mission_type": "find_engage", "reason": "US ROE: engagement requires host-nation lead" }
    ]
  },
  "au-observer": {
    "nation": "Australia",
    "did": "did:near:resource-au-coalition",
    "authority": "observer",
    "allowed_missions": ["recon_area", "swarm_recon"],
    "restrictions": [
      { "mission_type": "*", "except": ["recon_area", "swarm_recon"], "reason": "Australia observer status: recon only" }
    ]
  }
}
```

### Pattern 5: Expedited Single-Signer DAO Gate

The existing `robot_action_auth` gate type in `gate-types.ts` with `hard_block` enforcement is the foundation. The expedited pattern means one commander click calls `gateService.decide()` which calls `signAndSubmitFunctionCall()` to anchor on NEAR blockchain, then resolves the gate to `approved`.

```typescript
// Source: backend/src/gates/gate-service.ts + backend/src/near/tx-signer.ts
// No new contract needed — use signAndSubmitFunctionCall() with existing tx-signer

async function expeditedAuthorize(
  gateId: string,
  commanderUserSecret: Uint8Array,
  decision: 'approve' | 'deny',
  missionContext: Record<string, unknown>,
): Promise<{ txHash: string }> {
  // 1. Record on NEAR blockchain
  const result = await signAndSubmitFunctionCall(
    commanderUserSecret,
    process.env.DID_CONTRACT_ID!,
    'record_authorization',
    { gate_id: gateId, decision, context: missionContext },
  );

  // 2. Update gate status
  await gateStore.update(gateId, {
    status: decision === 'approve' ? GateStatus.approved : GateStatus.rejected,
    proposal_id: result.txHash,
    decided_at: new Date().toISOString(),
  });

  return { txHash: result.txHash! };
}
```

### Taipei Coordinate System

The current `roomToLatLng()` in `COPRobotLayer.tsx` hard-codes a 5x5m room mapped to a ~100m² area near Taipei (lat 25.033–25.034, lng 121.564–121.565). For the demo, the calibration must be updated to map the physical lab floor to a meaningful Taipei neighborhood (e.g., Zhongzheng District, Taipei City Hall area).

The `calibration-profiles.json` system already exists (`backend/data/calibration-profiles.json`). A new "taipei-demo" profile should map to real coordinates around 25.04°N, 121.51°E (near Taipei Main Station / strategic district). The frontend `COPRobotLayer.tsx` and backend `robot-mission-service.ts` both use `loadDefaultCalibration()` — updating the default profile in the JSON file propagates everywhere.

```json
// backend/data/calibration-profiles.json — add or update "default" profile
{
  "default": {
    "room_width": 5,
    "room_height": 5,
    "map_bounds": {
      "north": 25.0480,
      "south": 25.0420,
      "east": 121.5180,
      "west": 121.5120
    },
    "label": "Taipei Zhongzheng District demo area"
  }
}
```

### Recommended New File Structure

```
backend/src/robot/
├── swarm-cop-bridge.ts         # NEW: SwarmTelemetry → COP layer bridge
├── swarm-graph-writer.ts       # NEW: swarm lifecycle events → Neo4j JSON-LD
├── coalition-caveat-service.ts # NEW: coalition DID caveat lookup + enforcement
├── vision-cop-pipeline.ts      # EXTEND: multi-robot corroboration
└── robot-mission-service.ts    # EXTEND: call swarm-cop-bridge + swarm-graph-writer

backend/data/
├── demo-taiwan-seed/
│   ├── taiwan-defense-directive.txt  # Strategic directive document for ingestion
│   ├── adversary-orbat.json          # PLA + Russian order of battle seed
│   └── coalition-forces.json         # Taiwan/US/Australia force composition
├── coalition-profiles.json     # NEW: national caveat DID profiles
└── calibration-profiles.json   # UPDATE: add taipei-demo profile

frontend/src/components/cop/
├── SwarmCOPLayer.tsx           # NEW: formation polygon, state, attribution
└── COPMapView.tsx              # EXTEND: include SwarmCOPLayer

frontend/src/components/direct/
├── CoalitionCaveatDashboard.tsx # NEW: pre-flight caveat status dashboard
└── RobotMissionTrigger.tsx     # EXTEND: caveat enforcement on mission dispatch
```

### Anti-Patterns to Avoid

- **Creating new NEAR smart contracts for robot authorization**: The existing `tx-signer.ts` + `signAndSubmitFunctionCall()` + the DID registry contract already supports arbitrary method calls. Use `record_authorization` calls on the existing DID contract rather than deploying a new contract — this is a demo, not production infrastructure.
- **Polling for swarm telemetry from frontend**: The existing WebSocket pub/sub pattern pushes COP updates to the frontend via the COP event bus. Don't add a REST polling loop for swarm state — wire swarm updates into the same event bus and push.
- **Using `requestAnimationFrame` for polygon position updates directly**: Follow the `SmoothRobotMarker` pattern — store refs, use easing function over the telemetry interval. Don't create a separate animation loop per polygon vertex.
- **Corroboration by robot ID string matching alone**: Two detections of "T-90" from two robots may have different entity IDs if created independently. Use position proximity + class match for corroboration, not just class name. The Phase 47 entity resolution infrastructure (string matching + embedding) already handles this.
- **Hardcoding national caveats inline in TypeScript**: Load coalition profiles from `coalition-profiles.json` at startup, not inline constants. This lets the demo organizer update profiles without code changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NEAR blockchain transaction for authorization | Custom signing logic | `backend/src/near/tx-signer.ts` `signAndSubmitFunctionCall()` | HKDF key derivation, auto-funding, error handling already done |
| Smooth marker interpolation | New animation system | Reuse `SmoothRobotMarker` easing pattern from `COPRobotLayer.tsx` | Ease-out quadratic over poll interval already works correctly |
| Confidence fusion formula | Custom averaging | Phase 47 weighted product formula: `conf = 1 - ∏(1 - w_i)` | Matches provenance model already in graph |
| Formation geometry | Custom math | `robot/swarm/formations.py` `compute_formation_slots()` + `slots_to_world_positions()` | All 6 formation types implemented and tested |
| Swarm UDP mesh | Custom networking | `SwarmCoordinator` already running on physical robots | mDNS discovery + heartbeat already operational |
| DAO gate lifecycle | Custom approval flow | `gateService` + `GateType.robot_action_auth` | Gate store, status machine, NEAR anchoring all done |
| MIL-STD-2525D SIDC codes | Custom symbol lookup | Extend existing `THREAT_CLASS_MAP` in `vision-cop-pipeline.ts` | T-99, ZBD-04, BTR-82 need to be added to the map |

**Key insight:** This phase is almost entirely glue. The hardest new technical work is formation polygon rendering (Leaflet polygon hull around member positions) and the brain graph write path for swarm events. Everything else connects existing, tested components.

---

## Common Pitfalls

### Pitfall 1: Formation Polygon Hull Ordering
**What goes wrong:** Passing member positions directly to `L.polygon()` in arbitrary order produces a self-intersecting polygon (bowtie shape) that renders incorrectly.
**Why it happens:** Leaflet draws polygon edges in array order. For a wedge of 3 robots, the order matters — connecting leader→left→right draws a triangle; leader→right→left draws the same triangle, but arbitrary order can cross.
**How to avoid:** Sort member positions by angle from the centroid before constructing the polygon. For small member counts (3), always use slot order (slot 0 = leader, slot 1 = left/right, slot 2 = opposite) from the formation slot assignments. `slots_to_world_positions()` already returns positions in slot order — use that order.
**Warning signs:** Demo shows a self-crossing polygon (X shape) instead of a proper triangle/wedge.

### Pitfall 2: Coordinate Transform Mismatch Between Robot and Frontend
**What goes wrong:** The robot reports positions in room-space meters (x, y in 0-5 range). `robot-mission-service.ts` transforms these to lat/lng for the COP via `roomToGeo()`. But `COPRobotLayer.tsx` also has its own `roomToLatLng()` with hardcoded bounds. If the calibration profile is updated in only one place, robot markers appear in the wrong location relative to swarm polygon vertices.
**Why it happens:** Two independent implementations of the same transform (`backend/src/robot/robot-mission-service.ts` `roomToGeo()` and `frontend/src/components/cop/COPRobotLayer.tsx` `roomToLatLng()`). Both reference the calibration file but the frontend version is hardcoded.
**How to avoid:** Update `calibration-profiles.json` AND update both `roomToGeo()` (backend) and `roomToLatLng()` (frontend) to read from the same source. Better: push the calibrated positions from backend to frontend as lat/lng and never transform in frontend.
**Warning signs:** Swarm polygon appears in a different location from the individual robot markers on the COP map.

### Pitfall 3: Swarm Graph Events Duplicated on Re-Connection
**What goes wrong:** When a robot re-connects after a brief drop, the SwarmCoordinator re-emits `swarm_formed` and formation events. If `writeSwarmEventToGraph()` uses `CREATE` instead of `MERGE`, duplicate Event nodes accumulate.
**Why it happens:** Swarm self-healing mesh re-emits membership events on reconnection. The vision pipeline uses `MERGE` but a naive swarm event writer might use `CREATE`.
**How to avoid:** Use `MERGE (e:Event {id: $eventId})` with a deterministic event ID: `${swarmId}-${eventType}-${roundedTimestamp}`. Round timestamp to the nearest 5s window to deduplicate reconnection bursts.
**Warning signs:** Timeline playback shows duplicate nodes at the same timestamp.

### Pitfall 4: Coalition Caveat Check Bypassed by Swarm-Level Missions
**What goes wrong:** Caveat checks applied at individual robot level but swarm missions are dispatched via the leader. A US-robot as follower in an advance mission never triggers the caveat check because the mission was assigned to the leader (a Taiwan robot).
**Why it happens:** `MissionAssignMsg` is sent to the leader robot's WebSocket. The follower robots execute via UDP `MoveCommand` from the leader — no Bastion involvement. Caveat enforcement must happen before the `swarm_advance` mission is dispatched to any robot, not per-follower.
**How to avoid:** Caveat enforcement in `CoalitionCaveatDashboard.tsx` + mission dispatch logic must check the caveat profile of ALL swarm members, not just the leader. Block the mission dispatch if any member's caveat forbids it. Show which specific robot's DID blocked the mission.
**Warning signs:** US robot executes urban advance despite caveat restrictions because caveat was only checked against the Taiwan leader.

### Pitfall 5: Lethal Escalation Gate Blocking Normal Mission Flow
**What goes wrong:** Creating the lethal escalation gate as a `hard_block` on the same `robot_action_auth` gate type as normal authorization means routine mission dispatch is also blocked until a lethal-force gate resolves.
**Why it happens:** Reusing the same gate type for both normal authorization and lethal escalation without differentiating payload.
**How to avoid:** Use `decision_context` field on `DecisionGate` to carry `{ "escalation_type": "lethal_force" }` vs `{ "escalation_type": "standard" }`. Route the approval UI to the correct panel based on `escalation_type`. Lethal escalation gates should be created ad-hoc when the robot detects a threat and requests engagement authorization — not as pre-created gates.
**Warning signs:** Demo flow stalls because a pre-created lethal gate is blocking normal recon mission dispatch.

---

## Code Examples

### Adding New Adversary Classes to THREAT_CLASS_MAP

```typescript
// Source: backend/src/robot/vision-cop-pipeline.ts — EXTEND this map
const THREAT_CLASS_MAP_ADDITIONS = {
  // Taiwan scenario adversary forces
  't-99': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Type 99 Main Battle Tank (ZTZ-99)', symbolSet: '10', entity: '120100',
  },
  'zbd-04': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'ZBD-04 Infantry Fighting Vehicle', symbolSet: '10', entity: '120200',
  },
  'btr-82': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'BTR-82 APC', symbolSet: '10', entity: '120200',
  },
  // Already present: 't-90', 't90', 'ztz99', 'type99', 'tank', 'armored vehicle'
};
```

### Swarm COP Layer Type Extension

```typescript
// Source: backend/src/cop/layers/layer-types.ts — ADD swarm to the union
export type COPLayerType =
  | 'force_disposition'
  | 'objectives'
  | 'control_measures'
  | 'intel'
  | 'logistics'
  | 'c2'
  | 'swarm';   // NEW — Phase 48

// New spec types for swarm layer
export interface SwarmMemberSpec {
  robotId: string;
  role: 'leader' | 'follower';
  position: LatLng;
  slotIndex: number;
  batteryPct: number;
  national_did?: string;
}

export interface SwarmFormationSpec {
  swarmId: string;
  leaderId: string;
  state: 'forming' | 'ready' | 'moving' | 'holding' | 'dispersing';
  formation: 'line' | 'wedge' | 'column' | 'echelon_left' | 'echelon_right' | 'vee';
  technique: 'traveling' | 'traveling_overwatch' | 'bounding_overwatch' | 'successive_bounds';
  memberCount: number;
  members: SwarmMemberSpec[];
  centerOfMass: LatLng;
  heading: number;
  missionId?: string;
  detectionAttributions?: DetectionAttribution[];
}

export interface DetectionAttribution {
  robotId: string;
  entityId: string;       // COP symbol entity ID it detected
  confidence: number;
  detectedAt: string;
}
```

### Brain Graph Write — Mission Lifecycle Event

```typescript
// Source pattern: backend/src/robot/vision-cop-pipeline.ts updateKnowledgeGraph()
// New file: backend/src/robot/swarm-graph-writer.ts

export async function writeMissionAuthorizedEvent(
  workspaceId: string,
  missionId: string,
  swarmId: string,
  daoTxHash: string,
  authorizedBy: string,  // commander DID
  nationalDid: string,   // authorizing nation DID
): Promise<void> {
  const { executeWriteQuery } = await import('../graph/neo4j-client.js');
  const eventId = `EVT-auth-${missionId}`;
  const now = new Date().toISOString();

  await executeWriteQuery(`
    MERGE (e:Event {id: $eventId})
    ON CREATE SET
      e["@type"] = "cco:Process",
      e["@context"] = "bastion:v1",
      e["cco:process_type"] = "mission_authorization",
      e["prov:wasGeneratedBy"] = "dao_gate_service",
      e["prov:wasAttributedTo"] = $nationalDid,
      e["bastion:missionId"] = $missionId,
      e["bastion:swarmId"] = $swarmId,
      e["bastion:daoTxHash"] = $daoTxHash,
      e["bastion:authorizedBy"] = $authorizedBy,
      e.workspaceId = $workspaceId,
      e["xsd:validFrom"] = $now
  `, { eventId, missionId, swarmId, daoTxHash, nationalDid, authorizedBy, workspaceId, now });
}
```

### Pre-flight Caveat Check

```typescript
// New: backend/src/robot/coalition-caveat-service.ts
interface CaveatCheckResult {
  allowed: boolean;
  blockedRobots: Array<{
    robotId: string;
    national_did: string;
    nation: string;
    reason: string;
  }>;
}

export function checkSwarmCaveat(
  missionType: string,
  areaType: 'urban' | 'rural' | 'unknown',
  swarmMembers: Array<{ robotId: string; national_did: string }>,
  profiles: typeof coalitionProfiles,
): CaveatCheckResult {
  const blockedRobots = [];

  for (const member of swarmMembers) {
    const profile = Object.values(profiles).find(p => p.did === member.national_did);
    if (!profile) continue;

    const restriction = profile.restrictions?.find(r =>
      (r.mission_type === '*' || r.mission_type === missionType) &&
      (!r.area_type || r.area_type === areaType)
    );

    if (restriction || !profile.allowed_missions.includes(missionType)) {
      blockedRobots.push({
        robotId: member.robotId,
        national_did: member.national_did,
        nation: profile.nation,
        reason: restriction?.reason ?? `${missionType} not in allowed missions for ${profile.nation}`,
      });
    }
  }

  return { allowed: blockedRobots.length === 0, blockedRobots };
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `COPRobotLayer.tsx` shows individual robots as dots | Phase 48 adds `SwarmCOPLayer.tsx` with formation polygon | New component, existing robot dots remain |
| Detection confidence: single-source (per robot) | Multi-robot corroboration with Phase 47 confidence fusion | Extend `vision-cop-pipeline.ts` |
| `robot_action_auth` gates: single approval step | Lethal escalation as distinct gate with both approve/deny paths and NEAR audit | Same gate type, differentiated by `decision_context.escalation_type` |
| Room coords hardcoded in frontend | Calibration profile in `calibration-profiles.json` (backend already uses this) | Frontend `COPRobotLayer.tsx` still has hardcoded fallback — update to load from API |
| Swarm events not persisted | Swarm lifecycle → JSON-LD brain graph with PROV-O national provenance | New `swarm-graph-writer.ts` |

---

## Open Questions

1. **NEAR contract for `record_authorization` method**
   - What we know: `signAndSubmitFunctionCall()` can call any NEAR contract method. The DID registry contract exists at `did.bastion.testnet`.
   - What's unclear: Does the DID registry contract expose a `record_authorization` method? If not, does it need to be deployed, or should we use a generic key-value store approach instead?
   - Recommendation: Use `signAndSubmitFunctionCall()` with the existing `store_did` or a new dedicated `bastion-missions.testnet` contract. For the demo, storing a JSON blob with mission+decision metadata as a DID record is sufficient — it proves blockchain anchoring without needing a purpose-built authorization contract.

2. **Physical robot DID → coalition profile mapping**
   - What we know: Each robot has a DID (`did:near:resource-{id}`) stored in the resource registry. National DID is not currently a field in `SwarmMember`.
   - What's unclear: How does the system know which nation's profile applies to which robot? The demo needs 3 robots with 3 different national caveats.
   - Recommendation: Add `national_did` to the robot's resource record (populated at registration time via `coalition-profiles.json`). This is set once at demo setup — not dynamic.

3. **Taipei coordinate range for demo floor space**
   - What we know: Current calibration maps 5x5m room to ~100m² area. For a meaningful Taipei demo, the 5x5m floor should map to a visually interesting area (multiple city blocks).
   - What's unclear: Exact neighborhood to use.
   - Recommendation (Claude's discretion): Map to Zhongzheng District (near Taipei Main Station): north 25.0480°, south 25.0420°, west 121.5120°, east 121.5180°. This covers ~700m × 700m and includes recognizable landmarks (Presidential Office Building area). Labels it as "Taipei Strategic District" in the COP.

---

## Validation Architecture

Config has no `workflow.nyquist_validation` key — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Python) | pytest (existing in `robot/`) |
| Framework (TypeScript) | vitest / tsc --noEmit (existing) |
| Config file | `robot/conftest.py` (exists), no vitest config (uses tsc verify pattern) |
| Quick run command | `cd /home/vitalpointai/projects/ssr && python -m pytest robot/tests/ -x -q` |
| Full suite command | `cd /home/vitalpointai/projects/ssr && python -m pytest robot/tests/ -v` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | Exists? |
|----------|-----------|-------------------|---------|
| Formation polygon hull ordering (no self-intersection) | unit | `pytest robot/tests/test_swarm_cop.py::test_polygon_hull_ordering -x` | Wave 0 |
| Coalition caveat check blocks US robot on urban advance | unit | `pytest robot/tests/test_coalition_caveat.py::test_us_urban_advance_blocked -x` | Wave 0 |
| Coalition caveat allows AU recon, blocks AU advance | unit | `pytest robot/tests/test_coalition_caveat.py::test_au_recon_only -x` | Wave 0 |
| Multi-robot confidence fusion formula | unit | `pytest robot/tests/test_corroboration.py::test_confidence_fusion -x` | Wave 0 |
| Swarm graph event MERGE dedup (no duplicate Event nodes) | unit | `pytest robot/tests/test_swarm_graph.py::test_event_dedup -x` | Wave 0 |
| TypeScript types compile for new swarm COP layer types | compile | `npx tsc --noEmit 2>&1 | head -20` | existing |

### Sampling Rate
- **Per task commit:** `python -m pytest robot/tests/ -x -q --tb=short`
- **Per wave merge:** `python -m pytest robot/tests/ -v && npx tsc --noEmit 2>&1 | head -30`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `robot/tests/test_swarm_cop.py` — polygon hull ordering, formation polygon state colors
- [ ] `robot/tests/test_coalition_caveat.py` — all three national profiles, block/allow scenarios
- [ ] `robot/tests/test_corroboration.py` — confidence fusion with 2-3 source robots
- [ ] `robot/tests/test_swarm_graph.py` — event MERGE dedup, national provenance tag
- [ ] `backend/data/demo-taiwan-seed/` directory and seed files — no test, but must exist for demo to run

---

## Sources

### Primary (HIGH confidence)
- `backend/src/robot/vision-cop-pipeline.ts` — threat class map, COP symbol creation, Neo4j write pattern
- `backend/src/cop/layers/layer-types.ts` — COPLayerType union, COPLayerSpec structure
- `frontend/src/components/cop/COPRobotLayer.tsx` — smooth interpolation pattern, roomToLatLng, Leaflet imperative pattern
- `robot/swarm/coordinator.py` — full SwarmCoordinator API, UDP mesh, telemetry emission
- `robot/swarm/models.py` — all swarm message types, SwarmTelemetry structure
- `backend/src/gates/gate-types.ts` — GateType.robot_action_auth, DecisionGate interface, decision_context
- `backend/src/near/tx-signer.ts` — signAndSubmitFunctionCall(), NEAR contract call pattern
- `backend/src/resources/resource-did.ts` — did:near:resource-{id} format, DID derivation

### Secondary (MEDIUM confidence)
- `backend/src/robot/robot-mission-service.ts` — handleSwarmTelemetry() (full file read via persisted output, confirms swarmStates Map but no current COP emission — integration gap confirmed)
- `.planning/phases/47-json-ld-semantic-brain-cop-fix/47-CONTEXT.md` — PROV-O provenance model, confidence weights, weighted source fusion formula
- `backend/src/robot/robot-types.ts` — MissionJSONSchema, swarm mission types confirmed

### Tertiary (LOW confidence)
- NEAR DID registry contract method availability — inferred from `tx-signer.ts` usage patterns, not verified against deployed contract interface

---

## Metadata

**Confidence breakdown:**
- Integration points and existing APIs: HIGH — all code read directly
- New component patterns: HIGH — direct extrapolation from identical existing patterns
- NEAR blockchain contract specifics: MEDIUM — tx-signer pattern is clear, specific method availability uncertain
- Demo seed data content: HIGH — well-specified in CONTEXT.md

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable internal codebase, no fast-moving external dependencies)
