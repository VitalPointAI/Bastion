# Phase 5: Operational Planning Module - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the JP 5-0 Joint Planning Process as an automated workflow producing OPLAN/OPORD outputs with ROE enforcement. Users create operational-level plans linked to approved strategic objectives. Campaign planning, operational design methodology, and tiered autonomy are in scope. Tactical execution (Phase 7) and mission briefing interfaces (Phase 11) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Planning Process Flow
- Flexible navigation dashboard showing all 7 JP 5-0 steps — users can work on any step, mark ready when done
- Full 7-step process tracked: Planning Initiation, Mission Analysis, COA Development, COA Analysis, COA Comparison, COA Approval, Plan Development
- Two mandatory human checkpoints: COA Approval and Plan Approval (cannot advance without commander sign-off)
- Minimum 3 COAs per doctrine standard — always develop at least 3 distinct options for comparison
- Required linkage to strategic objectives — every plan must trace to at least one approved objective from Phase 4
- Unlimited concurrent planning efforts — users can work on multiple plans simultaneously
- Full version history — every save creates a version, can view and restore any past state
- Real-time collaboration — multiple staff members can edit simultaneously, see each other's changes live

### ROE Enforcement Behavior
- Warning with override — flag violations, allow override with documented justification and authority
- Commander only override authority — only mission commander role can authorize proceeding despite ROE warning
- Blockchain immutable audit trail — all ROE checks and overrides recorded on NEAR for tamper-proof accountability
- Mission-specific ROE — each mission defines its own ROE set at mission creation (no inherited theater ROE)

### Operational Design Outputs
- OPLAN/OPORD 5-paragraph structure — Situation, Mission, Execution, Sustainment, Command & Signal
- Full JP 5-0 annex set (A-Z) — all standard annexes including logistics, comms, civil affairs, etc.
- Export formats: PDF, DOCX, JSON (structured data), ATAK data package for tactical dissemination
- Classification: both overall banner and portion markings for granular control
- Auto-generated operational graphics — phase lines, objectives, boundaries derived from plan data
- Auto-generated synchronization matrix — time-phased sync from plan phases, tasks, and supporting fires
- Auto-generated DST + CCIR — Decision Support Template and Commander's Critical Information Requirements
- Auto-generated briefing slides — commander's brief, staff brief, and rehearsal brief
- Integrated risk annex — formal annex with 5x5 matrix, mitigations, and decision authority levels

### AI Assistance Level
- AI generates draft COAs AND validates human-authored COAs (dual role)
- Red Team Simulation Agent — runs adversary simulation against each COA, provides outcome analysis
- COA Comparison Agent — scores COAs against criteria (feasibility, acceptability, suitability) with rationale
- Single-responsibility agent design — each agent does one thing extremely well
- All AI outputs require human review — every AI-generated section needs approval before plan inclusion
- Confidence communication: explicit scores (0-100%) AND qualitative levels (High/Medium/Low) with uncertainty explanations

### Claude's Discretion
- Dashboard layout and step visualization design
- COA scoring criteria weights
- Risk matrix calculation details
- Sync matrix time granularity
- Annex template formatting
- Version diff presentation

</decisions>

<specifics>
## Specific Ideas

- "Each AI agent should do one thing and do it extremely well" — applies to COA simulation vs comparison
- COA development should support both AI-generated drafts and human-authored options through same interface
- ROE override requires documented justification — not just commander approval, but written rationale

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-operational-planning-module*
*Context gathered: 2026-01-25*
