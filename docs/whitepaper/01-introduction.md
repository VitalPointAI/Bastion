# 1. Introduction

Modern military operations face an accelerating crisis of coordination. As adversaries develop capabilities to contest every domain simultaneously, the traditional model of hierarchical command and control (C2) strains under the weight of information overload, coalition complexity, and the imperative for rapid decision-making. This paper introduces BASTION (Blockchain Autonomous Strategy & Tactical Intelligence Operational Network), a novel framework that integrates AI-augmented Decentralized Autonomous Organizations (DAOs) with military command structures to address fundamental coordination challenges in coalition operations.

## 1.1 The Problem: Siloed Decision-Making in Coalition Operations

Systemic challenges hinder effective military and coalition operations, foremost among them siloed decision-making.[^intro1] Fragmented and stove-piped decision cycles, where branches, nations, or tactical units operate independently without cohesive governance and dynamic coordination, create costly delays. These delays are particularly acute at the operational level, where the gap between strategic intent and tactical execution determines mission success or failure.

Intelligence sharing exemplifies this dysfunction. Despite technological capabilities that could enable real-time information exchange, national policies and caveats continue to constrain intelligence sharing.[^intro2] A sensor operator in one nation may observe critical tactical information that could save lives in a partner nation's area of operations, yet classification restrictions, incompatible systems, and bureaucratic release authorities prevent that information from reaching those who need it. The result is critical gaps in situational awareness, eroded trust between coalition partners, and decision-making that proceeds at the speed of the slowest approval chain rather than the speed of relevance.

The lack of transparency and accountability compounds these issues. When resources flow through multiple national channels and decisions traverse complex approval hierarchies, commanders find it nearly impossible to track outcomes. Commanders struggle to answer basic questions: Which assets are available? Who authorized this action? What happened to the supplies we requested three weeks ago? This opacity wastes effort, duplicates requests, and generates friction that degrades the trust essential for coalition operations.[^intro3]

## 1.2 Why This Problem Matters

Coordination failure carries consequences that extend beyond operational inefficiency to strategic defeat. In contested environments where adversaries operate inside friendly decision cycles, the inability to coordinate rapidly across coalition boundaries directly threatens the ability to achieve objectives. Modern peer adversaries have studied Western coalition operations and explicitly designed their strategies to exploit coordination gaps.[^intro4]

The Russia-Ukraine conflict beginning in 2022 provides a contemporary case study. Coordinating support for Ukraine's defense required effort across dozens of nations, each with distinct approval processes, legal frameworks, and political constraints. Materiel donations that received approval in principle took weeks or months to reach the front lines. Training programs suffered from lack of visibility into what other nations were providing. Maintenance and sustainment chains fragmented across national boundaries. The coalition's aggregate capability far exceeded what it could effectively employ due to coordination friction.[^intro12]

These challenges will only intensify. Future conflicts will likely involve larger coalitions operating across multiple domains simultaneously. The speed of modern warfare, driven by autonomous systems, cyber operations, and hypersonic weapons, compresses decision timelines from hours to minutes. Coalition structures designed for deliberate planning processes cannot adapt to this tempo. Without new approaches to coordination, coalitions will find themselves outmaneuvered by more agile adversaries willing to accept greater centralization and risk.[^intro4]

## 1.3 Why This Problem Is Hard

Three fundamental sources of friction make military coordination resistant to traditional solutions: security requirements, trust deficits, and speed imperatives. These constraints often conflict, creating impossible tradeoffs that current systems cannot resolve.

**Security** requirements impose classification barriers that fragment information by design. Information classified at higher levels cannot flow to those without appropriate clearances. National caveats restrict sharing even among cleared personnel from partner nations. While these restrictions serve legitimate purposes, they create information silos that degrade collective situational awareness. Systems designed to enforce these restrictions often do so clumsily, blocking legitimate information sharing while providing insufficient protection against sophisticated adversaries.[^intro5]

**Trust** between coalition partners cannot be assumed and requires continuous verification. Partners need assurance that their contributions will be used as intended, that commitments will be honored, and that sensitive information will be protected. Traditional approaches to establishing trust rely on personal relationships, institutional reputation, and legal agreements. These mechanisms work poorly in ad hoc coalitions formed rapidly in response to emerging crises, where there may be no history of cooperation and insufficient time to build relationships through gradual exposure.[^intro13]

**Speed** requirements conflict directly with the deliberate processes that security and trust traditionally require. Human approval chains, while providing accountability, introduce latency that can exceed the relevant decision window. A multi-national approval process may consume more time than an engagement window allows, or more time than a developing threat permits for response. Systems that require human approval for every action cannot match the tempo of autonomous adversary systems operating without such constraints.[^intro6]

