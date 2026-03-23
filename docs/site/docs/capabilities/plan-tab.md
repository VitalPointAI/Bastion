# Plan Tab

> Joint Planning Process / MDMP — JP 5-0

## Purpose

The Plan tab is where operational design becomes actionable. It implements the
**Joint Planning Process (JPP)** 7-step workflow and the **Military Decision-Making
Process (MDMP)** governance framework. Staff develop, wargame, compare, and approve
courses of action through a structured, auditable process with AI augmentation and
human decision gates at every critical juncture.

---

## Components

### 7-Step JPP Workflow Engine

The Plan tab enforces the full JPP sequence:

1. **Planning Initiation** — Receive and frame the planning directive.
2. **Mission Analysis** — Analyze the operational approach from the Design tab,
   identify specified/implied/essential tasks, and refine the problem statement.
3. **COA Development** — Generate candidate courses of action.
4. **COA Analysis (Wargaming)** — Test each COA against adversary responses.
5. **COA Comparison** — Evaluate COAs against weighted criteria.
6. **COA Approval** — Commander selects or modifies a COA.
7. **Plan Development** — Develop the approved COA into a full plan or order.

Each step has defined entry/exit criteria. The workflow engine tracks which steps
are complete and which require action.

### COA Development with Collaborative Editing

- Real-time collaborative editing powered by **Yjs** CRDT framework.
- Multiple staff members can simultaneously draft and refine COA elements.
- Version history with full attribution — see who contributed what and when.
- Structured COA templates covering scheme of maneuver, task organization,
  synchronization, and risk assessment.

### Wargaming (Action-Reaction-Counteraction)

- Structured wargaming using the **action-reaction-counteraction** method.
- Each turn: friendly action, adversary reaction (AI-assisted red teaming),
  friendly counteraction.
- Records decisions, outcomes, and branch/sequel triggers.
- AI red team simulator provides realistic adversary responses based on doctrine
  and the knowledge graph.

### COA Comparison Matrices

- Side-by-side comparison of COAs against commander-defined criteria.
- Weighted scoring with justification for each rating.
- Visual matrix output suitable for decision briefings.
- AI-assisted comparison highlights key differentiators and trade-offs.

### MDMP Governance Gates

The Plan tab enforces **18 governance gates across 9 MDMP phases**:

| Phase | Key Gates |
|---|---|
| Receipt of Mission | Planning timeline, initial guidance |
| Mission Analysis | Mission statement approval, commander's intent |
| COA Development | COA brief, staff concurrence |
| COA Analysis | Wargame results validation |
| COA Comparison | Criteria weighting approval |
| COA Approval | Commander's decision |
| Orders Production | Staff review, legal review |
| Rehearsal | Rehearsal completion |
| Transition | Handoff acknowledgment |

Each gate requires explicit approval from the authorized role before the workflow
advances. Gate status is visible to all staff.

### Echelon-Aware Planning Routing

BASTION routes planning workflows to the appropriate doctrinal framework based on
echelon (Reference: Phases 33-36):

| Echelon | Framework | Key Output |
|---|---|---|
| **Strategic** | Guidance-based | Commander's intent, strategic guidance |
| **Operational** | JPP 7-Step | Campaign plan, operational approach |
| **Tactical** | MDMP | OPORD, tactical child problem sets |

- Problem sets inherit context from parent echelons (strategic objectives flow
  down to operational planning; operational constraints bound tactical MDMP).
- Tactical child problem sets are created directly from operational OPORD tasks,
  maintaining inheritance propagation through the echelon chain.
- Each echelon sees only the level of detail appropriate to its mission and
  authority.

### OPORD Generation and Distribution

- AI-assisted OPORD generation from the approved COA and planning data.
- Enforces the five-paragraph format: Situation, Mission, Execution, Sustainment,
  Command and Signal.
- Paragraph-by-paragraph editing with AI fill from structured planning products.
- Classification handling: every order paragraph inherits the highest classification
  of its source material.
- Distribution list management: controls who receives which paragraphs based on
  information barriers and need-to-know.
- OPORD serves as the seed for mission creation in the Plan tab and COP update in
  the COP tab.

### Mission Creation from OPORD

