# Phase 48: Robot Swarm Behaviour End-to-End Demo - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Demonstrate the complete BASTION strategy-to-autonomous-execution pipeline using a Taiwan defense scenario with a 3-robot coalition swarm. The demo ties together all infrastructure from Phases 43 (bridge/agent), 44 (vision/intent), 46 (swarm/formations), and 47 (JSON-LD brain/COP) into a single continuous flow: strategic document ingestion → AI objective extraction → operational plan → DAO-authorized tactical missions → swarm recon in formation → detections on COP → DAO-authorized advance → lethal force escalation → brain graph timeline playback. This phase builds integration glue, COP swarm visualization, demo scenario seed data, and the end-to-end wiring — not new standalone capabilities.

</domain>

<decisions>
## Implementation Decisions

### Demo Scenario & Narrative
- **Scenario:** Chinese/Russian incursion into Taipei. Coalition forces (Taiwan, US, Australia) defending. Not Pacific Strategy AY26 — a purpose-built Taiwan defense scenario
- **Full top-down flow (~10 min):** Strategic defense directive ingested live by doc-intelligence (Phase 40) → AI extracts objectives to brain graph → operational plan generated → tactical missions decomposed → DAO authorizes → robots execute → detections populate COP → DAO authorizes advance → swarm advances → lethal escalation gate → brain timeline playback
- **Multi-phase mission sequence:** Recon sweep first → detections on COP → DAO authorizes advance → swarm advances in doctrinal formation toward identified threats
- **3 physical robots** — no simulated units. System architected for dynamic membership with automatic connection and self-healing mesh (ready to accept a drone later)
- **Coalition composition:** Taiwan (full authority, home defense), US (ROE restrictions on urban offensive ops), Australia (observer status, recon only). Three distinct national caveat profiles
- **Adversary forces:** Mixed PLA + Russian — T-99 tanks, ZBD-04 IFVs, T-90 tanks, BTR-82 APCs. Demonstrates coalition adversary identification
- **Real Taipei geography** — actual coordinates, streets, landmarks. Robot waypoints mapped to real Taipei neighborhoods on COP map
- **Pre-authored Taiwan defense strategic directive** as seed data, ingested live by doc-intelligence pipeline during demo

### COP Swarm Visualization
- **Formation rendering:** Translucent polygon connecting formation members (wedge, line, column, echelon, vee shape) with individual member symbols inside. Leader has distinct icon. Formation type label displayed
- **Swarm state:** Color-coded formation polygon (blue=forming, green=ready, amber=moving, red=contact) AND detail panel. Click swarm on map to open telemetry panel showing formation, technique, state, member count, mission progress
- **Detection display:** Standard hostile symbols on dedicated COP layer AND toggleable detection attribution lines showing which robot detected what. Default shows clean layers; toggle reveals attribution
- **Movement technique visualization:** Animated bounding/overwatch roles — bounding element highlighted with moving arrow, overwatching element shown stationary with overwatch arc/sector. Alternates visually as bounds progress
- **Smooth interpolated movement** — all position updates on COP use interpolation for smooth transitions between telemetry updates. No position jumps

### DAO Governance Flow
- **Expedited single-signer authorization** — commander has delegated authority, single approval click triggers smart contract. Shows governance mechanism without multi-party voting delay
- **Coalition caveat enforcement (both proactive + reactive):**
  - Pre-flight dashboard shows all robots with green/amber/red caveat status per mission type
  - If override attempted, system blocks with specific DID caveat details (e.g., "US national policy: no offensive urban ops")
  - Suggests alternative asset on rejection → reassign
- **Lethal force escalation — both paths demonstrated:**
  - Path 1 (Deny): Swarm detects threat → escalates to commander → commander denies → swarm holds position/withdraws. Blockchain records denial
  - Path 2 (Approve): Same escalation → commander approves → marks target → engagement recorded on blockchain with full audit trail
- **Every authorization recorded on NEAR blockchain** with auditable decision trail

### Knowledge Graph Integration
- **Full mission lifecycle persisted:** Mission authorized (DAO tx), mission dispatched, swarm formed, formation changes, vision detections, escalation requests, authorization decisions (approve/deny), mission complete. Every event with timestamp and provenance
- **National provenance tags:** Every graph assertion tagged with contributing nation via DID. Brain visualization filterable by nation ("what did US assets contribute vs Taiwan vs Australia"). Demonstrates coalition information sharing
- **Multi-source corroboration:** When multiple robots detect same threat, confidence increases per Phase 47 weighted fusion formula. COP symbols transition from ghosted (single detection) to solid (corroborated). Brain viz shows confidence badges
- **Timeline playback as demo conclusion:** After mission completes, switch to brain visualization, use Phase 47 timeline slider to replay mission evolution — entities appear, decisions form, provenance chains build

