# BASTION Alignment Gap List

**Date:** 2026-03-28
**Purpose:** Identify gaps between the Briefing Narrative (authoritative), the Whitepaper (v0.3), the Docs Site, and the actual codebase — then define what must be built, fixed, or reconciled to achieve parity across all artifacts.

---

## Part A: Cross-Artifact Alignment Issues

These are discrepancies between the three written artifacts that must be reconciled.

### A1. AI Agent Count — Inconsistent Across All Three Artifacts

| Artifact | Claim |
|---|---|
| Briefing Slides 5, 6, 31 | "25 specialized AI agents" |
| Briefing Slide 32 | "16-agent architecture — 8 LangGraph + 7 COP + Ironclaw" |
| Whitepaper abstract | "131 AI agents — 31 specialized + 102 JPP staff role agents" |
| Whitepaper metrics table | "16 total deployed" |
| Docs site index | "19 specialized + 31 JPP staff" |
| Docs site AI overview | 131 agents (4 governance + 14 operational + 4 strategic + 7 graph + 102 JPP) |

**Resolution:** The "25 specialized" count from the briefing is the correct deployed count: 8 LangGraph analysis + 7 COP layer + 1 Ironclaw + 6 MDMP-specific (Assumption Auditor, Orders Validator, Uncertainty Quantifier, Data Bias Detector, Problem Framing, ROE Compliance) + 3 escalation/competition (Adversary Modeler, Escalation Modeler, Effect Cascader) = 25. The "16" was a stale count from before MDMP and escalation agents were tallied. The "131" includes 102 JPP staff role agents that are conceptually defined but not individually deployed as separate processes. All artifacts must adopt: **25 deployed specialized agents** (with the 102 JPP staff roles as a separate conceptual layer if mentioned at all).

**Action:** Update whitepaper abstract, metrics table, and conclusion. Update docs site index and AI overview.

### A2. Research Question Framing — Two Different Versions

| Artifact | Framing |
|---|---|
| Briefing (Slide 2) | "Can AI-augmented DAOs provide a **scalable, auditable, and institutionally legitimate** framework for human control over autonomous systems in multi-domain coalition military operations?" |
| Whitepaper (Section 1.6) | "How can interconnected, AI-augmented DAOs provide a **secure, transparent, and resilient** governance framework that enables effective C2, accelerates decision-making, optimizes resource management, and supports autonomous, policy-compliant coordination across diverse national and organizational boundaries?" |

**Resolution:** The briefing's three requirements (scalable, auditable, institutionally legitimate) are tighter and more defensible than the whitepaper's longer list. The whitepaper should adopt the briefing framing as the primary research question, or at minimum cross-reference both framings explicitly and show how they map to each other.

**Action:** Update whitepaper Section 1.6 to use the briefing's framing as the primary question. Map "secure → auditable," "transparent → institutionally legitimate," "resilient → scalable" to show equivalence.

### A3. Five-Tier Authority Model — Two Different Taxonomies

| Artifact | Taxonomy |
|---|---|
| Briefing (Slide 21) | **Echelon-based:** Tier 1 (Individual), Tier 2 (Team), Tier 3 (Organizational — min for engagement), Tier 4 (National DAO), Tier 5 (Coalition Strategic — 100% for strike) |
| Briefing (Slide 15) | **Interaction-based:** Human-Only, HITL, HOTL, ~~HOOTL~~, AI-Only Fully Delegated |
| Whitepaper (Section 3.5) | **MDMP-based:** AI_AUTONOMOUS, AI_PRIMARY, HYBRID_AI_LED, HYBRID_HUMAN_LED, HUMAN_ONLY |
| Docs site DAO structure | **Echelon-based:** Tier 1 (Commander), Tier 2 (Deputy/CoS), Tier 3 (Staff section), Tier 4 (Coalition partner), Tier 5 (Full coalition) |

