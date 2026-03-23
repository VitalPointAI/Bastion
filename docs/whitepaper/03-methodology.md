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

### Mission Context Establishment

Before operational planning can begin, BASTION requires establishment of a mission context that defines the participants, command relationships, available resources, and operational boundaries. This setup phase translates the abstract governance architecture into a concrete operational configuration.

**Workspace Creation.** Each mission operates within an isolated workspace containing its own participant roster, command hierarchy, resource inventory, and geographic boundaries. Workspace isolation ensures that coalition members participating in multiple missions maintain appropriate separation of concerns, while cross-references enable coordination when missions overlap. Any authenticated organization member can initiate workspace creation, democratizing mission establishment while maintaining accountability through the blockchain audit trail.

**Participant Onboarding.** Mission participants join through two mechanisms: direct invitation from the organization roster for known members, and invitation links or codes for external participants. Both methods ultimately result in cryptographic identity verification through the NEAR Protocol identity layer. Upon joining, participants receive role assignments that govern their authorities within the mission context.

**Command Relationship Configuration.** BASTION implements the full spectrum of military command relationships described in Section 2.7.1: OPCON, TACON, ADCON, COCOM, and support relationships (DS, GS, GSR, R). Commanders configure these relationships through a visual editor that presents both organizational chart and matrix views. The system validates configurations, warning of circular command relationships or orphaned units while permitting overrides for non-standard situations. Critically, command relationships drive permission cascades: a commander automatically gains visibility into subordinate resources and activities based on the configured relationship type.

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

## 3.5 MDMP Governance Integration

While Sections 3.2 through 3.4 describe BASTION's foundational architecture for DAO governance and human authority, operational military planning requires a more granular governance framework that maps to established doctrinal processes. The Military Decision Making Process (MDMP), as defined in Army doctrine for Theater Army (ASCC-level) planning, provides this structure. BASTION integrates MDMP governance directly into the DAO layer, extending the foundational architecture with formal phase progression enforcement, assumption lifecycle tracking, and a safety matrix that prevents authority violations at the smart contract level.

### Five-Tier Authority Model

Section 3.4 described three human authority positions: Human-in-the-Loop, Human-on-the-Loop, and Human-out-of-the-Loop. Analysis of the 65 distinct activities within the MDMP process revealed that this three-level framework, while conceptually sound, lacks the granularity needed for operational planning governance. Some activities require AI to lead analysis with human oversight, while others require humans to lead with AI assistance. The distinction between these cases is operationally significant.

BASTION extends the authority framework to five tiers that map more precisely to MDMP activity requirements:

| Authority Level | Description | Example Activities |
|----------------|-------------|-------------------|
| AI_AUTONOMOUS | AI executes without human involvement | Data aggregation, format validation, monitoring |
| AI_PRIMARY | AI leads with human oversight | Intelligence preparation, trend analysis |
| HYBRID_AI_LED | AI generates, human reviews before action | COA development, risk assessment |
| HYBRID_HUMAN_LED | Human leads with AI assistance | Mission analysis, commander's guidance |
| HUMAN_ONLY | Human decides, AI may present information | Strike authorization, ethical judgments, risk acceptance |

Three activity categories are permanently locked to HUMAN_ONLY regardless of any governance action: AUTHORITY_DECISION (decisions about who has authority to act), ETHICAL_LEGAL (judgments involving ethical or legal reasoning), and RISK_JUDGMENT (acceptance of risk to mission or force). These locks are immutable in the smart contract implementation, reinforcing the strike authorization invariant described in Section 3.4 with a broader class of decisions that require human judgment.

The five-tier model is enforced at the smart contract level. When an AI agent attempts to execute an activity, the contract verifies that the agent's authority level is permitted for that activity's category. Transactions that violate the safety matrix are rejected before execution, providing defense in depth against both misconfiguration and adversarial manipulation of agent permissions.

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

Each assumption carries sensitivity analysis metadata indicating which planning products and decisions depend on it. When an assumption is invalidated, the system identifies all downstream products that may require revision, providing decision-makers with immediate visibility into the blast radius of changed circumstances. This capability directly addresses the challenge identified in Section 2.7: the gap between strategic intent and tactical execution widens when planning assumptions fail silently.

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

