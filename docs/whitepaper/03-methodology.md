# 3. Methodology

This section describes BASTION's architecture and the design principles that guide its implementation. The architectural decisions presented here directly address the gaps identified in Section 2: the lack of decentralized governance for military command and control, the absence of frameworks for multi-stakeholder AI coordination, and the need for policy-compliant autonomous execution with appropriate human authority positions. Each design choice is justified in terms of how it enables effective coalition coordination while maintaining the transparency, accountability, and human control that military operations require.

## 3.1 Design Principles

BASTION's architecture rests on four foundational principles derived from the challenges identified in the background sections. These principles inform every architectural decision and ensure that technical capabilities align with operational requirements.

### Decentralization for Resilience

Modern military operations face adversaries who actively target command and control infrastructure. As described in Section 2.5, centralized C2 systems present attractive targets for electronic warfare, cyber attacks, and kinetic strikes. When a coalition's coordination depends on a single command post or network node, disrupting that node can paralyze operations across multiple nations' forces.

BASTION addresses this vulnerability through architectural decentralization. Rather than concentrating coordination logic in any single location, the system distributes governance across a network of nodes operated by coalition partners. Each partner maintains the capability to participate in coordination even if communication with other partners is degraded. The blockchain substrate ensures that when connectivity is restored, the system can reconcile state across previously disconnected nodes and continue operations from a consistent foundation.

This decentralized architecture directly addresses the DDIL (Disconnected, Degraded, Intermittent, Limited-bandwidth) challenges identified in Section 2.5. Forces operating in contested electromagnetic environments can continue to execute pre-approved missions using locally cached governance state. When they reconnect, their actions are recorded on the shared ledger, maintaining the audit trail and enabling reconciliation with broader coalition activities. No single point of failure exists that an adversary could target to disable coalition coordination.

### Transparency for Trust

Coalition operations require trust among partners who may have competing national interests, different operational doctrines, and varying levels of information sharing authority. As described in Section 2.6, building this trust through traditional means is time-consuming and may never fully overcome suspicions that partner nations are not fully sharing information or are pursuing hidden agendas.

BASTION provides transparency through blockchain's immutable audit trail. Every proposal submitted to the governance system, every vote cast, every resource allocation approved, and every mission authorized is permanently recorded with cryptographic proof of its origin. Coalition partners can verify for themselves that the system is operating according to agreed-upon rules rather than relying on assurances from other partners.

This transparency operates across organizational boundaries. When multiple nations collaborate on a campaign, each nation's authorized representatives can observe how their partner nations are voting, what resources they are committing, and whether approved actions are being executed. This visibility enables accountability without requiring any nation to cede control to a centralized authority. The shared ledger serves as a neutral, verifiable record that all parties can trust.

The audit trail also supports after-action review and learning. When coalition operations produce unexpected outcomes, the complete record of decisions enables analysis of what went wrong and how procedures can be improved. Attribution in disputes is straightforward: the blockchain records precisely who approved what, when, and under what circumstances.

### AI Augmentation for Speed

Section 2.7 identified the operational level as where the gap between strategic intent and tactical execution is most acute. Joint All-Domain Command and Control (JADC2) envisions accelerating decision cycles through sensor-to-shooter connectivity, but connectivity alone does not address the cognitive burden on human decision-makers who must process vast amounts of information and make timely decisions.

BASTION integrates AI agents at each level of the governance hierarchy to augment human decision-making. These agents analyze proposals, assess risks, and present recommendations in formats optimized for human comprehension. They can process intelligence from multiple sources, identify patterns that might escape human attention, and flag issues that require human judgment. By handling routine analysis and presentation, AI agents free human decision-makers to focus on the judgments that require human wisdom, creativity, and ethical reasoning.

Critically, AI augmentation in BASTION does not replace human authority. As described in Section 2.9, the appropriate relationship between humans and AI depends on the consequences of potential errors. BASTION implements graduated autonomy: AI agents may execute routine, low-consequence actions autonomously, while higher-consequence decisions require human approval at appropriate authority levels. The speed benefits of AI augmentation are realized within a framework that preserves human control over decisions with significant implications.

This approach addresses the tempo requirements of modern operations while maintaining the accountability that military command requires. Commanders retain authority over critical decisions but are not overwhelmed by routine matters that AI agents can handle within established policy constraints.

