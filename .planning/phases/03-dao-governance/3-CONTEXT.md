# Phase 3: DAO Governance - Context

**Gathered:** 2026-01-16
**Status:** Ready for planning

<vision>
## How This Should Work

DAOs in BASTION are mission-focused but expandable beyond missions. Each discrete project, capability development effort, or operational mission gets its own DAO with relevant stakeholders. For example, a capability DAO might manage development with military and industry partners, while a mission DAO governs tactical/operational decisions for a specific operation.

The system tracks linkages between DAOs through three mechanisms:
- **Hierarchical dependencies:** Parent DAOs spawn child DAOs, with decisions cascading down (strategic approval enables operational planning)
- **Resource sharing:** Members, assets, and authorities shared across projects (same coalition members participate in multiple DAOs)
- **Cross-DAO approvals:** Some decisions require approval from multiple DAOs before proceeding (e.g., strike requires both mission DAO and relevant authority DAOs)

The experience should feel intuitive and natural to military commanders and planners — not like enterprise software or crypto governance. Familiar patterns (proposals, voting, roles) but streamlined for military decision tempo where time-critical decisions can't wait 48 hours.

When a commander looks at a proposal, they see:
- Clear action required: what decision, who else must approve, deadline
- Full context chain: how this connects to strategic objectives and prior decisions
- Classification-aware view: only what their clearance allows, with appropriate redaction

AI agents participate with tiered trust levels — different agents have different authorities determining what they can approve autonomously. Strike authorization (lethal decisions) defaults to human-in-the-loop (not autonomous), but the system supports three configurable autonomy levels per proposal type:

- **Autonomous (human-out-of-the-loop):** AI/system can approve and execute within delegated authority
- **Semi-autonomous (human-on-the-loop):** AI can approve, human monitors with veto window
- **Not autonomous (human-in-the-loop):** Human must explicitly approve before execution

This flexibility enables commanders to adjust autonomy based on trust, consequence, and operational tempo while defaulting to maximum human control for lethal decisions.

</vision>

<essential>
## What Must Be Nailed

All three are essential — they form an interconnected foundation:

1. **Strike authorization flow** — Human-in-loop approval for lethal decisions with auditable blockchain record. This is the core demo scenario and the reason BASTION exists.

2. **Coalition membership management** — Managing who's in which DAO with proper clearance verification. Foundation for all governance decisions.

3. **Flexible DAO creation** — Ability to spin up new DAOs for missions/capabilities easily. Enables the expandable vision beyond single-mission governance.

The voting mechanism must be modular to accommodate:
- Time-critical vs deliberate decisions (strike vs policy)
- Consequence-based rigor (higher stakes = more approvals)
- Coalition complexity (single-nation vs unanimous agreement)

</essential>

<boundaries>
## What's Out of Scope

- **Cross-chain DAOs** — NEAR only for v1; multi-blockchain governance deferred
- Full treasury management (token funding, bounties, payments) if it adds complexity — focus on authorization over finance

Complex voting mechanisms (quadratic, conviction, delegation chains) are NOT out of scope — the modular design should support plugging these in, even if v1 uses simpler weighted voting by default.

</boundaries>

<specifics>
## Specific Ideas

- AstroDAO-style familiarity: proposals, voting periods, role-based permissions as the base
- Transparent audit focus: every decision fully traceable on-chain — blockchain as source of truth for accountability
- Modular voting engine: different proposal types can use different mechanisms
- Clearance-integrated: proposals can have classification levels; visibility enforced
- AI participation with boundaries: tiered trust levels for AI agents
- Three autonomy levels: autonomous (human-out-of-loop), semi-autonomous (human-on-loop), not autonomous (human-in-loop)
- Strike auth defaults to human-in-the-loop but configurable per proposal type

</specifics>

<notes>
## Additional Context

The user emphasized that DAOs should not feel like "crypto governance" but rather like natural extensions of military decision-making processes. The familiarity should come from military command structures, not DeFi.

Strike authorization is the north star — everything else supports demonstrating configurable human control over lethal decisions in an automated planning system. The default is maximum human control, but the architecture must support the full autonomy spectrum.

The expandability to capability development DAOs (military-industry partnerships) suggests thinking beyond pure operational use cases from the start.

</notes>

<ai_governance_framework>
## AI Governance Framework

BASTION adopts the NEAR AI Governance Framework's three-dimensional progression model:

**Progressive Dimensions:**
- **Progressive Legibility:** Improve information about stakeholder preferences
- **Progressive Alignment:** Improve fidelity of agents to stakeholder preferences
- **Progressive Autonomy:** Grant more responsibility to agents as alignment improves

**Three Overlapping Phases:**
1. **Support (AI Assistants):** Agents support human decisions, minimizing cognitive cost
2. **Represent (AI Proxies):** Agents proxy human decisions, maximizing representation
3. **Organize (AI Leaders):** Agents make decisions and coordinate humans, maximizing intelligence

### Phase 3 AI Agents (Support Phase Focus)

For DAO Governance, prioritize these agent types from the Support phase:

**Core Support:**
- **Governance Copilot** — Embedded assistant that summarizes activity, explains proposals, guides users through voting processes
- **Proposal Screening Agent** — Screens proposals for clarity, completeness, adherence to templates; assists proposal authors and screening committees

**Decision Support:**
- **Simulation Agent** — Simulates system impacts of parameter changes, aids risk/benefit analysis for operational decisions
- **Personalized Decision Support** — Provides clearance-appropriate explanation of proposals tailored to commander's role/context

**Security:**
- **Governance Security Agent** — Monitors for proposal risks, coordination attacks, risky parameter changes
- **Code Audit Agent** — Automatically audits proposed code changes (for capability DAOs)

**Proactive Context:**
- **Context Gaps Agent** — Evaluates proposals against available intelligence, identifies gaps that might undermine effective decision-making

**Judgement:**
- **Feasibility Agent** — Evaluates operational feasibility, flags risks, conducts risk-benefit analysis grounded in doctrine and mission constraints

### Future Phase Agents (Represent/Organize)

Plan architecture to support later phases:
- **Digital Twins** for commander preference modeling
- **Agentic Rough Consensus** for coalition pre-deliberation
- **Flash Committees** for real-time context-matched decision groups
- **Accountability Agent** for tracking mission commitments
- **Role Manager Agent** for dynamic authority assignment

### Agent Trust Tiers

Map agent types to autonomy levels:
- **Support agents** → Semi-autonomous (human-on-the-loop) or Not autonomous (human-in-the-loop)
- **Represent agents** → Semi-autonomous with modular delegation
- **Organize agents** → Can be Autonomous within delegated authority boundaries

Strike authorization agents are always Support-tier with human-in-the-loop regardless of other trust factors.

</ai_governance_framework>

---

*Phase: 03-dao-governance*
*Context gathered: 2026-01-16*
