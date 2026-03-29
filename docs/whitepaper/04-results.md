# 4. Results

This section presents BASTION's capabilities through the lens of an end-to-end operational demonstration. The research question asked: *Can AI-augmented Decentralized Autonomous Organizations (DAOs) provide a scalable, auditable, and institutionally legitimate framework for human control over autonomous systems in multi-domain coalition military operations?*

Rather than reporting experimental measurements from controlled trials, this section describes implemented capabilities validated through functional testing and a physical demonstration scenario. BASTION is a working prototype, not a fielded system; the results reported here reflect what the architecture can do, verified through implementation, integration testing, and demonstration execution. Where capabilities remain partially implemented or have known limitations, this section notes them explicitly.

## 4.1 End-to-End Strategic-to-Tactical Flow

BASTION's architecture enables coordination across three levels of warfare: strategic, operational, and tactical. Each level operates with a distinct governance structure, AI augmentation approach, and human authority position, yet all three integrate through shared blockchain infrastructure and cross-DAO communication. The demonstration scenario exercises a complete flow through all three levels, validating that decentralized governance can provide the transparency, accountability, and coordination tempo that coalition operations require.

The flow proceeds through three stages corresponding to graduated human authority positions. At the strategic level, humans remain in-the-loop for all decisions. At the operational level, humans operate on-the-loop with override capability. At the tactical level, autonomous systems execute within policy bounds with humans out-of-the-loop for routine operations, though critical decisions such as strike authorization always return to human control.

### Stage 1: Strategic Objective Input (Human-in-the-Loop)

The strategic phase begins with document ingestion, where commanders upload strategic guidance documents such as national security strategy excerpts, theater campaign plans, or coalition directives. BASTION's document processing pipeline extracts text from PDF, DOCX, and other formats, segments the content into manageable chunks, and prepares it for AI analysis.

AI-assisted objective extraction transforms unstructured strategic guidance into structured objectives. Large language models analyze the ingested documents to identify stated and implied objectives, extracting key elements including the objective description, supporting rationale, priority indicators, and relevant constraints. The AI does not determine strategy; it accelerates the translation of human-authored strategic documents into machine-processable formats that downstream systems can act upon.

Human review and approval ensure that no AI-extracted objective proceeds without explicit commander authorization. The strategic planning dashboard presents extracted objectives alongside their source text, enabling reviewers to verify accuracy, correct errors, and add context that the AI may have missed. Reviewers can approve, reject, or modify each objective before it enters the governance workflow. This human-in-the-loop checkpoint addresses concerns about AI autonomy in military contexts by ensuring that strategic decisions remain under human control (see Figure 2).

Once objectives are approved, they become candidates for resource allocation through DAO governance. The strategic-level DAO receives proposals that request resources for approved objectives. Coalition members vote according to their configured weights, which reflect contribution levels, expertise areas, or agreed-upon influence distributions. Smart contracts enforce voting rules automatically, calculating approval status based on configured thresholds and ensuring that no single member can unilaterally approve significant allocations.

The strategic phase operates entirely in human-in-the-loop mode. Every objective extraction requires human verification. Every resource allocation requires coalition voting with human participants. AI agents provide analysis and recommendations but cannot approve strategic commitments autonomously.

### Stage 2: Operational Coordination (Human-on-the-Loop)

The operational level bridges strategic intent with tactical execution. AI agents operating within BASTION's LangGraph orchestration framework receive approved strategic objectives and transform them into actionable operational plans. These agents analyze objectives to identify required capabilities, assess available resources, evaluate risks, and generate mission orders that tactical units can execute.

Resource-to-mission mapping occurs through AI-assisted analysis. Agents examine the approved objective's requirements, query the resource registry for available assets, and propose allocations that satisfy objective requirements while respecting constraints. The DIMEFIL (Diplomatic, Information, Military, Economic, Financial, Intelligence, Law Enforcement) framework guides resource categorization, ensuring that operational planners consider the full spectrum of available instruments of national power rather than defaulting to purely military solutions.

Risk assessment provides decision support for commanders reviewing operational plans. AI agents evaluate proposed plans against doctrinal principles and constraint policies to identify potential risks. Each risk is characterized by likelihood, impact, and potential mitigations. Risks flagged as HIGH or requiring commander-level decision authority are highlighted for human attention.

Commander's intent formulation ensures that operational plans communicate not just what must be done but why, enabling subordinate judgment when circumstances change. BASTION's intent framework addresses purpose, end state, constraints, freedoms, focus of effort, acceptable risk, and commander's assessment. AI agents draft intent statements based on the strategic objective and operational plan, but commanders review and approve the final intent before plans proceed to tactical execution.

The operational phase operates in human-on-the-loop mode. AI agents work continuously to analyze objectives, generate plans, and monitor execution. Commanders do not approve every agent action but maintain oversight through monitoring dashboards that show agent activity, decision rationale, and plan status. Human override controls enable commanders to halt agent actions, modify plans, or take direct control when circumstances warrant. This approach accelerates planning cycles by allowing routine coordination to proceed at AI speed while preserving human authority for significant decisions (see Figure 4).

### Stage 3: Tactical Execution (Human-out-of-the-Loop with Policy Bounds)

Tactical execution translates operational plans into physical effects. Mission orders generated at the operational level flow to tactical assets through BASTION's bridge infrastructure. Each mission order specifies objectives, constraints, authorized actions, and escalation criteria that define when autonomous execution must pause for human input.