### Policy Compliance by Design

Section 2.6 identified national caveats and information sharing restrictions as significant constraints on coalition coordination. Each nation participates in coalitions subject to its own national policies regarding what information can be shared, what actions can be authorized, and what resources can be committed. These policies are not merely preferences; they are legal requirements that coalition systems must respect.

Traditional approaches to policy compliance rely on human review at each decision point to ensure that proposed actions comply with applicable policies. This approach introduces delays and places the burden of compliance on individuals who may not fully understand all applicable constraints. Errors in compliance can have serious diplomatic and legal consequences.

BASTION addresses this challenge by encoding policies directly in smart contracts that govern the system's operation. National caveats, information classification requirements, release authority rules, and operational constraints are expressed as executable code that the governance system enforces automatically. Proposals that violate encoded policies cannot be approved; resources subject to restrictions cannot be allocated outside their permitted uses; information can only flow to recipients authorized to receive it.

This approach provides several advantages. First, compliance is consistent: the same rules apply every time, without variation based on individual interpretation or oversight. Second, compliance is verifiable: coalition partners can examine the smart contract code to confirm that their policies are correctly encoded. Third, compliance is auditable: when questions arise about whether actions complied with policy, the blockchain record shows exactly what rules were in effect and how they were applied.

Smart contract policy enforcement is particularly valuable for bounded autonomy. AI agents can be permitted to act within the bounds established by policy without requiring case-by-case human approval, because the policies themselves constrain what actions are possible. This enables speed where policy permits while ensuring that AI agents cannot exceed their authorized scope.

## 3.2 Architecture Overview

BASTION implements a layered architecture that maps to the military levels of warfare described in Section 2.5. This mapping ensures that the governance structure aligns with existing military organizational concepts while enabling novel coordination capabilities through blockchain and AI integration.

### Three-Tier DAO Structure

At the core of BASTION's architecture are three interconnected Decentralized Autonomous Organizations, each corresponding to a level of warfare. This structure ensures that governance mechanisms match the decision-making requirements at each level while enabling coordination across levels through well-defined interfaces.

**Strategic-Level DAO.** The Strategic DAO governs long-term objectives, resource allocation, and coalition membership. Decisions at this level correspond to the strategic level of warfare: determining which military objectives will achieve political ends, allocating resources among theaters, and establishing overall priorities. Coalition membership is managed through the Strategic DAO, with voting weights reflecting each nation's commitment and contribution to the coalition effort.

The Strategic DAO operates on longer time horizons, with proposals subject to extended deliberation periods that allow for thorough review and consensus-building among coalition partners. Supermajority thresholds ensure that strategic decisions reflect broad agreement rather than the preferences of a narrow majority. The immutable record of strategic decisions provides the foundation against which lower-level actions are evaluated for alignment with coalition intent.

**Operational-Level DAO.** The Operational DAO bridges strategic intent and tactical execution, coordinating campaigns and major operations across multiple tactical units. This level manages the AI agent orchestration that enables rapid analysis and recommendation generation, ensuring that agents operate within strategically approved parameters while supporting tactical decision-making.

Resource-to-objective mapping occurs at the operational level, translating strategic resource allocations into specific commitments to campaigns and operations. The Operational DAO monitors the state of resources and objectives, automatically generating proposals to the Strategic DAO when resource states require attention or when tactical results suggest strategic reassessment. This automated proposal generation accelerates the feedback loop from tactical execution to strategic planning.

AI agents at the operational level fuse intelligence from multiple sources, assess progress toward objectives, and identify risks or opportunities that may not be apparent at either the strategic or tactical level. Human operational commanders retain authority over significant decisions while benefiting from AI-augmented situational awareness.

**Tactical-Level DAO.** The Tactical DAO governs mission-specific decisions, asset coordination, and target identification within policy constraints. Decisions at this level must often occur in real-time or near-real-time, requiring different governance mechanisms than higher levels.

Tactical proposals may be approved through streamlined processes that enable rapid response while maintaining accountability. Pre-approved mission types can be executed by AI agents within the bounds established by higher-level policy, with human authority required only for exceptions or high-consequence actions. The Tactical DAO records all actions for later review, ensuring that even rapid tactical execution leaves an auditable trail.

