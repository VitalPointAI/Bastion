# 3. Methodology

This section describes BASTION's architecture and the design principles that guide its implementation. The architectural decisions presented here directly address the gaps identified in Section 2: the lack of decentralized governance for military command and control, the absence of frameworks for multi-stakeholder AI coordination, and the need for policy-compliant autonomous execution with appropriate human authority positions. Each design choice is justified by how it enables effective coalition coordination while maintaining the transparency, accountability, and human control that military operations require.

## 3.1 Design Principles

BASTION's architecture rests on four foundational principles derived from the challenges identified in the background sections. These principles inform every architectural decision and ensure that technical capabilities align with operational requirements.

### Decentralization for Resilience

Modern military operations face adversaries who actively target command and control infrastructure. As described in Section 2.6, centralized C2 systems present attractive targets for electronic warfare, cyber attacks, and kinetic strikes. When a coalition's coordination depends on a single command post or network node, disrupting that node can paralyze operations across multiple nations' forces.

BASTION addresses this vulnerability through architectural decentralization. Rather than concentrating coordination logic in any single location, the system distributes governance across a network of nodes operated by coalition partners. Each partner retains the capability to participate in coordination even when communication with other partners degrades. The blockchain substrate ensures that when connectivity is restored, the system can reconcile state across previously disconnected nodes and continue operations from a consistent foundation.

This decentralized architecture directly addresses the DDIL (Disconnected, Degraded, Intermittent, Limited-bandwidth) challenges identified in Section 2.6. Forces operating in contested electromagnetic environments can continue to execute pre-approved missions using locally cached governance state. When they reconnect, the shared ledger records their actions, maintaining the audit trail and enabling reconciliation with broader coalition activities. No single point of failure exists that an adversary could target to disable coalition coordination.

### Transparency for Trust

Coalition operations require trust among partners who may have competing national interests, different operational doctrines, and varying levels of information sharing authority. As described in Section 2.7, building this trust through traditional means is time-consuming and may never fully overcome suspicions that partner nations are withholding information or pursuing hidden agendas.

BASTION provides transparency through blockchain's immutable audit trail. Every proposal submitted to the governance system, every vote cast, every resource allocation approved, and every mission authorized is permanently recorded with cryptographic proof of its origin. Coalition partners can verify for themselves that the system operates according to agreed-upon rules rather than relying on assurances from other partners.

This transparency operates across organizational boundaries. When multiple nations collaborate on a campaign, each nation's authorized representatives can observe how partner nations are voting, what resources they are committing, and whether approved actions are being executed. This visibility enables accountability without requiring any nation to cede control to a centralized authority. The shared ledger serves as a neutral, verifiable record that all parties can trust.

The audit trail also supports after-action review and learning. When coalition operations produce unexpected outcomes, the complete record of decisions enables analysis of what went wrong and how procedures can be improved. Attribution in disputes is straightforward: the blockchain records precisely who approved what, when, and under what circumstances.

### AI Augmentation for Speed

Section 2.8 identified the operational level as where the gap between strategic intent and tactical execution is most acute. Joint All-Domain Command and Control (JADC2) envisions accelerating decision cycles through sensor-to-shooter connectivity, but connectivity alone does not address the cognitive burden on human decision-makers who must process vast amounts of information and make timely decisions.

BASTION integrates AI agents at each level of the governance hierarchy to augment human decision-making. These agents analyze proposals, assess risks, and present recommendations in formats optimized for human comprehension. They can process intelligence from multiple sources, identify patterns that might escape human attention, and flag issues that require human judgment. By handling routine analysis and presentation, AI agents free human decision-makers to focus on the judgments that require human wisdom, creativity, and ethical reasoning.

Critically, AI augmentation in BASTION does not replace human authority. As described in Section 2.10, the appropriate relationship between humans and AI depends on the consequences of potential errors. BASTION implements graduated autonomy: AI agents may execute routine, low-consequence actions autonomously, while higher-consequence decisions require human approval at appropriate authority levels. The speed benefits of AI augmentation are realized within a framework that preserves human control over decisions with significant implications.

This approach addresses the tempo requirements of modern operations while maintaining the accountability that military command requires. Commanders retain authority over critical decisions but are not overwhelmed by routine matters that AI agents can handle within established policy constraints.

### Policy Compliance by Design

Section 2.7 identified national caveats and information sharing restrictions as significant constraints on coalition coordination. Each nation participates in coalitions subject to its own national policies regarding what information can be shared, what actions can be authorized, and what resources can be committed. These policies are not merely preferences; they are legal requirements that coalition systems must respect.

Traditional approaches to policy compliance rely on human review at each decision point to verify that proposed actions comply with applicable policies. This approach introduces delays and places the compliance burden on individuals who may not fully understand all applicable constraints. Errors in compliance can have serious diplomatic and legal consequences.

BASTION addresses this challenge by encoding policies directly in smart contracts that govern the system's operation. National caveats, information classification requirements, release authority rules, and operational constraints are expressed as executable code that the governance system enforces automatically. The system cannot approve proposals that violate encoded policies; resources subject to restrictions cannot be allocated outside their permitted uses; information can only flow to recipients authorized to receive it.

This approach provides several advantages. First, compliance is consistent: the same rules apply every time, without variation based on individual interpretation or oversight. Second, compliance is verifiable: coalition partners can examine the smart contract code to confirm that their policies are correctly encoded. Third, compliance is auditable: when questions arise about whether actions complied with policy, the blockchain record shows exactly what rules were in effect and how they were applied.

Smart contract policy enforcement is particularly valuable for bounded autonomy. AI agents can act within the bounds established by policy without requiring case-by-case human approval, because the policies themselves constrain what actions are possible. This enables speed where policy permits while ensuring that AI agents cannot exceed their authorized scope.

## 3.2 Architecture Overview

BASTION implements a layered architecture that maps to the military levels of warfare described in Section 2.6. This mapping ensures that the governance structure aligns with existing military organizational concepts while enabling novel coordination capabilities through blockchain and AI integration.

### Three-Tier DAO Structure

At the core of BASTION's architecture are three interconnected Decentralized Autonomous Organizations, each corresponding to a level of warfare. This structure ensures that governance mechanisms match the decision-making requirements at each level while enabling coordination across levels through well-defined interfaces.

**Strategic-Level DAO.** The Strategic DAO governs long-term objectives, resource allocation, and coalition membership. Decisions at this level correspond to the strategic level of warfare: determining which military objectives will achieve political ends, allocating resources among theaters, and establishing overall priorities. Coalition membership is managed through the Strategic DAO, with voting weights reflecting each nation's commitment and contribution to the coalition effort.

The Strategic DAO operates on longer time horizons, with proposals subject to extended deliberation periods that allow for thorough review and consensus-building among coalition partners. Supermajority thresholds ensure that strategic decisions reflect broad agreement rather than the preferences of a narrow majority. The immutable record of strategic decisions provides the foundation against which lower-level actions are evaluated for alignment with coalition intent.

**Operational-Level DAO.** The Operational DAO bridges strategic intent and tactical execution, coordinating campaigns and major operations across multiple tactical units. This level manages the AI agent orchestration that enables rapid analysis and recommendation generation, ensuring that agents operate within strategically approved parameters while supporting tactical decision-making.

Resource-to-objective mapping occurs at the operational level, translating strategic resource allocations into specific commitments to campaigns and operations. The Operational DAO monitors the state of resources and objectives, automatically generating proposals to the Strategic DAO when resource states require attention or when tactical results suggest strategic reassessment. This automated proposal generation accelerates the feedback loop from tactical execution to strategic planning.

AI agents at the operational level fuse intelligence from multiple sources, assess progress toward objectives, and identify risks or opportunities that may not be apparent at either the strategic or tactical level. Human operational commanders retain authority over significant decisions while benefiting from AI-augmented situational awareness.

**Tactical-Level DAO.** The Tactical DAO governs mission-specific decisions, asset coordination, and target identification within policy constraints. Decisions at this level must often occur in real-time or near-real-time, requiring different governance mechanisms than higher levels.

The system may approve tactical proposals through streamlined processes that enable rapid response while maintaining accountability. AI agents can execute pre-approved mission types within the bounds established by higher-level policy, with human authority required only for exceptions or high-consequence actions. The Tactical DAO records all actions for later review, ensuring that even rapid tactical execution leaves an auditable trail.