**Resolution:** These are two complementary dimensions, not competing models. The **echelon-based** model (who has authority) and the **interaction-based** model (how human/AI collaborate on a given task) are both needed. The whitepaper and docs should present both explicitly and show how they compose: e.g., "A Tier 3 commander exercising HITL authority on a strike decision."

**Action:** Add a subsection to whitepaper Section 3.4 that presents both taxonomies and their composition. Update docs site DAO structure page.

### A4. AI-as-Infrastructure Paradigm — Missing from Whitepaper

The briefing narrative (Slides 9-18) makes a major conceptual argument that is entirely absent from the whitepaper:

- MDMP is a complex adaptive system, not a single cognitive activity (Slide 10)
- AI as persistent infrastructure vs. prompted tool — paradigm shift table (Slide 11)
- Infrastructure is invisible when functioning correctly — bucket vs. plumbing analogy (Slide 12)
- Oversight must become structural, not procedural — pipeline diagram (Slide 13)
- Continuous monitoring is not continuous command — pyramid diagram (Slide 14)
- The HOOTL fallacy: a bridge, not a destination (Slide 16)
- "Always on" planning — trigger event comparison (Slide 17)
- Authority assigned by task, enforced by design (Slide 18)

**Resolution:** This is the strongest conceptual contribution of the briefing and it needs to appear in the whitepaper. Add a new section (e.g., 3.4.5 "AI as Military Infrastructure") or expand the Discussion section to include this argument.

**Action:** Add content to whitepaper Section 3.4 or create new subsection. This is a significant writing task.

### A5. Whitepaper Version Metadata — Stale

| Field | Current | Should Be |
|---|---|---|
| Title page version | v0.2 | v0.4 |
| Title page date | 2026-03-23 | 2026-03-28 |
| Assembly version | v0.3 | v0.4 |
| Document history | Missing v0.3 and v0.4 entries | Add both |

**Action:** Update title page and assembly metadata.

### A6. Docs Site Metrics — Stale (pre-Phase 58)

| Metric | Docs Site | Current (Phase 58) |
|---|---|---|
| Completed phases | 53 | 58 |
| Total plans | 441+ | 469+ |
| AI agent roles | 19 + 31 JPP | 25 specialized (see A1) |
| Smart contract modules | 12 | 14 |

**Action:** Update docs site index.md metrics table.

### A7. "Direct" Tab Ghost File

The docs site has [direct-tab.md](docs/site/docs/capabilities/direct-tab.md) from a pre-Phase 24 naming convention. The tab was renamed to "Decide" in Phase 24/53. The briefing and whitepaper both use "Decide."

**Action:** Verify direct-tab.md redirects to or is replaced by decide-tab.md. Remove ghost file if redundant.

### A8. Briefing "25 agents" vs. "16 agents" Internal Contradiction

Briefing Slide 32 says "16-agent architecture" while Slides 5, 6, 31 say "25 agents." Since the briefing is authoritative and cannot change, the whitepaper should note both numbers with explanation: 16 is the core persistent agent count (8+7+1), 25 includes MDMP and escalation agents that activate during planning workflows.

**Action:** Whitepaper should explain both counts clearly in the metrics table.

---

## Part B: Briefing Narrative Claims vs. BASTION Implementation Status

These are capabilities the briefing narrative describes that may be missing, underdeveloped, or not yet implemented in BASTION.

### B1. IMPLEMENTED — Verified in Codebase/Whitepaper

