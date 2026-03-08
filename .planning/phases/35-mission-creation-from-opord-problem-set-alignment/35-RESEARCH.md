# Phase 35: Mission Creation from OPORD & Problem Set Alignment - Research

**Researched:** 2026-03-08
**Domain:** OPORD-driven tactical problem set spawning, legacy mission module deprecation, MDMP initialization
**Confidence:** HIGH

## Summary

Phase 35 bridges operational planning (JPP) to tactical execution (MDMP) by enabling OPORD Paragraph 3 (Execution) task assignments to spawn child tactical problem sets. The codebase has mature foundations: `ProblemSetStore.createProblemSet()` handles off-chain record + on-chain DAO creation, `validateEchelonHierarchy()` enforces operational-to-tactical parent-child relationships, `inheritanceService.createInheritanceChain()` auto-creates subscription chains, and `MDMPWorkflowService.createWorkflow()` initializes MDMP at Phase 0. The existing `PlanOrderDevelopment.tsx` (JPP Step 7) stores `tasksToSubordinates` as a flat string -- this must be restructured into typed `SubordinateTask[]` objects that can each trigger mission creation.

The legacy `backend/src/mission/` module (Phase 4.4) has a separate `missions` table with `MissionState` lifecycle (`planning -> active -> complete -> archived`), `GeoJSONPolygon` AO, and `ParticipantRole` (`commander | staff | observer`). Per user decision, this is fully deprecated -- missions become tactical problem sets with mission-specific metadata stored in the `problem_sets.metadata` JSONB column. The `missions` table is test/dev only and can be cleanly dropped.

The key technical challenge is the "Create Mission" UX in Step 7: drag-to-group interaction for assembling subordinate tasks into mission groups, preview/confirm modal with role assignment (humans + AI agents), and a mission tracker panel. The backend needs a new `mission_assignments` table linking OPORD source to spawned tactical PS, plus a composite endpoint that creates the tactical PS, initializes MDMP at Receipt of Mission, auto-drafts WARNO from inherited context, and auto-invites task org members.

**Primary recommendation:** Build a backend `MissionCreationService` that orchestrates the full spawn flow (create tactical PS -> DAO -> roles -> inheritance chain -> MDMP workflow -> WARNO draft -> member invites -> mission_assignments record), callable from a new `/api/problem-sets/:id/missions` endpoint. Frontend adds `MissionGroupEditor`, `MissionConfirmModal`, and `MissionTracker` components to `PlanOrderDevelopment.tsx`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Per-task "Create Mission" button in OPORD Step 7 Para 3, but with ability to group multiple tasks into one mission
- Drag-to-group interaction for assembling tasks into mission groups -- must support ongoing editing and regrouping as OPORD evolves (iterative adventure)
- Preview & confirm modal before tactical PS creation -- shows mission name (editable), inherited context summary, assigned unit, member/role assignments
- Confirmation modal includes role assignment with dropdowns for each auto-invited member (humans AND AI agents/teams)
- Mission tracker panel within Step 7 showing all missions created from this OPORD: name, status, assigned unit, link to child PS
- Auto-resolve commander's intent 2 levels up by walking parentProblemSetId chain (own campaign + grandparent strategic); if grandparent doesn't exist, include parent only
- Snapshot at creation time -- inherited fields copied into child PS at creation, stored in `mission_assignments` table
- If parent OPORD updates after creation, notification alerts child PS but does NOT auto-change their data (units plan against the order they received)
- Inherit 8 doctrinal fields: mission statement (task + purpose), commander's intent (2 up), task org, constraints/restraints, ROE, CCIRs, AO boundaries, timeline
- Additionally inherit relevant CCIRs and PIRs tagged for this subordinate's AO/mission
- "Request Additional CCIR/PIR" button in child PS sends RFI-style request to parent campaign J2; status tracking (Pending / Approved / Denied)
- Full deprecation of `backend/src/mission/` -- delete entirely, no wrapper/adapter
- Missions become tactical problem sets (echelon: 'tactical') with mission-specific metadata in JSONB `metadata` column on `problem_sets` table
- Metadata stores: `{areaOfOperations: GeoJSON, missionState, activatedAt, completedAt}`
- No production data migration needed -- missions table is test/dev only, clean drop
- Use existing `ECHELON_ROLE_TEMPLATES.tactical` for roles (commander, xo, s2, s3, s4, fso, member) -- no legacy commander/staff/observer roles
- Auto-initialize MDMP at Step 1 (Receipt of Mission) when tactical PS is created -- inherited OPORD context populates Step 1 fields
- Auto-draft WARNO from inherited context (situation from parent OPORD Para 1, mission statement, timeline placeholders, initial coordination) -- editable and requires review/approval before distribution
- Auto-assign creator + task org members from parent OPORD -- creator is NOT assumed to be commander; role assignment happens in confirmation modal
- Both human users and AI agents/teams can be assigned to roles in the confirmation modal