The interaction between human decision-makers and AI agents at the tactical level is calibrated to mission requirements. Routine coordination actions may proceed autonomously, while actions with significant risk or policy implications require human approval. Smart contract code explicitly defines the authority position for each decision type, ensuring consistent application across the coalition.

### Inter-DAO Communication

The three DAOs are not isolated; they communicate through well-defined interfaces that enable information flow in both directions. Strategic guidance flows downward as policy constraints and resource allocations that bound lower-level decision-making. Tactical and operational information flows upward as status reports and automatic proposals that inform higher-level planning.

Automatic proposal generation enables tactical and operational experience to influence strategic decisions without requiring manual escalation. When tactical resource expenditure reaches defined thresholds, the system automatically generates proposals to the Operational or Strategic DAO requesting replenishment or reallocation. When tactical results suggest that strategic objectives may not be achievable through current approaches, the system can flag the situation for strategic review.

Resource state monitoring provides real-time visibility into coalition capabilities across all levels. Strategic planners can observe the aggregate state of resources committed to campaigns; operational commanders can track resource availability for upcoming operations; tactical units can verify resource status before commencing missions. This shared visibility reduces the information gaps that impede effective coordination in traditional coalition operations.

Figure 1 illustrates the three-tier architecture, showing the relationships between DAOs, the AI agent layer, and the blockchain infrastructure that secures all transactions. The diagram indicates human authority positions at each level and the decision flow patterns that connect strategic intent to tactical execution.

### Mission Context Establishment

Before operational planning can begin, BASTION requires establishment of a mission context that defines the participants, command relationships, available resources, and operational boundaries. This setup phase translates the abstract governance architecture into a concrete operational configuration.

**Workspace Creation.** Each mission operates within an isolated workspace containing its own participant roster, command hierarchy, resource inventory, and geographic boundaries. Workspace isolation ensures that coalition members participating in multiple missions maintain appropriate separation of concerns, while cross-references enable coordination when missions overlap. Any authenticated organization member can initiate workspace creation, democratizing mission establishment while maintaining accountability through the blockchain audit trail.

**Participant Onboarding.** Mission participants join through two mechanisms: direct invitation from the organization roster for known members, and invitation links or codes for external participants. Both methods ultimately result in cryptographic identity verification through the NEAR Protocol identity layer. Upon joining, participants receive role assignments that govern their authorities within the mission context.

**Command Relationship Configuration.** BASTION implements the full spectrum of military command relationships described in Section 2.8.1: OPCON, TACON, ADCON, COCOM, and support relationships (DS, GS, GSR, R). Commanders configure these relationships through a visual editor that presents both organizational chart and matrix views. The system validates configurations, warning of circular command relationships or orphaned units while permitting overrides for non-standard situations. Critically, command relationships drive permission cascades: a commander automatically gains visibility into subordinate resources and activities based on the configured relationship type.

**Mission Lifecycle States.** Missions progress through defined lifecycle states: Planning, Active, Complete, and Archived. These states govern what actions are permitted and what visibility coalition members have. Planning state enables configuration changes; Active state locks critical settings while enabling operational execution; Complete state preserves the mission record while preventing further actions; Archived state removes the mission from active views while maintaining the immutable blockchain record for historical reference and accountability.

### Resource Management Architecture

Effective coalition coordination requires precise tracking of resources from initial contribution through operational employment to consumption and replenishment. BASTION's resource management architecture addresses the full resource lifecycle within DAO governance.

**Resource Catalog.** The resource catalog maintains a multi-tier taxonomy aligned with military logistics standards. Pre-built equipment databases provide common starting points for standard military equipment (vehicles, weapons systems, communications equipment), while organizations can extend the catalog with custom resource types. Each resource entry captures technical specifications, capabilities, certifications, and maintenance history, enabling AI agents to match resources to mission requirements automatically.

**Availability Tracking.** Resource readiness uses the standard FMC/PMC/NMC (Fully Mission Capable, Partially Mission Capable, Not Mission Capable) framework with reason codes that explain degraded states. This granular tracking enables planners to distinguish between temporarily degraded resources that may become available and resources requiring significant repair or replacement.

**Assignment Model.** BASTION implements the doctrinal resource assignment progression: Apportioned (identified for planning), Allocated (made available for use), and Assigned (placed under command). This progression enables planning to proceed before final resource commitments while maintaining visibility into expected versus actual resource availability. Smart contracts enforce transitions between assignment states, ensuring that resources cannot be double-committed and that only authorized commanders can effect assignment changes.

**Location Tracking.** Resources track their physical or logical locations through multiple data sources: device GPS feeds for mobile assets, last known positions from situation reports, and sensor fusion for best estimates when primary data is unavailable. Pipeline tracking enables visibility into resources in procurement or transit, with expected availability dates informing future planning.

**Consumables and Supply Points.** Expendable resources (ammunition, fuel, supplies) are tracked by supply point rather than individual item. Each supply point maintains quantity on hand, consumption rates, and replenishment status. When consumption crosses defined thresholds, the system automatically generates replenishment proposals through the inter-DAO communication mechanisms described above.

**Personnel Management.** Personnel form a distinct resource type with their own tracking requirements: qualifications, training currency, medical fitness, and duty status. Personnel are assignable to units and linkable to equipment resources (e.g., crew assignments). Readiness definitions are configurable per mission context, enabling commanders to specify what qualifications and currency levels constitute "ready" for their specific operational requirements.

## 3.3 Key Design Decisions

BASTION's architecture required numerous design decisions, each with alternatives that were considered and evaluated. This section documents the major decisions, the alternatives considered, and the rationale for the choices made. These decisions establish patterns that future development must maintain and provide context for understanding why the system operates as it does.

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| NEAR Protocol for blockchain | Ethereum, Solana, private blockchain | Developer-friendly contracts, high performance, native DID support |
| DAO-based governance | Traditional RBAC, centralized authority | Decentralized trust compatible with coalition structure |
| AI agent augmentation | Full automation, human-only processes | Balances operational speed with accountability |
| Smart contract policy encoding | Runtime policy evaluation | Immutable enforcement with complete audit trail |
| Three-tier architecture | Flat DAO, traditional hierarchical C2 | Maps directly to military levels of warfare |

### NEAR Protocol Selection

The choice of blockchain platform is fundamental to BASTION's capabilities. Three primary alternatives were considered: Ethereum, the most established smart contract platform; Solana, known for high transaction throughput; and private blockchain implementations that would restrict network participation to coalition members.

NEAR Protocol was selected for several conceptual advantages that align with BASTION's requirements. First, NEAR's sharded architecture provides the scalability necessary for military operations that may involve thousands of transactions representing tactical actions, intelligence updates, and resource state changes. The protocol can process transactions with finality in approximately two seconds, enabling near-real-time coordination without sacrificing the security guarantees that blockchain provides.[^meth9]

[^meth9]: NEAR Protocol, "Consensus," in *Nearcore Development Guide* (San Francisco: NEAR Foundation, 2024), https://nomicon.io/ChainSpec/Consensus.html.

Second, NEAR provides native support for decentralized identifiers (DIDs) and account abstraction, enabling the identity management capabilities essential for coalition operations. Coalition partners can maintain cryptographically verified identities without relying on centralized identity providers, addressing the multi-stakeholder coordination requirements identified in Section 2.7.

Third, NEAR's developer-friendly smart contract environment, using Rust and JavaScript/TypeScript, reduces the barriers to developing and maintaining governance contracts. This accessibility is important for military organizations that must maintain and audit critical systems over extended periods.

The decision to use a public blockchain rather than a private blockchain reflects a deliberate tradeoff. Private blockchains offer more control but sacrifice the resilience benefits of a globally distributed network. BASTION addresses classification and access control through encryption and access control layers rather than network isolation, maintaining the resilience of the public blockchain while protecting sensitive information.

### AI Agent Architecture

BASTION's AI agents follow a single-responsibility design pattern, where each agent performs one well-defined function rather than attempting to be a general-purpose assistant. This architecture was chosen over two alternatives: a monolithic AI system that handles all decision support functions, and a fully automated approach that removes humans from routine decisions entirely.

The single-responsibility pattern provides several advantages for military applications. First, it enables graduated trust: each agent can be evaluated, tested, and trusted independently based on its specific function. An agent that has proven reliable for logistics coordination can be granted greater autonomy in that domain without implying equivalent trust for intelligence analysis.

Second, single-responsibility agents are more explainable. When an agent makes a recommendation, understanding why requires understanding only that agent's limited scope rather than tracing reasoning through a complex multi-function system. This explainability supports the accountability requirements of military command.

