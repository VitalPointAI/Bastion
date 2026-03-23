# 5. Discussion

The Results section demonstrated BASTION's capabilities through an end-to-end scenario connecting strategic objectives to tactical execution. This section provides a balanced assessment of the platform's current state, examining limitations, risks, ethical considerations, and directions for future work. Honest acknowledgment of these factors is essential for understanding what BASTION has achieved and what remains to be demonstrated before operational deployment.

## 5.0 Lessons Learned

BASTION's development across 53 phases and 442 plans over approximately ten weeks produced a set of lessons that extend beyond the technical findings. These lessons are relevant to researchers, developers, and acquisition officials considering AI-enabled C2 systems at comparable scale and velocity.

### Iterative Development Velocity

Fifty-three development phases were completed in approximately ten weeks, a pace that would be difficult to achieve with traditional software development teams. This velocity derived from several factors: a modular architecture that minimized coupling between capability areas, a wave-based execution pattern that allowed parallelizable tasks to proceed concurrently, and a plan-execute-commit discipline that maintained granular reversibility throughout. The lesson is not that AI development is inherently fast, but that disciplined decomposition and commit hygiene enable rapid iteration without accumulating technical debt that forces rework.

### AI-Augmented Development as Multiplier

BASTION was implemented with AI assistance (Claude) as an implementation partner for code generation, documentation, and plan refinement. This partnership demonstrated a capability multiplier pattern: human architectural judgment and domain expertise directed AI code generation, which in turn enabled the human to maintain focus on design decisions rather than implementation mechanics. The lesson for defense software acquisition is that AI-augmented development teams can achieve capability coverage that would require significantly larger conventional teams, though the quality of AI contribution depends critically on the quality of human guidance and review.

### Doctrinal Alignment Improves User Mental Model

The restructure from a functional tab layout (Decide, Design, Campaign, Monitor) to a doctrinal lifecycle layout (Understand, Design, Plan, Decide, COP, Assess) aligned with JP 5-0 produced measurable improvements in user navigation behavior during exercise scenarios. Staff officers navigating the doctrinal layout found their work location more predictable because the interface mirrored the planning process they were already trained to execute. The lesson is that military software adoption friction is reduced when interface structure derives from doctrine rather than from software architecture conventions.

### Edge Integration Complexity Is Tractable

The robot bridge pattern—Docker-containerized Python agent with mDNS auto-discovery, serial command proxy to Jetson hardware—solved a control plane integration challenge that initial assessments considered high-risk. The key insight was separating the control plane concern (how cloud governance commands reach the robot) from the execution concern (how the robot carries out those commands). The bridge handled the control plane; the existing Jetson runtime handled execution. This separation made the integration tractable without requiring changes to either system. The lesson for edge-AI system integrators is that bridge-pattern architectures reduce integration complexity by maintaining clean boundaries between governance infrastructure and physical execution systems.

### Knowledge Graph Scaling Required Progressive Disclosure

The adaptive brain visualization developed in Phase 41 revealed that knowledge graph interfaces become unusable at operational scale without progressive disclosure mechanisms. Rendering a complete RAFT graph for a Pacific Strategy AY26 scenario—with hundreds of actors, relationships, and tensions—produces a visual that conveys no information. Subspace filtering, semantic lens overlays, and timeline-based graph animation were required to make the knowledge graph useful rather than impressive. The lesson for knowledge graph interface designers is that scale and usability are in direct tension; progressive disclosure is not an enhancement but a prerequisite for graphs beyond toy-problem size.

### Governance Integration at Decision Gates

An early architectural option placed DAO governance in a dedicated governance tab separate from planning workflow. This design was replaced by embedding governance proposals at natural planning decision gates—the Decide tab and inline workflow prompts. The embedded approach produced significantly higher governance engagement: proposals surfaced in workflow context were acted on more quickly than proposals requiring navigation to a separate governance view. The lesson is that governance integration must meet users where they work; dedicated governance interfaces compete with operational urgency and lose.