Asset assignment matches mission requirements with available tactical resources. In the physical demonstration, this includes three Sphero RVR+ mobile platforms operating as a coordinated tactical element: alpha (the swarm leader, carrying an NVIDIA Jetson Orin Nano edge computing payload with camera), and bravo and charlie (followers connected via BLE relay through the leader). The assignment considers asset capabilities, current positions, availability status, and constraint compatibility.

Autonomous target identification demonstrates AI capability at the tactical level. The Jetson Orin Nano runs YOLOv8 object detection models that process camera input to detect, classify, and track objects of interest within the area of operations. Target identification operates autonomously within policy bounds that specify what target types are authorized, what confidence thresholds must be met, and what engagement restrictions apply. The AI identifies candidates that meet technical detection criteria for subsequent human or policy-based authorization.

Effects delivery executes within authorized constraints. Policy constraints encoded in smart contracts govern what effects are authorized for what target types under what conditions. Coalition caveats restrict effects based on contributing nation policies. The system verifies constraint compliance before executing effects, ensuring that autonomous actions remain within authorized bounds.

Critical exception: Strike authorization always requires human approval. Regardless of the configured autonomy level, any action designated as a strike or lethal effect triggers human-in-the-loop authorization. The tactical DAO cannot autonomously approve strike proposals; such proposals require explicit human voting with 100% approval threshold. This invariant is enforced at multiple levels: in the smart contract voting logic, in the mission sequence orchestrator's governance gate, and in the tactical execution pipeline. The system physically halts robot operations and waits for coalition-unanimous human authorization before any engagement effect proceeds (see Figure 5).

## 4.2 Information Flow

Effective coordination requires information to flow not only from strategic to tactical levels but also from tactical back to strategic. BASTION implements bidirectional information flow through AI agents that monitor state changes and generate appropriate proposals or reports.

### Upward Flow: Tactical to Strategic

Battle damage assessment feeds the operational picture. As tactical assets execute missions and deliver effects, AI agents monitor outcomes and compile assessment reports. These reports flow upward through the operational level, where they inform commander awareness, and to the strategic level, where they contribute to objective progress tracking. The blockchain records all assessments immutably, creating an auditable history of operational outcomes.

Resource expenditure triggers replenishment requests. When AI agents monitoring the tactical DAO's resource state detect that expenditures reduce inventory below defined thresholds, the agent automatically generates a proposal to the strategic-level DAO requesting replenishment. This cross-DAO communication demonstrates the "interlink" capability where tactical events drive strategic governance actions without requiring manual intervention.

### Downward Flow: Strategic to Tactical

Strategic objectives cascade to operational design through structured decomposition. When the strategic DAO approves an objective with allocated resources, the operational layer receives notification and AI agents begin analysis. The objective's requirements, constraints, and intent flow downward as inputs to operational planning.

Operational plans generate tactical tasks through mission order decomposition. The operational plan specifies task relationships, timing constraints, and coordination requirements. Tactical units receive task assignments with full context including parent mission objectives, adjacent unit activities, and escalation contacts.

Policy constraints flow down and bind execution at every level. National caveats specified at the strategic level propagate through operational plans to tactical execution rules. A contributing nation's restriction on certain target types or geographic areas becomes an immutable constraint that tactical systems cannot override. Smart contract enforcement ensures that these policy constraints cannot be bypassed through configuration changes or operational workarounds (see Figure 3).

Coalition caveats receive special handling to ensure proper enforcement. When multiple nations contribute resources to a mission, the most restrictive applicable caveat governs employment. BASTION's caveat enforcement system tracks resource provenance, identifies applicable restrictions, and blocks actions that would violate any contributing nation's policies.

## 4.3 Governance Results

The MDMP governance integration introduced in Phase 5.1 and refined through Phase 53 provides measurable governance enforcement within the operational flow. This section reports on the governance mechanisms exercised during demonstration and testing: the safety matrix validation gates, the assumption registry, the DAO proposal lifecycle, and the five-tier authority model.

### Safety Matrix Validation at MDMP Gates

The MDMP governance framework enforces 18 discrete validation gates across the nine planning phases. At each gate, the safety matrix evaluates proposed actions against immutable constraints before allowing a transaction to proceed on-chain. Three activity categories (AUTHORITY_DECISION, ETHICAL_LEGAL, and RISK_JUDGMENT) are locked permanently to HUMAN_ONLY authority. The smart contract rejects any transaction that attempts to delegate these categories to AI agents, regardless of the configuration settings of the calling user or process.

In validation testing against the Pacific Strategy AY26 exercise scenario, the safety matrix correctly blocked all attempted authority boundary violations: test inputs that tried to pass COA approval or strike authorization through AI_AUTONOMOUS or AI_PRIMARY tiers were rejected at the contract layer before reaching any human review step. This outcome validates that BASTION's human authority invariants are enforced through code, not through training or procedure alone.

### Assumption Registry

The formal assumption lifecycle (Pending, Accepted, Invalidated) with automatic replanning triggers was exercised during the Pacific Strategy AY26 scenario. As the action-reaction-counteraction cycle produced adversary responses that contradicted accepted assumptions, the assumption monitor agent detected the invalidation condition and surfaced alerts to the planning staff. The system triggered replanning for affected plan elements without manual tracking, confirming that the assumption registry transforms informal staff tracking into technically enforced accountability.

### DAO Proposal Lifecycle: Creation, Voting, and Execution

The full DAO proposal lifecycle was exercised at multiple decision gates throughout the demonstration. MDMP workflow agents automatically generated proposals at COA selection, order release, and resource allocation decision points. Coalition members received notification through the governance dashboard, reviewed proposal content including attached supporting analysis, and voted within configured deliberation windows.

