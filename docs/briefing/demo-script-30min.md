# BASTION: 30-Minute Demonstration Script

> Expanded demo script with full doctrinal tab walkthrough, robot integration, and governance demonstration.
> Based on the original 20-minute script (Appendix B) with additional coverage of Phase 14-53 capabilities.

**Total Time:** 30 minutes (28 minutes content + 2 minutes buffer)
**Audience:** Mixed academic and military/defense stakeholders
**Format:** [NARRATOR: ...] for talking points, [INJECT: ...] for demonstrator actions

---

## Pre-Demo Setup Checklist (~2 minutes, before clock starts)

```
[ ] Docker bridge running: docker compose -f robot/bridge/docker-compose.yml up -d
[ ] Python robot agent connected: check mDNS discovery in bridge logs
[ ] Pacific Strategy AY26 data seeded: bash scripts/seed-scenario.sh
[ ] All 6 doctrinal tabs accessible: Understand / Design / Plan / Decide / COP / Assess
[ ] Training mode active: amber EXERCISE banner visible
[ ] Mock governance data enabled: VITE_USE_MOCK_DATA=true
[ ] AI agents initialized: check /api/health endpoints
[ ] Sphero RVR+ powered and connected (3 units for swarm demo)
[ ] Jetson Orin Nano running edge AI models, camera feed visible
[ ] Coalition accounts ready: USA, GBR, CAN
[ ] Strike authorization proposal pre-staged (not yet submitted)
[ ] Slide deck available as backup: docs/briefing/slide-deck.md
```

---

## Act 1: Strategic Level (8 minutes) — HUMAN-IN-THE-LOOP

All strategic decisions require explicit human approval. AI assists with analysis; humans decide.

---

### [0:00-2:00] Introduction and Understand Tab — Brain Visualization

[INJECT: Navigate to Understand tab. Brain canvas should be visible with Pacific Strategy AY26 entities loaded.]

[NARRATOR: "Welcome to the BASTION demonstration. Notice the amber EXERCISE banner — we're in training mode, which uses identical governance to operational mode. Train as you fight."]

[NARRATOR: "We begin where doctrine begins — understanding the operational environment. This is the Understand tab, and at its center is the Brain: a force-directed knowledge graph showing every entity, relationship, and intelligence assessment extracted from our planning documents."]

[INJECT: Point to brain canvas. Highlight node shapes: circles for actors, diamonds for objectives, squares for documents. Show red adversary nodes (PLA), blue friendly nodes (USS Ronald Reagan CSG), gold objective diamonds.]

[NARRATOR: "Each node carries a NATO Admiralty Code confidence rating. This PLA Southern Theater Command node shows B-2: Usually Reliable, Probably True. The brain doesn't present false certainty — it shows analysts the evidentiary basis for every claim."]

[INJECT: Click on a PLA entity to open detail panel showing confidence score, sources, and relationships.]

[NARRATOR: "Now watch the document intelligence pipeline in action."]

[INJECT: Upload a new document via the ingestion sidebar. Show ExtractionTheater with SSE particle animation as 10 specialist agents process the document.]

[NARRATOR: "Ten specialist AI agents autonomously process this document — scoping the content, extracting entities, resolving them against the existing graph, and scoring confidence. A task that would consume an entire staff section's morning, completed in seconds."]

[NARRATOR: "One honest note on AI extraction: the brain treats every AI-generated entity as an intelligence estimate, not a fact. NATO confidence ratings and multi-agent cross-validation are our defense against hallucination — but human analyst review remains the final gate. We accelerate the process; we don't remove the analyst."]

---

### [2:00-5:00] Design Tab — Center of Gravity and Operational Approach

[INJECT: Navigate to Design tab.]

[NARRATOR: "The Design tab is where commanders translate understanding into operational approach. This is often the weakest link in conventional planning — strategic guidance gets handed to planners who jump straight to courses of action without systematic problem framing."]