## 5.1 Limitations

### Demonstration Scope

The physical demonstration described in Section 4.3 validates BASTION's core concepts but operates within a bounded proof-of-concept scope. Several limitations distinguish the demonstration from operational reality.

First, the demonstration operates in a controlled tabletop environment rather than a realistic operational setting. The physical area of operations model simplifies terrain, distances, and environmental factors that would affect real tactical operations. Target identification occurs under optimal lighting and positioning conditions that may not be achievable in field environments. The demonstration validates that DAO governance can coordinate physical systems, but it does not prove performance under the full range of conditions that military operations encounter.

Second, the coalition simulation involves notional partners rather than actual multi-national participation. While the DAO governance mechanisms support weighted voting and caveat enforcement across coalition members, the demonstration does not test the diplomatic and procedural challenges of actual multi-national coordination. Real coalition operations involve negotiation, differing interpretations of agreements, and political dynamics that cannot be simulated through software alone.

Third, the demonstration limits autonomous operations to a single platform (the Sphero RVR+ with Jetson Orin Nano). Real military operations would involve multiple heterogeneous platforms, each with different capabilities, communication requirements, and failure modes. Scaling from single-platform demonstration to multi-platform operations introduces coordination challenges that BASTION's architecture is designed to address but has not yet demonstrated at scale.

### Technology Maturity

Several enabling technologies underlying BASTION remain at relatively early stages of maturity for military applications.

Blockchain throughput represents a potential constraint for operational tempo. While NEAR Protocol provides approximately two-second transaction finality and high theoretical throughput, sustained high-volume operations could stress the network's capacity [CITATION NEEDED]. Tactical operations generating thousands of transactions per minute during peak activity would require careful capacity planning and potentially private network deployment to ensure consistent performance. The demonstration operates well within current throughput limits, but scaling to operational volumes requires further validation.

AI agent reliability for high-stakes military decision support remains an active research area. Large language models can produce confident but incorrect outputs (hallucinations), may exhibit unexpected behavior on edge cases, and can be susceptible to adversarial inputs designed to manipulate their responses [CITATION NEEDED]. BASTION's architecture mitigates these risks through human checkpoints and graduated autonomy, but AI agent behavior in operational environments cannot be fully characterized through demonstration alone.

Edge AI model accuracy on tactical platforms like the Jetson Orin Nano involves tradeoffs between model size, inference speed, and accuracy. Models small enough to run on edge hardware with acceptable latency may not achieve the accuracy of larger models running on cloud infrastructure. The demonstration uses optimized models suitable for the demonstration environment, but operational deployment would require validation against military performance requirements that may exceed demonstration capabilities.

Trusted Execution Environment (TEE) availability in tactical environments presents deployment challenges. BASTION's architecture leverages Phala Network TEEs for confidential computing, but ruggedized hardware with TEE support may not be available for all tactical platforms. Extending confidential computing to edge devices in austere environments requires hardware solutions that are still maturing.

### Resolved Limitations

Several limitations identified in the original assessment (January 2026) have been addressed by subsequent development through March 2026:

**Functional vs. doctrinal interface.** The original four-tab functional layout (Decide, Design, Campaign, Monitor) imposed a software-centric workflow rather than following military doctrine. The doctrinal tab restructure (Section 3.7) replaced this with a six-tab lifecycle (Understand, Design, Plan, Decide, COP, Assess) aligned to JP 5-0, directly addressing the mismatch between interface structure and doctrinal process. *(Resolved in v0.2)*

**No operational design capability.** The original system lacked dedicated operational design tools, leaving a gap between strategic guidance and course of action development. The Design tab (Section 3.7) now provides problem framing, center of gravity analysis, lines of effort/operation, and operational approach development with AI assistance. *(Resolved in v0.2)*

