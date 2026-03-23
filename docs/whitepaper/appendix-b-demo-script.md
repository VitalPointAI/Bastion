# Appendix B: Demonstration Script (~20 minutes)

> **See also:** `docs/briefing/demo-script-30min.md` for the expanded 30-minute version with full doctrinal tab walkthrough, robot vision, swarm telemetry, and Decide tab governance demonstration.

This appendix provides a detailed demonstration script for the BASTION platform, designed for a ~20 minute presentation that showcases all three human authority positions (in-the-loop, on-the-loop, out-of-the-loop) and the cross-level coordination that connects strategic objectives to tactical execution.

**Narrative Approach:** This script weaves technical demonstration with problem-focused narrative. At key moments, "injects" highlight specific problems BASTION solves versus conventional C2 architecture. The goal is not just to show *what* the system does, but *why* it matters.

## B.1 Setup Requirements

### Physical Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| NVIDIA Jetson Orin Nano Super | Edge AI computing platform | 67 TOPS AI performance, runs object detection |
| Sphero RVR+ with camera mount | Mobile autonomous platform | Programmable robot for tactical execution |
| Physical AO model | Demonstration area of operations | Tabletop terrain with target markers |
| Display/projector | BASTION UI presentation | Shows governance interface, agent activity |
| Network connectivity | System communication | Jetson-to-backend, browser access |

### System State

Before demonstration begins, verify:

- [ ] BASTION platform running (docker-compose up)
- [ ] Training mode activated (amber EXERCISE banner visible)
- [ ] Scenario data seeded: `bash scripts/seed-scenario.sh` (seeds graph, mission, plan, COAs, command structure, resources, MDMP workflow)
- [ ] Mock governance data enabled: `VITE_USE_MOCK_DATA=true` in frontend/.env.local (provides coalition DAO with USA/GBR/CAN and scenario-aligned proposals)
- [ ] Pacific Strategy AY26 scenario training package available for upload
- [ ] AI agents initialized and healthy
- [ ] Sphero RVR+ powered and connected
- [ ] Jetson Orin Nano running edge AI models
- [ ] Camera feed visible in monitoring interface

### Pre-Demo Checklist

```
[ ] Backend services healthy (check /api/health endpoints)
[ ] Neo4j graph database connected
[ ] Scenario seed script run successfully (bash scripts/seed-scenario.sh)
[ ] NEAR testnet accessible
[ ] LLM provider API keys valid
[ ] Phala TEE attestation current
[ ] All three coalition member accounts ready
[ ] Strike authorization proposal pre-staged (not submitted)
```

---

## B.2 Act 1: Strategic Level (5 minutes)

### Human Authority Position: IN-THE-LOOP

All decisions at the strategic level require explicit human approval. AI assists with analysis and presentation but cannot approve strategic commitments.

---

**[0:00-1:30] Introduction and Problem Framing**

*Narrator speaks while showing BASTION in training mode with amber EXERCISE banner*

> "Welcome to the BASTION demonstration. Notice the amber EXERCISE banner across the top — we're in training mode, which uses identical governance to operational mode. This is 'train as you fight' — every vote, every approval gate, every safety constraint works exactly as it would in operations."

*Pause for emphasis*

> "In conventional coalition operations, a strategic directive might take days to translate into tactical action. Why? The document must be manually analyzed by staff officers. Extracted objectives must be coordinated through national channels. Each partner must staff recommendations through their own approval chains. By the time everyone agrees, the operational window may have closed."

> "BASTION solves this through AI-augmented decentralized autonomous organizations. Over the next twenty minutes, you'll see strategic intent flow through a doctrine-aligned workflow — Understand, Design, Plan, Decide, COP, Assess — mirroring JP 5-0 rather than imposing arbitrary software categories. You'll see 131 AI agents accelerate coordination while preserving human authority."

*Action:* Display the six doctrinal tabs with the Understand tab active