### Claude's Discretion
- Exact drag-to-group interaction pattern and animations
- Mission tracker panel layout within Step 7
- WARNO template structure and field mapping
- How task org members are matched to existing users in parent PS
- AI agent assignment UI details (list vs search vs categories)
- Error handling for failed PS/DAO creation

### Deferred Ideas (OUT OF SCOPE)
- **AI-driven re-planning recommendation** -- When situation changes surface (OSINT, intel updates), AI should recommend whether to reinitiate mission analysis or if current plan remains optimal given time constraints. Belongs in Phase 29 (Contextual AI staff) + Phase 38 (Inheritance Deepening).
- **Live reference inheritance** -- Instead of snapshot, parent OPORD changes auto-propagate with diff view. Belongs in Phase 38 (Inheritance Deepening).
- **OSINT feed subscription inheritance** -- Child PS inherits parent's OSINT feed subscriptions. Belongs in Phase 38.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express Router | existing | REST API for mission creation endpoint | All backend routes use Express |
| ProblemSetStore | existing | createProblemSet() for tactical PS | Proven creation flow with DAO + roles |
| MDMPWorkflowService | existing | createWorkflow() for MDMP init | Mature MDMP lifecycle management |
| inheritanceService | existing | createInheritanceChain() | Auto-subscription setup |
| React + TypeScript | existing | Frontend mission creation UI | Project standard |
| zod | existing | Input validation schemas | All API routes use zod |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| problemSetInviteStore | existing | Auto-invite task org members | Member onboarding flow |
| problemSetActivityStore | existing | Audit logging for mission creation | Every state change |
| signAndSubmitFunctionCall | existing | On-chain DAO creation | PS creation requires DAO |
| jppService (frontend) | existing | Fetch Step 7 products (OPORD data) | Reading subordinate tasks |
| mdmpService (frontend) | existing | Create MDMP workflow for new PS | After tactical PS creation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB metadata on problem_sets | New missions table | JSONB avoids schema proliferation; mission-specific fields are few and well-defined |
| mission_assignments table | JSONB on problem_sets | Separate table is correct because it captures the OPORD->PS relationship and inherited snapshot data -- too large for inline JSONB |
| In-memory document routes | PostgreSQL persistence | Document routes currently use in-memory stores; mission_assignments should use PostgreSQL from the start |

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
  mission-creation/
    mission-creation-service.ts   # Orchestrator: PS + DAO + MDMP + WARNO + invites
    mission-creation-store.ts     # mission_assignments table CRUD
    mission-creation-types.ts     # MissionAssignment, CreateMissionInput types
    ccir-request-store.ts         # CCIR/PIR RFI tracking (Pending/Approved/Denied)
  api/
    problem-sets.ts               # Extended with /missions sub-routes
  problem-set/
    problem-set-store.ts          # Add metadata JSONB column migration

