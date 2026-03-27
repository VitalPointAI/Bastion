# Slide 20: Known Limitations

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 20 of 25 (Core Deck)
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
Academic honesty. What BASTION is NOT. A prototype is a claim about what is possible, not a claim about what is ready. Stating limitations explicitly is more credible — and more useful — than omitting them. This slide frames limitations as research agenda items: each is a known problem with a known solution pathway, not a discovered failure.

## Visual Layout
Title "Known Limitations" at top. Subtitle: "A prototype makes a claim about feasibility, not production readiness." Main content: numbered limitation list with severity context notes in a secondary column. Two-column layout: "Limitation" and "Context / Research Agenda." Seven rows. Clean table format matching Slide 19 style.

## Image Prompt
No AI image — the structured list is the primary visual.

## Diagram Spec
No diagram.

**Limitations Table:**

| # | Limitation | Context / Research Agenda |
|---|-----------|--------------------------|
| 1 | Research prototype — not production-ready | By deliberate decision. No attempt was made to harden for operational deployment. This is a proof of concept. |
| 2 | Demonstration scale only | Single exercise scenario (Pacific Strategy AY26), limited concurrent users. Multi-exercise and concurrent-user testing is a near-term research requirement. |
| 3 | AI reliability — LLM hallucination | Confidence scoring is nascent; OSINT confidence is currently hardcoded at 0.65 for all sources regardless of quality. Source-tier-aware scoring is a known gap. |
| 4 | Smart contract gas costs at operational scale | Unknown. The volume of governance transactions in a real operational planning cycle has not been modeled. Cost modeling is required before operational use. |
| 5 | Physical robot integration limited | Single-robot demonstration. Multi-robot swarm coordination is simulated in the COP but not physically executed. Real swarm operations require additional hardware and coordination protocol testing. |
| 6 | TEE attestation — design only | Hardware Trusted Execution Environment attestation is specified in the architecture but not yet implemented. The current system relies on software-level identity without hardware root of trust. |
| 7 | No formal security audit conducted | The system has not undergone penetration testing or formal cryptographic review. Security assumptions are architectural, not verified. |

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
