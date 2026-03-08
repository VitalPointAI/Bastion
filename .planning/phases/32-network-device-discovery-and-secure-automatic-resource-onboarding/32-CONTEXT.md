# Phase 32: Network Device Discovery & Secure Automatic Resource Onboarding - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Bastion automatically discovers devices on local networks (Bluetooth, WiFi, USB, TAK/RF), fingerprints them, and seamlessly onboards them as first-class resources with DID identity, capability mapping, and bidirectional command channels. Includes DAO-governed acceptance gates, EM spectrum awareness, and Ironclaw-driven adapter generation for unknown devices. Builds on Phase 27's resource registry and plugin architecture.

</domain>

<decisions>
## Implementation Decisions

### Discovery Scope
- Scan all 4 transport types: Bluetooth/BLE, WiFi/mDNS/SSDP/UPnP, USB/Serial, Custom RF/TAK (CoT protocol)
- Always-on background scanning with configurable intervals — operator can pause/resume
- Full auto-fingerprinting before acceptance gate: probe discovered devices for type, manufacturer, capabilities, supported protocols
- Persistent registry with full presence lifecycle: discovered -> onboarded -> connected -> disconnected -> reconnected. Bastion remembers devices and auto-reconnects
- Scan all available network interfaces by default; admin-only configuration to disable specific interfaces. Ironclaw agent CANNOT override interface restrictions (protected config)
- Online preferred with graceful DDIL degradation — full features with internet, falls back to local-only discovery when disconnected
- COP discovery layer showing unregistered/pending devices spatially on the map
- EM spectrum awareness layer — show what EM environment Bastion is operating in
- Own EM signature layer — display what electromagnetic footprint Bastion itself is generating

### Acceptance Gate
- DAO-governed allowlist AND blocklist — both require DAO approval to modify
- Global default allowlist/blocklist with per-problem-set overrides (inherit from global, individual PS can add/restrict within scope)
- Allowed devices: auto-onboard with operator notification (not silent)
- Unknown devices (not on either list): quarantine + Ironclaw analysis. Ironclaw attempts identification and adapter creation, presents findings to DAO for approval
- Blocklisted devices: rejected for onboarding but tracked in security monitoring view — operators see what's being rejected for threat awareness
- Revocation: normal revocation through DAO vote, plus emergency admin disconnect (logged, DAO ratifies after the fact)
- Devices start as observer trust tier within Bastion ecosystem (can't self-direct), but Bastion establishes full command channel — device accepts and obeys Bastion commands

### Protocol Bridge
- Extend existing ResourcePlugin interface with a command adapter facet — each plugin gains protocol communication alongside schema/state-machine/capabilities
- Universal Bastion command set (move, report, configure, execute) translated by adapter into device-native instructions, PLUS native command escape hatch for device-specific features
- Ironclaw generates hot-loadable plugins for unknown devices — follows ResourcePlugin interface, plugin-loader picks them up at runtime without restart
- Hybrid connection persistence based on trust tier: persistent connections for autonomous/participant devices, on-demand for observers

### Security Model
- Challenge-response authentication during fingerprinting phase — device must prove identity before onboarding proceeds. Failed challenges = immediate quarantine
- All communication channels always encrypted regardless of transport — DID keys used for channel encryption after onboarding
- Behavioral baseline anomaly detection — Bastion learns normal behavior patterns per device type, deviations trigger alerts and potential auto-quarantine (catches compromised/spoofed devices)
- Audit trail: detailed logs in PostgreSQL for fast queries, periodic hash anchoring to NEAR blockchain for immutability

### Network Hopping & Topology Mapping
- Configurable network hopping — when enabled, Bastion uses discovered/onboarded devices as bridges to scan adjacent networks reachable via that device's connections
- Recursive discovery: initial scan finds Device A on Network 1, Device A has access to Network 2, Bastion scans Network 2 through Device A, and so on
- Builds a full communications/network topology map as it goes — nodes (devices), edges (connections), network boundaries
- Configurable hop depth limit (admin setting, e.g., max 3 hops) to prevent unbounded scanning
- Each hop requires the bridge device to be at participant or autonomous trust tier (observers can't be used as bridges)
- Network topology visualization layer on COP alongside EM spectrum layers
- DAO governance applies at each hop — newly discovered networks inherit the global allowlist/blocklist, per-PS overrides can restrict hopping scope
- Disabled by default — operator explicitly enables per-problem-set or globally

### Claude's Discretion
- Network hop traversal strategy and proxy protocol details
- Topology map data structure and storage approach
- Specific scan intervals and timing per transport type
- Fingerprinting probe depth and protocol negotiation details
- EM spectrum visualization design and data sources
- Behavioral baseline ML approach and threshold tuning
- Hot-load plugin sandboxing implementation details
- DDIL fallback behavior specifics

</decisions>

<specifics>
## Specific Ideas

- "If Bastion can't immediately identify or understand how to onboard a resource, invoke the Ironclaw agent to modify and/or build code to solve the connection issue" — Ironclaw as the adaptive fallback for unknown device types
- EM spectrum awareness is bidirectional: know what's around you AND know your own electromagnetic signature (OPSEC awareness)
- Allowlist/blocklist scope follows Phase 26's strategic environment inheritance pattern — global defaults, per-PS overrides
- Interface restriction config must be agent-proof (Ironclaw cannot re-enable a disabled interface to bypass admin restrictions)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResourceRegistry` (backend/src/resources/resource-registry.ts): Singleton with DID registration, write-through cache, 4 query types (DID, capability, type+status, geographic area). Direct extension point for discovery pipeline
- `PluginRegistry` (backend/src/resources/plugins/plugin-registry.ts): Auto-discovers and loads plugins by category. Extend with protocol adapter facet
- `ResourcePlugin` interface (backend/src/resources/plugins/base-plugin.ts): 5 facets (schema, state machine, capabilities, COP renderer, telemetry). Add 6th facet: command adapter
- `ResourceTelemetryService` (backend/src/resources/resource-telemetry.ts): WebSocket-based batched telemetry. Reuse for device telemetry ingestion
- `CommsPlugin` (backend/src/resources/plugins/comms-plugin.ts): Already handles HF/VHF/UHF/SATCOM/mesh/fiber with state machine (FMC/transmitting/receiving/jammed/PMC/NMC)
- `ResourceTrustTier` type: observer/participant/autonomous — maps directly to connection persistence policy
- `plugin-loader.ts`: File-based auto-discovery of plugins — extend for hot-loading Ironclaw-generated adapters

### Established Patterns
- Singleton registries with write-through DB cache (ResourceRegistry, AgentRegistry)
- Plugin auto-discovery via file system scanning (plugin-loader.ts)
- DID generation via HKDF pattern (resource-did.ts) — same pattern for device identity
- XState v5 state machines for resource lifecycle — extend with discovery/onboarding states
- WebSocket pub/sub for real-time data (resource-ws.ts, telemetry service)
- DAO governance proposals at decision gates (Phase 28)
- ABAC filtering for access control (abac-filter.ts)

### Integration Points
- ResourceRegistry.registerResource() — entry point for onboarding pipeline
- PluginRegistry — extend plugin interface, extend loader for hot-loading
- COP resource layer (Phase 27 Plan 05) — add discovery layer alongside existing resource layer
- DAO governance gates (Phase 28) — allowlist/blocklist approval proposals
- Ironclaw agent (Phase 30) — invoke for unknown device analysis and adapter generation
- Admin settings — interface enable/disable configuration (agent-proof)
- Message bus (message-bus.ts) — onboarding event notifications

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding*
*Context gathered: 2026-03-07*