frontend/src/
  components/plan/
    MissionGroupEditor.tsx        # Drag-to-group task assembly in Step 7 Para 3
    MissionConfirmModal.tsx       # Preview + role assignment before creation
    MissionTracker.tsx            # Tracker panel showing created missions
    PlanOrderDevelopment.tsx      # Extended to embed mission creation UI
  lib/
    mission-creation-service.ts   # Frontend API client for mission endpoints
```

### Pattern 1: Composite Creation Orchestrator
**What:** `MissionCreationService` coordinates the multi-step creation flow as a single transaction-like operation.
**When to use:** When creating a tactical PS from an OPORD task assignment.
**Example:**
```typescript
// mission-creation-service.ts
export class MissionCreationService {
  async createMissionFromOPORD(input: CreateMissionInput, createdBy: string): Promise<MissionCreationResult> {
    // 1. Create tactical problem set
    const ps = await problemSetStore.createProblemSet({
      name: input.missionName,
      description: input.missionStatement,
      echelon: 'tactical',
      classification: input.classification,
      parentProblemSetId: input.parentProblemSetId,
      mode: input.mode,
    }, createdBy);

    // 2. On-chain DAO creation
    await signAndSubmitFunctionCall(userSecret, DAO_CONTRACT_ID, 'create_dao', { ... });

    // 3. Initialize roles from ECHELON_ROLE_TEMPLATES.tactical
    await problemSetRoleStore.initRolesForProblemSet(ps.id, 'tactical');

    // 4. Assign members per confirmation modal selections (NOT auto-commander)
    for (const assignment of input.roleAssignments) {
      await problemSetMemberStore.addMember(ps.id, assignment.did, assignment.role, assignment.daoRole, createdBy);
    }

    // 5. Create inheritance chain
    await inheritanceService.createInheritanceChain(ps.id, input.parentProblemSetId, createdBy);

    // 6. Add metadata (AO, mission state)
    await this.store.setMissionMetadata(ps.id, {
      areaOfOperations: input.areaOfOperations,
      missionState: 'planning',
    });

    // 7. Create MDMP workflow at Receipt of Mission
    const workflow = await mdmpWorkflowService.createWorkflow({
      missionId: ps.id,
      daoId: ps.daoId,
      createdBy,
    });

    // 8. Store mission assignment record (snapshot of inherited context)
    await this.store.createMissionAssignment({
      sourceOpordPsId: input.parentProblemSetId,
      targetProblemSetId: ps.id,
      taskStatement: input.taskStatement,
      purpose: input.purpose,
      commandersIntent: input.commandersIntent,
      taskOrganization: input.taskOrganization,
      constraints: input.constraints,
      ccirs: input.ccirs,
      roe: input.roe,
      areaOfOperations: input.areaOfOperations,
      timeline: input.timeline,
    });

    // 9. Auto-draft WARNO from inherited context
    await this.draftWarno(ps.id, input);

    return { problemSet: ps, workflow, missionAssignmentId: assignment.id };
  }
}
```

### Pattern 2: Structured Subordinate Tasks (Replacing Flat String)
**What:** Restructure `tasksToSubordinates` from flat string to typed array of `SubordinateTask` objects.
**When to use:** OPORD Para 3 task editing in PlanOrderDevelopment.tsx.
**Example:**
```typescript
// Current: tasksToSubordinates: string (flat text)
// New: structured array matching COADevelopment.tsx pattern
interface OPORDSubordinateTask {
  id: string;                   // UUID for drag-to-group reference
  unitId: string;               // Links to force roster / task org
  unitName: string;             // Display name
  task: string;                 // The assigned task
  purpose: string;              // Why this task
  missionGroupId?: string;      // Which mission group this belongs to (null = ungrouped)
}