Third, the pattern supports defense in depth. Multiple agents with different functions can cross-check each other's outputs, reducing the risk that a single point of AI failure leads to incorrect decisions.

Agent types in BASTION include facilitators that coordinate workflows and present information, analysts that process data and generate assessments, and executors that carry out approved actions within defined constraints. Each agent type has its own trust calibration, with executors subject to the strictest constraints and facilitators permitted the greatest autonomy for their coordination functions.

The NEAR AI Governance Framework, which defines phases of AI capability maturation (Support, Represent, Organize), informs how agent autonomy evolves over time.[^meth10]

[^meth10]: NEAR Foundation, "NEAR AI: User-Owned Artificial Intelligence," near.org/ai, 2025, https://near.org/ai.

### Security Architecture

BASTION's security architecture follows a zero-trust model appropriate for multi-stakeholder environments where no single organization controls all participants. Rather than assuming that participants within the coalition network are trusted, the system verifies every access request against the requestor's attributes, credentials, and the policies applicable to the requested resource.

Attribute-Based Access Control (ABAC) provides the flexibility necessary for coalition environments with complex, overlapping authorization requirements. Unlike Role-Based Access Control (RBAC), which assigns permissions based on predefined roles, ABAC evaluates access decisions based on attributes of the subject, resource, action, and environment. This approach can express policies such as "NATO SECRET information may be accessed by personnel with SECRET clearance from nations that are NATO members and have signed the applicable information sharing agreement."

The ABAC implementation encodes national caveats directly, enabling automatic enforcement of the information sharing restrictions that impede traditional coalition coordination. When a coalition partner specifies that certain information is "REL TO FVEY" (releasable to Five Eyes nations), the access control system automatically restricts access to personnel from the United States, United Kingdom, Canada, Australia, and New Zealand. These restrictions are enforced consistently across all access paths, eliminating the risk of inadvertent disclosure through unchecked channels.

Post-quantum cryptography considerations inform BASTION's cryptographic choices, recognizing that data protected today may face quantum computing threats during its classification lifetime. While current quantum computers cannot break modern encryption, the development of cryptographically relevant quantum computers could compromise data encrypted with today's algorithms. BASTION's architecture supports cryptographic agility, enabling transition to post-quantum algorithms as standards mature and implementations become available. NIST finalized three post-quantum cryptographic standards in August 2024: FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), and FIPS 205 (SLH-DSA), with a transition plan to deprecate quantum-vulnerable algorithms by 2035.[^meth11]

[^meth11]: National Institute of Standards and Technology, "Post-Quantum Cryptography," NIST Computer Security Resource Center, last updated 2024, https://csrc.nist.gov/projects/post-quantum-cryptography.

The security architecture treats classification as a first-class concern. Information objects carry classification metadata that travels with them through the system, enabling consistent enforcement of access controls regardless of where data is processed or stored. Sensitive data is encrypted at rest and in transit, with keys managed through a distributed key management system that does not rely on any single trusted authority.

## 3.4 Human Authority Integration

Maintaining appropriate human authority over AI-augmented decision-making is central to BASTION's design. Section 2.10 introduced the three standard authority positions from the human-machine teaming literature: Human-in-the-Loop (HITL), Human-on-the-Loop (HOTL), and Human-out-of-the-Loop (HOOTL). BASTION adopts these as a starting framework but extends them significantly. Section 3.4.5 argues that HOOTL is unstable as a permanent governance posture and that the three-position model lacks the granularity military planning requires. BASTION therefore implements two complementary authority dimensions: a consequence-based interaction model (described immediately below) and an echelon-based tier model (described at the end of this section). Together, these dimensions provide the five-tier authority architecture that governs all BASTION operations.

### Autonomy Levels by Decision Type

BASTION categorizes decisions according to their consequences and assigns appropriate autonomy levels. This categorization is encoded in smart contracts, ensuring consistent application across the coalition regardless of which nation's forces or systems are involved.

**High-Consequence Decisions** require Human-in-the-Loop (HITL) authority. These include strategic resource allocations, changes to coalition membership, modifications to governance rules, and any decision that could result in lethal effects. For HITL decisions, AI agents may analyze options, present recommendations, and prepare proposals, but no action occurs until a qualified human explicitly approves.

**Medium-Consequence Decisions** may operate with Human-on-the-Loop (HOTL) authority. The system can execute these decisions autonomously, but human operators monitor execution and can intervene to halt or modify actions. Examples include routine resource transfers within pre-approved allocations, standard operational coordination, and information sharing within established classification boundaries. HOTL authority enables operational tempo while maintaining human oversight.

**Low-Consequence Decisions** may operate with Human-out-of-the-Loop (HOOTL) authority for well-constrained scenarios. These include status reporting, routine logistics coordination, and execution of pre-approved tactical actions. Even for HOOTL decisions, all actions are recorded on the blockchain for later audit, and humans can retrospectively review agent actions and adjust autonomy levels if agents demonstrate unreliable behavior.

The categorization of specific decision types is itself a governance decision that can be adjusted through DAO proposals. If coalition partners determine that a certain class of decisions requires more human involvement, they can vote to change the autonomy level for that decision type. This flexibility enables the governance framework to evolve with operational experience.

### Strike Authorization as Special Case

One category of decision is treated as an inviolable special case: strike authorization involving lethal effects always requires Human-in-the-Loop approval, regardless of any other settings or configurations. This constraint is hardcoded in the system architecture, not merely a policy setting that governance processes could change.

The rationale for this constraint reflects both ethical principles and legal requirements. International discussions on autonomous weapons systems consistently emphasize the need for meaningful human control over lethal decisions.[^meth12]

[^meth12]: International Committee of the Red Cross, "ICRC Position on Autonomous Weapon Systems: Key Elements," ICRC, May 2021, https://www.icrc.org/en/document/icrc-position-autonomous-weapon-systems.

In BASTION's implementation, strike authorization proposals are routed through a separate approval pathway that requires explicit human votes. AI agents may prepare targeting recommendations, assess collateral damage estimates, and present relevant intelligence, but they cannot approve strikes and cannot be configured to do so. The smart contract logic enforces this constraint at the protocol level, making it impossible to bypass through configuration changes or software updates.

Furthermore, strike authorization requires supermajority approval and extended deliberation periods, providing multiple opportunities for human judgment to intervene. Every strike authorization decision is logged with special audit markers that enable retrospective review and accountability. This approach ensures that BASTION's AI augmentation enhances decision quality without eroding human control over the most consequential military decisions.

### Trust Earned Through Performance

AI agent autonomy is not static; it evolves based on demonstrated performance. Agents that consistently provide accurate analysis, make reliable recommendations, and execute actions correctly can be granted increased autonomy over time. Agents that produce errors, demonstrate bias, or behave unexpectedly have their autonomy reduced.

This graduated trust approach mirrors how military organizations develop confidence in subordinate units and personnel. Just as a newly assigned officer might receive limited initial responsibility that expands as they demonstrate competence, AI agents begin with minimal autonomy and earn greater latitude through reliable performance.

The system maintains performance metrics for each agent, tracking accuracy of predictions, quality of recommendations, and reliability of execution. Human reviewers periodically assess agent performance and can adjust autonomy settings accordingly. The system automatically reduces agents flagged for performance issues to HITL authority until human operators explicitly restore higher autonomy levels.

### Echelon-Based Authority Tiers

In addition to the interaction-based authority levels (HITL, HOTL, HOOTL), BASTION implements an echelon-based tier model that maps authority delegation to command structure:

| Tier | Scope | Engagement Authority |
|---|---|---|
| Tier 1 | Individual | Administrative only, bounded personal scope |
| Tier 2 | Team | Coordination only, no engagement authority |
| Tier 3 | Organizational | **Minimum for autonomous engagement**, commander-level |
| Tier 4 | National DAO | Strategic resource commitments |
| Tier 5 | Coalition Strategic | **100% approval required for strike authorization** |

These two dimensions compose: a Tier 3 organizational commander may exercise HITL authority on a strike decision while delegating HOOTL authority for routine reconnaissance within the same mission. Delegations are dynamic and time-bounded. A commander can grant expanded delegation for a limited mission window (e.g., "Tier 3 engagement authority for four hours in grid 12S"). That delegation is recorded on the NEAR blockchain with its expiration time and expires automatically.

## 3.4.5 AI as Military Infrastructure: The Conceptual Basis for BASTION's Authority Design

