# Workflow Screenshots Specification

This document specifies the screenshots required for the BASTION whitepaper, including capture instructions, annotation guidelines, and figure captions. Screenshots should be captured from the running system during demonstration preparation.

## Required Screenshots

### Screenshot 1: Strategic Planning Dashboard

**File:** `screenshots/01-strategic-dashboard.png`

**Purpose:** Demonstrate the strategic objective input workflow with human-in-the-loop approval.

**Shows:**
- Document list sidebar with uploaded strategic guidance documents
- Selected document details panel
- AI-extracted objectives display
- Human review and approval controls

**Key Annotations:**
1. Document upload area (drag-drop zone or file selector)
2. Extracted objectives panel showing AI-identified objectives from document
3. Human review/edit controls (approve, reject, modify buttons)
4. DAO proposal submission button for approved objectives
5. Classification badge indicating document security level

**Capture State:**
- At least one document uploaded and selected
- Multiple objectives extracted and visible
- One objective in review state showing edit capability
- Approval workflow controls visible

**Caption:** "Figure 2: Strategic Planning Dashboard showing document ingestion, AI-extracted objectives, and human review workflow. Annotations indicate: (1) document upload area, (2) extracted objectives panel, (3) human review controls, (4) DAO proposal submission, (5) classification indicator."

---

### Screenshot 2: DAO Governance Interface

**File:** `screenshots/02-dao-governance.png`

**Purpose:** Demonstrate coalition voting on resource allocation proposals with transparent governance.

**Shows:**
- Active proposals list
- Proposal detail view with voting interface
- Coalition member voting status
- Approval threshold progress indicator

**Key Annotations:**
1. Active proposals list with status indicators
2. Proposal detail showing resource allocation request
3. Voting buttons (approve/reject) for current user
4. Coalition member votes displayed with weights
5. Approval threshold progress bar showing votes toward required threshold
6. Voting weight distribution across coalition members

**Capture State:**
- At least two proposals visible (one pending, one complete)
- Detailed view of a resource allocation proposal
- Multiple coalition member votes visible
- Progress bar showing partial completion toward threshold

**Caption:** "Figure 3: DAO Governance Interface displaying coalition voting on resource allocation proposal. Annotations indicate: (1) proposal list, (2) proposal details, (3) voting controls, (4) member votes with weights, (5) approval threshold progress, (6) weight distribution."

---

### Screenshot 3: Operational Coordination View

**File:** `screenshots/03-operational-coordination.png`

**Purpose:** Demonstrate AI agent orchestration with human-on-the-loop monitoring and override capability.

**Shows:**
- AI agent activity feed
- Resource-to-objective mapping visualization
- Human override controls
- Risk assessment indicators

**Key Annotations:**
1. AI agent status panel showing active agents and current tasks
2. Resource mapping showing assets allocated to objectives
3. Human override button prominently visible (on-the-loop control)
4. Risk indicators (color-coded by severity level)
5. Commander's intent summary for active mission
6. Agent reasoning log showing decision rationale

**Capture State:**
- Multiple AI agents shown as active
- At least one objective with mapped resources
- Risk assessment visible with multiple risk items
- Override controls clearly accessible

**Caption:** "Figure 4: Operational Coordination View showing AI agent orchestration with human monitoring controls. Annotations indicate: (1) agent status, (2) resource mapping, (3) human override button, (4) risk indicators, (5) commander's intent, (6) agent reasoning log."

---

### Screenshot 4: Tactical Execution Display

**File:** `screenshots/04-tactical-execution.png`

**Purpose:** Demonstrate autonomous asset coordination within policy bounds at the tactical level.

**Shows:**
- Map overlay with area of operations
- Asset positions and movement paths
- Target identification results
- Policy constraint indicators

**Key Annotations:**
1. Map overlay showing demonstration AO boundaries
2. Asset position markers (Sphero RVR+ location)
3. Target identification boxes with classification labels
4. Policy constraint panel showing active restrictions
5. Mission status indicator
6. Strike authorization gate (human approval required indicator)

**Capture State:**
- Map view with visible AO boundaries
- At least one asset position marked
- Target identification overlay active
- Policy constraints visible
- Mission in execution or pending state

**Caption:** "Figure 5: Tactical Execution Display showing autonomous asset coordination within policy bounds. Annotations indicate: (1) area of operations, (2) asset positions, (3) target identification, (4) policy constraints, (5) mission status, (6) strike authorization gate."

---

## Physical Demonstration Photo

### Photo 1: Physical Demonstration Setup

**File:** `photos/06-physical-demo-setup.jpg`

