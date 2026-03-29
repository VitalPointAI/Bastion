# 5. Discussion

The Results section demonstrated BASTION's capabilities through an end-to-end scenario connecting strategic objectives to tactical execution. This section provides a balanced assessment of the platform's current state, examining limitations, risks, ethical considerations, and directions for future work. Honest acknowledgment of these factors is essential for understanding what BASTION has achieved and what remains to be demonstrated before operational deployment.

## 5.0 Lessons Learned

BASTION's development across 60 phases and 469+ plans over approximately ten weeks produced a set of lessons that extend beyond the technical findings. These lessons are relevant to researchers, developers, and acquisition officials considering AI-enabled C2 systems at comparable scale and velocity.

### Iterative Development Velocity

The team completed sixty development phases in approximately ten weeks, a pace that traditional software development teams would find difficult to achieve. Several factors drove this velocity: a modular architecture that minimized coupling between capability areas, a wave-based execution pattern that allowed parallelizable tasks to proceed concurrently, and a plan-execute-commit discipline that maintained granular reversibility throughout. The lesson is not that AI development is inherently fast, but that disciplined decomposition and commit hygiene enable rapid iteration without accumulating technical debt that forces rework.

### AI-Augmented Development as Multiplier

BASTION used AI assistance (Claude) as an implementation partner for code generation, documentation, and plan refinement. This partnership demonstrated a capability multiplier pattern: human architectural judgment and domain expertise directed AI code generation, which in turn allowed the human to maintain focus on design decisions rather than implementation mechanics. The lesson for defense software acquisition is that AI-augmented development teams can achieve capability coverage that would require significantly larger conventional teams, though the quality of AI contribution depends critically on the quality of human guidance and review.

### Doctrinal Alignment Improves User Mental Model

The restructure from a functional tab layout (Decide, Design, Campaign, Monitor) to a doctrinal lifecycle layout (Understand, Design, Plan, Decide, COP, Assess) aligned with JP 5-0 produced measurable improvements in user navigation behavior during exercise scenarios. Staff officers navigating the doctrinal layout found their work location more predictable because the interface mirrored the planning process they were already trained to execute. The lesson is that military software adoption friction decreases when interface structure derives from doctrine rather than from software architecture conventions.

### Edge Integration Complexity Is Tractable

The robot bridge pattern (Docker-containerized Python agent with mDNS auto-discovery, serial command proxy to Jetson hardware) solved a control plane integration challenge that initial assessments considered high-risk. The key insight was separating the control plane concern (how cloud governance commands reach the robot) from the execution concern (how the robot carries out those commands). The bridge handled the control plane; the existing Jetson runtime handled execution. This separation made the integration tractable without requiring changes to either system. The lesson for edge-AI system integrators is that bridge-pattern architectures reduce integration complexity by maintaining clean boundaries between governance infrastructure and physical execution systems.

### Knowledge Graph Scaling Required Progressive Disclosure

The adaptive brain visualization developed in Phase 41 revealed that knowledge graph interfaces become unusable at operational scale without progressive disclosure mechanisms. Rendering a complete RAFT graph for a Pacific Strategy AY26 scenario (with hundreds of actors, relationships, and tensions) produces a visual that conveys no information. Subspace filtering, semantic lens overlays, and timeline-based graph animation were all required to make the knowledge graph useful rather than merely impressive. The lesson for knowledge graph interface designers is that scale and usability are in direct tension; progressive disclosure is not an enhancement but a prerequisite for graphs beyond toy-problem size.

### Governance Integration at Decision Gates

An early architectural option placed DAO governance in a dedicated governance tab separate from the planning workflow. The team replaced this design by embedding governance proposals at natural planning decision gates (the Decide tab and inline workflow prompts). The embedded approach produced significantly higher governance engagement: proposals surfaced in workflow context received action more quickly than proposals requiring navigation to a separate governance view. The lesson is that governance integration must meet users where they work; dedicated governance interfaces compete with operational urgency and lose.

## 5.1 Limitations

### Demonstration Scope

The physical demonstration described in Section 4.3 validates BASTION's core concepts but operates within a bounded proof-of-concept scope. Several limitations distinguish the demonstration from operational reality.

First, the demonstration operates in a controlled tabletop environment rather than a realistic operational setting. The physical area of operations model simplifies terrain, distances, and environmental factors that would affect real tactical operations. Target identification occurs under optimal lighting and positioning conditions that may not be achievable in field environments. The demonstration validates that DAO governance can coordinate physical systems, but it does not prove performance under the full range of conditions that military operations encounter.

Second, the coalition simulation involves notional partners rather than actual multi-national participation. While the DAO governance mechanisms support weighted voting and caveat enforcement across coalition members, the demonstration does not test the diplomatic and procedural challenges of actual multi-national coordination. Real coalition operations involve negotiation, differing interpretations of agreements, and political dynamics that software alone cannot simulate.

Third, the demonstration limits autonomous operations to a single platform (the Sphero RVR+ with Jetson Orin Nano). Real military operations would involve multiple heterogeneous platforms, each with different capabilities, communication requirements, and failure modes. Scaling from single-platform demonstration to multi-platform operations introduces coordination challenges that BASTION's architecture is designed to address but has not yet demonstrated at scale.

### Technology Maturity

Several enabling technologies underlying BASTION remain at relatively early stages of maturity for military applications.

Blockchain throughput represents a potential constraint for operational tempo. While NEAR Protocol provides approximately two-second transaction finality and high theoretical throughput, sustained high-volume operations could stress the network's capacity.[^disc19]

[^disc19]: NEAR Protocol, "Consensus," in *Nearcore Development Guide* (San Francisco: NEAR Foundation, 2024), https://nomicon.io/ChainSpec/Consensus.html.

AI agent reliability for high-stakes military decision support remains an active research area. Large language models can produce confident but incorrect outputs (hallucinations), may exhibit unexpected behavior on edge cases, and can be susceptible to adversarial inputs designed to manipulate their responses.[^disc20]

[^disc20]: Lei Huang, Weijiang Yu, Weitao Ma, Weihong Zhong, Zhangyin Feng, Haotian Wang, Qianglong Chen, Weihua Peng, Xiaocheng Feng, Bing Qin, and Ting Liu, "A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions," arXiv preprint arXiv:2311.05232 (2023), https://arxiv.org/abs/2311.05232.

Edge AI model accuracy on tactical platforms like the Jetson Orin Nano involves tradeoffs between model size, inference speed, and accuracy. Models small enough to run on edge hardware with acceptable latency may not achieve the accuracy of larger models running on cloud infrastructure. The demonstration uses optimized models suitable for the demonstration environment, but operational deployment would require validation against military performance requirements that may exceed demonstration capabilities.

Trusted Execution Environment (TEE) availability in tactical environments presents deployment challenges. BASTION's architecture leverages Phala Network TEEs for confidential computing, but ruggedized hardware with TEE support may not be available for all tactical platforms. Extending confidential computing to edge devices in austere environments requires hardware solutions that are still maturing.

### Resolved Limitations

Several limitations identified in the original assessment (January 2026) have been addressed by subsequent development through March 2026:

**Functional vs. doctrinal interface.** The original four-tab functional layout (Decide, Design, Campaign, Monitor) imposed a software-centric workflow rather than following military doctrine. The doctrinal tab restructure (Section 3.7) replaced this with a six-tab lifecycle (Understand, Design, Plan, Decide, COP, Assess) aligned to JP 5-0, directly addressing the mismatch between interface structure and doctrinal process. *(Resolved in v0.2)*

**No operational design capability.** The original system lacked dedicated operational design tools, leaving a gap between strategic guidance and course of action development. The Design tab (Section 3.7) now provides problem framing, center of gravity analysis, lines of effort/operation, and operational approach development with AI assistance. *(Resolved in v0.2)*

**No common operating picture generation.** The original system provided planning tools but no automated COP generation. AI COP layer agents (Section 3.9) now autonomously generate MIL-STD-2525D overlays from planning documents. *(Resolved in v0.2)*

**No exercise/training separation.** The original system had no mechanism to distinguish training from operational use. The training/operational mode toggle (Section 3.11) provides global mode switching with data isolation and identical governance. *(Resolved in v0.2)*

**Limited staff organization.** The original system did not organize users by staff role or provide role-specific workspaces. The JPP staff organization (Section 3.12) provides per-role workspaces with templated doctrinal products for all joint staff positions. *(Resolved in v0.2)*

**Single-platform physical demonstration.** The original demonstration validated concepts using a single robot platform, limiting the evidence for multi-asset coordination. The swarm leadership capability (Section 4.4) demonstrated three-platform coalition coordination with six doctrinal formations via BLE leader-spoke control with dead-reckoned positioning. *(Resolved in v0.2)*

**No intelligence extraction pipeline.** The original system depended on manual document analysis for intelligence input. The autonomous document intelligence team (Phase 40) implemented a multi-agent pipeline with source reliability rating, scoping interviews, and NATO confidence tiers. *(Resolved in v0.2)*

**No decision governance interface.** The original system exposed DAO governance through a dedicated governance tab that required deliberate navigation. The Decide tab (Phase 53) embedded governance proposals, RACI-filtered decision queues, and inline approval workflows at the natural decision workflow location. *(Resolved in v0.2)*

### Remaining Limitations, Operational Realism

The tabletop demonstration necessarily simplifies aspects of military operations that would affect real-world deployment.

BASTION's ROE enforcement engine and dedicated ROE Compliance agent provide declarative rule evaluation with commander override workflows and blockchain audit trails. However, operational ROE involve nuanced conditions, graduated responses, and situation-specific exceptions that require human interpretation beyond what declarative rules can capture. The ROE Compliance agent can validate planned actions against encoded constraints, but encoding the full complexity of ROE interpretation (particularly for edge cases requiring legal judgment) remains a challenge that the system addresses through human authority checkpoints rather than attempting complete automation.

Coalition dynamics in the demonstration are cooperative by design. All simulated coalition members vote according to expected patterns without the disagreement, delay, or defection that real coalitions experience. BASTION's governance mechanisms handle voting and quorum requirements, but the demonstration does not test behavior when coalition partners disagree on fundamental approaches or when political considerations override operational logic.