The preceding sections describe *what* BASTION's authority model enforces. This section explains *why* that design is necessary: the nature of AI's role in military planning, once it shifts from prompted tool to persistent infrastructure, demands authority enforcement through system architecture rather than procedural oversight. The conventional framing of "human vs. machine speed" is incomplete, and the standard three-position authority model (HITL/HOTL/HOOTL) does not map cleanly to operational reality. The five-tier model described in Section 3.4 is BASTION's response to both limitations.

### MDMP as Complex Adaptive System

Military Decision Making Process is not a single cognitive activity. It is a complex adaptive system containing categorically different components: intent and judgment at one end, deterministic computation and pattern extraction at the other. Both are essential. Neither is interchangeable with the other.

When all MDMP activities are treated as a single category requiring human oversight, two failures result. First, human-speed constraints are imposed on activities that are fundamentally computational, activities that degrade when a human is inserted into every cycle. Second, staff are exhausted on mechanical processing at the precise moment their cognitive capacity is needed for judgment. Treating deterministic computation and human intent as if they require the same level of oversight does not produce caution. It produces slowness, staff burnout, and something more dangerous: false confidence. A human who has signed off on a thousand automated constraint checks has not exercised meaningful judgment on any of them.

### The Infrastructure Paradigm

The conventional frame positions AI as an advanced tool: an assistant that waits for prompts, responds when asked, and produces probabilistic outputs that humans evaluate. BASTION operates on a different model: AI as persistent infrastructure.

| Dimension | Tool Model | Infrastructure Model |
|---|---|---|
| Persistence | Event-driven, responds when asked | Continuous, operates independently |
| Determinism | Probabilistic, varies by input | Deterministic within engineering constraints |
| Human role | Push: ask questions, assess outputs | Consume: validated baselines already prepared |
| Oversight | Procedural: human checks each output | Structural: constraints engineered into system |

The analogy is physical infrastructure. No one asks plumbing to move water; it is designed so water flows automatically within defined constraints. No one monitors electrical current in real time to ensure it follows code; breakers, load limits, and grounding prevent violations by design. Infrastructure reshapes the environment before the human arrives. When AI functions at infrastructure level, the staff is not pushing the system. The system is continuously preparing the staff.

### Structural vs. Procedural Oversight

This paradigm shift changes the nature of oversight. Procedural oversight places a human at the output end of a pipeline: every decision, every output must pass through that bottleneck. This feels like control. It is not control; it is a chokepoint that slows everything down while providing the illusion of governance.

Structural oversight embeds constraints at critical junctions within the system itself. The human's role shifts from reviewing every output to engineering the constraints correctly and engaging at genuine decision points. Structural oversight is faster, more robust, and more honest about where human judgment actually matters.

A single human reviewing every output is one fatigued person standing between the system and bad outcomes. Constraints engineered into the system are not fatigued. They do not have bad days. They do not miss the 437th output because the previous 436 were all fine.

### Continuous Monitoring Is Not Continuous Command

A critical distinction that most discussions of AI in military contexts collapse: continuous monitoring and command authority are fundamentally different functions. AI may continuously monitor readiness indicators, sustainment flows, adversary movement patterns, and CCIR-linked triggers. It may detect anomalies and generate alerts. But it does not decide whether the anomaly matters. It does not decide whether escalation risk is acceptable. Those remain exercises of command authority.

Continuous monitoring at infrastructure scale actually strengthens command. A commander who is not surprised by preventable data gaps (because the infrastructure has been tracking and flagging continuously) exercises better judgment at decision points. Monitoring is not a threat to command authority. It is what makes command authority more precise.

### The HOOTL Fallacy

Human-out-of-the-Loop has intuitive appeal as a stable governance posture. It is not stable. Two failure modes appear simultaneously in HOOTL systems. First, rubber-stamping: the volume and velocity of AI outputs make genuine assessment impossible, so the human approves because they cannot practically do otherwise. Second, delayed intervention: when something goes wrong, the monitoring human is not positioned to intervene before consequences occur. Both produce the same outcome: diffused accountability without genuine control.

HOOTL is a bridge, not a destination. It connects procedural judgment (requiring genuine human authority) with deterministic infrastructure (fully delegated). HOOTL exists as a transitional organizational posture: to build institutional trust in new systems, to enable coalition adoption at uneven paces, to manage early operational risk during fielding. Once trust and demonstrated performance warrant it, every task must graduate out of HOOTL, either upward into genuine human judgment or downward into full delegation. This is why Section 3.4's consequence-based model treats HOOTL as a transitional category rather than a permanent governance posture, and why BASTION's echelon-based tier model provides the finer-grained authority distinctions that the standard three-position framework cannot.

### Authority Assigned by Task, Enforced by Design

The core design principle that follows from this analysis: planning activities must either exercise human judgment or operate as fully delegated, rule-based infrastructure. There is no stable third category. Activities involving intent, risk acceptance, political consequence, or legal accountability belong to human authority. Activities that are deterministic, computational, or rule-based belong to fully delegated infrastructure. Inserting humans into the second category does not improve safety; it slows the system and produces the false confidence of nominal oversight.

BASTION operationalizes this principle. Smart contracts enforce authority boundaries as executable code, not as policy documents that an operator can override under pressure. The five-tier authority model maps human authority to decisions that require it. AI agent teams handle the computational substrate so human judgment operates at the level where it actually matters. Policy documents tell machines what they should do. Smart contracts tell machines what they can do; and when the contract says "no," the machine stops, regardless of what any operator wants.

## 3.5 MDMP Governance Integration

While Sections 3.2 through 3.4 describe BASTION's foundational architecture for DAO governance and human authority, operational military planning requires a more granular governance framework that maps to established doctrinal processes. The Military Decision Making Process (MDMP), as defined in Army doctrine for Theater Army (ASCC-level) planning, provides this structure. BASTION integrates MDMP governance directly into the DAO layer, extending the foundational architecture with formal phase progression enforcement, assumption lifecycle tracking, and a safety matrix that prevents authority violations at the smart contract level.

### Five-Tier Authority Model

Section 3.4 described BASTION's authority integration framework, including both the standard interaction-based positions (HITL, HOTL, HOOTL) and the echelon-based tier model. Section 3.4.5 argued that the standard three-position framework lacks the granularity needed for operational planning governance. Some activities require AI to lead analysis with human oversight, while others require humans to lead with AI assistance. The distinction between these cases is operationally significant.

BASTION extends the authority framework to five tiers that map more precisely to MDMP activity requirements:

| Authority Level | Description | Example Activities |
|----------------|-------------|-------------------|
| AI_AUTONOMOUS | AI executes without human involvement | Data aggregation, format validation, monitoring |
| AI_PRIMARY | AI leads with human oversight | Intelligence preparation, trend analysis |
| HYBRID_AI_LED | AI generates, human reviews before action | COA development, risk assessment |
| HYBRID_HUMAN_LED | Human leads with AI assistance | Mission analysis, commander's guidance |
| HUMAN_ONLY | Human decides, AI may present information | Strike authorization, ethical judgments, risk acceptance |

Three activity categories are permanently locked to HUMAN_ONLY regardless of any governance action: AUTHORITY_DECISION (decisions about who has authority to act), ETHICAL_LEGAL (judgments involving ethical or legal reasoning), and RISK_JUDGMENT (acceptance of risk to mission or force). These locks are immutable in the smart contract implementation, reinforcing the strike authorization invariant described in Section 3.4 with a broader class of decisions that require human judgment.

The five-tier model is enforced at the smart contract level. When an AI agent attempts to execute an activity, the contract verifies that the agent's authority level is permitted for that activity's category. The contract rejects transactions that violate the safety matrix before execution, providing defense in depth against both misconfiguration and adversarial manipulation of agent permissions.

### Governance Gate System

MDMP divides planning into nine phases, from Receipt of Mission through Transition. BASTION enforces phase progression through a governance gate system that prevents advancement until prerequisite conditions are satisfied. This enforcement addresses a common failure mode in military planning: pressure to skip steps or abbreviate analysis under time constraints.

Eighteen governance gates span the nine MDMP phases, organized into six gate types:

- **PhaseTransition gates** require completion of all mandatory products and analyses before advancing to the next MDMP phase.
- **ProductApproval gates** require human approval of key planning products (mission statement, commander's guidance, COA sketches, OPORD).
- **AuthorityCheckpoint gates** enforce human decision authority at points where AI analysis must yield to human judgment.
- **RedTeamGate gates** require that red team challenges achieve minimum completeness thresholds before COA approval.
- **CoalitionGate gates** require multi-party consensus from coalition partners at key decision points.
- **AssumptionGate gates** require explicit human acceptance of planning assumptions before they can inform subsequent analysis.

Each gate is implemented as a DAO proposal that must achieve the required approval threshold before the workflow engine permits phase advancement. This mechanism extends BASTION's existing proposal and voting infrastructure rather than introducing parallel governance mechanisms, maintaining architectural consistency while adding MDMP-specific enforcement.

### Assumption Lifecycle Management

Military planning relies on assumptions that may prove invalid as operations unfold. Traditional planning processes track assumptions informally, creating risk that invalidated assumptions continue to inform decisions. BASTION implements formal assumption lifecycle management through a dedicated smart contract.

Assumptions progress through three states: Pending (identified but not yet accepted), Accepted (explicitly approved by a human decision-maker through a DAO proposal), and Invalidated (contradicted by new information or events). Two governance invariants enforce assumption discipline: Invariant 3 requires explicit human acceptance for all planning assumptions, ensuring that no assumption enters the planning basis without accountability; Invariant 6 triggers automatic replanning workflows when an accepted assumption is invalidated, ensuring that plans built on false premises are flagged for review.

Each assumption carries sensitivity analysis metadata indicating which planning products and decisions depend on it. When an assumption is invalidated, the system identifies all downstream products that may require revision, providing decision-makers with immediate visibility into the blast radius of changed circumstances. This capability directly addresses the challenge identified in Section 2.8: the gap between strategic intent and tactical execution widens when planning assumptions fail silently.

### MDMP-Specific AI Agents

Six AI agents support the MDMP governance framework, each following the single-responsibility pattern described in Section 3.3:

The **Assumption Auditor** continuously monitors the planning environment for indicators that accepted assumptions may be invalid. It surfaces new assumptions implicit in planning products and tracks assumption sensitivity across the planning timeline. The **Orders Validator** performs format and consistency validation on OPORD products, simulating degraded execution scenarios to identify orders that may fail under realistic conditions. The **Uncertainty Quantifier** attaches calibrated confidence intervals to all AI-generated analyses, detecting false precision where AI outputs imply greater certainty than evidence supports. The **Data Bias Detector** identifies statistical bias, coverage gaps, and staleness in intelligence inputs that could skew planning analysis. The **Problem Framing** agent generates alternative problem perspectives from multiple viewpoints, countering the cognitive trap of premature closure on a single problem definition. The **ROE Compliance** agent parses rules of engagement, maps authorities to specific tasks, and validates that planned actions comply with applicable constraints.

These agents operate within the authority levels defined by the safety matrix. None can override governance gates or approve proposals autonomously. Their outputs feed into the governance workflow, where human decision-makers evaluate AI analysis within the structured MDMP process.

## 3.6 Escalation & Competition Modeling

Military planning must account for adversary behavior, escalation dynamics, and cascading effects across multiple domains. While Section 3.5 describes the governance framework that structures the planning process, this section describes the analytical capabilities that inform planning decisions within that framework. BASTION integrates adversary modeling, escalation simulation, and effects analysis as first-class capabilities rather than ad hoc staff processes.

### Adversary Modeling

Effective COA development requires understanding adversary capabilities and likely responses. BASTION implements adversary modeling following ATP 2-01.3 doctrine, with an AI agent that synthesizes adversary capability models from available intelligence inputs and generates two standard adversary products: the Most Likely Course of Action (MLCOA), representing the adversary response with highest probability given observed indicators, and the Most Dangerous Course of Action (MDCOA), representing the adversary response that poses greatest risk to friendly operations regardless of probability.

The adversary modeler operates at SemiAutonomous authority, generating adversary COAs that human analysts review before incorporation into wargaming. This authority level reflects the analytical nature of adversary modeling: the AI performs pattern synthesis and doctrinal reasoning that benefits from machine speed, while human analysts provide the contextual judgment and cultural understanding that current AI systems cannot reliably provide.

### Escalation Dynamics and Effects Analysis

Military operations produce effects that extend beyond immediate tactical outcomes. A tactical action in one domain may trigger diplomatic consequences, information effects, economic disruptions, or further military responses. BASTION models these dynamics through two complementary capabilities.

The **Escalation Modeler** simulates escalation dynamics using configurable theoretical frameworks. Each scenario is represented as an escalation ladder with discrete rungs representing levels of conflict intensity, trigger conditions that cause transitions between rungs, thresholds that define escalation boundaries, and de-escalation options available at each level. The modeler identifies escalation pathways that planned actions might trigger and highlights off-ramps that preserve strategic flexibility. This capability directly addresses the risk that tactical decisions made under time pressure may inadvertently cross escalation thresholds with strategic consequences.

The **Effect Cascader** maps second and third-order effects of each COA across the four DIME domains: Diplomatic, Information, Military, and Economic. For each planned action, the cascader traces likely consequences through interconnected domains, identifying effects that planners might not anticipate from a single-domain perspective. The visualization presents these cascading effects as directed flows across DIME swim lanes, enabling planners to trace cause-and-effect chains and identify unintended consequences before committing to a course of action.

A **Deception Detector** complements these analytical agents by identifying inconsistencies between adversary stated intent and observed behavior. This capability supports the Intelligence Preparation of the Battlefield (IPB) process by flagging indicators that adversary actions may not align with their declared posture, alerting analysts to potential deception operations.

### Enhanced Wargaming

BASTION extends its red team simulation capability into a full wargaming framework that supports the action-reaction-counteraction methodology prescribed by military doctrine. The wargaming engine operates in a hybrid mode: AI agents first execute automated scenario runs that explore the decision space rapidly, identifying critical decision points and high-impact variables. Commanders then use interactive "what-if" exploration to test specific scenarios, modify assumptions, and probe edge cases that automated analysis may not cover.

Each wargaming session produces a complete move log with reasoning audit trail, preserving the analytical basis for COA selection. This audit trail integrates with the governance gate system described in Section 3.5, providing the evidence base that RedTeamGate checks require before COA approval can proceed.

### Quantitative Planning Support

Three additional capabilities provide quantitative rigor to COA comparison and selection:

**Force Ratio Analysis** implements the Correlation of Forces Methodology (COFM) with seven combat power modifiers and doctrinal thresholds (3:1 for deliberate attack, 1:1 for defense). This quantitative assessment complements the qualitative COA comparison performed by the COA Comparator agent, providing numerical basis for feasibility judgments.

**COA Sketch Generation** produces visual representations of each COA using MIL-STD-2525D military symbology overlaid on geographic map displays. Phased timelines with animation enable commanders to visualize the temporal progression of operations, while affiliation filtering isolates friendly, hostile, and neutral force dispositions.

**Sustainment Modeling** assesses logistics feasibility for each COA through resource burndown analysis aligned with ADP 4-0 resource categories. Phase-level risk flags (green, amber, red) provide rapid feasibility assessment, while detailed burndown charts enable planners to identify specific resource constraints that may limit operational duration or tempo.

**Branch and Sequel Planning** supports contingency development by identifying decision points where planned operations may need to diverge based on battlefield conditions. Decision points are modeled with trigger conditions categorized across multiple domains, enabling planners to define what observable conditions would require transitioning to alternative plans. This capability ensures that operational planning accounts for uncertainty rather than assuming a single predicted outcome.

## 3.7 Doctrinal Lifecycle Interface

BASTION's user interface evolved from a functional grouping of capabilities (Decide, Design, Campaign, Monitor) to a doctrine-aligned lifecycle that mirrors the Joint Planning Process as described in JP 5-0. This restructuring ensures that the system's workflow organization reinforces doctrinal thinking rather than imposing an arbitrary software workflow on military planners.

### Six-Tab Doctrinal Flow

The interface implements six tabs corresponding to the phases of joint operational planning:

**Understand.** The first tab consolidates strategic environment analysis. Commanders and staff upload strategic guidance documents, scenario training packages, and intelligence reports. The system provides PMESII-PT (Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time) operational environment analysis through AI agents. RAFT graph visualization displays actor relationships, tensions, and functions extracted from uploaded documents. This tab absorbs capabilities previously distributed across separate strategic planning and intelligence views, presenting them as a unified understanding of the operational environment. A "Create from Scenario" wizard enables rapid exercise setup by ingesting multi-file training packages with AI-driven tag inference for document type, team assignment, and exercise phase classification.

**Design.** The second tab implements operational design as described in JP 5-0 Chapter III. A problem framing canvas enables commanders to define the problem from multiple perspectives, with AI agents identifying key tensions and suggesting alternative framings. Center of gravity analysis follows Strange's CG-CC-CR-CV (Center of Gravity, Critical Capabilities, Critical Requirements, Critical Vulnerabilities) framework for both friendly and adversary forces. Lines of effort and lines of operation are defined visually with explicit linkages to strategic objectives and decisive points. An operational approach builder synthesizes the center of gravity analysis and lines of effort into a coherent phased approach. The design-to-plan handoff exports operational design outputs directly as inputs to mission analysis in the Plan tab. Real-time collaborative editing through Yjs CRDTs enables multi-staff contribution to the operational design.

**Plan.** The third tab implements the JP 5-0 Joint Planning Process and MDMP workflow described in Section 3.5. Mission analysis, course of action development, wargaming, COA comparison, and plan development proceed through governance-gated phases. The escalation modeling and competition analysis capabilities described in Section 3.6 integrate here as analytical tools within the planning workflow.

**Decide.** The fourth tab manages the transition from planning to execution and houses the decision dashboard that consolidates all pending governance decisions requiring human action. WARNORD, OPORD, and FRAGO generation produces formatted orders with classification banners and handling instructions. Task organization displays show force assignment by unit and function. Resource allocation from the registry (Section 3.10) is managed through DAO proposals at decision gates. A RACI-filtered decision queue presents pending approvals, rejections, and deferrals through PendingDecisionModal workflows. Ironclaw (the AI Chief of Staff agent) polls the decision queue every sixty seconds, proactively surfacing overdue decisions and presenting context to inform the commander's choice. Per-team information barriers ensure that each staff role and coalition partner sees only the orders and directives relevant to their function and clearance level.

**COP (Common Operating Picture).** The fifth tab displays the operational picture generated by autonomous AI agent teams (Section 3.9). Multiple overlay layers render MIL-STD-2525D military symbology as interactive SVG graphics. Resources from the registry appear as standard military symbols alongside AI-generated entity positions. Friendly and adversary perspective toggles, phase sliders, and playback controls enable temporal and perspective-based COP exploration.

**Assess.** The sixth tab supports running assessment against measures of effectiveness (MOE) and measures of performance (MOP). Running estimates from each staff role feed into assessment dashboards. The assessment tab closes the doctrinal loop: when assessment reveals that the operational approach is no longer achieving desired effects, the commander can reframe the problem and cycle back to the Understand or Design tabs.

### Role-Based Tab Visibility

Not all roles require access to all tabs. The interface implements role-based tab visibility: a J2 Intelligence officer may see Understand, COP, and Assess but not Decide. A Commander sees all tabs. This visibility control reduces cognitive load by presenting only the workflow phases relevant to each user's function while maintaining a single coherent interface for the entire planning lifecycle.

### Iterative Navigation

The tab structure supports the iterative nature of operational planning described in JP 5-0. Planners are not locked into a linear progression; they can revisit earlier tabs as understanding evolves. Assessment findings may trigger a return to Design for operational approach adjustment. New intelligence in Understand may invalidate assumptions tracked in Plan. This iterative capability mirrors doctrinal guidance that planning is continuous and cyclical rather than linear.

## 3.8 Intelligence Preparation of the Battlefield

BASTION implements a complete Intelligence Preparation of the Battlefield (IPB) cycle supporting both friendly (Blue) and adversary (Red) perspectives with strict information isolation between the two.

### Dual-Perspective Analysis

The IPB system provides a Blue/Red toggle that switches the analysis context between friendly and adversary perspectives. Information isolation ensures that Red team analysis of adversary capabilities and intentions does not leak into Blue team planning products, and vice versa. This separation supports realistic exercise scenarios where opposing teams develop independent assessments.

### Scenario-Driven IPB

Exercise scenarios drive the IPB process. Scenario package upload accepts multi-file training packages with AI-driven tag inference that automatically categorizes documents by type (intelligence report, operations order, logistics estimate), team assignment (Blue, Red, White), and exercise phase (Competition, Crisis, Conflict). Async LLM extraction processes uploaded documents and surfaces extracted intelligence in the Understand tab.

### COA Scoring and Commander Decision Support

Courses of action are scored against five doctrinal criteria with wargame evidence integration. The COA scoring system draws on the wargaming framework described in Section 3.6 to incorporate action-reaction-counteraction outcomes as evidence supporting or undermining each COA's viability. A commander decision matrix presents scored COAs with blockchain-anchored decision records, ensuring that the rationale for COA selection is permanently recorded.

### Order Generation with Information Barriers

The IPB cycle produces WARNORD, OPORD, and FRAGO documents with per-team information barriers. Each team receives only the products and information appropriate to their role and perspective. A Kanban task board manages exercise phase gate progression, providing visual workflow management for multi-phase exercises.

## 3.9 AI Common Operating Picture Generation

A distinctive capability of BASTION is the autonomous generation of Common Operating Picture (COP) layers by AI agent teams. Rather than requiring manual placement of symbols on a map, AI agents parse planning documents, orders, and intelligence reports to derive location, resource, and intent data, then generate MIL-STD-2525D-compliant military symbology overlays.

### Agent Team Architecture

Each workspace section maintains an autonomous agent pool that monitors document and plan changes. When source material is created or updated, agents process the content through an extraction pipeline that identifies:

- **Geographic references** that can be resolved to map coordinates
- **Military units and resources** that can be represented with standard symbology
- **Temporal phasing** that enables phase-based COP animation
- **Intent and objectives** that can be visualized as operational graphics

### Symbol Generation

A SIDC (Symbol Identification Coding) builder constructs standard MIL-STD-2525D symbol codes from extracted entity attributes. An SVG specification generator produces interactive vector graphics for each symbol, supporting hover/click detail panels that link symbols back to their source documents. An entity linker resolves document mentions (unit names, location references, resource identifiers) to specific map positions using a combination of geocoding and context-aware disambiguation.

### Layer Management and Governance

Generated COP layers undergo a publish review cycle before promotion to the top-level COP visible to all workspace participants. This governance integration ensures that AI-generated operational picture content receives human review before influencing command decisions. Layer version snapshots support rollback, and conflict detection identifies when multiple agents produce contradictory symbol placements. Friendly and adversary perspective toggles enable separate COP views, and a phase slider with playback controls enables temporal COP exploration showing planned force movements and phasing.

## 3.10 Resource Registry and DID Plugin Architecture

BASTION elevates military resources from simple inventory entries to first-class entities with blockchain-anchored Decentralized Identifiers and a plugin architecture for extensible resource type management.

### Resource Identity

Each resource receives a DID in the form `did:near:resource-{id}`, anchored on the NEAR blockchain with blinded and public key pairs. This identity model extends the DID framework established in Phase 2 (Section 3.2) to military assets, enabling cryptographic verification of resource provenance, assignment history, and capability claims. Resources are registered in a singleton registry that supports DID lookup, capability queries, and geographic area queries.

### Plugin Interface

Resource types are managed through a plugin interface that defines five extension points for each resource category: schema (data model and validation), state machine (lifecycle states and transitions), capabilities (what the resource can do), data handler (telemetry and status ingestion), and COP renderer (how the resource appears on the Common Operating Picture). This architecture enables new resource types to be added without modifying core platform code.

### Built-in Plugins

Five built-in plugins cover the primary military resource categories:

- **AutonomousVehiclePlugin**: Manages unmanned systems with navigation state, mission assignment, and sensor payload tracking
- **SensorPlatformPlugin**: Handles sensors across domains (airborne, ground, maritime, space) with coverage areas and detection capabilities
- **WeaponSystemPlugin**: Tracks weapon systems with ammunition states, engagement envelopes, and employment restrictions
- **CommsPlugin**: Manages communication assets with frequency assignments, encryption status, and network topology
- **LogisticsPlugin**: Tracks supply items with consumption rates, distribution status, and replenishment thresholds

### COP Integration and DAO-Governed Allocation

Resources render on the COP as MIL-STD-2525D symbols alongside AI-generated layers. Real-time readiness tracking reports Full Mission Capable (FMC), Partially Mission Capable (PMC), or Not Mission Capable (NMC) status with location, degradation factors, and maintenance scheduling. Telemetry ingestion from sensors and vehicles feeds AI agent context for situational awareness. Resource allocation flows through DAO proposals at decision gates, ensuring that resource assignment decisions receive appropriate governance oversight.

## 3.11 Training and Operational Mode Architecture

BASTION implements a global application mode toggle that switches between training (exercise) and operational contexts, embodying the military doctrine of "train as you fight."

### Mode Design

The training mode activates a persistent amber "EXERCISE - EXERCISE - EXERCISE" banner across the application, providing unambiguous visual distinction from operational mode. All documents generated in training mode receive automatic EXERCISE watermarks. The operational mode presents a clean interface where the absence of the training banner serves as the mode indicator.

### Data Isolation

Training and operational modes maintain complete data isolation. Exercise scenarios, planning products, and governance decisions in training mode exist in a separate context from operational data. This isolation prevents exercise data from contaminating operational systems while allowing exercise scenarios to use realistic data structures and workflows.

### Governance Parity

A core design principle is that DAO governance operates identically in both modes. Voting thresholds, authority models, governance gates, and safety matrix enforcement apply equally in training and operational contexts. This parity ensures that training exercises exercise the actual governance mechanisms that would be used in operations, avoiding the common problem of training systems that simplify governance for convenience and thereby fail to prepare users for operational governance complexity.

### Exercise Management

Training mode provides reset and checkpoint capabilities for exercise iteration. After-action review capture enables structured debriefing by recording exercise events, decisions, and outcomes for post-exercise analysis. Exercises can be reset to specific checkpoints to replay scenarios with different decisions, supporting iterative learning.

## 3.12 JPP Staff Organization

BASTION organizes exercise participation around the Joint Planning Process staff structure, providing per-role workspaces that mirror the organizational structure of a joint staff.

### Role-Based Workspaces

Each JPP staff role (Commander, Deputy Commander, Chief of Staff, J1 through J9, and specialized roles including Staff Judge Advocate, Political Advisor, Public Affairs Officer, and component commanders) receives a dedicated workspace with templated doctrinal products appropriate to their function. Templates follow service-specific formats and include the required sections, coordination fields, and approval workflows that each staff role is responsible for producing.

### Cross-Staff Coordination

Real-time notifications delivered via WebSocket alert staff members when products they depend on are updated, when coordination is requested, or when governance gates require their input. A hybrid editor combining structured fields with narrative text enables both standardized data entry and free-form analysis within each doctrinal product. Real-time product merging allows multiple staff roles to contribute to shared products (such as running estimates) simultaneously through CRDT-based conflict resolution.

### AI Staff Agent Integration

Each staff role has access to AI agent teams that automate routine doctrinal tasks within the role's functional area. Rather than dedicating one AI agent per staff role, Ironclaw (BASTION's Chief of Staff agent) provides role-aware coordination across all staff functions, drawing on doctrinal publications, product formats, and coordination requirements as needed. Strategic direction import from the Design tab ensures that staff workspaces receive operational design outputs as context for their planning products, maintaining alignment between design intent and staff products.

