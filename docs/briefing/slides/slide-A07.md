# Slide A7: DID Registry and Coalition Caveats Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A7 of A17 (Annex)
**Maps to core slides:** 13 (Every Entity Has an Identity)
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

Full technical depth on BASTION's DID specification, the five plugin types, on-chain vs. off-chain storage, and coalition information sharing.

## Visual

**Diagram 1: DID Lifecycle**

```
Resource/Person/Agent identified
        ↓
[DID Created]
  Format: did:near:{account_id}#{resource_suffix}
  Examples:
    did:near:bastion.testnet#resource-uav-1
    did:near:alice.near#personnel-alice
    did:near:docker-bridge.bastion.testnet#agent-ironclaw
        ↓
[DID Registered On-Chain]
  - DID Document stored in DID Registry contract
  - Owner account set (controls updates)
  - Public key associated
        ↓
[Caveats Attached]
  - ResourceCaveats struct written to chain
  - Classification, releasability, ROE tier set
  - Coalition nations noted in releasability array
        ↓
[In Operation]
  - Any authorization query references the DID
  - Smart contract returns caveats for enforcement
  - All queries logged in transaction history
        ↓
[Update Caveats]
  - Only owner account can update
  - Caveat version incremented
  - Change recorded as on-chain transaction
        ↓
[Decommission]
  - DID marked inactive in registry
  - Historical record preserved (immutable blockchain)
```

**Table: Five Plugin Types**

| Plugin Type | Examples in BASTION | DID Structure | Key Caveats |
|-------------|-------------------|--------------|-------------|
| Hardware | Robot (Jetson Orin Nano + RVR+), Sensor, Platform | `#hardware-{serial}` | ROE tier, geo bounds, operational window |
| Software | BASTION instance, Agent module, Planning workflow | `#software-{module}` | Classification level, authorized users |
| Personnel | Commander, Staff officer, Analyst, Liaison | `#personnel-{id}` | Clearance level, releasability to coalitions |
| Data | Intelligence report, OPORD, FRAGO, Assessment | `#data-{document_hash}` | Classification, originator nation, releasability |
| Composite | Joint task force (personnel + equipment + data) | `#composite-{group_id}` | Inherits most restrictive caveat from members |

**Diagram 2: Coalition Sharing Example (Five Eyes)**

```
USA generates intelligence document
  → DID: did:near:usa.bastion.testnet#data-intel-2026-04-001
  → Classification: SECRET
  → Releasability: ["USA", "GBR", "AUS", "CAN", "NZL"]

AUS requests access:
  check_employment_authorized("did:...intel-2026-04-001", "did:...aus-analyst", "READ")
  → Check: AUS in releasability array ["USA","GBR","AUS","CAN","NZL"] → TRUE
  → AUTHORIZED

UNKNOWN_NATION requests access:
  → Check: UNKNOWN_NATION not in releasability array → FALSE
  → DENIED (audit record written)
```

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
