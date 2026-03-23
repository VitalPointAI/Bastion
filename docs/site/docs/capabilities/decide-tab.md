# Decide Tab

> Decision Dashboard and Execution Authority — JP 5-0, Chapter XII

## Purpose

The Decide tab is the human authority center of BASTION. It presents every pending
decision in a single, filterable dashboard so commanders and staff can act quickly
with full context. It replaces manual decision-tracking with inline approve, reject,
defer, and escalate workflows — all backed by on-chain DAO governance.

This tab covers the moment between plan approval and order issuance: who decides what,
who must concur, and how those decisions are recorded verifiably on the blockchain.

Reference: Phase 53

---

## Components

### Decision Dashboard

- Consolidated view of all decisions pending across the current problem set.
- Full-width layout optimized for rapid scanning during time-pressured operations.
- Each decision card displays: title, category, authority level, RACI ownership,
  deadline, and current status.
- Status indicators: Pending, Approved, Rejected, Deferred, Escalated.

### RACI Matrix Filtering

- Decisions are associated with the **RACI matrix** that governs staff roles.
- Filter the dashboard by: Responsible, Accountable, Consulted, or Informed.
- Each staff member sees their pending action items first.
- Commanders see all decisions; staff see those within their authority or concurrence
  requirement.

### Inline Approve / Reject / Defer / Info Workflow

Four inline actions available directly from the decision card:

| Action | Behavior |
|---|---|
| **Approve** | Moves the decision to approved status, triggers downstream order generation or resource allocation. |
| **Reject** | Records the rejection with a mandatory rationale field; decision returns to originator. |
| **Defer** | Marks decision as deferred with an optional date; clears from active queue without discarding. |
| **Info** | Opens the full `PendingDecisionModal` for detailed context, linked documents, and history. |

- No navigation away from the dashboard — all actions happen inline.
- All approvals and rejections are recorded in the decision audit trail.

### PendingDecisionModal

- Detailed decision view panel triggered by the Info action or by clicking the
  decision card.
- Displays: full decision description, supporting documents, linked plan elements,
  authority chain, and prior actions.
- Embedded DAO governance status: on-chain vote count, quorum progress, and
  blockchain transaction reference.
- Staff concurrence tracking: shows who has reviewed, concurred, or objected.
- Quick-action buttons (Approve/Reject/Defer) available inside the modal for
  immediate action after full review.

### DAO Governance Integration at Decision Gates

Every consequential decision is backed by an on-chain governance record:

- **Tier 1** — Commander authority: single-approver, recorded on chain.
- **Tier 2** — Deputy/Chief of Staff delegation: two-approver threshold.
- **Tier 3** — Staff section approval (J1-J9): staff vote with quorum rule.
- **Tier 4** — Coalition partner consensus: multi-organization vote.
- **Tier 5** — Full coalition vote: majority threshold across all partners.

- The required governance tier is set when the decision is created (sourced from
  the Plan tab governance gates or MDMP phase thresholds).
- On-chain voting is non-blocking: staff can review and recommend before the formal
  vote closes.
- The Decide tab displays live vote counts so commanders can track consensus in
  real time.

---

## AI Agent: Ironclaw Proactive Decision Surfacing

**Ironclaw** is BASTION's command-level AI agent. On the Decide tab it operates in
a **proactive 60-second polling loop**:

- Every 60 seconds, Ironclaw queries for newly pending decisions that require
  command attention.
- New decisions surface as a notification prompt without requiring the commander to
  navigate to the tab.
- Ironclaw provides a one-line summary of the decision context and recommended action,
  drawn from the current knowledge graph and planning history.
- The commander can approve or defer directly from the notification; the decision
  card on the dashboard reflects the action immediately.

This proactive model ensures that decision latency does not become a planning
bottleneck during fast-moving operations.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Full access. All decisions visible. Tier 1 approver. Ironclaw notifications active. |
| **Deputy Commander / COS** | Full access. Tier 2 authority. Can approve within delegated scope. |
| **J3 Operations** | Manages execution decisions. Primary Tier 3 actor for operations category decisions. |
| **All staff sections** | See decisions relevant to their RACI assignment. Provide concurrence where Consulted. |
| **Coalition partners** | Participate in Tier 4 / Tier 5 votes for multi-partner decisions. |

---

## Data Flow

```
Plan Tab
  (MDMP Governance Gates, Approved COAs)
DAO Governance Layer
  (On-chain proposals, vote thresholds)
        |
        v
  +----------------------------------+
  | Decision Dashboard               |
  | RACI Matrix Filter               |
  | Inline Approve / Reject / Defer  |
  | PendingDecisionModal             |
  | DAO Vote Tracking                |
  +----------------------------------+
        |
        v
  Order Generation (OPORD / FRAGO)
  Resource Allocation
  Assess Tab (Decision audit trail)
```

### Inputs

- Pending decisions from MDMP governance gates (Plan tab)
- DAO proposals from blockchain governance layer
- Staff concurrence requests across functional areas
- Ironclaw proactive alerts (60-second polling)

### Outputs

- Approved decisions triggering order generation or resource allocation
- Rejected decisions with rationale returned to originators
- On-chain approval records for audit and coalition transparency
- Deferred decision queue for future review

---

## Doctrinal Reference

- **JP 5-0**, Chapter XII: Plan and Order Development — Decision Authority
- **FM 6-0**, Commander and Staff Organization and Operations — Decision-Making
- **ADP 6-0**, Mission Command — Authority and Decision-Making at the Right Level

---

*Part of the [BASTION Capability Tabs](/) documentation.*
