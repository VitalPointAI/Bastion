---
phase: quick-14
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/robot/robot-mission-service.ts
autonomous: true
requirements: [QUICK-14]

must_haves:
  truths:
    - "A swarm member whose robot_id is already in connectedRobots but has no resource-registry entry gets auto-registered when swarm telemetry arrives"
    - "The registered resource's specifications include trust_source: 'swarm_leader' and trusted_by: {leader_did}"
    - "Capabilities are derived from the member's role (overwatch→ISR, advance→find_engage, follower→patrol) with fallback to defaults"
    - "If the leader's robot_id is not in connectedRobots or is not in the resource registry, no auto-registration happens"
    - "Registration is idempotent — subsequent swarm telemetry for an already-registered member is a no-op"
  artifacts:
    - path: "backend/src/robot/robot-mission-service.ts"
      provides: "autoRegisterSwarmMember private method + call in handleSwarmTelemetry"
      contains: "autoRegisterSwarmMember"
  key_links:
    - from: "handleSwarmTelemetry (line ~1165)"
      to: "autoRegisterSwarmMember"
      via: "for-each loop over msg.members, guarded by leader registry check"
    - from: "autoRegisterSwarmMember"
      to: "registry.registerResource"
      via: "same pattern as bridgeToResourceRegistry, with extra specifications fields"
---

<objective>
Auto-register BLE swarm member robots in the resource registry via leader trust delegation.
When `handleSwarmTelemetry` processes a swarm report, any member whose connected-robot record exists
but whose DID is NOT yet in the resource registry gets auto-registered — no token needed.
Trust metadata (trust_source, trusted_by, coalition_national_did) is embedded in specifications.

Purpose: Swarm members should appear in the resource registry and on the COP immediately when
they join a swarm with a registered leader, without requiring human issuance of tokens.

Output: New private method `autoRegisterSwarmMember` in `RobotMissionService`, called from
`handleSwarmTelemetry` after the COP bridge call.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/14-auto-register-ble-swarm-robots-via-leade/14-CONTEXT.md

<interfaces>
<!-- Key types and patterns the executor must follow. No codebase exploration needed. -->

From backend/src/robot/robot-types.ts:
```typescript
export interface SwarmMemberHeartbeat {
  robot_id: string;
  role: 'leader' | 'follower' | 'unassigned';
  position: { x: number; y: number };
  heading: number;
  battery_pct: number;
  slot_index?: number;
}

export interface SwarmTelemetryMsg {
  type: typeof RobotWsMessageType.swarm_telemetry;
  swarm_id: string;
  leader_id: string;
  state: SwarmState;
  formation: SwarmFormationType;
  member_count: number;
  members: SwarmMemberHeartbeat[];
  center_of_mass: { x: number; y: number };
  heading: number;
  timestamp: string;
}
```

From RobotMissionService (robot-mission-service.ts):
```typescript
// In-memory stores:
private connectedRobots = new Map<string, ConnectedRobot>();  // robot_id -> ConnectedRobot
private robotResourceIds = new Map<string, string>();          // did -> resourceId

// Existing pattern to copy:
private async bridgeToResourceRegistry(robotId: string, did: string, capabilities: string[]): Promise<void> {
  const registry = getResourceRegistry();
  await registry.ensureInitialized();
  const existing = registry.getByDID(did);
  if (existing) { ... update; return; }
  const registered = await registry.registerResource({
    name: `Robot ${robotId}`,
    category: 'vehicles',
    specifications: { type: 'ground', maxSpeed: 1.5, maxRange: 100, payload: 0, fuelType: 'electric', autonomyLevel: 3 },
    isAutonomous: true,
    capabilities: capabilities.length > 0 ? capabilities : ['patrol', 'ISR'],
  });
  this.robotResourceIds.set(did, registered.id);
}
```

Import already present at top of file:
```typescript
import { getResourceRegistry } from '../resources/resource-registry.js';
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement autoRegisterSwarmMember and wire into handleSwarmTelemetry</name>
  <files>backend/src/robot/robot-mission-service.ts</files>
  <action>
Add a new private async method `autoRegisterSwarmMember` to `RobotMissionService`, and call it
inside `handleSwarmTelemetry` for each swarm member.

**Step 1 — Add the method** (insert after the `bridgeToResourceRegistry` method, around line 1010):

```typescript
/**
 * Auto-register a swarm member robot in the resource registry via leader trust delegation.
 * Called from handleSwarmTelemetry when a member's DID is connected but not yet registered.
 * Trust metadata is stored in specifications so it survives in the DB record.
 */
