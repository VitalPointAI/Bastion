# BASTION Demo Walkthrough — Operator Guide

**Companion to:** [BRIEFING-SCRIPT.md](BRIEFING-SCRIPT.md)
**Role:** This document is for the demo operator — the person driving the UI while the presenter talks. Follow the station sequence exactly to match the briefing script.

---

## 1. Environment Setup

### Prerequisites

| Component | Required | Check Command |
|-----------|----------|---------------|
| Docker | Running | `docker ps` |
| PostgreSQL | Running (via Docker) | `docker exec bastion-postgres pg_isready` |
| Neo4j | Running (via Docker) | `docker exec bastion-neo4j cypher-shell "RETURN 1"` |
| Node.js | v18+ | `node --version` |
| Backend | Running on port 3001 | `curl -s http://localhost:3001/api/health` |
| Frontend | Running on port 3000 | `curl -s http://localhost:3000` |

### Start Commands

```bash
# 1. Start Docker containers (PostgreSQL + Neo4j)
docker compose up -d

# 2. Start backend (in backend/ directory)
cd backend && npm run dev

# 3. Start frontend (in frontend/ directory, separate terminal)
cd frontend && npm run dev
```

### Seed Demo Data

```bash
# Full reset and seed (recommended before every demo)
bash scripts/seed-demo.sh --reset

# Expected output:
#   [CLEANUP] Removing DEMO- data...
#   [SEED] Problem sets... done (11 records)
#   [SEED] Command units... done (13 records)
#   [SEED] Graph actors... done (17 actors, 27 relationships, 8 tensions)
#   [SEED] OSINT events... done (29 events)
#   [SEED] Documents... done (10 documents)
#   [SEED] Design... done (2 problem sets)
#   [SEED] JPP... done (1 instance, 9 products)
#   [SEED] Agents... done (9 outputs)
#   [SEED] Governance... done (10 gates)
#   [SEED] Assessment... done (3 AARs, 12 METL tasks)
#   [SEED] Inheritance... done (FRAGOs, status reports, overrides)
#   Demo seed complete.

# Timing: approximately 30-60 seconds
```

### Quick Verification

After seeding, verify key data loaded:

```bash
# Check problem set count
docker exec bastion-postgres psql -U postgres -d bastion -c \
  "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-%';"
# Expected: 11

# Check graph actor count
docker exec bastion-neo4j cypher-shell \
  "MATCH (a:Actor) WHERE a.id STARTS WITH 'DEMO-' RETURN count(a);"
# Expected: 17

# Check documents
docker exec bastion-postgres psql -U postgres -d bastion -c \
  "SELECT count(*) FROM documents WHERE id LIKE 'DEMO-%';"
# Expected: 10 (or check via API)
```

---

## 2. Demo Stations

Each station corresponds to a beat in the [BRIEFING-SCRIPT.md](BRIEFING-SCRIPT.md). Follow them in order.

---

### Station 1: Login & Overview

**Briefing Script Reference:** Opening (2-3 min)

**URL:** `http://localhost:3000`

**Expected Screen State:**
- Login page with BASTION branding
- Phantom wallet or NEAR wallet login option
- Demo user login available (if configured)

**Click Sequence:**
1. Open `http://localhost:3000` in browser
2. Log in using the demo user account or Phantom wallet
3. After login, the problem set list view loads automatically
4. Verify "INDOPACOM Theater Campaign" appears in the list

**Data to Highlight:**
- Problem set list shows multiple entries at different echelons
- Mode badges visible (training mode indicators)

**Potential Issues & Fixes:**
- **Login page blank:** Check frontend is running (`npm run dev` in frontend/)
- **No problem sets after login:** Run `bash scripts/seed-demo.sh` to seed data
- **Wallet not connecting:** Use a demo/dev account instead of wallet auth for reliability

**Transition:** "Now let me show you the command structure." Click into the first problem set.

---

### Station 2: Problem Set Hierarchy

**Briefing Script Reference:** Act 1, Beat 1.1

**URL:** `http://localhost:3000/problem-sets` (list) -> `http://localhost:3000/problem-set/DEMO-PS-indopacom-theater` (theater)