The demonstration scenario exercises proposals through the complete lifecycle: draft, open voting, approval, and execution. The governance structure is not a rubber-stamp mechanism; coalition members with minority weight positions can exercise veto-equivalent influence on proposals that require supermajority thresholds, forcing negotiated modifications before re-submission. This validates that the DAO governance model functions as a substantive coordination structure where weighted representation influences outcomes.[^res13]

[^res13]: Pinto, Pinto, and Santos, "Decentralized Autonomous Organizations: A Systematic Literature Review," *Applied Sciences* 15, no. 2 (2025): 500, https://doi.org/10.3390/app15020500.

### Five-Tier Authority Model in Practice

The five-tier authority model (AI_AUTONOMOUS, AI_PRIMARY, AI_SUPPORTED, HUMAN_PRIMARY, HUMAN_ONLY) is mapped across 65 planning activities and exercised during the Pacific Strategy AY26 exercise. Data aggregation, document formatting, and map layer generation proceed at AI_AUTONOMOUS tier without human review, consistent with their low-consequence classification. Risk acceptance, COA recommendation selection, and order release require HUMAN_PRIMARY engagement, with AI agents providing structured options and supporting analysis for human decision.

The 65-activity governance model converts the traditional MDMP bottleneck (staff time preparing analysis) into the appropriate bottleneck: human judgment on consequential decisions. Activities delegated to AI_AUTONOMOUS and AI_PRIMARY tiers complete in seconds; HUMAN_PRIMARY activities wait for human review and decision on the commander's timeline.[^res14]

[^res14]: Joint Chiefs of Staff, *Joint Planning*, Joint Publication 5-0 (Washington, DC: Joint Chiefs of Staff, December 1, 2020), Chapter V, https://www.jcs.mil/Portals/36/Documents/Doctrine/pubs/jp5_0.pdf.

### Decision Dashboard RACI Filtering and Inline Approval Workflow

The Decide tab's decision dashboard (Phase 53) provides the unified human decision interface for the governance architecture. The RACI matrix filtering system surfaces pending decisions according to each staff officer's role, reducing cognitive load by restricting visible decisions to those within the viewer's authority. The inline approve/reject/defer/information-request workflow enables staff to act on governance proposals without navigating away from their work context.

Ironclaw's 60-second polling cycle for pending decisions ensures that time-sensitive governance items surface to the chief-of-staff within one polling interval, enabling proactive staffing of urgent decisions before they block operational progress.

## 4.4 Physical Demonstration

The research proposal specified a hybrid physical/virtual MVP demonstration to ground theoretical contributions in observable system behavior. This section describes the demonstration components, hardware platform, and the "Iron Bastion" tactical scenario that validates BASTION's architecture through tangible execution.

### MVP Components

The demonstration implements three key components, each addressing a distinct coordination challenge.

**Strategic-Level DAO (Resource Allocation).** The first component demonstrates coalition resource allocation through decentralized governance. The strategic DAO manages proposals for materiel contributions, enabling coalition members (USA, GBR, CAN) to vote on resource allocations with weighted influence reflecting agreed-upon participation levels. The digital governance interface shows proposal submission, voting progress, and allocation outcomes with full transparency to all authorized participants. All votes record on NEAR blockchain (testnet), producing transaction hashes that any coalition partner can independently verify.

**Tactical-Level DAO (Autonomous Engagement with Human Authority Gate).** The second component demonstrates tactical-level coordination through a physical multi-robot mission in an open area of operations. Three Sphero RVR+ platforms execute an autonomous reconnaissance-to-engagement sequence, with the critical constraint that lethal effects require unanimous coalition voting before execution. This component validates that DAO governance can operate at tactical tempo while maintaining policy compliance and audit trails. The physical robots ground abstract governance decisions in observable actions: viewers watch the swarm halt at the authority gate, wait for human authorization, and proceed only after coalition approval.

**Operational Coordination (Cross-DAO Interlink).** The third component demonstrates the interlink between tactical and strategic DAOs. As tactical assets are expended during mission execution, an AI agent monitoring resource state automatically generates a proposal to the strategic-level DAO requesting replenishment. This cross-DAO communication validates that interconnected DAOs can coordinate across levels of warfare, with tactical events triggering strategic governance actions without requiring manual intervention.

### Hardware Platform

The physical demonstration employs embedded computing and robotic hardware to create a tangible representation of autonomous operations within DAO governance.

**NVIDIA Jetson Orin Nano Super.** The edge computing platform provides AI inference capability at the tactical level. Running YOLOv8 object detection models via the Ultralytics framework, the Jetson processes camera input to identify targets within the area of operations. The platform's 67 TOPS of AI performance enables real-time inference without cloud connectivity, demonstrating the edge computing approach necessary for DDIL (Disconnected, Intermittent, Limited bandwidth) environments. The Jetson connects to BASTION's backend through the robot bridge WebSocket infrastructure, receiving mission orders and reporting detection results.

**Sphero RVR+ Robotic Platforms (3x).** Three mobile platforms provide physical movement and formation capability. Alpha serves as the swarm leader, carrying the Jetson and camera payload. Bravo and charlie operate as followers, receiving movement commands from alpha via BLE relay through the leader's coordinator. The three-platform configuration enables doctrinal formation maneuvers (wedge advance, echelon movements) that demonstrate coordinated multi-robot behavior governed by DAO-driven mission orders. Each robot holds a blockchain-anchored DID (`did:near:resource-{id}`) that governs its employment authorization.

