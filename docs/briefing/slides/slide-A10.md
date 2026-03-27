# Slide A10: Security Architecture Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A10 of A17 (Annex)
**Maps to core slides:** 17 (Verifiable Zero Trust)
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

Full technical depth on BASTION's five-layer verification model and the technologies at each layer.

## Visual

**Diagram: Five-Layer Verification Model (detailed)**

Concentric rings, center = verified action, working outward:

**Layer 1 (outermost): AI Advisory**
- Technology: LangGraph agent outputs with confidence scores
- Role: Recommends actions based on situational awareness and operational context
- Verification mechanism: Human review required before any consequential action
- Question answered: Is this recommendation coherent and contextually appropriate?

**Layer 2: DAO Governance**
- Technology: NEAR smart contracts (voting mechanism)
- Role: Collective authority validation — required votes at each tier
- Verification mechanism: On-chain vote tally, quorum check, time bounds
- Question answered: Has the appropriate authority structure approved this action?

**Layer 3: Smart Contract Policy**
- Technology: `check_employment_authorized()` in DID Registry contract
- Role: Per-resource rule enforcement — caveat check before employment
- Verification mechanism: Sequential caveat field checking, denial with reason code
- Question answered: Do the resource's caveats permit this specific action?

**Layer 4: Blockchain Proof**
- Technology: NEAR Protocol transaction history (immutable ledger)
- Role: Tamper-evident audit log of all governance decisions and caveat changes
- Verification mechanism: Public blockchain — verifiable by any party
- Question answered: Was this authorization actually granted, and when, by whom?

**Layer 5 (innermost): TEE Attestation** *(Design goal — not yet implemented)*
- Technology: Intel SGX/TDX, Phala Network (design concept)
- Role: Hardware-level verification that intelligence data originates from attested sources
- Verification mechanism: Remote attestation — cryptographic proof of execution environment
- Question answered: Was this intelligence generated in a trusted, unmodified environment?

**Four Questions Framework (mapped to layers)**

| Question | Answered By | Layer |
|----------|-------------|-------|
| Is the data authentic? | Blockchain proof + TEE (design) | Layer 4/5 |
| Is the device trusted? | TEE attestation (design) | Layer 5 |
| Is the operator authorized? | DAO governance + smart contract | Layer 2/3 |
| Is the action within bounds? | Smart contract caveats + ROE check | Layer 3 |

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
