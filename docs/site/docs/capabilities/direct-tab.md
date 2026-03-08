# Direct Tab

> Order Generation and Execution Direction

## Purpose

The Direct tab transforms approved plans into formatted military orders and manages
the direction of execution. It generates standard order formats (WARNORD, OPORD,
FRAGO), displays task organization, allocates resources, and enforces information
security through classification banners and per-team information barriers.

This tab bridges the gap between planning and execution — it is where the
commander's approved plan becomes actionable direction to subordinate elements.

---

## Components

### Order Generation

Supports the three standard military order formats:

| Order Type | Purpose |
|---|---|
| **WARNORD** (Warning Order) | Provides initial notice of an upcoming operation, allowing subordinates to begin preparation. |
| **OPORD** (Operation Order) | The complete order directing execution, with all five paragraphs (Situation, Mission, Execution, Sustainment, Command & Signal). |
| **FRAGO** (Fragmentary Order) | Modifies a previously issued order without rewriting the entire OPORD. |

- AI-assisted drafting from approved plan data in the Plan tab.
- Structured templates enforce doctrinal format compliance.
- Paragraph-by-paragraph editing with version tracking.
- Cross-references to source planning documents for traceability.

### Task Organization Display

- Visual representation of the task organization for the operation.
- Shows command relationships (OPCON, TACON, support) between elements.
- Links to the order's Execution paragraph for consistency.
- Drag-and-drop reorganization with automatic order update.

### Resource Allocation

- Pulls available resources from the **Resource Registry**.
- Assign resources to tasks, units, and phases.
- Tracks allocation status: available, allocated, committed, in-use.
- Highlights resource conflicts when the same asset is double-allocated.
- Resource readiness status feeds the COP tab's operational picture.

### Classification Banners and Handling

- Every order and document displays the appropriate **classification banner**
  (UNCLASSIFIED, CUI, CONFIDENTIAL, SECRET, TOP SECRET).
- Classification is inherited from source material and can be elevated (never
  lowered without authority).
- Handling caveats (NOFORN, REL TO, etc.) are tracked and displayed.
- Ensures orders are appropriately marked before distribution.

### Per-Team Information Barriers

- **Information barriers** restrict visibility of order components to authorized
  teams only.
- Supports compartmented planning — teams see only the portions relevant to their
  mission.
- Barrier rules are defined during order creation and enforced at the UI and API
  levels.
- Audit log tracks all access to barrier-protected content.

---

## AI Agents

The Direct tab relies primarily on the **Orders Validator** agent (shared with the
Plan tab) for doctrinal compliance checks. Order generation is largely template-driven
with AI fill from approved plan data.

| Agent | Function |
|---|---|
| **Orders Validator** | Checks generated orders for completeness, format compliance, and internal consistency against the source plan. |

Human judgment remains central to order production. The commander and J3 staff
review and approve all orders before release.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Approves and signs orders. Full visibility across all information barriers. |
| **J3 Operations** | Primary order producer. Drafts and coordinates orders. |
| **Component Commanders** | Review orders relevant to their component. Access governed by information barriers. |
| **J5 Plans** | Read access. Verifies orders align with the approved plan. |
| **All staff** | View orders within their information barrier permissions. |

---

## Data Flow

```
Plan Tab
  (Approved Plans, COAs, Task Org)
        |
        v
  +-------------------------------+
  | Order Drafting (WARNORD /     |
  |   OPORD / FRAGO)              |
  | Task Organization             |
  | Resource Allocation           |
  | Classification & Barriers     |
  +-------------------------------+
        |
        v
  COP Tab (Operational Picture)
  Tactical Execution (External)
```

### Inputs

- Approved plans and COAs (from Plan tab)
- Task organization
- Commander's intent and guidance
- Resource registry (available assets)
- Classification guidance

### Outputs

- Formatted military orders (WARNORD, OPORD, FRAGO)
- Resource assignments with allocation status
- Task organization with command relationships
- Distribution records (who received what, when)

Orders feed the **COP tab** for operational tracking and drive **tactical
execution** by subordinate elements.

---

## Doctrinal Reference

- **JP 5-0**, Chapter XII: Plan and Order Development
- **FM 6-0**, Commander and Staff Organization and Operations — Orders and Plans
- **ADP 5-0**, The Operations Process — Directing

---

*Part of the [BASTION Capability Tabs](/) documentation.*