**Drone Overwatch Platform (if available).** An aerial platform provides elevated reconnaissance capability, feeding enemy position data to the ground element through the swarm coordinator's heterogeneous fleet support. The drone's sensor feed supplements alpha's ground-level vision, demonstrating multi-domain sensor fusion within the same governance framework. This component is included when hardware availability permits; the demonstration functions with ground platforms alone.

**Open Area of Operations.** The demonstration environment is an open room providing unobstructed fields of view for the camera and clear movement space for formation maneuvers. The calibration system maps room-space coordinates (meters) to geographic coordinates on the COP map, so robot movements in the physical space appear as unit movements on the operational map display. This open terrain reflects the demonstration's focus on formation movement and coordinated engagement rather than urban navigation.

### Iron Bastion Scenario

The "Iron Bastion" scenario is a multi-phase tactical mission sequence that exercises all three human authority positions and the cross-level coordination capability. The mission sequence orchestrator choreographs eight phases of autonomous robot behavior with governance gates at critical decision points.

**Phase 1: HOLD.** All three platforms begin at the home base position. The swarm coordinator confirms BLE connectivity with followers bravo and charlie. The mission sequence orchestrator publishes the initial state to the frontend, where the COP map displays three friendly unit symbols at the staging area.

**Phase 2: RECON.** Alpha deploys forward to conduct area reconnaissance using a boustrophedon sweep pattern across the designated AO. Bravo and charlie hold at the home base in overwatch. Alpha's Jetson processes camera frames through YOLOv8, looking for objects matching threat criteria. This phase operates autonomously — no human approval is required for reconnaissance navigation or target detection.

**Phase 3: CONTACT.** Alpha's vision pipeline detects enemy armor (target markers representing hostile vehicles). Detection results include class label, confidence score, and bounding box coordinates. The detection is reported to the BASTION backend, which updates the adversary layer on the COP. If the drone overwatch platform is active, its feed provides corroborating position data. The contact triggers an automatic phase transition.

**Phase 4: OVERWATCH.** Alpha moves to a designated overwatch position providing observation of the detected threat while maintaining standoff distance. The swarm coordinator computes the overwatch geometry relative to threat and friendly positions.

**Phase 5: ADVANCE.** Bravo and charlie advance from the home base toward firing positions using a wedge formation. The formation geometry is computed by the swarm coordinator and propagated via BLE, with each follower driving to its assigned slot relative to the leader's position. The advance demonstrates coordinated multi-robot movement under autonomous control.

**Phase 6: SET.** Followers reach their designated positions and report ready. The mission sequence panel on the frontend shows all three platforms in position with readiness status.

**Phase 7: AUTHORIZE — Governance Gate.** This is the critical phase. The mission sequence orchestrator creates a lethal force authorization gate through BASTION's gate service. The system halts all robot operations and generates a strike authorization proposal in the tactical DAO. The proposal requires 100% coalition approval — every coalition member must vote "approve" before engagement can proceed. The frontend displays the proposal with prominent "REQUIRES HUMAN APPROVAL" indicators. No configuration setting, operational urgency, or chain of command can bypass this requirement. The robots physically wait, stationary, until human authorization is granted.

**Phase 8: ENGAGE.** Upon unanimous coalition approval, the authorized engagement executes. Followers deliver simulated effects (LED flash and audio indicators). The engagement is recorded on the blockchain with the full chain of approvals: who identified the target, who authorized engagement, when, and under what constraints. The mission sequence transitions to BDA (battle damage assessment) and withdrawal phases.

The scenario runs approximately five minutes for the tactical phase alone, preceded by the strategic and operational acts that establish the mission context.

### Robot Bridge Architecture

The robot bridge (Phase 43) validates a key architectural choice: using a Docker-containerized Python agent with mDNS auto-discovery to bridge cloud governance infrastructure with physical edge hardware. The bridge architecture consists of three components operating concurrently:

- **Cloud uplink** maintains a persistent WebSocket connection to the BASTION backend, receiving mission assignments and relaying robot telemetry.
- **Local relay server** provides a WebSocket endpoint for robot connections on the local network, routing commands from cloud to robots and telemetry from robots to cloud.
- **Device scanner** performs dual-mode discovery (mDNS and SSDP) to locate robots on the local network without manual configuration.

The bridge includes a command queue with TTL-based expiry for offline robots, enabling mission assignment even when a robot temporarily loses connectivity. The cloud uplink reconnects with exponential backoff, providing resilience against transient network interruptions. The Docker deployment model confirms that the bridge runs on commodity hardware without requiring network topology changes.

Nine mission types are implemented and validated: patrol route, area reconnaissance (boustrophedon sweep), find-and-engage (with governance gate), visual search (ORB feature matching against reference image), overwatch (hold and monitor), resupply route, and three swarm variants (swarm patrol, swarm reconnaissance, swarm advance). Each mission validates its parameters against an autonomy policy that specifies permitted autonomous actions, restricted actions, maximum speed, and whether lethal effects are permitted.

### Vision Pipeline

The vision pipeline (Phase 44) provides end-to-end object detection on the Jetson Orin Nano. The pipeline architecture:

- **Primary detection** uses YOLOv8 nano variant at 320x320 inference resolution with a configurable confidence threshold (default 0.5). The model classifies detected objects and reports bounding box coordinates, class label, and confidence score.
- **Post-processing** rejects false positives where the detected bounding box exceeds 40% of the frame (indicating the model classified the entire scene rather than a discrete object). Obstacle detection triggers avoidance maneuvers when a detected object occupies more than 25% of the frame width and is centered.
- **Keyframe encoding** annotates camera frames with bounding boxes and transmits JPEG-encoded keyframes over WebSocket for frontend display.
- **Feature matching** using ORB (Oriented FAST and Rotated BRIEF) descriptors provides secondary verification for visual search missions, confirming that a detected object matches a reference image.