**No common operating picture generation.** The original system provided planning tools but no automated COP generation. AI COP layer agents (Section 3.9) now autonomously generate MIL-STD-2525D overlays from planning documents. *(Resolved in v0.2)*

**No exercise/training separation.** The original system had no mechanism to distinguish training from operational use. The training/operational mode toggle (Section 3.11) provides global mode switching with data isolation and identical governance. *(Resolved in v0.2)*

**Limited staff organization.** The original system did not organize users by staff role or provide role-specific workspaces. The JPP staff organization (Section 3.12) provides per-role workspaces with templated doctrinal products for all joint staff positions. *(Resolved in v0.2)*

**Single-platform physical demonstration.** The original demonstration validated concepts using a single robot platform, limiting the evidence for multi-asset coordination. The swarm leadership capability (Section 4.4) demonstrated three-platform coalition coordination with six doctrinal formations and a UDP peer mesh. *(Resolved in v0.2)*

**No intelligence extraction pipeline.** The original system depended on manual document analysis for intelligence input. The autonomous document intelligence team (Phase 40) implemented a multi-agent pipeline with source reliability rating, scoping interviews, and NATO confidence tiers. *(Resolved in v0.2)*

**No decision governance interface.** The original system exposed DAO governance through a dedicated governance tab that required deliberate navigation. The Decide tab (Phase 53) embedded governance proposals, RACI-filtered decision queues, and inline approval workflows at the natural decision workflow location. *(Resolved in v0.2)*

### Remaining Limitations — Operational Realism

The tabletop demonstration necessarily simplifies aspects of military operations that would affect real-world deployment.

BASTION's ROE enforcement engine and dedicated ROE Compliance agent provide declarative rule evaluation with commander override workflows and blockchain audit trails. However, operational ROE involve nuanced conditions, graduated responses, and situation-specific exceptions that require human interpretation beyond what declarative rules can capture. The ROE Compliance agent can validate planned actions against encoded constraints, but encoding the full complexity of ROE interpretation—particularly for edge cases requiring legal judgment—remains a challenge that the system addresses through human authority checkpoints rather than attempting complete automation.

Coalition dynamics in the demonstration are cooperative by design. All simulated coalition members vote according to expected patterns without the disagreement, delay, or defection that real coalitions experience. BASTION's governance mechanisms handle voting and quorum requirements, but the demonstration does not test behavior when coalition partners disagree on fundamental approaches or when political considerations override operational logic.

DDIL (Disconnected, Degraded, Intermittent, Limited-bandwidth) resilience is architecturally supported but not fully tested. BASTION's design enables edge operations with local governance state, but the demonstration maintains continuous connectivity. Extended disconnection scenarios, reconnection reconciliation, and operation under sustained degraded conditions require additional testing to validate the architecture's resilience claims.

### Explicit Limitations — v0.2

The following limitations apply specifically to the current v0.2 implementation and define the boundary between what has been demonstrated and what remains unvalidated.

**Demonstration scope vs. operational reality.** The demonstration runs in a laboratory environment with controlled conditions: known lighting for vision, predetermined target placement, cooperative simulated coalition members, and continuous network connectivity. Operational military environments involve contested electromagnetic spectrum, adversarial deception, coalition friction, and intermittent communications. The demonstration validates that the architecture functions; it does not validate that the architecture performs to military standards under realistic operational conditions. Performance claims require field validation under military test and evaluation protocols.

**AI reliability in intelligence extraction.** The OSINT extraction and document intelligence pipeline applies confidence scoring to extracted claims, but the scoring system uses category-level confidence tiers rather than claim-by-claim reliability assessment. LLM hallucination risk—the generation of plausible but factually incorrect analysis—is mitigated by human review gates but not eliminated. In intelligence contexts where incorrect analysis can have strategic consequences, the current AI reliability posture is appropriate for decision support but not for automated decision-making without human review [CITATION NEEDED].