**Purpose:** Show the complete physical demonstration environment connecting virtual governance with tangible hardware.

**Shows:**
- NVIDIA Jetson Orin Nano Super computing platform
- Sphero RVR+ mobile robot chassis
- Physical Area of Operations model (tabletop terrain)
- Laptop or monitor showing BASTION interface
- Network connectivity between components

**Key Annotations:**
1. Jetson Orin Nano (edge AI processing)
2. Sphero RVR+ (mobile autonomous platform)
3. Physical AO model with terrain features
4. Target markers in demonstration area
5. BASTION dashboard on display
6. Network/communication links (labeled)

**Caption:** "Figure 6: Physical demonstration setup showing Jetson Orin Nano edge computing platform, Sphero RVR+ mobile robot, and physical area of operations model. The demonstration validates BASTION's architecture by connecting DAO governance with tangible autonomous execution."

---

### Screenshot 7: Understand Tab — Brain Visualization with Document Intelligence Pipeline

**File:** `screenshots/07-understand-brain-visualization.png`

**Purpose:** Demonstrate the adaptive brain visualization centerpiece and the autonomous document intelligence team pipeline feeding it.

**Shows:**
- Three-column layout: ingestion sidebar (left), brain neural canvas (center), detail panel (right)
- Brain canvas with shape-coded nodes: circles for entities, diamonds for objectives, squares for documents, hexagons for concepts
- Nodes colored by actor category: ally=blue, adversary=red, neutral=gray, partner=green
- Confidence-based glow: bright glow on high-confidence nodes, dim on low-confidence, dashed outline for intelligence gaps
- Ingestion sidebar showing the autonomous document intelligence team processing a PDF with SSE particle animation flowing from sidebar into brain
- Right panel open on a selected "People's Liberation Army" adversary node showing: identity card, confidence 0.78 (NATO B-2 rating), connected relations, source documents

**Key Annotations:**
1. Brain canvas: force-directed neural graph with visible clustering (container mode)
2. Shape-coded nodes visible: entity circles (PLA, ROC, USS Ronald Reagan), objective diamonds, document squares
3. Ingestion sidebar: "Processing: INDOPACOM Campaign Plan 2026" with ExtractionTheater live activity feed
4. NATO rating badge: "B-2" (Usually Reliable / Probably True) on selected entity
5. Intelligence gap indicator: hollow/dashed node labeled "PLA Southern Theater Command (unverified)"
6. BrainToolbar: clustering mode toggle showing "Container" active, search bar, timeline scrubber at current date

**Capture State:**
- Problem set: Pacific Strategy AY26, Taiwan contingency phase
- Brain showing 40-60 nodes in container clustering mode
- At least one adversary entity selected with detail panel open
- Ingestion sidebar showing 2-3 documents being processed
- Brain timeline scrubber visible at bottom

**Caption:** "Figure 7: Understand Tab showing the adaptive brain visualization centerpiece with document intelligence pipeline. The neural graph canvas visualizes 50+ strategic environment entities with shape-coding, confidence glow, and NATO source reliability ratings. Annotations indicate: (1) neural brain canvas in container clustering mode, (2) shape-coded and category-colored nodes, (3) ExtractionTheater ingestion sidebar, (4) NATO B-2 reliability rating on selected entity, (5) intelligence gap indicator (dashed/hollow), (6) BrainToolbar with clustering, search, and timeline controls."

---

### Screenshot 8: Design Tab — Center of Gravity Analysis and Lines of Effort

**File:** `screenshots/08-design-tab-cog-analysis.png`

**Purpose:** Demonstrate the operational design workspace with Strange's CoG framework and lines of effort definition.

**Shows:**
- Design tab active in the Understand/Design/Plan/Decide/COP/Assess tab bar
- Center of Gravity (CoG) analysis panel with dual-pane layout: Friendly CoG (left), Adversary CoG (right)
- Each CoG pane showing: CoG identification, Critical Capabilities (CC) list, Critical Requirements (CR) list, Critical Vulnerabilities (CV) list
- Lines of Effort canvas below: horizontal swim-lane view with LOE titles, linked objectives, and decisive points
- AI Design Assistant sidebar with recommendation cards and "Challenge Assumption" button active

**Key Annotations:**
1. CoG analysis panel: Strange's CC-CR-CV framework for both Friendly (blue) and Adversary (red) forces
2. Adversary CoG: "PLA Power Projection Capability" with 3 Critical Capabilities and 2 Critical Vulnerabilities highlighted
3. Lines of Effort: LOE-1 "Diplomatic Isolation", LOE-2 "Sea Control", LOE-3 "Airspace Dominance" with objective links
4. Decisive point marker on LOE-2: "Strait of Taiwan Choke Point — D+4"
5. AI Design Assistant panel: "Challenge Assumption" card active showing contested framing
6. Design-to-Plan handoff indicator: checkmark showing Design outputs queued for Plan tab Step 2 Mission Analysis