Centralized command and control structures, while familiar and proven in many contexts, are ill-suited to address these challenges simultaneously. Centralized C2 creates single points of failure vulnerable to disruption. It concentrates decision authority at echelons removed from tactical reality. It cannot adapt dynamically to disconnected, intermittent, limited bandwidth (DDIL) environments where communication with higher headquarters may be impossible for extended periods. Inefficient resource management compounds this, driven by poor visibility into available assets and real-time requirements across the coalition.[^intro7]

## 1.4 Why Previous Approaches Have Not Succeeded

Several significant initiatives have attempted to address military coordination challenges, yet each falls short of providing a complete solution.

**Joint All-Domain Command and Control (JADC2)** represents the U.S. Department of Defense's vision for connecting sensors and shooters across all domains.[^intro8] JADC2 focuses on technical interoperability, creating the "pipes" through which information can flow. However, JADC2 does not address governance: it can connect systems, but it does not determine who has authority to act, how decisions should be made, or how to verify that actions comply with policy. JADC2 enables coordination but does not provide the governance framework to manage it.

**NATO Federated Mission Networking (FMN)** provides a framework for coalition information sharing.[^intro9] FMN addresses interoperability through standardized interfaces and certification processes. However, FMN relies on a fundamentally centralized trust model where participating nations must trust the federation infrastructure and governance bodies. This works for established alliances with mature trust relationships but scales poorly to ad hoc coalitions or scenarios where some partners have limited trust in others. FMN also lacks mechanisms for autonomous policy enforcement; compliance depends on human implementers following documented procedures.

**Military AI systems** increasingly provide decision support for commanders, analyzing large datasets, identifying patterns, and recommending courses of action.[^intro10] These systems augment human decision-making but operate within existing command structures rather than transforming them. They do not address the fundamental governance challenges of coalition operations: who decides, based on what authority, with what verification. AI systems that recommend actions still require human commanders to navigate the same approval chains and coordination processes that create current delays.

**Commercial DAOs** have demonstrated the viability of decentralized governance for coordinating resources and decisions among parties who do not fully trust each other.[^intro11] Smart contracts encode rules that execute automatically, providing transparency and accountability without centralized control. However, commercial DAOs are designed for business contexts where the primary currencies are financial tokens and the tempo allows for extended deliberation. Military operations require different governance models that account for human authority over lethal decisions, policy compliance, classification constraints, and operational tempo measured in seconds rather than days.

Each of these approaches addresses part of the problem. None provides an integrated solution that combines connectivity (JADC2), coalition interoperability (FMN), intelligent analysis (military AI), and decentralized governance (DAOs) into a coherent framework suitable for military operations.

## 1.5 The BASTION Approach

This research proposes BASTION (Blockchain Autonomous Strategy & Tactical Intelligence Operational Network), a framework that integrates AI-augmented Decentralized Autonomous Organizations with military command and control structures. BASTION addresses coordination challenges through four key components working in concert.

**AI-augmented DAOs** provide governance structures that coordinate resources and decisions across organizational boundaries. Unlike commercial DAOs designed for deliberate token-based voting, BASTION's DAOs are architected for military tempo. AI agents augment human decision-makers by analyzing proposals, assessing risks, monitoring compliance, and executing routine decisions within delegated authority. Human commanders retain authority over significant decisions while AI agents handle the coordination overhead that currently consumes staff attention.

**Blockchain infrastructure** provides the transparency, immutability, and trust verification that coalition operations require. Every decision, resource commitment, and action is recorded in an append-only ledger that all authorized participants can verify independently. Partners can confirm that agreements are being honored without trusting any single authority to maintain records honestly. The blockchain serves not as a cryptocurrency platform but as a shared source of truth for coalition coordination.

**Smart contracts** encode policy constraints that execute automatically, ensuring compliance without requiring human verification of every action. National caveats can be expressed as code that governs how a nation's contributed resources may be employed. The system enforces classification rules automatically, preventing unauthorized disclosure while enabling maximum legitimate sharing. The system verifies rules of engagement computationally before actions are taken, providing confidence that operations remain within authorized boundaries.

**Five tiers of human authority** ensure appropriate human control over AI agent actions. BASTION assigns authority along two complementary dimensions. An echelon-based tier model maps authority to command structure:

- **Tier 1 (Individual):** Bounded personal scope; administrative actions only.
- **Tier 2 (Team):** Small unit coordination; no engagement authority.
- **Tier 3 (Organizational):** Commander-level authority; the minimum tier required for any autonomous engagement.
- **Tier 4 (National DAO):** Strategic resource commitments requiring national-level decision authority.
- **Tier 5 (Coalition Strategic):** Full coalition consensus; strike authorization requires 100% approval at this tier.

