# Assess Tab

> Running Assessment and Reframing

## Purpose

The Assess tab closes the operations process loop. It tracks measures of
effectiveness and performance, aggregates running estimates from staff roles,
detects deviations between planned and actual outcomes, and surfaces the assessment
findings that may trigger a return to the Understand or Design tabs for reframing.

Assessment is continuous — it runs in parallel with planning and execution, not just
after the fact.

---

## Components

### MOE / MOP Tracking

Tracks two complementary types of measures:

| Measure Type | Definition | Example |
|---|---|---|
| **Measures of Effectiveness (MOE)** | Criteria used to assess changes in system behavior, capability, or environment. Answers: "Are we doing the right things?" | "Adversary logistics throughput reduced by 40%" |
| **Measures of Performance (MOP)** | Criteria used to assess friendly actions. Answers: "Are we doing things right?" | "3 of 5 planned strikes executed on schedule" |

- MOEs and MOPs are defined during planning (Plan tab) and tracked during
  execution.
- Each measure links to the objective or task it supports.
- Status indicators: on track (green), at risk (amber), off track (red).
- Trend tracking shows whether measures are improving, stable, or degrading.

### Running Estimates from Staff Roles

- Each staff section (J1 through J9) maintains a **running estimate** reflecting
  the current state of their functional area.
- Running estimates update continuously as new information arrives.
- Structured templates ensure consistency across staff sections.
- Estimates feed into the overall assessment and are visible to the commander and
  cross-functional staff.

| Staff Section | Estimate Focus |
|---|---|
| **J1 Personnel** | Manning, casualties, morale, replacements |
| **J2 Intelligence** | Enemy situation, threat assessment, intelligence gaps |
| **J3 Operations** | Current operations status, synchronization |
| **J4 Logistics** | Supply, maintenance, transportation, medical |
| **J5 Plans** | Future operations, branch/sequel readiness |
| **J6 Communications** | Network status, cyber posture, PACE plans |

### Deviation Detection (Plan vs. Actual)

- Automated comparison of planned activities and timelines against actual execution
  data.
- Deviations are categorized by severity: minor (within tolerance), significant
  (requires attention), critical (requires immediate action).
- Each deviation links to the affected plan element, responsible unit, and relevant
  MOE/MOP.
- AI agents flag patterns of deviation that may indicate systemic issues rather
  than isolated incidents.

### Assessment Dashboards

- **Commander's Dashboard** — High-level summary of campaign progress, key
  decisions pending, and critical deviations.
- **Staff Dashboard** — Detailed view per functional area with running estimates,
  MOE/MOP status, and recommended actions.
- **Objective Tracker** — Visual progress toward each strategic and operational
  objective.
- **Risk Matrix** — Current risk levels by category with trend indicators.
- All dashboards are configurable and support drill-down to source data.

---

## Doctrinal Assessment Loop

The Assess tab implements the doctrinal feedback loop described in JP 5-0 and ADP
5-0:

```
  Understand  <--  Reframe if assumptions invalid
      |                    ^
      v                    |
   Design     <--  Reframe if approach failing
      |                    ^
      v                    |
    Plan                   |
      |                    |
      v                    |
   Direct                  |
      |                    |
      v                    |
    COP                    |
      |                    |
      v                    |
   ASSESS  -----> Assessment findings trigger reframing
```

### Reframing Triggers

Assessment findings may indicate the need to revisit earlier phases:

- **Return to Understand** — When planning assumptions are invalidated by new
  information, or the operational environment has fundamentally changed.
- **Return to Design** — When the operational approach is not producing the desired
  effects, and the problem needs to be reframed rather than merely re-planned.
- **Plan adjustment** — When execution deviations require plan modification but the
  overall approach remains valid (handled via FRAGO in the Direct tab).

Reframing decisions are human decisions — AI surfaces the indicators, but the
commander decides whether and where to reframe.

---

## AI Agents

| Agent | Function |
|---|---|
| **Deviation Detector** | Compares plan timelines and objectives against execution data to flag discrepancies. |
| **Trend Analyzer** | Identifies patterns in MOE/MOP data and projects future trajectories. |
| **Assumption Monitor** | Cross-references planning assumptions (from the Plan tab's assumption registry) against current intelligence to flag invalidated assumptions. |
| **Assessment Synthesizer** | Aggregates inputs from all staff running estimates into a coherent overall assessment narrative. |

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Full access. Reviews overall assessment and makes reframing decisions. |
| **All staff** | Maintain their section's running estimate. View cross-functional assessments. |
| **J5 Plans** | Monitors assessment for branch/sequel decision points. |
| **J3 Operations** | Monitors execution deviations and coordinates adjustments. |

---

## Data Flow

```
COP (Execution Status)
Direct Tab (Orders, Resource Status)
Plan Tab (Assumptions, MOE/MOP Definitions)
Staff Sections (Running Estimates)
        |
        v
  +-------------------------------+
  | MOE / MOP Tracking            |
  | Deviation Detection           |
  | Running Estimates             |
  | Assessment Dashboards         |
  +-------------------------------+
        |
        v
  Reframing Decisions
    -> Understand Tab (if environment changed)
    -> Design Tab (if approach failing)
    -> Direct Tab (if plan adjustment needed via FRAGO)
```

### Inputs

- Execution status from COP
- Orders and resource status from Direct tab
- MOE/MOP definitions and assumptions from Plan tab
- Staff running estimates
- Intelligence updates from Understand tab

### Outputs

- Assessment summaries and dashboards
- Deviation alerts and trend analysis
- Reframing recommendations
- Updated running estimates

---

## Doctrinal Reference

- **JP 5-0**, Chapter XIII: Assessment
- **ADP 5-0**, The Operations Process — Assessing
- **JP 3-0**, Joint Operations — Assessment of Joint Operations
- **FM 6-0**, Commander and Staff Organization and Operations — Running Estimates

---

*Part of the [BASTION Capability Tabs](/) documentation.*
