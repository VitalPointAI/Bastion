# Phase 6: Autonomous Vehicle Integration - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end control chain: DAO mission intent → Bastion off-chain gateway → Jetson Orin Nano mission client → Sphero RVR+ executes deterministic behavior → status reporting back to Bastion COP. Single "alpha" robot MVP, architecture designed for multi-robot expansion. See `buildplan.md` in this directory for full system architecture (5 components: Mission Source, Gateway/Listener, Alpha Mission Client, RVR+ Driver, Logging/Visibility).

</domain>

<decisions>
## Implementation Decisions

### Mission Delivery Protocol
- WebSocket for all Bastion ↔ Jetson communication
- Jetson connects TO Bastion as WS client, registering through the **existing discovery pipeline** (Phase 32) — reuse device lifecycle state machine, fingerprinting, onboarding flow
- Robot reports **state transitions** (accepted → executing → awaiting_auth → complete/failed) plus **periodic telemetry heartbeat every 2 seconds** (position, heading, battery)
- State transitions are the primary status mechanism; telemetry provides positional updates for COP visualization

### DAO Integration Approach
- **Mock DAO events first** with the same payload shape as real DAO proposals — unblocks robot development immediately
- Mock trigger available via **both UI button and API endpoint** — button for live demos, API for automated testing
- Mission payload includes a **policy document** attached to the robot's **DID** (every resource gets a DID on discovery/connection via the resource registry)
- Policy document maps to Bastion's existing **authorities model** — same structure, same approval gates
- **Autonomy tiers in policy**: actions the robot can execute autonomously (movement, recon, patrol) vs. actions requiring human authorization (lethal effects, weapons employment, boundary crossing)
- Human authorization for restricted actions flows through the **governance/decisions DAO UI** — not a separate operator console
- Demo narrative: DAO issues mission → robot executes autonomously up to authority limit → robot pauses at restricted action → governance DAO UI presents authorization request → human approves/denies → robot continues or aborts
- Missions that violate delegated authorities are **rejected with a specific reason** (e.g., "speed exceeds authority limit")

### Robot Status in Bastion UI
- Robot appears as a **COP tab layer** — icon on the map with state color overlay
- Icon state colors: green=executing, yellow=awaiting authorization, red=failed, grey=idle
- Small label showing current mission name visible at glance
- Click robot icon → **MissionStatusCard** detail panel (reuse existing MissionStatusCard/Drilldown pattern from inheritance-service): current mission, state timeline, telemetry snapshot, DID and policy summary
- **Key mission state transitions** appear in the COP **activity feed** (accepted, executing, awaiting auth, complete, failed) — reuse existing ActivityFeed component
- **Room-to-map coordinate scaling**: physical room (meters) maps to a defined area of operations on the COP map
  - Config file defines room dimensions + corresponding map area bounds
  - Calibration routine at demo start: robot drives to corners, captures positions, refines transform
  - Named configs can be **saved and reused** (e.g., "Conference Room A", "Lab", "Demo Hall")
  - Robot reports room-relative position, Bastion translates to map coordinates

### Demo Mission Behaviors
- **Primary mission: Find and Engage Target**
  - Robot navigates to a predefined target location (known in mission params)
  - On arrival, robot reports "target located" and **pauses for human authorization** before engaging
  - Authorization request flows through governance/decisions DAO UI
  - Upon approval: RVR+ flashes LEDs red + plays tone + reports "target engaged"
  - Upon denial: robot reports "engagement denied" and returns to idle
  - This is the hero demo — shows full DAO governance → autonomous execution → human-in-the-loop chain
- **Secondary mission: Patrol Route**
  - Robot follows a sequence of predefined waypoints
  - Reports position at each waypoint
  - Useful for testing, calibration, and showing multi-mission-type support
- Architecture supports future camera-based target detection (Jetson GPU capable) and video streaming to Bastion, but MVP uses predefined locations

### Claude's Discretion
- WebSocket message format and protocol details
- Exact mission state machine implementation
- Telemetry data structure beyond position/heading/battery
- LED pattern/timing for engagement simulation
- Error handling and reconnection logic
- Logging format and storage approach

</decisions>

<specifics>
## Specific Ideas

- "The key thing to test is policies related to level of AI autonomy delegated and allowed to execute — if we issue a command to find and kill a tank, it will autonomously find the tank but must stop before launching lethal effects to receive human authorization"
- Robot's DID and policy document integrate with the existing authorities model built into Bastion — policies incorporate Bastion's authority delegation framework
- Buildplan emphasizes: "DAO issues intent, not motor commands" and "the Jetson is the edge mission brain"
- Scenario: military application but easily doable, not overly clever and fragile
- System must be simple, reliable, explainable, and demoable within one week
- Every component must be testable independently
- Stub or simulate anything that threatens timeline risk

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Discovery pipeline** (Phase 32, `backend/src/discovery/`): Device lifecycle state machine (discovered → fingerprinting → authenticating → gate_check → onboarding → connected), transport types (WiFi), DID assignment on onboarding. Robot registers through this pipeline.
- **Ironclaw agent** (Phase 30, `backend/src/ironclaw/`): Action risk classification (low/medium/high), trust preferences, action pipeline, gate approvals. Authority enforcement model to reuse for mission policy checks.
- **WebSocket infrastructure**: `discovery-ws.ts`, `inheritance-ws.ts`, `resource-ws.ts`, `collaboration/sync-server.ts` — established patterns for WS server endpoints.
- **COP tab** (`frontend/src/components/cop/COPTab.tsx`): Map view with layers, perspectives, phase slider, resource detail panel, sidebar views (layers, actor-graph, activity). Add robot status as new COP layer.
- **MissionStatusCard** (`frontend/src/components/inheritance/MissionStatusCard.tsx`): Existing pattern for mission status display with drilldown. Reuse for robot mission detail.
- **ActivityFeed** (`frontend/src/components/problem-set/ActivityFeed.tsx`): Existing activity feed in COP sidebar. Robot state transitions can be fed items.
- **Gate service** (`backend/src/gates/gate-service.ts`): Approval gates for restricted actions. Reuse for human-authorization-required mission steps.
- **Resource registry** (`backend/src/resources/`): Plugin architecture for resources. Robot as a registered resource with DID.

### Established Patterns
- Const objects (not enums) for type constants per project convention
- TypeScript for frontend and backend
- WebSocket endpoints follow pattern in `*-ws.ts` files
- State machines defined with explicit state types and transition logic (see `discovery-lifecycle.ts`)

### Integration Points
- Discovery pipeline onboarding → robot gets DID and joins resource registry
- Gate service → human authorization for restricted mission actions
- COP layer system → robot status visualization
- Activity feed → mission state transition events
- Governance/decisions DAO UI → lethal effects authorization prompts
- Problem set context → missions originate from problem set DAO

</code_context>

<deferred>
## Deferred Ideas

- Camera-based target detection (CV on Jetson) — future enhancement after predefined-location MVP works
- Video streaming from robot camera to Bastion UI — future enhancement
- Multi-robot coordination and swarm task allocation — planned for future but architecture supports it
- Real DAO event integration (replacing mock events) — swap in after MVP proves the chain
- On-chain telemetry storage — out of scope per buildplan
- SLAM / autonomous mapping — out of scope per buildplan
- Peer-to-peer robot networking — out of scope per buildplan

</deferred>

---

*Phase: 06-autonomous-vehicle-integration*
*Context gathered: 2026-03-11*