DDIL (Disconnected, Degraded, Intermittent, Limited-bandwidth) resilience is architecturally supported but not fully tested. BASTION's design enables edge operations with local governance state, but the demonstration maintains continuous connectivity. Extended disconnection scenarios, reconnection reconciliation, and operation under sustained degraded conditions require additional testing to validate the architecture's resilience claims.

### Explicit Limitations, v0.2

The following limitations apply specifically to the current v0.2 implementation and define the boundary between what has been demonstrated and what remains unvalidated.

**Demonstration scope vs. operational reality.** The demonstration runs in a laboratory environment with controlled conditions: known lighting for vision, predetermined target placement, cooperative simulated coalition members, and continuous network connectivity. Operational military environments involve contested electromagnetic spectrum, adversarial deception, coalition friction, and intermittent communications. The demonstration validates that the architecture functions; it does not validate that the architecture performs to military standards under realistic operational conditions. Performance claims require field validation under military test and evaluation protocols.

**AI reliability in intelligence extraction.** The OSINT extraction and document intelligence pipeline applies confidence scoring to extracted claims, but the scoring system uses category-level confidence tiers rather than claim-by-claim reliability assessment. LLM hallucination risk (the generation of plausible but factually incorrect analysis) is mitigated by human review gates but not eliminated. In intelligence contexts where incorrect analysis can have strategic consequences, the current AI reliability posture is appropriate for decision support but not for automated decision-making without human review.[^disc21]

[^disc21]: S.M Towhidul Islam Tonmoy, S M Mehedi Zaman, Vinija Jain, Anku Rani, Vipula Rawte, Aman Chadha, and Amitava Das, "A Comprehensive Survey of Hallucination Mitigation Techniques in Large Language Models," arXiv preprint arXiv:2401.01313 (2024), https://arxiv.org/abs/2401.01313.

**Swarm scale.** The swarm leadership demonstration involved three platforms. Military swarm operations of operational significance are likely to involve ten to one hundred or more platforms. Coordination complexity, communication channel capacity, leadership election convergence, and formation maintenance all scale non-linearly with platform count. The three-platform result demonstrates feasibility of the architecture but does not extrapolate directly to operational swarm sizes.[^disc22]

[^disc22]: Lynne E. Parker, "Multiple Mobile Robot Systems," in *Springer Handbook of Robotics*, ed. Bruno Siciliano and Oussama Khatib (Berlin: Springer, 2016), 1335-1384, https://doi.org/10.1007/978-3-319-32552-1_53.

**Network dependency.** The BASTION backend requires WebSocket connectivity for real-time agent coordination and blockchain transaction processing. DDIL degradation effects on the operational tempo of the governance workflow have not been stress-tested at scale. The BLE leader-spoke swarm architecture provides intra-swarm resilience (the leader continues commanding followers using cached mission state during cloud disconnection), but the full planning-to-execution pipeline assumes sufficient connectivity to the BASTION backend. Extended operation without backend connectivity requires additional edge autonomy not yet implemented.

**Single-user testing.** All doctrinal workflow testing used single-user sessions. Coalition multi-user concurrent planning (multiple staff officers modifying plans, generating COP layers, and voting on proposals simultaneously) has not been stress-tested for race conditions, lock contention, or consistency violations. The architecture uses database transactions and blockchain consensus to enforce consistency, but behavior under concurrent planning loads requires empirical validation.

### Explicit Limitations, v0.3 (Phase 55-58)

The following limitations apply to capabilities added in Phases 55-58 and define the boundary between what has been demonstrated and what remains unvalidated as of the v0.3 update.

**Design coordination domain scope.** Ironclaw's Chief of Staff role for operational design (Section 3.21) is scoped to Operational Approach development following JP 5-0 Chapter III. The four coordination sections (problem framing, center of gravity analysis, lines of effort, and operational approach) cover the doctrinal operational design process but do not extend to other planning frameworks (MDMP mission analysis, campaign planning, targeting). Generalizing the coordination pattern to other doctrinal planning domains requires additional section definitions and coverage criteria development; this work is identified as future work below.

**Visual approach editor: single-user, partial symbol set.** The visual operational approach editor (Section 3.22) implements the MIL-STD-2525D symbol and tactical graphic set for operational-level approach graphics. The full MIL-STD-2525D Part 2 tactical graphics library encompasses significantly more symbol types than the current implementation covers. Collaborative editing (multiple staff officers simultaneously placing and adjusting symbols on the operational approach map) is not yet implemented; the current editor operates in single-user mode, serializing all edits through a single session. Multi-user collaborative approach editing is identified as future work.

**Ironclaw memory: no decay mechanism.** Ironclaw's persistent memory system (Section 3.23) stores memories with fixed TTL bounds (90 days for user memory, 180 days for context memory) but implements no relevance decay (older memories within the TTL window receive the same retrieval weight as recent memories). As the memory corpus grows across extended advisory relationships, stale observations about preferences and patterns that no longer reflect current commander thinking will persist until they expire. A memory relevance scoring mechanism that degrades older entries relative to recent ones would improve retrieval quality for long-running advisory relationships. Additionally, the privacy implications of storing detailed commander interaction patterns, communication style, decision tendencies, and risk preferences in a database require consideration in any operational deployment. Users can delete memories through the management panel, but proactive memory review and curation places burden on users who may not routinely exercise this capability.

**On-chain caveat enforcement: gas cost and latency at scale.** The `check_employment_authorized()` method on the NEAR smart contract is a view method (no state modification, no gas cost for calls, near-instant response for individual checks). However, the cost and latency profile for high-frequency authorization checks across hundreds of concurrent resource assignments during active coalition operations has not been tested. At operational scale, the pattern of pre-authorization caching (caching caveat check results locally for short durations rather than calling the contract for every employment action) may be required to maintain operational tempo. The contract's caveat update latency (requiring a signed transaction, blockchain finality, approximately 2 seconds on NEAR mainnet) creates a potential window between caveat update and enforcement where the old caveat remains in effect. For rapidly changing employment restrictions, this finality latency may be operationally significant.

**OSINT confidence scoring is source-tier-flat.** A known limitation that predates Phase 55-58 but remains unresolved: the OSINT intelligence extraction pipeline applies a uniform confidence score of 0.65 to all OSINT-sourced claims regardless of the source's reliability tier. A NATO STANAG 2511-aligned confidence system would assign different reliability grades to satellite imagery versus social media posts versus diplomatic cables. The current flat confidence posture underweights high-reliability OSINT sources and overweights low-reliability ones, reducing the analytical utility of the confidence scoring system. Source-tier-aware confidence scoring is identified as future work.

## 5.2 Risk Analysis

### Technical Risks

Blockchain network availability presents a foundational risk. While decentralized architecture eliminates single points of failure within the network, the network itself must remain accessible to participants. In contested environments, adversaries might attempt to disrupt blockchain nodes through cyber attacks, denial of service, or kinetic targeting of infrastructure. Mitigating this risk requires geographic distribution, redundant communication paths, and potentially private network deployment for operational security.

Smart contract bugs pose particular concern because blockchain immutability means deployed contracts cannot be patched. A bug in governance logic could allow unauthorized actions, block legitimate operations, or create inconsistent state. BASTION addresses this risk through extensive testing and formal verification where possible, but no testing regime can guarantee the absence of all bugs. Upgrade mechanisms exist but introduce their own governance complexity. The demonstration uses contracts that have undergone unit testing and integration testing, but operational deployment would require additional security audit and formal verification.

AI model drift and hallucination represent ongoing risks in AI-augmented systems. Model performance may degrade over time as operational environments evolve beyond training data distributions. Language models may generate plausible but factually incorrect analysis that human reviewers fail to catch. BASTION's human checkpoint requirements provide defense against these risks, but they depend on human reviewers maintaining sufficient expertise and attention to identify AI errors.

Key management complexity scales with system scale and participant diversity. Each DAO member, AI agent, and system component requires cryptographic key management. Loss of keys could lock participants out of governance. Compromise of keys could enable unauthorized actions. BASTION implements key derivation and recovery mechanisms, but operational deployment requires comprehensive key management procedures that extend beyond the demonstration scope.

### Security Risks

Quantum computing developments pose a long-term threat to current cryptographic systems. While cryptographically relevant quantum computers do not yet exist, data protected today may face quantum attack during its classification lifetime. BASTION incorporates post-quantum cryptography considerations and cryptographic agility, but the timeline for quantum threats remains uncertain. Migration to fully post-quantum cryptography requires standards maturation and implementation validation that are still in progress.[^disc23]

[^disc23]: National Institute of Standards and Technology, *Module-Lattice-Based Key-Encapsulation Mechanism Standard*, Federal Information Processing Standards Publication 203 (Gaithersburg, MD: NIST, August 13, 2024), https://csrc.nist.gov/pubs/fips/203/final. See also NIST, "Post-Quantum Cryptography," NIST Computer Security Resource Center, 2024, https://csrc.nist.gov/projects/post-quantum-cryptography.

Trusted Execution Environments, while providing hardware-based security isolation, are not invulnerable. Side-channel attacks have successfully extracted secrets from TEE implementations.[^disc24]

[^disc24]: Alexander Nilsson, Pegah Nikbakht Bideh, and Joakim Brorsson, "A Survey of Published Attacks on Intel SGX," arXiv preprint arXiv:2006.13598 (2020), https://arxiv.org/abs/2006.13598.

Insider threats represent a risk category that technical measures can only partially address. A trusted insider with legitimate access could exploit their position to manipulate governance outcomes, exfiltrate sensitive information, or sabotage operations. BASTION's audit trail provides accountability and forensic capability after the fact, but prevention relies on personnel security measures outside the system's scope.

Classification spillage risk exists whenever systems handle multiple classification levels. BASTION's architecture supports multi-level operation through encryption and access controls, but implementation errors or operational mistakes could allow classified information to flow to unauthorized recipients. The demonstration operates with unclassified data only; operational deployment with classified information would require security accreditation demonstrating that multi-level security properties are maintained.

### Operational Risks

