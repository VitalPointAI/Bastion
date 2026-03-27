# Slide A13: Live Demo Script — Governance and Execution

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A13 of A17 (Annex)
**Maps to core slides:** 11-14 (governance, DIDs, autonomy)
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

Step-by-step guided walkthrough for the Decide tab and robot execution demo during Q&A.

## Visual

Same two-column format as A11-A12. Title: "DEMO: Governance, Authority, and Autonomous Execution"

## Demo Script (follow on second screen)

**Step 1 — Open the Decide tab**
Navigate to the Decide tab. This is the governance dashboard. "This is where decisions with operational or legal consequence are formalized."

**Step 2 — Show the decision dashboard**
Show the list of pending and completed governance proposals. Point out a completed proposal — show the vote tally, the timestamp, and the on-chain transaction link.

**Step 3 — Click the on-chain transaction link**
Open the NEAR testnet explorer link. Show the transaction record: who voted, when, the proposal details, the outcome. "This record cannot be altered. It is on the blockchain. If anyone asks 'who authorized this?' — this is the answer."

**Step 4 — Show the authority tier visualization**
Show the 5-tier authority structure visualization. Point out which tier the current operation falls under and what quorum is required. "The system enforces this automatically. A Tier 3 tactical commander cannot approve a Tier 1 theater action — the smart contract rejects the attempt."

**Step 5 — Navigate to Resources tab, show a resource with caveats**
Navigate to the Resources tab. Select a resource (robot or intelligence product). Show its DID and caveats. Point out the releasability array. "This resource is releasable to Five Eyes nations. The smart contract checks this before any agent or staff officer can access it."

**Step 6 — (If robot is physically present) Show robot execution**
Switch to the robot control view. Show the robot's current status, formation, and position. Issue a simple movement command. Narrate the authority check: "Before this command reaches the robot, it passes through the Docker bridge, which confirms the DAO authorization token is valid. Without that token, the bridge will not forward the command."

**Step 7 — (If robot is not present) Show the bridge log**
Open the Docker bridge container log. Show the authorization check event: command received, token validated, command forwarded. "The bridge is the enforcement point. It is always running, always checking."

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