The interaction between human decision-makers and AI agents at the tactical level is calibrated to mission requirements. Routine coordination actions may proceed autonomously, while actions with significant risk or policy implications require human approval. The authority position for each decision type is explicitly defined in smart contract code, ensuring consistent application across the coalition.

### Inter-DAO Communication

The three DAOs are not isolated; they communicate through well-defined interfaces that enable information flow in both directions. Strategic guidance flows downward as policy constraints and resource allocations that bound lower-level decision-making. Tactical and operational information flows upward as status reports and automatic proposals that inform higher-level planning.

Automatic proposal generation enables tactical and operational experience to influence strategic decisions without requiring manual escalation. When tactical resource expenditure reaches defined thresholds, the system automatically generates proposals to the Operational or Strategic DAO requesting replenishment or reallocation. When tactical results suggest that strategic objectives may not be achievable through current approaches, the system can flag the situation for strategic review.

Resource state monitoring provides real-time visibility into coalition capabilities across all levels. Strategic planners can observe the aggregate state of resources committed to campaigns; operational commanders can track resource availability for upcoming operations; tactical units can verify resource status before commencing missions. This shared visibility reduces the information gaps that impede effective coordination in traditional coalition operations.

Figure 1 illustrates the three-tier architecture, showing the relationships between DAOs, the AI agent layer, and the blockchain infrastructure that secures all transactions. The diagram indicates human authority positions at each level and the decision flow patterns that connect strategic intent to tactical execution.

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

NEAR Protocol was selected for several conceptual advantages that align with BASTION's requirements. First, NEAR's sharded architecture provides the scalability necessary for military operations that may involve thousands of transactions representing tactical actions, intelligence updates, and resource state changes. The protocol can process transactions with finality in approximately two seconds, enabling near-real-time coordination without sacrificing the security guarantees that blockchain provides [CITATION NEEDED: NEAR Protocol documentation].

Second, NEAR provides native support for decentralized identifiers (DIDs) and account abstraction, enabling the identity management capabilities essential for coalition operations. Coalition partners can maintain cryptographically verified identities without relying on centralized identity providers, addressing the multi-stakeholder coordination requirements identified in Section 2.6.

Third, NEAR's developer-friendly smart contract environment, using Rust and JavaScript/TypeScript, reduces the barriers to developing and maintaining governance contracts. This accessibility is important for military organizations that must maintain and audit critical systems over extended periods.

The decision to use a public blockchain rather than a private blockchain reflects a deliberate tradeoff. Private blockchains offer more control but sacrifice the resilience benefits of a globally distributed network. BASTION addresses classification and access control through encryption and access control layers rather than network isolation, maintaining the resilience of the public blockchain while protecting sensitive information.

### AI Agent Architecture

BASTION's AI agents follow a single-responsibility design pattern, where each agent performs one well-defined function rather than attempting to be a general-purpose assistant. This architecture was chosen over two alternatives: a monolithic AI system that handles all decision support functions, and a fully automated approach that removes humans from routine decisions entirely.

The single-responsibility pattern provides several advantages for military applications. First, it enables graduated trust: each agent can be evaluated, tested, and trusted independently based on its specific function. An agent that has proven reliable for logistics coordination can be granted greater autonomy in that domain without implying equivalent trust for intelligence analysis.

Second, single-responsibility agents are more explainable. When an agent makes a recommendation, understanding why requires understanding only that agent's limited scope rather than tracing reasoning through a complex multi-function system. This explainability supports the accountability requirements of military command.

Third, the pattern supports defense in depth. Multiple agents with different functions can cross-check each other's outputs, reducing the risk that a single point of AI failure leads to incorrect decisions.

Agent types in BASTION include facilitators that coordinate workflows and present information, analysts that process data and generate assessments, and executors that carry out approved actions within defined constraints. Each agent type has its own trust calibration, with executors subject to the strictest constraints and facilitators permitted the greatest autonomy for their coordination functions.

The NEAR AI Governance Framework, which defines phases of AI capability maturation (Support, Represent, Organize), informs how agent autonomy evolves over time [CITATION NEEDED: NEAR AI documentation]. New agents begin in the Support phase, where they can only provide information and recommendations. As they demonstrate reliability, they may advance to Represent (acting on behalf of humans within constraints) and eventually Organize (coordinating other agents) phases.