**Expected Screen State:**
- Problem set list showing all seeded entries
- Echelon indicators (strategic/operational/tactical)
- Parent-child relationships visible in the hierarchy

**Click Sequence:**
1. From the problem set list, click **"INDOPACOM Theater Campaign"**
2. Note the breadcrumb showing strategic echelon
3. Navigate to child problem sets — click **"CJTF-WestPac Campaign Plan"**
4. Note the breadcrumb now shows: INDOPACOM Theater Campaign > CJTF-WestPac
5. Navigate deeper — click **"Strike Package Alpha"**
6. Note breadcrumb: INDOPACOM > CJTF-WestPac > Strike Package Alpha (3 levels)
7. Return to INDOPACOM level using breadcrumb

**Data to Highlight:**
- **Strategic level (1):** INDOPACOM Theater Campaign
- **Operational level (4):** CJTF-WestPac, 7th Fleet, 5th Air Force, CJTF-WestPac (OPERATIONAL)
- **Tactical level (5):** Strike Package Alpha, Logistics Convoy Bravo, 3rd MEF ARG, CAP Station Delta, ISR Collection Echo
- **Operational mode duplicates (2):** INDOPACOM (OPERATIONAL), CJTF-WestPac (OPERATIONAL)

**Potential Issues & Fixes:**
- **Hierarchy not showing:** Problem sets may display as flat list. Use breadcrumb and click-through to demonstrate hierarchy.
- **Missing problem sets:** Run `bash scripts/seed-problem-sets.sh` to re-seed

**Transition:** "Notice the training mode badge. Let me show you what happens when we switch modes."

---

### Station 3: Mode Toggle

**Briefing Script Reference:** Act 1, Beat 1.2

**URL:** Stay on current problem set page

**Expected Screen State:**
- Mode badge showing "TRAINING" (or equivalent indicator)
- Mode toggle control visible

**Click Sequence:**
1. Locate the mode indicator/badge on the current problem set
2. Click the mode toggle to switch from **Training** to **Operational**
3. Point out visual change — badge, color, or label change
4. Wait 2-3 seconds for the presenter to comment
5. Toggle back to **Training** mode for the rest of the demo

**Data to Highlight:**
- Two parallel problem sets exist: training and operational versions of INDOPACOM and CJTF-WestPac
- Visual differentiation between modes

**Potential Issues & Fixes:**
- **Toggle not visible:** Navigate to `http://localhost:3000/problem-set/DEMO-PS-indopacom-theater` directly and look for the mode indicator
- **No visual change:** Verbally note the mode and navigate to the operational duplicate: `DEMO-PS-indopacom-theater-ops` to show both versions side by side

**Transition:** "Now let us look at the common operating picture."

---

### Station 4: COP Tab

**Briefing Script Reference:** Act 1, Beat 1.3

**URL:** `http://localhost:3000/problem-set/DEMO-PS-indopacom-theater` -> COP tab

**Expected Screen State:**
- COP tab active within the theater campaign
- Map or unit visualization showing command unit positions
- Unit markers with MIL-STD-2525D SIDC symbols
- Both friendly (blue) and adversary (red) units visible

**Click Sequence:**
1. From the INDOPACOM Theater Campaign view, click the **"COP"** tab
2. Wait for the map/unit visualization to render
3. Point out friendly force markers (blue): USINDOPACOM HQ (Hawaii), PACFLT, PACAF
4. Point out adversary markers (red): PLA Eastern Theater Command, PLA Navy
5. Click on **USS Ronald Reagan CSG** marker to show unit details
6. Show SIDC code and unit designation

**Data to Highlight:**
- 13 command units total
- Friendly forces: USINDOPACOM HQ (Camp H.M. Smith), PACFLT (Pearl Harbor), PACAF (Hickam), CJTF-WestPac (Camp Zama), 7th Fleet, USS Ronald Reagan CSG, VFA-102 Diamondbacks
- Adversary forces: PLA Eastern Theater Command, PLA Navy Fujian Carrier Group
- Geographic spread: Hawaii, Japan, Western Pacific, Taiwan Strait, Fujian Province