**Swarm scale.** The swarm leadership demonstration involved three platforms. Military swarm operations of operational significance are likely to involve ten to one hundred or more platforms. Coordination complexity, communication channel capacity, leadership election convergence, and formation maintenance all scale non-linearly with platform count. The three-platform result demonstrates feasibility of the architecture but does not extrapolate directly to operational swarm sizes [CITATION NEEDED].

**Network dependency.** The BASTION backend requires WebSocket connectivity for real-time agent coordination and blockchain transaction processing. DDIL degradation effects on the operational tempo of the governance workflow have not been stress-tested at scale. The swarm UDP peer mesh provides intra-swarm resilience, but the full planning-to-execution pipeline assumes sufficient connectivity to the BASTION backend. Extended operation without backend connectivity requires additional edge autonomy not yet implemented.

**Single-user testing.** All doctrinal workflow testing used single-user sessions. Coalition multi-user concurrent planning—multiple staff officers modifying plans, generating COP layers, and voting on proposals simultaneously—has not been stress-tested for race conditions, lock contention, or consistency violations. The architecture uses database transactions and blockchain consensus to enforce consistency, but behavior under concurrent planning loads requires empirical validation.

## 5.2 Risk Analysis

### Technical Risks

Blockchain network availability presents a foundational risk. While decentralized architecture eliminates single points of failure within the network, the network itself must remain accessible to participants. In contested environments, adversaries might attempt to disrupt blockchain nodes through cyber attacks, denial of service, or kinetic targeting of infrastructure. Mitigating this risk requires geographic distribution, redundant communication paths, and potentially private network deployment for operational security.

Smart contract bugs pose particular concern because blockchain immutability means deployed contracts cannot be patched. A bug in governance logic could allow unauthorized actions, block legitimate operations, or create inconsistent state. BASTION addresses this risk through extensive testing and formal verification where possible, but no testing regime can guarantee the absence of all bugs. Upgrade mechanisms exist but introduce their own governance complexity. The demonstration uses contracts that have undergone unit testing and integration testing, but operational deployment would require additional security audit and formal verification.

AI model drift and hallucination represent ongoing risks in AI-augmented systems. Model performance may degrade over time as operational environments evolve beyond training data distributions. Language models may generate plausible but factually incorrect analysis that human reviewers fail to catch. BASTION's human checkpoint requirements provide defense against these risks, but they depend on human reviewers maintaining sufficient expertise and attention to identify AI errors.

Key management complexity scales with system scale and participant diversity. Each DAO member, AI agent, and system component requires cryptographic key management. Loss of keys could lock participants out of governance. Compromise of keys could enable unauthorized actions. BASTION implements key derivation and recovery mechanisms, but operational deployment requires comprehensive key management procedures that extend beyond the demonstration scope.

### Security Risks

Quantum computing developments pose a long-term threat to current cryptographic systems. While cryptographically relevant quantum computers do not yet exist, data protected today may face quantum attack during its classification lifetime. BASTION incorporates post-quantum cryptography considerations and cryptographic agility, but the timeline for quantum threats remains uncertain. Migration to fully post-quantum cryptography requires standards maturation and implementation validation that are still in progress [CITATION NEEDED].

Trusted Execution Environments, while providing hardware-based security isolation, are not invulnerable. Side-channel attacks have successfully extracted secrets from TEE implementations [CITATION NEEDED]. BASTION's use of Phala Network TEEs provides significant security benefits, but defenders should not assume TEEs provide absolute protection against sophisticated adversaries.

Insider threats represent a risk category that technical measures can only partially address. A trusted insider with legitimate access could exploit their position to manipulate governance outcomes, exfiltrate sensitive information, or sabotage operations. BASTION's audit trail provides accountability and forensic capability after the fact, but prevention relies on personnel security measures outside the system's scope.

