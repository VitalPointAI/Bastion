# BASTION User Validation Sequence: Phases 1 through 5.2

**Purpose:** Systematic walkthrough to verify all completed phases are working and integrated properly, from infrastructure through end of operational planning.

**Last Updated:** 2026-02-15

---

## Prerequisites

### Start the Stack
```bash
# Terminal 1: Start infrastructure
docker-compose up -d postgres neo4j

# Terminal 2: Start backend (wait for postgres/neo4j healthy)
cd backend && pnpm dev

# Terminal 3: Start frontend
cd frontend && pnpm dev
```

### Verify Services Running
```bash
# Health check
curl http://localhost:3001/health
# Expected: { "status": "healthy", "timestamp": "..." }

# Neo4j browser available at http://localhost:7474
# Frontend at http://localhost:5173
```

### Backend Startup Checklist
Watch backend logs for these initialization messages (all should appear without errors):
- [ ] `Backend listening on port 3001`
- [ ] `Message bus initialized`
- [ ] `LangGraph checkpointer initialized`
- [ ] `Execution tracer initialized`
- [ ] `Human checkpoint manager initialized`
- [ ] `LangGraph agents seeded`
- [ ] `RAFT schema initialized` (or similar Neo4j message)

---

## Skipped Phases

| Phase | Status | Impact on Validation |
|-------|--------|---------------------|
| **1.1 Calimero Self-Sovereign App** | Skipped (research only) | None — Privy replaced by passkeys in 1.2 instead |
| **4.5 ATAK/CoT Tactical Interoperability** | Not started | No validation needed |

---

## SEQUENCE 1: Foundation & Authentication (Phase 1, 1.2, 1.3)

### 1.1 — Registration Flow
1. Navigate to `http://localhost:5173/register`
2. Enter an email address and submit
3. **Verify:** Registration page renders with passkey setup prompt
4. **Verify:** If PRF-capable browser (Chrome): passkey creation dialog appears
5. **Verify:** Backend logs show user creation, MPC account derivation, and NEAR implicit account generation
6. **Verify:** Backend logs show funding attempt (or graceful skip if funding contract not deployed)
7. **Verify:** No Privy references anywhere in the flow

**Pass criteria:** User account created with passkey, NEAR implicit account (64-char hex), session established

### 1.2 — Magic Link Fallback
1. Navigate to `/login`
2. Click "Use magic link instead" (or equivalent fallback)
3. **Verify:** Email input appears
4. **Verify:** Backend logs show magic link token generated (dev mode: URL printed to console)
5. Navigate to the magic link URL
6. **Verify:** `/auth/verify` page processes token and establishes session

**Pass criteria:** Authentication works without passkey via magic link

### 1.3 — Session Persistence & User Status
1. After login, verify redirect to main app (`/`)
2. **Verify:** UserStatusBar in header shows:
   - User email or account identifier
   - NEAR account ID (64-char hex or truncated)
   - DID status
3. Refresh the page
4. **Verify:** Session persists (no re-login required)

**Pass criteria:** Authenticated state visible and persistent across page loads

### 1.4 — Backend Health & Infrastructure
```bash
# PostgreSQL connectivity
curl http://localhost:3001/health

# IPFS/Pinata (may 403 if not configured — known ISS-002)
# Just verify the endpoint exists
curl http://localhost:3001/api/documents

# Edge sync endpoint exists
curl http://localhost:3001/api/edge/status
```

**Pass criteria:** Health endpoint returns 200, other endpoints return structured responses (even if empty)

---

## SEQUENCE 2: Identity & Security (Phase 2)

### 2.1 — DID Creation & Resolution
1. After login, check backend logs for DID creation
2. **Verify via API:**
```bash
# Resolve user's DID (replace with actual DID from UserStatusBar)
curl http://localhost:3001/api/identity/resolve?did=did:near:testnet:<account>
```
3. **Verify:** DID document returned with encrypted fields (blinded keys)

**Pass criteria:** DID created on registration, resolvable via API

### 2.2 — Credential System
```bash
# List credential types
curl http://localhost:3001/api/credentials/types

# Issue a test credential (if admin)
curl -X POST http://localhost:3001/api/credentials \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{"type": "RoleAssignment", "subject": "<did>", "claims": {"role": "commander"}}'
```