**Decide.** The fourth tab manages the transition from planning to execution and houses the decision dashboard that consolidates all pending governance decisions requiring human action. WARNORD, OPORD, and FRAGO generation produces formatted orders with classification banners and handling instructions. Task organization displays show force assignment by unit and function. Resource allocation from the registry (Section 3.10) is managed through DAO proposals at decision gates. A RACI-filtered decision queue presents pending approvals, rejections, and deferrals through PendingDecisionModal workflows. Ironclaw—the AI Chief of Staff agent—polls the decision queue every sixty seconds, proactively surfacing overdue decisions and surfacing context to inform the commander's choice. Per-team information barriers ensure that each staff role and coalition partner sees only the orders and directives relevant to their function and clearance level.

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

Each JPP staff role—Commander, Deputy Commander, Chief of Staff, J1 through J9, and specialized roles including Staff Judge Advocate, Political Advisor, Public Affairs Officer, and component commanders—receives a dedicated workspace with templated doctrinal products appropriate to their function. Templates follow service-specific formats and include the required sections, coordination fields, and approval workflows that each staff role is responsible for producing.

### Cross-Staff Coordination

Real-time notifications delivered via WebSocket alert staff members when products they depend on are updated, when coordination is requested, or when governance gates require their input. A hybrid editor combining structured fields with narrative text enables both standardized data entry and free-form analysis within each doctrinal product. Real-time product merging allows multiple staff roles to contribute to shared products (such as running estimates) simultaneously through CRDT-based conflict resolution.

### AI Staff Agent Integration

Each staff role has access to AI agent teams that automate routine doctrinal tasks within the role's functional area. The 102 JPP staff role agents in BASTION's agent library provide role-specific knowledge of doctrinal publications, product formats, and coordination requirements. Strategic direction import from the Design tab ensures that staff workspaces receive operational design outputs as context for their planning products, maintaining alignment between design intent and staff products.

## 3.13 Component Integration

BASTION's contribution lies not in inventing new technologies but in integrating existing technologies in novel ways to address gaps in military coordination. This section highlights the integration points that represent BASTION's systems integration novelty, including the MDMP governance and escalation modeling capabilities described in Sections 3.5 and 3.6, and the doctrinal lifecycle, COP generation, resource registry, and training mode capabilities described in Sections 3.7–3.12.

### Novel Integration Points

**DAO Governance with AI Agents.** While DAOs and AI agents each have extensive prior art, their integration for command and control applications has not been previously demonstrated. BASTION combines DAO voting and smart contract enforcement with AI agent analysis and execution, creating a system where AI augments human decision-making within a decentralized governance framework. This integration addresses the gap identified in Section 2.10: no existing systems provide frameworks for multi-stakeholder AI coordination with policy compliance and appropriate human authority.

**Blockchain with Military C2.** As documented in Section 2.4, existing blockchain applications in defense focus primarily on data integrity for supply chains and identity management. BASTION extends blockchain use to command and control governance, leveraging immutability and transparency for decision accountability rather than merely data verification. This application demonstrates that blockchain's governance capabilities, not just its data integrity properties, are valuable for military coordination.

**Multi-Level Coordination.** The three-tier DAO structure maps blockchain governance to the military levels of warfare: strategic, operational, and tactical. This mapping enables coordinated decision-making across levels while respecting the different tempo, scope, and authority requirements at each level. The inter-DAO communication mechanisms provide the strategic-to-tactical linkage that JADC2 envisions, but with decentralized governance rather than centralized control.

**Policy Encoding with Autonomous Execution.** Smart contract policy encoding enables bounded autonomy: AI agents can act quickly within policy constraints without case-by-case human approval, while policy violations are automatically prevented. This integration addresses the tradeoff between speed and compliance that characterizes traditional coalition coordination.

**Doctrinal Process Governance with Blockchain Enforcement.** The integration of MDMP doctrinal processes with DAO governance gates represents a novel application of blockchain to military planning process enforcement. While MDMP checklists and phase gates exist in doctrine, they are traditionally enforced through procedural discipline rather than technical controls. BASTION encodes these gates as smart contract conditions that must be satisfied through DAO proposals before workflow advancement, transforming doctrinal guidance into enforceable governance. The assumption lifecycle management system further demonstrates this integration: planning assumptions that would traditionally be tracked in spreadsheets or staff notes become blockchain-recorded artifacts with formal acceptance requirements, invalidation triggers, and automatic replanning workflows.