[INJECT: Show Center of Gravity analysis panel. Point to Strange's CC-CR-CV framework for both friendly (blue pane) and adversary (red pane).]

[NARRATOR: "Center of gravity analysis follows Strange's framework. The adversary CoG — PLA power projection capability — has three critical capabilities and two critical vulnerabilities identified. The AI suggested initial framings; the commander refined them."]

[INJECT: Scroll to Lines of Effort canvas below. Show LOE-1 Diplomatic Isolation, LOE-2 Sea Control, LOE-3 Airspace Dominance with objective links and decisive points.]

[NARRATOR: "Lines of effort connect strategic objectives to operational tasks. Each decisive point is linked to the CoG analysis. This structured approach feeds directly into course of action development."]

[INJECT: Show AI Design Assistant sidebar with a "Challenge Assumption" card active.]

[NARRATOR: "The AI design assistant doesn't just support — it challenges. This card is questioning whether our assumption about adversary naval concentration holds under alternate scenarios. Adversarial thinking built into the workflow."]

[INJECT: Click "Export to Plan" to show design-to-plan handoff.]

[NARRATOR: "Watch this handoff — operational design outputs flow directly into the Plan tab's mission analysis. No manual translation, no intent lost between the design team and the planning staff."]

---

### [5:00-8:00] Plan Tab — Strategic Guidance and Directive Inheritance

[INJECT: Navigate to Plan tab at strategic echelon.]

[NARRATOR: "The Plan tab adapts to echelon. At strategic level, we see strategic guidance development. At operational, the JPP 7-step campaign plan. At tactical, MDMP. Same tab, doctrine-appropriate workflow at each level."]

[INJECT: Show strategic guidance workflow. Draft a directive. Demonstrate the directive inheritance mechanism — show how approving the directive creates a child problem set at operational level.]

[NARRATOR: "When the commander approves this directive, it doesn't just save a document. It creates a child problem set at the operational level, inheriting the strategic context, objectives, and constraints. The operational planner starts with full strategic context instead of a forwarded email."]

[INJECT: Show the coalition voting interface for the strategic resource allocation proposal.]

[NARRATOR: "Resource allocation requires coalition governance. USA, GBR, CAN each vote with configured weights. Every vote records on NEAR blockchain — cryptographically verifiable, permanently auditable."]

[INJECT: Cast votes from all three coalition members. Show blockchain transaction confirmation.]

[NARRATOR: "Coalition partners don't need to trust each other's word. They verify. Every commitment is on-chain."]

[NARRATOR: "A quick note on tempo: this two-second consensus finality is appropriate for strategic resource allocation. For time-critical tactical actions, we don't touch the blockchain at all — pre-authorized actions execute immediately through conventional authorization, and the blockchain audit record follows asynchronously. Governance and speed are in fundamental tension. The five-tier authority model is how we manage that tension rather than pretending it doesn't exist."]

---

## Act 2: Operational Level (6 minutes) — HUMAN-ON-THE-LOOP

AI agents work at machine speed while the commander monitors and can intervene at any point.

---

### [8:00-11:00] Plan Tab — JPP Campaign Plan and COA Development

[INJECT: Navigate to Plan tab at operational echelon. Show JPP 7-step framework.]

[NARRATOR: "At the operational level, the Plan tab presents the Joint Planning Process — seven steps from planning initiation through plan assessment. Notice the inherited strategic context populating mission analysis automatically."]

[INJECT: Show Step 3: COA Development. Display multiple courses of action with AI-generated wargaming analysis.]

[NARRATOR: "Multiple AI agents are active. The Operational Planning Agent develops courses of action. The Risk Assessment Agent identifies hazards. The Wargaming Agent simulates each COA against adversary responses."]

[INJECT: Show agent reasoning traces in the execution panel.]

[NARRATOR: "Every agent's reasoning is visible. The commander sees what agents recommend and why. This override button immediately halts agent operations — but the commander chooses not to use it because agents are operating within expected parameters."]

[INJECT: Point to override button without clicking.]

[NARRATOR: "Human judgment where it matters. AI speed everywhere else."]

---

### [11:00-14:00] OPORD Generation and Tactical Problem Set Creation

[INJECT: Show OPORD generation from the selected COA.]

[NARRATOR: "The selected course of action generates an Operations Order. But here's where BASTION diverges from conventional C2."]

[INJECT: Show OPORD distribution triggering tactical child problem set creation. Display the inheritance propagation — how strategic context and operational plans flow down to the tactical level.]

[NARRATOR: "Distributing this OPORD doesn't just send a document. It creates tactical child problem sets that inherit operational context — mission, constraints, force allocation, and timelines. When the tactical planner opens their workspace, they already have everything they need."]

[INJECT: Show the parent-child relationship in the problem set hierarchy.]

[NARRATOR: "And it works upward too. When tactical units report status, it aggregates up through operational to strategic. FRAGOs propagate downward in real-time. The hierarchy is live, not a static org chart."]

---

## Act 3: Tactical Level (8 minutes) — HUMAN-OUT-OF-THE-LOOP (with authority gates)

Autonomous systems execute within policy constraints. Strike authorization is the critical exception requiring human approval.

---

### [14:00-17:00] Plan Tab — MDMP and Mission Creation

[INJECT: Navigate to Plan tab at tactical echelon. Show MDMP workflow.]

[NARRATOR: "At the tactical level, the Military Decision Making Process. The inherited OPORD populates mission analysis. AI staff agents work their functional areas — J2 intelligence preparation, J3 operations planning, J4 logistics, J6 communications."]

[INJECT: Show AI agent staff workspaces with agents processing in parallel.]

[NARRATOR: "Each agent operates in its doctrinal role. The J2 agent doesn't just analyze intelligence — it updates the brain graph with tactical-level entities. Everything connects."]

[INJECT: Create a reconnaissance mission from the OPORD tasking. Show mission parameters being set.]

[NARRATOR: "This mission — visual search for adversary forward positions — is authorized by the operational plan. The robot will execute autonomously within defined geographic and temporal bounds. But lethal decisions? Always human-approved."]

---

### [17:00-20:00] Resources Tab and Robot Bridge

[INJECT: Navigate to Resources tab.]

[NARRATOR: "The Resources tab is where digital planning meets physical execution. Every asset has a blockchain-anchored Decentralized Identifier — a did:near:resource DID."]

[INJECT: Show ResourceCatalog with RVR+ entries. Point to DID badges, FMC/PMC/NMC status indicators.]

[NARRATOR: "Three Sphero RVR+ units registered. RVR+ Alpha is our vision-equipped swarm leader. Watch the Discovery panel."]

[INJECT: Show the Discovery panel sidebar with mDNS discovery events. If live, show a robot agent self-registering.]

[NARRATOR: "When a robot agent powers up, it broadcasts an mDNS service announcement. The Docker bridge discovers it, validates against the registry, and presents it to the DAO for authorization. No manual IP configuration — agents and bridge self-assemble on the same network."]

[INJECT: Show the Robot Bridge connection status — WebSocket connected, telemetry flowing.]

[NARRATOR: "The bridge maintains an outbound WebSocket to BASTION cloud. Commands flow down, telemetry flows up. No inbound ports required — the connection is always initiated from the local side."]

---

### [20:00-22:00] Robot Vision — Camera, Detection, Mission Intent

[INJECT: Show robot camera feed on screen. detectNet running with bounding boxes visible.]

[NARRATOR: "The Jetson Orin Nano runs 40 TOPS of AI inference. detectNet processes the camera feed in real-time — no cloud round-trip needed. Watch the detection pipeline."]

[INJECT: Show a detection event: bounding box around a target with class label and confidence score.]

[NARRATOR: "Object detected — 91% confidence. The detection happened autonomously. But the robot doesn't just see — it understands mission context."]

[INJECT: Show mission intent translation — how the natural-language mission command was translated to executable parameters.]

[NARRATOR: "The LLM-based intent translator parsed the mission command and mapped it to a visual_search mission type with specific area polygon, sweep pattern, and detection triggers. If the LLM is unavailable, a template fallback provides deterministic translation. Resilience at every layer."]

[NARRATOR: "On DDIL resilience — if cloud connectivity drops right now, the robot continues its authorized mission with the parameters it downloaded before execution. The UDP peer mesh keeps the swarm coordinated independently of cloud. But I want to be honest: extended disconnection — hours, not minutes — is an architectural assumption we've designed for but haven't fully stress-tested. We know how the system should behave; we haven't run it through sustained worst-case disconnection and reconciliation scenarios."]

---

## Act 3.5: COP and Governance (4 minutes)

### Cross-Level Situational Awareness and Decision Governance

---

### [22:00-24:00] COP Tab — MIL-STD-2525D Overlays and Swarm Telemetry

[INJECT: Navigate to COP tab. Map should show Taiwan Strait / Western Pacific.]

[NARRATOR: "The Common Operating Picture. These military symbols were not placed manually — AI agents parsed our planning documents and generated standard MIL-STD-2525D symbology. Each symbol links back to its source document."]

[INJECT: Toggle friendly/adversary perspective. Show phase slider moving from Competition to Crisis.]

[NARRATOR: "Perspective toggle lets the commander see the picture from the adversary's point of view. The phase slider shows force disposition over time."]

[INJECT: Zoom to the swarm telemetry layer. Show three RVR+ positions in wedge formation with formation polygon overlay.]

[NARRATOR: "Here's the swarm — three RVR+ platforms in wedge formation. The leader shares vision detections with followers over a UDP peer mesh. Formation geometry is maintained even during cloud connectivity loss."]

[INJECT: Point to the Swarm Telemetry Panel showing per-robot battery, heading, speed. Show leader camera thumbnail.]

[NARRATOR: "Real-time telemetry for every swarm member. The formation is doctrinal — six formations available, four movement techniques. This isn't a demo gimmick; it mirrors how ground forces actually move."]

---

### [24:00-26:00] Decide Tab — Decision Dashboard and DAO Governance

[INJECT: Navigate to Decide tab.]

[NARRATOR: "The Decide tab — formerly named Direct, renamed to align with JP 5-0 decision doctrine. This is where governance happens at every decision gate."]

[INJECT: Show the DecisionDashboard with pending decisions. Point to Ironclaw's proactive decision surfacing banner.]

[NARRATOR: "Ironclaw — our chief of staff AI agent — polls every 60 seconds for pending decisions and surfaces them proactively. Two decisions require attention: a COA Approval Gate and an OPORD Release Gate."]

[INJECT: Open PendingDecisionModal for the COA Approval Gate. Show HUMAN_ONLY authority badge, RACI assignment, approve/reject/defer buttons.]

[NARRATOR: "This decision is marked HUMAN_ONLY — the five-tier authority model determines who decides. No AI can bypass this. The RACI matrix shows who's Responsible, Accountable, Consulted, and Informed."]

[INJECT: Click Approve. Show DAO proposal creation and blockchain confirmation.]

[NARRATOR: "On approval, a DAO proposal is submitted for coalition vote. Governance embedded at the decision point, not bolted on afterward."]

---

## Conclusion (2 minutes)

---

### [26:00-28:00] Full Loop and Research Question

[INJECT: Return to strategic level. Show how tactical results and swarm detections have fed upward through the problem set hierarchy.]

[NARRATOR: "Let me close the loop. Strategic understanding fed operational design. Operational plans created tactical missions. Tactical robots executed and reported. Those reports aggregated upward — the strategic commander now sees tactical outcomes without a single manual status update."]

[NARRATOR: "The research question asked: Can AI-augmented DAOs provide decision overmatch in military coalition operations?"]

[NARRATOR: "You just saw the answer. Blockchain provides transparency and verification. Smart contracts enforce policy. AI accelerates coordination. Graduated human authority preserves control where it matters most."]

[NARRATOR: "And critically — the human retained authority at every level. In-the-loop for strategic decisions. On-the-loop for operational coordination. Out-of-the-loop for tactical routine operations. But always: strike authorization requires human approval. No configuration, no override, no exception."]

[INJECT: Show blockchain audit trail — complete decision chain from strategic to tactical.]

[NARRATOR: "Every claim is verifiable in the system's records. Thank you. I'm prepared for questions."]

[NARRATOR: "One closing note on honest assessment: BASTION is a research prototype. The contribution is the architecture — DAO governance, graduated human authority, AI-DAO integration, edge-to-cloud physical validation. It is not a claim of production readiness. Operational deployment requires field testing, security audit, multi-user stress testing, and partner nation validation that a ten-week research effort cannot provide. We built the blueprint and demonstrated that it holds together end-to-end. The building hasn't been stress-tested."]

---

## Contingency Notes

### If Time Runs Short

**Must-Show Priority (highest to lowest):**
1. Strike authorization / human control gate (Act 3)
2. Brain visualization + document intelligence (Act 1, 0:00-2:00)
3. Swarm telemetry on COP (Act 3.5, 22:00-24:00)
4. Decide tab governance gate (Act 3.5, 24:00-26:00)
5. Design tab CoG analysis (Act 1, 2:00-5:00)
6. OPORD inheritance (Act 2, 11:00-14:00)
7. Robot vision pipeline (Act 3, 20:00-22:00)
8. Full loop conclusion (always include, shorten if needed)

### Hardware Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| RVR+ not responding | Restart RVR+, check bridge mDNS logs |
| Jetson camera blank | Check CSI cable, restart camera service |
| Bridge disconnected | `docker compose restart`, check WS URL |
| Swarm formation broken | Restart follower agents, leader re-broadcasts |
| UI not loading | Refresh browser, check /api/health |
| Blockchain tx fails | Use pre-approved demo data, narrate what would happen |

### Backup: Static Screenshots

If hardware fails, use pre-captured screenshots from `docs/whitepaper/figures/workflow-screenshots.md` specifications. Narrate over screenshots as if live.

---

*30-minute script designed for mixed academic and military/defense audience. Extends the original 20-minute Appendix B script with full doctrinal tab coverage, robot vision, swarm telemetry, and Decide tab governance. See also: `docs/whitepaper/appendix-b-demo-script.md` for the original 20-minute version.*