Classification spillage risk exists whenever systems handle multiple classification levels. BASTION's architecture supports multi-level operation through encryption and access controls, but implementation errors or operational mistakes could allow classified information to flow to unauthorized recipients. The demonstration operates with unclassified data only; operational deployment with classified information would require security accreditation demonstrating that multi-level security properties are maintained.

### Operational Risks

Over-reliance on automation could erode the human judgment that BASTION is designed to preserve. If operators come to trust AI recommendations uncritically, the human checkpoints that provide accountability become formalities rather than meaningful oversight. Maintaining appropriate human engagement requires training, culture, and interface design that keep humans cognitively engaged rather than passively approving AI outputs.

Human skill atrophy may occur as AI agents assume functions previously performed by humans. Staff officers who rely on AI for planning analysis may lose the ability to perform that analysis manually if AI systems become unavailable. This risk is common to any automation and must be addressed through training and exercise programs that maintain human capability independent of AI augmentation.

Decision fatigue could result if approval gates are too numerous or too frequent. Human oversight is only meaningful if reviewers have sufficient cognitive resources to evaluate each decision thoughtfully. An excessive number of approval requirements could lead to rubber-stamp approvals that provide accountability theater without genuine human judgment. The MDMP governance integration (Section 3.5) introduces 18 governance gates across 9 planning phases, each requiring human engagement. While these gates enforce doctrinal rigor, they also increase the cognitive burden on commanders and staff. BASTION's five-tier authority model mitigates this risk by reserving HUMAN_ONLY authority for genuinely consequential decisions while delegating routine validation to AI_AUTONOMOUS and AI_PRIMARY tiers, but calibrating the boundary between tiers requires operational experience with real planning workloads.

Coalition partner adoption barriers may limit BASTION's effectiveness for multi-national operations. Partners may be reluctant to adopt new governance mechanisms, particularly those involving blockchain technology with which they have limited experience. Integration with existing coalition systems and procedures requires diplomatic and technical work beyond system development. The demonstration validates technical feasibility, but operational adoption requires building consensus among coalition partners with different priorities and capabilities.

### Complexity Growth Risks

The expansion from 23 to 131 AI agents, from 5 to 12 smart contract modules, and from ~100 to ~417 REST endpoints introduces risks associated with system complexity growth.

**AI agent proliferation management.** As the agent count grows, maintaining quality, consistency, and appropriate oversight across all agents becomes increasingly challenging. Each agent requires prompt engineering, testing, and monitoring. Interactions between agents may produce emergent behaviors that are difficult to predict or audit. The JPP staff role agents (102 agents) share a common architecture but each carries role-specific doctrinal knowledge that must be validated against actual military publications.

**Plugin architecture extensibility.** The resource registry's plugin architecture (Section 3.10) demonstrates that new resource types can be added without modifying core code. However, this extensibility introduces a maintenance surface: each plugin's schema, state machine, capabilities, data handler, and COP renderer must be maintained and tested independently. As the plugin library grows, integration testing across plugin combinations becomes increasingly important.

**Doctrinal alignment validation.** The six-tab structure claims alignment with JP 5-0, but validating that alignment requires subject matter expert review beyond what automated testing can provide. How the system maps abstract doctrinal concepts to concrete interface elements involves interpretation that may differ between doctrinal communities. Exercises with military planners would provide the most meaningful validation.

**Training mode governance fidelity.** While the training mode implements identical governance mechanisms, the question of whether exercises conducted with identical governance truly capture the dynamics of operational decision-making remains open. Exercise participants may behave differently when they know consequences are simulated, potentially reducing the training value of governance-parity design.

### Updated Risk Posture

Several technical risks have been reduced by implementation maturity. The blockchain integration layer is now validated across 31 phases of development with consistent transaction patterns. Authentication is stable with passkey-based WebAuthn replacing the earlier Privy dependency. DAO voting has been exercised across multiple governance contexts. The MDMP governance framework has been validated through exercise scenarios.