## 3.13 Agent Hub: AI as Organizational Infrastructure

Section 3.4.5 argued that AI in military planning should function as persistent infrastructure rather than a prompted tool. The Agent Hub is the architectural realization of that principle: a unified management layer that treats AI agents as organizational members with identities, roles, health records, and performance accountability — analogous to how a military organization manages its human staff. Where conventional AI integration embeds models into application code and hopes they perform correctly, BASTION manages agents as a fleet of autonomous entities whose effectiveness is continuously measured, whose authority is governed, and whose failures trigger automatic safeguards.

### Agent Registry and Identity

Every AI agent in BASTION receives a formal identity through the same DID framework used for human participants and physical resources. Each agent holds a W3C Decentralized Identifier (`did:near:agent-{id}`), a blinded key for privacy-preserving lookup, and a public key for verifiable signatures. This identity model ensures that agent actions are attributable with the same cryptographic assurance as human actions — when an agent generates a proposal, submits an analysis, or triggers an escalation, the audit trail identifies precisely which agent acted, under what authority, and with what delegation scope.

Agent registration follows a manifest-based pattern. Each agent's manifest declares its name, description, capabilities, maximum autonomy level, allowed proposal kinds, and which proposal kinds require human approval before the agent can act. The manifest also specifies the agent's phase within the NEAR AI Governance Framework (Support, Represent, or Organize), reflecting the maturity of the agent's role within the organization. Support-phase agents assist human decisions by providing analysis; Represent-phase agents can proxy human decisions within delegated scope; Organize-phase agents coordinate across functions and make bounded decisions autonomously.[^hub1]

