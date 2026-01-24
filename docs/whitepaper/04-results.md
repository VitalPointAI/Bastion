# 4. Results

This section demonstrates how BASTION addresses the research question through an end-to-end operational scenario. The research question asked: *How can interconnected, AI-augmented Decentralized Autonomous Organizations (DAOs) provide a secure, transparent, and resilient governance framework that enables effective C2, accelerates decision-making, optimizes resource management, and supports autonomous, policy-compliant coordination across diverse national and organizational boundaries?*

The following results present BASTION's complete flow from strategic objective input through tactical execution, demonstrating that each component of the research question can be satisfied. The section then describes the physical demonstration that validates these concepts using tangible hardware, proving that the architecture functions not merely in simulation but in scenarios approaching real-world conditions.

## 4.1 End-to-End Strategic-to-Tactical Flow

BASTION's architecture enables seamless coordination across the three levels of warfare: strategic, operational, and tactical. Each level operates with a distinct governance structure, AI augmentation approach, and human authority position, yet all three integrate through shared blockchain infrastructure and cross-DAO communication mechanisms. This end-to-end flow demonstrates that decentralized governance can provide the transparency, accountability, and speed that coalition operations require.

The complete flow proceeds through three stages, each corresponding to a level of warfare and a distinct human authority position. At the strategic level, humans remain in-the-loop for all significant decisions. At the operational level, humans operate on-the-loop with override capability. At the tactical level, autonomous systems execute within policy bounds with humans out-of-the-loop for routine operations, though critical decisions such as strike authorization always return to human control. This graduated autonomy approach demonstrates that DAO governance can accommodate the full spectrum of human-machine teaming relationships described in Section 2.9.

### Stage 1: Strategic Objective Input (Human-in-the-Loop)

The strategic phase begins with document ingestion, where commanders upload strategic guidance documents such as National Security Strategy excerpts, theater campaign plans, or coalition directives. BASTION's document processing pipeline extracts text from PDF, DOCX, and other formats, segments the content into manageable chunks, and prepares it for AI analysis. This ingestion capability addresses the research question's requirement for coordination across organizational boundaries by accepting diverse document formats from various sources.

AI-assisted objective extraction transforms unstructured strategic guidance into structured objectives. Large language models analyze the ingested documents to identify stated and implied objectives, extracting key elements including the objective description, supporting rationale, priority indicators, and relevant constraints. The AI does not determine strategy; it accelerates the translation of human-authored strategic documents into machine-processable formats that downstream systems can act upon.

Human review and approval ensure that no AI-extracted objective proceeds without explicit commander authorization. The strategic planning dashboard presents extracted objectives alongside their source text, enabling reviewers to verify accuracy, correct errors, and add context that the AI may have missed. Reviewers can approve, reject, or modify each objective before it enters the governance workflow. This human-in-the-loop checkpoint directly addresses concerns about AI autonomy in military contexts by ensuring that strategic decisions remain firmly under human control (see Figure 2).

Once objectives are approved, they become candidates for resource allocation through DAO governance. The strategic-level DAO receives proposals that request resources for approved objectives. Coalition members vote according to their configured weights, which may reflect contribution levels, expertise areas, or agreed-upon influence distributions. Smart contracts enforce voting rules automatically, calculating approval status based on configured thresholds and ensuring that no single member can unilaterally approve significant allocations. This transparent voting mechanism addresses the research question's requirements for transparency and accountability in coalition coordination.

The strategic phase operates entirely in human-in-the-loop mode. Every objective extraction requires human verification. Every resource allocation requires coalition voting with human participants. AI agents provide analysis and recommendations but cannot approve strategic commitments autonomously. This approach ensures that strategic decisions reflecting national interests and coalition priorities remain under appropriate human authority.

### Stage 2: Operational Coordination (Human-on-the-Loop)

The operational level bridges strategic intent with tactical execution. AI agents operating within BASTION's LangGraph orchestration framework receive approved strategic objectives and transform them into actionable operational plans. These agents analyze objectives to identify required capabilities, assess available resources, evaluate risks, and generate mission orders that tactical units can execute.

Resource-to-mission mapping occurs through AI-assisted analysis. Agents examine the approved objective's requirements, query the resource registry for available assets, and propose allocations that satisfy objective requirements while respecting constraints. The DIMEFIL (Diplomatic, Information, Military, Economic, Financial, Intelligence, Law Enforcement) framework guides resource categorization, ensuring that operational planners consider the full spectrum of available instruments of national power rather than defaulting to purely military solutions.

