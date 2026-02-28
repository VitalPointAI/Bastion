# Phase 14: Friendly & Adversary IPB Complete Cycle - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build an exercise scenario from provided documents (PDFs, DOCX, PPTX) with dual-perspective IPB (friendly and adversary), COA development with combined doctrinal + wargame-informed probability scoring, concurrent operation support across exercise phases, and commander decision-forcing workflows. The exercise documents in `scenario/` (Pacific Strategy AY26) serve as the reference implementation.

</domain>

<decisions>
## Implementation Decisions

### Document-to-Scenario Pipeline
- Single scenario package upload — user uploads entire directory structure, system parses folder hierarchy to determine side (blue/red) and exercise phase assignment automatically
- Full auto-extraction — AI extracts OOBs, timelines, objectives, force dispositions, key events, and presents a complete structured scenario; human reviews the result (no per-extraction confirmation gates)
- All document types extracted with equal priority — OOBs, ALERTORDs, SITREPs, Campaign Plans (PPTX), FRAGOs, Country Policy Sheets, and Planning Maps all contribute essential information
- Extend Phase 4's existing ingestion/extraction pipeline — make it generic enough for both operational and exercise scenarios with a designation tag (e.g., "operational" vs "training/exercise") to differentiate context
- Support PDF, DOCX, and PPTX document types from the exercise package

### Dual-Perspective IPB Presentation
- Toggle-based perspective switching (Blue/Red) as the primary view mode — single IPB view with perspective selector
- Layered overlay capability — users can toggle individual layers on/off (blue forces, red forces, terrain, key features, etc.) similar to GIS layer management
- Two Red perspective modes available:
  - "Red as Blue sees them" — Blue intelligence assessment of Red capabilities, dispositions, and likely COAs (standard IPB output)
  - "Red as Red sees themselves" — simulated adversary planning perspective showing Red's own objectives and assessment of Blue (wargaming mode)
- Extend existing ValidityMap component — add IPB-specific layers (AOs, avenues of approach, key terrain, named areas of interest, engagement areas, obstacle overlays)
- Standard geographic maps (Leaflet/Mapbox style) as the primary map format — convert hex-based exercise planning maps to equivalent geographic overlays rather than implementing hex grid rendering

### COA Scoring & Commander Decisions
- Combined scoring model — doctrinal evaluation criteria (feasibility, acceptability, suitability, distinguishability, completeness) provide the framework; wargaming results from Phase 5.2's adversary modeler feed evidence into each criterion
- Decision matrix + editable AI-generated narrative for COA comparison — matrix for at-a-glance comparison, narrative synthesis highlighting key trade-offs and staff recommendation
- Staff can edit the AI-generated narrative before presenting to the commander
- Full commander decision workflow — commander can accept, reject, modify, combine elements from multiple COAs, or send back for more analysis
- Hybrid recording — commander decisions stored in PostgreSQL for speed; hash of the decision record anchored on NEAR blockchain for tamper-evident verification

### Concurrent Operations & Phasing
- Timeline + gates — master timeline for visualization and context, but phase transitions are explicit decisions (not automatic time-based triggers); gates control when new information becomes available
- Interleaved planning with visibility rules — both Blue and Red plan in the same environment but with information barriers; Blue cannot see Red's internal planning and vice versa; exercise controller/admin sees both sides
- Incremental overlay + automatic impact flagging — new SITREPs overlay on existing assessments showing deltas; AI automatically flags which COAs, assumptions, and assessments are affected; staff reviews and confirms which assessments to update
- Version history preserved — previous assessments archived when updated so the evolution of understanding is traceable

### Claude's Discretion
- Specific folder structure parsing heuristics for the scenario package
- IPB layer styling and color coding conventions
- Exact scoring weight defaults for the doctrinal criteria
- SITREP delta detection algorithms and confidence thresholds
- Exercise controller dashboard layout and controls

</decisions>

<specifics>
## Specific Ideas

- The `scenario/` directory in the repo serves as the reference exercise package (Pacific Strategy AY26 — Indo-Pacific / Taiwan contingency)
- Exercise structure: Competition → Crisis → Conflict Day 4 → Conflict Day 10 → Conflict Day 22 → Negotiation
- Blue team = CJTF WestPAC (INDOPACOM); Red team = PRC/TCC (Taiwan Campaign Command)
- Country policy sheets (20+ nations) provide access/basing/overflight context that should feed into the operational environment assessment
- Exercise planning maps use hex grids (200nm for Western Pacific, 100km/20km for Taiwan strait) — convert these to geographic equivalents

</specifics>

<deferred>
## Deferred Ideas

- Full negotiation phase support — Phase 14 tracks negotiation outcomes only as inputs to final assessment; a dedicated negotiation support phase (ceasefire terms management, negotiation position tracking, outcome modeling) should be added to the roadmap backlog
- Real-time multi-user exercise execution — Phase 14 builds the scenario and planning tools; live multi-user exercise play with simultaneous teams is a separate capability

</deferred>

---

*Phase: 14-friendly-adversary-ipb-complete-cycle*
*Context gathered: 2026-02-28*