*Show:*
- Six tabs: Understand / Design / Plan / Decide / COP / Assess
- Coalition partners (USA, GBR, CAN) with voting weights
- Training mode banner and EXERCISE watermark
- Agent status panel showing healthy agents

> "Notice the tab structure follows military doctrine, not software convention. Each tab corresponds to a phase of the joint planning process. And notice the coalition partners — in a conventional system, each nation would maintain separate planning tools. BASTION provides a shared operational picture while respecting national authorities."

---

**[1:30-2:30] Document Ingestion via Understand Tab**

*Narrator explains the Understand tab and document processing*

> "We begin in the Understand tab — the doctrinal starting point. Strategic planning starts with understanding the operational environment. In conventional operations, this step is a bottleneck. Staff officers manually review documents, extract relevant objectives, and summarize them for commanders. This process can take hours or days."

*Action:* Upload Pacific Strategy AY26 scenario training package via ScenarioPackageUpload in the Understand tab

> "We're uploading a scenario training package — multiple documents at once. Watch the AI categorize them automatically."

*Show:*
- Multi-file drag-drop upload in Understand tab
- AI tag inference categorizing documents by type, team, and exercise phase
- Async LLM extraction processing with status indicators
- RAFT graph populating with actors and relationships from uploaded intelligence

*System Response:*
- AI extracts objectives and entities automatically
- Documents categorized (intelligence, orders, estimates)
- RAFT graph shows actor relationships and tensions

> "In seconds, the AI has categorized documents, extracted strategic objectives, and built a knowledge graph of actors and relationships. A task that might consume an entire staff section's morning."

**[INJECT - SPEED vs. CONVENTIONAL C2]**

> "But here's the critical point: in a conventional system, you'd now wait for staffing. Each extracted objective would need to be validated through national channels, reconciled with partner interpretations, and formally coordinated. BASTION doesn't eliminate that coordination, it accelerates it through structured governance."

---

**[2:30-4:00] Human Review and DAO Governance**

*Narrator emphasizes human-in-the-loop*

> "Every extracted objective requires human review before entering governance. The AI accelerates analysis, but humans make decisions. This is non-negotiable."

*Action:*
- Click on first extracted objective
- Show ObjectiveDetail view with tabs
- Review AI-extracted content

*Show:*
- Source text highlighted alongside extraction
- DIME/MIDLIFE categorization
- Risk assessment with confidence scores

*Action:* Edit one objective slightly to demonstrate human modification

> "The reviewer can accept the AI's extraction, modify it, or reject it entirely. Let's approve this reconnaissance objective with a clarification."

*Action:* Click "Approve" button

**[INJECT - TRANSPARENCY vs. CONVENTIONAL C2]**

> "In a conventional system, this approval happens in an email chain or a meeting that no one records. Who approved what? When? Based on what information? Those questions often can't be answered months later when something goes wrong."

*Gesture to screen*

> "Every action in BASTION is recorded on an immutable blockchain. This approval, right now, is permanently logged with the reviewer's identity, timestamp, and the exact state of the objective they approved. Full accountability, forever."

---

**[4:00-5:00] Coalition Voting**

*Narrator explains coalition governance*

> "Approved objectives become proposals to the Strategic DAO. Coalition members vote according to configured weights."

*Action:* Submit resource allocation proposal to Strategic DAO

*Show:*
- Proposal details (objective, requested resources, justification)
- Coalition members visible with voting weights
- Voting interface

*Action:*
- USA representative votes "Approve"
- GBR representative votes "Approve"
- CAN representative votes "Approve"

*Show:*
- Votes recording on blockchain (transaction hash visible)
- Quorum reached notification
- Proposal status changes to "Approved"

**[INJECT - TRUST and VERIFICATION vs. CONVENTIONAL C2]**

> "This vote just recorded on NEAR blockchain. Every coalition partner can independently verify that the vote happened, that it met quorum requirements, and that resources were allocated as agreed."