Risk assessment provides decision support for commanders reviewing operational plans. AI agents evaluate proposed plans against historical data, doctrinal principles, and constraint policies to identify potential risks. Each risk is characterized by likelihood, impact, and potential mitigations. The 5x5 risk matrix familiar to military planners provides a common framework for comparing risks across different domains and plan options. Risks flagged as HIGH or requiring commander-level decision authority are highlighted for human attention.

Commander's intent formulation ensures that operational plans communicate not just what must be done but why, enabling subordinate judgment when circumstances change. BASTION's intent framework implements Klein's seven facets of effective intent communication: purpose, end state, constraints, freedoms, focus of effort, acceptable risk, and commander's assessment. AI agents draft intent statements based on the strategic objective and operational plan, but commanders review and approve the final intent before plans proceed to tactical execution.

The operational phase operates in human-on-the-loop mode. AI agents work continuously to analyze objectives, generate plans, and monitor execution. Commanders do not approve every agent action but maintain oversight through monitoring dashboards that show agent activity, decision rationale, and plan status. Human override controls enable commanders to halt agent actions, modify plans, or take direct control when circumstances warrant. This approach accelerates planning cycles by allowing routine coordination to proceed at AI speed while preserving human authority for significant decisions (see Figure 4).

### Stage 3: Tactical Execution (Human-out-of-the-Loop with Policy Bounds)

Tactical execution translates operational plans into physical effects. Mission orders generated at the operational level flow to tactical assets through BASTION's secure messaging infrastructure. Each mission order specifies objectives, constraints, authorized actions, and escalation criteria that define when autonomous execution must pause for human input.

Asset assignment matches mission requirements with available tactical resources. In the physical demonstration context, this includes the Sphero RVR+ mobile platform and its NVIDIA Jetson Orin Nano edge computing payload. The assignment considers asset capabilities, current positions, availability status, and constraint compatibility to identify optimal resource allocation for each mission element.

Autonomous target identification demonstrates AI capability at the tactical level. Edge AI models running on the Jetson Orin Nano process sensor data to detect, classify, and track objects of interest within the demonstration area of operations. Target identification operates autonomously within policy bounds that specify what target types are authorized, what confidence thresholds must be met, and what engagement restrictions apply. The AI does not determine target validity; it identifies candidates that meet technical detection criteria for subsequent human or policy-based authorization.

Effects delivery executes within authorized constraints. For demonstration purposes, effects represent physical movement to designated positions and symbolic engagement actions. Policy constraints encoded in smart contracts govern what effects are authorized for what target types under what conditions. Coalition caveats, if applicable, restrict effects based on contributing nation policies. The system verifies constraint compliance before executing effects, ensuring that autonomous actions remain within authorized bounds.

Critical exception: Strike authorization always requires human approval. Regardless of the configured autonomy level, any action designated as a strike or lethal effect triggers human-in-the-loop authorization. The tactical DAO cannot autonomously approve strike proposals; such proposals require explicit human voting with 100% approval threshold. This invariant ensures that lethal decisions remain under human control even when other tactical operations proceed autonomously. The system's architecture enforces this constraint at multiple levels: in the smart contract voting logic, in the AI agent decision trees, and in the tactical execution pipeline.

The tactical phase operates in human-out-of-the-loop mode for routine operations such as reconnaissance, navigation, and target identification. Humans establish the policies, define the constraints, and set the boundaries within which autonomous systems operate. Periodic human review occurs through battle damage assessment and mission status reporting, but individual tactical decisions proceed at machine speed without waiting for human approval. This approach enables the operational tempo that modern warfare demands while preserving human accountability through policy governance (see Figure 5).

## 4.2 Information Flow

Effective coordination requires information to flow not only from strategic to tactical levels but also from tactical back to strategic. BASTION implements bidirectional information flow through AI agents that monitor state changes and generate appropriate proposals or reports.

### Upward Flow: Tactical to Strategic

Battle damage assessment feeds the operational picture. As tactical assets execute missions and effects are delivered, AI agents monitor outcomes and compile assessment reports. These reports flow upward through the operational level, where they inform commander awareness, and to the strategic level, where they contribute to objective progress tracking. The blockchain records all assessments immutably, creating an auditable history of operational outcomes.