| Briefing Claim | Status |
|---|---|
| 6-tab JP 5-0 doctrinal lifecycle (Understand/Design/Plan/Decide/COP/Assess) | Complete (Phase 24) |
| Knowledge graph brain with JSON-LD, entity resolution, NATO confidence | Complete (Phases 41, 47 partial) |
| Autonomous document intelligence (10-agent pipeline) | Complete (Phase 40) |
| DAO governance with on-chain voting and smart contract enforcement | Complete (Phase 3) |
| Five-tier MDMP authority model with safety matrix | Complete (Phase 5.1) |
| Three HUMAN_ONLY locked categories (authority, ethical, risk) | Complete (Phase 5.1) |
| Strike authorization 100% human approval invariant | Complete (Phase 3/5.1) |
| Resource registry with DIDs (did:near:resource-{id}) | Complete (Phase 27) |
| On-chain ResourceCaveats (classification, releasability, ROE, geo, time) | Complete (Phase 58) |
| check_employment_authorized() on-chain enforcement | Complete (Phase 58) |
| Robot bridge (Docker + Python agent + mDNS) | Complete (Phase 43) |
| Robot vision (detectNet + ORB on Jetson Orin Nano) | Complete (Phase 44) |
| Swarm formations (6 doctrinal) with BLE leader-spoke control | Complete (Phase 46) |
| Training/operational mode parity with EXERCISE banner | Complete (Phase 22) |
| Ironclaw Chief of Staff with 60s decision polling | Complete (Phase 30/53) |
| Ironclaw operational design coordination (4 JP 5-0 sections) | Complete (Phase 55) |
| Visual operational approach editor (MapOverlay + MIL-STD-2525D) | Complete (Phase 56) |
| Ironclaw persistent memory (user + context scopes) | Complete (Phase 57) |
| COP with AI-generated MIL-STD-2525D overlays | Complete (Phase 21) |
| Friendly/adversary perspective toggle on COP | Complete (Phase 21) |
| Phase slider for temporal COP exploration | Complete (Phase 21) |
| Operational design (CoG analysis, LOEs, problem framing) | Complete (Phase 25) |
| Design-to-plan handoff | Complete (Phase 49) |
| RACI-filtered decision dashboard in Decide tab | Complete (Phase 53) |
| Pacific Strategy AY26 seed scenario (6 phases) | Complete (Phase 39) |
| Passkey/WebAuthn authentication with NEAR implicit accounts | Complete (Phase 1.2) |
| MDMP governance gates (18 gates across 9 phases) | Complete (Phase 5.1) |
| Assumption lifecycle (Pending/Accepted/Invalidated + auto-replan) | Complete (Phase 5.1) |

### B2. PARTIALLY IMPLEMENTED — Narrative Claims That Exceed Current State

| Briefing Claim | Gap |
|---|---|
| "25 specialized AI agents" (Slides 5/6/31) | 16 core agents are deployed as persistent processes. The MDMP-specific and escalation agents (9 more) are defined architecturally but their deployment status as standalone persistent agents vs. on-demand workflow nodes needs verification |
| "Coalition partners can verify independently" (Slide 22/23) | DID registry is on testnet only (did.bastion.testnet). No mainnet deployment. Coalition partners would need testnet access to verify. |
| "DDIL-resilient operation" (Slides 12, 24) | Robot bridge caches mission state locally, but extended DDIL testing (>minutes of disconnection, reconnection reconciliation) has NOT been performed. Architectural intent, not validated capability. |
| "Six doctrinal swarm formations" with physical robots (Slide 24) | Formations implemented in code and demonstrated with 3 simulated platforms. Physical multi-robot demo with real hardware NOT yet completed (Phase 48 not started). |
| "Real-time position sharing" / ATAK/CoT interop mentioned as future | Phase 4.5 (ATAK/CoT) is NOT started. No tactical interoperability with fielded systems. |
| "TEE attestation" / "hardware root of trust" (Slide 27) | Designed in architecture, NOT implemented. Phala Network TEE integration is specified but not built. |
| "Zero trust" verification layers (Slide 27) | TEE layer and formal verification layers are designed, not built. The "five verification layers" described are aspirational architecture, not all implemented. |
| Ironclaw "remembers commander preferences across sessions" (Slide 28) | Memory stores exist but memory retrieval quality hasn't been validated at scale. No relevance decay mechanism — stale memories persist at full weight within TTL. |
| "Heterogeneous platforms — ground, aerial, fixed sensor" (future work mentioned) | Only Sphero RVR+ ground platform integrated. No aerial or fixed sensor platforms. |