interface MissionGroup {
  id: string;
  name: string;                 // Editable mission name
  taskIds: string[];            // OPORDSubordinateTask.id references
  assignedUnitId?: string;      // Primary unit for this mission
  status: 'draft' | 'created';  // Whether PS has been spawned
  childProblemSetId?: string;   // Set after PS creation
}
```

### Pattern 3: Commander's Intent 2-Up Resolution
**What:** Walk `parentProblemSetId` chain to collect commander's intent from own level + parent + grandparent.
**When to use:** During mission creation, to populate the inherited context snapshot.
**Example:**
```typescript
async function resolveCommandersIntent2Up(problemSetId: string): Promise<CommandersIntentChain> {
  const chain: CommandersIntentChain = { own: null, parent: null, grandparent: null };

  const ps = await problemSetStore.getProblemSet(problemSetId);
  if (!ps) return chain;

  // Get own campaign's commander's intent from JPP Step 2 products
  chain.own = await getCommandersIntentFromJPP(problemSetId);

  if (ps.parentProblemSetId) {
    chain.parent = await getCommandersIntentFromJPP(ps.parentProblemSetId);

    const parent = await problemSetStore.getProblemSet(ps.parentProblemSetId);
    if (parent?.parentProblemSetId) {
      chain.grandparent = await getCommandersIntentFromJPP(parent.parentProblemSetId);
    }
  }

  return chain;
}
```

### Pattern 4: Notification on Parent OPORD Update (Snapshot Integrity)
**What:** When parent OPORD updates after mission creation, notify child PS without changing data.
**When to use:** On OPORD save in parent PS, check for linked mission_assignments.
**Example:**
```typescript
// In document-routes.ts or plan save handler:
// After saving OPORD, check if any mission_assignments reference this PS
const assignments = await missionCreationStore.getAssignmentsBySource(parentPsId);
for (const assignment of assignments) {
  await problemSetActivityStore.log(
    assignment.targetProblemSetId,
    'parent_opord_updated',
    actorDid,
    null,
    { sourceOpordPsId: parentPsId, updatedFields: changedFields },
  );
  // Frontend polls activity feed and shows notification banner
}
```

### Anti-Patterns to Avoid
- **Auto-assigning creator as commander:** The user decision explicitly states creator (often J3/G3) is NOT the mission commander -- role assignment happens in the confirmation modal.
- **Live inheritance for mission context:** Snapshot at creation time is the locked decision. Do NOT build diff/merge for inherited fields.
- **Reusing legacy mission module patterns:** The old `ParticipantRole` (`commander | staff | observer`) is deprecated. Use `ECHELON_ROLE_TEMPLATES.tactical` exclusively.
- **Storing mission data outside problem_sets:** Do not create a parallel table for mission metadata. Use JSONB `metadata` column on `problem_sets` table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PS creation + DAO + roles | Custom creation flow | Existing `POST /api/problem-sets` pattern | Echelon validation, DAO creation, role init, inheritance chain all handled |
| MDMP workflow initialization | Manual phase/gate setup | `MDMPWorkflowService.createWorkflow()` | Gate registration, phase 0 setup already done |
| Role templates | Custom role definitions | `ECHELON_ROLE_TEMPLATES.tactical` | 7 roles pre-defined with DAO mappings and permissions |
| Member invitation flow | Custom invite system | `problemSetInviteStore` with shortCode | Hashed tokens, approval flow, expiration all built |
| Inheritance subscription chain | Manual subscription setup | `inheritanceService.createInheritanceChain()` | Auto-creates full ancestor chain with approved status |
| Echelon validation | Manual parent-child checks | `validateEchelonHierarchy()` | Enforces operational -> tactical constraint |

**Key insight:** The problem set creation flow is the most complex operation in the system (off-chain record + on-chain DAO + role templates + member assignment + inheritance chain + activity logging). Phase 35 should reuse all of it and add mission-specific orchestration on top.

## Common Pitfalls

### Pitfall 1: Partial Creation Failure
**What goes wrong:** PS created but DAO creation fails, leaving orphan records.
**Why it happens:** Multi-step creation without transactional guarantees across off-chain DB + on-chain NEAR.
**How to avoid:** Follow existing pattern in `POST /api/problem-sets` -- DAO failure is logged but doesn't roll back PS. Add a `status` field to mission_assignments (`creating | active | failed`) so the UI can show creation status and offer retry.
**Warning signs:** Mission tracker shows missions with no accessible child PS.

### Pitfall 2: Stale Task Data in Step 7
**What goes wrong:** User modifies subordinate tasks in OPORD, but previously created mission groups reference old task IDs.
**Why it happens:** Tasks are restructured from flat string to objects; editing can delete/recreate task objects.
**How to avoid:** Mission groups reference tasks by stable UUID. When tasks are edited, existing group assignments persist. Deleted tasks are removed from groups. UI shows warning when a grouped task is deleted.
**Warning signs:** Mission groups with zero tasks, or "task not found" errors.

### Pitfall 3: Commander's Intent 2-Up Resolution Fails
**What goes wrong:** Grandparent strategic PS exists but has no commander's intent saved in JPP products.
**Why it happens:** Strategic PS may not use JPP (Phase 36 strategic guidance workflow is not yet built).
**How to avoid:** Gracefully handle missing commander's intent at any level. Include what's available, mark gaps. Strategic PS may store intent in a different format (operational design, not JPP Step 2).
**Warning signs:** Empty or null commander's intent fields in inherited context preview.

### Pitfall 4: MDMP Workflow Keyed to Wrong ID
**What goes wrong:** MDMP workflow is created with `missionId` = old-style `MSN-{uuid}` instead of new `PS-{uuid}`.
**Why it happens:** Legacy `MDMPWorkflowService` uses `missionId` parameter name.
**How to avoid:** Pass the tactical PS ID as the `missionId` parameter. The MDMP service uses it as a key, not as a validated mission table reference. Confirm `createWorkflow()` doesn't query the missions table.
**Warning signs:** Workflow creation succeeds but MDMP UI can't find the workflow for the new PS.

### Pitfall 5: AI Agent Assignment Without Valid DIDs
**What goes wrong:** Confirmation modal allows assigning AI agents to roles, but agents don't have NEAR accounts/DIDs in the expected format.
**Why it happens:** AI agents use synthetic DIDs (`did:near:agent-{id}`) that may not have on-chain accounts.
**How to avoid:** Check existing agent DID patterns in the codebase. Ensure `signAndSubmitFunctionCall` for `add_member` handles agent DIDs. May need to skip on-chain role assignment for AI agents and only record off-chain membership.
**Warning signs:** DAO `add_member` transaction failures for agent accounts.

## Code Examples

### Database Schema: mission_assignments Table
```sql
-- Source: architecture doc + CONTEXT.md decisions
CREATE TABLE IF NOT EXISTS mission_assignments (
    id TEXT PRIMARY KEY,
    source_opord_ps_id TEXT NOT NULL REFERENCES problem_sets(id),
    target_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) UNIQUE,
    task_ids TEXT[] NOT NULL,                      -- OPORD subordinate task IDs grouped into this mission
    task_statement TEXT NOT NULL,
    purpose TEXT NOT NULL,
    commanders_intent JSONB,                       -- 2-up chain snapshot
    task_organization JSONB,
    constraints JSONB,
    ccirs JSONB,
    roe_references TEXT[],
    area_of_operations JSONB,                      -- GeoJSON
    timeline JSONB,
    warno_drafted BOOLEAN DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_assignment_source ON mission_assignments(source_opord_ps_id);