- Tasks from the approved OPORD's Execution paragraph are converted into structured
  missions.
- Each mission links to: assigned unit, supporting resources, timeline, success
  criteria, and MOE/MOP measures.
- Missions created here feed the COP tab (position and status symbols) and the
  Assess tab (measure tracking).
- Tactical child problem sets can be spawned from individual OPORD tasks, allowing
  subordinate echelons to conduct their own MDMP within the parent plan's boundaries.

### Ends-Ways-Means Linkage

- Explicit traceability from **Ends** (objectives), **Ways** (courses of action
  and tasks), and **Means** (resources).
- Every task traces back to an objective; every resource allocation traces to a
  task.
- Broken linkages (tasks without objectives, or objectives without supporting tasks)
  are flagged as planning gaps.
- Visual linkage map available for commander review and briefings.

### Assumption Registry

- Centralized log of all planning assumptions.
- Each assumption tracked with: source, rationale, owner, validation status, and
  impact if invalid.
- AI assumption auditor periodically checks assumptions against new information
  from the Understand tab.
- Invalid assumptions trigger reassessment alerts.

---

## AI Agents

| Agent | Function |
|---|---|
| **COA Generator** | Proposes candidate courses of action based on the operational approach and available forces. |
| **Red Team Simulator** | Generates realistic adversary responses during wargaming based on adversary doctrine and capabilities. |
| **COA Comparator** | Provides analytical comparison of COAs against evaluation criteria. |
| **Adversary Modeler** | Maintains and updates the adversary model throughout the planning process. |
| **Effect Cascader** | Models second- and third-order effects of proposed actions. |
| **Escalation Modeler** | Assesses escalation risk for proposed actions across the conflict spectrum. |
| **Deception Detector** | Flags potential adversary deception indicators in intelligence feeding the plan. |
| **Assumption Auditor** | Validates planning assumptions against current intelligence and flags stale or contradicted assumptions. |
| **Orders Validator** | Checks draft orders for completeness, internal consistency, and doctrinal compliance. |
| **Uncertainty Quantifier** | Estimates confidence levels and uncertainty ranges for key planning factors. |
| **Data Bias Detector** | Identifies potential biases in data sources and analysis feeding the planning process. |
| **Problem Framing** | Assists with refining the problem statement during mission analysis. |
| **ROE Compliance** | Checks proposed actions against rules of engagement and legal constraints. |

---

## Human Checkpoints

The Plan tab is designed around the principle that **AI advises, humans decide**:

- **COA Approval** — Only the commander can select a COA for plan development.
- **Plan Approval** — The completed plan requires commander endorsement before
  orders can be generated.
- **Governance Gates** — All 18 MDMP gates require explicit human approval from
  the authorized role.
- **Wargame Decisions** — Friendly actions are human decisions; AI provides the
  adversary response for reaction.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Approves COAs, plans, and key governance gates. |
| **J5 Plans** | Primary planner. Leads COA development and plan production. |
| **J3 Operations** | Contributes to COA development, leads wargaming execution. |
| **J2 Intelligence** | Provides intelligence input, validates adversary models. |
| **All staff** | Participate in collaborative planning per their functional area. |

---

## Data Flow

```
Design Tab
  (Operational Approach, CoG Analysis, LOEs)
        |
        v
  +-------------------------------+
  | Mission Analysis              |
  | COA Development & Wargaming   |
  | COA Comparison & Approval     |
  | Plan Development              |
  +-------------------------------+
        |
        v
  Decide Tab (Decision Dashboard, Order Generation)
```

### Inputs

- Operational approach and CoG analysis (from Design tab)
- Lines of effort/operation
- Commander's guidance and intent
- Intelligence estimates and knowledge graph
- Assumptions from Design tab

### Outputs

- Approved courses of action
- Completed plans
- Validated assumptions
- Wargame results and decision records
- Draft orders and decisions queued in the Decide tab

---

## Doctrinal Reference

- **JP 5-0**, Chapters V-XI: Joint Planning Process
- **ADP 5-0**, The Operations Process — Planning
- **ATP 5-0.1**, Army Design Methodology
- **MDMP**, FM 6-0: Commander and Staff Organization and Operations

---

*Part of the [BASTION Capability Tabs](/) documentation.*