### B3. NOT IMPLEMENTED — Capabilities Referenced That Don't Exist Yet

| Briefing Reference | Status |
|---|---|
| Multi-user concurrent planning (multiple staff officers simultaneously) | NOT tested. Single-user testing only. CRDT infrastructure exists (Yjs) but concurrent planning under load not validated. |
| Formal verification of DAO governance invariants | NOT started (Phase 65-66 roadmap). Smart contract invariants validated by testing only, not mathematically proven. |
| Production deployment / CI/CD | NOT started (Phase 17). System runs in development mode only. |
| Security audit / penetration testing | NOT performed. Acknowledged in briefing Slide 30 limitation 7. |
| Source-tier-aware confidence scoring | NOT implemented. All OSINT confidence hardcoded at 0.65 regardless of source type. Acknowledged in briefing Slide 30 limitation 3. |
| NEAR mainnet deployment | NOT done. All on-chain operations are testnet only. |
| Coalition multi-tenancy | NOT started (Phase 12/61-63). Single coalition instance only. |
| Problem set model rename ("workspace" → "problem set") | NOT started (Phase 23). UI still uses "workspace" terminology in some places. |
| BDA (Battle Damage Assessment) panel | NOT built. Noted in project memory as pending. |

---

## Part C: Briefing Narrative vs. Whitepaper Content Gaps

Conceptual content in the briefing that the whitepaper should develop but currently lacks.

### C1. "AI as Infrastructure" Argument (HIGH PRIORITY)

Slides 9-18 present the briefing's most original conceptual contribution. The whitepaper discusses graduated autonomy (Section 3.4) and MDMP governance (Section 3.5) but does NOT develop:

- The infrastructure vs. tool paradigm distinction
- The structural vs. procedural oversight argument
- The HOOTL fallacy thesis (bridge not destination)
- The "always on" planning concept
- The "authority assigned by task, enforced by design" principle

**Recommendation:** Add a new whitepaper section (3.4.5 or expand 5.4) that develops this argument. This is the briefing's most defensible academic contribution and its absence from the whitepaper is the largest content gap.

### C2. Echelon-Based Authority Tier Model

The briefing (Slide 21) presents authority tiers mapped to command echelons (Individual → Team → Organizational → National DAO → Coalition Strategic). The whitepaper presents authority tiers mapped to human-AI interaction patterns (AI_AUTONOMOUS → HUMAN_ONLY). Both exist in BASTION but the whitepaper doesn't present the echelon mapping.

**Recommendation:** Add echelon-tier mapping to whitepaper Section 3.4 alongside the existing interaction-pattern mapping.

### C3. Dynamic Authority Delegation

The briefing (Slide 21) describes time-limited authority delegations: "I authorize Tier 3 engagement authority for the next four hours in grid 12S." This is recorded on blockchain with expiration. The whitepaper mentions graduated autonomy but doesn't describe this specific time-bounded delegation mechanism.

**Recommendation:** Add to whitepaper Section 3.4 or 3.14.

### C4. Robot Authority Escalation Narrative

The briefing opens (Slide 1) with the robot pausing at an authority gate — the most dramatic moment. The whitepaper describes the bridge architecture technically but doesn't frame the authority escalation as dramatically.

**Recommendation:** Strengthen whitepaper Section 4.4 (Physical Demonstration) with the authority escalation narrative from Slide 1.

### C5. "Policy Documents Tell vs. Smart Contracts Enforce"

The briefing (Slide 23) makes the sharp distinction: "Policy documents tell machines what they should do. Smart contracts tell machines what they can do." The whitepaper discusses smart contract enforcement (Section 3.1, 3.24) but doesn't frame it this crisply.

**Recommendation:** Add this framing to whitepaper Section 3.1 (Policy Compliance by Design).

---

## Part D: Feature Development Gap List (Briefing → Full Parity)