**Potential Issues & Fixes:**
- **Map not rendering:** If map tiles fail, show unit list panel instead. All unit data is still visible in list/table format.
- **No unit markers:** Run `bash scripts/seed-command-units.sh` to re-seed units
- **SIDC symbols not showing:** SIDC rendering depends on mil-sym library. Unit names and positions still demonstrate the concept.

**Transition:** "Now let us understand the operational environment. I will move to the Understand tab."

---

### Station 5: Understand Tab — RAFT Graph

**Briefing Script Reference:** Act 2, Beats 2.1-2.2

**URL:** `http://localhost:3000/problem-set/DEMO-PS-indopacom-theater` -> Understand tab

**Expected Screen State:**
- Understand tab active
- RAFT graph visualization showing actor network
- Node-link diagram with 17 actor nodes
- Relationship edges visible (colored or labeled by type)
- Tension indicators

**Click Sequence:**
1. Click the **"Understand"** tab within INDOPACOM Theater Campaign
2. Locate the RAFT Graph panel or visualization area
3. Wait for graph to render (may take 2-5 seconds for Neo4j query)
4. Click on the **"China"** (or "People's Republic of China") actor node
5. Show relationships radiating from China:
   - COMPETES_WITH -> United States
   - CLAIMS_SOVEREIGNTY -> Taiwan
   - STRATEGIC_PARTNER -> Russia
   - ECONOMIC_PARTNER -> Pakistan
6. Show tension indicators (intensity scores 4-8)
7. Click on **"Taiwan"** node to show its relationships
8. Point out entity resolution: same actor may appear under different names

**Data to Highlight:**
- **Key actors:** United States, China (PRC), Taiwan (ROC), Japan, Philippines, Australia, South Korea, India, Russia, ASEAN
- **Organizations:** AUKUS, QUAD, ASEAN, BRICS+
- **Military commands:** PLA Eastern Theater Command, USINDOPACOM
- **Key relationships:** US-Japan Alliance, US-Philippines Alliance, China-Taiwan sovereignty claim, South China Sea disputes
- **Tensions:** Taiwan Strait military tension (intensity 8), South China Sea maritime (7), US-China trade (6)

**Potential Issues & Fixes:**
- **Graph empty:** Run `bash scripts/seed-graph.sh` to re-seed Neo4j data
- **Graph slow to render:** Neo4j cold start can take 10-15 seconds. Pre-load this tab during setup.
- **Neo4j connection refused:** Check `docker exec bastion-neo4j cypher-shell "RETURN 1"` — restart container if needed

**Transition:** "These actors generate intelligence. Let me show you the OSINT event feed."

---

### Station 6: Understand Tab — OSINT Events

**Briefing Script Reference:** Act 2, Beat 2.3

**URL:** Stay on Understand tab, navigate to OSINT events panel

**Expected Screen State:**
- OSINT event feed showing 29 events
- Events tagged with DIME domains (Diplomatic, Information, Military, Economic)
- Phase labels: Competition, Crisis, Conflict Day 4/10/22, Negotiation
- Validity scores visible

**Click Sequence:**
1. From the Understand tab, locate the **OSINT Events** panel or section
2. Scroll through the event feed — note events organized by phase
3. Click on a **Competition phase** event — show DIME domain tag and linked objective
4. Click on a **Conflict phase** event — show higher urgency/military domain
5. Point out validity scoring and trend indicators
6. Show how events link to operational objectives

**Data to Highlight:**
- 29 OSINT events across 6 exercise phases
- Phase distribution: Competition (5), Crisis (7), Conflict (12 across days 4/10/22), Negotiation (5)
- DIME domains represented across events
- Each event linked to operational objectives for trend analysis

**Potential Issues & Fixes:**
- **No events showing:** Run `bash scripts/seed-osint.sh` to re-seed
- **Events not linked to objectives:** This depends on the extraction pipeline. Show the raw events and note the linked objective IDs.

**Transition:** "Intelligence comes from documents too. Let me show you the document pipeline."

---

### Station 7: Documents