The vision loop operates at 500ms cadence (configurable), processing frames and reporting detections to the BASTION backend. Detection results flow through the backend to the COP, where they appear as adversary symbols on the operational map. A mock vision engine provides predictable detection behavior for testing and demonstration rehearsal without physical hardware.[^res16]

[^res16]: The ORB feature descriptor and matching methodology is described in Ethan Rublee, Vincent Rabaud, Kurt Konolige, and Gary Bradski, "ORB: An Efficient Alternative to SIFT or SURF," in *Proceedings of the 2011 IEEE International Conference on Computer Vision* (Barcelona: IEEE, 2011), 2564-2571, https://doi.org/10.1109/ICCV.2011.6126544. The YOLOv8 model architecture is documented in Glenn Jocher, Ayush Chaurasia, and Jing Qiu, "Ultralytics YOLOv8," Ultralytics, 2023, https://github.com/ultralytics/ultralytics.

### Swarm Coordination

The swarm coordination architecture (Phase 46) enables multi-robot formation movement governed by DAO-driven mission orders. The swarm coordinator runs on the leader platform (alpha) and manages formation geometry, movement commands, and member state for all connected platforms.

**Formation types.** Six doctrinal formations are implemented: line, wedge, column, echelon left, echelon right, and vee. Each formation computes slot offsets relative to the leader's position and heading, so followers maintain their geometric relationship as the leader moves. The Iron Bastion scenario exercises wedge formation for the advance phase and transitions between formations as the tactical situation develops.