Priority-ordered list of what must be built to make BASTION fully deliver on every briefing narrative claim.

### Priority 1 — Required for Honest Briefing Claims

| # | Gap | Briefing Reference | Effort |
|---|---|---|---|
| D1 | Verify all 25 agents are deployed and operational (not just architecturally defined) | Slides 5, 6, 31 | Medium |
| D2 | Physical multi-robot swarm demo with real hardware (3+ Sphero platforms) | Slide 24 | High — requires hardware |
| D3 | Source-tier-aware confidence scoring (replace hardcoded 0.65) | Slide 8, 30 | Medium |
| D4 | Extended DDIL testing (>5 min disconnection, reconnection reconciliation) | Slides 12, 24 | Medium |

### Priority 2 — Required for Credible Academic Defense

| # | Gap | Briefing Reference | Effort |
|---|---|---|---|
| D5 | Write "AI as Infrastructure" whitepaper section (Slides 9-18 argument) | Slides 9-18 | Medium (writing) |
| D6 | Reconcile research question framing across artifacts | Slide 2 vs. WP 1.6 | Low |
| D7 | Present both authority taxonomies (echelon + interaction) with composition | Slides 15, 21 | Low |
| D8 | Multi-user concurrent planning stress test | Slide 30 lim 2 | High |
| D9 | Security audit of smart contracts and API endpoints | Slide 30 lim 7 | High |

### Priority 3 — Required for Operational Credibility

| # | Gap | Briefing Reference | Effort |
|---|---|---|---|
| D10 | ATAK/CoT interoperability (Phase 4.5) | Future work | Very High |
| D11 | TEE attestation implementation | Slide 27 | High |
| D12 | NEAR mainnet deployment | Implied | Medium |
| D13 | Production CI/CD (Phase 17) | N/A | Medium |
| D14 | Coalition multi-tenancy (Phase 12/61-63) | Implied | Very High |
| D15 | Formal verification of governance invariants (Phase 65-66) | Slide 33 | Very High |

### Priority 4 — Enhancements for Complete Platform

| # | Gap | Briefing Reference | Effort |
|---|---|---|---|
| D16 | Problem set rename (Phase 23) | N/A | Low |
| D17 | Ironclaw memory relevance decay | Slide 28 | Medium |
| D18 | BDA panel for COP | N/A | Medium |
| D19 | Brain graph deletion/forget capability | N/A | Medium |
| D20 | Ironclaw mission awareness (COP/mission visibility) | N/A | Medium |
| D21 | Multi-user collaborative approach editing | N/A | Medium |
| D22 | Heterogeneous platform integration (aerial, fixed sensor) | Slide 24 future | Very High |

---

## Part E: Documentation Action Items

### Whitepaper v0.4 Updates Required

1. Update title page: v0.4, 2026-03-28
2. Update abstract: reconcile agent count to 25, align research question framing
3. Add document history entry for v0.3 and v0.4
4. Add "AI as Infrastructure" section (new Section 3.4.5 or Discussion subsection)
5. Add echelon-based authority tier taxonomy alongside interaction-based
6. Strengthen robot authority escalation narrative in Results
7. Add "policy tells vs. smart contracts enforce" framing
8. Update all metrics references (58 phases, 469+ plans, 25 agents, 14 contracts, ~572 endpoints)
9. Reconcile agent count throughout (abstract, methodology, results, conclusion, appendix)
10. Update ASSEMBLY.md version history

### Docs Site Updates Required

1. Update index.md metrics table (phases, plans, agents, contracts)
2. Update AI agent overview page (reconcile 131 → clarify 25 specialized + JPP staff concept)
3. Update architecture overview (reconcile agent count reference)
4. Remove or redirect direct-tab.md ghost file
5. Add decide-tab.md content if thin
6. Update DAO structure page with echelon-based tier model

---

*This gap list should be treated as a living document. As gaps are closed, mark them complete with date and phase reference.*