### Claude's Discretion
- Specific Taipei neighborhood selection for operational area
- Exact seed data format for strategic directive document
- Formation polygon rendering implementation (SVG overlay vs Leaflet layer)
- Interpolation algorithm for smooth COP movement (linear vs easing)
- Smart contract specifics for expedited single-signer pattern
- Swarm event schema for JSON-LD graph persistence
- Demo script timing and transition choreography
- COP layer z-ordering (swarm vs hostile vs attribution layers)

</decisions>

<specifics>
## Specific Ideas

- Core demo narrative: Strategy → AI → Operations → DAO → Robots → Intelligence → Human Decision. Every layer of BASTION visible in one continuous flow
- The coalition caveat demonstration is as important as the robot movement — showing automated policy enforcement across national boundaries is a key differentiator
- Lethal force gate showing both approve and deny paths demonstrates the "verifiable human control over lethal decisions" core value proposition
- Timeline playback at the end ties the whole story together — the audience watches the entire mission evolve in the knowledge graph, from strategic directive to tactical detection
- 3 physical robots with self-healing mesh demonstrates production readiness, not just a software demo
- Multi-source corroboration (ghosted → solid symbols) gives the audience an intuitive feel for intelligence confidence without explanation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `robot/swarm/coordinator.py`: SwarmCoordinator with leader election, UDP peer mesh, formation dispatch, heartbeat, vision sharing. Core orchestration layer
- `robot/swarm/formations.py`: Formation geometry engine — slot offsets for all 6 formation types. Generates world positions from leader position + heading
- `robot/swarm/models.py`: Pydantic models for SwarmTelemetryMsg, SwarmMemberHeartbeat, SwarmFormationCmd, SwarmVisionShare, SwarmAddResourceMsg
- `robot/mission_executor.py`: `_execute_swarm_mission()` — formation setup, coordinated waypoint following, vision sharing during movement
- `robot/mission_client.py`: WebSocket client with swarm registration, DAO message handling (swarm:add_resource, swarm:remove_resource)
- `backend/src/robot/robot-mission-service.ts`: Mission lifecycle, `handleSwarmTelemetry()` with in-memory swarmStates Map, `assignMission()`
- `backend/src/robot/vision-cop-pipeline.ts`: Threat classification → MIL-STD-2525D symbology → COP layer symbols → Neo4j hostile nodes. Extend for swarm detection aggregation
- `backend/src/robot/robot-types.ts`: Zod schemas for SwarmTelemetryMsg, SwarmAddResourceMsg, all swarm protocol types
- `backend/src/cop/`: Full COP module — coordinator, 6 sub-agents, layer store, event bus. Phase 47 fixes this pipeline
- `frontend/src/components/direct/RobotMissionTrigger.tsx`: Mission trigger UI with swarm mission forms (formation, spacing, technique selection)
- `backend/src/doc-intelligence/`: Full autonomous document processing pipeline (Phase 40). Used for live strategic directive ingestion

### Established Patterns
- SwarmCoordinator UDP broadcast mesh (port 5807) with mDNS discovery — peer-to-peer, no central coordinator needed
- Mission state machine: accepted → executing → awaiting_auth → complete/failed
- DID-based authentication with national caveats in DID documents
- WebSocket pub/sub for all real-time data (robot, discovery, COP, resources)
- COP event bus: trigger → coordinator → sub-agents → layer store → frontend
- Phase 47 PROV-O provenance model: wasGeneratedBy, wasAttributedTo, wasDerivedFrom
- Phase 47 confidence scoring: source-weighted fusion with configurable weights per source type

### Integration Points
- `vision-cop-pipeline.ts` — extend for multi-robot corroboration (aggregate detections, fuse confidence)
- `robot-mission-service.ts` — add swarm telemetry → COP layer bridge, emit formation geometry events
- COP layer store — new swarm layer type with formation polygons, state colors, interpolated positions
- Brain graph write path — swarm events → JSON-LD assertions with PROV-O provenance and national tags
- Doc-intelligence pipeline — ingest Taiwan defense directive, extract objectives to JSON-LD brain
- DAO smart contracts — expedited single-signer authorization pattern, caveat enforcement
- DID document system — coalition national caveats per robot (Taiwan/US/Australia profiles)
- Frontend COP component — formation polygon rendering, state badges, detection attribution toggle, interpolated movement

</code_context>

<deferred>
## Deferred Ideas

- Drone integration as 4th swarm member — architecture supports it, hardware not yet available
- Voice command interface for mission dispatch (speech-to-text on Jetson)
- Split-screen live brain + COP simultaneous display during mission
- Multi-swarm coordination (multiple swarms operating in same area)
- Replay/AAR (After Action Review) mode as separate feature beyond timeline playback

</deferred>

---

*Phase: 48-robot-swarm-behaviour-end-to-end-demo*
*Context gathered: 2026-03-16*