**Pass criteria:** Credential endpoints respond, credential types enumerable

### 2.3 — ABAC Policy Engine
```bash
# The zero trust middleware should be active on protected endpoints
# Try accessing a protected endpoint without DID header
curl http://localhost:3001/api/dao
# Expected: Should still respond (middleware may allow through in dev)

# Try with X-DID header
curl http://localhost:3001/api/dao -H "X-DID: did:near:testnet:test"
```

**Pass criteria:** ABAC middleware is mounted and processing requests (check backend logs for access evaluation)

---

## SEQUENCE 3: DAO Governance (Phase 3)

### 3.1 — Governance Dashboard
1. Click **Governance** nav button in the app
2. **Verify:** DAODashboard component renders with:
   - DAO list (may be empty initially)
   - Action Required section
   - Proposal list with filter tabs (All, Active, Action Required, My Votes)
   - MDMP Workflow toggle button (added by Phase 5.1)
3. **Verify:** No console errors

### 3.2 — DAO Creation via API
```bash
# Create a test DAO
curl -X POST http://localhost:3001/api/dao \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{
    "name": "Test Coalition DAO",
    "classification": "UNCLASS",
    "purpose": "Validation testing"
  }'
```
1. After creation, refresh Governance dashboard
2. **Verify:** New DAO appears in the list
3. **Verify:** Default roles created (council, member, agent)

### 3.3 — Proposal & Voting Flow
```bash
# Create a proposal
curl -X POST http://localhost:3001/api/dao/<dao-id>/proposals \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{
    "kind": "Transfer",
    "description": "Test proposal for validation",
    "amount": "1000000000000000000000000"
  }'
```
1. In Governance dashboard, click the DAO
2. **Verify:** Proposal appears in proposal list
3. Click proposal to view detail
4. **Verify:** ProposalDetail component renders with:
   - Proposal metadata
   - Classification badge
   - VotingInterface with Approve/Reject buttons
5. **Verify:** CopilotPanel shows analysis (rule-based for v1)

### 3.4 — Governance Copilot
1. With a proposal selected, look for the Copilot panel
2. **Verify:** Analysis summary appears (rule-based, not LLM)
3. **Verify:** For non-StrikeAuthorization proposals, voting guidance is shown
4. **Verify:** StrikeAuthorization proposals show "No AI recommendation" safety message

**Pass criteria:** Full DAO lifecycle works — create DAO, create proposal, view details, copilot analysis renders

---

## SEQUENCE 4: Strategic Planning (Phase 4, 4.1, 4.2, 4.3)

### 4.1 — Admin Dashboard
1. Click **Admin** nav button
2. **Verify:** AdminDashboard renders with tabs:
   - System Config (LLM providers, API keys)
   - Agents (agent management)
   - Funding (NEAR account funding panel — Phase 1.3)
3. **Verify:** Orange accent color differentiates from operational blue UI

### 4.2 — LLM Provider Configuration
1. In Admin > System Config tab
2. **Verify:** Can configure LLM providers (Anthropic, OpenAI, NEAR AI, Ollama)
3. **Verify:** API keys are masked (last 4 chars visible)
4. Set up at least one provider with a valid API key for AI features

### 4.3 — Agent Management
1. In Admin > Agents tab
2. **Verify:** Pre-seeded agents visible (strategy-document-reviewer, etc.)
3. **Verify:** Each agent shows:
   - Name, description, capabilities
   - DID assignment
   - Model configuration (provider/model or "Use Global Default")
4. **Verify:** Agent Builder wizard accessible:
   - Create Agent form with personality fields (bio, lore, knowledge)
   - JSON file upload with drag-drop
5. **Verify:** MCP Tool registry visible with registered tools
6. **Verify:** Agent Team composition panel accessible

### 4.4 — Strategic Document Upload
1. Click **Strategic** nav button
2. **Verify:** StrategicDashboard renders with:
   - Document upload area (DocumentUpload component)
   - Document list (initially empty)
3. Upload a test document (PDF or DOCX, ideally a strategy document)
4. **Verify:** Upload progress indicator
5. **Verify:** Document appears in DocumentList after upload
6. **Verify:** Document metadata visible (name, type, size, upload date)