New risks have emerged from the expanded scope: the larger codebase requires more comprehensive testing; the greater number of AI agents increases the surface area for prompt injection or adversarial manipulation; and the doctrinal claims require validation from military subject matter experts that has not yet been formally conducted.

## 5.3 Ethical Considerations

### Autonomous Weapons

BASTION's approach to lethal decisions directly addresses international concerns about autonomous weapons systems. The platform preserves human control over strike authorization through multiple reinforcing mechanisms.

First, strike authorization proposals are categorically required to follow human-in-the-loop approval regardless of any other configuration settings. This constraint is implemented at multiple architectural levels: in smart contract voting logic, in AI agent decision trees, and in tactical execution pipelines. No configuration change or software update can enable autonomous strike approval without fundamental architecture modification. The MDMP governance integration extends this principle beyond strike authorization to a broader safety framework: three activity categories (AUTHORITY_DECISION, ETHICAL_LEGAL, RISK_JUDGMENT) are permanently locked to HUMAN_ONLY authority, and a safety matrix enforced at the smart contract level rejects any transaction that violates these immutable constraints.

Second, strike authorization requires supermajority or unanimous approval with enhanced deliberation periods. Coalition members must actively approve lethal effects, creating multiple opportunities for human judgment to intervene. The burden is on demonstrating that strikes should proceed, not on objecting to prevent them.

Third, the immutable audit trail creates accountability for every lethal decision. The record shows who approved what, when, and based on what information. This accountability persists indefinitely and cannot be altered after the fact.

These mechanisms align with emerging frameworks for autonomous weapons ethics that emphasize meaningful human control over lethal decisions [CITATION NEEDED]. BASTION demonstrates that AI augmentation can accelerate military coordination without removing humans from the decisions that matter most.

### AI Decision Transparency

AI agent recommendations that influence human decisions raise concerns about transparency and accountability.

Explainability remains challenging for complex AI systems. BASTION's agents provide reasoning summaries with their recommendations, but these summaries may not fully capture the factors influencing model outputs. Human reviewers may not have sufficient insight to identify when AI reasoning is flawed. The platform's architecture requires human approval for consequential decisions, but the quality of human oversight depends on understanding what the AI is recommending and why.

Trust calibration requires humans to maintain appropriate confidence in AI systems—neither over-trusting nor under-trusting their capabilities. Over-trust leads to rubber-stamp approval of AI recommendations. Under-trust negates the speed benefits of AI augmentation. Calibrating trust appropriately requires training, feedback, and experience that the demonstration cannot fully provide.

Agent accountability gaps exist in the spaces between AI recommendation and human decision. When an AI agent recommends an action that a human approves and the outcome is problematic, assigning responsibility requires understanding what information the AI provided, how accurate that information was, and whether the human could reasonably have identified issues. BASTION's audit trail preserves this information for analysis, but clear accountability frameworks for AI-influenced decisions remain an evolving area of policy and doctrine.

## 5.4 Future Work

### Near-Term Extensions

**Problem set model and echelon awareness.** Renaming workspaces to "problem sets" (JP 5-0 terminology) with echelon-awareness (strategic, operational, tactical) would strengthen the doctrinal alignment of the data model and enable echelon-appropriate defaults for governance thresholds, agent configurations, and product templates.

**Strategic document containers and actor categorization.** Organizing strategic documents into nation/group containers (e.g., United States, China, NATO) with actor categories (ally, adversary, neutral, partner) would provide persistent container-based organization for building strategic environments over time, feeding into inheritance mechanisms for child problem sets.

**AI strategic context and knowledge graph integration.** Wiring subscribed strategic environment data and container-scoped knowledge graphs into AI agent context would enable agents to draw on structured strategic knowledge rather than raw document text. Container-scoped RAFT graph construction with auto-trigger on document changes would keep the knowledge graph current.

