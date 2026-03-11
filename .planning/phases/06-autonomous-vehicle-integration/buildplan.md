You are building a focused MVP for a DAO-governed robotics demo.

The goal is NOT to build a full swarm yet but enable the system to easily add or subtract other resources such as more robots or drones.

The goal is to prove this end-to-end control chain:

DAO mission intent
→ Bastion off-chain listener / gateway 
→ Jetson Orin Nano mission client on the alpha robot
→ Sphero RVR+ executes a simple deterministic behavior
→ robot sends status updates back

---

# 1. PRIMARY OBJECTIVE

Build a working prototype where a single “alpha” robot receives a high-level mission command derived from a DAO or smart-contract-driven source, executes that command locally on a Sphero RVR+, and reports mission state transitions back to a Bastion dashboard.

The system must be simple, reliable, explainable, and demoable within one week.

Success criteria:
- a mission command is created from the a problem set DAO on Bastion
- Bastion detects that command
- a Bastion service sends a normalized mission JSON to the alpha robot over Wi-Fi
- the Jetson Orin Nano receives the mission JSON
- the alpha robot maps the mission to a local robot action
- the Sphero RVR+ executes the behavior
- the robot reports status back:
  - accepted
  - executing
  - complete
  - failed
- Bastion agents update a COP layer and status dashboard for the rvr+
---

# 2. ENGINEERING PRINCIPLES

Follow these principles strictly:

1. Keep blockchain logic out of the real-time motion loop.
2. The DAO issues intent, not motor commands.
3. The Jetson is the edge mission brain.
4. The RVR+ executes local deterministic behaviors.
5. Use minimal moving parts.
6. Prefer scenario with military application but easily doable vice something overly clever and fragile.
7. Focus on making an end-to-end demo work and stub or simulate anything that threatens timeline risk.
8. Every component must be testable independently.

---

# 3. MVP SCOPE

## In scope
- one alpha robot only but easily expandable and scalable to hundreds or thousands
- Jetson Orin Nano mission client
- Sphero RVR+ local control
- Wi-Fi mission delivery
- Bastion off-chain listener / gateway
- mission JSON schema
- mission execution state machine
- basic status reporting
- simple logging
- safe stop behavior
- one or more deterministic robot missions

## Out of scope but planned for future
- multi-robot coordination but plan for it
- swarm task allocation but plan for it
- ROS 2 unless absolutely necessary
- SLAM
- autonomous mapping
- leader election
- peer-to-peer robot networking
- on-chain telemetry storage
- advanced cryptography beyond light signature or token validation
- high-rate sensor fusion
- computer vision unless extremely lightweight and already available

---

# 4. EXPECTED HARDWARE / ENVIRONMENT

Assume:
- 1 x Sphero RVR+
- 1 x Jetson Orin Nano mounted on or associated with the alpha robot
- Wi-Fi connectivity available
- development machine available for coding/testing
- Bastion which includs a NEAR-compatible DAO and smart contracts, if integration risk is high, a DAO event simulator is acceptable for the initial demo

Important design assumption:
The first milestone may use a mock/simulated DAO event issued by Bastion that mirrors the shape of the real DAO event. The system architecture must still preserve the correct interfaces so that real DAO integration can be swapped in later.  Intent is to be able to show how the DAO issues intent that the RVR+ follows and policies it is constrained by (authorities it has been delegated)

---

# 5. SYSTEM ARCHITECTURE

Implement the system as five logical components.

## Component A — Mission Source
This is either:
- Bastion DAO / smart contract event source from a problem set

Responsibility:
- originate mission intent

Output:
- raw mission request

## Component B — Bastion Based Gateway / Listener
Responsibility:
- detect DAO mission events or simulated equivalents
- validate/normalize them
- translate them into a clean mission JSON format
- deliver mission JSON to the alpha robot over local network
- receive robot status updates
- persist logs

Output:
- normalized mission JSON to alpha robot
- mission status records to logs / console / simple dashboard

## Component C — Alpha Mission Client (Jetson)
Responsibility:
- listen for incoming mission JSON
- validate message structure
- reject malformed or unauthorized messages
- map mission command to a local executable behavior
- manage mission lifecycle state
- invoke local RVR+ driver behavior
- publish status updates to gateway

Output:
- mission state transitions
- local execution logs
- calls to robot driver

## Component D — RVR+ Driver Layer
Responsibility:
- connect to Sphero RVR+
- execute simple motion routines
- expose a minimal action API to the mission client
- stop safely on timeout or error

Output:
- direct robot actuation

## Component E — Logging / Demo Visibility
Responsibility:
- make the demo observable
- provide clear evidence of:
  - command originated
  - command delivered
  - command accepted
  - robot moved
  - mission completed or failed

Output:
- console logs
- structured log file
- optional tiny web dashboard

---

# 6. RECOMMENDED TECH STACK

Use the simplest stack that can be built in a week.

## Preferred languages
- Extend Bastion (Typescript) for mission client and robot control
- Extend Bastion with Python or Node.js for gateway/listener

Default recommendation:
- Use Typescript and Python for both Bastion and Jetson side unless there is a strong reason otherwise

## Networking
Use one of:
- HTTP REST for simplest implementation
- WebSocket if bidirectional persistent updates are easier
- MQTT only if already familiar and quick to stand up

Default recommendation:
- HTTP POST for command delivery
- HTTP POST for status callbacks
or
- a very small WebSocket setup if easier for live demoing

## Persistence
- Bastion datbase or JSON logs is enough
- avoid heavy databases unless already available

## DAO integration approach
Priority order:
1. mock DAO event generator with the same payload shape as the intended real DAO call
2. real Bastion off-chain listener for actual NEAR contract/DAO events
3. do not block the project on difficult chain-event plumbing

---

# 7. MISSION MODEL

Design a very small mission schema.

## Required mission JSON format
```json
{
  "mission_id": "mission-001",
  "robot_id": "alpha",
  "command": "patrol_route_alpha",
  "params": {
    "speed": 50,
    "duration_sec": 10
  },
  "timestamp": "2026-03-11T12:00:00Z",
  "auth_token": "demo-token"
}