### 4.5 — LLM Objective Extraction
1. Select an uploaded document
2. Click "Extract Objectives" (or similar trigger)
3. **Verify:** SSE streaming progress shows extraction status
4. **Verify:** After extraction completes, ObjectiveList populates
5. Click an objective
6. **Verify:** ObjectiveDetail component renders with tabs:
   - Overview (description, priority, source document)
   - DIME/MIDLIFE (category selector with visual legend)
   - EWM (Ends/Ways/Means commander editing)
   - Risks (risk assessment with 5x5 matrix)
7. **Verify:** MIDLIFE category selector works (Military, Intelligence, Diplomatic, etc.)

### 4.6 — Strategic Analysis Agents
1. Look for Review Panel on a document with extracted objectives
2. **Verify:** Agent badges show assigned agents
3. **Verify:** ReviewReport component shows analysis results
4. **Verify:** Agent assignment modal allows assigning agents to documents

### 4.7 — Validity Dashboard & Intelligence Fusion (Phase 4.3)
1. Click **Validity** nav button
2. **Verify:** StrategicValidityDashboard renders with:
   - Map view (ValidityMap with Stadia dark tiles)
   - Graph view (react-force-graph-2d)
   - Split view toggle
3. **Verify:** Map loads without errors (Leaflet + Stadia tiles)
4. **Verify:** Graph visualization renders (may be empty without data)
5. **Verify:** View mode toggle works (Map / Graph / Split)

### 4.8 — RAFT Graph (Phase 4.3)
```bash
# Check Neo4j graph schema
curl http://localhost:3001/api/graph/workspaces

# Create a test workspace
curl -X POST http://localhost:3001/api/graph/workspaces \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{"name": "Test Workspace", "type": "region", "classification": "UNCLASS"}'
```
1. **Verify:** Workspace CRUD works
2. **Verify:** Graph actors, relationships, tensions endpoints respond:
```bash
curl http://localhost:3001/api/graph/workspaces/<id>/actors
curl http://localhost:3001/api/graph/workspaces/<id>/relationships
curl http://localhost:3001/api/graph/workspaces/<id>/tensions
```
3. **Verify:** Graph algorithms return results (after 4.3-12):
```bash
# Eigenvector centrality (power iteration)
curl -X POST http://localhost:3001/api/graph/algorithms \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "eigenvector_centrality", "limit": 10}'

# PageRank (iterative, not degree count)
curl -X POST http://localhost:3001/api/graph/algorithms \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "pagerank", "limit": 10}'

# Cross-centrality comparison (divergence detection)
curl http://localhost:3001/api/graph/centrality-comparison?limit=10
```
4. **Verify:** Centrality comparison surfaces actors where eigenvector and PageRank rankings diverge

**Pass criteria:** Full strategic pipeline works — upload doc, extract objectives, view details, validity map renders, RAFT graph API functional, centrality algorithms return ranked results

---

## SEQUENCE 5: Mission Context & Force Onboarding (Phase 4.4)

> Phase 4.4 complete (9/9 plans, 2026-01-24 to 2026-01-25). Full backend and frontend implementation.

### 5.1 — Mission List
1. Click **Missions** nav button
2. **Verify:** MissionList component renders
3. **Verify:** "Create Mission" button visible

### 5.2 — Mission Creation Wizard
1. Click "Create Mission"
2. **Verify:** MissionWizard renders with multi-step progression:
   - Mission details (name, type, classification)
   - Area of Operations map (react-leaflet-draw polygon)
   - Participant invitation
3. **Verify:** Map loads with Stadia dark tiles
4. **Verify:** AO polygon drawing works (single polygon constraint)
5. Draw an AO, fill in mission details, submit
6. **Verify:** Mission created and appears in MissionList

### 5.3 — Mission Detail View
1. Click a mission from the list
2. **Verify:** MissionDetail component renders
3. **Verify:** Participant list shows invited members
4. **Verify:** Role badges visible: commander (gold), staff (blue), observer (gray)

### 5.4 — Backend Mission APIs
```bash
# Mission CRUD
curl http://localhost:3001/api/missions

# Command relationships
curl http://localhost:3001/api/command

# Resources
curl http://localhost:3001/api/resources

# Sensors
curl http://localhost:3001/api/sensors
```