**Adversary Modeling with Governance-Aware Wargaming.** The integration of AI-driven adversary modeling, escalation simulation, and effects analysis with the MDMP governance framework ensures that analytical rigor is both enabled by AI speed and bounded by governance controls. Wargaming results feed directly into RedTeamGate checks that must be satisfied before COA approval, creating a closed loop between AI analysis and governance enforcement that prevents premature commitment to courses of action that have not been adequately challenged.

**Doctrine-First Interface Design with Lifecycle Governance.** The six-tab doctrinal lifecycle (Section 3.7) integrates UI structure with the governance framework: each tab corresponds to a planning phase with associated governance gates, and tab transitions mirror the iterative planning process described in JP 5-0. This integration ensures that the interface reinforces doctrinal thinking rather than allowing planners to shortcut governance requirements through arbitrary navigation.

**Autonomous COP Generation with Governance Review.** The AI COP layer generation system (Section 3.9) integrates document analysis, symbol generation, and governance review in a pipeline where AI agents produce operational picture content but human review gates control what reaches the shared COP. This integration demonstrates that AI can accelerate operational picture construction while governance ensures quality control over the information that informs command decisions.

**Resource Identity with DAO Governance.** The resource DID architecture (Section 3.10) integrates blockchain identity, plugin-based resource management, and DAO governance for allocation decisions. Resources are not merely tracked in a database; they are blockchain-verified entities whose assignment flows through the same governance mechanisms used for strategic decisions, providing end-to-end accountability from resource registration through employment.

**Training-Operational Mode Parity.** The global mode architecture (Section 3.11) integrates with every other subsystem to ensure that exercise environments are indistinguishable from operational environments in governance behavior. This integration validates that training exercises truly exercise the governance mechanisms, addressing the common problem of training systems that simplify governance for convenience.

### Cross-Reference to Results

The following section (Section 4, Results) demonstrates these architectural components in an end-to-end scenario. The minimum viable product (MVP) system implements the three-tier DAO structure, deploys 131 AI agents across governance, planning, intelligence, and staff functions, and demonstrates the human authority integration described here. The MDMP governance framework (Section 3.5), escalation modeling capabilities (Section 3.6), doctrinal lifecycle interface (Section 3.7), COP generation (Section 3.9), resource registry (Section 3.10), and training mode architecture (Section 3.11) collectively provide a comprehensive military planning and execution environment that extends well beyond the initial demonstration scope.

The Results section shows how the theoretical architecture described here translates into functioning software and hardware, providing evidence that BASTION's integration approach is not merely conceptual but practically achievable. Quantitative metrics from the implementation validate the system's ability to accelerate coordination while maintaining appropriate human control.

## 3.14 Robot Integration Architecture

Physical domain augmentation requires bridging the gap between cloud-resident governance infrastructure and edge-deployed autonomous systems operating in contested, bandwidth-limited environments. BASTION's robot integration architecture resolves this tension through a Docker-based local network bridge that mediates communication between the NEAR blockchain and physical robotic platforms, avoiding the latency, dependency, and security vulnerabilities associated with direct cloud-to-robot connectivity.

### Bridge Architecture and Self-Registration

The Docker bridge runs as a containerized service on a local network accessible to both the BASTION application server and the robot's on-board Python agent. Rather than requiring the cloud platform to initiate contact with the robot—an approach that introduces firewall traversal complexity and creates a command dependency—the Python robot agent establishes an outbound WebSocket connection to the bridge at startup, self-registering with a cryptographically signed DID credential. This self-registration pattern eliminates the need for static IP configuration or VPN tunneling: the robot registers itself with the system rather than waiting to be discovered.

Multicast DNS (mDNS) auto-discovery enables the bridge to locate robot agents on the local network without manual configuration. When a Python robot agent starts, it advertises its presence via mDNS; the bridge discovers the advertisement and completes the WebSocket handshake. This zero-configuration approach is critical for field deployment where network administrators may not be available to configure static routes or DNS entries.

### Mission Intent Translation

BASTION issues missions as structured intent objects specifying objective, parameters, and DID-encoded constraints. The Python robot agent receives these intent objects and translates them into platform-specific command sequences through an LLM-based translation layer with a deterministic template fallback. The LLM path handles novel mission specifications by reasoning about platform capabilities and composing appropriate command sequences; the template path ensures reliable execution for the four established vision-enabled mission types: `recon_area`, `visual_search`, `overwatch`, and `resupply_route`. Pre-flight DID constraint validation confirms that the robot's registered capabilities match the mission's requirements before execution begins, preventing mission assignment to platforms that cannot complete the specified task [CITATION NEEDED: autonomous mission planning literature].