Resource expenditure triggers replenishment requests. A critical innovation in BASTION's architecture is the automatic detection of resource depletion and generation of replenishment proposals. AI agents monitoring the tactical DAO's resource state detect when expenditures reduce inventory below defined thresholds. Upon detection, the agent automatically generates a proposal to the strategic-level DAO requesting replenishment of specified resources. This cross-DAO communication demonstrates the "interlink" capability described in the MVP proposal, where tactical events drive strategic governance actions.

The replenishment workflow illustrates several research question components simultaneously. It demonstrates effective C2 through automatic escalation of tactical needs to strategic decision-makers. It accelerates decision-making by eliminating manual request generation and routing. It optimizes resource management by triggering replenishment based on actual consumption rather than estimated schedules. And it maintains policy compliance by routing requests through the coalition DAO's voting process, ensuring that resource commitments receive appropriate multi-stakeholder approval.

### Downward Flow: Strategic to Tactical

Strategic objectives cascade to operational design through structured decomposition. When the strategic DAO approves an objective with allocated resources, the operational layer receives notification and AI agents begin analysis. The objective's requirements, constraints, and intent flow downward as inputs to operational planning. This cascade preserves strategic intent while enabling operational creativity in execution approaches.

Operational plans generate tactical tasks through mission order decomposition. Complex missions may require multiple tactical actions coordinated in sequence or parallel. The operational plan specifies task relationships, timing constraints, and coordination requirements. Tactical units receive task assignments with full context including parent mission objectives, adjacent unit activities, and escalation contacts.

Policy constraints flow down and bind execution at every level. National caveats specified at the strategic level propagate through operational plans to tactical execution rules. A contributing nation's restriction on certain target types or geographic areas becomes an immutable constraint that tactical systems cannot override. Smart contract enforcement ensures that these policy constraints cannot be bypassed through configuration changes or operational workarounds. This downward flow of binding constraints directly addresses the research question's requirement for policy-compliant coordination across national boundaries (see Figure 3).

Coalition caveats receive special handling to ensure proper enforcement. When multiple nations contribute resources to a mission, the most restrictive applicable caveat governs employment. BASTION's caveat enforcement system tracks resource provenance, identifies applicable restrictions, and blocks actions that would violate any contributing nation's policies. This automatic enforcement eliminates the risk of inadvertent caveat violations while maintaining operational tempo.

## 4.3 Physical Demonstration

The research proposal specified a hybrid physical/virtual MVP demonstration to ground theoretical contributions in observable system behavior. This section describes the demonstration components, hardware platform, and scenario that validate BASTION's architecture through tangible execution.

### MVP Components

The demonstration implements the three key components specified in the research proposal, each addressing a distinct coordination challenge.

**Strategic-Level DAO (Resource Donations).** The first component simulates a coalition dealing with nation-level resource donations, modeled from contemporary international support scenarios. The strategic DAO manages proposals for materiel contributions, enabling coalition members to vote on resource allocations with weighted influence reflecting agreed-upon participation levels. This component demonstrates how DAOs can efficiently source, decide on, and track resource donations that satisfy operational requirements. The digital governance interface shows proposal submission, voting progress, and allocation outcomes with full transparency to all authorized participants.

**Tactical-Level DAO (Effects on Target).** The second component demonstrates tactical-level coordination and decision-making through a physical model of an Area of Operations. The tactical DAO coordinates autonomous target identification, resource selection, and effects delivery within the demonstration environment. This component validates that DAO governance can operate at tactical tempo, making decisions rapidly enough to support time-sensitive operations while maintaining policy compliance and audit trails.

**Operational Coordination (AI Agent Linking).** The third component demonstrates the critical interlink between tactical and strategic DAOs. As the tactical DAO's assets are expended during mission execution, an AI agent monitoring resource state automatically generates a proposal to the strategic-level DAO requesting replenishment. This cross-DAO communication validates that interconnected DAOs can coordinate across levels of warfare, with tactical events triggering strategic governance actions without requiring manual intervention. The operational coordination component bridges the other two, demonstrating seamless vertical integration.

### Hardware Platform

The physical demonstration employs embedded computing and robotic hardware to create a tangible representation of autonomous operations within DAO governance.

**NVIDIA Jetson Orin Nano Super.** The edge computing platform provides AI inference capability at the tactical level. Running optimized object detection models, the Jetson processes camera input to identify targets within the demonstration area. The platform's 67 TOPS of AI performance enables real-time inference without cloud connectivity, demonstrating the edge computing approach necessary for DDIL (Disconnected, Intermittent, Limited bandwidth) environments. The Jetson connects to BASTION's backend through secure API communication, receiving mission orders and reporting detection results.

