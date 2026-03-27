# Slide 17: Verifiable Zero Trust

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 17 of 25 (Core Deck)
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
Show BASTION's five-layer verification model and the four questions it answers. This is the architectural philosophy slide — not a capability demonstration, but a framework claim. The argument: zero trust in BASTION means mathematical verification, not written policy.

## Visual Layout
Title "Verifiable Zero Trust" at top. Left two-thirds: the five-layer concentric ring diagram (see Diagram Spec). Right one-third: four question callouts in a vertical stack, each as a numbered question:
1. Is this data authentic?
2. Is this device trusted?
3. Is this operator authorized?
4. Is this action within bounds?

Below the questions: a single declarative statement — "Trust terminates at math, not policy."

## Image Prompt
No AI image — see Diagram Spec.

## Diagram Spec
Five concentric rings, outermost to innermost, on a white background:

**Ring 5 (outermost) — "AI Advisory":** Thin ring in sky blue (#0EA5E9). Label: "AI Advisory — Flags anomalies, recommends actions, monitors compliance."

**Ring 4 — "DAO Governance":** Ring in blue (#2563EB). Label: "DAO Governance — Human decision gates on high-authority actions."

**Ring 3 — "Smart Contract Policy":** Ring in cyan (#06B6D4). Label: "Smart Contract Policy — Encoded rules, immutable enforcement, automatic check."

**Ring 2 — "Blockchain Proof":** Ring in dark blue (#1E3A8A). Label: "Blockchain Proof — Tamper-evident ledger, audit trail, independent verifiability."

**Ring 1 (innermost ring, not center) — "TEE Attestation":** Ring in slate (#475569). Label: "TEE Attestation — Hardware root of trust, device identity verified."

**Center circle — "Verified Action":** Small circle in blue (#2563EB). Label: "Verified Action" in white text.

Ring labels positioned outside each ring, connected by thin leader lines. Overall diagram is clean and minimal — white background, no shadows, flat design. Approximate diameter of full diagram: two-thirds of slide width.

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