### Vision Pipeline

The robot vision pipeline runs on an NVIDIA Jetson Orin Nano edge computing module at the robot platform, providing onboard inference without dependence on cloud connectivity. A CSI camera feeds raw frames into NVIDIA detectNet for object detection and classification, producing bounding boxes with confidence scores for entities of tactical interest. ORB (Oriented FAST and Rotated BRIEF) feature matching performs re-identification across video frames, enabling the system to track previously detected entities across discontinuous observation windows. Detection results stream back through the bridge to the BASTION COP layer, where they appear as resource-linked intelligence contributions subject to the governance review cycle described in Section 3.9 [CITATION NEEDED: edge AI for military robotics].

## 3.15 Knowledge Graph Architecture

Operational intelligence exists as a distributed, heterogeneous collection of documents, orders, signals intelligence, and human reporting. Extracting actionable knowledge from this corpus requires a semantic layer that moves beyond keyword search to represent entities, relationships, and temporal context in a machine-queryable form. BASTION implements a knowledge graph—termed the "brain"—as the semantic substrate for intelligence integration across the platform.

### JSON-LD Semantic Brain

The brain is stored as JSON-LD (JSON Linked Data), a lightweight serialization of RDF that enables semantic annotation of knowledge graph nodes without requiring a dedicated triple store. JSON-LD's use of `@context` declarations links BASTION's entity vocabulary to established upper ontologies: Basic Formal Ontology (BFO), the Common Core Ontologies (CCO), and the conceptual structures of DODAF and DNDAF architectural frameworks. This ontological alignment ensures that BASTION's knowledge graph is interpretable against existing defense data standards and can exchange structured data with compliant systems [CITATION NEEDED: defense ontology standards].

### Entity Resolution and Confidence Scoring

Multi-source intelligence produces redundant and sometimes contradictory entity references. A dedicated entity resolution subsystem identifies co-references across documents—recognizing, for example, that "the 3rd Brigade," "3 BDE," and "the Vanguard Brigade" all refer to the same tactical entity—and merges them into a single graph node with provenance pointers to each source. Confidence scoring follows NATO intelligence source reliability and information credibility ratings (the STANAG 2511 two-character code scheme), attaching reliability grades to each knowledge contribution. Graph nodes therefore carry not just their attribute values but calibrated uncertainty metadata that downstream analytical agents can use to weight evidence appropriately [CITATION NEEDED: intelligence confidence scoring methodology].

### Brain Visualization and Temporal Reasoning

A force-directed neural canvas renders the knowledge graph as an interactive visual interface that presents nodes sized by relationship density and edges colored by relationship type. This visualization enables analysts to identify clusters of highly connected entities—potential centers of gravity or critical nodes—and trace relationship chains that might indicate adversary intent or capability. A brain timeline provides temporal reasoning capability: analysts can advance the timeline to observe how the graph state evolves as intelligence is incorporated over the course of an exercise or operation, identifying knowledge gaps and tracking adversary activity patterns across time.

## 3.16 Swarm Leadership and Doctrinal Formations

Heterogeneous robotic swarms operating in contested environments require coordinated behavior that degrades gracefully when communication is disrupted. BASTION's swarm architecture designates a single vision-equipped platform—the Sphero RVR+—as the swarm leader, leveraging its onboard NVIDIA processing and CSI camera to provide situational awareness for the entire formation while coordinating heterogeneous subordinate platforms.

### Formation Control

Six doctrinal formations derived from Army tactical movement doctrine govern swarm geometry: wedge, line, column, echelon left, echelon right, vee, and staggered column. Four movement techniques—traveling, traveling overwatch, bounding overwatch, and successive bounds—define the temporal pattern of advance. Formation parameters (spacing, interval, lead platform designation) are encoded in the mission intent object and transmitted to swarm members through the bridge. The swarm leader broadcasts position updates and formation correction signals, and subordinate platforms adjust their positions to maintain prescribed spacing relative to the leader's position [CITATION NEEDED: autonomous swarm coordination].

### UDP Broadcast Peer Mesh

