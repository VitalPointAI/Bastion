# Slide A6: DAO Governance Mechanics Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A6 of A17 (Annex)
**Maps to core slides:** 12 (Democratic Governance of Force)
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

Full mechanics of the DAO proposal lifecycle, quorum rules, time constraints, and the strike authorization invariant.

## Visual

**Diagram 1: Proposal Lifecycle Flowchart**

```
Commander / Staff Officer submits Proposal
    ↓
[Proposal Created On-Chain]
  - Proposal type (personnel, mission, strike, etc.)
  - Requesting authority tier
  - Voting period duration (configurable per tier)
  - Required quorum percentage
    ↓
[Voting Period Opens]
  - Eligible voters notified (determined by tier membership)
  - Each vote recorded as immutable blockchain transaction
  - Running tally visible in real-time
    ↓
[Quorum Check at Deadline]
  ├── Quorum NOT reached → EXPIRED (proposal fails)
  └── Quorum reached → TALLY VOTES
        ↓
  [Simple Majority?]
  ├── No → REJECTED (audit record written)
  └── Yes → APPROVED
        ↓
  [Execute Proposal]
  - Smart contract executes associated action automatically
  - Audit record: who voted, how, timestamp, outcome
```

**Table: Quorum Rules by Tier**

| Tier | Name | Quorum | Voting Period | Example Action |
|------|------|--------|---------------|----------------|
| Tier 1 | Theater Command | 1 vote (senior commander) | 72 hours | Theater-level mission assignment |
| Tier 2 | Operational HQ | 3 of 5 eligible voters | 48 hours | Operational-level COA selection |
| Tier 3 | Tactical Command | 2 of 3 eligible voters | 24 hours | Tactical mission authorization |
| Tier 4 | Unit/Element | 1 vote (unit commander) | 12 hours | Unit-level task assignment |
| Tier 5 | Coalition | All contributing nations | 96 hours | Cross-national strike authorization |

**Special Rule: Strike Authorization Invariant**
Highlighted box: "Lethal strike authorization requires explicit affirmative vote at the responsible Tier. No agent, no automation, and no default can generate a strike authorization. The chain must be affirmative all the way down."

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
