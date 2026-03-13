# Phase 44: Robot Vision Capabilities & Mission Intent Translation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add vision capabilities to the Sphero RVR+ / Jetson Orin Nano robot and implement mission intent translation that converts natural language commands (from UI, AI agents, and DAO decisions) into executable MissionJSON. Includes four new vision-enabled mission types, mission behavior profiles, and coalition constraint enforcement via DID documents. Does NOT include SLAM, autonomous lethal engagement, or DAO governance implementation (those exist elsewhere in Bastion).

</domain>

<decisions>
## Implementation Decisions

### Camera & Inference
- CSI camera module (Raspberry Pi Camera v2/v3 or Arducam via CSI ribbon cable) — native Jetson support, compact, low latency
- NVIDIA Jetson Inference library (jetson-inference) for detection/classification — TensorRT-accelerated, native to Jetson Orin Nano
- Full detection stack: object detection (detectNet), specific target identification, obstacle awareness, scene description via vision-language model

### Custom Target Matching
- Combination approach: feature matching (ORB/SIFT) for precise identification + VLM-based matching for flexible "looks like this" scenarios
- Use case: user uploads reference image (e.g., a tank) → robot identifies it in the field
- Generalized feature: "find this uploaded picture" — not hardcoded to any single target
- Lay groundwork for future fine-tuned YOLO detector (training pipeline not in this phase, but architecture supports it)

### Vision Data Flow
- Structured detection JSON (class, confidence, bounding box) sent over existing WebSocket protocol
- Key frame JPEG snapshots sent on detection events — configurable on/off toggle to reserve bandwidth and improve performance
- Extends existing TelemetryMsg or new VisionMsg type in the robot protocol

### Intent Translation Architecture
- Hybrid approach: LLM function calling (primary) with local template-based fallback (offline/simple patterns)
- Dual execution location: cloud (Bastion backend) handles UI-originated and DAO-originated commands; on-robot (Jetson) handles local/direct commands
- Input sources: text commands in Bastion UI, chat with AI agents, strategic objective decomposition, DAO decision outputs
- Strategic decomposition: high-level objectives (e.g., "establish surveillance of sector 4") automatically broken into multiple MissionJSON commands

### Pre-Flight Validation & Coalition Constraints
- Pre-flight check before mission dispatch validates: robot capabilities, target reachability, safety bounds
- DID document national policy caveats enforced — robot's DID contains coalition constraints that limit what missions it can accept
- DAO authorization confirmed — mission must trace back to an approved DAO decision
- Core demo value: automated coalition decision → authorization → employment pipeline showing how DAO + smart contracts + DID documents make coalition resource sharing and information sharing more efficient

### Mission Behavior Profiles
- Separate profile registry stored in Bastion (DAO-governed, not embedded in MissionJSON)
- MissionJSON references profile by name (e.g., "stealth_recon", "direct_resupply", "nato_patrol")
- Profiles can be coalition-specific (e.g., "NATO_recon" vs "national_patrol")
- Profile dictates: navigation approach, comms frequency, obstacle response, speed limits, vision update cadence
- Examples:
  - Stealth recon: vision-guided avoidance, minimal transmissions (radio discipline), auto-avoid obstacles quietly
  - Direct resupply: fastest/safest path, event-driven updates, stop-and-report on obstacles for reroute
  - Patrol: continuous vision feed, auto-avoid and log obstacles, balanced speed

### Vision-Guided Navigation
- Vision-guided navigation throughout approach — not just dead-reckoning with visual confirmation
- Navigation behavior changes based on mission profile (stealth avoidance of being seen by target vs direct approach)
- Obstacle detection response is behavior-dependent (auto-avoid, stop-and-report, or log-and-continue based on profile)
- Situational awareness updates are mission-profile dependent (continuous, event-driven, or minimal based on profile)

### New Mission Types
- **recon_area**: Navigate to area, survey with vision, report detections + scene descriptions. Stealth profile. Core demo mission
- **visual_search**: Search area for specific target (uploaded image or object class). AI-planned sweep path. Ties into custom target matching
- **overwatch**: Move to position, hold station, continuously monitor. Report new detections/changes. Long-duration surveillance
- **resupply_route**: Navigate to drop point via profile-determined path. Vision for obstacle avoidance. Demonstrates autonomous logistics
- AI-planned sweep paths for recon_area and visual_search — planning algorithm generates optimal search path based on area geometry and mission profile