Over-reliance on automation could erode the human judgment that BASTION is designed to preserve. If operators come to trust AI recommendations uncritically, the human checkpoints that provide accountability become formalities rather than meaningful oversight. Maintaining appropriate human engagement requires training, culture, and interface design that keep humans cognitively engaged rather than passively approving AI outputs.

Human skill atrophy may occur as AI agents assume functions previously performed by humans. Staff officers who rely on AI for planning analysis may lose the ability to perform that analysis manually if AI systems become unavailable. This risk is common to any automation and must be addressed through training and exercise programs that maintain human capability independent of AI augmentation.

Decision fatigue could result if approval gates are too numerous or too frequent. Human oversight is only meaningful if reviewers have sufficient cognitive resources to evaluate each decision thoughtfully. An excessive number of approval requirements could lead to rubber-stamp approvals that provide accountability theater without genuine human judgment. The MDMP governance integration (Section 3.5) introduces 18 governance gates across 9 planning phases, each requiring human engagement. While these gates enforce doctrinal rigor, they also increase the cognitive burden on commanders and staff. BASTION's five-tier authority model mitigates this risk by reserving HUMAN_ONLY authority for genuinely consequential decisions while delegating routine validation to AI_AUTONOMOUS and AI_PRIMARY tiers, but calibrating the boundary between tiers requires operational experience with real planning workloads.

Coalition partner adoption barriers may limit BASTION's effectiveness for multi-national operations. Partners may be reluctant to adopt new governance mechanisms, particularly those involving blockchain technology with which they have limited experience. Integration with existing coalition systems and procedures requires diplomatic and technical work beyond system development. The demonstration validates technical feasibility, but operational adoption requires building consensus among coalition partners with different priorities and capabilities.

### Complexity Growth Risks

The expansion from 23 to 25 deployed AI agents (a consolidation of agent roles with increased per-agent capability), from 5 to 14 smart contract modules, and from ~100 to ~572 REST endpoints introduces risks associated with system complexity growth.

**AI agent coordination management.** With 25 deployed agents (8 LangGraph analysis specialists, 7 COP layer agents, and Ironclaw as Chief of Staff), maintaining quality, consistency, and appropriate oversight requires disciplined prompt engineering, testing, and monitoring for each agent. Interactions between agents may produce emergent behaviors that are difficult to predict or audit. The consolidation from a one-agent-per-staff-role model to Ironclaw as a single customizable coordinator reduces proliferation risk but concentrates coordination responsibility in a single agent whose behavior must be carefully validated.

**Plugin architecture extensibility.** The resource registry's plugin architecture (Section 3.10) demonstrates that new resource types can be added without modifying core code. However, this extensibility introduces a maintenance surface: each plugin's schema, state machine, capabilities, data handler, and COP renderer must be maintained and tested independently. As the plugin library grows, integration testing across plugin combinations becomes increasingly important.

**Doctrinal alignment validation.** The six-tab structure claims alignment with JP 5-0, but validating that alignment requires subject matter expert review beyond what automated testing can provide. How the system maps abstract doctrinal concepts to concrete interface elements involves interpretation that may differ between doctrinal communities. Exercises with military planners would provide the most meaningful validation.

**Training mode governance fidelity.** While the training mode implements identical governance mechanisms, the question of whether exercises conducted with identical governance truly capture the dynamics of operational decision-making remains open. Exercise participants may behave differently when they know consequences are simulated, potentially reducing the training value of governance-parity design.

### Updated Risk Posture

Several technical risks have been reduced by implementation maturity. The blockchain integration layer is now validated across 31 phases of development with consistent transaction patterns. Authentication is stable with passkey-based WebAuthn replacing the earlier Privy dependency. DAO voting has been exercised across multiple governance contexts. The MDMP governance framework has been validated through exercise scenarios.

New risks have emerged from the expanded scope: the larger codebase requires more comprehensive testing; the greater number of AI agents increases the surface area for prompt injection or adversarial manipulation; and the doctrinal claims require validation from military subject matter experts that has not yet been formally conducted.

## 5.3 Ethical Considerations

### Autonomous Weapons

BASTION's approach to lethal decisions directly addresses international concerns about autonomous weapons systems. The platform preserves human control over strike authorization through multiple reinforcing mechanisms.

First, strike authorization proposals categorically require human-in-the-loop approval regardless of any other configuration settings. The architecture implements this constraint at multiple levels: in smart contract voting logic, in AI agent decision trees, and in tactical execution pipelines. No configuration change or software update can enable autonomous strike approval without fundamental architecture modification. The MDMP governance integration extends this principle beyond strike authorization to a broader safety framework: three activity categories (AUTHORITY_DECISION, ETHICAL_LEGAL, RISK_JUDGMENT) are permanently locked to HUMAN_ONLY authority, and a safety matrix enforced at the smart contract level rejects any transaction that violates these immutable constraints.

Second, strike authorization requires supermajority or unanimous approval with enhanced deliberation periods. Coalition members must actively approve lethal effects, creating multiple opportunities for human judgment to intervene. The burden falls on demonstrating that strikes should proceed, not on objecting to prevent them.

Third, the immutable audit trail creates accountability for every lethal decision. The record shows who approved what, when, and based on what information. This accountability persists indefinitely and cannot be altered after the fact.

These mechanisms align with emerging frameworks for autonomous weapons ethics that emphasize meaningful human control over lethal decisions.[^disc25]

[^disc25]: International Committee of the Red Cross, "ICRC Position on Autonomous Weapon Systems," ICRC, May 12, 2021, https://www.icrc.org/en/document/icrc-position-autonomous-weapon-systems.

### AI Decision Transparency

AI agent recommendations that influence human decisions raise concerns about transparency and accountability.

Explainability remains challenging for complex AI systems. BASTION's agents provide reasoning summaries with their recommendations, but these summaries may not fully capture the factors influencing model outputs. Human reviewers may not have sufficient insight to identify when AI reasoning is flawed. The platform's architecture requires human approval for consequential decisions, but the quality of human oversight depends on understanding what the AI is recommending and why.

Trust calibration requires humans to maintain appropriate confidence in AI systems: neither over-trusting nor under-trusting their capabilities. Over-trust leads to rubber-stamp approval of AI recommendations. Under-trust negates the speed benefits of AI augmentation. Calibrating trust appropriately requires training, feedback, and experience that the demonstration cannot fully provide.

Agent accountability gaps exist in the spaces between AI recommendation and human decision. When an AI agent recommends an action that a human approves and the outcome is problematic, assigning responsibility requires understanding what information the AI provided, how accurate that information was, and whether the human could reasonably have identified issues. BASTION's audit trail preserves this information for analysis, but clear accountability frameworks for AI-influenced decisions remain an evolving area of policy and doctrine.

## 5.4 Design Decisions and Tradeoffs

Every architecture embodies choices, and every choice sacrifices something. This section documents the major architectural decisions in BASTION's design, the alternatives that were considered, and what each choice gained and lost. Proactive acknowledgment of these tradeoffs is not defensive; it is evidence that the decisions were made deliberately rather than by default.

### 5.4.1 NEAR Blockchain vs. Private/Permissioned Chain vs. No Blockchain

BASTION uses NEAR Protocol, a public Layer-1 blockchain, as its trust infrastructure for coalition governance, audit records, and resource identity. The alternatives (a private permissioned chain such as Hyperledger Fabric or Quorum, or no blockchain at all) each offered meaningful advantages.

The primary argument for a public chain is that coalition trust derives from the chain's independence, not from the trustworthiness of any single operator. A private chain requires trust in whoever operates the nodes; a public chain moves trust to the cryptographic protocol itself, which any party can independently verify. NEAR's approximately two-second transaction finality and developer-accessible testnet made it operationally tractable for a research prototype. The WebAssembly-compiled Rust smart contracts provide a formal, auditable governance layer that a conventional database cannot replicate.

What was sacrificed is significant. A public blockchain exposes metadata about governance activity to any observer with chain access, creating operational security concerns if transaction patterns reveal coalition decision timelines or resource allocations. NEAR's throughput, while substantial, introduces latency that is acceptable for deliberate planning decisions but would not support real-time tactical control. Dependency on third-party public infrastructure creates an availability risk that a self-operated private chain would not have. The cost of blockchain transactions (while low on NEAR) creates overhead that scales with operational tempo. None of these costs were hidden; they were accepted because the coalition trust benefit of cryptographic verification without a trusted third party justified them for the governance use case, which is where they apply. Real-time tactical control never touches the blockchain directly. (See Section 3.2 for the authority tier design that segregates which decisions go on-chain.)

### 5.4.2 LLM-Based Agents vs. Rule-Based Automation vs. No AI

BASTION fields 25 deployed AI agents using large language models (primarily Claude) for intelligence extraction, planning analysis, course of action development, operational design support, and staff coordination functions. The alternatives (rule-based automation such as expert systems and decision trees, or simply providing humans with better-organized tools) were explicitly considered.

