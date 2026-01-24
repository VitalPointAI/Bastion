# 2.8 AI Applications in Military Operations

Artificial intelligence has become increasingly central to military operations, offering capabilities that can enhance decision-making, improve situational awareness, and enable new operational concepts. Understanding current AI applications in defense provides essential context for BASTION's approach to AI-augmented governance. This section builds upon the military coordination challenges described in Sections 2.5-2.7, examining how AI can address those challenges while introducing its own governance requirements.

## Current AI Uses

Military organizations worldwide are investing heavily in AI capabilities across multiple domains of application [CITATION NEEDED].

**Sensor Fusion and Intelligence Analysis.** One of the most mature applications of AI in defense involves processing and analyzing data from multiple sensors to create coherent intelligence products. Modern military operations generate enormous volumes of data from satellites, reconnaissance aircraft, unmanned systems, signals intelligence, and human sources. AI systems help analysts process this data, identify patterns, correlate information across sources, and generate actionable intelligence. Machine learning algorithms can detect objects of interest in imagery, identify patterns in signals, and flag anomalies for human review [CITATION NEEDED].

**Decision Support Systems.** AI-powered decision support systems assist military commanders and their staffs in understanding complex operational environments and evaluating courses of action. These systems can model potential outcomes, identify risks, and present options for human decision-makers. Decision support AI does not replace human judgment but rather augments it by processing more information than humans could review manually and presenting that information in actionable formats [CITATION NEEDED].

**Autonomous and Semi-Autonomous Systems.** Unmanned Aerial Vehicles (UAVs), Unmanned Ground Vehicles (UGVs), and other robotic systems increasingly incorporate AI for navigation, object recognition, and mission execution. These systems range from fully human-controlled (where AI assists with stability and navigation) to highly autonomous (where AI makes real-time decisions within programmed constraints). The degree of autonomy varies based on the mission, the operational environment, and policy constraints [CITATION NEEDED].

**Resource Optimization and Logistics.** AI applications in military logistics help optimize supply chains, predict maintenance requirements, and allocate resources efficiently. Machine learning models can forecast demand for supplies, identify optimal routing for logistics convoys, and predict when equipment will require maintenance before failures occur. These applications improve efficiency and readiness while reducing costs [CITATION NEEDED].

**Cyber Operations.** Both offensive and defensive cyber operations increasingly rely on AI. Defensive AI systems monitor networks for anomalies, detect intrusion attempts, and respond to threats faster than human operators could react. AI also supports offensive cyber operations by identifying vulnerabilities and optimizing attack vectors [CITATION NEEDED].

## AI Governance Challenges

The integration of AI into military operations raises significant governance challenges that must be addressed to ensure responsible and effective use.

**Trust and Reliability.** Military commanders must trust the systems they rely on for critical decisions. AI systems, however, can produce unexpected outputs, fail in ways that are difficult to predict, and be vulnerable to adversarial manipulation. Building justified trust in AI systems requires extensive testing, validation, and operational experience [CITATION NEEDED].

**Explainability Requirements.** Military decision-makers need to understand why AI systems make specific recommendations or take particular actions. "Black box" AI systems that produce outputs without explainable reasoning are problematic in military contexts where commanders must justify their decisions and maintain accountability. The field of Explainable AI (XAI) aims to address this challenge, but practical solutions remain limited for complex AI systems [CITATION NEEDED].

**Accountability for AI-Influenced Decisions.** When AI systems contribute to military decisions, questions arise about accountability. If an AI-influenced decision leads to unintended consequences, determining responsibility requires understanding the role the AI played and whether human decision-makers appropriately evaluated its recommendations. Current military doctrine generally holds humans responsible for decisions, but the increasing speed and complexity of AI-augmented operations complicates this principle [CITATION NEEDED].

**Ethical Considerations.** The use of AI in military operations, particularly in lethal decision-making, raises profound ethical questions. International discussions continue regarding the appropriate role of AI in targeting decisions and the degree of human control required for lethal autonomous weapons systems. These debates inform policy constraints that shape how AI can be employed [CITATION NEEDED].

# 2.9 Human-Machine Teaming

The concept of human-machine teaming describes how humans and AI systems work together to accomplish tasks that neither could achieve as effectively alone. In military contexts, human-machine teaming aims to combine human judgment, creativity, and ethical reasoning with AI's speed, consistency, and data processing capabilities.

## Authority Positions

A critical framework for understanding human-machine teaming involves the concept of human authority positions. These positions describe the relationship between human decision-makers and AI systems in terms of control and oversight. Three primary authority positions are commonly recognized [CITATION NEEDED].

**Human-in-the-Loop (HITL).** In the human-in-the-loop model, a human must approve each AI action before it executes. The AI system may analyze information, identify options, and make recommendations, but no action occurs without explicit human authorization. This approach provides maximum human control and is appropriate for high-consequence decisions where errors could have severe or irreversible effects.

The human-in-the-loop approach ensures that human judgment is applied to every decision point. It allows commanders to maintain direct control and intervene based on factors that the AI may not fully understand or weigh appropriately. However, this approach limits operational tempo because the speed of action is constrained by human decision-making speed. For time-critical situations, the delays inherent in human-in-the-loop operation may be unacceptable.

**Human-on-the-Loop (HOTL).** In the human-on-the-loop model, AI systems act autonomously within defined parameters while humans monitor operations and retain the ability to intervene. The human observer can override AI actions, halt operations, or adjust parameters as needed. This approach balances control with speed, allowing faster action while maintaining human oversight.

Human-on-the-loop operation enables AI systems to respond to situations at machine speed while ensuring that humans can intervene when AI behavior is inappropriate or when circumstances change. The effectiveness of this approach depends on humans maintaining sufficient situational awareness to recognize when intervention is needed and having the ability to intervene in time. This model is appropriate for moderate-consequence decisions where speed is important but errors can be corrected.

