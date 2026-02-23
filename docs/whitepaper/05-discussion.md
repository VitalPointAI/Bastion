# 5. Discussion

The Results section demonstrated BASTION's capabilities through an end-to-end scenario connecting strategic objectives to tactical execution. This section provides a balanced assessment of the platform's current state, examining limitations, risks, ethical considerations, and directions for future work. Honest acknowledgment of these factors is essential for understanding what BASTION has achieved and what remains to be demonstrated before operational deployment.

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

### Operational Realism

The tabletop demonstration necessarily simplifies aspects of military operations that would affect real-world deployment.

BASTION's ROE enforcement engine and dedicated ROE Compliance agent provide declarative rule evaluation with commander override workflows and blockchain audit trails. However, operational ROE involve nuanced conditions, graduated responses, and situation-specific exceptions that require human interpretation beyond what declarative rules can capture. The ROE Compliance agent can validate planned actions against encoded constraints, but encoding the full complexity of ROE interpretation—particularly for edge cases requiring legal judgment—remains a challenge that the system addresses through human authority checkpoints rather than attempting complete automation.

Coalition dynamics in the demonstration are cooperative by design. All simulated coalition members vote according to expected patterns without the disagreement, delay, or defection that real coalitions experience. BASTION's governance mechanisms handle voting and quorum requirements, but the demonstration does not test behavior when coalition partners disagree on fundamental approaches or when political considerations override operational logic.

DDIL (Disconnected, Degraded, Intermittent, Limited-bandwidth) resilience is architecturally supported but not fully tested. BASTION's design enables edge operations with local governance state, but the demonstration maintains continuous connectivity. Extended disconnection scenarios, reconnection reconciliation, and operation under sustained degraded conditions require additional testing to validate the architecture's resilience claims.

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

Multi-platform autonomous vehicle integration represents the most immediate extension beyond current demonstration capabilities. Coordinating multiple heterogeneous autonomous systems through DAO governance would validate BASTION's scalability claims and demonstrate more realistic tactical scenarios. This work requires integrating additional vehicle platforms, developing multi-agent coordination protocols, and testing under more complex operational scenarios.

Coalition health monitoring would extend the governance framework to track coalition partner cohesion, national caveat compliance, and narrative impact in real time. Two additional AI agents—a Coalition Health Agent monitoring partner posture changes and defection risk, and a Narrative Impact Agent modeling information operation effects across audience segments—would complement the MDMP governance gates with continuous coalition situational awareness. National caveat tracking integrated into the DAO linkages contract would enable automatic conflict detection when planned actions may violate partner constraints.

Real OSINT data integration would replace simulated intelligence inputs with actual open-source intelligence feeds. BASTION's architecture includes OSINT integration capabilities with validity scoring and recency decay, but the demonstration uses simulated events. Connecting to real intelligence sources would demonstrate the platform's utility for actual situational awareness while raising additional security and classification considerations.

Enhanced coalition simulation with actual partner participation would test governance mechanisms under realistic multi-stakeholder conditions. Working with partner organizations or allied nations to conduct joint demonstrations would reveal integration challenges and refinement opportunities that simulated coalition operations cannot surface.

Production security hardening would prepare BASTION for deployment in operational environments. This work includes formal security assessment, penetration testing, security accreditation processes, and hardening against the threat categories identified in Section 5.2. The demonstration system prioritizes functionality for validation; operational systems must prioritize security.

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