**Capture State:**
- Both friendly and adversary CoG sections populated with Pacific Strategy AY26 data
- 3 LOEs defined with timeline and objective links visible
- AI assistant panel open with at least one recommendation card
- Design-to-Plan indicator showing outputs ready

**Caption:** "Figure 8: Design Tab showing operational design workspace with Center of Gravity analysis and Lines of Effort. Annotations indicate: (1) CC-CR-CV framework for both forces, (2) adversary CoG with highlighted vulnerabilities, (3) three Lines of Effort in swim-lane view, (4) decisive point on Sea Control LOE, (5) AI Design Assistant challenge-assumption card, (6) Design-to-Plan handoff indicator."

---

### Screenshot 9: Decide Tab — Decision Dashboard with RACI Matrix and PendingDecisionModal

**File:** `screenshots/09-decide-tab-decision-dashboard.png`

**Purpose:** Demonstrate the Decide tab's decision dashboard, RACI-filtered approval queue, and pending decision modal.

**Shows:**
- Decide tab active in the tab bar (previously named Direct, renamed in Phase 53)
- DecisionDashboard: full-width card list of pending and recent decisions
- Ironclaw proactive decision surfacing banner at top: "2 decisions require your attention" with 60-second polling badge
- PendingDecisionModal open for a COA Approval Gate: decision title, context summary, authority level (HUMAN_ONLY badge), action buttons (Approve / Reject / Defer / View Details)
- RACI matrix view collapsed below showing role assignments
- DAO governance integration indicator showing proposal will be submitted on approval

**Key Annotations:**
1. Ironclaw banner: "2 decisions require your attention — COA Approval Gate, OPORD Release Gate" with auto-refresh timer
2. Decision card: "COA Approval Gate — INDOPACOM Campaign Plan AY26" marked HUMAN_ONLY authority in red
3. RACI column: Responsible = J3 Operations, Accountable = Commander, Consulted = J2/J5, Informed = Staff
4. PendingDecisionModal: decision summary, RACI assignment, authority tier badge, approve/reject/defer buttons
5. DAO proposal indicator: "On approval: DAO proposal will be created and submitted for coalition vote"
6. Filter controls: "Showing: My decisions | All | Pending | Approved | Deferred"

**Capture State:**
- At least 2 pending decisions visible in dashboard
- PendingDecisionModal open for a COA Approval Gate decision
- HUMAN_ONLY authority tier visible
- DAO integration badge visible on modal

**Caption:** "Figure 9: Decide Tab showing decision dashboard with RACI-filtered approval queue and PendingDecisionModal. Ironclaw proactively surfaces pending decisions every 60 seconds. Annotations indicate: (1) Ironclaw decision surfacing banner, (2) HUMAN_ONLY authority decision card, (3) RACI role assignment matrix, (4) PendingDecisionModal with approve/reject/defer actions, (5) DAO proposal integration indicator, (6) filter controls for decision queue."

---

### Screenshot 10: Resources Tab — Inventory, Discovery Panel, and Resource Groups

**File:** `screenshots/10-resources-tab-inventory.png`

**Purpose:** Demonstrate the consolidated Resources tab with inventory, device discovery, and group management views.

**Shows:**
- Resources tab active (7th tab in problem set tab bar, between COP and Assess)
- ResourcesTab sub-navigation: Inventory | Discovery | Network | Groups tabs
- Inventory view active: ResourceCatalog showing equipment (Sphero RVR+ ×3, Jetson Orin Nano ×2), personnel, and consumables
- Resource cards with DID badges (`did:near:resource-...`), status indicators (FMC/PMC/NMC), plugin type icons
- Discovery panel collapsed in sidebar showing recent discovery: "RVR+ Alpha discovered via mDNS — 192.168.1.45"
- Registry statistics row at top: 12 total resources, 6 autonomous, 3 FMC, 2 PMC, 1 NMC

**Key Annotations:**
1. Sub-navigation tabs: Inventory active, Discovery / Network / Groups available
2. Resource card: "RVR+ Alpha (Sphero RVR+)" with DID badge, FMC status, AutonomousVehiclePlugin icon
3. Discovery event: "RVR+ Bravo discovered via mDNS — awaiting DAO acceptance gate"
4. Registry statistics header: total resources, DID count, status breakdown
5. Plugin type icons: autonomous vehicle, sensor, weapon system, comms, logistics
6. Capability search bar with filter tags (category, status, capability, geographic)