**Briefing Script Reference:** Act 2, Beat 2.4

**URL:** Navigate to documents section within the problem set

**Expected Screen State:**
- Document list showing ingested strategy documents
- Document types visible (strategy, OPORD, intelligence)
- Processing status indicators (extracted, pending)
- Team labels (blue team, red team)

**Click Sequence:**
1. Navigate to the **documents** section within the problem set
2. Show the document list — 10 documents from Pacific Strategy AY26
3. Click on a **blue team document** (e.g., INDOPACOM Campaign Plan)
4. Show extracted objectives from the document
5. Click on a **red team document** (e.g., PLA threat assessment)
6. Show the extraction pipeline output — PDF to structured objectives
7. Point out document metadata: team, phase, document type

**Data to Highlight:**
- 10 documents spanning blue team orders, red team intelligence, scenario phases
- Document manifest maps source files from `/scenario/` directory to problem sets
- Extraction pipeline: PDF upload -> NLP processing -> structured objectives -> fusion
- Documents tagged by team (blue/red) and exercise phase

**Potential Issues & Fixes:**
- **Documents not listed:** Run `bash scripts/seed-documents.sh` to re-seed
- **Extraction not showing:** Document extraction depends on NLP pipeline. Show the raw document list and explain the pipeline conceptually.
- **PDF not rendering:** Browser PDF viewer may not work in all setups. Have a local PDF viewer as backup.

**Transition:** "Now that we understand the environment, let us design the campaign."

---

### Station 8: Design Tab

**Briefing Script Reference:** Act 3, Beat 3.1

**URL:** `http://localhost:3000/problem-set/DEMO-PS-indopacom-theater` -> Design tab

**Expected Screen State:**
- Design tab active
- Four operational design sections visible:
  1. Problem Framing
  2. Center of Gravity Analysis
  3. Lines of Effort
  4. Operational Approach

**Click Sequence:**
1. Click the **"Design"** tab within INDOPACOM Theater Campaign
2. Show **Problem Framing** section:
   - Strategic end state, objectives, planning assumptions
3. Show **Center of Gravity Analysis** section:
   - Strange's CG-CC-CR-CV model
   - Friendly CoG and Adversary CoG analysis
4. Show **Lines of Effort** section:
   - Multiple operational threads linking objectives to tasks
5. Show **Operational Approach** section:
   - How design elements connect to the planning phase
6. Navigate to **CJTF-WestPac** and show component-level design
   - Note: operational echelon design is more tactical/specific

**Data to Highlight:**
- Theater-level design: INDOPACOM with all 4 JP 5-0 sections populated
- Component-level design: CJTF-WestPac with operational-echelon content
- CoG analysis uses Strange's model: Center of Gravity, Critical Capabilities, Critical Requirements, Critical Vulnerabilities
- Lines of effort connect strategic objectives to operational tasks

**Potential Issues & Fixes:**
- **Design sections empty:** Run `bash scripts/seed-design.sh` to re-seed
- **Only one level populated:** Navigate between INDOPACOM (strategic) and CJTF-WestPac (operational) to show both

**Transition:** "AI agents contributed to this design. Let me show you their analysis products."

---

### Station 9: AI Agent Products

**Briefing Script Reference:** Act 3, Beat 3.2

**URL:** Navigate to AI agent outputs panel within the problem set

**Expected Screen State:**
- Agent output panel showing pre-seeded analysis products
- Multiple agent roles visible (strategic-fusion, adversary-modeling, escalation-modeling, assumption-auditing)
- Staff product cards with confidence scores and source citations

**Click Sequence:**
1. Navigate to the **AI agent outputs** or **staff products** section
2. Click on **Strategic Fusion** output:
   - Cross-domain intelligence synthesis
   - Sources cited, confidence score
3. Click on **Adversary Modeling** output:
   - Enemy COA projections for PLA
   - Probability assessments
4. Click on **Escalation Modeling** output:
   - Risk assessment at each escalation step
   - Red lines and thresholds
5. Click on **Assumption Auditor** output:
   - Planning assumptions challenged
   - Evidence for/against each assumption