[^hub1]: NEAR Foundation, "NEAR AI: User-Owned Artificial Intelligence," near.org/ai, 2025, https://near.org/ai.

The agent registry uses a write-through cache architecture: an in-memory map provides fast lookup during operations while PostgreSQL provides durable persistence. Default agents are seeded on system startup through idempotent registration, ensuring that the agent fleet is available immediately after deployment. The registry supports 25 specialized agents across five categories: governance (4), operational planning and MDMP (14), graph analysis (7), strategic analysis (4), and the Ironclaw Chief of Staff.

### Agent Configuration and Model Management

Each agent's underlying LLM can be configured independently. The Agent Hub provides both global defaults and per-agent overrides for model provider (Anthropic, OpenAI, Azure OpenAI, NEAR AI, or local), model selection, temperature, and token limits. This granularity enables operational tuning: a risk assessment agent might use a low temperature for consistent outputs while a creative planning agent uses a higher temperature for diverse COA generation. A security classification level (Unclassified, CUI, Secret, Top Secret) is assigned per agent, governing which tools and data the agent can access through clearance-gated authorization.

The configuration interface exposes nine standard agents that can be individually enabled or disabled: OSINT collector, document processor, threat monitor, fusion agent, extraction agent, assessment agent, red team agent, devil's advocate, and COA generator. A global confidence threshold (default 0.7) sets the minimum score at which agent outputs are presented to human reviewers, and a global human review toggle can require human approval for all agent outputs regardless of autonomy level.

### Agent Teams and Workflow Orchestration

Individual agents gain their greatest value when composed into teams that execute coordinated workflows. The Agent Hub's team designer enables drag-and-drop composition of agent teams with six workflow types that mirror organizational coordination patterns:

- **Sequential**: Agents execute in defined order, each receiving the previous agent's output — appropriate for analysis pipelines where each stage builds on prior work.
- **Parallel**: Agents execute simultaneously on the same input — appropriate for independent assessments that will be synthesized (e.g., multiple staff sections analyzing the same intelligence).
- **Pipeline**: A structured variant of sequential execution with explicit stage definitions, approval gates, and timeout constraints at each stage.
- **Supervised**: A designated supervisor agent reviews and approves outputs from subordinate agents before they proceed — mirroring a staff section chief reviewing analyst work.
- **Consensus**: Multiple agents independently analyze the same input, and outputs are compared for agreement before proceeding — providing cross-validation that reduces single-agent hallucination risk.
- **Hierarchical**: A leader agent decomposes tasks, delegates to specialist agents, and synthesizes results — mirroring how a chief of staff coordinates across staff sections.

Each team member is assigned a role (coordinator, specialist, validator, or executor) with explicit permissions for initiating actions and escalating to human oversight. Teams can be assigned to specific problem sets, ensuring that agent teams working on different operational contexts maintain data isolation. The team designer includes a test harness that executes the team workflow against sample inputs and displays per-agent execution traces with timing, success/failure status, and output content.

All team workflows are executed through LangGraph, which provides the state machine, checkpoint, and branching infrastructure for multi-agent orchestration. LangGraph's execution model ensures that agent interactions are deterministic within engineering constraints: given the same inputs and model state, the workflow follows the same execution path through the same agents in the same order.

### Tools, Skills, and MCP Server

Agents interact with BASTION's data and services through a managed tool ecosystem built on the Model Context Protocol (MCP). Rather than hardcoding agent capabilities, BASTION exposes platform functions as discoverable, schema-validated tools that agents invoke through a standard protocol.

**Tool Registry.** Each tool is registered with a unique DID, a JSON Schema defining its input and output contracts, a handler type (builtin, webhook, or function), and a permission specification including required clearance level. Tools are categorized as data (read operations), action (write operations), integration (external system calls), or analysis (computation). The registry supports runtime tool assignment: administrators can grant or revoke tool access for specific agents without code changes, enabling fine-grained capability management.

**MCP Server.** BASTION's MCP server implements the Model Context Protocol specification, exposing tool groups for knowledge operations, operational planning, calendar management, resource queries, and personnel lookups. Authorization is DID-based: agents must present their agent DID in request headers, and the server validates the DID against an allowlist before granting access. Per-tool authorization extends beyond the allowlist to check clearance claims resolved from the agent's verifiable credentials. Personnel tools require explicit clearance mappings, and high-risk tools require additional allowlist entries. This layered authorization ensures that agents can only access tools appropriate to their role and clearance — an OSINT collection agent cannot invoke personnel management tools, and a logistics agent cannot access intelligence tools classified above its clearance level.

