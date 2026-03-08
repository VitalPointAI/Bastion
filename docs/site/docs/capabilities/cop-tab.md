# COP Tab

> Common Operating Picture

## Purpose

The COP tab provides the shared operational visualization for the entire problem
set. It renders AI-generated military symbology on interactive map layers, enables
friendly and adversary perspective toggling, and supports phase-based playback. The
COP is continuously updated by autonomous AI agents that monitor workspace changes
and generate symbol overlays for human review.

---

## Components

### AI-Generated MIL-STD-2525D SVG Overlays

- Military symbols rendered as **SVG** following the **MIL-STD-2525D** standard.
- Symbols are generated from planning documents, orders, and the resource registry
  — not manually placed.
- Covers unit symbols, equipment, installations, activities, and control measures
  (boundaries, phase lines, objectives).
- Symbols are interactive: click for details, source references, and linked
  planning context.

### SIDC Builder

- **Symbol Identification Code (SIDC)** builder for creating custom military
  symbols.
- Visual interface for constructing valid 2525D codes step by step: identity,
  symbol set, status, modifier, and icon.
- Preview rendering shows the symbol as it will appear on the COP.
- Built symbols are added to the workspace symbol library for reuse.

### Entity Linker

- Connects COP symbols to entities in the **RAFT knowledge graph** and the
  **Resource Registry**.
- Ensures that a unit symbol on the COP references the same entity as intelligence
  assessments and resource allocations.
- Changes to linked entities (name, status, composition) automatically propagate
  to the COP symbol.

### Layer Publish Review Cycle

COP layers follow a controlled publish workflow:

1. **Draft** — AI agents generate a layer from workspace data.
2. **Review** — Staff review the layer for accuracy, completeness, and
   classification.
3. **Revise** — Staff correct errors or add missing elements.
4. **Publish** — Approved layers become visible to all authorized users.

Only published layers appear in the authoritative COP. Draft and review layers are
visible only to the review team.

### Friendly / Adversary Perspective Toggle

- Switch the COP view between **friendly** and **adversary** perspectives.
- Friendly view: shows own forces, planned maneuvers, and control measures.
- Adversary view: shows assessed enemy disposition, capabilities, and likely
  courses of action.
- Combined view available for situational awareness and briefings.

### Phase Slider with Playback

- Timeline slider moves the COP through operation **phases**.
- Playback mode animates the progression of forces and events across phases.
- Each phase reflects the planned or actual disposition from the corresponding
  planning documents and execution data.
- Useful for briefings, rehearsals, and after-action review.

### Resource Symbols with Readiness Status

- Resources from the **Resource Registry** are rendered as symbols on the COP.
- Each resource symbol displays current **readiness status** (green/amber/red or
  C-level ratings).
- Status updates flow from the resource registry and the Assess tab.
- Click a resource symbol to see allocation details, maintenance status, and
  owning unit.

---

## AI Agents

### COP Layer Agent Team

The COP is maintained by an **autonomous agent pool** that continuously monitors
workspace changes:

| Agent | Function |
|---|---|
| **Document Monitor** | Watches for new or updated planning documents and orders that affect the operational picture. |
| **Symbol Generator** | Extracts entities and locations from documents and generates appropriate MIL-STD-2525D symbols. |
| **Layout Engine** | Positions symbols on the map based on geographic references, doctrinal conventions, and deconfliction rules. |
| **Change Detector** | Identifies differences between the current published COP and new workspace data, flagging layers that need refresh. |

The agent team operates as a pool — work is distributed across agents and results
are aggregated into draft layers for human review. No AI-generated layer is
published without staff approval.

---

## Role Access

| Role | Access |
|---|---|
| **All staff** | View published COP layers within their information barrier permissions. |
| **J2 Intelligence** | Primary reviewer for adversary layers. |
| **J3 Operations** | Primary reviewer for friendly force layers and control measures. |
| **Commander** | Full access to all layers and perspectives. Approves critical layer publications. |

---

## Data Flow

```
Planning Documents (Plan Tab)
Orders (Direct Tab)
Resource Registry
Intelligence (Understand Tab)
        |
        v
  AI Agent Pool
  (Monitor, Extract, Generate Symbols)
        |
        v
  +-------------------------------+
  | Draft COP Layers              |
  |   -> Staff Review             |
  |   -> Revision                 |
  |   -> Published COP            |
  +-------------------------------+
        |
        v
  Shared Operational Visualization
  (Briefings, Rehearsals, Execution Monitoring)
```

### Inputs

- Planning documents and approved plans (from Plan tab)
- Formatted orders (from Direct tab)
- Resource registry with readiness data
- Intelligence assessments and entity data (from Understand tab)
- Geographic reference data

### Outputs

- Published COP layers with MIL-STD-2525D symbology
- Phase-sequenced operational visualization
- Resource readiness overlay
- Friendly and adversary dispositions

The COP serves as the primary visualization for all tabs and feeds situational
awareness across the entire staff.

---

## Doctrinal Reference

- **JP 3-0**, Joint Operations — Common Operational Picture
- **MIL-STD-2525D**, Joint Military Symbology
- **ADP 6-0**, Mission Command — Shared Understanding

---

*Part of the [BASTION Capability Tabs](/) documentation.*
