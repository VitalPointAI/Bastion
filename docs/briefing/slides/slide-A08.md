# Slide A8: Robot Integration Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A8 of A17 (Annex)
**Maps to core slides:** 14 (Physical Autonomous Execution)
**Date:** 2026-03-26

## Style Reference

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary Blue | `#2563EB` | blue-600 | Headings, primary UI elements, architecture blocks |
| Sky Blue | `#0EA5E9` | sky-500 | Secondary accents, data flow lines |
| Cyan | `#06B6D4` | cyan-500 | Blockchain/crypto elements, DID references |
| White | `#FFFFFF` | white | All backgrounds |
| Light Gray | `#F8FAFC` | slate-50 | Slide background variant |
| Dark Text | `#0F172A` | slate-900 | Body text |
| Muted Text | `#64748B` | slate-500 | Captions, sub-labels |

**Rule:** Never use dark backgrounds. Never use tactical/military dark aesthetic. BASTION on the second screen provides the tactical visual; the deck is the clean analytical layer.

## Purpose

Full technical depth on the Docker bridge architecture, Python agent design, Jetson Orin Nano vision pipeline, and DAO-governed engagement chain.

## Visual

**Diagram 1: Three-Tier Architecture (detailed)**

```
TIER 1: CLOUD — BASTION Application
┌─────────────────────────────────────────────────────────────────┐
│  BASTION Frontend (React)  ←→  Backend (Node/TypeScript)        │
│  Ironclaw (Chief of Staff coordination)                         │
│  DAO Governance (proposal voting)                               │
│  Knowledge Graph (Neo4j)                                        │
│  DID Registry (NEAR smart contract)                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │  REST API + WebSocket (HTTPS / WSS)
                  │  (persistent connection, command queue)
                  │
TIER 2: BRIDGE — Docker Container (local network)
┌─────────────────┴───────────────────────────────────────────────┐
│  Docker bridge container                                        │
│  Python agent: receives commands from cloud                     │
│  Command proxy: validates, translates, forwards                 │
│  Authority check: confirms DAO authorization before forwarding  │
│  Status aggregator: collects telemetry from edge, reports up    │
│  Offline buffer: queues commands during DDIL conditions         │
└─────────────────┬───────────────────────────────────────────────┘
                  │  MQTT (pub/sub) + HTTP REST
                  │  (tolerant of DDIL, reconnects automatically)
                  │
TIER 3: EDGE — Jetson Orin Nano + RVR+
┌─────────────────┴───────────────────────────────────────────────┐
│  Jetson Orin Nano (compute)                                     │
│  ├── Computer vision pipeline (YOLOv8 inference)                │
│  ├── Object detection / classification                          │
│  ├── Threat identification (within ROE constraints)             │
│  └── Status reporting (telemetry, BDA)                          │
│                                                                 │
│  Sphero RVR+ (mobility platform)                                │
│  ├── Motor control (differential drive)                         │
│  ├── IR sensors (obstacle avoidance)                            │
│  └── Camera feed (to Jetson for vision processing)              │
└─────────────────────────────────────────────────────────────────┘
```

**Table: Six Doctrinal Swarm Formations**

| Formation | Visual | Tactical Purpose | When Used |
|-----------|--------|-----------------|-----------|
| Line | → → → | Maximum frontage coverage | Area clearance, screening |
| Wedge | ↗ → ↘ | Lead element with flank protection | Movement to contact |
| Column | ↑ ↑ ↑ | Minimizes exposure, maximizes speed | Movement through restricted terrain |
| Diamond | ↑ ← → ↓ | 360-degree security | Stationary security, uncertain threat |
| Echelon | ↗ ↗ ↗ | Oblique movement, mass on one flank | Flanking maneuver |
| Stagger | ↗↘↗↘ | Reduces vulnerability to linear threats | Movement under fire |

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
