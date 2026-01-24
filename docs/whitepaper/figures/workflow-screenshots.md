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

*Document version: 1.0*
*Last updated: 2026-01-24*