In DDIL environments where bridge connectivity may be intermittent, swarm members maintain peer-to-peer coordination through a UDP broadcast mesh running on the local robot network. The mesh enables swarm members to share position data and formation status without routing through the cloud bridge, ensuring that formation cohesion and collision avoidance operate independently of external connectivity. When bridge connectivity is restored, the swarm leader synchronizes accumulated state back to BASTION through the WebSocket connection.

### DAO-Driven Swarm Membership

Swarm composition is governed by the Tactical DAO. Adding a new platform to a swarm or removing a degraded platform requires a DAO proposal that records the membership change on the blockchain, associating each platform's DID with the swarm mission. This governance approach ensures that swarm composition is tracked with the same accountability as human force assignment decisions. The leader shares its vision feed with swarm members that lack independent visual sensing capability, enabling collective situational awareness proportional to the leader's detection range.

## 3.17 Document Intelligence Pipeline

Military planning generates and consumes large volumes of unstructured text. Intelligence reports, orders, doctrine publications, and exercise scenario packages arrive in diverse formats and must be integrated into a coherent operational picture. BASTION's document intelligence pipeline applies a multi-agent processing team to each ingested document, extracting structured knowledge and inserting it into the brain graph in a form that downstream analytical agents can query.

### Multi-Agent Processing Team

Each document is processed by a team of ten specialist agents operating in a coordinated pipeline: an orchestrator that manages pipeline state and resolves conflicts between agent outputs; a converter that transforms source documents from PDF, DOCX, and other formats to normalized text; a classifier that categorizes documents by type, team assignment, and exercise phase; three perspective analysts that extract content from Blue, Red, and White team perspectives with strict information isolation; a fact extractor that identifies discrete factual claims; an objective extractor that identifies stated goals and intentions; a linker that resolves entity mentions to existing brain graph nodes or creates new nodes for novel entities; a bias identifier that flags potential analytical bias or coverage gaps in the document; and a quality assessor that grades the document's reliability and completeness using NATO source reliability ratings [CITATION NEEDED: multi-agent information extraction].

### Scoping Interview and Gap Identification

Before document upload, an AI-led scoping interview captures the boundaries of the current problem set: geographic area of interest, time period, key actors, and classification context. These boundaries constrain the linker and fact extractor, preventing false entity resolution and scope creep. Following extraction, the pipeline generates standing intelligence requirements that identify knowledge gaps—questions about entities or relationships that source documents do not address—and triggers autonomous web search and OSINT processes to fill identified gaps within the defined scope boundaries.

### ExtractionTheater Visualization

An ExtractionTheater component presents live visualization of pipeline progress to planning staff, showing which agents are processing which documents, what entities have been extracted, and which gaps have been identified. This transparency enables analysts to monitor extraction quality in real time and intervene when the pipeline produces incorrect or incomplete outputs, maintaining human oversight over the automated intelligence processing workflow.

## 3.18 Hierarchical Problem Set Inheritance

Joint operations involve parallel and nested planning efforts: strategic campaigns that spawn operational missions, operational missions that spawn tactical subordinate actions, and FRAGO updates that must propagate across multiple levels simultaneously. BASTION's hierarchical problem set architecture formalizes these relationships, enabling structured context propagation from higher to lower echelons and upward reporting from tactical execution to campaign assessment.

### Context Propagation

Strategic-level problem sets serve as context providers for child operational and tactical problem sets. When a strategic problem set is created, commanders designate which directives, policies, and intelligence products are eligible for inheritance by subordinate problem sets. Child problem sets inherit this context automatically at creation and receive push notifications when inherited content changes, enabling subordinate planners to identify when strategic guidance has been updated and assess the impact on their plans. Override tracking records when a subordinate problem set deviates from inherited guidance, providing parent echelon visibility into plan divergence with documented rationale [CITATION NEEDED: hierarchical planning systems].

### OPORD-Triggered Mission Creation

When an OPORD is published in an operational problem set, the system identifies subordinate units and generates a tactical child problem set for each assigned unit, automatically populating the child problem set with the relevant portions of the parent OPORD as inherited context. This automation eliminates the manual transcription of orders across planning levels and ensures that tactical planners begin their work with correct, current guidance from the operational command. FRAGO propagation follows the same pattern: when a parent problem set issues a FRAGO, affected child problem sets receive notification and can apply the fragmentary order to their own plans.

### Upward Reporting