### 5.5 — Command Relationships
1. **Verify:** Command relationship hierarchy API works
2. **Verify:** Supports doctrine relationship types: COCOM, OPCON, TACON, ADCON, DS, GS, GSR, R
3. **Verify:** Cycle prevention via DFS validation
4. If UI exists: tree view for hierarchy, matrix view for relationships

### 5.6 — Resource Catalog
```bash
# Create a resource
curl -X POST http://localhost:3001/api/resources \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{
    "name": "M1A2 Abrams",
    "category": "equipment",
    "status": "FMC",
    "quantity": 4
  }'
```
1. **Verify:** Resource status supports FMC/PMC/NMC military readiness values
2. If UI exists: category sidebar, equipment tabs, personnel table, consumable cards

### 5.7 — Sensor Registration & Map
```bash
# Register a sensor
curl -X POST http://localhost:3001/api/sensors \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{
    "name": "UAV-01 EO/IR",
    "category": "airborne",
    "status": "operational",
    "location": {"lat": 34.05, "lng": -118.25},
    "coverageRadius": 5000
  }'
```
1. **Verify:** 9 sensor API endpoints work (CRUD, status-only, location-only, coverage)
2. **Verify:** Sensor categories supported: airborne, ground, maritime, space, autonomous
3. If map UI exists: sensor coverage as Leaflet circles with category-based colors
4. **Verify:** Coverage opacity reflects status (operational=0.3, degraded=0.2, offline=0.1)

**Pass criteria:** Mission lifecycle works (create, list, detail), command relationships enforced, resources and sensors CRUD functional, map overlays render

---

## SEQUENCE 6: Operational Planning (Phase 5)

### 6.1 — Planning Dashboard Access
The PlanningDashboard is embedded within the Governance view (DAODashboard).
1. Navigate to **Governance**
2. Look for planning-related access (it may be integrated into the main flow, or accessible via a plan list)

Alternatively, test the planning API directly:
```bash
curl http://localhost:3001/api/planning/plans
```

### 6.2 — Create Operational Plan
```bash
curl -X POST http://localhost:3001/api/planning/plans \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{
    "name": "Operation BASTION FORGE",
    "type": "OPLAN",
    "classification": "UNCLASS",
    "missionId": "<mission-id-if-available>"
  }'
```
1. **Verify:** Plan created with UUID
2. **Verify:** JP 5-0 workflow initialized (8 steps, starting at planning_initiation)

### 6.3 — JP 5-0 Step Navigator
1. In the Planning Dashboard UI, select the plan
2. **Verify:** StepNavigator shows 8 JP 5-0 steps:
   - Planning Initiation
   - Mission Analysis
   - COA Development
   - COA Analysis (Wargaming)
   - COA Comparison
   - COA Approval (commander checkpoint)
   - Plan Development
   - Plan Approval (commander checkpoint)
3. **Verify:** Steps show color-coded status badges
4. **Verify:** Checkpoint steps (COA Approval, Plan Approval) highlighted differently

### 6.4 — COA Development
```bash
# Create a COA
curl -X POST http://localhost:3001/api/planning/plans/<plan-id>/coas \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{
    "name": "COA 1 - Direct Approach",
    "description": "Rapid decisive operations focused on key terrain"
  }'

# Create at least 3 COAs (doctrinal minimum)
```
1. **Verify:** COAs appear in COAList component
2. **Verify:** COAEditor allows editing COA details
3. **Verify:** COACard displays COA summary with status

### 6.5 — ROE Enforcement
```bash
# Check ROE for a tactical action
curl -X POST http://localhost:3001/api/planning/plans/<plan-id>/roe/check \
  -H "Content-Type: application/json" \
  -H "X-DID: <your-did>" \
  -d '{
    "actionType": "kinetic_strike",
    "targetType": "military_vehicle",
    "civilianProximity": false,
    "urbanArea": false
  }'
```
1. **Verify:** ROE check returns pass/fail with rule details
2. In ROEPanel UI, **verify:** Violations displayed with severity badges (critical/major/minor)
3. **Verify:** Commander override requires 10+ character justification