private async autoRegisterSwarmMember(
  member: SwarmMemberHeartbeat,
  leaderDid: string,
  leaderNationalDid: string,
): Promise<void> {
  const robot = this.connectedRobots.get(member.robot_id);
  if (!robot) return; // member not connected via WebSocket relay — skip

  const { did } = robot;

  const registry = getResourceRegistry();
  await registry.ensureInitialized();

  // Idempotency — already registered
  if (registry.getByDID(did)) {
    if (!this.robotResourceIds.has(did)) {
      // Cache miss (e.g. server restart) — rebuild the map entry
      const existing = registry.getByDID(did);
      if (existing) this.robotResourceIds.set(did, existing.id);
    }
    return;
  }

  // Derive capabilities from swarm role
  const roleCapabilities: Record<string, string[]> = {
    leader:      ['patrol', 'ISR', 'command'],
    follower:    ['patrol', 'ISR'],
    unassigned:  ['patrol'],
  };
  // Prefer role-derived capabilities; use robot's own capabilities if richer
  const baseCaps = roleCapabilities[member.role] ?? ['patrol'];
  const effectiveCaps = robot.capabilities.length > 0 ? robot.capabilities : baseCaps;

  const registered = await registry.registerResource({
    name: `Robot ${member.robot_id} (swarm)`,
    category: 'vehicles',
    specifications: {
      type: 'ground',
      maxSpeed: 1.5,
      maxRange: 100,
      payload: 0,
      fuelType: 'electric',
      autonomyLevel: 3,
      // Trust delegation metadata
      trust_source: 'swarm_leader',
      trusted_by: leaderDid,
      coalition_national_did: leaderNationalDid,
    },
    isAutonomous: true,
    capabilities: effectiveCaps,
  });

  this.robotResourceIds.set(did, registered.id);
  console.log(
    `[RobotMissionService] Swarm member ${member.robot_id} auto-registered via leader trust ` +
    `(DID: ${registered.did}, trusted_by: ${leaderDid})`,
  );
}
```

**Step 2 — Wire into handleSwarmTelemetry** (insert AFTER the COP bridge try/catch block
that ends around line 1233, BEFORE the message bus publish block at line 1252):

```typescript
    // Auto-register swarm members that are connected but not yet in the resource registry
    // (Phase quick-14: leader trust delegation — no token required for swarm members)
    const leaderRobot = this.connectedRobots.get(leader_id);
    if (leaderRobot && registry_check: this.robotResourceIds.has(leaderRobot.did)) {
```

Actually, write it as a plain block — no label syntax:

```typescript
    // Auto-register connected swarm members that lack a resource-registry entry
    // (leader trust delegation — no registration token required)
    const leaderRobot = this.connectedRobots.get(leader_id);
    const leaderResourceId = leaderRobot?.did ? this.robotResourceIds.get(leaderRobot.did) : undefined;
    if (leaderRobot && leaderResourceId) {
      // Leader is registered — use its national DID for coalition caveat inheritance
      const leaderNationalDid = 'did:near:bastion.testnet'; // default; extend if leaders carry national DID in future
      for (const member of members) {
        if (member.robot_id === leader_id) continue; // skip leader itself
        this.autoRegisterSwarmMember(member, leaderRobot.did, leaderNationalDid).catch((err) => {
          console.warn(`[RobotMissionService] Swarm member auto-registration failed for ${member.robot_id} (non-fatal):`, err);
        });
      }
    }
```

Insert this block immediately before the existing `const telemetryService = getResourceTelemetryService();` line at ~line 1236.

**Important notes:**
- Import `SwarmMemberHeartbeat` is already available via the destructured members array type — no new import needed.
- The `autoRegisterSwarmMember` signature uses `SwarmMemberHeartbeat` — verify it is imported at the top of the file (it should be, as it's used in the existing swarm types). If not already imported, add it to the existing robot-types import line.
- Do NOT change the existing `bridgeToResourceRegistry` method — only add the new method and the call site.
- The method fires-and-forgets (`.catch` logs only) to match the pattern of `bridgeToResourceRegistry` at line 284.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && npx tsc --project backend/tsconfig.json --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
TypeScript compiles with no errors. `autoRegisterSwarmMember` exists in `RobotMissionService`.
`handleSwarmTelemetry` calls it for each non-leader member when the leader has a resource registry entry.
Specifications include trust_source, trusted_by, coalition_national_did.
  </done>
</task>

</tasks>

<verification>
After task completes:
1. `npx tsc --project backend/tsconfig.json --noEmit` passes with 0 errors
2. Grep confirms `autoRegisterSwarmMember` exists: `grep -n "autoRegisterSwarmMember" backend/src/robot/robot-mission-service.ts`
3. Grep confirms trust metadata: `grep -n "trust_source" backend/src/robot/robot-mission-service.ts`
4. Grep confirms call site: `grep -A5 "Auto-register connected swarm" backend/src/robot/robot-mission-service.ts`
</verification>

<success_criteria>
- New swarm member connected via BLE bridge (in connectedRobots) gets registered automatically in resource registry when leader is already registered
- Registered resource specifications contain: type=ground, trust_source=swarm_leader, trusted_by={leader_did}, coalition_national_did=did:near:bastion.testnet
- Capabilities derived from swarm role (follower→patrol+ISR, etc.) unless robot has own capabilities
- No registration attempt when leader is not in resource registry (leaderResourceId undefined check)
- Re-runs on subsequent swarm telemetry are no-ops (getByDID guard)
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/14-auto-register-ble-swarm-robots-via-leade/14-SUMMARY.md`
</output>