6. (Optional) If time permits and the system is live, invoke an agent in real time

**Data to Highlight:**
- 9 pre-computed AI agent outputs across 4 roles
- Staff role mapping: J2 (intelligence) for strategic-fusion and adversary-modeling, J5 (plans) for escalation and assumption auditing
- Structured metadata: model, confidence scores, source references
- Products stored as staff_products in PostgreSQL

**Potential Issues & Fixes:**
- **No agent outputs:** Run `bash scripts/seed-agents.sh` to re-seed
- **Agent output panel not found:** Look under the AI Staff or agent section within the problem set. Products may appear under JPP step products if organized by planning step.
- **Live agent invocation fails:** Pre-seeded outputs are the primary demo path. Live invocation is a bonus. If it fails, say "The AI agent would process this in real-time. Here is a pre-computed example of what it produces."

**Transition:** "These AI products feed into the Joint Planning Process. Let me show you the Plan tab."

---

### Station 10: Plan Tab — JPP

**Briefing Script Reference:** Act 4, Beat 4.1

**URL:** `http://localhost:3000/problem-set/DEMO-PS-cjtf-westpac` -> Plan tab

**Expected Screen State:**
- Plan tab active within CJTF-WestPac Campaign Plan
- JPP instance visible with 7 steps listed
- Step status indicators (complete, in-progress, pending)
- Step products populated for steps 1-4

**Click Sequence:**
1. Navigate to **CJTF-WestPac Campaign Plan** (`DEMO-PS-cjtf-westpac`)
2. Click the **"Plan"** tab
3. Show JPP instance with all 7 steps:
   - Step 1: Planning Initiation (complete)
   - Step 2: Mission Analysis (complete)
   - Step 3: COA Development (complete)
   - Step 4: COA Analysis (in-progress)
   - Step 5: COA Comparison (pending)
   - Step 6: COA Approval (pending)
   - Step 7: Plan/Order Development (pending)