### 6.6 — Document Generation
```bash
# Generate OPORD
curl http://localhost:3001/api/planning/plans/<plan-id>/documents/opord?format=docx \
  --output test-opord.docx

# Generate briefing slides
curl http://localhost:3001/api/planning/plans/<plan-id>/documents/brief?type=commander \
  --output test-brief.pptx
```
1. **Verify:** DOCX file generates with 5-paragraph OPORD structure
2. **Verify:** PPTX file generates with classification banners
3. In DocumentExport UI panel, **verify:** Export buttons for DOCX, PDF, PPTX

### 6.7 — Approval Workflow
1. In ApprovalPanel, **verify:** COA Approval checkpoint visible
2. **Verify:** Approve/Reject/Revise actions available
3. **Verify:** Approval creates a governance proposal (DAO integration)

### 6.8 — Collaboration Infrastructure
```bash
# Verify WebSocket collaboration server
# Backend logs should show: "Collaboration WebSocket server mounted at /ws/collab"
```
**Verify:** Yjs collaboration endpoint exists at ws://localhost:3001/ws/collab

**Pass criteria:** Complete JP 5-0 workflow navigable, COAs created, ROE checked, documents generated, approval workflow functional

---

## SEQUENCE 7: MDMP Governance (Phase 5.1)

### 7.1 — MDMP Governance Panel
1. In **Governance** view, click "MDMP Workflow" toggle
2. **Verify:** MDMPGovernancePanel renders with:
   - PhaseProgressionBar showing MDMP phases (0-VIII)
   - GovernanceGateDashboard with gate status indicators
   - AssumptionTracker
   - CommanderGuidanceForm

### 7.2 — Phase Progression
1. **Verify:** PhaseProgressionBar shows all MDMP phases:
   - Phase 0: Planning Initiation (continuous)
   - Phase 1: Receipt of Mission
   - Phase 2: Mission Analysis
   - Phase 3: COA Development
   - Phase 4: COA Analysis (Wargaming)
   - Phase 5: COA Comparison
   - Phase 6: COA Approval
   - Phase 7: Orders Production
   - Phase 8: Transition/Assessment
2. **Verify:** Phases are clickable for navigation
3. **Verify:** Phase transition requires gate satisfaction

### 7.3 — Governance Gates
1. In GovernanceGateDashboard, **verify:** 18 gates visible across phases
2. **Verify:** Gate types shown:
   - PhaseTransition gates
   - ProductApproval gates
   - AuthorityCheckpoint gates
   - RedTeamGate
   - CoalitionGate
   - AssumptionGate
3. **Verify:** Gates show satisfied/unsatisfied status

### 7.4 — Assumption Tracking
1. In AssumptionTracker, **verify:** Assumption list renders
2. **Verify:** Assumption lifecycle states: Pending → Accepted → Invalidated
3. **Verify:** Sensitivity levels displayed with color coding:
   - Critical = red, High = orange, Medium = yellow, Low = green
4. **Verify:** Invalidating a critical assumption triggers replanning gate

### 7.5 — Commander Guidance
1. In CommanderGuidanceForm, **verify:** Form renders
2. **Verify:** Guidance preview shows exact proposal structure
3. **Verify:** Submission creates CommanderGuidance proposal in DAO

### 7.6 — MDMP Activity Registry
```bash
# List all MDMP activities
curl http://localhost:3001/api/mdmp/activities

# Get activities by phase
curl http://localhost:3001/api/mdmp/activities?phase=2
```
1. **Verify:** 65 activities returned across all phases
2. **Verify:** Each activity has category, authority level, phase assignment

### 7.7 — Safety Matrix Enforcement
```bash
# Test safety matrix validation
curl http://localhost:3001/api/mdmp/safety/validate \
  -H "Content-Type: application/json" \
  -d '{
    "activityCategory": "AUTHORITY_DECISION",
    "requestedAutonomy": "AI_AUTONOMOUS"
  }'
# Expected: REJECTED (AUTHORITY_DECISION requires HUMAN_ONLY)

curl http://localhost:3001/api/mdmp/safety/validate \
  -H "Content-Type: application/json" \
  -d '{
    "activityCategory": "DATA_AGGREGATION",
    "requestedAutonomy": "AI_AUTONOMOUS"
  }'
# Expected: ALLOWED (DATA_AGGREGATION permits full delegation)
```

