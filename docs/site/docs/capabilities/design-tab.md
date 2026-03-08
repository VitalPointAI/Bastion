# Design Tab

> Operational Design — JP 5-0, Chapter III

## Purpose

The Design tab translates understanding into an operational approach. It is where
commanders and planners frame the problem, analyze centers of gravity, define lines
of effort, and construct the conceptual bridge between strategic objectives and
detailed planning. This corresponds to **JP 5-0, Chapter III: Operational Design**.

The output of this tab — an approved operational approach — becomes the foundation
for mission analysis and course of action development in the Plan tab.

---

## Components

### Problem Framing Canvas

- Visual canvas for defining the current state, desired end state, and the central
  problem to solve.
- Drag-and-drop elements from the Understand tab's extracted objectives and PMESII-PT
  assessments.
- Supports collaborative editing so multiple staff members can contribute
  simultaneously.
- Captures assumptions, constraints, and restraints alongside the problem statement.

### Center of Gravity Analysis

Uses **Strange's CG-CC-CR-CV model** for structured center of gravity analysis:

| Element | Description |
|---|---|
| **Center of Gravity (CG)** | The source of power that provides moral or physical strength, freedom of action, or will to act. |
| **Critical Capabilities (CC)** | Primary abilities essential to the CoG that merit a concerted effort to be achieved. |
| **Critical Requirements (CR)** | Essential conditions, resources, and means needed by a CC to be fully operational. |
| **Critical Vulnerabilities (CV)** | Aspects of CRs that are deficient or exposed to neutralization or defeat. |

- Separate analysis tracks for friendly and adversary centers of gravity.
- AI-assisted identification of candidate CoGs from the knowledge graph.
- Links back to source documents for traceability.

### Lines of Effort / Operation Builder

- Define and organize **Lines of Effort (LOE)** for irregular or stability
  operations, or **Lines of Operation (LOO)** for conventional campaigns.
- Each line includes objectives, intermediate milestones, and supporting tasks.
- Visual timeline view showing phase relationships and dependencies.
- Gap analysis highlights lines that lack supporting tasks or resources.

### Operational Approach Builder

- Assembles the overall operational approach from the problem frame, CoG analysis,
  and lines of effort/operation.
- Generates a structured summary suitable for commander review and approval.
- Captures the logic of the approach: why this sequence of actions should achieve
  the desired end state.

### Design-to-Plan Handoff

- Formal transition point from operational design to detailed planning.
- Packages the approved operational approach, including objectives, CoG analysis,
  LOEs/LOOs, and assumptions.
- Creates the initial mission analysis inputs for the Plan tab's JPP workflow.
- Tracks approval status — the handoff requires commander endorsement.

---

## AI Agents

| Agent | Function |
|---|---|
| **CoG Analysis** | Proposes candidate centers of gravity and maps CC-CR-CV chains from the knowledge graph. |
| **LOE Gap Analysis** | Identifies gaps in lines of effort — objectives without supporting tasks, unlinked milestones, or resource shortfalls. |
| **Narrative Synthesis** | Generates human-readable summaries of the operational approach for briefings and review. |
| **AI Design Assistant** | General-purpose design support — answers doctrinal questions, suggests frameworks, and cross-references historical precedents. |

All AI outputs are advisory. The operational approach requires human judgment and
commander approval before handoff to the Plan tab.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Full access. Approves the operational approach and authorizes handoff. |
| **J5 Plans** | Primary editor. Builds and refines the operational design. |
| **J3 Operations** | Contributor. Ensures feasibility and alignment with current operations. |
| **Other staff** | Read access. May provide input through collaborative editing. |

---

## Data Flow

```
Understand Tab
  (Objectives, RAFT Graph, PMESII-PT)
        |
        v
  +-----------------------------+
  | Problem Frame               |
  | Center of Gravity Analysis  |
  | Lines of Effort / Operation |
  | Operational Approach        |
  +-----------------------------+
        |
        v
  Plan Tab (Mission Analysis, COA Development)
```

### Inputs

- Strategic objectives (from Understand tab)
- RAFT knowledge graph entities and relationships
- PMESII-PT assessments
- Commander's guidance

### Outputs

- Approved operational approach
- CoG analysis (friendly and adversary)
- Lines of effort/operation with objectives
- Assumptions, constraints, and restraints
- Handoff package for Plan tab mission analysis

---

## Doctrinal Reference

- **JP 5-0**, Chapter III: Operational Design
- **JP 5-0**, Chapter IV: Operational Art
- **ADP 5-0**, The Operations Process — Design Methodology
- **Strange's CG-CC-CR-CV Model** — Centers of Gravity & Critical Factors Analysis

---

*Part of the [BASTION Capability Tabs](/) documentation.*