CREATE INDEX IF NOT EXISTS idx_mission_assignment_target ON mission_assignments(target_problem_set_id);
```

### Database Schema: problem_sets metadata column
```sql
-- Add JSONB metadata column for mission-specific data
ALTER TABLE problem_sets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Mission tactical PS metadata shape:
-- {
--   "areaOfOperations": { "type": "Polygon", "coordinates": [...] },
--   "missionState": "planning" | "active" | "complete" | "archived",
--   "activatedAt": "ISO timestamp",
--   "completedAt": "ISO timestamp"
-- }
```

### Database Schema: CCIR/PIR Request Tracking
```sql
CREATE TABLE IF NOT EXISTS ccir_requests (
    id TEXT PRIMARY KEY,
    requesting_ps_id TEXT NOT NULL REFERENCES problem_sets(id),
    target_ps_id TEXT NOT NULL REFERENCES problem_sets(id),
    request_type TEXT NOT NULL,     -- 'ccir' | 'pir'
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied'
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    response_data JSONB,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### WARNO Auto-Draft Template
```typescript
// WARNO template structure from FM 5-0
interface WARNODraft {
  // Para 1: Situation
  situation: string;              // From parent OPORD Para 1 (situation summary)
  // Para 2: Mission (or interim task/purpose)
  mission: string;                // From grouped task statements
  // Para 3: General Instructions
  generalInstructions: {
    timeline: string;             // Placeholder: "Timeline TBD pending mission analysis"
    initialCoordination: string;  // "Report to [parent PS] for coordination NLT [time]"
    movementInstructions: string; // Placeholder
  };
  // Para 4: Service Support
  serviceSupport: string;         // "IAW parent OPORD Para 4"
  // Para 5: Command & Signal
  commandSignal: {
    commandPost: string;          // Placeholder
    succession: string[];         // From task org
    frequency: string;            // "IAW parent OPORD Annex H"
  };
  // Metadata
  draftedAt: string;
  status: 'draft' | 'reviewed' | 'approved';
  reviewedBy?: string;
  approvedBy?: string;
}
```

### Frontend: Structured Subordinate Tasks Migration
```typescript
// PlanOrderDevelopment.tsx - restructure Para 3 Execution
// Before: execution.tasksToSubordinates: string (textarea)
// After:  execution.subordinateTasks: OPORDSubordinateTask[]

interface OPORDSubordinateTask {
  id: string;
  unitId: string;
  unitName: string;
  task: string;
  purpose: string;
  missionGroupId: string | null;
}

interface MissionGroup {
  id: string;
  name: string;
  taskIds: string[];
  status: 'draft' | 'created';
  childProblemSetId: string | null;
}

// Save format in JPP Step 7 products:
interface Step7ExecutionContent {
  conceptOfOperations: string;
  subordinateTasks: OPORDSubordinateTask[];
  missionGroups: MissionGroup[];
  coordinatingInstructions: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate missions table | Tactical PS with JSONB metadata | Phase 35 | Unified hierarchy, single permission model |
| ParticipantRole (commander/staff/observer) | ECHELON_ROLE_TEMPLATES.tactical | Phase 23 | 7 doctrinal roles with DAO permissions |
| Flat tasksToSubordinates string | Structured OPORDSubordinateTask[] | Phase 35 | Enables per-task mission creation |
| Mission invite system | ProblemSetInvite with shortCode | Phase 19 | Unified invite flow with approval |

**Deprecated/outdated:**
- `backend/src/mission/mission-store.ts`: Full delete -- replaced by problem set framework
- `backend/src/mission/participant-store.ts`: Full delete -- replaced by problemSetMemberStore
- `backend/src/mission/invite-store.ts`: Full delete -- replaced by problemSetInviteStore
- `backend/src/mission/schemas.ts`: Full delete -- replaced by zod schemas in mission-creation module
- `backend/src/mission/types.ts`: Full delete -- MissionState moves to problem_sets metadata; GeoJSONPolygon reused from existing types

## Open Questions

1. **How does the MDMP workflow service handle `missionId` = `PS-{uuid}` format?**
   - What we know: `createWorkflow()` takes `missionId` as a string key. The in-memory `Map<string, MDMPWorkflowState>` uses it as-is.
   - What's unclear: Whether any MDMP route or query joins against the `missions` table using this ID.
   - Recommendation: Grep all MDMP code for missions table references. If none, PS ID works directly. If found, update those references.

2. **How are AI agent DIDs structured for role assignment?**
   - What we know: Agents are defined in agent libraries with character IDs. Problem set members use `did:near:{accountId}` format.
   - What's unclear: Whether AI agents have actual NEAR accounts or use synthetic DIDs that can't interact with on-chain DAOs.
   - Recommendation: Check agent member assignment patterns from Phase 16 (AI-assigned staff workspaces). Likely need off-chain-only membership for agents (skip `add_member` DAO call).

3. **Where does ROE data live for inheritance?**
   - What we know: `ROERule` type exists with `missionId` FK. ROE rules are stored per-mission.
   - What's unclear: Whether ROE rules are attached to the operational PS (via JPP) and can be queried for inheritance.
   - Recommendation: ROE inheritance may just be text references (rule names/categories) rather than full rule objects. The `roe_references TEXT[]` column in mission_assignments stores reference identifiers.

4. **Step 7 product storage format for structured tasks**
   - What we know: JPP step products are stored via `jppService.addStepProduct()` as `content: Record<string, unknown>` JSONB.
   - What's unclear: Whether changing `tasksToSubordinates` from string to object array will break existing saved data.
   - Recommendation: Handle both formats in `extractPlanData()` -- if `tasksToSubordinates` is a string, treat as legacy and show migration prompt. If it's an array, use structured format.

## Sources

### Primary (HIGH confidence)
- `backend/src/problem-set/problem-set-store.ts` -- createProblemSet() flow, table schema, JSONB patterns
- `backend/src/problem-set/types.ts` -- ProblemSet, CreateProblemSetInput, ECHELON_ROLE_TEMPLATES, validateEchelonHierarchy
- `backend/src/api/problem-sets.ts` -- Full PS creation route including DAO, roles, inheritance, activity
- `backend/src/mission/mission-store.ts` -- Legacy mission module to deprecate
- `backend/src/mission/types.ts` -- Legacy types (MissionState, GeoJSONPolygon) to absorb
- `backend/src/mdmp/workflow-service.ts` -- createWorkflow(), MDMPWorkflowState
- `backend/src/mdmp/types.ts` -- MDMPPhase enum
- `backend/src/planning/types.ts` -- SubordinateTask, ExecutionParagraph, CommandersIntent
- `frontend/src/components/plan/PlanOrderDevelopment.tsx` -- Step 7 component, current FiveParagraphOrder structure
- `frontend/src/components/plan/COADevelopment.tsx` -- SubordinateTask pattern (unitId, task, purpose)
- `backend/src/planning/routes/document-routes.ts` -- Distribution endpoint, version lifecycle
- `.planning/architecture/problem-set-hierarchy-and-planning-methodologies.md` -- mission_assignments table design
- `.planning/phases/34-plan-tab-echelon-routing-mdmp-tactical-wiring/34-RESEARCH.md` -- MDMP routing context

### Secondary (MEDIUM confidence)
- `backend/src/problem-set/problem-set-subscription-store.ts` -- Inheritance subscription pattern
- `backend/src/mdmp/integration.ts` -- MDMP orchestrator, WorkflowInitParams

### Tertiary (LOW confidence)
- AI agent DID format and DAO membership -- needs validation against Phase 16 implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components exist in codebase, patterns are established
- Architecture: HIGH -- clear extension of existing PS creation flow + MDMP init
- Pitfalls: HIGH -- identified from direct code analysis of creation flows and data models
- Legacy deprecation: HIGH -- mission module is small, test-only, clean removal
- Drag-to-group UX: MEDIUM -- interaction pattern is Claude's discretion, no existing precedent in codebase
- AI agent role assignment: LOW -- need to verify agent DID handling in DAO operations

**Research date:** 2026-03-08
**Valid until:** 2026-04-07 (stable domain, internal codebase)