> "In conventional coalition operations, partners must trust that coordinating nations honor commitments. Did the resources we were promised actually get allocated? Is our equipment being used as we intended? These questions erode coalition trust. Blockchain eliminates them through cryptographic verification."

---

## B.2.5 Operational Design (2 minutes)

### Bridging Strategic Understanding to Operational Planning

---

**[5:00-5:45] Design Tab — Problem Framing and CoG Analysis**

*Narrator transitions to the Design tab*

> "Now we move to the Design tab — operational design. This is where commanders translate understanding into an approach. In conventional operations, this is often the weakest link: strategic guidance gets handed to planners who jump straight to courses of action without systematic problem framing."

*Action:* Navigate to Design tab, show problem framing canvas

*Show:*
- Problem framing canvas with AI-identified tensions
- Center of gravity analysis using Strange's CG-CC-CR-CV framework
- Lines of effort with linkages to strategic objectives

> "The AI has identified key tensions in the strategic environment and suggested initial framings. The commander refines these — the AI provides starting points, not answers."

*Action:* Show CoG analysis for adversary forces

> "Center of gravity analysis follows Strange's framework: Critical Capabilities, Requirements, and Vulnerabilities. This structured analysis feeds directly into course of action development."

**[5:45-6:15] Design-to-Plan Handoff**

*Action:* Click "Export to Plan" button

> "Watch this handoff — operational design outputs flow directly into the Plan tab's mission analysis. No manual translation, no interpretation errors between the design team and the planning staff."

*Show:*
- Design outputs appearing as Plan tab inputs
- Objectives, CoG analysis, and LOEs populated in mission analysis

**[INJECT - OPERATIONAL DESIGN GAP]**

> "In conventional staffs, the gap between operational design and detailed planning is where intent gets lost. BASTION eliminates that gap through structured data handoff."

---

## B.3 Act 2: Operational Level (4 minutes)

### Human Authority Position: ON-THE-LOOP

AI agents operate continuously while humans monitor with override capability. Humans do not approve every action but can intervene at any point.

---

**[6:15-7:30] AI Agent Activation**

*Narrator transitions to operational coordination*

> "With strategic resources allocated and operational design complete, we move to detailed planning. This is where conventional C2 struggles most. The gap between strategic intent and tactical execution is where coalitions historically lose coherence."

*Action:* Navigate to Plan tab, show Agent Orchestration Panel

*Show:*
- Active agents list with status indicators
- LangGraph execution visualization
- Agent communication in message bus

> "Multiple AI agents are now active. The Operational Planning Agent translates strategic objectives into executable plans. The Risk Assessment Agent identifies hazards. The Resource Mapping Agent matches available assets to requirements."

**[INJECT - SILOED DECISION-MAKING vs. CONVENTIONAL C2]**

> "In a conventional staff, these functions happen in separate cells that may not communicate effectively. The operations cell develops plans without full visibility into intelligence assessments. The logistics cell allocates resources without understanding tactical priorities. BASTION's agents share information in real-time through a secure message bus, eliminating the silos that fragment conventional planning."

*System:*
- Agents begin processing
- Reasoning traces appear in execution panel
- Recommendations generate in real-time

---

**[6:30-8:00] Human Monitoring with Override Capability**

*Narrator emphasizes on-the-loop authority*

> "At the operational level, the human commander is ON-THE-LOOP. Agents work at machine speed, but the commander monitors everything and can override instantly."

*Action:* Point to monitoring dashboard

*Show:*
- Operational coordination view
- Agent activity log scrolling
- Plan generation progress

> "Watch the commander's view. Every agent action is visible. The commander sees what agents recommend and why."