**Strategic environment inheritance.** A strategic-level problem set serving as context provider with inheritance mechanisms for directives, policy, and intelligence would enable child problem sets to inherit strategic context without manual duplication, with update propagation when strategic guidance changes.

**Embedded DAO governance at decision gates.** Moving DAO governance from a dedicated interface into contextual workflow decision gates would surface proposals at natural planning decision points (objective approval, COA selection, order release) rather than requiring navigation to a separate governance view.

**Contextual AI staff integration.** Surfacing AI agent output contextually per tab with per-tab assistants aware of workflow phase would provide recommendation engines tied to doctrinal workflow position rather than requiring users to seek out agent capabilities.

Multi-platform autonomous vehicle integration represents an immediate extension beyond current demonstration capabilities. Coordinating multiple heterogeneous autonomous systems through DAO governance would validate BASTION's scalability claims and demonstrate more realistic tactical scenarios.

Coalition health monitoring would extend the governance framework to track coalition partner cohesion, national caveat compliance, and narrative impact in real time.

Production deployment through CI/CD pipeline to Hetzner server infrastructure would move BASTION from development to a accessible demonstration environment, with TEE-aware component separation documented for production.

### Phase 45-70 Roadmap Highlights

The BASTION development roadmap extends through Phase 70 with seventeen planned phases beyond the current v0.2 implementation. Selected highlights include:

**JSON-LD semantic brain (Phase 55-56).** The current knowledge graph implementation uses a property-graph model. The next major graph enhancement introduces JSON-LD semantic markup, enabling interoperability with external ontologies and OSINT data sources. Linked Data publishing would allow BASTION's knowledge graph to integrate with NATO standardization data models and allied intelligence exchange formats without manual mapping.

**ATAK/CoT interoperability (Phase 57).** Android Team Awareness Kit (ATAK) is the operational standard for tactical common operating picture in the US military. Implementing Cursor on Target (CoT) message exchange between BASTION's COP layer and ATAK would provide the integration path for operational demonstration environments where ATAK is already deployed. This interoperability would validate BASTION's COP layer against field-standard tools rather than a standalone display.

**End-to-end swarm demonstration (Phase 58-60).** The current swarm capability uses three platforms of the same type. The planned multi-platform swarm demonstration coordinates heterogeneous platforms—ground, aerial, and fixed sensor—through the same DAO-governed swarm leader architecture. Heterogeneous platform coordination introduces capability negotiation, mixed formation geometries, and type-specific mission assignment that the current homogeneous swarm does not exercise.

**Coalition multi-tenancy (Phase 61-63).** The current implementation supports a single coalition instance. Multi-tenancy would enable separate coalition organizations to operate concurrently on the same BASTION infrastructure with complete data isolation. This capability is essential for production deployment where multiple exercises, training events, or operational activities may run simultaneously.

**Formal verification of DAO governance invariants (Phase 65-66).** The safety invariants embedded in BASTION's smart contracts are validated through testing but not formally verified. Formal verification using model checking or theorem proving would provide mathematical guarantees that the invariants hold under all reachable states, eliminating the residual risk that untested edge cases could violate human authority boundaries.

**Operational testing with military exercises (Phase 67-70).** The long-range roadmap targets integration with actual military exercise programs, initially in observer role and subsequently as a planning support tool. Exercise validation with trained military planners would provide the most authoritative assessment of doctrinal alignment, workflow integration, and user acceptance that laboratory testing cannot replicate.

**Extended heterogeneous swarm operations.** Longer-term swarm research will examine leadership election stability under node failure, dynamic formation adaptation to terrain constraints, and multi-swarm coordination across hierarchical command structures. These capabilities are required for operationally relevant swarm behavior but are out of scope for the current proof-of-concept scope.

### Research Directions Opened by MDMP and Escalation Integration

The MDMP governance framework and escalation modeling capabilities described in Sections 3.5 and 3.6 open several research directions that merit investigation.