**Skill Registry.** Skills represent higher-level capabilities composed from tools and prompts. Each skill defines input and output schemas (validated with Zod), an importance score, and a category. Skills can be bundled into skill packs that are enabled or disabled per agent, allowing rapid reconfiguration of agent capabilities for different operational contexts. Ironclaw's skill packs, for example, can be adjusted to emphasize operational design skills during the planning phase and shift to execution monitoring skills during the operations phase.

### Health Monitoring and Circuit Breakers

The Agent Hub's health monitoring system treats agent performance management with the same rigor that military organizations apply to personnel readiness. Every agent's operational effectiveness is continuously measured across three validation categories:

**Determinism.** Consistency of agent outputs when given the same inputs. Determinism scoring uses two methods: structured diff (comparing JSON outputs field by field) and semantic similarity (comparing meaning using embedding cosine distance). An agent that produces significantly different analyses of the same intelligence report on successive runs scores low on determinism, triggering investigation into whether the variance reflects genuine uncertainty or unreliable behavior.

**Reliability.** Success rate, error handling, and response time. The system tracks each agent's success rate (percentage of invocations that complete without error), average response time, and time since last invocation. Agents with declining success rates or increasing latency are flagged before they affect operational workflows.

**Authority.** Compliance with authorization boundaries. Authority validation tests whether agents respect their defined scope by presenting attack scenarios: privilege escalation attempts (agent tries to access unauthorized resources), scope creep (agent exceeds defined capabilities), and unauthorized actions (agent acts outside its delegation). Expected behaviors are refuse, escalate, or scope-limit. An agent that fails authority validation poses a governance risk and is immediately flagged.

The circuit breaker pattern provides automatic safeguards when agent performance degrades below acceptable thresholds. The circuit breaker operates in three states:

- **Closed (active):** Agent is performing within thresholds and operates normally.
- **Warning:** Agent has scored below the warning threshold but above the critical threshold. Alerts are generated but the agent continues operating, analogous to a counseling statement for a soldier showing performance issues.
- **Open (disabled):** Agent has scored below the critical threshold for a configurable number of consecutive runs (the grace period). The circuit breaker automatically deactivates the agent, activates a designated fallback agent if one is configured, posts critical alerts, and sends webhooks for external notification. The disabled agent cannot be invoked until it is explicitly reinstated.

Reinstatement follows one of two paths: standard re-test (the agent must pass a validation suite before returning to active status) or administrative override with mandatory justification (recorded in the audit trail). The override mechanism exists for operational necessity — if a mission-critical agent is the only one capable of a specific function, a commander can override the circuit breaker while accepting the risk, just as a commander might employ a partially mission-capable asset when no alternative exists.

This health monitoring infrastructure transforms AI agent management from a software engineering concern into an organizational leadership function. Agents that consistently perform well earn trust through measurable track records. Agents that underperform are identified, isolated, and either improved or replaced — the same performance management cycle that applies to any member of a military organization.

### Activity Logging and Accountability

Every agent action is logged through a fire-and-forget activity logger that never blocks the operational hot path. The activity log captures ten action types: LLM invocations (with input/output summaries, duration, and status), tool calls, messages sent and received, action cards generated, delegations between agents, team dispatch events, specialist handoffs, checkpoint events, and errors.

The Activity tab in the Agent Hub provides a real-time filterable feed of all agent activity across the organization. Filters by agent, team, action type, status, and date range enable focused investigation. Aggregate statistics (total actions, success rate, average duration) provide fleet-wide health indicators. The activity log supports CSV export for offline analysis and integration with external audit systems.

This comprehensive logging ensures that the agent fleet's behavior is fully observable. When an agent team produces an unexpected result, investigators can trace the complete execution path: which agent initiated the workflow, what tools were invoked, what data was accessed, what intermediate results were produced, and where the unexpected output originated. This observability is essential for the accountability requirements of military command — the same standard of after-action reviewability that applies to human staff actions applies to AI agent actions.

### Agent Hub Administration Interface

The Agent Hub consolidates all agent management functions into a unified administration interface with six tabs:

1. **Agents**: Grid and table views of all registered agents with health status indicators, inline activation/deactivation toggles, expandable detail cards showing full configuration, a memory viewer for inspecting agent knowledge/working/episode memory, and a test harness for validating individual agent behavior.

2. **Teams**: Drag-and-drop team composition with sortable execution order, leader designation, workflow type selection, problem set assignment, and team-level test execution with per-agent trace visualization.

3. **Tools**: Tool creation with JSON Schema input/output definitions, category assignment, handler configuration, and agent-tool binding management. Administrators can see which agents have access to which tools and modify bindings without code changes.

4. **Skills**: Skill definition and management with schema validation, importance scoring, and category grouping. Skills are assigned to agents individually or through skill packs.

5. **Activity**: Real-time activity feed with filtering, statistics, and export capabilities as described above.

6. **Health**: Validation dashboard showing circuit breaker state for each agent, determinism and reliability scores, authority compliance status, circuit breaker event timeline, and reinstatement controls.

This administration interface provides commanders and system administrators with the same kind of organizational visibility over their AI staff that they maintain over their human staff: who is performing well, who is struggling, who needs attention, and who should be temporarily relieved of duties until their performance improves.

## 3.14 Component Integration

BASTION's contribution lies not in inventing new technologies but in integrating existing technologies in novel ways to address gaps in military coordination. This section highlights the integration points that represent BASTION's systems integration novelty, including the MDMP governance and escalation modeling capabilities described in Sections 3.5 and 3.6, and the doctrinal lifecycle, COP generation, resource registry, agent infrastructure, and training mode capabilities described in Sections 3.7-3.13.

### Novel Integration Points

**DAO Governance with AI Agents.** While DAOs and AI agents each have extensive prior art, their integration for command and control applications has not been previously demonstrated. BASTION combines DAO voting and smart contract enforcement with AI agent analysis and execution, creating a system where AI augments human decision-making within a decentralized governance framework. This integration addresses the gap identified in Section 2.11: no existing systems provide frameworks for multi-stakeholder AI coordination with policy compliance and appropriate human authority.

**Blockchain with Military C2.** As documented in Section 2.4, existing blockchain applications in defense focus primarily on data integrity for supply chains and identity management. BASTION extends blockchain use to command and control governance, leveraging immutability and transparency for decision accountability rather than merely data verification. This application demonstrates that blockchain's governance capabilities, not just its data integrity properties, are valuable for military coordination.

**Multi-Level Coordination.** The three-tier DAO structure maps blockchain governance to the military levels of warfare: strategic, operational, and tactical. This mapping enables coordinated decision-making across levels while respecting the different tempo, scope, and authority requirements at each level. The inter-DAO communication mechanisms provide the strategic-to-tactical linkage that JADC2 envisions, but with decentralized governance rather than centralized control.

**Policy Encoding with Autonomous Execution.** Smart contract policy encoding enables bounded autonomy: AI agents can act quickly within policy constraints without case-by-case human approval, while the system automatically prevents policy violations. This integration addresses the tradeoff between speed and compliance that characterizes traditional coalition coordination.

**Doctrinal Process Governance with Blockchain Enforcement.** The integration of MDMP doctrinal processes with DAO governance gates represents a novel application of blockchain to military planning process enforcement. While MDMP checklists and phase gates exist in doctrine, procedural discipline rather than technical controls has traditionally enforced them. BASTION encodes these gates as smart contract conditions that must be satisfied through DAO proposals before workflow advancement, transforming doctrinal guidance into enforceable governance. The assumption lifecycle management system further demonstrates this integration: planning assumptions that would traditionally be tracked in spreadsheets or staff notes become blockchain-recorded artifacts with formal acceptance requirements, invalidation triggers, and automatic replanning workflows.

**Adversary Modeling with Governance-Aware Wargaming.** The integration of AI-driven adversary modeling, escalation simulation, and effects analysis with the MDMP governance framework ensures that analytical rigor is both enabled by AI speed and bounded by governance controls. Wargaming results feed directly into RedTeamGate checks that must be satisfied before COA approval, creating a closed loop between AI analysis and governance enforcement that prevents premature commitment to courses of action that have not been adequately challenged.