**Capture State:**
- Inventory sub-view active with 4-6 resource cards visible
- At least one robot resource with DID badge and FMC status
- Discovery sidebar showing a recent discovery event
- Registry statistics row populated

**Caption:** "Figure 10: Resources Tab showing consolidated inventory, device discovery, and resource groups. Annotations indicate: (1) sub-navigation tabs (Inventory/Discovery/Network/Groups), (2) resource card with DID badge and status, (3) mDNS discovery event awaiting DAO acceptance, (4) registry statistics header, (5) resource plugin type icons, (6) capability search and filter bar."

---

### Screenshot 11: COP Tab — MIL-STD-2525D SVG Overlays with Friendly and Adversary Layers

**File:** `screenshots/11-cop-tab-milstd-overlays.png`

**Purpose:** Demonstrate the Common Operating Picture tab with AI-generated MIL-STD-2525D SVG overlays, perspective toggle, and layer governance.

**Shows:**
- COP tab active showing a Leaflet.js map centered on Taiwan Strait / Western Pacific
- Friendly layer active (blue): US/allied naval forces with standard MIL-STD-2525D symbols — warships (surface combatant symbols), air assets (fixed-wing symbols), ground forces near Taiwan
- Adversary layer visible (red): PLA forces with MLCOA positioning near Fujian Province coast
- Layer panel on right: layer list with publish status, version numbers, agent attribution
- Phase slider at bottom: "Phase 2 — Crisis" active with playback controls
- Perspective toggle: "Friendly" highlighted, "Adversary" available

**Key Annotations:**
1. Map canvas: Western Pacific with Taiwan Strait visible, standard military grid reference system overlay
2. Friendly symbols: USS Ronald Reagan Strike Group in MIL-STD-2525D naval surface track symbols (blue rectangle with warship silhouette)
3. Adversary symbols: PLA Rocket Force units near coast in red threat track symbols
4. Layer governance panel: "Friendly Layer v3 — Published by Ironclaw Agent | 2026-03-19 14:32"
5. Phase slider: Phase 2 (Crisis) active, Phase 3 (Conflict D+4) available, playback button
6. Perspective toggle: switching between friendly and adversary COP views

**Capture State:**
- Map showing Taiwan Strait / Western Pacific
- Both friendly and adversary entities visible
- Layer panel showing published layers with version numbers
- Phase slider at Phase 2 (Crisis)
- Hover detail panel visible on one entity showing SIDC, unit name, status

**Caption:** "Figure 11: COP Tab showing AI-generated MIL-STD-2525D SVG overlays with friendly (blue) and adversary (red) layers for Pacific Strategy AY26 Taiwan contingency. Annotations indicate: (1) Western Pacific map canvas with MGRS overlay, (2) friendly naval force symbols in MIL-STD-2525D format, (3) adversary PLA threat track symbols, (4) layer governance panel with publish status and agent attribution, (5) exercise phase slider at Phase 2 (Crisis), (6) friendly/adversary perspective toggle."

---

### Screenshot 12: Swarm Telemetry View — Three Platforms in Wedge Formation

**File:** `screenshots/12-swarm-telemetry-wedge.png`

**Purpose:** Demonstrate the swarm telemetry COP layer showing three Sphero RVR+ platforms in wedge formation with leader vision sharing and formation geometry.

**Shows:**
- COP tab with swarm telemetry layer active
- Top-down view of 3 RVR+ positions in wedge formation: RVR+ Alpha (leader, front center, star icon), RVR+ Bravo (rear-left), RVR+ Charlie (rear-right)
- Formation polygon overlay: translucent wedge shape connecting the three position markers
- Swarm Telemetry Panel (right sidebar): per-robot status cards showing battery, heading, speed, mission state; leader vision feed thumbnail
- Detection event overlay: colored circle on map indicating "Person detected — 0.91 confidence" from leader's camera
- DAO authorization badge: "Mission: visual_search — DAO-authorized, HOTL active"

**Key Annotations:**
1. Leader marker: RVR+ Alpha with star icon, position at formation apex, current heading arrow
2. Formation polygon: translucent wedge overlay connecting all three RVR+ positions
3. Follower positions: RVR+ Bravo and Charlie with standard autonomous vehicle symbols
4. Detection event: "Person detected — confidence: 0.91" circle marker from detectNet output
5. Swarm Telemetry Panel: per-robot battery/heading/speed, leader vision thumbnail from CSI camera
6. DAO authorization badge: "visual_search mission — HOTL active" with human override button