### 7.8 — Decision Brief (Phase 5.1 Plan 15)
1. In Governance view, look for DecisionBriefView component
2. **Verify:** COA comparison matrix with weighted scoring renders:
   - Suitability (30%), Feasibility (25%), Acceptability (25%)
   - Distinguishability (10%), Completeness (10%)
3. **Verify:** Risk matrix (5x5) displays
4. **Verify:** Commander decision actions: Approve, Revise, Reject
5. **Verify:** Confidence intervals shown on all scores (INVARIANT 5)

### 7.9 — MDMP AI Agents (6 agents)
```bash
# List registered agents - look for MDMP agents
curl http://localhost:3001/api/agents
```
**Verify** these agents are registered:
- [ ] Assumption Auditor
- [ ] Orders Validator
- [ ] Uncertainty Quantifier
- [ ] Data Bias Detector
- [ ] Problem Framing
- [ ] ROE Compliance

**Pass criteria:** MDMP governance layer functional — phases navigable, gates enforced, assumptions tracked, safety matrix validates, decision brief renders, all 6 agents registered

---

## SEQUENCE 8: Escalation & Competition Modeling (Phase 5.2)

### 8.1 — Phase 5.2 AI Agents
```bash
# List registered agents - look for Phase 5.2 agents
curl http://localhost:3001/api/agents
```
**Verify** these agents are registered:
- [ ] Adversary Modeler
- [ ] Effect Cascader
- [ ] Escalation Modeler
- [ ] Deception Detector

### 8.2 — Wargaming Framework
```bash
# Check wargaming endpoints
curl http://localhost:3001/api/planning/plans/<plan-id>/wargaming
```
**Verify:** Wargaming framework returns action-reaction-counteraction structure

### 8.3 — Escalation Visualization
1. Look for EscalationLadder component in the planning interface
2. **Verify:** Escalation ladder UI renders with:
   - Escalation levels/rungs
   - Current position indicator
   - Escalation dynamics visualization

### 8.4 — Effect Chain Diagram
1. Look for EffectChainDiagram component
2. **Verify:** Effect cascading visualization renders
3. **Verify:** Shows second/third-order effects across DIME domains

### 8.5 — Force Ratio Analysis
1. In planning interface, look for ForceRatioDisplay component
2. **Verify:** Renders with:
   - Side-by-side force comparison bars
   - Correlation of forces methodology (not simple headcount)
   - Combat power modifiers display
   - Assessment tier: favorable/marginal/unfavorable

### 8.6 — COA Sketch Map
1. Look for COASketchMap component
2. **Verify:** Map-based COA visualization with operational graphics overlay

### 8.7 — Branch & Sequel Planning
1. Look for BranchSequelTimeline component
2. **Verify:** Timeline renders with:
   - Decision point diamond markers
   - Branch plans at decision points
   - Progressive disclosure (inline expand + side panel)
   - Coverage gap highlighting

### 8.8 — Sustainment Modeling
1. Look for SustainmentDisplay component
2. **Verify:** Renders with:
   - Resource burndown charts
   - Three-level risk system (green/amber/red)
   - Five resource categories (ammo, fuel, food/water, medical, maintenance)
   - Feasibility classification per COA

**Pass criteria:** All 4 agents registered, wargaming framework enhanced, all 6 visualization components render, force ratio and sustainment analysis functional

---

## SEQUENCE 9: Cross-Phase Integration Checks

These verify that phases connect properly and data flows between them.

### 9.1 — Strategic → Operational Handoff
1. Create a strategic objective (via document extraction)
2. Create an operational plan
3. **Verify:** The operational plan can reference strategic objectives
4. **Verify:** Planning directive from Phase 4 can inform Phase 5 planning

### 9.2 — DAO ↔ Planning Integration
1. Create a COA in an operational plan
2. Navigate to COA Approval step
3. **Verify:** Approval action creates a DAO proposal
4. In Governance view, **verify:** The proposal appears with correct type
5. **Verify:** Voting on the proposal affects planning workflow state

### 9.3 — MDMP ↔ DAO Integration
1. In MDMP Governance panel, trigger a phase transition
2. **Verify:** Phase transition creates a PhaseTransition proposal in DAO
3. **Verify:** Gate satisfaction actions create corresponding DAO proposals
4. **Verify:** Commander guidance creates CommanderGuidance proposal