**Sphero RVR+ Robotic Chassis.** The mobile platform provides physical movement capability for the demonstration. The RVR+ serves as a ground-based autonomous asset that can navigate the demonstration area, position for reconnaissance, and execute movement commands. Its programmable interface enables integration with the Jetson's AI-driven navigation decisions. The robot's physical presence transforms abstract governance decisions into observable actions, grounding the demonstration in tangible outcomes.

**Physical Area of Operations Model.** A tabletop terrain model provides the demonstration environment. The model includes simulated terrain features, designated target markers, and defined boundaries that represent an operational area. This physical AO enables observers to witness the complete cycle from strategic objective through tactical execution in a comprehensible scale. Target markers represent objects that the AI must identify, classify, and engage according to policy constraints.

### Demonstration Scenario

The demonstration scenario runs approximately 20 minutes and proceeds through four acts that showcase each human authority position and the cross-level coordination capability.

**Act 1: Strategic Resource Allocation (Human-in-the-Loop).** The demonstration begins with a coalition resource donation proposal. A coalition member submits a proposal to the strategic DAO offering reconnaissance assets for operational use. Other coalition members review the proposal details, including asset specifications, usage restrictions (caveats), and contribution duration. Members vote according to their configured weights. Upon reaching the approval threshold, the resources are allocated to the operational pool and become available for mission assignment. Throughout this act, human participants make every decision; AI agents provide information display and vote tallying but do not influence outcomes.

**Act 2: Operational Mission Planning (Human-on-the-Loop).** With resources available, the operational phase begins. An AI agent receives a strategic objective requiring reconnaissance of a designated area to identify specific target types. The agent analyzes the objective, queries available resources, and generates an operational plan that assigns the newly allocated reconnaissance asset to the mission. Risk assessment identifies potential hazards and constraints. The agent drafts commander's intent specifying purpose, acceptable risk, and engagement boundaries. A human commander reviews the generated plan on the monitoring dashboard, observes the agent's reasoning, and approves execution with or without modifications. The commander could override any element but in nominal operation allows the AI-generated plan to proceed. This demonstrates on-the-loop operation where humans monitor rather than direct each action.

**Act 3: Tactical Execution (Human-out-of-the-Loop with Policy Bounds).** The approved operational plan triggers tactical execution. Mission orders flow to the Jetson Orin Nano, which commands the Sphero RVR+ to begin reconnaissance of the physical AO. The robot navigates autonomously through the demonstration area while the Jetson's camera captures imagery. Edge AI models process the imagery in real-time, identifying objects that match target criteria. When a target is detected above the confidence threshold, the system logs the identification and positions the asset for potential engagement.

At this point, the demonstration highlights the critical exception for strike authorization. Although the tactical system operates autonomously for reconnaissance and target identification, any action designated as an engagement or strike requires human approval. The tactical DAO generates a strike authorization proposal that requires explicit human voting. Coalition members must approve the strike before effects can be delivered. This return to human-in-the-loop for lethal decisions demonstrates that graduated autonomy does not mean abandonment of human control for consequential actions.

Upon human approval, the tactical asset executes the authorized engagement within policy constraints. Effects delivery occurs within the bounds specified by coalition caveats and mission parameters. The demonstration shows observable physical action (robot movement to engagement position) tied to governance decisions recorded on the blockchain.

**Act 4: Cross-Level Coordination.** Following engagement, the AI monitoring agent detects that tactical asset expenditure has reduced available resources below the replenishment threshold. The agent automatically generates a proposal to the strategic-level DAO requesting additional resource allocation. This proposal appears to coalition members without manual intervention, demonstrating the interlink capability. Coalition members can vote on the replenishment request through the same governance interface used for initial allocation. Approval triggers resource transfer from strategic reserve to tactical availability.

This cross-level coordination demonstrates several research question components: effective C2 through automatic escalation, accelerated decision-making through AI-generated proposals, resource optimization through consumption-based triggering, and policy-compliant coordination through DAO voting on replenishment.

## 4.4 Thesis Validation

The demonstration results directly address the research question by providing evidence that each claimed capability functions as designed. This section maps demonstration outcomes to research question components.

### Research Question Answered

The research question asked: *How can interconnected, AI-augmented Decentralized Autonomous Organizations (DAOs) provide a secure, transparent, and resilient governance framework that enables effective C2, accelerates decision-making, optimizes resource management, and supports autonomous, policy-compliant coordination across diverse national and organizational boundaries?*

