# Phase 43: Robot Agent & Local Discovery Bridge - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable autonomous robots and local network devices to connect to cloud-hosted Bastion through two complementary mechanisms: (1) a lightweight Python robot agent that self-registers with Bastion via outbound WebSocket for command/telemetry, and (2) a Docker-based local network bridge that runs mDNS/SSDP scanning on the user's WiFi and relays discovered devices to Bastion cloud. The bridge also acts as a command proxy, local command cache, and low-latency relay for local devices. Robots advertise via mDNS (`_bastion-robot._tcp.local`) for bridge auto-discovery. Bridge advertises via mDNS (`_bastion._tcp.local`) for robot auto-discovery. Dual-path connectivity (direct outbound + bridge relay) provides resilience.

**Design note:** Docker bridge + Python robot agent chosen over Raspberry Pi edge node due to hardware procurement/policy constraints. Pi remains the recommended production deployment. Docker bridge designed to be forward-compatible — same code runs on Pi with minimal changes.

</domain>

<decisions>
## Implementation Decisions

### Bridge Architecture & Deployment
- Full edge node role: scanning + relay + local command execution (caches missions, queues commands when cloud is down)
- Python language — same as robot agent, shares code for WebSocket protocol, message types, mDNS (zeroconf)
- CLI-based launch (Docker run with env vars/config file) + optional local web UI enabled via `--ui` flag
- Local web UI: minimal dashboard showing scan results, connected robots, relay status, cloud connectivity (FastAPI)
- Bridge status also visible in Bastion cloud UI as a connected infrastructure resource
- Docker container runs with `--network=host` for full LAN access
- Full network scan — bridge scans for ALL mDNS/SSDP devices on the LAN (not just Bastion-tagged), relays everything to Bastion cloud for Phase 32's acceptance gate to process

### Robot-to-Bridge mDNS Discovery
- mDNS browse with fallback config: robot uses zeroconf to browse for `_bastion._tcp.local` services; if no bridge found within timeout, falls back to configured bridge IP/hostname from env vars
- Bidirectional discovery: robot advertises `_bastion-robot._tcp.local` AND browses for bridges; bridge also browses for robots. Either side initiates connection — whoever discovers first connects
- Minimal TXT records on bridge advertisement: bridge_id, cloud_url, version
- Dual registration: robot self-registers with cloud through bridge AND bridge also reports discovered robots. Cloud reconciles. If bridge goes down, robot's direct registration is already in place

### Dual-Path Connectivity & Failover
- Direct path preferred: robot prefers its own outbound WebSocket to cloud. Bridge relay is fallback
- Message ID deduplication: every message includes a unique message_id (UUID). Backend deduplicates — first arrival wins, second is dropped silently
- Fast automatic failover (~5s): robot detects direct connection loss (missed heartbeats or WebSocket close), promotes bridge relay to active within ~5 seconds. No operator intervention needed
- Command queueing with TTL: bridge queues commands from cloud for offline robots. Commands expire after configurable TTL (default 5 minutes). When robot reconnects locally, queued commands are delivered

### Bridge-to-Cloud Authentication
- Registration flow: bridge starts with a one-time registration token (generated in Bastion UI). On first connect, exchanges it for persistent DID + auth credentials. Combines ease of setup with DID-based security long-term
- Bridge registered as first-class infrastructure resource in Bastion's resource registry (type: 'bridge') with its own DID, capabilities (scanning, relay, queueing), and status. Visible in Resources tab alongside robots and other devices
- Skip DAO acceptance gate: operator explicitly deployed the bridge and generated the registration token — that action IS the approval. Bridge auto-accepted at 'participant' trust tier
- Robot agent upgraded to same registration flow: one-time token → DID pattern, replacing current AUTH_TOKEN shared secret. Consistent auth model across all edge components

### Claude's Discretion
- FastAPI web UI layout and design details
- Exact mDNS browse timeout before fallback (sensible default)
- Command queue storage mechanism (in-memory vs SQLite)
- WebSocket reconnection backoff strategy details
- Bridge container health check implementation
- Exact message_id format (UUID v4 vs monotonic sequence)

</decisions>

<specifics>
## Specific Ideas

- Bridge is forward-compatible with Raspberry Pi deployment — same Python code, same Docker container, minimal changes to run on Pi hardware
- Full network scan feeds into Phase 32's existing acceptance gate pipeline — bridge acts as a remote scanning arm for Phase 32's infrastructure
- Robot agent already exists in `robot/` directory with WebSocket client, mission lifecycle, telemetry, RVR driver — this phase enhances it with mDNS discovery and registration flow auth
- Bridge and robot share Python code: WebSocket protocol, message types, mDNS utilities — keep in a shared package or module

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `robot/mission_client.py`: Full WebSocket client with registration, telemetry heartbeat, mission dispatch, reconnection. Enhance with mDNS discovery layer and DID-based auth
- `robot/config.py`: Environment-based config loading. Extend with bridge URL fallback and registration token
- `robot/models.py`: Message type definitions (RegisterMsg, TelemetryMsg, StateUpdateMsg). Share with bridge
- `backend/src/robot/robot-ws.ts`: WebSocket server for robot connections. Extend to handle bridge connections and message dedup
- `backend/src/robot/robot-mission-service.ts`: Mission lifecycle, robot tracking, telemetry routing. Add bridge awareness and dual-path tracking
- `backend/src/discovery/discovery-router.ts`: Full discovery REST API with scanner control, device management, access lists. Bridge feeds discovered devices into this pipeline
- `backend/src/discovery/discovery-ws.ts`: Real-time discovery event streaming. Bridge's scan results integrate here
- `ResourceRegistry` (backend/src/resources/resource-registry.ts): DID registration, capability mapping. Register bridge as infrastructure resource
- `ResourceTelemetryService` (backend/src/resources/resource-telemetry.ts): WebSocket batched telemetry. Reuse for bridge-relayed telemetry

### Established Patterns
- WebSocket pub/sub for real-time data (resource-ws.ts, discovery-ws.ts, robot-ws.ts)
- Singleton registries with write-through DB cache (ResourceRegistry, AgentRegistry)
- DID generation via HKDF pattern (resource-did.ts) — same pattern for bridge DID
- Plugin auto-discovery via file system scanning (plugin-loader.ts)
- Message bus for cross-service event routing (message-bus.ts)
- Phase 32's acceptance gate for device onboarding (bridge bypasses, but relayed devices go through it)

### Integration Points
- `robot-ws.ts` — extend to accept bridge connections, route relayed messages, handle dedup
- `robot-mission-service.ts` — add bridge tracking, dual-path awareness, command routing
- `discovery-router.ts` / `discovery-store.ts` — ingest bridge scan results as remote-origin discoveries
- `ResourceRegistry` — register bridge as infrastructure resource with DID
- Phase 32 acceptance gate — bridge-relayed device discoveries flow through existing pipeline
- Admin UI — generate one-time registration tokens for bridge and robot deployment

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-robot-agent-local-discovery-bridge*
*Context gathered: 2026-03-12*