4. Click into **Step 1: Planning Initiation**
   - Show populated products (commander's guidance, initial planning directive)
5. Click into **Step 2: Mission Analysis**
   - Show mission analysis products (specified/implied tasks, facts/assumptions)
6. Click into **Step 3: COA Development**
   - Show COA options developed
7. Show **Step 4: COA Analysis** in progress
   - Note: "This is where the exercise currently stands"

**Data to Highlight:**
- JPP instance ID: DEMO-JPP-cjtf-westpac at operational echelon
- 9 step products across steps 1-4 with doctrinal content
- Step progression: 3 complete, 1 in-progress, 3 pending
- Steps 5-7 intentionally blank for interactive demo if desired

**Potential Issues & Fixes:**
- **JPP not showing:** Run `bash scripts/seed-jpp.sh` to re-seed
- **No step products:** Products may need to be viewed by clicking into individual steps
- **Step status not updating:** Refresh the page. Status is stored in PostgreSQL and may need a fresh query.

**Transition:** "Plans become orders in the Direct tab. And this is where inheritance comes alive."

---

### Station 11: Direct Tab — Inheritance

**Briefing Script Reference:** Act 4, Beat 4.2

**URL:** `http://localhost:3000/problem-set/DEMO-PS-indopacom-theater` -> Direct tab

**Expected Screen State:**
- Direct tab active
- FRAGO list showing issued orders
- Inheritance panel showing propagation status
- Status reports from subordinate commands
- Override tracking entries

**Click Sequence:**
1. Navigate back to **INDOPACOM Theater Campaign** (`DEMO-PS-indopacom-theater`)
2. Click the **"Direct"** tab
3. Show **FRAGO list** — locate FRAGO-001
4. Click **FRAGO-001** to show details:
   - Issued at theater level (INDOPACOM)
   - Propagation status: sent to CJTF-WestPac, 7th Fleet, 5th Air Force
   - Acknowledgment status from each subordinate
5. Show **downward propagation path**:
   - Theater (INDOPACOM) -> Component (CJTF-WestPac) -> Tactical (Strike Package Alpha)
6. Navigate to a subordinate problem set to show **status reports**:
   - Click into CJTF-WestPac or Strike Package Alpha
   - Show tactical status report rolling upward
7. Show **override tracking**:
   - Locate an override entry where a subordinate command diverged
   - Show the justification text explaining why

**Data to Highlight:**
- FRAGOs with change notifications propagating downward across 3 echelons
- Status reports aggregating upward from tactical to strategic
- Override tracking with justification text
- Acknowledgment receipts at each command level

**Potential Issues & Fixes:**
- **No FRAGOs showing:** Run `bash scripts/seed-inheritance.sh` to re-seed (requires seed-demo.sh to have run first for problem set IDs)
- **Inheritance panel empty:** Inheritance data requires the Phase 38 inheritance system. If the UI panel is not visible, describe the data flow and show the raw data via the API.
- **Override not found:** Overrides may be in a subordinate problem set. Navigate down the hierarchy to find them.

**Transition:** "Every one of these decisions is governed. Let me show you the governance layer."

---

### Station 12: Governance — Decision Gates

**Briefing Script Reference:** Act 5, Beat 5.1

**URL:** Navigate to governance section within the problem set

**Expected Screen State:**
- Decision gate list showing 10 gates
- Gate status: 8 approved, 2 pending
- Blockchain audit trail visible (tx IDs, NEAR accounts)
- Vote records with timestamps

**Click Sequence:**
1. Navigate to the **governance** or **decision gates** section
2. Show the gate list — 10 gates across 5 tabs
3. Click on an **approved gate** (e.g., "Design Approval Gate"):
   - Show vote records: who voted, when, approve/reject
   - Show blockchain audit trail: NEAR transaction ID, account address
   - Show decision context: what was being decided
4. Click on a **pending gate** (e.g., "COA Approval"):
   - Show "awaiting commander decision" status
   - Show what information is available for the decision
5. Highlight the blockchain audit trail:
   - Transaction IDs are permanent, immutable records
   - NEAR account addresses identify the decision-maker

**Data to Highlight:**
- 10 decision gates across understand/design/plan/direct/assess tabs
- 8 approved with full vote and audit records
- 2 pending gates awaiting commander review
- Blockchain metadata: NEAR tx IDs, account addresses, timestamps
- DAO governance structure: votes, approval thresholds

**Potential Issues & Fixes:**
- **No gates showing:** Run `bash scripts/seed-governance.sh` to re-seed
- **Blockchain details not visible:** Gate records include blockchain metadata in the decision_context JSONB field. If the UI does not surface tx IDs, describe the data model.
- **DAO panel not found:** Governance gates may appear within each tab or in a dedicated governance section. Check both locations.

**Transition:** "Finally, let me show you how we assess and learn."

---

### Station 13: Assess Tab

**Briefing Script Reference:** Act 5, Beat 5.2

**URL:** `http://localhost:3000/problem-set/DEMO-PS-cjtf-westpac` -> Assess tab

**Expected Screen State:**
- Assess tab active
- AAR (After Action Review) list showing 3 entries
- METL (Mission Essential Task List) assessment panel
- Task ratings: Trained (T), Practiced (P), Untrained (U)
- Assumption audit results

**Click Sequence:**
1. Navigate to **CJTF-WestPac Campaign Plan** (`DEMO-PS-cjtf-westpac`)
2. Click the **"Assess"** tab
3. Show **AAR list** — 3 structured AARs from exercise events
4. Click on an **AAR** to show observations:
   - 16 total observations across 3 AARs
   - Each observation has: what was planned, what happened, lessons learned
5. Show **METL assessment**:
   - 12 METL tasks listed
   - Ratings: 4 Trained, 6 Practiced, 2 Untrained
   - Color-coded for quick visual assessment
6. Show how METL assessments link to AARs
7. Reference **Assumption Auditor** outputs (from Station 9):
   - AI tracked planning assumptions through execution
   - Flagged which held up and which failed

**Data to Highlight:**
- 3 AARs with 16 observations documenting exercise events
- 12 METL tasks with T/P/U distribution: 4 Trained, 6 Practiced, 2 Untrained
- Linked assessments connecting METL tasks to AAR observations
- Assumption audit: AI-driven tracking of planning assumptions

**Potential Issues & Fixes:**
- **No AARs showing:** Run `bash scripts/seed-assessment.sh` to re-seed
- **METL tasks empty:** Assessment data depends on seed-assessment.sh. Re-run if needed.
- **Assumption audit not visible:** This is an AI agent output (see Station 9). Reference the pre-seeded assumption auditor product.

**Transition:** "That concludes the platform walkthrough. Let me hand it back for the closing and Q&A."

---

## 3. Cleanup & Reset

### Full Cleanup (Remove All Demo Data)

```bash
bash scripts/seed-demo.sh --clean
```

Expected output:
```
[CLEANUP] Removing DEMO- problem sets...
[CLEANUP] Removing DEMO- graph data...
[CLEANUP] Removing DEMO- OSINT events...
[CLEANUP] Removing DEMO- documents...
[CLEANUP] Removing DEMO- JPP data...
[CLEANUP] Removing DEMO- agent outputs...
[CLEANUP] Removing DEMO- governance gates...
[CLEANUP] Removing DEMO- assessment data...
[CLEANUP] Removing DEMO- inheritance data...
[CLEANUP] Complete. All demo data removed.
```

### Verify Cleanup

```bash
# Should return 0 for all queries
docker exec bastion-postgres psql -U postgres -d bastion -c \
  "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-%';"

docker exec bastion-neo4j cypher-shell \
  "MATCH (a:Actor) WHERE a.id STARTS WITH 'DEMO-' RETURN count(a);"
```

### Re-seeding for Multiple Demo Sessions

For back-to-back demos, use the reset flag:

```bash
# Cleans and re-seeds in one step
bash scripts/seed-demo.sh --reset
```

This is safe to run repeatedly. The DEMO- prefix convention ensures only seeded data is affected — user-created data is never touched.

### Seeding Individual Components

If only one component needs re-seeding:

```bash
bash scripts/seed-demo.sh --only=graph       # Re-seed only Neo4j graph data
bash scripts/seed-demo.sh --only=osint        # Re-seed only OSINT events
bash scripts/seed-demo.sh --only=documents    # Re-seed only documents
bash scripts/seed-demo.sh --only=jpp          # Re-seed only JPP data
bash scripts/seed-demo.sh --only=agents       # Re-seed only AI agent outputs
bash scripts/seed-demo.sh --only=governance   # Re-seed only decision gates
bash scripts/seed-demo.sh --only=assessment   # Re-seed only AARs and METL
bash scripts/seed-demo.sh --only=inheritance  # Re-seed only inheritance artifacts
```

---

## 4. Troubleshooting Guide

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Login page blank | Frontend not running | `cd frontend && npm run dev` |
| API errors after login | Backend not running | `cd backend && npm run dev` |
| No problem sets | Seed script not run | `bash scripts/seed-demo.sh --reset` |
| Graph empty | Neo4j not running or not seeded | `docker restart bastion-neo4j` then `bash scripts/seed-graph.sh` |
| Neo4j connection refused | Container stopped | `docker compose up -d` |
| Documents not showing | Upload failed during seed | `bash scripts/seed-documents.sh` |
| Missing env vars | `.env` not configured | Copy `.env.example` to `.env` and fill in values |
| Slow graph render | Neo4j cold start | Pre-load Understand tab 30 seconds before demo |
| SIDC symbols missing | mil-sym library issue | Unit names still display — describe symbology verbally |
| Mode toggle no visual change | UI may not have mode indicator implemented | Navigate to operational mode duplicate problem set |

### Data Verification Queries

**PostgreSQL checks:**

```sql
-- Problem sets
SELECT id, name, echelon, mode FROM problem_sets WHERE id LIKE 'DEMO-%' ORDER BY echelon;

-- Command units
SELECT id, name, echelon FROM units WHERE id LIKE 'DEMO-%';

-- JPP instance and products
SELECT id, problem_set_id, status FROM jpp_instances WHERE id LIKE 'DEMO-%';
SELECT id, step_number, title FROM jpp_step_products WHERE id LIKE 'DEMO-%';

-- Decision gates
SELECT id, gate_type, status FROM decision_gates WHERE id LIKE 'DEMO-%';

-- AARs
SELECT id, title FROM structured_aars WHERE id LIKE 'DEMO-%';

-- METL tasks
SELECT id, task_name, proficiency FROM metl_tasks WHERE id LIKE 'DEMO-%';
```

**Neo4j checks:**

```cypher
// Actor count and names
MATCH (a:Actor) WHERE a.id STARTS WITH 'DEMO-' RETURN a.name, a.type ORDER BY a.name;

// Relationship count
MATCH (a:Actor)-[r]->(b:Actor)
WHERE a.id STARTS WITH 'DEMO-' AND b.id STARTS WITH 'DEMO-'
RETURN type(r), count(r);

// Tension count
MATCH (t:Tension) WHERE t.id STARTS WITH 'DEMO-' RETURN t.name, t.intensity;
```

### Emergency Recovery

If the demo environment is in an unexpected state:

```bash
# Nuclear option: full clean + full re-seed
bash scripts/seed-demo.sh --reset --verbose

# If seed-demo.sh itself fails, run scripts individually:
bash scripts/seed-cleanup.sh          # Clean first
bash scripts/seed-problem-sets.sh     # Foundation
bash scripts/seed-command-units.sh    # Units
bash scripts/seed-graph.sh            # Neo4j actors
bash scripts/seed-osint.sh            # OSINT events
bash scripts/seed-documents.sh        # Documents
bash scripts/seed-design.sh           # Operational design
bash scripts/seed-jpp.sh              # JPP workflow
bash scripts/seed-agents.sh           # AI agent outputs
bash scripts/seed-governance.sh       # Governance gates
bash scripts/seed-assessment.sh       # AARs and METL
# bash scripts/seed-inheritance.sh    # Inheritance (if available)
```

---

## 5. Quick Reference Card

Print this page for use during live demos.

| Station | Tab | URL Path | Key Action | Presenter Talking Point |
|---------|-----|----------|------------|------------------------|
| 1 | Login | `/` | Log in, see problem set list | "BASTION organizes work into problem sets" |
| 2 | List | `/problem-sets` | Click INDOPACOM -> CJTF -> Strike Alpha | "Mirrors real command structure" |
| 3 | -- | (current PS) | Toggle training -> operational -> training | "Train as you fight" |
| 4 | COP | `/problem-set/DEMO-PS-indopacom-theater` COP | Show unit markers, SIDC symbols | "13 command units, real designations" |
| 5 | Understand | `/problem-set/DEMO-PS-indopacom-theater` Understand | Click China node in RAFT graph | "17 actors, 27 relationships, AI entity resolution" |
| 6 | Understand | (same) | Show OSINT events, click event | "29 events, validity scoring, trend analysis" |
| 7 | Documents | (within PS) | Click document, show extraction | "PDF to intelligence in minutes" |
| 8 | Design | `/problem-set/DEMO-PS-indopacom-theater` Design | Show 4 design sections | "JP 5-0 operational design in software" |
| 9 | AI Staff | (within PS) | Click agent outputs | "19 AI agents, virtual staff officers" |
| 10 | Plan | `/problem-set/DEMO-PS-cjtf-westpac` Plan | Click through JPP steps 1-4 | "7-step Joint Planning Process" |
| 11 | Direct | `/problem-set/DEMO-PS-indopacom-theater` Direct | Show FRAGO-001 propagation | "FRAGO propagates instantly to all levels" |
| 12 | Governance | (within PS) | Click approved gate, show blockchain tx | "Every decision on blockchain" |
| 13 | Assess | `/problem-set/DEMO-PS-cjtf-westpac` Assess | Show AARs, METL ratings | "Close the loop: assess and learn" |

**Seed command:** `bash scripts/seed-demo.sh --reset`
**Cleanup command:** `bash scripts/seed-demo.sh --clean`
**Total demo time:** 25-35 minutes

---

*Companion document: See [BRIEFING-SCRIPT.md](BRIEFING-SCRIPT.md) for presenter talking points, timing, and audience adaptation notes.*
