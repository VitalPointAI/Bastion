# Direct Tab (Deprecated)

> **This tab was renamed to [Decide Tab](decide-tab.md) in Phase 24/53.** The content below is retained for historical reference. See the Decide Tab for current documentation.

> Command Direction & Execution — JP 3-0

## Purpose

The Direct tab is where approved plans translate into executable orders. It provides
the command interface for issuing directives to subordinate units, AI agents, and
autonomous assets. Commanders monitor execution progress, adjust tasking in response
to the evolving situation, and exercise battle-rhythm controls through structured
decision gates with DAO governance.

---

## Components

### Order Generation
- Convert approved COAs into fragmentary orders (FRAGOs)
- Task organization and unit assignment
- Timeline and phase-line synchronization

### Mission Dispatch
- Dispatch missions to robotic assets via the Robot Bridge
- Resource request and allocation workflow (DAO-gated)
- Autonomous mission sequencing (recon → assess → engage → withdraw)

### Execution Monitoring
- Real-time mission state tracking (pending → executing → complete)
- Deviation alerts when units diverge from planned routes
- Decision-gate prompts requiring human authorization

### Battle Rhythm
- Synchronization matrix for phased operations
- Decision-point triggers tied to operational phases
- After-action review integration with the Assess tab