**Movement techniques.** Four movement techniques govern how the swarm traverses terrain: traveling (all elements move simultaneously), traveling overwatch (lead element moves while trail maintains observation), bounding overwatch (alternating bounds with mutual support), and successive bounds (each element advances to the predecessor's position). The technique selection reflects tactical conditions — bounding overwatch when threat contact is expected, traveling when speed is prioritized.

**Communication.** The swarm communicates through two channels: BLE relay from leader to followers for motor commands and formation updates, and UDP peer mesh (port 5807) for low-latency heartbeat and state sharing. The BLE relay architecture means followers receive commands through the leader rather than requiring independent network connectivity, enabling formation maintenance during brief interruptions of the BASTION API connection. This local communication pattern provides resilience against cloud connectivity loss for swarm-internal coordination.

**DAO integration.** The swarm accepts governance directives from BASTION: `swarm:add_resource` and `swarm:remove_resource` modify swarm membership based on DAO proposals, and `swarm:reconfigure` changes formation, spacing, and movement technique. Dynamic membership changes trigger automatic formation recomputation so remaining members adjust their positions without manual intervention.

**Heterogeneous fleet support.** The swarm member model supports multiple resource types (ground vehicle, drone, UGV, sensor, relay), enabling mixed-platform formations where aerial and ground assets coordinate within the same swarm structure. The Iron Bastion demonstration exercises ground platforms; drone integration extends the same coordinator architecture to aerial overwatch when hardware is available.[^res17]

[^res17]: For foundational work on decentralized multi-robot coordination and peer mesh communication patterns, see Lynne E. Parker, "Multiple Mobile Robot Systems," in *Springer Handbook of Robotics*, ed. Bruno Siciliano and Oussama Khatib (Berlin: Springer, 2016), 1335-1384, https://doi.org/10.1007/978-3-319-32552-1_53.

### Resource DID Verification

The resource DID architecture (`did:near:resource-{id}`) ensures that each physical robot platform holds a blockchain-anchored identity that governs its employment. Resource registration occurs through the DAO-governed onboarding flow: the swarm leader's agent submits a registration proposal to the tactical DAO, which coalition members approve before the resource becomes available for mission assignment.

Resource identity verification is exercised when assignment requests reference a resource whose on-chain record indicates NMC (not mission capable) status. The system rejects the assignment before the order reaches the robot bridge, confirming that resource state enforcement occurs at the governance layer rather than at the physical interface layer.

### Demonstration Scenario

The full demonstration runs approximately 20 minutes and proceeds through four acts that showcase each human authority position and the cross-level coordination capability.

**Act 1: Strategic Resource Allocation (Human-in-the-Loop, ~5 minutes).** The demonstration begins with the coalition governance workflow. In the Understand tab, the Pacific Strategy AY26 scenario training package is loaded, and AI agents categorize documents, extract objectives, and populate the RAFT knowledge graph with actors, relationships, and strategic tensions. A human reviewer verifies AI-extracted objectives against source text, approving or modifying before they enter governance. A resource allocation proposal is submitted to the strategic DAO. Coalition members (USA, GBR, CAN) vote according to configured weights, with votes recording on NEAR blockchain (testnet). Upon reaching the approval threshold, resources are allocated. Throughout this act, human participants make every decision; AI agents provide analysis but do not influence outcomes.

**Act 2: Operational Mission Planning (Human-on-the-Loop, ~4 minutes).** With resources allocated and operational design complete (problem framing, center of gravity analysis, lines of effort, and operational approach visible in the Design tab), the demonstration transitions to detailed planning. AI agents receive the strategic objective and generate an operational plan assigning the three-platform reconnaissance element to survey the area of operations. The Plan tab displays active agents, LangGraph execution traces, and agent coordination through the message bus. A risk assessment surfaces hazards for commander review. The commander reviews the generated plan, explicitly acknowledges identified risks (recorded on blockchain), and authorizes mission execution. The commander could override any element but in nominal operation allows the AI-generated plan to proceed.

**Act 3: Tactical Execution — Iron Bastion (Human-out-of-the-Loop with Governance Gate, ~5 minutes).** The approved plan triggers the Iron Bastion mission sequence. Alpha begins autonomous reconnaissance of the open AO while the Jetson's YOLOv8 model processes live camera imagery. Bravo and charlie hold at the staging area. The COP map tracks robot positions in real-time through the calibration system that maps room coordinates to geographic positions.

When alpha detects a target above confidence threshold, the contact triggers the tactical phase transition: alpha takes an overwatch position while bravo and charlie advance in wedge formation toward engagement positions. The formation movement is visible both physically (robots moving in coordinated geometry) and digitally (unit symbols advancing on the COP map).

At the governance gate, the demonstration reaches its critical moment. The system halts all robot operations and generates a strike authorization proposal requiring 100% coalition approval. The robots physically stop and wait. Coalition members vote through the governance interface. Only after unanimous approval do the platforms execute the authorized engagement (simulated through LED and audio indicators). This return to human-in-the-loop for lethal decisions demonstrates that graduated autonomy does not mean abandonment of human control for consequential actions.

**Act 4: Cross-Level Coordination (~2 minutes).** Following engagement, the AI monitoring agent detects that tactical asset expenditure has reduced available resources below the replenishment threshold. The agent automatically generates a proposal to the strategic-level DAO requesting additional resource allocation. This proposal appears to coalition members without manual intervention. Coalition members vote on the replenishment request through the same governance interface. The complete cycle — strategic allocation, operational planning, tactical execution, strategic replenishment — demonstrates seamless vertical coordination through interconnected DAOs.

## 4.5 Demonstration Data Package

BASTION's demonstration capability depends not only on working software but on realistic, pre-seeded operational data that allows audiences to observe the full doctrinal workflow without a lengthy setup period. Phase 39 delivered the Pacific Strategy AY26 operational demonstration data package: a comprehensive, reusable seed dataset derived from the Indo-Pacific contingency planning exercise scenario.

### Pacific Strategy AY26 Scenario Coverage

The demonstration data package covers all six phases of the Pacific Strategy AY26 scenario: Competition, Crisis, Conflict Day 4, Conflict Day 10, Conflict Day 22, and Negotiation. Each phase represents a distinct operational context with corresponding intelligence updates, force disposition changes, and planning product adjustments. The seed script loads a three-echelon problem set hierarchy (strategic, operational, tactical) with 13 command units bearing MIL-STD-2525D SIDC codes, 17 actors in the RAFT knowledge graph with 27 relationships and 8 strategic tensions, 29 OSINT events distributed across scenario phases, and 10 ingested documents spanning strategy, orders, and intelligence assessments.

Scenario realism draws on publicly available information about Indo-Pacific security dynamics, force structure, and operational concepts.[^res18]

[^res18]: U.S. Department of Defense, *Indo-Pacific Strategy Report: Preparedness, Partnerships, and Promoting a Networked Region* (Washington, DC: Department of Defense, June 2019), https://media.defense.gov/2019/Jul/01/2002152311/-1/-1/1/DEPARTMENT-OF-DEFENSE-INDO-PACIFIC-STRATEGY-REPORT-2019.PDF. See also Center for Strategic and International Studies, "Asia-Pacific Rebalance 2025: Capabilities, Presence, and Partnerships" (Washington, DC: CSIS, January 2016), https://www.csis.org/analysis/asia-pacific-rebalance-2025.

### Doctrinal Tabs Populated with Exercise Content

All six doctrinal tabs arrive pre-populated when the demonstration data package is loaded through the seed script. The Understand tab contains the exercise scenario training package with AI-inferred document tags and a RAFT knowledge graph populated with actors, relationships, and strategic tensions. The Design tab contains a completed operational design with problem framing, center of gravity analysis for both friendly and adversary forces, defined lines of effort, and a phased operational approach. The Plan tab contains two JPP instances with seven-step planning workflows, mission analysis products, and COA packages.

The Decide tab contains the pending decision queue with staged governance proposals and 10 decision gates (8 approved with full vote records and blockchain metadata, 2 pending commander decision). The COP tab contains force disposition layers with friendly and adversary unit symbols rendered using MIL-STD-2525D SIDC codes. The Assess tab contains after-action reviews with lesson observations and METL proficiency ratings.

### Reusable Demo Infrastructure

The data package is designed for rapid reset between demonstration iterations. The master seed script (`scripts/seed-demo.sh --reset`) loads the full exercise dataset in four sequential levels (foundation, data layer, workflows, cross-cutting), returning BASTION to a known starting state. This repeatability is essential for academic demonstrations where multiple audience groups may observe the same capability sequence, and for training contexts where instructors need to reset between exercise runs.

## 4.6 Extended Capability Results

Beyond the core demonstration, BASTION's implementation validates several additional capabilities that strengthen the research contribution. These results reflect capabilities completed through March 2026 across 60 completed development phases.

### Doctrinal Workflow Validation

The six-tab doctrinal lifecycle (Understand, Design, Plan, Decide, COP, Assess) was validated through the Pacific Strategy AY26 exercise scenario. The exercise demonstrated a complete planning cycle using the JP 5-0-aligned tab structure.

Staff officers began in the Understand tab by uploading the exercise scenario training package. AI-driven tag inference automatically categorized documents by type, team assignment, and exercise phase. The RAFT graph populated with actors, relationships, and tensions extracted from the uploaded intelligence. Operators then moved to the Design tab where the problem framing canvas identified key tensions in the strategic environment. Center of gravity analysis using Strange's framework identified adversary critical vulnerabilities. Lines of effort were defined with explicit linkages to strategic objectives. The operational approach builder synthesized these elements into a phased approach that exported directly into the Plan tab's mission analysis.

This end-to-end flow through the doctrinal tabs validated that the interface structure reinforces rather than impedes the joint planning process.

### Operational Design Results

The Design tab's operational design workspace validated that AI assistance can accelerate the traditionally time-intensive operational design process without substituting machine judgment for commander creativity. The problem framing canvas with AI-identified tensions provided starting points that commanders refined rather than adopted wholesale. Center of gravity analysis for both friendly and adversary forces produced structured outputs that directly informed course of action development. The design-to-plan handoff eliminated the manual translation of design outputs into planning inputs that conventionally requires staff effort and introduces interpretation errors.

### COP Layer Agent Team Results

The autonomous COP layer generation validated that AI agents can produce operationally relevant MIL-STD-2525D overlays from planning documents without manual symbol placement. Agent teams extracted geographic references, unit identities, and temporal phasing from uploaded orders and intelligence to generate multi-layer COP overlays. The publish review cycle ensured that human reviewers approved all AI-generated layers before they appeared on the shared COP. The friendly/adversary perspective toggle produced separate COP views supporting dual-perspective analysis.

### Resource Registry Results

The resource DID architecture validated that military assets can be managed as blockchain-verified entities with extensible type definitions. The plugin architecture demonstrated that new resource types can be added (autonomous vehicle, sensor, weapon, comms, logistics) without modifying core platform code. COP integration showed resources rendering as standard military symbols alongside AI-generated layers, providing a unified operational picture. Real-time readiness tracking with FMC/PMC/NMC status provides commanders immediate visibility into force capability without manual status reporting.

### Chief of Staff Coordination to Visual Approach Pipeline

The Phase 55-56 capability additions validated an end-to-end pipeline from Ironclaw's Chief of Staff design coordination through visual operational approach representation. Ironclaw's operational design coordination obtained and validated commander intent across all four doctrinal sections (problem framing, center of gravity analysis, lines of effort, and operational approach) using JP 5-0 coverage criteria as completeness thresholds. Upon section confirmation, derived design objects were persisted and fed directly into the visual operational approach editor.

The visual editor populated a candidate MapOverlay from coordination-derived design elements, placing MIL-STD-2525D unit symbols and control measures corresponding to the confirmed operational approach onto the operational map layer. The coordination-to-visual pipeline demonstrated that commander intent obtained through Ironclaw's structured staff coordination could be translated to military symbology without requiring manual symbol placement.

Knowledge graph gap detection operated in parallel with the coordination: design inputs triggered background research requests through the document intelligence pipeline when referenced entities were absent from the brain graph, demonstrating automatic gap detection integrated with the design workflow.

### Ironclaw Persistent Memory Results

The Ironclaw persistent memory architecture (Phase 57) validated that session-persistent AI advisory context can be maintained across interactions with appropriate privacy controls. The dual-scope memory system (user-scoped and context-scoped) stores preferences and operational context independently, with auth-scoped isolation preventing cross-user memory contamination in multi-participant problem sets.

The IronclawMemoryPanel provides visible memory management: stored memories can be reviewed in human-readable format and individually deleted. The REST API (three authenticated endpoints) integrates with the existing auth middleware, extending BASTION's auth-scoped data isolation pattern to the memory domain without requiring new authentication infrastructure. Memory persistence across sessions was validated: observations recorded in one session are retrievable in subsequent sessions within the TTL bounds.

### On-Chain Resource Caveat Enforcement Results

The on-chain DID caveat system (Phase 58) validated that employment restrictions encoded in the NEAR smart contract are automatically enforced before assignment actions reach the resource management layer. The `ResourceCaveats` struct encodes five caveat dimensions (classification, releasability, ROE tier, geographic bounds, and time windows), deployed to `did.bastion.testnet` and verified through smoke tests.

The `check_employment_authorized()` view method correctly blocks employment for resources where the requesting nation is not in the releasability set, where the proposed employment time falls outside the authorized time window, and where the proposed geographic position is outside the authorized bounds. Enforcement occurs at the smart contract level without requiring application-layer review, demonstrating that coalition caveat compliance can be verified computationally rather than through manual review.

### Training Mode Results

The training/operational mode toggle validated the "train as you fight" capability. Exercises conducted in training mode use identical DAO governance (same voting thresholds, same authority models, same safety matrix enforcement) as operational mode. The persistent amber EXERCISE banner and automatic document watermarking prevent exercise/operational confusion. Reset and checkpoint capabilities enable exercise iteration, and after-action review capture provides structured debriefing data.

### Known Limitations

The following limitations apply to the current implementation and are acknowledged for transparency:

- **Testnet only.** All blockchain operations use NEAR testnet (`did.bastion.testnet`). No mainnet deployment has been performed. Coalition partners would need testnet access to independently verify transactions.
- **Single-user testing.** Multi-user concurrent planning has not been stress-tested. CRDT infrastructure (Yjs) exists for collaborative editing, but concurrent multi-staff-officer usage under load has not been validated.
- **DDIL resilience is architectural, not validated under extended conditions.** The robot bridge caches mission state locally and the edge AI operates without cloud connectivity, but extended disconnection scenarios (minutes to hours) with reconnection reconciliation have not been systematically tested.
- **Confidence scoring.** OSINT confidence is currently hardcoded at 0.65 for all source types. Source-tier-aware scoring (adjusting confidence based on source reliability) is designed but not yet implemented.
- **No security audit.** Smart contracts and API endpoints have not undergone formal security audit or penetration testing.
- **No formal verification.** DAO governance invariants are validated through testing, not mathematically proven.

### Updated Implementation Metrics

| Metric | Previous (Jan 2026) | Current (Mar 2026) |
|--------|---------------------|---------------------|
| Completed phases | 15 | 60 |
| Total phases | 24 | 75 |
| Completed plans | 117 | 469+ |
| AI agents (LangGraph analysis) | 23 | 8 |
| AI agents (COP layer) | — | 7 |
| AI agents (Chief of Staff) | — | 1 (Ironclaw) |
| AI agents (MDMP governance) | — | 6 (Assumption Auditor, Orders Validator, Uncertainty Quantifier, Data Bias Detector, Problem Framing, ROE Compliance) |
| AI agents (Escalation/Competition) | — | 3 (Adversary Modeler, Escalation Modeler, Effect Cascader) |
| AI agents (total specialized, deployed) | 23 | 25 |
| Smart contract modules | 5 | 14 |
| REST API endpoints | ~100 | ~572+ |
| Doctrinal tabs | 4 (functional) | 6 (doctrinal lifecycle) |
| Resource types (plugins) | — | 5 |
| Robot bridge architecture | None | Docker + Python agent, mDNS/SSDP discovery |
| Vision pipeline | None | YOLOv8 + ORB on Jetson Orin Nano |
| Swarm capability | None | 3-platform coalition, 6 formations, 4 movement techniques, BLE relay |
| Tactical mission types | None | 9 (patrol, recon, find-engage, visual search, overwatch, resupply, 3 swarm) |
| Operational design coordination | None | LangGraph JP 5-0 Chief of Staff coordination, 4 sections |
| Visual approach editor | None | MapOverlay with MIL-STD-2525D symbols + control measures |
| Ironclaw memory | None | Dual-scope persistent memory, REST API, management panel |
| On-chain resource caveats | None | ResourceCaveats contract on did.bastion.testnet |

## 4.7 Thesis Validation

The demonstration and extended capability results address the research question by providing evidence that each claimed capability functions as implemented. This section maps outcomes to research question components.

### Research Question Answered

The research question asked: *Can AI-augmented Decentralized Autonomous Organizations (DAOs) provide a scalable, auditable, and institutionally legitimate framework for human control over autonomous systems in multi-domain coalition military operations?*

The demonstration and implementation validate each of the three requirements embedded in the question.

**Scalable.** The architecture scales along three dimensions. Vertically, the three-echelon problem set hierarchy (strategic, operational, tactical) demonstrates that governance structures can nest without architectural changes. Horizontally, coalition membership is configurable — adding a new nation requires a DAO membership update, not a code change. Functionally, the plugin-based resource registry, extensible agent framework, and heterogeneous swarm member model accommodate new asset types and planning functions without modifying core infrastructure.

**Auditable.** Every governance decision records on the blockchain with full provenance: proposal content, voting member identities, vote timestamps, and outcomes. Every AI agent action logs reasoning and decision basis through LangGraph execution traces. Every tactical execution records policy verification and constraint compliance. The blockchain provides an immutable audit trail that supports after-action review and accountability determination. Coalition partners can independently verify any governance action through the blockchain record.

**Institutionally Legitimate.** The six-tab doctrinal lifecycle mirrors JP 5-0 rather than imposing arbitrary software categories. The MDMP governance gates enforce doctrinal decision points through smart contracts. The five-tier authority model maps to established human-machine teaming concepts. The safety matrix permanently locks three activity categories to HUMAN_ONLY authority. Strike authorization requires 100% coalition approval regardless of autonomy configuration. These design decisions ensure that the governance framework aligns with existing institutional structures rather than requiring organizations to adapt to the technology.

### Human Authority Preservation

The demonstration validates that graduated autonomy preserves appropriate human control throughout the operational spectrum.

**Five-Tier Authority Model Demonstrated.** The echelon-based authority model operates across the full demonstration scenario: coalition consensus governs strategic resource allocation, organizational authority gates autonomous engagement, and individual/team authority bounds routine tactical execution. The MDMP interaction model operates in parallel: AI-autonomous agents handle data aggregation and COP generation while human-only authority governs strike authorization, ethical judgments, and risk acceptance.

**Strike Authorization Always Human-Approved.** The critical invariant for lethal decisions is demonstrated explicitly in the Iron Bastion scenario. Despite tactical operations proceeding autonomously through reconnaissance, contact, overwatch, and advance, the engagement effect requires unanimous human voting. No autonomous execution path bypasses this requirement. The demonstration shows the system physically halting robot operations to obtain human authorization before engagement.

**Trust Calibration Through Graduated Autonomy.** The demonstration shows how autonomy levels adjust based on task characteristics. Strategic decisions require human approval for each action. Operational coordination allows AI speed with human oversight. Routine tactical functions proceed autonomously within bounds. This calibration demonstrates that trust in AI systems can be expressed through configurable autonomy levels without all-or-nothing choices.

**Accountability Maintained Through Audit Trail.** Every governance decision, AI agent action, and tactical execution produces a permanent record. The blockchain audit trail, combined with agent execution traces and mission sequence logs, provides complete accountability from strategic objective through tactical effect.

Figure 6 shows the physical demonstration setup with the three Sphero RVR+ platforms, Jetson Orin Nano, and BASTION governance interface integrated through the robot bridge architecture.