**Human-out-of-the-Loop (HOOTL).** In the human-out-of-the-loop model, AI systems operate fully autonomously within policy constraints, without real-time human involvement in individual decisions. Humans establish the policies, constraints, and objectives that guide AI behavior, but do not supervise or approve individual actions.

This approach enables maximum speed and is appropriate only for well-constrained, low-risk tasks where the consequences of errors are acceptable and the operational environment is well-understood. Human-out-of-the-loop operation is controversial for military applications, particularly for lethal operations, and most nations maintain policies requiring some degree of human control over weapons employment [CITATION NEEDED].

## Trust and Autonomy Calibration

Effective human-machine teaming requires calibrating the appropriate level of autonomy for each situation. This calibration considers multiple factors.

**Trust Earned Through Performance.** Trust in AI systems should be based on demonstrated performance in relevant conditions. Systems that have proven reliable in testing and operational experience warrant greater trust than novel or untested systems. Trust should be calibrated to actual performance rather than assumed capabilities [CITATION NEEDED].

**Graduated Autonomy.** The appropriate level of autonomy may vary based on mission phase, operational conditions, and specific tasks. A single system might operate with different authority positions at different times, with more autonomy for routine tasks and greater human involvement for critical decisions. This graduated approach allows flexibility while maintaining appropriate control [CITATION NEEDED]. This concept directly addresses the operational gap described in Section 2.6, where the speed of tactical decisions may require different authority positions than strategic resource allocation.

**Consequence Assessment.** Higher-consequence decisions warrant more human involvement. The potential impact of errors or unexpected outcomes should inform the degree of human control required. Lethal decisions, in particular, typically require human-in-the-loop or at minimum human-on-the-loop operation [CITATION NEEDED].

**Mission-Specific and Agent-Specific Levels.** Different AI agents within a system may warrant different levels of autonomy based on their capabilities, track record, and the sensitivity of their tasks. Similarly, different missions may require adjusting autonomy levels based on the operational environment and acceptable risk.

# 2.10 Gap: AI Governance Frameworks

Despite significant progress in AI applications for defense, a critical gap remains in frameworks for governing AI-augmented multi-stakeholder decision-making.

## Missing Integration

**No Decentralized AI Governance.** Current approaches to AI in defense focus primarily on single-organization implementations. Governance frameworks address how one nation or organization manages its AI systems, but do not provide mechanisms for coordinating AI-augmented decisions across organizational boundaries. Coalition operations involving multiple nations with their own AI systems lack frameworks for integrating these systems under coherent governance [CITATION NEEDED].

**No Multi-Stakeholder AI Authority Framework.** When multiple stakeholders (nations, organizations, or individuals) must coordinate AI-influenced decisions, existing frameworks do not define how authority should be allocated, how disagreements should be resolved, or how accountability should be assigned. Each stakeholder maintains its own AI governance approach, but no overarching framework coordinates these approaches [CITATION NEEDED].

**Coalition AI Coordination Not Addressed.** The challenges of coalition coordination described in Section 2.6 are compounded when AI systems are involved. Information sharing caveats, release authority requirements, and different national policies all affect how AI systems can be integrated across coalition boundaries. Current approaches do not address these AI-specific coalition challenges [CITATION NEEDED].

**Policy Compliance Not Automated.** AI systems must operate within policy constraints, but current approaches rely on programming these constraints directly into individual systems. There is no mechanism for encoding policies in a way that allows verification of compliance, enables automatic enforcement across systems, or provides transparency to stakeholders about what constraints are in effect [CITATION NEEDED].

## Research Opportunity

The identified gaps create a research opportunity at the intersection of decentralized governance and AI agent systems.

**DAO Governance for AI Coordination.** Decentralized Autonomous Organizations provide governance mechanisms that could address multi-stakeholder AI coordination. Smart contracts can encode policies that constrain AI behavior, voting mechanisms can resolve disagreements, and blockchain provides transparency and auditability for AI-influenced decisions [CITATION NEEDED].

**Smart Contract Enforcement of Autonomy Constraints.** Rather than programming autonomy constraints directly into AI systems, these constraints can be encoded in smart contracts that govern AI agent behavior. This approach enables transparent, verifiable, and uniform enforcement of policies across multiple AI systems and organizational boundaries.

**BASTION's Novel Contribution.** BASTION addresses the identified gap by integrating DAO governance with AI agent systems. The platform provides mechanisms for multi-stakeholder coordination, encodes policies in smart contracts, and maintains appropriate human authority positions for different decision types. This integration enables coalition coordination with AI augmentation while maintaining the transparency, accountability, and human control that military operations require.

---

The background sections have established the technological, organizational, and doctrinal context for BASTION. The following methodology section describes how BASTION integrates these elements into a coherent architecture that addresses the identified gaps.

## Gap Analysis Summary

The following table summarizes the gaps identified in existing approaches and how BASTION addresses each:

| Approach | Strength | Gap | BASTION Solution |
|----------|----------|-----|------------------|
| JADC2 | Sensor connectivity across domains | No decentralized governance framework | DAO-based multi-stakeholder coordination |
| NATO FMN | Federation standards for information sharing | Centralized trust model | Blockchain immutability and transparency |
| Military AI | Decision support and autonomous systems | No policy compliance framework for coalitions | Smart contract encoded constraints |
| Commercial DAOs | Decentralized governance mechanisms | Not designed for C2 tempo or lethal decisions | AI agent augmentation with human authority positions |

*See Section 3 (Methodology) for how BASTION implements these solutions.*
*See Section 4 (Results) for demonstration of AI governance in action.*