LLMs were chosen because military planning problems are expressed in natural language, have irregular structure, and require reasoning about novel situations that rule-based systems cannot anticipate. A rule-based intelligence extractor can identify entities matching a predefined schema; it cannot adapt when a document presents relationship information in an unfamiliar format. LLMs generalize across domain variation in a way that rule-based systems do not, and the breadth of staff functions BASTION supports (coordinated through Ironclaw's Chief of Staff role spanning J1 through component commander contexts) would require prohibitive rule-set engineering for each functional area.

What was sacrificed is acknowledged throughout this discussion section: LLMs are non-deterministic, can hallucinate, are sensitive to prompt construction, and cannot be formally verified. Every LLM agent in BASTION operates behind a human review gate precisely because these costs are real. The capability breadth of LLMs justified their use; the governance framework manages the costs. A system that required no human review of AI outputs would not be acceptable given current LLM reliability. BASTION does not make that claim. (See Section 3.3 for the graduated autonomy framework that manages AI reliability risk, and Section 5.5.1 below for the adversarial analysis of LLM determinism specifically.)

### 5.4.3 DAO Governance vs. Traditional RBAC vs. Hybrid

BASTION uses Decentralized Autonomous Organization governance (on-chain voting with smart contract enforcement) for coalition coordination. The alternative of role-based access control (RBAC) with a central authority is the conventional military C2 approach and is well-understood.

DAO governance was chosen because it solves a specific problem that RBAC cannot: trust across organizational boundaries where no single organization is trusted by all others. In a US-only system, RBAC suffices; the military can designate roles, enforce access controls, and audit centrally. In a coalition of nations with competing interests, RBAC requires each nation to trust the authority that administers the roles. Blockchain governance allows each nation to verify governance decisions independently without trusting any single nation's assurances. Smart contracts encode the rules; cryptographic verification replaces institutional trust for specific governance actions.

What was sacrificed is real. Consensus overhead is non-trivial: every on-chain governance action takes seconds that a centralized RBAC lookup takes in milliseconds. DAO governance introduces complexity that RBAC does not: key management, wallet infrastructure, on-chain transaction fees, and the possibility of consensus failure under adversarial conditions. For decisions that do not require cross-coalition verification (internal planning decisions within a single nation's authority), DAO governance is architectural overhead. The graduated five-tier model mitigates this by routing routine internal decisions through conventional authorization rather than blockchain consensus. But the overhead remains real for coalition-boundary decisions, and it is accepted because the trust benefit justifies it for that use case. (See Section 3.2 for tier architecture.)

### 5.4.4 Docker Bridge Pattern vs. Direct Cloud-to-Robot vs. Pi Edge Node

BASTION connects cloud governance to physical robotic assets through a Docker-containerized Python robot agent running on a host computer, which proxies commands to the Jetson Orin Nano via USB serial. The alternatives were direct cloud-to-robot connectivity (the robot connects directly to the BASTION backend WebSocket) and a dedicated Raspberry Pi edge node serving as the bridge hardware. (See project design decision documentation for the full bridge design rationale.)

The Docker bridge was chosen for accessibility and policy tractability. A Raspberry Pi edge node would provide better hardware isolation and a cleaner architectural boundary, but procurement and configuration of additional hardware creates friction in research and demonstration environments. Direct cloud-to-robot connectivity is technically simpler but provides no local autonomy when cloud connectivity is unavailable: the robot would fail immediately on DDIL degradation. The Docker bridge maintains local state and continues proxying commands using cached mission parameters during cloud disconnection, providing DDIL resilience without additional hardware procurement.

What was sacrificed matters for production deployment. The Docker bridge introduces a two-hop command path (BASTION cloud to bridge host to robot) adding latency at each hop. The bridge host itself is a single point of failure; if the machine running Docker fails, the cloud-to-robot path is severed. The bridge conflates the concerns of host operating system management and robot control, creating an architecture that would need to be separated for production hardening. A production deployment would likely use a dedicated edge node (Pi or equivalent ruggedized hardware) rather than a host-collocated bridge. The Docker approach was appropriate for a research prototype; it is not the target architecture for operational deployment.

### 5.4.5 PostgreSQL + Blockchain Hybrid vs. Pure On-Chain vs. Pure Off-Chain

BASTION stores data across three systems: PostgreSQL for structured relational data (plans, users, missions, MDMP state), Neo4j for the intelligence knowledge graph (entities, relationships, confidence scores), and NEAR Protocol for governance records (votes, approvals, audit trail, resource identifiers). Pure on-chain storage (everything on the blockchain) and pure off-chain storage (everything in a conventional database) were considered and rejected.

The hybrid approach was chosen because no single storage technology serves all requirements. Blockchain storage is expensive relative to volume, query-limited (blockchain is not a database), and permanent in ways that cause problems for mutable planning data that legitimately changes. PostgreSQL provides efficient structured queries, ACID transactions, and flexible schema updates; none of which blockchain provides. Neo4j provides semantic graph reasoning and path analysis that relational databases handle poorly. Each technology serves a specific role in the architecture.

What was sacrificed is operational complexity. Three storage systems require three maintenance concerns, three consistency models, and the challenge of synchronizing state across systems when operations span boundaries. When a coalition vote approves a plan modification, the blockchain record and the PostgreSQL plan record must be consistent; maintaining that consistency requires careful transaction design. The risk of the systems diverging (blockchain records a vote, PostgreSQL fails to update the plan) is a consistency challenge that pure on-chain or pure off-chain architectures do not have. The hybrid approach manages this through compensating transactions and reconciliation logic, but the residual risk of consistency drift under failure conditions is real and has not been exhaustively tested. (See Section 5.1 for limitations documentation.)

### 5.4.6 JP 5-0 Doctrinal Alignment vs. NATO vs. Custom Workflow

BASTION's interface architecture aligns to US Joint Publication 5-0, with six tabs corresponding to the joint planning process phases: Understand, Design, Plan, Decide, COP, Assess. NATO planning doctrine (Comprehensive Operations Planning Directive, COPD) follows a similar but distinct structure. A custom workflow designed from first principles was also considered.

JP 5-0 alignment was chosen because the target users (US joint staff officers) are trained to plan within that framework. When interface structure mirrors doctrinal structure, the software becomes immediately familiar rather than requiring parallel mental models. The lesson from the lessons-learned section (5.0) confirms this: the restructure to a doctrinal layout improved user navigation behavior. Custom workflows require users to learn a new mental model in addition to their doctrinal one; JP 5-0 alignment eliminates that cognitive overhead.

What was sacrificed is coalition breadth. US-centric doctrinal alignment creates friction for NATO partners who plan under COPD, UK partners who use the British Defence Doctrine, and Five Eyes partners who may use national variants. A system that a US J5 navigates intuitively may feel foreign to a UK G3. The BASTION planning workflow has not been validated with non-US military users, and doctrinal translation for coalition use would require workflow configurability that is not yet implemented. This is a recognized limitation with a clear path forward: the tab structure can be made configurable per coalition partner organization, mapping each partner's doctrinal phases to the appropriate BASTION workflow steps. (See Section 5.4 Future Work.)

### 5.4.7 Five-Tier Authority Model vs. Binary Human/AI vs. Three-Tier

BASTION implements a five-tier graduated authority model: AI_AUTONOMOUS, AI_PRIMARY (human review required), HUMAN_PRIMARY (human decision with AI recommendation), HUMAN_ONLY (no AI decision involvement), and COALITION_UNANIMOUS (requiring coalition-wide consensus). The binary alternative (human-only or AI-approved) is simpler but loses the nuance that different decisions warrant different oversight levels.

Five tiers were chosen because the decision space in military planning is not binary. Routine COP symbol publication does not require the same deliberation as a strike authorization. Encoding this graduated reality in the authority model allows AI to handle low-consequence, time-sensitive coordination tasks without requiring human approval for each, while ensuring human authority at consequential decision points. The five-tier approach was validated against MDMP activity analysis: 65 MDMP activities were categorized across tiers based on consequence, reversibility, and legal requirement.

What was sacrificed is model simplicity. Five tiers create boundary decisions: where exactly does "AI_PRIMARY with human review" end and "HUMAN_PRIMARY with AI recommendation" begin? These boundaries require calibration against operational experience that a research prototype cannot provide. Decision fatigue at tier boundaries is a real risk; users who encounter tier assignment as a classification problem rather than a natural decision point may develop workarounds that undermine the model's purpose. The five-tier model is directionally correct but would benefit from operational testing to calibrate tier assignments against measured user behavior. A simpler three-tier model (autonomous, assisted, human-only) might reduce cognitive overhead; whether it would sacrifice necessary governance precision is an empirical question.

### 5.4.8 Commercial Proxy Hardware (Sphero/Jetson) vs. Military-Grade Platforms

BASTION's physical demonstration uses Sphero RVR+ robotic platforms (commercial gaming robots) with NVIDIA Jetson Orin Nano edge AI computing (commercial AI development hardware). Military-grade alternatives (ruggedized UGVs, military-certified edge computing platforms) were considered and deferred.

Commercial hardware was chosen for accessibility, cost, and ecosystem support. The Sphero platform provides a controllable, repeatable demonstration environment without the procurement, safety, and operational complexity of military platforms. The Jetson Orin Nano provides 67 TOPS AI performance in a compact, developer-accessible package with an extensive software ecosystem (CUDA, Ultralytics YOLOv8, computer vision libraries) that accelerates implementation. For a research platform demonstrating architectural concepts, commercial proxy hardware allows the demonstration to focus on the architecture rather than on platform integration engineering.

What was sacrificed is the most critical limitation for military audiences. Commercial demonstration hardware does not validate performance under military operating conditions: vibration, temperature extremes, electromagnetic interference, submersion, and hostile environments that military hardware must tolerate. The Sphero platform's physical capabilities (speed, obstacle traversal, payload capacity) are not representative of operational UGVs. The Jetson's operating temperature range and shock resistance do not meet military specification. The demonstration proves the architecture on commercial hardware; it does not prove the architecture on operational hardware. Transfer validation (demonstrating that the Docker bridge pattern, DID-based identity, and DAO governance integration function on actual military platforms) is a required next step before any operational deployment claim can be made. The architecture is designed to be hardware-agnostic (the bridge pattern works with any robot that supports a Python agent); transfer validation remains empirical work to be done.

### 5.4.9 Alternative Architectures for Cryptographic Governance

Section 5.4.1 documented the choice of NEAR Protocol over a permissioned chain or no blockchain. This section extends that analysis by systematically evaluating whether blockchain and DAOs represent the only architecture capable of satisfying BASTION's governance requirements, or merely one architecture among credible alternatives. The honest answer strengthens rather than undermines the research contribution, because it reveals that the core thesis — cryptographic enforcement of authority over autonomous systems — is architecturally defensible regardless of the specific distributed ledger technology.

#### Governance Requirements Independent of Implementation

Before evaluating alternatives, it is necessary to state BASTION's governance requirements without reference to any specific technology:

1. **Tamper-evident audit trail** — decisions permanently recorded and independently verifiable by all coalition partners
2. **Policy-as-code enforcement** — governance logic that executes automatically and cannot be overridden by any single party
3. **Decentralized identity** — no single nation controls the identity infrastructure for coalition participants or assets
4. **Coalition authority without a central trust anchor** — no partner has to trust another partner's word alone
5. **Caveats that travel with resources** — restrictions enforced wherever the resource is employed, regardless of which nation's systems are executing
6. **Time-limited, expiring delegations** — authority grants with automatic revocation
7. **Training-operational parity** — identical governance mechanism in both modes

The question is whether these requirements can be satisfied by architectures other than public blockchain with DAO governance.

#### Alternative 1: Permissioned Distributed Ledger (Hyperledger Fabric)

Hyperledger Fabric is a permissioned blockchain where consortium membership is defined in advance — only vetted coalition partners participate. It achieves near-identical capabilities to NEAR for BASTION's use case: smart contracts (called "chaincode") with equivalent enforcement properties, an append-only cryptographically signed ledger providing equivalent auditability, per-organization certificate authorities eliminating single-provider identity dependency, no gas costs (transactions are free within the consortium), and private data collections providing scoped intelligence compartmentalization.[^alt1]

Fronteddu et al. demonstrated at ICMCIS 2025 that Hyperledger Fabric can operate over tactical networks using the Anglova network emulation scenario, validating its feasibility in military communication environments with constrained bandwidth and intermittent connectivity.[^alt2] The U.S. Air Force has invested in distributed ledger technology for logistics tracking at Tinker Air Force Base using Hyperledger Fabric, demonstrating institutional willingness to adopt permissioned DLT for defense applications.[^alt3]

What Hyperledger Fabric sacrifices relative to NEAR is true permissionlessness — a new coalition partner cannot join by verifying the chain state; they must be added to the consortium configuration, creating a centralized coordination dependency at coalition formation. However, for military coalitions, this tradeoff may be operationally acceptable: coalition partners are always vetted through existing bilateral agreements, NATO frameworks, and standing security arrangements before they gain access to operational systems. The "trustless" property of a public blockchain is architecturally elegant but operationally somewhat redundant in a context where pre-existing institutional trust relationships are a prerequisite for coalition membership.

#### Alternative 2: TEE + BFT Consensus + XACML Policy Enforcement

A more complex but standards-grounded alternative avoids blockchain entirely by combining three established technologies.

**Trusted Execution Environments (TEEs)** — Intel SGX, ARM TrustZone — provide hardware-attested code execution where the executing platform can cryptographically prove to external parties that the governance logic has not been tampered with. This achieves hardware root of trust without requiring a distributed ledger. For coalition partners, TEE attestation answers the question "is the governance code I agreed to actually running?" with hardware-level certainty rather than blockchain-level consensus.

**Byzantine Fault Tolerant (BFT) consensus protocols** — HotStuff, PBFT, Tendermint — achieve distributed agreement among a known set of parties without the full overhead of a blockchain. For coalition voting (BASTION's DAO governance function), BFT among the N participating nations achieves the same mathematical certainty of agreement with significantly lower latency. BFT architectures have established precedent in safety-critical military systems: the Boeing 777 and 787 flight control systems and SpaceX Dragon spacecraft use Byzantine fault tolerance for mission-critical consensus.[^alt4] DARPA has funded BFT research specifically for military applications since the 1970s, when NASA's Software Implemented Fault Tolerant (SIFT) project sought resilient systems for aircraft control.[^alt5]

**XACML (eXtensible Access Control Markup Language)** provides a mature, DoD-understood standard for attribute-based access control that can model the same multi-dimensional caveat structure as BASTION's ResourceCaveats — classification, releasability, ROE tier, geographic bounds, time window — and enforce them at Policy Enforcement Points distributed across the coalition network. Every branch of the U.S. military has adopted ABAC, and the Department of Commerce has made it mandatory practice.[^alt6]

This combination achieves hardware-enforced policy-as-code, distributed consensus for coalition decisions, and structured caveat enforcement — all without blockchain. What it sacrifices is audit trail elegance: signed logs provide tamper evidence, but they are not as self-evidently independently verifiable as a public ledger. Coalition partners must trust the log infrastructure more than they would trust a public chain's state.

#### Alternative 3: W3C Verifiable Credentials + PKI + Signed Append-Only Logs

The lightest-weight alternative builds on infrastructure that already exists in NATO. NATO operates a Public Key Infrastructure where each member nation maintains its own Certificate Authority, and the NATO PKI (NPKI) Concept of Operations defines interoperability between national PKIs and the alliance-wide infrastructure.[^alt7] W3C Verifiable Credentials can encode the same caveat data as BASTION's DID ResourceCaveats struct and cryptographically bind restrictions to the resource without requiring blockchain — VCs require only a signature from a trusted issuer.

Signed, append-only logs — where each entry contains the hash of the previous entry — provide blockchain-equivalent tamper evidence. Google's Certificate Transparency system demonstrates this model at global scale: public, verifiable, append-only Merkle hash trees provide cryptographic proof of certificate issuance accountability with independent auditability.[^alt8] RFC 9162 formalizes this approach as Certificate Transparency Version 2.0.[^alt9]

What this alternative sacrifices is the enforcement mechanism. VCs and PKI tell the system what is allowed; they do not automatically prevent what is not allowed in the way that a smart contract execution gate does. Achieving the equivalent "the system will not proceed" guarantee requires Policy Enforcement Points at the execution layer — achievable, but requiring more distributed infrastructure than a single smart contract deployment.

#### Alternative 4: Multi-Party Computation + Threshold Signatures

For BASTION's coalition authority problem specifically (the DAO governance layer), threshold cryptography provides a mathematically rigorous alternative. In threshold signature schemes, a secret key is split across multiple parties such that a defined subset (t-of-n) must cooperate to produce a valid signature. No single party can authorize alone, and the mathematics prevents it — this is not a policy constraint but a cryptographic impossibility.[^alt10]

For BASTION's strike authorization requirement (100% coalition consensus), threshold signatures among coalition nation representatives achieve the same guarantee with no blockchain involvement. NIST's Multi-Party Threshold Cryptography (MPTC) program is actively standardizing these schemes, with the MPTS 2026 workshop advancing standardization of threshold ECDSA and post-quantum threshold signatures.[^alt11]

What threshold cryptography sacrifices is flexibility. Voting and delegation logic must be designed into the cryptographic protocol itself, whereas smart contracts express that logic in general-purpose code. Threshold schemes handle fixed-quorum decisions elegantly; dynamic delegation, time-limited authority grants, and complex multi-tier voting rules are harder to express purely cryptographically.

#### Structural Assessment

The honest structural assessment is that blockchain's genuinely unique property is trustless permissionlessness — the ability for parties with no pre-existing relationship to transact with cryptographic certainty. In cryptocurrency, this property is essential. In coalition military operations, it is less critical than the architecture implies, because coalition partners are always known, vetted, and bound by pre-existing agreements before operations begin. "I don't trust this nation's cryptographic signature" is a political problem that no distributed ledger resolves.

The intellectual honesty is that NEAR Protocol's public blockchain serves as a powerful research demonstration vehicle — it proves the governance pattern cleanly and provides an independently verifiable ledger that any observer can inspect. But it carries real costs for production deployment: gas fees at operational scale, public chain dependency creating availability risk, DDIL vulnerability when connectivity to chain validators is interrupted, and institutional unfamiliarity in defense procurement organizations.

For a production system, the architecture that would likely warrant serious evaluation is a combination of permissioned DLT (Hyperledger Fabric or equivalent) for coalition governance with zero gas costs and better latency, W3C Verifiable Credentials for resource identity building on NATO's existing PKI infrastructure, hardware TEE attestation for device trust, and BFT consensus for coalition-level votes. This combination achieves equivalent auditability, equivalent enforcement, and infrastructure designed for the "known consortium" model that military coalitions actually are.

#### Implications for the Research Contribution

This analysis does not diminish BASTION's contribution; it clarifies it. BASTION is not an argument that blockchain is the only answer for military C2 governance. It is an argument that *cryptographic enforcement* — "trust terminates at mathematics, not policy" — is the right architectural pattern for governance of lethal autonomous systems in coalition operations. Blockchain and DAO governance are a clean, independently verifiable demonstration vehicle for that pattern. The production design space includes the full range of alternatives evaluated above, each of which must be assessed against operational requirements including gas costs, DDIL performance, NATO standards alignment, institutional familiarity, and security certification pathways.

The right question is not "is blockchain right for military C2?" — a platform question that invites unproductive debate. The right question is "should governance of lethal autonomous systems be policy-enforced or cryptographically enforced?" On that question, the evidence from BASTION's implementation — combined with the current operational reality where AI targeting systems generate thousands of targets per day with limited audit trails — argues strongly for cryptographic enforcement as the required paradigm.

[^alt1]: Hyperledger Foundation, "Hyperledger Fabric: A Distributed Operating System for Permissioned Blockchains," GitHub Repository, 2024, https://github.com/hyperledger/fabric. See also Elli Androulaki et al., "Hyperledger Fabric: A Distributed Operating System for Permissioned Blockchains," in *Proceedings of the Thirteenth EuroSys Conference* (Porto: ACM, 2018), Article 30, https://doi.org/10.1145/3190508.3190538.

[^alt2]: Roberto Fronteddu, Maggie R. Breedy, Michal Jarosz, Niranjan Suri, Konrad S. Wrona, Jakub Sychowiec, and Zbigniew Zielinski, "Experimental Analysis of the Performance of the Hyperledger Fabric over Tactical Networks," in *Proceedings of the 2025 International Conference on Military Communication and Information Systems (ICMCIS)* (Oeiras, Portugal: IEEE, 2025), https://ieeexplore.ieee.org/document/11047941.

[^alt3]: Vasilis Karakostas, Maria Makridaki, and Ioannis Mavridis, "Blockchain as a Cybersecurity Enabler in Federated Networks for Resilience and Interoperability," *IoT* 6, no. 2 (2025): 54, https://www.mdpi.com/2624-800X/6/2/54.

[^alt4]: Leslie Lamport, Robert Shostak, and Marshall Pease, "The Byzantine Generals Problem," *ACM Transactions on Programming Languages and Systems* 4, no. 3 (1982): 382-401, https://doi.org/10.1145/357172.357176.

[^alt5]: John H. Wensley et al., "SIFT: Design and Analysis of a Fault-Tolerant Computer for Aircraft Control," *Proceedings of the IEEE* 66, no. 10 (1978): 1240-1255, https://doi.org/10.1109/PROC.1978.11114.

[^alt6]: Vincent C. Hu et al., *Guide to Attribute Based Access Control (ABAC) Definition and Considerations*, NIST Special Publication 800-162 (Gaithersburg, MD: National Institute of Standards and Technology, 2014), https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-162.pdf.

[^alt7]: NATO Communications and Information Agency, "Identity Management: NATO Public Key Infrastructure," NATO Information Assurance, https://www.ia.nato.int/identitymanagement.

[^alt8]: Ben Laurie, Adam Langley, and Emilia Kasper, "Certificate Transparency," *ACM Queue* 12, no. 8 (2014), https://doi.org/10.1145/2668152.2668154.

[^alt9]: B. Laurie, E. Messeri, and R. Stradling, "Certificate Transparency Version 2.0," RFC 9162, Internet Engineering Task Force, December 2021, https://www.rfc-editor.org/rfc/rfc9162.html.

[^alt10]: Rosario Gennaro and Steven Goldfeder, "One Round Threshold ECDSA with Identifiable Abort," in *Proceedings of the Network and Distributed System Security Symposium (NDSS)* (San Diego: Internet Society, 2024), https://www.ndss-symposium.org/ndss-paper/secure-multiparty-computation-of-threshold-signatures-made-more-efficient/.

[^alt11]: National Institute of Standards and Technology, "Multi-Party Threshold Cryptography," NIST Computer Security Resource Center, 2025, https://csrc.nist.gov/projects/threshold-cryptography.

---

## 5.5 Adversarial Analysis, Why This Approach Might Not Work

Strong research acknowledges the strongest arguments against its own conclusions. This section systematically red-teams the BASTION approach, not to undermine the contribution, but to demonstrate that the limitations have been examined honestly and that mitigations exist where possible. Each concern is presented as a skeptical reviewer would phrase it, with severity, mitigations, and an honest assessment of residual risk after mitigations are applied.

### 5.5.1 LLM Determinism

**Adversarial Argument:** Military planning requires reproducible outputs. LLMs are inherently non-deterministic. The same intelligence document may produce different entity extraction on consecutive runs, making it impossible to verify, audit, or reproduce AI-generated planning products. A commander who cannot reproduce an AI recommendation cannot audit it. A planner who cannot reproduce an extraction cannot validate it against source documents.

**Severity:** Significant.

**Mitigation Options:** Temperature=0 settings reduce but do not eliminate output variance. Reproducibility seed parameters (supported by some LLM providers) improve consistency within a single model version. Immutable audit logging of every LLM input and output pair creates a record of what was produced even if not reproducible on demand. Human review gates treat LLM outputs as intelligence estimates requiring analyst validation rather than ground truth requiring audit. Version-pinned model deployments prevent mid-operation model drift.

**Residual Risk:** Even with temperature=0 settings, LLM outputs vary across model versions, infrastructure configurations, and provider updates. True bit-for-bit reproducibility is not achievable with current LLM technology. Human review catches gross errors but may miss subtle analytical drift between runs: two extractions that appear similar but diverge on relationship types or confidence assignments. The audit log records what the LLM produced but does not guarantee future reproducibility of the same output. Systems requiring bit-for-bit audit reproducibility should not rely on LLMs for the audited outputs; human analyst review should produce the auditable artifact, with LLM outputs serving as analyst aids.

### 5.5.2 LLM Accuracy and Hallucination

**Adversarial Argument:** LLMs generate plausible but fabricated analysis. In an intelligence context, a hallucinated entity relationship (a fabricated connection between an adversary organization and a target that does not actually exist) or a fabricated adversary capability could lead to catastrophic planning errors. Confidence scoring does not solve this: the confidence score is generated by the same model that generated the potentially hallucinated content. A model that hallucinates a relationship will also hallucinate high confidence in that relationship.

**Severity:** Critical. This is the single highest-risk element of the architecture.

**Mitigation Options:** Multi-agent cross-validation (the 10-agent document intelligence team includes overlapping extraction agents whose outputs are compared for consistency before graph population). Human review gates at every consequential decision point require analyst validation of extracted content against source documents. The NATO Admiralty Code confidence framework treats AI outputs as intelligence estimates (A-F reliability, 1-6 information credibility) rather than facts, encoding epistemic humility in the data model itself. Source provenance tracking links every extracted entity to its source documents, enabling analyst spot-checks. Structured output schemas constrain generation to valid entity types and relationship classes, reducing the surface area for fabrication. Multi-source cross-validation degrades confidence scores for single-source claims, flagging them for additional review.

**Residual Risk:** No combination of mitigations eliminates hallucination risk. Subtle fabrications (slightly wrong relationship strength, plausible but incorrect organizational affiliation, fabricated adversary capability that passes multi-agent cross-validation because all agents share the same underlying model weights) may survive to influence planning. The system must be understood as decision support, never decision replacement. An analyst who treats AI-extracted entities as ground truth rather than estimates is misusing the system in a way that no technical mitigation can prevent. Training and doctrine for AI-augmented intelligence analysis are as important as the technical safeguards.

### 5.5.3 LLM Adversarial Manipulation

**Adversarial Argument:** An adversary who understands that BASTION uses LLMs for intelligence extraction could craft documents specifically designed to manipulate LLM outputs: prompt injection embedded in intelligence feeds, adversarial text calibrated to trigger specific extraction errors, or deception campaigns designed to exploit known LLM weaknesses. A sophisticated state actor conducting influence operations against a coalition planning system would naturally target its AI extraction pipeline.

**Severity:** Significant.

**Mitigation Options:** Input sanitization and content filtering applied before document processing reduce the attack surface for obvious injection patterns. Multi-source cross-validation flags anomalous extractions from single sources; a document that produces dramatically different entity extractions than other source documents raises confidence flags. Separate extraction and validation pipeline stages (extractors produce candidates; validators check them against existing knowledge) provide a second check before graph population. Human analyst review of extracted entities, particularly from novel or unverified sources, catches adversarial manipulations that automated checks miss. Confidence scoring that degrades for single-source claims forces additional scrutiny on potentially adversarial inputs.

**Residual Risk:** Adversarial text manipulation of LLMs is an active research problem with no complete solution. A sophisticated adversary with knowledge of the extraction pipeline's architecture (including its prompt templates and validation logic) could craft inputs that pass sanitization and multi-source checks by coordinating manipulation across multiple seemingly independent source documents. This risk exists for any AI-augmented intelligence system and is not unique to BASTION, but it is not solved by any mitigation currently implemented. Red-team testing of the extraction pipeline against adversarially crafted inputs has not been conducted for this research prototype.

### 5.5.4 Blockchain Overhead vs. Tactical Tempo

**Adversarial Argument:** Two-second transaction finality on NEAR is fast for financial applications but potentially fatal for military decision-making. If a time-critical strike window closes during blockchain consensus, the governance mechanism becomes a liability rather than an asset. At operational scale (thousands of governance transactions per minute during a complex operation) throughput constraints could create coordination bottlenecks that conventional C2 systems do not have.

**Severity:** Significant.

**Mitigation Options:** The five-tier graduated authority model is the primary mitigation: Tier 1 (AI_AUTONOMOUS) and Tier 2 (AI_PRIMARY) decisions execute without requiring blockchain consensus, using conventional authorization. Blockchain records are written asynchronously after the fact for audit trail purposes. Only Tier 5 (COALITION_UNANIMOUS) and explicitly designated Tier 4 (HUMAN_ONLY) decisions require synchronous on-chain approval. Pre-authorized mission parameters cached locally at edge nodes allow tactical execution to continue without real-time blockchain access. Private or dedicated NEAR network deployment reduces latency relative to the shared public testnet. Mission parameter pre-authorization (the robot downloads mission parameters before execution; the blockchain is not consulted mid-mission) ensures that execution tempo does not depend on consensus latency.

**Residual Risk:** Time-critical decisions requiring coalition consensus (Tier 5 COALITION_UNANIMOUS) inherently trade speed for governance accountability. No mitigation eliminates this tension; it is the fundamental design tradeoff of using blockchain for multi-party decision authority. Under adversarial pressure and time compression, the governance overhead may be judged unacceptable; commanders may seek to bypass consensus for time-critical decisions in ways that undermine the governance framework. Private network deployment reduces latency but increases infrastructure burden and reduces the decentralization benefit that public-chain deployment provides. The throughput limits of NEAR at operational scale under realistic military transaction volumes have not been empirically tested for this prototype.

### 5.5.5 DDIL Failure Cascade

**Adversarial Argument:** The system assumes sufficient connectivity for blockchain consensus and AI agent coordination. In a real DDIL environment with sustained electromagnetic jamming, severed undersea cables, and contested spectrum, the blockchain becomes unreachable, AI agents cannot coordinate, the knowledge graph cannot update, and the COP goes stale. The system degrades to a collection of isolated edge nodes with whatever local state they last cached. Is that degraded state actually useful? Or does it produce a false picture that is worse than no picture, presenting stale data as current intelligence to commanders who may not realize how stale it is?

**Severity:** Significant.

**Mitigation Options:** The robot bridge pattern with local mission state persistence allows robots to continue executing authorized missions during cloud disconnection. The BLE leader-spoke swarm architecture enables the leader to continue commanding followers using cached mission state independent of cloud connectivity. Pre-authorized mission envelopes cached at edge nodes provide autonomous operation scope without real-time governance access. Configurable staleness indicators on COP data (time-since-update badges on every symbol) surface the currency of information to commanders rather than presenting stale data as current. Graceful degradation design marks stale data explicitly rather than allowing it to appear current.

**Residual Risk:** Extended DDIL degrades the system to its cached state. The gap between "designed for DDIL" and "tested under sustained DDIL" is real and significant. Extended disconnection scenarios, reconnection reconciliation (what happens when an edge node that has been operating offline reconnects with potentially conflicting state), and conflict resolution between divergent edge states have not been empirically validated in this prototype. The DDIL resilience of this system is architectural intent, not demonstrated capability under sustained disconnection. Stale data with correct staleness indicators is better than stale data presented as current; whether stale data with indicators is operationally useful depends on the tactical situation in ways that require field testing to evaluate.

### 5.5.6 Single Developer / AI-Augmented Development Validity

**Adversarial Argument:** A system built by one developer with AI assistance in approximately ten weeks cannot have the robustness, security, or reliability required for military C2. The testing is limited to single-user scenarios. The architecture has never faced adversarial stress testing, concurrent user loads, or operational tempo. The impressive feature count (25 deployed agents, ~572 endpoints, 14 smart contracts) may mask shallow implementations that break under conditions the developer did not test.

**Severity:** Moderate.

**Mitigation Options:** The modular architecture with clear component boundaries limits the blast radius of implementation failures (a broken agent does not take down the planning workflow). Atomic commit discipline (442 individually revertible commits) provides granular reversibility and documents the implementation at each capability boundary. Comprehensive seed scripts enable reproducible testing state. The architecture is explicitly designed for team development: service boundaries, API contracts, and plugin architecture allow components to be independently developed and tested. Each agent follows a standardized template with common architecture, reducing per-agent implementation variation.

**Residual Risk:** This is a research prototype, not a production system. The research contribution is the architecture, design patterns, and integration demonstration, not implementation maturity. Production deployment of BASTION as a military C2 system would require: independent security audit of smart contracts and API endpoints, load testing under realistic concurrent user scenarios, multi-user stress testing with concurrent planning operations, accessibility review, adversarial penetration testing of the bridge and edge components, and operational testing with trained military users providing feedback on workflow friction. These requirements are not gaps in the research contribution; they are the expected delta between research prototype and production system. The prototype demonstrates that the architecture is coherent and that the integration works; it does not claim implementation readiness.

### 5.5.7 Coalition Trust Assumptions

**Adversarial Argument:** The blockchain verifiability argument assumes coalition partners trust the blockchain protocol itself, trust the smart contract code, and trust that key management has not been compromised. These are significant trust assumptions that merely shift the trust problem rather than solving it. A coalition partner who does not trust the United States is not going to trust a blockchain whose smart contracts were written by a US researcher. Cryptography does not address political trust deficits.

**Severity:** Moderate.

**Mitigation Options:** Open-source smart contract code allows all partners to audit the governance logic they are trusting. Multi-party deployment (no single nation controls the blockchain infrastructure, with nodes distributed across partner nations) reduces the trust surface from a single operator to the protocol and its code. Formal verification of governance invariants (planned in the Phase 65-66 roadmap) would provide mathematical assurance that specific properties hold under all reachable states. Independent security audit before any operational deployment provides third-party code validation. Multi-party key ceremony protocols with witnesses from each coalition partner address key management trust.

**Residual Risk:** Trustless systems require trust in the system's design, implementation, and deployment. Blockchain reduces the trust surface (cryptographic verification replaces procedural trust for specific governance decisions) but does not eliminate it. A coalition partner must still trust the code, the cryptography, and the key management. That is a smaller and more auditable trust surface than trusting another nation's procedural assurances about what their C2 system did, but it is trust nonetheless. Partners with deep political distrust of the coalition may reject the architecture regardless of its technical properties. Coalition adoption of any shared technical infrastructure requires political trust that technical design cannot substitute for.

### 5.5.8 Doctrinal Rigidity

**Adversarial Argument:** Strict alignment to JP 5-0 six-step planning may constrain creative operational approaches. Real military planning often deviates from doctrine when the situation demands; experienced commanders compress, skip, or restructure planning steps when time is short or the situation is unfamiliar. A system that enforces doctrinal workflow may prevent the very adaptability that effective military operations require. Doctrine describes how planning should work in deliberate conditions; it was not designed to constrain a system's operational flexibility.

**Severity:** Moderate.

**Mitigation Options:** The workflow is configurable; planning steps can be skipped or reordered by authorized users. The FRAGO (Fragmentary Order) mechanism enables rapid plan modification outside normal planning sequence. AI agents can recommend workflow deviations when the situation warrants accelerated or abbreviated planning. Commander override capability exists at every governance gate, allowing deliberate bypass of doctrinal checkpoints with recorded authorization.

**Residual Risk:** The system's structure inherently favors doctrinal approaches. Planning workflows that do not map to JP 5-0 phase categories may be awkward to express; a commander conducting a hasty attack from a meeting engagement may find the six-tab structure an ill-fitting organizational schema for what is actually a compressed, simultaneous process. Novel operational concepts that emerge from the operational environment rather than from doctrinal design may not find natural homes in the existing tab architecture. The tension between doctrinal structure and operational creativity is inherent to any doctrine-based system and cannot be eliminated without also losing the cognitive familiarity benefits that doctrinal alignment provides.

### 5.5.9 Scale and Complexity Debt

**Adversarial Argument:** 25 AI agents, approximately 572 REST endpoints, 14 smart contract modules: this is a complexity surface that grows faster than testing and validation can cover. Each agent is an attack surface. Each endpoint is a vulnerability. Agent-to-agent interactions are combinatorially complex and cannot be exhaustively tested. The system may be too complex to secure, too complex to audit, and too complex to maintain. Complexity is the enemy of security.

**Severity:** Significant.

**Mitigation Options:** Modular architecture with clear service boundaries limits interaction surface between components. The standardized agent template provides common architecture across all 25 agents, reducing per-agent variation. The plugin architecture enables extensibility without modifying the core platform. Automated API endpoint testing covers regression behavior. Smart contract unit and integration testing validates governance invariants.

**Residual Risk:** Complexity is the primary long-term risk for BASTION's continued development. Testing coverage cannot keep pace with feature growth at research prototype velocity; the current test coverage is functional but not comprehensive. Agent-to-agent interaction effects are combinatorially complex and not exhaustively tested; emergent behaviors from agent coordination under novel inputs may not have been encountered. A production program would require dedicated testing, security audit, and maintenance teams proportional to the system's complexity surface. The research contribution is demonstrating that this level of integration is architecturally achievable; sustainable maintainability requires the organizational investment that a research prototype does not have.

### 5.5.10 Ethics of AI Speed in Lethal Contexts

**Adversarial Argument:** Even with human authority gates on lethal decisions, AI acceleration of the decision pipeline compresses the time available for human reflection. A commander presented with an AI-generated target recommendation, AI-scored risk analysis, and AI-assessed legal compliance in seconds rather than hours may feel implicit pressure to decide at AI speed rather than at deliberation speed. The human gate exists, but the tempo around it may undermine its purpose. AI does not just accelerate coordination; it also implicitly accelerates the human's decision-making environment.

**Severity:** Moderate.

**Mitigation Options:** Configurable minimum deliberation period requirements could enforce a mandatory review time before the system accepts an approval. Explicit risk acknowledgment workflow requires itemized review of specific risk categories rather than a single approve button. Decision audit trail records time-to-decision for every consequential decision, enabling post-action review of whether deliberation thresholds were honored. Training protocols emphasizing that AI speed applies to coordination, not to human judgment timelines, address the behavioral dimension.

**Residual Risk:** Organizational culture and operational urgency may override procedural mitigations. A commander under genuine time pressure during a crisis may rubber-stamp AI recommendations despite deliberation requirements, reducing the human gate to accountability theater. This is fundamentally a human factors and organizational psychology challenge that technical mitigations can support but cannot solve. Minimum deliberation timers can be overridden by commanders who have override authority. The tension between AI speed and human deliberation quality is an open research problem in AI-augmented decision-making that no C2 platform architecture fully resolves. Research into the effects of AI recommendation tempo on human decision quality in military contexts is needed before any strong claim can be made about human control quality under operational pressure.

---

### Summary Table

| Concern | Severity | Key Mitigation | Residual Risk |
|---------|----------|----------------|---------------|
| LLM Determinism | Significant | Temperature=0, audit logging, human review | Bit-for-bit reproducibility unachievable |
| LLM Accuracy / Hallucination | **Critical** | Multi-agent cross-validation, human review gates, NATO confidence framework | Subtle hallucinations may survive all mitigations |
| LLM Adversarial Manipulation | Significant | Input sanitization, multi-source cross-validation | Sophisticated coordinated adversarial inputs not solved |
| Blockchain Overhead vs. Tempo | Significant | Five-tier model routes most decisions off-chain | Coalition consensus decisions inherently trade speed |
| DDIL Failure Cascade | Significant | Local mission caching, staleness indicators | Extended DDIL resilience not empirically validated |
| Single-Developer Validity | Moderate | Modular architecture, atomic commits | Production readiness requires security audit and load testing |
| Coalition Trust Assumptions | Moderate | Open-source contracts, multi-party deployment | Cryptography does not address political trust deficits |
| Doctrinal Rigidity | Moderate | Configurable workflow, commander override | Novel operational concepts may not map to JP 5-0 structure |
| Scale and Complexity Debt | Significant | Standardized templates, plugin architecture | Testing coverage cannot keep pace with feature growth |
| AI Speed vs. Human Deliberation | Moderate | Deliberation timers, risk acknowledgment workflow | Organizational pressure may override procedural mitigations |

**Bottom line:** BASTION is a research contribution demonstrating architectural feasibility for AI-DAO integration in military coalition C2. It is not a claim of operational readiness. The adversarial analysis above demonstrates that the authors have examined these limitations systematically and have designed mitigations where technically feasible, while being transparent about what remains unresolved. A system that cannot honestly characterize its limitations should not be trusted with the applications BASTION is designed to support. These concerns (particularly LLM hallucination risk and the gap between designed-for-DDIL and validated-under-DDIL) define the research agenda for the next development phase.

---

## 5.6 Future Work

### Near-Term Extensions

**Problem set model and echelon awareness.** Renaming workspaces to "problem sets" (JP 5-0 terminology) with echelon-awareness (strategic, operational, tactical) would strengthen the doctrinal alignment of the data model and enable echelon-appropriate defaults for governance thresholds, agent configurations, and product templates.

**Strategic document containers and actor categorization.** Organizing strategic documents into nation/group containers (e.g., United States, China, NATO) with actor categories (ally, adversary, neutral, partner) would provide persistent container-based organization for building strategic environments over time, feeding into inheritance mechanisms for child problem sets.

**AI strategic context and knowledge graph integration.** Wiring subscribed strategic environment data and container-scoped knowledge graphs into AI agent context would enable agents to draw on structured strategic knowledge rather than raw document text. Container-scoped RAFT graph construction with auto-trigger on document changes would keep the knowledge graph current.

**Strategic environment inheritance.** A strategic-level problem set serving as context provider with inheritance mechanisms for directives, policy, and intelligence would enable child problem sets to inherit strategic context without manual duplication, with update propagation when strategic guidance changes.

**Embedded DAO governance at decision gates.** Moving DAO governance from a dedicated interface into contextual workflow decision gates would surface proposals at natural planning decision points (objective approval, COA selection, order release) rather than requiring navigation to a separate governance view.

**Contextual AI staff integration.** Surfacing AI agent output contextually per tab with per-tab assistants aware of workflow phase would provide recommendation engines tied to doctrinal workflow position rather than requiring users to seek out agent capabilities.

**Generalized Chief of Staff coordination beyond operational design.** Ironclaw's Chief of Staff coordination architecture (Section 3.21) is parameterized by section definitions and coverage criteria; the underlying LangGraph interrupt-resume mechanism is domain-agnostic. Extending the coordination pattern to other planning frameworks (MDMP mission analysis, targeting decision support, logistics requirements generation) would generalize a valuable staff coordination capability across the planning lifecycle without requiring new infrastructure. Each new coordination domain requires section definition, doctrinal coverage criteria, and red-team questioning guidance, but the execution framework is reusable.

**Multi-user collaborative approach editing.** The visual operational approach editor (Section 3.22) currently serializes edits through a single user session. Real operational approach development involves multiple staff officers contributing simultaneously: the J3 positioning maneuver units, the J5 placing LOEs, the J4 marking logistics nodes. Extending the MapOverlay editor with Yjs CRDT-based collaborative editing (the same technology the Design tab uses for collaborative operational design) would enable concurrent multi-staff approach editing with conflict resolution. This extension would align the visual approach editor with the collaborative model already established for operational design.

**Memory decay and relevance scoring for Ironclaw.** Ironclaw's persistent memory system (Section 3.23) stores memories with fixed TTL bounds but no within-TTL relevance decay. Adding a relevance scoring mechanism that decays older entries relative to recent interactions (reducing the retrieval weight of memories more than N sessions old) would improve context quality for long-running advisory relationships by surfacing recent observations over stale ones. Relevance decay also provides a more privacy-respecting memory profile: interaction patterns from significantly past planning periods become less influential as new patterns emerge.

**Layer-2 or off-chain authorization caching for high-tempo operations.** The on-chain `check_employment_authorized()` method provides verifiable authorization at approximately NEAR testnet latency. At operational tempo with high-frequency authorization checks, pre-authorization caching (storing caveat check results locally with a configurable validity window, e.g., 30 seconds for time-sensitive resource assignments) would reduce check latency to near-zero for the majority of requests while ensuring that caveat changes propagate within the cache validity window. This caching pattern requires careful cache invalidation design to avoid serving stale authorizations during the window between a caveat update and cache expiry.

**Source-tier-aware confidence scoring.** The OSINT intelligence extraction pipeline currently applies a uniform confidence score of 0.65 to all OSINT-sourced claims, regardless of source reliability. Implementing NATO STANAG 2511-aligned source-tier-aware scoring (differentiating satellite imagery, typically A1 or A2 on the Admiralty scale, from unconfirmed social media, typically F6) would improve the analytical value of confidence scores. The data model already carries NATO source reliability codes through the document intelligence pipeline; extending the confidence calculation to use these codes requires updating the scoring logic in the fact extractor specialist agent.

Multi-platform autonomous vehicle integration represents an immediate extension beyond current demonstration capabilities. Coordinating multiple heterogeneous autonomous systems through DAO governance would validate BASTION's scalability claims and demonstrate more realistic tactical scenarios.

Coalition health monitoring would extend the governance framework to track coalition partner cohesion, national caveat compliance, and narrative impact in real time.

Production deployment through CI/CD pipeline to Hetzner server infrastructure would move BASTION from development to an accessible demonstration environment, with TEE-aware component separation documented for production.

### Phase 59-75 Roadmap Highlights

The BASTION development roadmap extends through Phase 75 with planned phases beyond the current v0.3 implementation. Phases 55-58 are now complete (Ironclaw Chief of Staff coordination, visual approach editor, Ironclaw memory, on-chain DID caveats). Selected highlights of remaining roadmap phases include:

**JSON-LD semantic brain.** The current knowledge graph implementation uses a property-graph model. The next major graph enhancement introduces JSON-LD semantic markup, enabling interoperability with external ontologies and OSINT data sources. Linked Data publishing would allow BASTION's knowledge graph to integrate with NATO standardization data models and allied intelligence exchange formats without manual mapping.

**ATAK/CoT interoperability.** Android Team Awareness Kit (ATAK) is the operational standard for tactical common operating picture in the US military. Implementing Cursor on Target (CoT) message exchange between BASTION's COP layer and ATAK would provide the integration path for operational demonstration environments where ATAK is already deployed. This interoperability would validate BASTION's COP layer against field-standard tools rather than a standalone display.

**End-to-end swarm demonstration.** The current swarm capability uses three platforms of the same type. The planned multi-platform swarm demonstration coordinates heterogeneous platforms (ground, aerial, and fixed sensor) through the same DAO-governed swarm leader architecture. Heterogeneous platform coordination introduces capability negotiation, mixed formation geometries, and type-specific mission assignment that the current homogeneous swarm does not exercise.

**Coalition multi-tenancy (Phase 61-63).** The current implementation supports a single coalition instance. Multi-tenancy would enable separate coalition organizations to operate concurrently on the same BASTION infrastructure with complete data isolation. This capability is essential for production deployment where multiple exercises, training events, or operational activities may run simultaneously.

**Formal verification of DAO governance invariants (Phase 65-66).** The safety invariants embedded in BASTION's smart contracts are validated through testing but not formally verified. Formal verification using model checking or theorem proving would provide mathematical guarantees that the invariants hold under all reachable states, eliminating the residual risk that untested edge cases could violate human authority boundaries.

**Operational testing with military exercises (Phase 67-70).** The long-range roadmap targets integration with actual military exercise programs, initially in observer role and subsequently as a planning support tool. Exercise validation with trained military planners would provide the most authoritative assessment of doctrinal alignment, workflow integration, and user acceptance that laboratory testing cannot replicate.

**Extended heterogeneous swarm operations.** Longer-term swarm research will examine leadership election stability under node failure, dynamic formation adaptation to terrain constraints, and multi-swarm coordination across hierarchical command structures. These capabilities are required for operationally relevant swarm behavior but are out of scope for the current proof-of-concept scope.

### Research Directions Opened by MDMP and Escalation Integration

The MDMP governance framework and escalation modeling capabilities described in Sections 3.5 and 3.6 open several research directions that merit investigation.

Escalation model calibration against historical data would validate the escalation ladder frameworks currently implemented with configurable but uncalibrated parameters. Mapping historical crises to the escalation model's rung structure and testing whether the trigger conditions and thresholds produce predictions consistent with observed outcomes would establish confidence bounds for the escalation modeling capability. This calibration requires access to classified or restricted historical case studies that the current research context does not provide.

Assumption management validation in exercises would test whether the formal assumption lifecycle (Pending, Accepted, Invalidated) with automatic replanning triggers improves planning outcomes compared to traditional informal assumption tracking. The hypothesis that blockchain-enforced assumption accountability reduces the risk of plans built on invalid premises requires empirical validation through planning exercises with measurable outcomes.

Safety matrix boundary optimization would investigate the optimal allocation of MDMP activities across the five authority tiers. The current allocation derives from doctrinal analysis, but operational experience may reveal that some activities benefit from different authority levels than doctrine suggests. Research into adaptive authority allocation (where the system adjusts tier assignments based on measured agent reliability and operational context) could improve the balance between speed and safety.

Adversary model adversarial robustness requires investigation into how adversaries might deliberately manipulate the inputs that BASTION's adversary modeler and deception detector consume. If an adversary understands that BASTION generates MLCOA and MDCOA from observable indicators, they could shape those indicators to produce misleading adversary COAs. Research into adversarial robustness for military AI planning systems would strengthen the analytical capabilities described in Section 3.6.

### Long-Term Research Directions

Full DIME/DIMEFIL instrument orchestration would extend BASTION beyond military coordination to whole-of-government approaches. The Effect Cascader agent already traces consequences across DIME domains, providing a foundation for cross-domain analysis. Extending DAO governance to coordinate across government agencies would require additional research into interagency processes and authorities, but the effects analysis framework provides a starting point for understanding how military actions create requirements for diplomatic, information, and economic coordination.

Cross-domain federated learning could enable AI agents to improve collaboratively while respecting classification boundaries. Agents operating at different classification levels or in different coalition partner networks could share learning without sharing the underlying data. This capability would address the tension between AI improvement through data sharing and security requirements for information protection.

Real coalition exercises would provide the operational validation that demonstration environments cannot. Integrating BASTION into actual military exercises, even in observer or limited-participation roles, would generate insights about operational utility and integration challenges that inform further development. The MDMP governance gates and assumption tracking capabilities are particularly suited to exercise validation, as exercises provide controlled environments where the benefits of formal governance enforcement can be measured against traditional planning processes.

Accreditation path research would investigate the security certification requirements for deploying BASTION in classified environments. Military systems handling classified information must undergo accreditation processes that can be lengthy and demanding. Understanding these requirements early and designing for accreditability would accelerate potential operational adoption.

### Policy Research Needed

Legal frameworks for blockchain-based military C2 remain undeveloped. Questions about authority, liability, and compliance with existing laws and treaties require attention from legal scholars and policy makers. How do existing command authorities translate to DAO governance? What legal status do AI agents have when acting within delegated authority? How do international agreements governing coalition operations apply to blockchain-coordinated actions?