An interaction-based model governs how humans and AI collaborate on each planning activity, ranging from AI-autonomous execution (data aggregation, format validation) through hybrid collaboration to human-only authority (strike authorization, ethical judgments, risk acceptance). Three decision categories are permanently locked to human-only authority regardless of any configuration: authority decisions, ethical and legal judgments, and risk acceptance. These locks are immutable in the smart contract implementation.

A physical demonstration validates these concepts using tangible hardware. A Jetson Orin Nano edge computing platform and Sphero RVR+ robotic vehicle operate within a physical area of operations model, demonstrating DAO-coordinated autonomous target identification, resource selection, and effects delivery. This demonstration grounds theoretical contributions in observable system behavior, proving that BASTION's architecture can function in scenarios approaching real-world conditions.

## 1.6 Research Question

This research addresses the following question:

> **Can AI-augmented Decentralized Autonomous Organizations (DAOs) provide a scalable, auditable, and institutionally legitimate framework for human control over autonomous systems in multi-domain coalition military operations?**

That question has three specific requirements embedded in it. *Scalable* rules out approaches that work in a laboratory but collapse when twenty partner nations join the operation. *Auditable* rules out verbal authorization and policy documents; it requires cryptographic proof that authorized parties made decisions under applicable constraints. *Institutionally legitimate* rules out any architecture that asks commanders to surrender authority; it requires the architecture to enforce and record the authority structure that already exists.

Answering this question requires demonstrating that DAO-based governance can satisfy military requirements for security, accountability, and human control while providing benefits in speed, transparency, and resilience that traditional centralized approaches cannot match.

## 1.7 Contributions

This research makes the following contributions:

- **Novel integration of DAO governance with military C2:** This work is among the first to systematically apply decentralized autonomous organization concepts to military command and control, adapting commercial DAO patterns for the unique requirements of defense operations including classification constraints, national caveats, and human authority over lethal decisions.

- **AI agent augmentation of decentralized decision processes:** The research demonstrates how AI agents can enhance DAO governance by providing analysis, risk assessment, and autonomous execution within policy constraints, while maintaining appropriate human oversight through tiered authority levels.

- **Multi-level coordination framework spanning strategic, operational, and tactical levels:** BASTION provides a unified governance approach that functions consistently across military echelons, enabling seamless coordination from strategic resource allocation through tactical execution.

- **Physical proof-of-concept demonstration with edge AI and robotics:** Beyond theoretical analysis, this research includes a working demonstration using NVIDIA Jetson Orin Nano edge computing and Sphero RVR+ robotic platforms. The demonstration validates robot vision-enabled threat detection, doctrinal swarm formations (wedge, line, column, echelon, vee, staggered column), and DAO-coordinated mission assignment, proving the architecture's viability across software and hardware domains.

- **Semantic knowledge graph with adaptive brain visualization:** BASTION's JSON-LD knowledge graph captures entities, relationships, and confidence-scored intelligence chains across hierarchical problem sets. An adaptive neural canvas renders this graph as an interactive brain visualization, enabling analysts to explore semantic intelligence networks and temporal knowledge evolution.

- **Blockchain-anchored resource identity and training/operational governance parity:** A resource registry with Decentralized Identifiers (did:near:resource-{id}) treats military assets as first-class blockchain entities. A global training/operational mode toggle provides identical DAO governance in both exercise and operational contexts, enabling authentic "train as you fight" doctrine.

## 1.8 Development Scope and Version Note

This paper reflects BASTION capabilities as of Phase 60 (March 2026), encompassing 60 completed development phases since the initial architecture described in v0.1 (January 2026). Significant capabilities added since v0.1 include: the Decide tab with governance-gated decision dashboard and RACI matrix, the operational design workspace with Center of Gravity analysis, robot bridge integration with vision and swarm capabilities, adaptive knowledge graph brain visualization, resource DID registry with plugin architecture, training/operational mode toggle, hierarchical problem set inheritance with automatic context propagation, Ironclaw as Chief of Staff for operational design coordination, visual operational approach editor with MIL-STD-2525D symbology, Ironclaw persistent memory for adaptive advisory relationships, and on-chain resource DID caveats with coalition enforcement. Section 3.4.5 introduces a paradigm argument (AI as military infrastructure rather than prompted tool) that frames the authority design as an engineering constraint rather than a policy preference. The methodology and results sections document these capabilities; this version note provides temporal context for readers comparing this version to future releases.

## 1.9 Paper Organization

The remainder of this paper is organized as follows:

**Section 2 (Background)** provides foundation in three domains: Web3 technologies and DAOs, military coordination frameworks and challenges, and AI applications in defense. This section establishes the technical and operational context necessary to understand BASTION's design.

**Section 3 (Methodology)** describes BASTION's architecture, including the DAO governance structures, AI agent framework, blockchain infrastructure, and security mechanisms. This section explains the design decisions that enable BASTION to address the challenges identified in this introduction.

