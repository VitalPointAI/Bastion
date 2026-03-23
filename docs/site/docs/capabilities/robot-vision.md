# Robot Vision

> CSI Camera Integration, Object Detection, and Mission Behavior Profiles — Phase 44

## Purpose

Robot Vision gives ground robots the ability to perceive their environment and
translate tactical mission intent into autonomous behavior. A CSI camera connected
to the Jetson Orin Nano feeds a real-time detection pipeline using NVIDIA GPU
acceleration. Mission commands from BASTION are interpreted by an LLM-based intent
translator, mapped to one of four vision-enabled mission types, and executed with
sweep path planning and pre-flight constraint validation.

The human commander retains authority: missions are approved in BASTION before
the robot acts, and DID-linked constraints govern what any given robot is permitted
to do.

---

## Components

### CSI Camera Integration (Jetson Orin Nano)

- **CSI interface** directly connects the camera to the Jetson image signal processor,
  achieving lower latency and higher throughput than USB cameras.
- Supports 1080p at 30fps (configurable).
- Frames are processed on-device using NVIDIA CUDA acceleration — no cloud round-trip
  required for detection.
- Camera orientation and field of view are configurable per robot platform.

### NVIDIA detectNet Real-Time Object Detection

- **detectNet** is a deep learning detection network optimized for the Jetson
  hardware accelerator (Tensor Core / DLA).
- Pre-trained on common object classes; fine-tuned on mission-relevant categories:
  vehicles, personnel, structures, equipment.
- Outputs bounding boxes, class labels, and confidence scores per frame.
- Detection results feed both local mission execution (path replanning) and the
  telemetry relay to BASTION (cloud situational awareness).
- Configurable confidence threshold — only detections above threshold trigger events.

### ORB Feature Matching for Visual Recognition

- **Oriented FAST and Rotated BRIEF (ORB)** feature matching for object re-identification.
- When the robot has previously observed a target, ORB matching confirms re-encounter
  even under viewpoint or lighting changes.
- Supports persistent target tracking across a mission: the robot knows when it
  returns to a previously seen object or location.
- Computationally efficient — runs in parallel with detectNet without performance
  degradation.

### Mission Intent Translation

Commands from BASTION arrive as natural-language or structured directives. The
robot agent translates them to executable mission parameters:

- **LLM-based translation (primary)**: A local language model parses the command
  and maps intent to mission type and parameters (target area, priority, ROE flags).
- **Template fallback**: If the LLM is unavailable or confidence is low, structured
  command templates provide deterministic translation for common mission types.
- Translation output includes: mission type, area polygon, sweep pattern, detection
  triggers, and abort conditions.

### Pre-Flight DID Constraint Validation

Before any mission executes, the robot agent validates against the resource's
DID-linked constraints (recorded on NEAR blockchain):

- **Authorized mission types**: Which of the four mission types this robot is
  cleared for.
- **Geographic boundaries**: Geofenced areas within which the robot may operate.
- **ROE compliance**: Conditions under which the robot may approach detected objects.
- **Coalition authority**: Whether the tasking authority is authorized to direct
  this specific robot.

Missions that fail constraint validation are rejected and the failure is reported
to BASTION with the specific constraint violated. The commander must update the
DID-linked authorization or reassign the mission to a cleared robot.

---

## Vision-Enabled Mission Types

Four mission behavior profiles are implemented:

### 1. Recon Area

- Robot navigates a defined polygon, performing systematic sweeps to photograph
  and detect objects within the area.
- detectNet runs continuously, reporting all detections with location estimates.
- Sweep pattern: boustrophedon (lawnmower) for maximum coverage.
- On completion: full detection log and frame captures are uploaded to BASTION.

### 2. Visual Search

- Robot searches for a specific target class (vehicle, person, structure) within
  an area.
- Terminates when the target is detected above confidence threshold.
- ORB matching confirms target identity if a reference image is provided.
- Reports position and visual evidence to BASTION immediately on detection.

### 3. Overwatch

- Robot holds a static or slowly-moving position and monitors a defined area.
- Triggers alerts to BASTION on detection of specified target classes.
- Duration: indefinite until recalled or battery threshold reached.
- Frame captures attached to alerts for human review.

### 4. Resupply Route

- Robot navigates from origin to a waypoint while monitoring the route for
  obstructions or threats.
- detectNet flags potential route obstructions; robot pauses and reports.
- If route is clear, robot proceeds to waypoint and reports arrival.
- Designed for autonomous logistics movement in permissive environments.

---

## Sweep Path Planning

For area-coverage missions (Recon Area, Overwatch perimeter):

- **Boustrophedon sweep**: Alternating parallel passes covering the full area
  polygon with configurable overlap.
- **Adaptive spacing**: Track spacing adjusts based on camera FOV and required
  detection resolution.
- **Obstacle replanning**: If an obstacle is detected mid-sweep, the robot
  replans remaining tracks around the obstruction.
- Completed coverage is tracked and reported to BASTION as a percentage.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Authorizes mission types via DID constraint update. Reviews detection reports. |
| **J3 Operations** | Assigns missions. Reviews mission results and detection logs. |
| **J2 Intelligence** | Reviews detection imagery and location data for intelligence fusion. |
| **Robot Operator** | Configures camera, tunes detection thresholds, manages hardware. |

---

## Data Flow

```
BASTION Mission Command
        |
        v
  Mission Intent Translation
  (LLM + Template Fallback)
        |
        v
  Pre-Flight DID Constraint Validation
        |
        v
  +-----------------------------+
  | Mission Execution           |
  | CSI Camera -> detectNet     |
  | ORB Feature Matching        |
  | Sweep Path Planning         |
  +-----------------------------+
        |
        v
  Detection Events + Telemetry
        |
        v
  Robot Bridge -> BASTION
  (COP symbols, intelligence feed)
```

---

## Doctrinal Reference

- **BASTION Phase 44**: Robot Vision and Mission Behavior Profiles
- See also: [Robot Bridge](robot-bridge.md) — Connectivity between BASTION and robots
- See also: [Swarm Behavior](swarm-behavior.md) — Multi-robot coordination

---

*Part of the [BASTION Capability Tabs](/) documentation.*