Tactical execution generates assessment data—task completion status, resource consumption, engagement outcomes—that strategic and operational commanders require for running estimates. BASTION's upward reporting mechanism aggregates tactical COP state and execution status from child problem sets, surfacing it in parent problem set assessment dashboards without requiring manual reporting from subordinate staffs. This automation closes the information loop from tactical action to strategic assessment, enabling the continuous operational assessment described in JP 5-0.

## 3.19 Operational Design Workspace

The transition from operational art to operational science—from understanding the problem to developing a plan to solve it—is the most demanding cognitive task in military planning. JP 5-0 defines operational design as the application of creative thinking and operational art to design an approach to solve the problem; BASTION provides dedicated tooling that structures this creative process without constraining it.

### Center of Gravity Analysis

The operational design workspace implements Strange's CG-CC-CR-CV analytical framework for both friendly and adversary forces. Commanders and staff identify each force's Center of Gravity, decompose it into Critical Capabilities and Critical Requirements, and analyze Critical Vulnerabilities that opposing action could exploit. AI agents assist by cross-referencing identified critical capabilities against available intelligence in the brain graph, surfacing evidence that supports or challenges each analytical judgment and generating alternative decompositions for staff consideration. The analysis products feed directly into operational approach development and inform the targeting priorities encoded in planning products [CITATION NEEDED: center of gravity analysis methodology].

### Lines of Effort and Operational Approach

Lines of effort and lines of operation are defined visually with explicit linkages to strategic objectives and decisive points. The operational approach builder synthesizes center of gravity analysis and lines of effort into a phased operational approach, with AI-assisted recommendations for sequencing and resource alignment. The design-to-plan handoff exports operational design outputs directly as structured inputs to mission analysis in the Plan tab, maintaining analytical continuity between the design and planning phases.

### Fork-and-Merge Revision System

As planning proceeds, new intelligence or changed conditions may require operational design revision. BASTION implements a fork-and-merge revision system analogous to version control: a staff member proposes a design revision by forking the current approved design, developing the proposed change in isolation, and submitting a merge request that presents the diff between current and proposed designs. DAO governance gates require review and approval of design revisions before they replace the baseline, ensuring that approved designs are not modified unilaterally and that revision rationale is preserved in the governance record.

## 3.20 Training Assessment and Readiness

Military readiness is a continuous assessment process, not a binary state. BASTION's training assessment architecture provides structured mechanisms for capturing training event outcomes, tracking proficiency over time, and aggregating readiness data from unit level through campaign level to support commander decision-making about training investment priorities.

### After-Action Review Capture

After-action review (AAR) capture at training events provides structured recording of observed outcomes, identified strengths, areas requiring improvement, and corrective action assignments. AAR records are linked to the training event, the units and personnel who participated, and the doctrinal tasks that were exercised, enabling longitudinal tracking of performance across multiple training iterations. AAR outputs feed into the proficiency tracking subsystem as assessment inputs.

### METL Proficiency Tracking

Mission Essential Task List (METL) proficiency is tracked using the standard T/P/U (Trained, Practice, Untrained) assessment scale for each doctrinal task. Proficiency assessments from individual training events are aggregated by unit, task, and time period to produce proficiency trend lines that reveal whether unit capability is improving, degrading, or static. Commanders can drill down from aggregate readiness scores to individual task assessments to understand the specific training gaps driving readiness shortfalls.

### Upward Aggregation and Training Readiness Dashboard

Training readiness data aggregates from tactical training events through exercises to strategic training programs using the same hierarchical problem set inheritance architecture described in Section 3.18. A training readiness dashboard presents proficiency trends, upcoming training milestones, and readiness projections for scheduled operational commitments. The Pacific Strategy AY26 scenario package serves as the operational demonstration data package for this capability, providing a complete multi-echelon exercise scenario—spanning six phases from Competition through Negotiation—that exercises the full training assessment pipeline from event capture through strategic readiness aggregation [CITATION NEEDED: military readiness assessment frameworks].

---

*This section has described BASTION's architecture, the MDMP governance integration, the escalation and competition modeling capabilities, the doctrinal lifecycle interface, IPB cycle, COP generation, resource registry, training mode, staff organization, robot integration, knowledge graph, swarm leadership, document intelligence pipeline, hierarchical problem set inheritance, operational design workspace, and training assessment architecture. The following Results section demonstrates these principles in practice through the implementation and physical proof-of-concept.*