**Section 4 (Results)** presents the end-to-end coordination flow and demonstration outcomes. This section provides evidence that BASTION achieves its intended functionality and demonstrates the five-tier authority model in operation.

**Section 5 (Discussion)** analyzes BASTION's implications, limitations, and potential for future development. This section addresses risks, ethical considerations, and research directions that extend beyond the current work.

**Section 6 (Conclusion)** summarizes findings and their significance for military coordination in coalition operations.

**Appendix A** provides a detailed implementation status report for readers interested in technical depth.

---

[^intro1]: Aaron Luhning, "Strategic Research Requirement Project Proposal" (unpublished manuscript, August 2025).

[^intro2]: Joint Chiefs of Staff, *Multinational Operations*, JP 3-16 (Washington, DC: Joint Chiefs of Staff, March 1, 2019), II-7 to II-10, https://irp.fas.org/doddir/dod/jp3_16.pdf.

[^intro3]: Paulina Starski, "Accountability and Multinational Military Operations," Max Planck Institute for Comparative Public Law and International Law, SSRN (2018), https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3179459.

[^intro4]: Department of Defense, *2022 National Defense Strategy of the United States of America* (Washington, DC: Department of Defense, October 27, 2022), 4-6, https://media.defense.gov/2022/Oct/27/2003103845/-1/-1/1/2022-NATIONAL-DEFENSE-STRATEGY-NPR-MDR.PDF. See also Daniel Fata and Edward Lucas, "China-Russia Convergence in Foreign Information Manipulation and Interference," CEPA Comprehensive Report (2024), https://cepa.org/comprehensive-reports/sino-russian-convergence-in-foreign-information-manipulation-and-interference/.

[^intro5]: Mark Quantock and Robert Ashley, "Beyond NOFORN: Solutions for Increased Intelligence Sharing Among Allies," Atlantic Council Issue Brief (December 2023), https://www.atlanticcouncil.org/in-depth-research-reports/issue-brief/beyond-noforn-solutions-for-increased-intelligence-sharing-among-allies/.

[^intro6]: Johns Hopkins University Applied Physics Laboratory, "Enabling Military Decision-Making at Operational Tempo" (October 3, 2023), https://www.jhuapl.edu/news/news-releases/231003-enabling-military-decision-making-at-operational-tempo. See also Geneva Academy, "Artificial Intelligence and Related Technologies in Military Decision-Making" (2025), https://geneva-academy.ch/wp-content/uploads/2025/09/Artificial-Intelligence-And-Related-Technologies-In-Military-Decision-Making.pdf.

[^intro7]: Joint Chiefs of Staff, *Joint Operations*, JP 3-0 (Washington, DC: Joint Chiefs of Staff, January 17, 2017, Incorporating Change 1, October 22, 2018), I-1 to I-14, https://www.jcs.mil/Doctrine/Joint-Doctrine-Pubs/3-0-Operations-Series/.

[^intro8]: Department of Defense, *Summary of the Joint All-Domain Command and Control (JADC2) Strategy* (Washington, DC: Department of Defense, March 2022), 1-5, https://media.defense.gov/2022/Mar/17/2002958406/-1/-1/1/SUMMARY-OF-THE-JOINT-ALL-DOMAIN-COMMAND-AND-CONTROL-STRATEGY.pdf.

[^intro9]: NATO Allied Command Transformation, "Federated Mission Networking," accessed March 2026, https://www.act.nato.int/activities/federated-mission-networking/. See also NATO Allied Command Transformation, "FMN Factsheet" (Brussels: NATO, 2023), https://www.act.nato.int/wp-content/uploads/2023/05/Factsheet-fmn_03.pdf.

[^intro10]: Department of Defense, *2023 Data, Analytics, and Artificial Intelligence Adoption Strategy* (Washington, DC: Department of Defense, November 2, 2023), 8-16, https://media.defense.gov/2023/Nov/02/2003333300/-1/-1/1/DOD_DATA_ANALYTICS_AI_ADOPTION_STRATEGY.pdf.

[^intro11]: "A Review of DAO Governance: Recent Literature and Emerging Trends," *Journal of Corporate Finance* 91 (2025), https://ideas.repec.org/a/eee/corfin/v91y2025ics0929119925000021.html.

[^intro12]: Zuzana Hlav{\'a}{\v{c}}kov{\'a}, "Responding to Needs: Military Aid to Ukraine During the First Year After the 2022 Invasion," *Defence and Peace Economics* 35, no. 5 (2023): 661-678, https://www.tandfonline.com/doi/full/10.1080/14751798.2023.2235121.

[^intro13]: Joint Chiefs of Staff, *Multinational Operations*, JP 3-16, I-5 to I-8.