**Capture State:**
- Three RVR+ positions visible on map in wedge formation
- Formation polygon rendered
- Detection event marker visible near formation
- Swarm Telemetry Panel open with all three robots showing status
- Leader camera thumbnail visible in panel

**Caption:** "Figure 12: COP Tab swarm telemetry layer showing three Sphero RVR+ platforms in wedge formation during a visual_search mission. Annotations indicate: (1) swarm leader (RVR+ Alpha) with star icon and heading arrow, (2) formation polygon overlay defining wedge geometry, (3) follower positions (RVR+ Bravo and Charlie), (4) detectNet detection event (0.91 confidence) from leader camera, (5) Swarm Telemetry Panel with per-robot status and leader vision thumbnail, (6) DAO authorization badge with HOTL human override button."

---

## Annotation Guidelines

### Visual Style

**Boxes and Circles:**
- Use red (#FF0000) boxes for rectangular UI elements
- Use red circles for point features or buttons
- Border width: 3px solid
- Corner radius for boxes: 4px

**Numbering:**
- White numbers on red circular backgrounds
- Circle diameter: 24px
- Font: Bold sans-serif, 14pt
- Position numbers consistently (top-left of annotation element)

**Arrows:**
- Red (#FF0000) arrows for directional annotations
- Arrow width: 2px
- Arrowhead style: Filled triangle

**Callout Text:**
- Red text boxes with white background
- Font: Sans-serif, 12pt
- Padding: 8px
- Use for complex features requiring explanation

### Resolution and Format

**Screenshot Resolution:**
- Minimum: 1920x1080 pixels
- Recommended: 2560x1440 pixels for print quality
- Export at 300 DPI for publication

**File Format:**
- Working files: PNG with transparency
- Publication files: PNG or TIFF (lossless)
- Maximum file size: 10MB per image

**Color Space:**
- sRGB for web/screen viewing
- Convert to CMYK if print publication requires

### Capture Instructions

**Browser Settings:**
- Use Chrome or Firefox for consistent rendering
- Disable browser extensions that modify UI
- Set zoom to 100%
- Use incognito/private mode to ensure clean state

**Application State:**
- Log in with a test account that has appropriate permissions
- Pre-populate demonstration data before capture
- Ensure all required UI elements are visible without scrolling
- Close irrelevant panels or dialogs

**Timing:**
- Capture after animations complete
- Avoid capturing loading states unless documenting them
- Allow 2-3 seconds for dynamic content to stabilize

### Annotation Process

1. **Capture raw screenshot** without annotations
2. **Import into annotation tool** (Figma, Sketch, or similar)
3. **Add numbered annotations** in sequence from top-left to bottom-right
4. **Review annotation placement** for clarity and non-overlapping
5. **Export annotated version** with sequential filename
6. **Store both raw and annotated versions** for future updates

### Caption Formatting

**Structure:**
```
"Figure [N]: [Brief title describing what the figure shows]. Annotations indicate: (1) [element], (2) [element], ... (N) [element]."
```

**Style:**
- Title should be descriptive but concise (under 15 words)
- List annotations in numerical order
- Use consistent terminology matching the paper

---

## Placeholder Usage

For draft versions of the whitepaper before final screenshots are captured:

**Placeholder Format:**
```
[FIGURE 2: Strategic Planning Dashboard - Screenshot pending capture from running system]

Caption: "Figure 2: Strategic Planning Dashboard showing document ingestion, AI-extracted objectives, and human review workflow."
```

**Placeholder Dimensions:**
- Use placeholder boxes sized to expected image dimensions
- Gray (#E0E0E0) background
- Centered text describing expected content

**Replacement Process:**
1. Capture final screenshots following this specification
2. Replace placeholder text with actual images
3. Verify annotations match specification
4. Update captions if actual UI differs from specification

---

## Screenshot Checklist

Before submission, verify each screenshot:

- [ ] Resolution meets minimum requirement (1920x1080)
- [ ] All specified elements are visible
- [ ] Annotations are numbered correctly
- [ ] Annotation colors are consistent (red #FF0000)
- [ ] Caption accurately describes content
- [ ] No sensitive data visible (test accounts only)
- [ ] No error messages or loading states (unless intentional)
- [ ] File naming follows convention
- [ ] Both raw and annotated versions saved

---

*Document version: 2.0*
*Last updated: 2026-03-23*
*Added: Figures 7-12 for v0.2 capabilities (Understand/Brain, Design/CoG, Decide, Resources, COP/Overlays, Swarm Telemetry)*