Escalation model calibration against historical data would validate the escalation ladder frameworks currently implemented with configurable but uncalibrated parameters. Mapping historical crises to the escalation model's rung structure and testing whether the trigger conditions and thresholds produce predictions consistent with observed outcomes would establish confidence bounds for the escalation modeling capability. This calibration requires access to classified or restricted historical case studies that the current research context does not provide.

Assumption management validation in exercises would test whether the formal assumption lifecycle (Pending, Accepted, Invalidated) with automatic replanning triggers improves planning outcomes compared to traditional informal assumption tracking. The hypothesis that blockchain-enforced assumption accountability reduces the risk of plans built on invalid premises requires empirical validation through planning exercises with measurable outcomes.

Safety matrix boundary optimization would investigate the optimal allocation of MDMP activities across the five authority tiers. The current allocation derives from doctrinal analysis, but operational experience may reveal that some activities benefit from different authority levels than doctrine suggests. Research into adaptive authority allocation—where the system adjusts tier assignments based on measured agent reliability and operational context—could improve the balance between speed and safety.

Adversary model adversarial robustness requires investigation into how adversaries might deliberately manipulate the inputs that BASTION's adversary modeler and deception detector consume. If an adversary understands that BASTION generates MLCOA and MDCOA from observable indicators, they could shape those indicators to produce misleading adversary COAs. Research into adversarial robustness for military AI planning systems would strengthen the analytical capabilities described in Section 3.6.

### Long-Term Research Directions

Full DIME/DIMEFIL instrument orchestration would extend BASTION beyond military coordination to whole-of-government approaches. The Effect Cascader agent already traces consequences across DIME domains, providing a foundation for cross-domain analysis. Extending DAO governance to coordinate across government agencies would require additional research into interagency processes and authorities, but the effects analysis framework provides a starting point for understanding how military actions create requirements for diplomatic, information, and economic coordination.

Cross-domain federated learning could enable AI agents to improve collaboratively while respecting classification boundaries. Agents operating at different classification levels or in different coalition partner networks could share learning without sharing the underlying data. This capability would address the tension between AI improvement through data sharing and security requirements for information protection.

Real coalition exercises would provide the operational validation that demonstration environments cannot. Integrating BASTION into actual military exercises, even in observer or limited-participation roles, would generate insights about operational utility and integration challenges that inform further development. The MDMP governance gates and assumption tracking capabilities are particularly suited to exercise validation, as exercises provide controlled environments where the benefits of formal governance enforcement can be measured against traditional planning processes.

Accreditation path research would investigate the security certification requirements for deploying BASTION in classified environments. Military systems handling classified information must undergo accreditation processes that can be lengthy and demanding. Understanding these requirements early and designing for accreditability would accelerate potential operational adoption.

### Policy Research Needed

Legal frameworks for blockchain-based military C2 remain undeveloped. Questions about authority, liability, and compliance with existing laws and treaties require attention from legal scholars and policy makers. How do existing command authorities translate to DAO governance? What legal status do AI agents have when acting within delegated authority? How do international agreements governing coalition operations apply to blockchain-coordinated actions?

Coalition data sharing agreements may require revision to accommodate blockchain-based information sharing. Existing agreements anticipate traditional database and message-based information exchange. Blockchain's properties of immutability and transparency may require new agreement structures that address data persistence, access revocation, and cross-border data flows.

Autonomous weapons governance continues to evolve internationally. As nations develop policies regarding AI in weapons systems, BASTION's approach to human control over lethal decisions provides a model that could inform these discussions. Engaging with the policy community to ensure that BASTION's mechanisms meet emerging requirements would support both policy development and system adoption.

---

*This section has examined BASTION's limitations, risks, and future directions with the candor that academic and operational audiences require. The following conclusion summarizes what BASTION has demonstrated and its significance for military coordination in coalition operations.*