The demonstration validates each element of this question through observable outcomes.

**Secure.** Policy constraints encoded in smart contracts govern all execution decisions. National caveats restrict asset employment based on contributor policies. The tactical system verifies constraint compliance before executing effects. Strike authorization requires explicit human approval with 100% voting threshold. Security is enforced through code, not procedure, eliminating the possibility of inadvertent policy violations.

**Transparent.** Every decision in the demonstration is recorded on the blockchain with full audit trail. Coalition members can verify proposal content, voting records, and execution outcomes independently. No central authority controls the record; all participants have equal access to governance history. The monitoring dashboards display agent reasoning, enabling observers to understand why AI systems made specific recommendations.

**Resilient.** The decentralized architecture eliminates single points of failure. DAO governance does not depend on any single member's participation; the system continues to function as long as quorum requirements are met. Edge computing on the Jetson enables tactical operations without continuous connectivity to central systems. The blockchain maintains state even if individual nodes fail.

**Effective C2.** The complete flow from strategic objective through tactical execution demonstrates command and control across echelons. Strategic intent cascades to operational plans to tactical tasks. Upward reporting from tactical to strategic completes the C2 cycle. The cross-DAO replenishment request shows that the C2 structure adapts to operational developments without requiring manual reconfiguration.

**Accelerated Decision-Making.** AI augmentation at each level accelerates coordination. Objective extraction converts documents to structured data in minutes rather than hours. Operational planning agents generate plans continuously. Tactical AI identifies targets in real-time. The replenishment proposal is generated automatically upon threshold detection. Human decision-makers focus on judgment calls rather than administrative coordination.

**Optimized Resource Management.** Resource tracking through the DAO registry provides visibility into asset availability, allocation, and consumption. Replenishment triggers when inventory reaches defined thresholds rather than on arbitrary schedules. Coalition members can verify resource status at any time through the transparent governance interface. The demonstration shows resources flowing from strategic allocation through tactical employment to replenishment request without manual tracking overhead.

**Policy-Compliant Coordination.** Coalition caveats specified at contribution time bind all subsequent employment decisions. Smart contracts enforce restrictions automatically. The tactical system cannot execute effects that violate contributor policies. Strike authorization requires coalition voting regardless of autonomy configuration. Policy compliance is verified computationally before execution, not audited after the fact.

**Coordination Across Boundaries.** The coalition DAO includes members from multiple notional nations with different weights, caveats, and interests. Governance decisions require multi-party agreement according to configured thresholds. The cross-DAO communication demonstrates coordination across the strategic-tactical boundary. The demonstration could scale to additional DAOs representing additional organizational boundaries without architectural changes.

### Human Authority Preservation

The demonstration validates that graduated autonomy preserves appropriate human control throughout the operational spectrum.

**Three Authority Positions Demonstrated.** Strategic operations proceed with humans in-the-loop for every decision. Operational coordination allows AI agents to work continuously while humans monitor on-the-loop with override capability. Tactical execution operates autonomously within policy bounds with humans out-of-the-loop for routine functions. All three positions appear within a single integrated scenario, demonstrating that one architecture can support the full range of human-machine relationships.

**Strike Authorization Always Human-Approved.** The critical invariant for lethal decisions is demonstrated explicitly. Despite tactical operations proceeding autonomously, the strike authorization proposal requires human voting with 100% approval. No autonomous execution path bypasses this requirement. The demonstration shows the system pausing tactical operations to obtain human authorization before engagement effects.

**Trust Calibration Through Graduated Autonomy.** The demonstration shows how autonomy levels can be adjusted based on task characteristics. High-consequence strategic decisions require human approval for each action. Moderate-risk operational coordination allows AI speed with human oversight. Low-risk routine tactical functions proceed autonomously within bounds. This calibration demonstrates that trust in AI systems can be earned and expressed through configurable autonomy levels without all-or-nothing choices.

**Accountability Maintained Through Audit Trail.** Every governance decision records the proposal content, voting member identities, vote timestamps, and outcome. Every AI agent action logs reasoning and decision basis. Every tactical execution records policy verification and constraint compliance. The blockchain provides an immutable audit trail that supports after-action review, accountability determination, and continuous improvement.

Figure 6 shows the physical demonstration setup with the Jetson Orin Nano, Sphero RVR+, and physical AO model integrated with the BASTION governance interface.
