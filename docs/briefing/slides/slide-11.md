# Slide 11: Smart Contracts as Policy Enforcement

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 11 of 25 (Core Deck)
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
First governing decisions slide. Show how NEAR smart contracts transform written policy into executable code. The concrete mechanism — the `check_employment_authorized()` function — proves this is implemented, not theorized. Plain language framing first: "Every enforcement decision is written into a permanent, tamper-proof record" before introducing the technical term "immutable audit trail."

## Visual Layout
Left side (45%): Title "Policy as Code — Not Paper" in blue (#2563EB), 24pt. Below: a flow diagram (see Diagram Spec) showing the enforcement chain. Right side (55%): A code reference block showing the `check_employment_authorized()` function with its five caveat checks. Below the code block: three capability points:
- "Immutable audit trail — every enforcement decision permanently recorded on NEAR blockchain — cryptographically tamper-proof"
- "Automatic enforcement — no operator can override a smart contract gate; the mathematics of the blockchain enforce it regardless of intent or urgency"
- "Coalition verification — coalition partners can verify any enforcement decision independently without trusting BASTION's word"

## Image Prompt
No AI image — code reference and diagram carry the argument.

## Diagram Spec
Left panel flow diagram (vertical):

1. **Policy Decision** [blue block #2563EB] — "Commander authorizes: asset employed only within Pacific AOR, classification SECRET, FVEY releasable"
2. Arrow down ↓ [cyan #06B6D4]
3. **Smart Contract** [cyan block #0EA5E9] — "check_employment_authorized() called at execution time"
4. Arrow down ↓ [cyan]
5. **Five Caveat Checks** [nested gray block #F8FAFC with five sub-rows]:
   - "Classification level — asset is SECRET → requester must hold SECRET"
   - "Releasability — asset is FVEY only → requester must be FVEY partner"
   - "ROE tier — asset requires Tier 3 authority → requesting action must have Tier 3 approval"
   - "Geographic bounds — asset limited to Pacific AOR → action must be within bounds"
   - "Time window — asset valid until 0600Z → action must be within time window"
6. Arrow down ↓ [cyan]
7. **Result** [two branches]:
   - [Green #16A34A block] "AUTHORIZED — execution proceeds"
   - [Red #DC2626 block] "DENIED — reason logged on-chain"
8. Arrow down to both ↓ [cyan]
9. **Immutable Audit Log** [cyan block #0EA5E9] — "NEAR blockchain — permanent record"

Right panel: code reference display (monospace font, gray #F8FAFC background, 10pt):
```
check_employment_authorized(
  resource_id: ResourceId,
  requester_did: DID,
  action_context: ActionContext
) → Result<bool, CaveatError>

Checks:
• Classification ≤ requester clearance level
• Releasability includes requester's nation
• ROE tier ≤ authorized action tier
• Action location within geo_bounds
• Current time within time_window

All decisions logged to NEAR ledger
— tamper-proof, permanent, auditable
```

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
