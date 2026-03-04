# Phase 19: Workspace Membership and Invite System - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a DAO-backed workspace membership and invite system. Workspaces are on-chain DAOs organized in a 3-level military hierarchy (Organization → Unit → Team). Users can belong to multiple workspaces with one primary. Missions and exercises nest under workspaces. Invitations use token-based links with clearance validation. Members have role-specific views and compartmented access.

</domain>

<decisions>
## Implementation Decisions

### Workspace Model
- Workspace = DAO — every workspace is an on-chain NEAR DAO from creation
- Two-tier structure: Org-level DAOs are persistent groups; missions are sub-workspaces within orgs
- 3-level max hierarchy: Organization → Unit → Team, all on-chain as separate DAOs with parent references
- Military-style naming convention (Organization/Unit/Team)
- Users can belong to multiple orgs, designate one as primary (sidebar workspace switcher)
- Missions AND exercises nest under workspaces (both become workspace children)
- Workspaces are clearance-gated — classification level (UNCLASSIFIED/SECRET/TOPSECRET) restricts who can join
- Mission access within a workspace is configurable: open to all org members, or invite-only (default: open)
- Parent membership grants visibility into child workspaces but NOT automatic join access — explicit invite required to interact

### Membership & Roles
- Hybrid role model: DAO permission system as backend, military rank labels as presentation layer
- Predefined role templates for military staff sections (CO, XO, S1-S9) auto-created on workspace setup, plus ability to add/remove/customize roles
- Role per level — users can have different roles at each hierarchy level (Commander at Org, Observer at Team)
- AI agents are first-class workspace members with DID-based membership and assigned roles
- Role-based delegation for member management — members with 'manage_members' permission can assign roles up to their own level
- Members can be suspended (access revoked, membership preserved) without full removal
- All role changes recorded on-chain as DAO transactions, plus off-chain activity log with richer context (who, why, when, approved by)
- Need-to-know compartmentalization within workspaces — certain content/missions restricted to members with specific access flags, beyond classification level

### Invite Flow
- Extend existing mission invite pattern: token-based (SHA-256 hashed), expiring, generalized for workspaces
- Support DID + email targeting (reuse existing InviteModal patterns)
- Invite acceptance mode configurable per workspace: 'open' (link sufficient) or 'gated' (admin approval required)
- Workspace discoverability configurable: 'discoverable' (allows join requests) or 'private' (invite-only), default private
- Invite specifies role; acceptance blocked if invitee's clearance doesn't match workspace classification level
- Register-then-join flow for non-account users: redirect to registration → auto-accept invite → land in workspace

### Onboarding Experience
- Role-tailored dashboard with shared base elements: common activity feed + role-specific content panels
  - Commander: activity feed + pending decisions, command overview
  - S2 (Intelligence): activity feed + S2-specific intelligence content
  - Observer: activity feed + read-only mission list
- Workspace switching always lands on dashboard (no state restoration)
- Cross-workspace notifications: badge/indicator on workspace switcher showing unread activity in other workspaces
- Interactive org tree view on dashboard showing hierarchy with member counts and user's position highlighted
- Compartmented member directory: members only see others in their compartment or who they need to know about
- Role-based activity feed visibility: Commanders see everything, staff sees joins/departures, observers see summary only

### Claude's Discretion
- Exact DAO smart contract structure for workspace hierarchy
- Token expiration defaults and options
- Org tree visualization library/component choice
- Dashboard layout and spacing
- Notification polling/WebSocket approach
- Database schema for off-chain activity logs

</decisions>

<specifics>
## Specific Ideas

- Dashboard should feel role-specific but share a common base — like a CMS dashboard that adapts to user role, not completely different pages per role
- Workspace switcher in sidebar, like Slack/Discord workspace selector
- Military staff section templates (CO, XO, S1-S9) provide a fast setup experience — create workspace, pick template, assign people
- Compartmentalization goes beyond classification — need-to-know flags on specific content within a workspace

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/mission/InviteModal.tsx`: Full invite creation UI with DID/email targeting, role selection, expiration picker, link copy — can be generalized for workspace invites
- `backend/src/mission/invite-store.ts`: Token-based invite storage with SHA-256 hashing, expiration checking — proven pattern to extend
- `backend/src/mission/participant-store.ts`: Participant CRUD with unique constraint on (entity_id, user_did) — reusable pattern
- `frontend/src/lib/mission-service.ts`: Client API for invite lifecycle (create, accept, list, cancel) — pattern to replicate
- `backend/src/dao/types.ts`: DAO Role type with permissions array, humans_only flag, clearance levels, agent tier limits — direct reuse for workspace roles
- `frontend/src/hooks/useAuth.tsx` + `frontend/src/context/UserContext.tsx`: Auth/identity primitives (DID, accountId, clearance)
- `backend/src/near/tx-signer.ts`: NEAR transaction signing infrastructure for on-chain operations

### Established Patterns
- Singleton store classes with lazy initialization and `ensureInitialized()` pattern
- `X-DID` header for authenticated API calls
- DID format: `did:near:{accountId}` via `backend/src/identity/did-service.ts`
- Frontend service classes with typed methods and static instances
- Passkey + NEAR implicit account auth via `@vitalpoint/near-phantom-auth`
- Exercise role system with information barriers (blue_staff/red_cell/exercise_control) — exercise roles must integrate with workspace roles
- AutonomyLevel enum for AI agent delegation levels

### Integration Points
- Navigation architecture: Decide/Design/Campaign/Monitor + Admin tabs — workspace switcher goes in sidebar above these
- DAO smart contracts: Existing governance infrastructure for proposals, voting, roles
- Classification system: Already present on missions (UNCLASSIFIED/SECRET/TOPSECRET) — extend to workspaces
- Exercise scenarios: Currently standalone — need workspace_id foreign key
- Mission participants: Currently mission-level — workspace membership becomes the parent authority

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-workspace-membership-and-invite-system*
*Context gathered: 2026-03-04*
