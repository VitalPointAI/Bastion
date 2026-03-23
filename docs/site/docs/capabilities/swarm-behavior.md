# Swarm Behavior

> Doctrinal Formations, Movement Techniques, and Peer Mesh Coordination — Phase 46

## Purpose

Swarm Behavior enables multiple Sphero RVR+ ground robots to coordinate as a
tactical unit under DAO governance. A vision-equipped swarm leader receives
mission assignments from BASTION, translates them into formation commands, and
distributes them to follower robots over a UDP broadcast peer mesh. The swarm
operates in doctrinal formations drawn from joint ground movement doctrine,
providing a governance-bound demonstration of multi-robot autonomous coordination.

---

## Components

### Swarm Leader Concept

- One RVR+ is designated **swarm leader** — the only unit equipped with a CSI
  camera and vision pipeline (detectNet + ORB).
- The leader receives mission orders from BASTION via the Robot Bridge.
- The leader computes formation geometry and broadcasts position assignments to
  followers.
- Leader shares detection events with all swarm members via the peer mesh.
- If the leader loses contact with BASTION, it continues the last authorized
  mission within pre-set geographic and temporal bounds.

### Six Doctrinal Formations

Formation selection is based on mission type, threat axis, and terrain:

| Formation | Use Case | Geometry |
|-----------|----------|----------|
| **Wedge** | Default movement, all-around security | Leader at apex, followers rear-left/right |
| **Line** | Maximum firepower to the front | All robots abreast, perpendicular to direction of movement |
| **Column** | Road movement, depth for speed | Robots in single file behind leader |
| **Echelon Left** | Oblique movement, left flank protection | Stepped diagonal to the left |
| **Echelon Right** | Oblique movement, right flank protection | Stepped diagonal to the right |
| **Vee** | Observation and firepower to front and flanks | Inverted wedge, followers forward of leader |

Formation parameters include: interval (spacing between robots), reference
position (leader's current location and heading), and formation type. Followers
compute their target position geometrically relative to the leader.

### Four Movement Techniques

| Technique | Description |
|-----------|-------------|
| **Traveling** | Continuous movement, all robots advance simultaneously |
| **Traveling Overwatch** | Lead element advances, trail element overwatches then advances |
| **Bounding Overwatch** | Alternating movement — one element stationary while the other moves |
| **Successive Bounds** | Each element moves to the next bound point in sequence |

Movement technique selection balances speed versus security based on the threat
level conveyed in the mission order.

### UDP Broadcast Peer Mesh

- Robots communicate directly via **UDP broadcast** on the local tactical network.
- No central relay required for formation coordination — robots talk peer-to-peer.
- Broadcast messages include: robot ID, position, heading, speed, battery, and
  formation acknowledgment.
- Mesh operates independently of the cloud connection — formation integrity is
  maintained during connectivity loss.
- Heartbeat interval: configurable (default 1 second for formation updates).

### DAO-Driven Dynamic Swarm Membership

- Swarm membership is governed by the DAO — robots join or leave the swarm
  through governance proposals.
- Adding a robot to a swarm requires DAO approval (verifies the robot's DID,
  authorization level, and mission clearance).
- Removing a robot triggers graceful departure: the robot moves to a safe
  position before disconnecting from the formation.
- Swarm size changes trigger automatic formation recalculation.

### Leader Vision Sharing

- Detection events from the leader's vision pipeline (detectNet + ORB) are
  broadcast to all swarm members.
- Followers receive: detection class, confidence, estimated position, and
  timestamp.
- Shared detections feed into the COP layer via the telemetry relay — all swarm
  member positions and shared detections appear on the Common Operating Picture.

---

## Swarm Telemetry on COP

The COP tab renders swarm state in real time:

- **Per-robot markers** on the map with heading arrows.
- **Formation polygon overlay** connecting all swarm member positions.
- **Leader icon** distinguished by a star marker.
- **Detection event circles** showing where the leader's vision pipeline
  detected objects.
- **Swarm Telemetry Panel** (sidebar) showing per-robot battery, heading,
  speed, mission state, and leader camera thumbnail.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Authorizes swarm missions. Selects formation and movement technique. |
| **J3 Operations** | Manages swarm tasking. Monitors telemetry. Issues formation changes. |
| **J2 Intelligence** | Reviews shared detection data from leader vision. |
| **Robot Operator** | Physical setup. Joins robots to swarm. Monitors hardware health. |

---

## Doctrinal Reference

- **ADP 3-90**, Offense and Defense — Movement formations and techniques
- **ATP 3-21.8**, Infantry Platoon and Squad — Formation geometry
- **BASTION Phase 46**: Swarm Leadership and Doctrinal Formations
- See also: [Robot Bridge](robot-bridge.md) — Connectivity architecture
- See also: [Robot Vision](robot-vision.md) — Leader vision pipeline

---

*Part of the [BASTION Capability Tabs](/) documentation.*