### Security Architecture

BASTION's security architecture follows a zero-trust model appropriate for multi-stakeholder environments where no single organization controls all participants. Rather than assuming that participants within the coalition network are trusted, every access request is verified against the requestor's attributes, credentials, and the policies applicable to the requested resource.

Attribute-Based Access Control (ABAC) provides the flexibility necessary for coalition environments with complex, overlapping authorization requirements. Unlike Role-Based Access Control (RBAC), which assigns permissions based on predefined roles, ABAC evaluates access decisions based on attributes of the subject, resource, action, and environment. This approach can express policies such as "NATO SECRET information may be accessed by personnel with SECRET clearance from nations that are NATO members and have signed the applicable information sharing agreement."

The ABAC implementation encodes national caveats directly, enabling automatic enforcement of the information sharing restrictions that impede traditional coalition coordination. When a coalition partner specifies that certain information is "REL TO FVEY" (releasable to Five Eyes nations), the access control system automatically restricts access to personnel from the United States, United Kingdom, Canada, Australia, and New Zealand. These restrictions are enforced consistently across all access paths, eliminating the risk of inadvertent disclosure through unchecked channels.

Post-quantum cryptography considerations inform BASTION's cryptographic choices, recognizing that data protected today may face quantum computing threats during its classification lifetime. While current quantum computers cannot break modern encryption, the development of cryptographically relevant quantum computers could compromise data encrypted with today's algorithms. BASTION's architecture supports cryptographic agility, enabling transition to post-quantum algorithms as standards mature and implementations become available [CITATION NEEDED: NIST post-quantum cryptography standardization].

The security architecture treats classification as a first-class concern. Information objects carry classification metadata that travels with them through the system, enabling consistent enforcement of access controls regardless of where data is processed or stored. Sensitive data is encrypted at rest and in transit, with keys managed through a distributed key management system that does not rely on any single trusted authority.

## 3.4 Human Authority Integration

Maintaining appropriate human authority over AI-augmented decision-making is central to BASTION's design. The system implements the authority positions described in Section 2.9 (Human-in-the-Loop, Human-on-the-Loop, Human-out-of-the-Loop) in a structured framework that matches authority requirements to decision consequences.

### Autonomy Levels by Decision Type

BASTION categorizes decisions according to their consequences and assigns appropriate autonomy levels. This categorization is encoded in smart contracts, ensuring consistent application across the coalition regardless of which nation's forces or systems are involved.

**High-Consequence Decisions** require Human-in-the-Loop (HITL) authority. These include strategic resource allocations, changes to coalition membership, modifications to governance rules, and any decision that could result in lethal effects. For HITL decisions, AI agents may analyze options, present recommendations, and prepare proposals, but no action occurs until a qualified human explicitly approves.

**Medium-Consequence Decisions** may operate with Human-on-the-Loop (HOTL) authority. The system can execute these decisions autonomously, but human operators monitor execution and can intervene to halt or modify actions. Examples include routine resource transfers within pre-approved allocations, standard operational coordination, and information sharing within established classification boundaries. HOTL authority enables operational tempo while maintaining human oversight.

**Low-Consequence Decisions** may operate with Human-out-of-the-Loop (HOOTL) authority for well-constrained scenarios. These include status reporting, routine logistics coordination, and execution of pre-approved tactical actions. Even for HOOTL decisions, all actions are recorded on the blockchain for later audit, and humans can retrospectively review agent actions and adjust autonomy levels if agents demonstrate unreliable behavior.

The categorization of specific decision types is itself a governance decision that can be adjusted through DAO proposals. If coalition partners determine that a certain class of decisions requires more human involvement, they can vote to change the autonomy level for that decision type. This flexibility enables the governance framework to evolve with operational experience.

### Strike Authorization as Special Case

One category of decision is treated as an inviolable special case: strike authorization involving lethal effects always requires Human-in-the-Loop approval, regardless of any other settings or configurations. This constraint is hardcoded in the system architecture, not merely a policy setting that could be changed through governance processes.

