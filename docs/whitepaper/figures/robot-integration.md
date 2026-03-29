# Figure: Robot Integration Architecture

## Diagram Type

Three-layer horizontal architecture diagram showing Cloud → Bridge → Edge connectivity for BASTION's physical robot integration.

## Layout

**Orientation:** Landscape / left-to-right with three horizontal layers
**Target Dimensions:** 1400×900 pixels
**Export:** 300 DPI PNG for print

## Three Layers (Top to Bottom)

### Layer 1: Cloud (Blue  --  #3182ce background band)

**Components (left to right):**

1. **BASTION Backend**
   - Shape: Large rounded rectangle
   - Label: "BASTION Cloud Backend"
   - Internal modules shown as smaller boxes:
     - "Mission Queue"  --  stores pending robot missions
     - "WebSocket Server"  --  maintains bridge connections
     - "COP Layer Engine"  --  renders robot telemetry as map symbols
     - "Resource Registry"  --  DID-linked robot records

2. **DAO Governance**
   - Shape: Hexagon (governance symbol)
   - Label: "DAO Mission Authorization"
   - Badge: "NEAR Smart Contract"

### Layer 2: Bridge (Orange  --  #d69e2e background band)

**Components:**

1. **Docker Bridge Container**
   - Shape: Rectangle with Docker whale icon
   - Label: "Robot Bridge (Docker Compose)"
   - Internal modules:
     - "mDNS Scanner"  --  discovers robot agents on LAN
     - "Command Proxy"  --  relays commands from cloud to robot
     - "Telemetry Relay"  --  buffers and forwards robot status
   - Network badge: "Tactical LAN / WiFi"

### Layer 3: Edge (Green  --  #38a169 background band)

**Components (arranged as cluster):**

1. **Jetson Orin Nano** (primary, left)
   - Shape: Rectangle with GPU chip icon
   - Label: "NVIDIA Jetson Orin Nano"
   - Badge: "40 TOPS AI Inference"
   - Internal modules:
     - "Python Robot Agent"  --  main control software
     - "CSI Camera Interface"  --  1080p @ 30fps
     - "detectNet Pipeline"  --  real-time object detection
     - "ORB Feature Matcher"  --  visual re-identification
     - "Mission Intent Translator"  --  LLM + template fallback

2. **Sphero RVR+ Leader** (center, with star icon)
   - Shape: Circle with star
   - Label: "RVR+ Alpha (Leader)"
   - Badge: "Vision-equipped"

3. **Sphero RVR+ Followers** (right, two units)
   - Shape: Two circles
   - Labels: "RVR+ Bravo", "RVR+ Charlie"
   - Connected by UDP mesh arrows

4. **Formation Overlay**
   - Translucent wedge polygon connecting all three RVR+ positions
   - Label: "Wedge Formation"

## Connection Types

| Line Style | Meaning | Color |
|-----------|---------|-------|
| Solid thick | WebSocket (command/telemetry) | Blue (#3182ce) |
| Solid medium | mDNS discovery | Orange (#d69e2e) |
| Dashed | UDP broadcast (swarm mesh) | Green (#38a169) |
| Dotted with arrow | Vision data flow | Purple (#9f7aea) |

## Specific Connections

1. **Cloud ↔ Bridge:** Solid blue WebSocket line, bidirectional arrows, label "Outbound WebSocket (self-registration)"
2. **Bridge → Robot Agent:** Solid orange mDNS line, label "mDNS auto-discovery (_bastion._tcp.local)"
3. **Bridge ↔ Robot Agent:** Solid blue command/telemetry line, bidirectional
4. **Robot Agent → RVR+ Leader:** Solid line, label "Sphero SDK"
5. **Leader ↔ Followers:** Dashed green BLE lines, label "BLE Leader-Spoke Control (dead reckoning)"
6. **CSI Camera → YOLOv8:** Dotted purple line inside Jetson box, label "Vision Pipeline"
7. **detectNet → Telemetry Relay:** Dotted purple line, label "Detection Events (type, confidence, position)"

## Color Legend

| Color | Domain |
|-------|--------|
| Blue (#3182ce) | Cloud / BASTION backend |
| Orange (#d69e2e) | Bridge / network boundary |
| Green (#38a169) | Edge / physical robots |
| Purple (#9f7aea) | Vision pipeline data |
| Teal (#234e52) | Blockchain / DID |

## Key Labels (Use Actual Component Names)

- "robot/bridge/" directory → Docker Bridge
- "robot/agent/" directory → Python Robot Agent
- "detectNet" not "object detection model"
- "ORB feature matching" not "visual matching"
- "mDNS (_bastion._tcp.local)" not "network discovery"
- "did:near:resource-{id}" for robot DIDs
- Mission types: recon_area, visual_search, overwatch, resupply_route

## Cross-References

- Robot bridge architecture: See Section 3.14 in `03-methodology.md`
- Vision pipeline: See Section 2.4.6 in `02-background-robotics.md`
- Swarm formations: See Section 3.16 in `03-methodology.md`
- Resource DIDs: See Section 3.10 in `03-methodology.md`

---

*Figure specification for AI image generation. Use with Mermaid, Figma, or diagram tool.*
*Document version: 1.0  --  2026-03-23*
