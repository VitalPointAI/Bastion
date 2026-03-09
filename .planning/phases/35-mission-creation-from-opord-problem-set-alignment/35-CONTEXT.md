# Phase 35: Mission Creation from OPORD & Problem Set Alignment - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Phase 33 Plan 10 document distribution so that OPORD Step 7 Paragraph 3 (Execution) can trigger tactical child problem set creation per subordinate task assignment. Auto-populate child PS with inherited context. Initialize MDMP at Receipt of Mission. Merge existing `backend/src/mission/` module into the problem set framework (missions become tactical problem sets with mission-specific metadata).

</domain>

<decisions>
## Implementation Decisions

### Mission Creation Trigger & UX
- Per-task "Create Mission" button in OPORD Step 7 Para 3, but with ability to group multiple tasks into one mission
- Drag-to-group interaction for assembling tasks into mission groups — must support ongoing editing and regrouping as OPORD evolves (iterative adventure)
- Preview & confirm modal before tactical PS creation — shows mission name (editable), inherited context summary, assigned unit, member/role assignments
- Confirmation modal includes role assignment with dropdowns for each auto-invited member (humans AND AI agents/teams)
- Mission tracker panel within Step 7 showing all missions created from this OPORD: name, status, assigned unit, link to child PS

### Inherited Context Scope
- Auto-resolve commander's intent 2 levels up by walking parentProblemSetId chain (own campaign + grandparent strategic); if grandparent doesn't exist, include parent only
- Snapshot at creation time — inherited fields copied into child PS at creation, stored in `mission_assignments` table
- If parent OPORD updates after creation, notification alerts child PS but does NOT auto-change their data (units plan against the order they received)
- Inherit 8 doctrinal fields: mission statement (task + purpose), commander's intent (2 up), task org, constraints/restraints, ROE, CCIRs, AO boundaries, timeline
- Additionally inherit relevant CCIRs and PIRs tagged for this subordinate's AO/mission
- "Request Additional CCIR/PIR" button in child PS sends RFI-style request to parent campaign J2; status tracking (Pending / Approved / Denied)

### Legacy Mission Module Merge
- Full deprecation of `backend/src/mission/` — delete entirely, no wrapper/adapter
- Missions become tactical problem sets (echelon: 'tactical') with mission-specific metadata in JSONB `metadata` column on `problem_sets` table
- Metadata stores: `{areaOfOperations: GeoJSON, missionState, activatedAt, completedAt}`
- No production data migration needed — missions table is test/dev only, clean drop
- Use existing `ECHELON_ROLE_TEMPLATES.tactical` for roles (commander, xo, s2, s3, s4, fso, member) — no legacy commander/staff/observer roles

### MDMP Initialization
- Auto-initialize MDMP at Step 1 (Receipt of Mission) when tactical PS is created — inherited OPORD context populates Step 1 fields
- Auto-draft WARNO from inherited context (situation from parent OPORD Para 1, mission statement, timeline placeholders, initial coordination) — editable and requires review/approval before distribution
- Auto-assign creator + task org members from parent OPORD — creator is NOT assumed to be commander; role assignment happens in confirmation modal
- Both human users and AI agents/teams can be assigned to roles in the confirmation modal

### Claude's Discretion
- Exact drag-to-group interaction pattern and animations
- Mission tracker panel layout within Step 7
- WARNO template structure and field mapping
- How task org members are matched to existing users in parent PS
- AI agent assignment UI details (list vs search vs categories)
- Error handling for failed PS/DAO creation

</decisions>

<specifics>
## Specific Ideas

- "When situation changes (from OSINT or other intel), AI should generate a recommendation as to whether current plan is still optimal or if time allows a new planning cycle or updates" — captured for Phase 29/38
- Drag-to-group should feel natural and support the iterative nature of OPORD development — missions will be regrouped as planning evolves, not a one-shot creation
- Creator clicking "Create Mission" may be a J3/G3 staff officer, not the mission commander — the system must not assume creator = commander

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProblemSet` type with echelon, parentProblemSetId, classification — direct foundation for tactical mission PS
- `ECHELON_ROLE_TEMPLATES.tactical` — pre-built role template (commander, xo, s2-s4, fso, member)
- `validateEchelonHierarchy()` — already validates operational→tactical parent-child relationship
- `ProblemSetStore` — full CRUD, membership, invites, activity logging
- `ProblemSetInvite` with shortCode, approval flow — reusable for mission member invitations
- JPP Step 7 `PlanOrderDevelopment.tsx` — integration point for mission creation UI
- `DocumentExport.tsx`, `DocumentVersionHistory.tsx` — Plan 33-10 components in Step 7

### Established Patterns
- Problem set creation flow: create PS → create DAO on-chain → assign roles from echelon template
- JSONB metadata pattern used elsewhere (problem_set_panel_config, etc.)
- Parent-child PS relationship via `parentProblemSetId` foreign key
- Activity logging via `ProblemSetActivity` for audit trail

### Integration Points
- `backend/src/planning/routes/document-routes.ts` — distribution endpoint to extend with mission creation trigger
- `backend/src/planning/documents/types.ts` — OPORD structure with Para 3 task assignments
- `frontend/src/components/plan/PlanOrderDevelopment.tsx` — Step 7 component to embed mission creation UI
- `backend/src/problem-set/problem-set-store.ts` — createProblemSet to call when spawning tactical PS
- Phase 34 MDMP routing — provides the tactical Plan tab workflow that new PS will use

</code_context>

<deferred>
## Deferred Ideas

- **AI-driven re-planning recommendation** — When situation changes surface (OSINT, intel updates), AI should recommend whether to reinitiate mission analysis or if current plan remains optimal given time constraints. Belongs in Phase 29 (Contextual AI staff) + Phase 38 (Inheritance Deepening).
- **Live reference inheritance** — Instead of snapshot, parent OPORD changes auto-propagate with diff view. Belongs in Phase 38 (Inheritance Deepening).
- **OSINT feed subscription inheritance** — Child PS inherits parent's OSINT feed subscriptions. Belongs in Phase 38.

</deferred>

---

*Phase: 35-mission-creation-from-opord-problem-set-alignment*
*Context gathered: 2026-03-08*