The rationale for this constraint reflects both ethical principles and legal requirements. International discussions on autonomous weapons systems consistently emphasize the need for meaningful human control over lethal decisions [CITATION NEEDED: International discussions on LAWS]. Military doctrine in most nations requires human authorization for weapons employment. Public trust in AI-augmented military systems depends on assurance that machines do not make life-or-death decisions autonomously.

In BASTION's implementation, strike authorization proposals are routed through a separate approval pathway that requires explicit human votes. AI agents may prepare targeting recommendations, assess collateral damage estimates, and present relevant intelligence, but they cannot approve strikes and cannot be configured to do so. The smart contract logic enforces this constraint at the protocol level, making it impossible to bypass through configuration changes or software updates.

Furthermore, strike authorization requires supermajority approval and extended deliberation periods, providing multiple opportunities for human judgment to intervene. Every strike authorization decision is logged with special audit markers that enable retrospective review and accountability. This approach ensures that BASTION's AI augmentation enhances decision quality without eroding human control over the most consequential military decisions.

### Trust Earned Through Performance

AI agent autonomy is not static; it evolves based on demonstrated performance. Agents that consistently provide accurate analysis, make reliable recommendations, and execute actions correctly can be granted increased autonomy over time. Agents that produce errors, demonstrate bias, or behave unexpectedly have their autonomy reduced.

This graduated trust approach mirrors how military organizations develop confidence in subordinate units and personnel. Just as a newly assigned officer might be given limited initial responsibility that expands as they demonstrate competence, AI agents begin with minimal autonomy and earn greater latitude through reliable performance.

The system maintains performance metrics for each agent, tracking accuracy of predictions, quality of recommendations, and reliability of execution. Human reviewers periodically assess agent performance and can adjust autonomy settings accordingly. Agents flagged for performance issues are automatically reduced to HITL authority until human operators explicitly restore higher autonomy levels.

## 3.5 Component Integration

BASTION's contribution lies not in inventing new technologies but in integrating existing technologies in novel ways to address gaps in military coordination. This section highlights the integration points that represent BASTION's systems integration novelty.

### Novel Integration Points

**DAO Governance with AI Agents.** While DAOs and AI agents each have extensive prior art, their integration for command and control applications has not been previously demonstrated. BASTION combines DAO voting and smart contract enforcement with AI agent analysis and execution, creating a system where AI augments human decision-making within a decentralized governance framework. This integration addresses the gap identified in Section 2.10: no existing systems provide frameworks for multi-stakeholder AI coordination with policy compliance and appropriate human authority.

**Blockchain with Military C2.** As documented in Section 2.4, existing blockchain applications in defense focus primarily on data integrity for supply chains and identity management. BASTION extends blockchain use to command and control governance, leveraging immutability and transparency for decision accountability rather than merely data verification. This application demonstrates that blockchain's governance capabilities, not just its data integrity properties, are valuable for military coordination.

**Multi-Level Coordination.** The three-tier DAO structure maps blockchain governance to the military levels of warfare: strategic, operational, and tactical. This mapping enables coordinated decision-making across levels while respecting the different tempo, scope, and authority requirements at each level. The inter-DAO communication mechanisms provide the strategic-to-tactical linkage that JADC2 envisions, but with decentralized governance rather than centralized control.

**Policy Encoding with Autonomous Execution.** Smart contract policy encoding enables bounded autonomy: AI agents can act quickly within policy constraints without case-by-case human approval, while policy violations are automatically prevented. This integration addresses the tradeoff between speed and compliance that characterizes traditional coalition coordination.

### Cross-Reference to Results

The following section (Section 4, Results) demonstrates these architectural components in an end-to-end scenario. The minimum viable product (MVP) system implements the three-tier DAO structure, deploys AI agents at each level, and demonstrates the human authority integration described here. Physical demonstration with robotic platforms validates that BASTION can coordinate actual assets through DAO governance and AI agent orchestration.

The Results section shows how the theoretical architecture described here translates into functioning software and hardware, providing evidence that BASTION's integration approach is not merely conceptual but practically achievable. Quantitative metrics from the demonstration validate the system's ability to accelerate coordination while maintaining appropriate human control.

---

*This section has described BASTION's architecture and the rationale for its major design decisions. The following Results section demonstrates these principles in practice through the physical proof-of-concept implementation.*

