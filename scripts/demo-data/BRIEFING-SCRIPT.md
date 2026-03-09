# BASTION Operational Demonstration — Briefing Script

**Duration:** 25-35 minutes (adjustable per audience)
**Scenario:** Pacific Strategy AY26 — Indo-Pacific Theater Campaign
**Platform:** BASTION (Blockchain Autonomous Strategy & Tactical Intelligence Operational Network)

---

## Pre-Brief Setup Checklist

Before the demonstration begins, complete these steps:

### Environment Verification

1. Ensure backend, PostgreSQL, and Neo4j are running
2. Ensure frontend dev server is running (`http://localhost:3000`)
3. Run the seed script to populate demo data:
   ```bash
   bash scripts/seed-demo.sh --reset
   ```
   Expected: ~30 seconds, ends with "Demo seed complete" message
4. Verify data loaded:
   - Open `http://localhost:3000` — login page should render
   - After login, problem set list should show "INDOPACOM Theater Campaign" and subordinate plans

### Browser Tabs to Pre-Open

| Tab | URL | Purpose |
|-----|-----|---------|
| 1 | `http://localhost:3000` | Login page (start here) |
| 2 | `http://localhost:3000/problem-sets` | Problem set list (post-login landing) |
| 3 | `http://localhost:3000/problem-set/DEMO-PS-indopacom-theater` | Theater campaign (Act 1) |
| 4 | `http://localhost:3000/problem-set/DEMO-PS-cjtf-westpac` | Component plan (Act 2-4) |

### Audience Adaptation

| Aspect | Military Audience | Academic Audience |
|--------|-------------------|-------------------|
| **Emphasis** | Doctrinal compliance, OPSEC, chain of command | Pedagogical value, research, AI/ML capabilities |
| **Language** | Use JP 5-0 terminology freely | Define doctrinal terms when first introduced |
| **Value prop** | Decision authority, tamper-proof audit trail | Wargaming education, scenario exploration |
| **Demo pace** | Faster through familiar concepts (JPP, COA) | Slower on planning methodology, explain each step |
| **Questions** | Expect: "How does this integrate with existing C2?" | Expect: "How do students interact with AI agents?" |
| **Skip/expand** | Expand: inheritance, FRAGO propagation, status reporting | Expand: RAFT graph, AI analysis, document pipeline |

---

## Opening (2-3 min) — Problem Statement & Value Proposition

### Talking Points

> "Current military planning tools are disconnected systems. Intelligence lives in one application, planning in another, orders in a third. There is no single platform that carries a commander's intent from strategic guidance down to tactical execution — and back up again."

> "BASTION changes that. It is a blockchain-governed, AI-augmented planning platform that follows Joint Publication 5-0 doctrine end-to-end. Every decision is recorded on the NEAR blockchain for immutable accountability. Nineteen AI agents act as virtual staff officers. And the entire command hierarchy — from theater to tactical — is connected through a live inheritance system."

> "Today I will walk you through a real exercise scenario: Pacific Strategy AY26, an Indo-Pacific campaign centered on PRC aggression toward Taiwan. Everything you will see is pre-loaded with realistic operational data."

### UI Navigation

