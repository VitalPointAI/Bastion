# Slide 14: Physical Autonomous Execution

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 14 of 25 (Core Deck)
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
Show the three-tier architecture that makes autonomous execution possible — cloud platform, Docker bridge agent, and edge robot — and explain why this architecture exists. The audience has watched the robot operate; now they see the engineering beneath it. This slide closes the loop on the opening demo.

## Visual Layout
Title "Physical Autonomous Execution" at top. Main content: the three-tier stack diagram (see Diagram Spec). Below the diagram, a single callout box: "DDIL-Resilient: bridge continues executing last-known orders when cloud connectivity is lost." At bottom right, a small annotation: "Phase 43-46 — Docker Bridge + Jetson Vision + Doctrinal Swarm Formations."

## Image Prompt
No AI image — see Diagram Spec.

## Diagram Spec
Three horizontally separated tiers connected by vertical bidirectional arrows:

**Tier 1 — Cloud (top):** Rectangle labeled "BASTION Platform" in blue (#2563EB). Sub-labels: "Agent Hub / LangGraph orchestrator," "DAO governance + authority delegation," "Mission orders + rules of engagement." Background: white, blue border.

**Tier 2 — Bridge (middle):** Rectangle labeled "Docker Bridge Agent" in sky blue (#0EA5E9). Sub-labels: "Python autonomy agent," "NEAR wallet (robot identity on-chain)," "DDIL state buffer," "Authority escalation handler." Background: white, sky-blue border.

**Tier 3 — Edge (bottom):** Rectangle labeled "Edge Robot (Jetson + Sphero RVR+)" in slate (#64748B). Sub-labels: "Camera vision pipeline," "Terrain-adaptive locomotion," "Six doctrinal swarm formations," "IMU + odometry." Background: light gray, slate border.

**Arrows:** Bidirectional arrows between Cloud↔Bridge and Bridge↔Edge. The Bridge↔Edge arrow is annotated "DDIL-resilient" in amber (#F59E0B). The Cloud↔Bridge arrow is annotated "Mission orders / DAO attestations." Arrow color: cyan (#06B6D4).

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
