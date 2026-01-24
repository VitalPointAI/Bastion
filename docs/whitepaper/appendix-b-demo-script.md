# Appendix B: Demonstration Script (~20 minutes)

This appendix provides a detailed demonstration script for the BASTION platform, designed for a ~20 minute presentation that showcases all three human authority positions (in-the-loop, on-the-loop, out-of-the-loop) and the cross-level coordination that connects strategic objectives to tactical execution.

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
- [ ] Coalition DAO configured with sample members (USA, GBR, CAN weighted voting)
- [ ] Sample strategic document uploaded and extracted (e.g., fictional coalition directive)
- [ ] AI agents initialized and healthy
- [ ] Sphero RVR+ powered and connected
- [ ] Jetson Orin Nano running edge AI models
- [ ] Camera feed visible in monitoring interface

### Pre-Demo Checklist

```
[ ] Backend services healthy (check /api/health endpoints)
[ ] Neo4j graph database connected
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

**[0:00-1:00] Introduction**

*Narrator speaks while showing Strategic Planning Dashboard*

> "Welcome to the BASTION demonstration. BASTION stands for Blockchain Autonomous Strategy & Tactical Intelligence Operational Network. Over the next twenty minutes, we will demonstrate an end-to-end flow from strategic objective to tactical execution, showing how AI-augmented DAOs coordinate military operations while preserving human control over critical decisions."

*Action:* Display Strategic Planning Dashboard with coalition member badges visible

*Show:*
- Coalition partners (USA, GBR, CAN) with voting weights
- Empty objective list (will populate during demo)
- Agent status panel showing healthy agents

---

**[1:00-2:30] Document Ingestion**

*Narrator explains document processing*

> "Strategic planning begins with document ingestion. Coalition partners submit strategic guidance documents that define objectives, priorities, and constraints. BASTION's AI agents process these documents to extract structured objectives."

*Action:* Upload pre-prepared strategic guidance document (PDF)

> "We're uploading a fictional coalition directive that establishes reconnaissance objectives for our demonstration area."

*Show:*
- Upload progress indicator
- Document processing status
- Chunk-by-chunk extraction progress (SSE streaming)

*System Response:*
- AI extracts objectives automatically
- Extraction complete notification appears
- Objective list populates with 3-4 extracted items

> "The AI has extracted four objectives from the strategic document. Notice that extraction happens in seconds, not hours. But extraction is not approval."

---

**[2:30-4:00] Human Review**

*Narrator emphasizes human-in-the-loop*

> "Every extracted objective requires human review before it enters the governance workflow. The AI accelerates analysis, but humans make the decisions."

*Action:*
- Click on first extracted objective
- Show ObjectiveDetail view with tabs
- Review AI-extracted content

*Show:*
- Source text highlighted alongside extraction
- DIME/MIDLIFE categorization
- Risk assessment with confidence scores

*Action:* Edit one objective slightly to demonstrate human modification

> "The reviewer can accept the AI's extraction, modify it, or reject it entirely. Let's accept this reconnaissance objective with a minor clarification."

*Action:* Click "Approve" button

*Emphasize:*
> "Human IN-THE-LOOP. The AI proposed, but the human approved. Without this human action, the objective would never proceed to governance."

---

**[4:00-5:00] DAO Proposal and Voting**

*Narrator explains coalition governance*

> "Approved objectives become proposals to the Strategic DAO. Coalition members vote according to configured weights. Let's submit a resource allocation proposal for our reconnaissance mission."

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

> "The proposal has been approved by all coalition members. Resources are now allocated, and the objective is ready for operational planning. Every vote is permanently recorded on the blockchain for accountability."

---

## B.3 Act 2: Operational Level (5 minutes)

### Human Authority Position: ON-THE-LOOP

AI agents operate continuously while humans monitor with override capability. Humans do not approve every action but can intervene at any point.

---

**[5:00-6:30] AI Agent Activation**

*Narrator transitions to operational coordination*

> "With strategic resources allocated, we move to the operational level. Here, AI agents work continuously to transform strategic objectives into executable plans."

*Action:* Navigate to Agent Orchestration Panel

*Show:*
- Active agents list with status indicators
- LangGraph execution visualization
- Agent communication in message bus

> "Multiple agents are now active. The Operational Planning Agent analyzes the approved objective. The Risk Assessment Agent identifies potential hazards. The Resource Mapping Agent identifies available assets for the mission."

*System:*
- Agents begin processing
- Reasoning traces appear in execution panel
- Recommendations generate in real-time

*Show:*
- Agent generating operational plan
- Risk assessment summary appearing
- Asset assignment recommendation

---

**[6:30-8:00] Human Monitoring with Override Capability**

*Narrator emphasizes on-the-loop authority*

> "At the operational level, the human commander is ON-THE-LOOP. Agents work continuously, but the commander monitors everything and can override at any time."

*Action:* Point to monitoring dashboard

*Show:*
- Operational coordination view
- Agent activity log scrolling
- Plan generation progress

> "Watch the commander's monitoring view. Every agent action is visible. The commander can see what the agents are recommending and why."

*Action:* Hover over "Override" button (but don't click)

> "This override button would immediately halt agent operations and return control to the human. The commander chooses not to use it because the agents are operating within expected parameters."

*Emphasize:*
> "Human ON-THE-LOOP. The AI works at machine speed, but the human maintains oversight and can intervene instantly. This preserves human authority while enabling faster coordination."

*System:*
- Agents complete plan generation
- Mission plan summary appears
- Risk acknowledgment prompt appears

---

**[8:00-9:00] Mission Handoff**

*Narrator explains transition to tactical level*

> "The AI agents have generated an operational plan. The plan assigns our reconnaissance asset to survey the demonstration area and identify targets matching specified criteria."

*Show:*
- Completed operational plan summary
- Task assignment to Sphero/Jetson platform
- Mission constraints and boundaries

*Action:* Commander reviews plan summary

> "The commander reviews the generated plan, acknowledges the identified risks, and authorizes mission execution."

*Action:* Click "Authorize Mission"

> "Mission authorized. The operational plan now flows to the tactical level for execution."

---

**[9:00-10:00] Risk Acknowledgment**

*Show:*
- Risk assessment summary panel
- Identified risks with likelihood/impact
- Required acknowledgments

*Action:* Commander explicitly acknowledges risks

> "Before tactical execution begins, the commander acknowledges identified risks. This creates accountability: the commander accepted known risks when authorizing the mission."

*System:*
- Risk acknowledgment recorded on blockchain
- Mission status changes to "Authorized"
- Tactical handoff notification sent

---

## B.4 Act 3: Tactical Level (5 minutes)

### Human Authority Position: OUT-OF-THE-LOOP (Policy Bounded)

Autonomous systems execute within policy constraints without real-time human approval for routine operations. Strike authorization is the critical exception requiring human approval.

---

**[10:00-11:00] Autonomous Reconnaissance**

*Narrator explains tactical autonomy*

> "At the tactical level, humans move OUT-OF-THE-LOOP for routine operations. The Sphero robot will navigate the demonstration area autonomously. The Jetson's AI will process camera imagery without waiting for human approval of each image."

*Action:* Direct attention to physical demonstration area

*Show:*
- Map view with Sphero position marker
- Camera feed from Sphero/Jetson
- Navigation path overlay

*Action:* Sphero begins autonomous patrol of AO model

> "The Sphero is now executing autonomous reconnaissance. Watch it navigate the terrain, avoiding obstacles and following its assigned search pattern."

*System:*
- Edge AI processing camera feed
- Sphero navigating tabletop AO
- Position updates appearing on map

*Emphasize:*
> "Human OUT-OF-THE-LOOP. The robot is making navigation decisions in real-time without human approval. This is autonomous within policy bounds."

---

**[11:00-12:30] Target Identification**

*Narrator explains AI target detection*

> "The Jetson Orin Nano runs object detection models directly on the robot. When it identifies an object matching target criteria, it classifies and reports."

*System:*
- Jetson AI detects target marker on AO model
- Bounding box appears on camera feed
- Classification result displayed

*Show:*
- Target classification: "VEHICLE - HOSTILE" (demonstration marker)
- Confidence score: 94%
- Location coordinates on map

> "The AI has identified a target. Notice the confidence score: 94%. The system automatically classifies and logs this detection."

*Note:*
> "This identification happened autonomously. No human approved examining that specific location or classifying that specific object. The policy permitted reconnaissance and target identification. But watch what happens next."

---

**[12:30-14:00] Strike Authorization - Return to Human Control**

*Narrator emphasizes critical distinction*

> "The target meets engagement criteria. The tactical system could theoretically engage autonomously. But BASTION enforces an inviolable constraint."

*Action:* System generates strike authorization proposal

*Show:*
- Strike authorization proposal appears
- Red warning indicators and pulsing borders
- "REQUIRES HUMAN APPROVAL" banner

> "STRIKE AUTHORIZATION ALWAYS REQUIRES HUMAN APPROVAL."

*Emphasize:*

> "This is non-negotiable. No configuration setting, no operational urgency, no chain of command can bypass this requirement. Lethal decisions require human authorization."

*Action:*
- Coalition members receive strike proposal notification
- Display voting interface with 100% threshold shown

*Show:*
- Strike proposal details (target data, effects requested, confidence)
- All coalition members must vote
- 100% approval threshold displayed

> "Every coalition member must vote. The threshold is unanimous approval. One 'No' vote blocks the strike."

*Action:*
- Commander reviews target data
- Commander authorizes (votes Approve)
- Other coalition members vote

*Show:*
- Votes recording
- 100% approval achieved
- Strike authorized

> "Human-authorized strike. The AI identified the target. The AI recommended engagement. But humans made the lethal decision."

---

**[14:00-15:00] Effects Delivery**

*System:*
- Strike authorization confirmed
- Sphero moves to engagement position
- Simulated effects delivered (LED flash, audio tone)

*Action:* Sphero executes authorized engagement

> "The tactical asset executes the human-authorized strike. For demonstration purposes, 'effects' are a visual and audio indicator, not actual weapons."

*Show:*
- Engagement recorded on blockchain
- Audit trail entry with all approvals
- Mission status updated

> "That engagement is now permanently recorded: who identified the target, who authorized the strike, when it occurred, and what the outcome was. Full accountability through immutable audit trail."

---

## B.5 Act 4: Cross-Level Coordination (3 minutes)

### Demonstrating Interlink Between Tactical and Strategic DAOs

---

**[15:00-16:30] Resource Expenditure Detection**

*Narrator explains cross-DAO automation*

> "Here's where BASTION's interconnected DAOs demonstrate their value. An AI agent monitors tactical resource state."

*System:*
- AI agent detects resource expenditure
- Inventory drops below threshold
- Alert generated

*Show:*
- Resource state monitoring panel
- Inventory showing depletion
- Agent reasoning trace

> "The engagement expended resources. The AI agent automatically detects that inventory has dropped below the replenishment threshold."

*System:*
- Agent generates replenishment proposal automatically
- Proposal targets Strategic DAO
- Cross-DAO communication visible

---

**[16:30-17:30] Strategic DAO Notification**

*Narrator explains seamless vertical integration*

> "Without any human intervention, the tactical expenditure triggers a strategic governance action. Watch the Strategic DAO."

*Show:*
- New proposal appears in Strategic DAO queue
- Proposal type: "Resource Replenishment Request"
- Justification: "Tactical expenditure during authorized mission"

*Action:* Point to coalition notification

> "Coalition members are automatically notified. They can vote to approve replenishment through the same governance process used for initial allocation."

*Show:*
- Coalition members see notification
- Voting interface ready
- Audit trail connecting tactical action to strategic request

---

**[17:30-18:00] Cycle Complete**

*Narrator summarizes integration*

> "Strategic resources funded the operation. Operational AI planned the mission. Tactical autonomy executed within policy. Tactical expenditure triggered strategic replenishment. The complete cycle, from strategic intent to tactical effect and back to strategic governance, without manual coordination overhead."

*Show:*
- Full loop visualization diagram
- Strategic → Operational → Tactical → Strategic
- Arrows showing information flow

> "This seamless coordination across all levels is what BASTION enables through interconnected, AI-augmented DAOs."

---

## B.6 Conclusion (2 minutes)

---

**[18:00-19:00] Thesis Validation**

*Narrator recaps demonstration against research question*

> "This demonstration validates BASTION's answer to the research question."

*Recap three human authority positions:*

> "We demonstrated three human authority positions. At the strategic level, humans were IN-THE-LOOP for every decision. At the operational level, humans were ON-THE-LOOP monitoring AI agents with override capability. At the tactical level, humans were OUT-OF-THE-LOOP for routine operations within policy bounds."

> "Critically, lethal decisions returned to human-in-the-loop. Strike authorization required unanimous human approval regardless of autonomy configuration."

*Recap research question answer:*

> "AI-augmented DAOs provide the secure, transparent, and resilient governance framework the research question asked about. Blockchain records every decision. Smart contracts enforce policy. AI accelerates coordination. Humans retain authority where it matters most."

---

**[19:00-20:00] Q&A Preparation**

*Narrator prepares for questions*

> "The complete audit trail is available for review."

*Show:*
- Blockchain transaction history
- Proposal/vote records
- Agent execution traces
- Strike authorization with full chain of approvals

> "Every claim we made is verifiable in the system's records. Thank you for your attention. I'm prepared to answer questions about any aspect of the demonstration."

*Ready for:*
- Technical questions about blockchain/AI integration
- Questions about human authority enforcement
- Questions about coalition governance
- Questions about operational deployment path

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
2. Act 1 human-in-the-loop approval (high priority)
3. Act 2 human-on-the-loop monitoring (medium priority)
4. Act 4 cross-level coordination (lower priority if time constrained)

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

*Script designed for ~20 minute presentation. Adjust pacing based on audience engagement and time constraints. Core message: AI-augmented DAOs enable faster military coordination while preserving human control over lethal decisions.*