### Escalation & Authority
- Escalation authority is included in DAO decision and encoded in DID document
- Authority levels built elsewhere in Bastion — this phase respects them
- Lethal force ALWAYS requires direct human authorization — robot stops and awaits authorization before any engagement
- Non-lethal autonomous actions (avoid, reroute, alert) governed by profile and authority level

### Claude's Discretion
- Exact VLM model selection for scene description on Jetson (LLaVA, etc.)
- Feature matching algorithm details (ORB vs SIFT vs other)
- WebSocket message format for vision data (extend TelemetryMsg vs new VisionMsg)
- Local fallback NLP template design
- Sweep path planning algorithm specifics
- Key frame compression and resolution settings
- Simulate mode implementation for vision (mock detections for testing without camera)

</decisions>

<specifics>
## Specific Ideas

- User wants to demonstrate finding a specific tank using an uploaded reference image — but the feature should be generalized ("find this uploaded picture")
- Core demo narrative: DAO votes on objective → AI decomposes to missions → DID document constraints enforced → robot executes autonomously with human authorization for lethal decisions → vision provides situational awareness back to coalition operators
- Mission profiles should feel like real military C2 concepts — stealth recon behaves differently from direct resupply, matching how real missions are planned
- Robot should navigate using vision to avoid being seen during recon (not just avoid obstacles, but avoid the target's line of sight)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `robot/mission_executor.py`: State machine for mission execution. Extend with vision integration points and new mission type handlers
- `robot/rvr_driver.py`: RVR+ hardware driver with simulate mode. Add vision-related methods (or keep vision as separate module)
- `robot/models.py`: Pydantic models for MissionJSON, MissionParams, TelemetryMsg. Extend with profile reference, vision message types, new mission commands
- `robot/common/ws_protocol.py`: WebSocket protocol shared between robot and bridge. Extend with vision message types
- `robot/common/mdns.py`: mDNS discovery utilities
- `robot/config.py`: Environment-based config. Add vision and camera configuration
- `backend/src/robot/robot-types.ts`: Zod schemas for mission protocol. Mirror new Python types
- `backend/src/robot/robot-mission-service.ts`: Mission lifecycle management. Add profile resolution and intent translation integration
- `backend/src/robot/robot-ws.ts`: WebSocket server. Handle vision messages

### Established Patterns
- Mission state machine in MissionExecutor (accepted → executing → awaiting_auth → complete/failed)
- Simulate mode for development without hardware (RVRDriver._simulate)
- Pydantic models with Zod mirror in backend
- WebSocket pub/sub for real-time data
- DID-based authentication and capability declaration (from Phase 43)
- Message bus for cross-service event routing

### Integration Points
- `robot-mission-service.ts` — add intent translation endpoint, profile resolution, pre-flight validation
- `robot-ws.ts` / `bridge-ws.ts` — handle VisionMsg, key frame streaming
- DID document system — read national caveats and authority levels for pre-flight checks
- DAO decision outputs — subscribe to approved decisions for automatic mission generation
- AI agent system — agent can invoke intent translation to dispatch missions conversationally
- ResourceRegistry — robot capabilities updated to include vision capabilities

</code_context>

<additional_context>
## Additional User Context (2026-03-13)

### Resource Discovery & Capability Registration
- Other resources (robots, drones, sensors, etc.) will connect to Bastion dynamically — Bastion must discover and catalog their capabilities
- Each resource's DID document must accurately reflect: capabilities, security classifications, national policy caveats, restrictions, constraints, and authority levels
- Bastion uses this DID-based capability profile to select the right resources for DAO-authorized missions
- Resource must operate strictly within the authority and autonomy levels authorized for the duration it's tasked
- This is not just about this one robot — the architecture must support heterogeneous resource registration and tasking

### Movement Control (Sphero RVR+ via Jetson Orin Nano)
- The Jetson Orin Nano is physically mounted on a Sphero RVR+
- Phase must include how the robot controls its movement — the Orin Nano commands the RVR+ for navigation, obstacle avoidance, and mission waypoint traversal
- Movement behavior is mission-profile-dependent (stealth vs direct vs patrol speed/approach)

</additional_context>

<deferred>
## Deferred Ideas

- Fine-tuned YOLO training pipeline for custom target detection (groundwork laid in this phase, training pipeline is future phase)
- SLAM / mapping integration for true autonomous navigation
- Voice command input via microphone on Jetson (speech-to-text)
- DAO governance implementation for mission profiles (this phase assumes DAO infrastructure exists)

</deferred>

---

*Phase: 44-robot-vision-capabilities-and-mission-intent-translation*
*Context gathered: 2026-03-13*
