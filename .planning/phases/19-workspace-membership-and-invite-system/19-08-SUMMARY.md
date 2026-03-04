---
phase: 19-workspace-membership-and-invite-system
plan: 08
subsystem: ui
tags: [react, typescript, workspace, react-d3-tree, compartments, member-directory, tailwind, backend-api, postgres]

# Dependency graph
requires:
  - phase: 19-07
    provides: WorkspaceDashboard, CommanderPanel, StaffPanel, ObserverPanel, WorkspaceContext
  - phase: 19-03
    provides: backend workspace REST API, workspace stores pattern
provides:
  - OrgTree: react-d3-tree interactive hierarchy with custom nodes, zoom/pan/collapse
  - MemberDirectory: compartment-filtered member list with need-to-know visibility
  - CompartmentManager: CRUD and member assignment for workspace compartments
  - WorkspaceCompartmentStore: workspace_compartments + workspace_member_compartments tables
  - Backend compartment API: 6 REST endpoints for compartment CRUD and member assignment
affects: [19-09, 19-10, workspace-ui, compartments, hierarchy-visualization]

# Tech tracking
tech-stack:
  added:
    - react-d3-tree@3.6.6 (interactive D3-based tree visualization)
  patterns:
    - Custom SVG node renderer via renderCustomNodeElement prop (not default D3 shapes)
    - Need-to-know filter: commander sees all, staff sees shared compartment + unrestricted, observer sees public roles only
    - Compartment enrichment: listCompartmentsWithMembers returns memberDids[] embedded in compartment object
    - ensureInitialized singleton pattern (consistent with workspace-member-store, workspace-invite-store)
    - buildCustomNode factory: returns custom renderer with closure over currentUserWorkspaceId + onNavigate

key-files:
  created:
    - frontend/src/components/workspace/OrgTree.tsx
    - frontend/src/components/workspace/MemberDirectory.tsx
    - frontend/src/components/workspace/CompartmentManager.tsx
    - backend/src/workspace/workspace-compartment-store.ts
  modified:
    - frontend/src/lib/workspace-service.ts
    - backend/src/api/workspaces.ts
    - frontend/package.json

key-decisions:
  - "OrgTree uses react-d3-tree v3 with custom SVG nodes — not default circles — for name/type/member count display"
  - "Custom node renderer built via factory function (buildCustomNode) taking closures over currentUserWorkspaceId and onNavigate"
  - "Need-to-know filter for MemberDirectory: 3 tiers — commander/xo sees all; staff sees shared compartment + unrestricted; observer sees only public roles"
  - "listCompartmentsWithMembers returns enriched objects (memberDids embedded) to minimize round-trips in CompartmentManager"
  - "Compartment names auto-uppercased on create (SIGINT not sigint pattern)"
  - "CompartmentManager requires manage_workspace or manage_members permission — guarded on ADMIN_ROLES=['commander','xo','team_lead']"

patterns-established:
  - "Org tree: OrgTree props are rootWorkspaceId + optional currentUserWorkspaceId + onNavigate callback"
  - "Member visibility tiers: COMMANDER_ROLES sees all > staff sees shared compartment > observer sees public roles"
  - "Backend compartment endpoints: /:id/compartments prefix with POST/GET for list+create, /:id/compartments/:cid for delete, /:id/compartments/:cid/members for assign/remove"
  - "WorkspaceCompartment type with optional memberDids[] for enriched responses"

requirements-completed: [WS-ONBOARDING, WS-HIERARCHY, WS-COMPARTMENTS]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 19 Plan 08: Org Tree + Member Directory + Compartment Manager Summary