### 9.4 — Agent Registration Across Phases
```bash
# Full agent inventory check
curl http://localhost:3001/api/agents | python3 -m json.tool | grep -c '"agentId"'
```
Expected agent count from completed phases:
- Phase 3: 4 agents (governance-copilot, proposal-screener, context-analyzer, feasibility-assessor)
- Phase 4: Strategy Document Review Agent + LangGraph agents
- Phase 4.3: 7 agents (Strategic Fusion, Entity Resolution, Conflict Detection, OSINT Monitor, Validity Assessment, RAFT Extraction, RAFT Reasoning)
- Phase 5: 3 agents (COA Generator, Red Team Simulator, COA Comparator)
- Phase 5.1: 6 agents (Assumption Auditor, Orders Validator, Uncertainty Quantifier, Data Bias Detector, Problem Framing, ROE Compliance)
- Phase 5.2: 4 agents (Adversary Modeler, Effect Cascader, Escalation Modeler, Deception Detector)
- **Total: ~24+ agents**

### 9.5 — Message Bus Connectivity
```bash
# Verify message bus is operational
curl http://localhost:3001/api/messages/channels
```
**Verify:** System channels exist for lifecycle/workflow/security events

### 9.6 — WebSocket Endpoints
Three WebSocket servers should be running:
1. `/ws/messages` — Real-time message delivery (Phase 4.2)
2. `/ws/orchestration` — Agent execution streaming (Phase 4.2)
3. `/ws/collab` — Yjs collaboration sync (Phase 5)

### 9.7 — Identity Threading
1. All API calls should accept and process X-DID header
2. **Verify:** Agent operations include agent DIDs
3. **Verify:** DAO proposals track proposer DID
4. **Verify:** Approval workflows record approver DID

---

## SEQUENCE 10: UI Navigation Completeness

Verify all nav buttons work and render their views without errors.

| Nav Button | Component | Expected Content |
|-----------|-----------|-----------------|
| Home | AppContent | Welcome message, LoginButton |
| Governance | DAODashboard | DAO list, proposals, MDMP workflow toggle |
| Strategic | StrategicDashboard | Document upload, document list, objective extraction |
| Validity | StrategicValidityDashboard | Map/Graph/Split views, RAFT visualization |
| Missions | MissionList | Mission list (possibly empty), Create button |
| Admin | AdminDashboard | System Config, Agents, Funding tabs |

For each:
- [ ] Component renders without console errors
- [ ] Data loads (or shows empty state gracefully)
- [ ] Styling is consistent (military theme, classification badges)
- [ ] Navigation between views preserves state where appropriate

---

## Summary Scorecard

| Area | Sequences | Status |
|------|-----------|--------|
| Authentication & Infrastructure | 1.1–1.4 | |
| Identity & Security | 2.1–2.3 | |
| DAO Governance | 3.1–3.4 | |
| Strategic Planning & Admin | 4.1–4.8 | |
| Mission Context & Force Onboarding | 5.1–5.7 | |
| Operational Planning | 6.1–6.8 | |
| MDMP Governance | 7.1–7.9 | |
| Escalation & Competition | 8.1–8.8 | |
| Cross-Phase Integration | 9.1–9.7 | |
| UI Navigation | 10 | |

### Critical Safety Invariants to Verify

These are non-negotiable system behaviors:

- [ ] **INV-1:** StrikeAuthorization proposals ALWAYS require human approval (never autonomous)
- [ ] **INV-2:** Phase transitions blocked when gates unsatisfied
- [ ] **INV-3:** Assumption invalidation tracked with sensitivity levels
- [ ] **INV-4:** Safety matrix prevents AUTHORITY_DECISION/ETHICAL_LEGAL/RISK_JUDGMENT from AI autonomy
- [ ] **INV-5:** All AI outputs include confidence intervals and uncertainty characterization
- [ ] **INV-6:** Critical assumption invalidation triggers replanning gate
- [ ] **INV-7:** Governance copilot never recommends on StrikeAuthorization
- [ ] **INV-8:** ROE override requires commander authority + justification
- [ ] **INV-9:** All lethal decisions have blockchain audit trail