- Stay on the login page or a title slide during the opening
- See [DEMO-WALKTHROUGH.md, Station 1](#) for login steps

### Audience Engagement

- **Pause point:** "Before we dive in — how many here are familiar with JP 5-0 joint planning?" (calibrates depth)
- **Military:** "You will recognize the planning methodology. Focus on what is different — the AI augmentation and blockchain governance."
- **Academic:** "We will walk through the US military's joint planning process. Watch how AI and blockchain add layers of capability."

### Timing: 2-3 minutes

### Fallback

If the login page does not render, verify the frontend is running: `npm run dev` in the frontend directory.

---

## Act 1: The Operational Picture (5-7 min)

### Beat 1.1: Problem Set Hierarchy

**What to SAY:**
> "BASTION organizes work into problem sets — the JP 5-0 term for the operational challenges a commander must address. These are hierarchical, just like a real command structure."

> "At the top, we have the INDOPACOM Theater Campaign — the strategic level. Under that, three component commands: CJTF-WestPac for the joint task force, 7th Fleet for maritime operations, and 5th Air Force for air operations. Below those, tactical missions: Strike Package Alpha, Logistics Convoy Bravo, 3rd MEF Amphibious Ready Group, CAP Station Delta, and ISR Collection Echo."

> "This is not just organization — it is live inheritance. A change at theater level propagates downward. A status report at tactical level rolls upward. We will see this in action later."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 2](#) for click sequence
- Navigate: Problem set list -> click "INDOPACOM Theater Campaign" -> show breadcrumb
- Click into CJTF-WestPac -> click into Strike Package Alpha
- Point out breadcrumb trail: Strategic > Operational > Tactical

**Data to Highlight:**
- 11 problem sets total (9 training + 2 operational mode duplicates)
- 3 echelon levels: strategic, operational, tactical
- Real unit names: INDOPACOM, CJTF-WestPac, 7th Fleet, 5th Air Force

**Audience Engagement:**
- **Military:** "Notice the problem set hierarchy mirrors your actual command structure. A combatant commander sees the theater campaign. A JTF commander sees their component plan."
- **Academic:** "Students can create their own problem sets at any echelon and see how planning decisions cascade through the hierarchy."

### Beat 1.2: Training vs. Operational Mode

**What to SAY:**
> "BASTION enforces a critical concept: train as you fight. Every problem set can run in training mode or operational mode. The system looks and feels identical — the only difference is the stakes. Training mode allows experimentation. Operational mode locks down governance and produces auditable records."

> "Watch what happens when I switch modes."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 3](#) for mode toggle
- Show the mode badge (training mode indicator)
- Toggle to operational mode
- Point out visual differentiation (badge change)
- Toggle back to training for the rest of the demo

**Audience Engagement:**
- **Military:** "This means your staff can rehearse a plan in training mode, then switch to operational mode when it is time to execute — same interface, same data structures, full audit trail."
- **Academic:** "Students train on realistic scenarios. Faculty can review training runs and assess decision quality."

### Beat 1.3: COP Tab — Common Operating Picture

**What to SAY:**
> "The COP tab gives the commander a common operating picture. Here you see unit positions with MIL-STD-2525D symbology — the standard military symbol set."

> "These are real unit designations: USS Ronald Reagan carrier strike group, 3rd Marine Expeditionary Force, PLA Eastern Theater Command on the adversary side. Thirteen command units across strategic, operational, and tactical echelons."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 4](#) for COP tab navigation
- Navigate to COP tab within the theater campaign
- Point out command unit markers and SIDC symbology
- Highlight both friendly and adversary units

**Data to Highlight:**
- 13 command units with proper SIDC codes
- Real designations: USINDOPACOM HQ, PACFLT, PACAF, CJTF-WestPac, 7th Fleet, USS Ronald Reagan CSG, VFA-102 Diamondbacks
- Adversary: PLA Eastern Theater Command, PLA Navy Fujian Carrier Group

**Timing: 5-7 minutes for Act 1**

**Fallback:** If the COP does not render unit positions, navigate directly to a component plan and show the unit list panel. "The unit data is here — the map visualization depends on the mapping service being available."

---

## Act 2: Understanding the Environment (5-7 min)

### Beat 2.1: Understand Tab — DIME/PMESII Analysis

**What to SAY:**
> "Before planning, you need to understand the operating environment. The Understand tab is where intelligence and analysis live. BASTION structures this around DIME — Diplomatic, Information, Military, Economic — and PMESII — Political, Military, Economic, Social, Information, Infrastructure — the standard analytical frameworks."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 5](#) for Understand tab navigation
- Navigate to Understand tab within INDOPACOM Theater Campaign

### Beat 2.2: RAFT Graph — Actor Network Visualization

**What to SAY:**
> "The RAFT graph visualizes the actor network in the operating environment. RAFT stands for Relationships, Actors, Functions, and Tensions. Here we have 17 actors — nation-states, military commands, international organizations, and economic entities."

> "Click on any actor to see its relationships. China, for example, has rivalry relationships with the US and Japan, a sovereignty claim over Taiwan, and partnerships with Russia and Pakistan. Eight tensions are mapped with intensity scores across military, economic, and information domains."

> "This is where AI-augmented entity resolution matters. The same actor may appear under different names in different intelligence reports. BASTION's AI links them automatically."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 5](#) for RAFT graph interaction
- Open graph visualization panel
- Click "China" actor node to show relationships
- Point out relationship types: ALLIANCE, COMPETES_WITH, CLAIMS_SOVEREIGNTY
- Show tension indicators with intensity scores

**Data to Highlight:**
- 17 actors (10 nations, 4 organizations, 2 military commands, 1 economic entity)
- 27 relationships with typed edges and strength scores
- 8 tensions with intensity 4-8 across military/economic/information domains

**Audience Engagement:**
- **Pause point:** "Can you see how this map of relationships changes the way you think about the problem? This is not just intelligence — it is structured understanding."

### Beat 2.3: OSINT Events — Intelligence Feed

**What to SAY:**
> "The OSINT event feed brings in open-source intelligence, organized by exercise phase. We have 29 events across all six phases of Pacific Strategy AY26 — from the competition phase through crisis, conflict, and negotiation."

> "Each event is tagged by DIME domain, linked to operational objectives, and scored for validity. You can see trends over time — watch how military events spike during the conflict phases while diplomatic events increase during negotiation."

> "From PDF to actionable intelligence in minutes, not days."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 6](#) for OSINT navigation
- Show OSINT event feed panel
- Click an event to show its detail (linked objective, validity score)
- Point out DIME domain tags and phase distribution

**Data to Highlight:**
- 29 OSINT events across 6 exercise phases
- Distribution: competition (5), crisis (7), conflict days 4/10/22 (12), negotiation (5)
- DIME domains: diplomatic, information, military, economic

### Beat 2.4: Document Pipeline

**What to SAY:**
> "BASTION does not just store documents — it ingests them. Strategy documents, OPORDs, intelligence reports — PDFs go in, structured objectives come out. Our strategy document reviewer agent reads the document, extracts key objectives, and fuses them into the operational picture."

> "Here you see 10 documents from the Pacific Strategy AY26 exercise: blue team orders, red team intelligence, scenario phase documents. Each has been processed through the extraction pipeline."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 7](#) for document navigation
- Show document list with ingested strategy documents
- Click a document to show extracted objectives
- Point out the processing status and extraction results

**Data to Highlight:**
- 10 documents spanning blue team, red team, and scenario phases
- Document types: strategy, OPORD, intelligence reports
- Extraction pipeline: PDF -> NLP -> structured objectives -> fusion

**Audience Engagement:**
- **Military:** "Imagine ingesting a 50-page OPORD and having actionable objectives extracted in minutes, cross-referenced against your existing plan."
- **Academic:** "Students can upload their own scenario documents and see how the AI parses them. It teaches analytical thinking — what makes a good objective?"

**Timing: 5-7 minutes for Act 2**

**Fallback:** If the graph does not render, switch to the OSINT events panel first. "The graph visualization depends on Neo4j — let me show you the intelligence feed instead, which comes from the relational database."

---

## Act 3: Designing the Campaign (5-7 min)

### Beat 3.1: Design Tab — Operational Design Workspace

**What to SAY:**
> "Once you understand the environment, you design the campaign. The Design tab implements JP 5-0 operational design — the creative process where commanders and staff visualize how to achieve strategic objectives."

> "Four sections here: Problem Framing, Center of Gravity Analysis, Lines of Effort, and the Operational Approach. Each mirrors the doctrinal process."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 8](#) for Design tab navigation
- Navigate to Design tab within INDOPACOM Theater Campaign
- Show Problem Framing section: strategic end state, objectives, assumptions
- Show Center of Gravity analysis: Strange's CG-CC-CR-CV model
- Show Lines of Effort: multiple operational threads
- Show Operational Approach: how design connects to planning

**Data to Highlight:**
- Theater-level design (INDOPACOM) with all 4 JP 5-0 sections populated
- Component-level design (CJTF-WestPac) with operational-echelon focus
- Center of gravity analysis uses Strange's CG-CC-CR-CV model
- Lines of effort connect strategic objectives to operational tasks

**Audience Engagement:**
- **Military:** "This is where the art of operational design meets the science of structured analysis. Every element links to the plan that follows."
- **Academic:** "Operational design is often the hardest concept for students. This workspace makes it concrete and visual."

### Beat 3.2: AI Agent Products

**What to SAY:**
> "BASTION has 19 specialized AI agents — virtual staff officers that augment human decision-making. They do not replace the commander. They provide analysis, challenge assumptions, and process information at machine speed."

> "Here you see pre-computed outputs from four agent roles: Strategic Fusion analysis synthesizes intelligence across domains. Adversary Modeling projects enemy courses of action. Escalation Modeling assesses risk at each decision point. And the Assumption Auditor challenges planning assumptions — the devil's advocate your staff might be too polite to be."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 9](#) for AI agent navigation
- Show agent output panel with pre-seeded products
- Click on Strategic Fusion output: cross-domain intelligence synthesis
- Click on Adversary Modeling output: enemy COA projections
- Click on Escalation Modeling: risk assessment matrix
- Click on Assumption Auditor: challenged assumptions list

**Data to Highlight:**
- 9 pre-computed AI agent outputs across 4 agent roles
- Agent roles: strategic-fusion, adversary-modeling, escalation-modeling, assumption-auditing
- Stored as staff_products with structured metadata (model, confidence, sources)
- Staff role mapping: J2 (intelligence), J5 (plans)

**Live Agent Demo (Optional):**
> "If you would like, I can invoke an agent live right now. Give me a question about the scenario, and watch the AI work in real time."

**Audience Engagement:**
- **Pause point:** "This is a key differentiator. How many planning tools give you an AI devil's advocate that challenges your assumptions before the enemy does?"

**Timing: 5-7 minutes for Act 3**

**Fallback:** If AI agent outputs do not display, navigate to the Design tab and discuss the design elements. "The agent outputs feed into the design process. Let me show you where those insights are applied."

---

## Act 4: Planning & Directing (5-7 min)

### Beat 4.1: Plan Tab — Joint Planning Process (JPP)

**What to SAY:**
> "Now we move from design to planning. The Plan tab implements the Joint Planning Process — seven steps from Planning Initiation through Plan and Order Development. This is JP 5-0 chapter 5 in software."

> "Watch the workflow: each step has a status, products, and staff inputs. We have populated steps 1 through 4 — Planning Initiation, Mission Analysis, COA Development, and COA Analysis. Steps 5 through 7 are intentionally left for the demo audience to complete interactively."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 10](#) for Plan tab navigation
- Navigate to Plan tab within CJTF-WestPac Campaign Plan
- Show JPP instance with 7 steps listed
- Click into Step 1 (Planning Initiation) — show populated products
- Click into Step 2 (Mission Analysis) — show mission analysis products
- Click into Step 3 (COA Development) — show COA options
- Show step status progression (complete/in-progress/pending)

**Data to Highlight:**
- JPP instance: DEMO-JPP-cjtf-westpac at operational echelon
- 9 step products across steps 1-4 with doctrinal content
- Step statuses show progression through the planning cycle
- COA comparison view available

**Audience Engagement:**
- **Military:** "Your planners will recognize every step. The difference: AI agents contribute at each step, and governance gates ensure commander approval before advancing."
- **Academic:** "Students can work through the JPP at their own pace. The system guides them through doctrine while the AI provides analytical support."

### Beat 4.2: Direct Tab — Inheritance System

**What to SAY:**
> "The Direct tab is where plans become orders. But here is the part that changes everything: inheritance."

> "A FRAGO at theater level automatically notifies every subordinate command. Watch — here is FRAGO-001, issued at the INDOPACOM level. You can see it propagated to CJTF-WestPac, to 7th Fleet, to the tactical missions below them. Each subordinate command acknowledges receipt and can report compliance or request an override with justification."

> "And it works upward too. Tactical status reports from Strike Package Alpha roll up to 7th Fleet, then to INDOPACOM. The theater commander gets a real-time picture of execution without picking up a phone."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 11](#) for Direct tab and inheritance
- Navigate to Direct tab
- Show FRAGO list — click FRAGO-001
- Show propagation path: theater -> component -> tactical
- Show status reports rolling upward
- Show override with justification

**Data to Highlight:**
- FRAGOs with downward propagation across 3 echelons
- Status reports with upward aggregation
- Override tracking with justification text
- Change notifications at each level

**Audience Engagement:**
- **Pause point:** "This is the architectural crown jewel. How long does it currently take for a FRAGO to reach the tactical level in your organization? BASTION makes it instantaneous — with an audit trail."
- **Military:** "Override tracking means accountability. If a subordinate diverges from the plan, the commander knows immediately — and knows why."
- **Academic:** "This teaches command-and-control dynamics. Students can see how decisions cascade through a hierarchy, including the friction when subordinate commands must adapt."

**Timing: 5-7 minutes for Act 4**

**Fallback:** If inheritance data does not display, navigate to the problem set hierarchy and show the parent-child relationships. "The inheritance system connects these problem sets. Let me show you the data flow between echelons."

---

## Act 5: Governance & Accountability (3-5 min)

### Beat 5.1: DAO Decision Gates

**What to SAY:**
> "Every significant decision in BASTION passes through a governance gate. These are recorded on the NEAR blockchain — not just who approved, but when, with what context, and how the vote went."

> "Here you see 10 decision gates across five tabs. Eight have been approved. Two are pending — waiting for commander review. Each gate shows the decision context, recorded votes, and a blockchain audit trail with transaction IDs and NEAR account addresses."

> "This is not just process overhead. This is the answer to 'Who authorized this?' — permanently, immutably, on blockchain."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 12](#) for governance navigation
- Show decision gate list with recorded votes
- Click an approved gate — show vote details, approval chain
- Click a pending gate — show awaiting commander decision
- Highlight blockchain audit trail (tx IDs, NEAR accounts, timestamps)

**Data to Highlight:**
- 10 decision gates spanning understand/design/plan/direct/assess tabs
- 8 approved + 2 pending gates
- Blockchain audit trail: NEAR transaction IDs, account addresses
- Vote records with timestamp and voter identity

**Audience Engagement:**
- **Military:** "Imagine a congressional inquiry. Every decision, every vote, every approval — on an immutable ledger. This is accountability that cannot be altered after the fact."
- **Academic:** "Students experience real governance structures. Faculty can review decision-making quality after the exercise."

### Beat 5.2: Assess Tab — After-Action & METL

**What to SAY:**
> "The Assess tab closes the loop. After exercises, structured AARs capture what happened, why it happened, and what to do differently. Twelve METL tasks — mission-essential task list — are rated Trained, Practiced, or Untrained."

> "And here is the Assumption Auditor at work again. Remember those planning assumptions from earlier? The AI tracked them through execution and flagged which ones held up and which ones failed. This is how organizations learn."

**What to CLICK:**
- See [DEMO-WALKTHROUGH.md, Station 13](#) for Assess tab navigation
- Navigate to Assess tab
- Show AAR list — 3 AARs from completed exercise events
- Click an AAR to show observations (16 total)
- Show METL assessment with task ratings (4 Trained, 6 Practiced, 2 Untrained)
- Show assumption audit results

**Data to Highlight:**
- 3 structured AARs with 16 observations
- 12 METL tasks with T/P/U proficiency distribution (4T/6P/2U)
- Assumption audit results from AI agent
- Linked assessments connecting METL to AARs

**Timing: 3-5 minutes for Act 5**

**Fallback:** If the Assess tab does not load data, reference the governance gates. "Assessment and governance work together. Let me show you the decision records that feed into after-action review."

---

## Closing (2-3 min) — Key Takeaways

### Talking Points

> "Let me bring it all together. What you have seen today:"

> "**Doctrinal compliance:** Every tab, every workflow follows JP 5-0. Problem sets, operational design, the Joint Planning Process, assessment — this is not a tech demo bolted onto military concepts. The doctrine drives the architecture."

> "**AI augmentation:** Nineteen specialized agents act as virtual staff officers. They synthesize intelligence, model adversaries, assess escalation risk, and audit assumptions. They do not replace commanders — they make commanders faster and better informed."

> "**Blockchain governance:** Every significant decision passes through a DAO governance gate recorded on the NEAR blockchain. Immutable. Auditable. Accountable."

> "**Hierarchical inheritance:** Strategic intent flows downward through the command structure. Tactical reality flows upward. FRAGOs propagate instantly. Status reports aggregate automatically. Overrides are tracked with justification."

> "**Dual-use platform:** What you saw in training mode works identically in operational mode. War colleges can use this for education and wargaming. Operational units can use it for real planning. Train as you fight."

### Cleanup Note

> "One more thing — all of this demo data can be completely removed with a single command. Run `scripts/seed-demo.sh --clean` and every DEMO-prefixed record is purged. The system returns to a clean state. No residual data."

### Q&A Transition

> "I would like to open it up for questions. We can revisit any part of the platform, or I can run an AI agent live on a question you pose."

**Audience Engagement:**
- Have the walkthrough operator ready to navigate to any section on request
- Keep the seed-demo.sh cleanup command ready in case the audience wants to see the reset capability

### Timing: 2-3 minutes for closing + Q&A

---

## Total Demo Timing Summary

| Segment | Duration | Cumulative |
|---------|----------|------------|
| Opening: Problem Statement & Value Proposition | 2-3 min | 2-3 min |
| Act 1: The Operational Picture | 5-7 min | 7-10 min |
| Act 2: Understanding the Environment | 5-7 min | 12-17 min |
| Act 3: Designing the Campaign | 5-7 min | 17-24 min |
| Act 4: Planning & Directing | 5-7 min | 22-31 min |
| Act 5: Governance & Accountability | 3-5 min | 25-36 min |
| Closing & Q&A Transition | 2-3 min | 27-39 min |

**Target duration:** 25-35 minutes for the scripted demo, plus Q&A

---

## Appendix: Feature Coverage Checklist

Use this to verify the demo covers all BASTION capabilities:

- [x] Problem set hierarchy (strategic/operational/tactical)
- [x] Training mode and operational mode toggle
- [x] COP tab — common operating picture
- [x] Command units with SIDC symbology
- [x] Understand tab — DIME/PMESII analysis
- [x] RAFT graph — actor network visualization
- [x] OSINT events — intelligence feed with validity scoring
- [x] Document pipeline — PDF ingestion and objective extraction
- [x] Design tab — operational design workspace (JP 5-0)
- [x] AI agent products (strategic fusion, adversary modeling, escalation, assumption auditing)
- [x] Plan tab — JPP workflow (7 steps)
- [x] Direct tab — commander's directives
- [x] Inheritance system — FRAGO propagation downward
- [x] Status reporting — tactical to strategic upward
- [x] Override tracking — divergence with justification
- [x] DAO governance — decision gates with blockchain audit trail
- [x] Assess tab — AARs and METL assessments
- [x] Blockchain — NEAR transaction records
- [x] All 6 doctrinal tabs: Understand, Design, Plan, Direct, COP, Assess