*Action:* Hover over "Override" button (but don't click)

> "This override button immediately halts agent operations and returns full control to the human. The commander chooses not to use it because agents are operating within expected parameters."

**[INJECT - DECISION TEMPO vs. CONVENTIONAL C2]**

> "Conventional C2 operates at human speed. Every coordination step waits for humans to process information, make decisions, and communicate. BASTION preserves human authority while enabling machine-speed coordination for routine tasks."

> "The commander isn't approving every agent recommendation. That would eliminate the speed advantage. Instead, the commander maintains oversight with the ability to intervene when needed. Human judgment where it matters, AI speed everywhere else."

*System:*
- Agents complete plan generation
- Mission plan summary appears
- Risk acknowledgment prompt appears

---

**[8:00-10:00] Mission Authorization and Risk Acknowledgment**

*Narrator explains transition to tactical level*

> "The AI agents have generated an operational plan assigning our reconnaissance asset to survey the demonstration area and identify targets matching specified criteria."

*Show:*
- Completed operational plan summary
- Task assignment to Sphero/Jetson platform
- Mission constraints and boundaries

*Action:* Commander reviews plan summary

> "The commander reviews the generated plan, acknowledges identified risks, and authorizes mission execution."

*Show:*
- Risk assessment summary panel
- Identified risks with likelihood/impact
- Required acknowledgments

*Action:* Commander explicitly acknowledges risks, then clicks "Authorize Mission"

**[INJECT - ACCOUNTABILITY vs. CONVENTIONAL C2]**

> "This risk acknowledgment creates accountability. In conventional operations, commanders often inherit risk assessments buried in annexes that may never be read. Here, the commander explicitly acknowledges: 'I understand these risks and accept them.' That acknowledgment is permanently recorded."

> "If this operation goes wrong, we know exactly who authorized it, what risks they were told about, and that they accepted those risks. Not to assign blame, but to learn and improve."

*System:*
- Risk acknowledgment recorded on blockchain
- Mission status changes to "Authorized"
- Tactical handoff notification sent

---

## B.4 Act 3: Tactical Level (5 minutes)

### Human Authority Position: OUT-OF-THE-LOOP (Policy Bounded)

Autonomous systems execute within policy constraints without real-time human approval for routine operations. Strike authorization is the critical exception requiring human approval.

---

**[10:00-12:00] Autonomous Reconnaissance**

*Narrator explains tactical autonomy*

> "At the tactical level, humans move OUT-OF-THE-LOOP for routine operations. The Sphero robot will navigate autonomously. The Jetson's AI will process imagery without waiting for human approval of each frame."

*Action:* Direct attention to physical demonstration area

*Show:*
- Map view with Sphero position marker
- Camera feed from Sphero/Jetson
- Navigation path overlay

*Action:* Sphero begins autonomous patrol of AO model

> "The Sphero is executing autonomous reconnaissance. Watch it navigate terrain, avoid obstacles, and follow its assigned search pattern."

**[INJECT - DDIL RESILIENCE]**

*As Sphero moves, narrator introduces simulated scenario:*

> "Let's imagine something realistic. The robot encounters unexpected electronic warfare interference. In a conventional system with centralized C2, losing communication with headquarters would paralyze the platform. It can't receive orders, can't report status, can't continue its mission."

*Gesture to Sphero continuing its patrol*

> "But our robot keeps moving. Why? Because BASTION's edge AI enables mission continuation without continuous connectivity. The Jetson carries the mission parameters, the navigation model, and the target identification capability. It doesn't need headquarters to tell it what to do next. This is DDIL resilience, the ability to operate when Disconnected, Degraded, Intermittent, or Limited-bandwidth conditions prevent communication with higher echelons."

*System:*
- Edge AI processing camera feed
- Sphero navigating tabletop AO
- Position updates appearing on map

> "Human OUT-OF-THE-LOOP for navigation decisions. The policy defined boundaries and objectives. Within those boundaries, the robot operates autonomously."

---

**[12:00-13:00] Target Identification**

*Narrator explains AI target detection*

> "The Jetson Orin Nano runs object detection directly on the robot. When it identifies an object matching target criteria, it classifies and reports."

*System:*
- Jetson AI detects target marker on AO model
- Bounding box appears on camera feed
- Classification result displayed

*Show:*
- Target classification: "VEHICLE - HOSTILE" (demonstration marker)
- Confidence score: 94%
- Location coordinates on map

> "The AI has identified a target with 94% confidence. This identification happened autonomously. No human approved examining that specific location or classifying that specific object."

**[INJECT - EDGE AI vs. CLOUD DEPENDENCY]**

> "In conventional architectures, this imagery would need to be transmitted to a cloud processing center for analysis. That transmission takes bandwidth, introduces latency, and creates vulnerability. If the link is jammed or degraded, analysis stops."

> "BASTION pushes AI to the edge. The Jetson processes locally, reports results when connectivity allows, and continues operating regardless. The robot doesn't stop being useful just because it can't phone home."

---

**[13:00-15:00] Strike Authorization - Return to Human Control**

*Narrator emphasizes critical distinction*

> "Now watch carefully. This is the most important part of the demonstration."

> "The target meets engagement criteria. The tactical system could theoretically engage autonomously. But BASTION enforces an inviolable constraint."

*Action:* System generates strike authorization proposal

*Show:*
- Strike authorization proposal appears
- Red warning indicators and pulsing borders
- "REQUIRES HUMAN APPROVAL" banner

*Speak slowly and deliberately:*

> "STRIKE AUTHORIZATION ALWAYS REQUIRES HUMAN APPROVAL."

*Pause for emphasis*

> "No configuration setting, no operational urgency, no chain of command can bypass this requirement. This is hardcoded at every level of the architecture. Lethal decisions require human authorization. Period."

**[INJECT - AUTONOMOUS WEAPONS ETHICS]**

> "This is BASTION's answer to concerns about autonomous weapons. The robot navigated autonomously. It identified the target autonomously. But it cannot kill autonomously. The decision to apply lethal force always returns to human judgment."

> "International discussions about autonomous weapons often frame this as a tradeoff: you can have speed or you can have human control. BASTION demonstrates that's a false choice. We can accelerate everything except the lethal decision. AI handles coordination. Humans handle consequences."

*Action:*
- Coalition members receive strike proposal notification
- Display voting interface with 100% threshold shown

*Show:*
- Strike proposal details (target data, effects requested, confidence)
- All coalition members must vote
- 100% approval threshold displayed

> "Every coalition member must vote. The threshold is unanimous. One 'No' vote blocks the strike."

*Action:*
- Commander reviews target data
- All coalition members vote Approve

*Show:*
- Votes recording
- 100% approval achieved
- Strike authorized

> "Human-authorized strike. AI identified. AI recommended. Humans decided."

---

**[15:00-15:30] Effects Delivery**

*System:*
- Strike authorization confirmed
- Sphero moves to engagement position
- Simulated effects delivered (LED flash, audio tone)

*Action:* Sphero executes authorized engagement

> "The tactical asset executes the human-authorized strike. For demonstration, 'effects' are visual and audio indicators."

*Show:*
- Engagement recorded on blockchain
- Audit trail entry with all approvals
- Mission status updated

> "That engagement is permanently recorded: who identified, who authorized, when, and outcome. Full accountability through immutable audit."

---

## B.4.5 COP and Resource Registry (2 minutes)

### AI-Generated Operational Picture and Resource Tracking

---

**[15:30-16:15] COP Layer Generation**

*Narrator transitions to COP tab*

> "While tactical operations proceed, AI agents have been working autonomously. Let me show you the COP tab."

*Action:* Navigate to COP tab

*Show:*
- AI-generated MIL-STD-2525D overlays on the map
- Friendly force symbols (blue) and adversary symbols (red)
- Phase slider showing force positions over time
- Resource registry entries as military symbols on the COP

> "These military symbols were not placed manually. AI agents parsed our planning documents, orders, and intelligence reports, then generated standard MIL-STD-2525D symbology automatically. Each symbol links back to its source document."

*Action:* Click on a symbol to show detail panel with source document linkage

> "Every symbol went through a publish review cycle — AI generates, humans approve before it reaches the shared COP. Governance even for the operational picture."

**[16:15-16:45] Resource Registry**

*Action:* Show resource entries on COP with DID identifiers

> "Notice these resource symbols. Each has a blockchain-anchored Decentralized Identifier — a `did:near:resource` DID. The Sphero reconnaissance asset, sensors, weapons systems — all tracked as first-class entities with real-time readiness status."

*Show:*
- Resource symbols with FMC/PMC/NMC readiness indicators
- DID identifier displayed in detail panel
- Plugin-based resource type (autonomous vehicle)

**[INJECT - RESOURCE ACCOUNTABILITY]**

> "In conventional operations, resource tracking lives in spreadsheets and logistics databases that commanders rarely see in real-time. BASTION makes every asset a blockchain-verified entity, visible on the COP, with DAO-governed allocation. You can't lose track of an asset when it has a permanent identity on the blockchain."

---

## B.5 Act 4: Cross-Level Coordination (2 minutes)

### Demonstrating Interlink Between Tactical and Strategic DAOs

---

**[16:45-17:45] Automatic Strategic Coordination**

*Narrator explains cross-DAO automation*

> "Now I'll show you something that simply doesn't happen in conventional C2."

*System:*
- AI agent detects resource expenditure
- Inventory drops below threshold
- Agent generates replenishment proposal automatically

*Show:*
- Resource state monitoring panel
- Inventory showing depletion
- Agent reasoning trace

> "The engagement expended resources. Watch what happens next."

*System:*
- Proposal appears in Strategic DAO queue
- Proposal type: "Resource Replenishment Request"
- Justification auto-populated from tactical context

**[INJECT - CROSS-LEVEL COORDINATION vs. CONVENTIONAL C2]**

> "In conventional operations, this replenishment request would require a tactical unit to file a logistics request, which routes through operational channels, which eventually reaches strategic resource managers, who must staff the request through national approval processes. That cycle takes days or weeks."

> "BASTION just completed it in seconds. The tactical expenditure automatically triggered a strategic governance action. Coalition members can now vote on replenishment through the same governance process used for initial allocation."

*Gesture to the full loop*

> "Strategic resources funded the operation. Operational AI planned the mission. Tactical autonomy executed within policy. Tactical expenditure triggered strategic replenishment. The complete cycle, without manual coordination overhead."

---

**[17:00-18:00] Summary Visualization**

*Show:*
- Full loop visualization diagram
- Strategic → Operational → Tactical → Strategic
- Arrows showing information flow

> "This seamless coordination across all levels is what BASTION enables. Interconnected, AI-augmented DAOs that preserve human authority while eliminating coordination friction."

**[INJECT - COALITION TRUST]**

> "And critically, every step of this loop is visible to all coalition partners. No black boxes. No 'trust us' assurances. Every resource allocation, every decision, every action is cryptographically verified and permanently recorded. Coalition partners don't need to trust each other. They verify."

---

## B.6 Conclusion (2 minutes)

---

**[18:00-19:30] Problems Solved**

*Narrator directly addresses the research contribution*

> "Let me be explicit about what you just witnessed."

*Enumerate problems solved:*

> "First: **Siloed decision-making**. You saw AI agents share information across functional boundaries in real-time. No more operations cell unaware of intelligence assessments."

> "Second: **Coalition coordination friction**. Strategic voting happened in seconds with cryptographic verification. No more weeks of staffing through national channels."

> "Third: **DDIL vulnerability**. The robot continued its mission during simulated communications disruption. Edge AI enables operation without constant connectivity."

> "Fourth: **Accountability gaps**. Every decision from strategic objective to tactical effect is permanently recorded. Who authorized what? Always answerable."

> "Fifth: **Speed versus control tradeoff**. We demonstrated machine-speed coordination with human authority over lethal decisions. The false choice is resolved."

---

**[19:30-20:00] Research Question Answer**

*Narrator recaps research question*

> "The research question asked how AI-augmented DAOs can provide secure, transparent, and resilient governance for military coordination."

> "You just saw the answer: blockchain provides transparency and verification. Smart contracts enforce policy. AI accelerates coordination. Graduated human authority preserves control where it matters most."

> "The complete audit trail is available for review."

*Show:*
- Blockchain transaction history
- Proposal/vote records
- Agent execution traces
- Strike authorization with full chain of approvals

> "Every claim is verifiable in the system's records. Thank you. I'm prepared for questions."

---

## B.7 Contingency Notes

### If System Fails During Demo

**Backup Option A: Pre-recorded Video**
- Have screen recording of complete demonstration available
- Narrate over recording as if live
- Acknowledge technical difficulty briefly, continue presentation

**Backup Option B: Static Screenshots with Narration**
- Prepared screenshot deck covering all major phases
- Walk through screenshots explaining what would happen
- Focus on architecture and governance concepts over live execution

### If Time Runs Short

**If at 15 minutes with Act 4 not started:**
- Skip Act 4 detailed walkthrough
- Verbally summarize cross-level coordination
- Proceed directly to Conclusion

**Must-Show Priority:**
1. Act 3 strike authorization human control (highest priority)
2. DDIL resilience inject during autonomous patrol (high priority)
3. Act 1 human-in-the-loop approval with accountability inject (high priority)
4. Act 2 human-on-the-loop monitoring (medium priority)
5. Act 4 cross-level coordination (lower priority if time constrained)

### If Questions Arise Mid-Demo

- Acknowledge question briefly
- Note for Q&A period
- Continue demonstration to maintain pacing
- Return to question after Conclusion

### Hardware Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Sphero not responding | Restart Sphero, reconnect Bluetooth |
| Jetson camera not visible | Check USB connection, restart camera service |
| UI not loading | Refresh browser, check backend health |
| Blockchain transaction fails | Use pre-approved demo data, explain what would happen |

---

## B.8 Inject Summary Reference

Quick reference for narrative injects and their connection to paper themes:

| Demo Moment | Inject Theme | Paper Reference |
|-------------|--------------|-----------------|
| Training mode activation | Train as you fight | Section 3.11 |
| Scenario upload (Understand tab) | Speed vs. conventional C2 staffing delays | Section 1.1, 1.3, 3.7 |
| Human approval | Transparency/accountability gap | Section 1.1 |
| Coalition voting | Trust and verification | Section 1.3, 2.6 |
| Operational design (Design tab) | Operational design gap | Section 3.7 |
| Design-to-Plan handoff | Doctrine-first workflow | Section 3.7 |
| Agent orchestration | Siloed decision-making | Section 1.1, 2.6 |
| On-the-loop monitoring | Decision tempo | Section 1.3 |
| Risk acknowledgment | Accountability | Section 5.3 |
| Autonomous patrol | DDIL resilience | Section 1.3, 2.5-2.6 |
| Edge AI processing | Cloud dependency vulnerability | Section 2.5 |
| Strike authorization | Autonomous weapons ethics | Section 5.3 |
| COP layer generation | AI operational picture | Section 3.9 |
| Resource registry on COP | Resource accountability | Section 3.10 |
| Cross-level replenishment | Coalition coordination friction | Section 1.1, 2.6 |
| Audit trail | Coalition trust verification | Section 1.1, 1.5 |

---

*Script designed for ~20 minute presentation with narrative injects that connect demonstration to paper thesis. The story arc moves from problem framing through solution demonstration, with each inject deliberately highlighting a specific problem BASTION solves versus conventional C2 architecture.*

