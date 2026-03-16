# Quick Task 14: Auto-register BLE swarm robots via leader trust delegation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

When a BLE robot connects as part of a swarm with a registered leader, auto-issue a DID and register it in the resource registry without requiring a registration token. Trust is delegated from the swarm leader.

</domain>

<decisions>
## Implementation Decisions

### Trust Persistence
- Registration persists permanently once issued via leader trust
- No revocation on leader disconnect (avoids UI churn)
- Resource registry should support manual revocation if needed (existing feature)

### Capabilities Assignment
- Derive capabilities from swarm telemetry member role AND hardware scan
- Use member's reported capabilities/hardware_info from telemetry where available
- Fall back to role-based defaults (overwatch → ISR, advance → find_engage, etc.)

### Trigger Point
- Auto-register on first swarm telemetry in handleSwarmTelemetry
- When an unregistered member DID (did:ble:*) appears in swarm telemetry members array
- Check that the leader_id maps to a registered robot with a valid DID
- No extra WebSocket messages needed — piggyback on existing telemetry flow

### Claude's Discretion
- DID format: use existing `did:ble:{MAC}` format already assigned by BLE bridge
- Trust metadata: store `trust_source: 'swarm_leader'`, `trusted_by: {leader_did}` in resource specifications
- Coalition profile: inherit leader's national DID for caveat purposes

</decisions>

<specifics>
## Specific Ideas

- The trigger is in `robot-mission-service.ts` `handleSwarmTelemetry()` — check each member's DID against resource registry
- Use `getResourceRegistry().registerResource()` same as token registration path in `robot-ws.ts`
- SwarmTelemetryMsg.members has `robot_id`, `position`, `heading`, `battery` — need to check if DID is available
- May need to look up DID from robot store via robot_id, then check resource registry for that DID
- Frontend RobotMissionTrigger already has the notFoundDidsRef cache — clear it when a new registration happens (via WebSocket event or next poll cycle)

</specifics>