**Interactive workspace hierarchy visualization (react-d3-tree), compartment-filtered member directory with 3-tier need-to-know visibility, and compartment CRUD manager backed by new workspace_compartments PostgreSQL tables**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T15:56:05Z
- **Completed:** 2026-03-04T16:02:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- OrgTree renders full workspace hierarchy via react-d3-tree v3 with custom SVG nodes: workspace name, type badge (color-coded Org/Unit/Team), member count, "YOU" indicator for current user's workspace
- MemberDirectory implements 3-tier need-to-know: commanders/XOs see all; staff see shared-compartment + unrestricted members; observers see only public roles (commander/xo/observer)
- CompartmentManager provides full CRUD: create compartments (auto-uppercased names), delete with confirmation, assign/remove members per compartment via inline member picker
- Backend WorkspaceCompartmentStore creates workspace_compartments + workspace_member_compartments tables with indexes; 6 new REST endpoints on workspaces router
- workspace-service.ts extended with WorkspaceCompartment interface and 6 new methods: listCompartments, createCompartment, deleteCompartment, assignMemberToCompartment, removeMemberFromCompartment, getMyCompartments

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-d3-tree and create OrgTree component** - `041c10f` (feat)
2. **Task 2: Create MemberDirectory and CompartmentManager** - `53c37f6` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `frontend/src/components/workspace/OrgTree.tsx` - Interactive hierarchy visualization; vertical orientation, step path, collapsible, custom SVG nodes with highlight for current user workspace
- `frontend/src/components/workspace/MemberDirectory.tsx` - Compartment-filtered member list; COMMANDER_ROLES=['commander','xo','team_lead'] see all; staff need-to-know; observer public-only; search/role/status filters; responsive grid
- `frontend/src/components/workspace/CompartmentManager.tsx` - Admin compartment CRUD; CompartmentCard shows assigned members with remove buttons; create form with auto-uppercase names; delete with confirmation
- `backend/src/workspace/workspace-compartment-store.ts` - WorkspaceCompartmentStore singleton; workspace_compartments + workspace_member_compartments tables; createCompartment, listCompartments, deleteCompartment, assignMember, removeMember, listMembersInCompartment, listCompartmentsForMember, listCompartmentsWithMembers
- `backend/src/api/workspaces.ts` - 6 new compartment endpoints; CreateCompartmentSchema + AssignMemberCompartmentSchema; workspaceCompartmentStore imported
- `frontend/src/lib/workspace-service.ts` - WorkspaceCompartment interface added; listCompartments, createCompartment, deleteCompartment, assignMemberToCompartment, removeMemberFromCompartment, getMyCompartments methods
- `frontend/package.json` - react-d3-tree@^3.6.6 added

## Decisions Made
- react-d3-tree v3 with custom SVG nodes rather than default D3 circles — enables showing name, type, count, and highlight in a structured card shape
- buildCustomNode factory pattern so the custom renderer can close over currentUserWorkspaceId and onNavigate without requiring React component state
- MemberDirectory uses Promise.all to build memberCompartmentMap for all members at load time (single batch vs. lazy per-card)
- listCompartmentsWithMembers fetches memberDids embedded to reduce CompartmentManager round-trips
- Compartment names forced uppercase at both creation (frontend input handler) and store insert (name.trim().toUpperCase())

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Node.js system default is v12 (too old); used nvm v24 / local tsc binary for all TypeScript verification. No code changes required.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OrgTree is a standalone component ready to embed in WorkspaceDashboard or any workspace page
- MemberDirectory and CompartmentManager complete the workspace admin UI surface
- Backend compartment tables created on-demand (ensureInitialized); no migration needed
- All compartment endpoints secured behind requireAuth + permission checks
- Compartment-based visibility can be extended in later plans as the data model is now live

## Self-Check: PASSED

All files found and both task commits verified:
- FOUND: `frontend/src/components/workspace/OrgTree.tsx`
- FOUND: `frontend/src/components/workspace/MemberDirectory.tsx`
- FOUND: `frontend/src/components/workspace/CompartmentManager.tsx`
- FOUND: `backend/src/workspace/workspace-compartment-store.ts`
- FOUND: `.planning/phases/19-workspace-membership-and-invite-system/19-08-SUMMARY.md`
- FOUND commit: `041c10f` (Task 1: OrgTree + react-d3-tree)
- FOUND commit: `53c37f6` (Task 2: MemberDirectory + CompartmentManager + backend)
- TypeScript: `tsc --noEmit` passes for both frontend and backend

---
*Phase: 19-workspace-membership-and-invite-system*
*Completed: 2026-03-04*
