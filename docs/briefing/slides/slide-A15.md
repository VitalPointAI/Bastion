# Slide A15: Technology Comparison Matrix

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A15 of A17 (Annex)
**Maps to core slide:** 19 (Tradeoffs and Decisions)
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

Full detailed comparison tables for audience members who want to challenge specific technology choices.

## Visual

Four comparison tables, each covering a technology domain.

**Table 1: Blockchain Platform**

| Criterion | NEAR Protocol ✓ | Ethereum | Solana | Hyperledger Fabric |
|-----------|-----------------|----------|--------|--------------------|
| Transaction throughput | ~1,000 TPS | ~15 TPS | ~65,000 TPS | ~1,000-3,500 TPS |
| Transaction cost | ~$0.001 | $1-$50 | ~$0.00025 | Free (permissioned) |
| Account model | Human-readable, named accounts | Hex addresses | Hex addresses | Permissioned identity |
| Consensus | Nightshade PoS, sharded | PoS (post-Merge) | PoH + PoS | PBFT variants |
| Smart contract language | Rust / AssemblyScript | Solidity | Rust / C | Go / JavaScript |
| Network type | Public permissionless | Public permissionless | Public permissionless | Private permissioned |
| Coalition suitability | High (public verifiability) | High (same) | High (same) | Low (trust between partners) |
| Developer ecosystem | Growing, strong Rust tooling | Largest, most mature | Large, high performance | Enterprise-focused |
| **Why not chosen** | **CHOSEN** | High gas costs at scale | Stability concerns, centralization | Private = no external verifiability |

**Table 2: AI Orchestration**

| Criterion | LangGraph ✓ | LangChain | AutoGen (Microsoft) | CrewAI |
|-----------|-------------|-----------|---------------------|--------|
| Workflow model | Directed graph (stateful) | Chain/agent abstraction | Conversation-based agents | Role-based crew agents |
| State management | Explicit, persistent graph state | Limited, stateless by default | Shared conversation context | Shared crew state |
| Human-in-the-loop | First-class: explicit gate nodes | Plugin, not native | Plugin-level | Not native |
| Parallelism | Native: parallel graph branches | Possible but complex | Sequential default | Sequential default |
| Debugging | Visual graph inspection | Complex chain tracing | Conversation log | Basic |
| HITL gates for doctrine | Yes — designed for it | Workaround required | Workaround required | Not supported |
| **Why not chosen** | **CHOSEN** | No native HITL, less suited | Conversation model wrong for staff process | Simpler but less control |

**Table 3: Storage Architecture**

| Criterion | Hybrid (PostgreSQL + NEAR) ✓ | Pure On-Chain | Pure Off-Chain (DB only) |
|-----------|------------------------------|---------------|--------------------------|
| Operational data speed | Fast (PostgreSQL) | Slow (blockchain latency) | Fast |
| Governance integrity | Blockchain-enforced | Blockchain-enforced | Trust the operator |
| Storage cost | Low (off-chain data) | High (on-chain per KB) | Low |
| Coalition verifiability | Yes (governance on-chain) | Yes (all on-chain) | No (trust the operator) |
| Data privacy | Off-chain data private | All data public | Data private |
| Scalability | High | Limited | High |
| **Why not chosen** | **CHOSEN** | Cost and privacy prohibitive | No external verifiability |

**Table 4: Identity Standard**

| Criterion | W3C DIDs ✓ | OAuth 2.0 / OIDC | SAML 2.0 | CAC/PKI |
|-----------|------------|------------------|----------|---------|
| Self-sovereign | Yes — owner controls | No — IdP controls | No — IdP controls | Partial — CA controls |
| Coalition interoperability | Yes — any DID resolver | Requires federation | Requires federation | PKI bridge required |
| On-chain integration | Native | Not designed for | Not designed for | Not designed for |
| Caveat storage | Native (DID Document) | Not applicable | Not applicable | Certificate extensions |
| Human-readable IDs | Yes (NEAR account-based) | Yes (email-based) | Yes (email-based) | No (hex cert fingerprints) |
| Revocation | On-chain, immediate | Token expiry + revocation list | Short-lived assertions | CRL/OCSP |
| **Why not chosen** | **CHOSEN** | No on-chain integration | No on-chain integration | PKI bridges fragile in coalition |

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
