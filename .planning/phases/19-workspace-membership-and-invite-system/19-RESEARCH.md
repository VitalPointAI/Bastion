# Phase 19: Workspace Membership and Invite System - Research

**Researched:** 2026-03-04
**Domain:** DAO-backed workspace governance, NEAR on-chain membership, PostgreSQL off-chain activity logs, token-based invite flows, role-specific React dashboards
**Confidence:** HIGH (codebase is primary source; all patterns verified against existing code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Workspace Model
- Workspace = DAO — every workspace is an on-chain NEAR DAO from creation
- Two-tier structure: Org-level DAOs are persistent groups; missions are sub-workspaces within orgs
- 3-level max hierarchy: Organization → Unit → Team, all on-chain as separate DAOs with parent references
- Military-style naming convention (Organization/Unit/Team)
- Users can belong to multiple orgs, designate one as primary (sidebar workspace switcher)
- Missions AND exercises nest under workspaces (both become workspace children)
- Workspaces are clearance-gated — classification level (UNCLASSIFIED/SECRET/TOPSECRET) restricts who can join
- Mission access within a workspace is configurable: open to all org members, or invite-only (default: open)
- Parent membership grants visibility into child workspaces but NOT automatic join access — explicit invite required to interact

#### Membership & Roles
- Hybrid role model: DAO permission system as backend, military rank labels as presentation layer
- Predefined role templates for military staff sections (CO, XO, S1-S9) auto-created on workspace setup, plus ability to add/remove/customize roles
- Role per level — users can have different roles at each hierarchy level (Commander at Org, Observer at Team)
- AI agents are first-class workspace members with DID-based membership and assigned roles
- Role-based delegation for member management — members with 'manage_members' permission can assign roles up to their own level
- Members can be suspended (access revoked, membership preserved) without full removal
- All role changes recorded on-chain as DAO transactions, plus off-chain activity log with richer context (who, why, when, approved by)
- Need-to-know compartmentalization within workspaces — certain content/missions restricted to members with specific access flags, beyond classification level

#### Invite Flow
- Extend existing mission invite pattern: token-based (SHA-256 hashed), expiring, generalized for workspaces
- Support DID + email targeting (reuse existing InviteModal patterns)
- Invite acceptance mode configurable per workspace: 'open' (link sufficient) or 'gated' (admin approval required)
- Workspace discoverability configurable: 'discoverable' (allows join requests) or 'private' (invite-only), default private
- Invite specifies role; acceptance blocked if invitee's clearance doesn't match workspace classification level
- Register-then-join flow for non-account users: redirect to registration → auto-accept invite → land in workspace

#### Onboarding Experience
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 19 builds a DAO-backed workspace membership system on top of an already well-developed NEAR DAO contract and invite infrastructure. The NEAR contract (`near-contracts/src/dao/`) already supports hierarchical DAOs via `DAORelationship.parent_dao_id` and `set_dao_parent()`, making the 3-level hierarchy (Organization → Unit → Team) contractually achievable without new contract code — only a new `create_dao` call with the correct `parent_dao_id` in the `DAOConfig`. Default roles (`council`, `member`, `agent`) are auto-created on DAO creation; military staff section roles (Commander, XO, S1–S9) will be an additional initialization step done off-chain via the `assign_role` transaction builder, stored in a new off-chain workspace roles table that maps military labels to DAO role names.

The invite system is a direct extension of the proven `InviteStore` / `ParticipantStore` pattern. A new `workspace_invites` table mirrors `mission_invites`, and a new `workspace_members` table mirrors `mission_participants`, but scoped to workspace_id (DAO ID). Clearance gating at invite acceptance is already present as a concept in `dao/roles.rs` (`required_clearance` per role) — the backend accept-invite handler just needs to verify the acceptor's clearance level against the workspace classification before calling `buildAddMemberTx`.

The frontend requires the most new work: a workspace switcher sidebar (Slack/Discord pattern), a workspace dashboard with role-specific panels, a member directory with compartment filtering, and an org tree visualization. The existing `ExerciseDashboard` composite-panel pattern and `InviteModal` provide strong templates. For the org tree, a lightweight React tree library (`react-d3-tree` or `@xyflow/react` minimal usage) is recommended; this is Claude's discretion.

**Primary recommendation:** Build workspace infrastructure as a set of new store classes (`workspace-store.ts`, `workspace-invite-store.ts`, `workspace-member-store.ts`, `workspace-activity-store.ts`) following the singleton `ensureInitialized()` pattern, backed by new PostgreSQL tables, with DAO on-chain calls delegated through the existing `DAOService`/`tx-signer` infrastructure. Frontend adds a `WorkspaceContext`, sidebar switcher, and a composable dashboard that renders role-specific panels on top of a shared activity feed base.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` (Pool) | existing | PostgreSQL off-chain store | All existing stores use this; `getPool()` singleton |
| `@near-js/providers` | existing | NEAR RPC view calls | Used in `DAOService` |
| `@near-js/accounts` | existing | NEAR tx submission | Used in `tx-signer.ts` |
| `@noble/hashes` | existing | SHA-256 token hashing | Used in `InviteStore` |
| `crypto` (Node built-in) | existing | UUID + random bytes | Used in `InviteStore`, `ParticipantStore` |
| `react-router-dom` | existing | Frontend routing | App.tsx routing |
| `zod` | existing | Input validation schemas | `MissionInputSchema` pattern |

### Supporting (new additions)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-d3-tree` | `^3.6` | Org tree visualization | Lightweight SVG tree; no D3 peer dep conflicts |
| `@xyflow/react` (minimal) | `^12` | Alternative org tree | Use if react-d3-tree insufficient for interactive hierarchy |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-d3-tree` | Hand-rolled SVG | react-d3-tree handles zoom, pan, node positioning; hand-rolled is hours of work for same result |
| `react-d3-tree` | `@xyflow/react` | xyflow is heavier (full flow editor); use only if drag-to-rearrange hierarchy is needed |
| PostgreSQL polling | WebSocket push | Polling (3-5s interval) is simpler and sufficient for notification badges; WebSocket adds complexity |

**Installation (new dependency only):**
```bash
cd frontend && pnpm add react-d3-tree
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── workspace/
│   ├── workspace-store.ts          # Workspace CRUD (wraps DAO creation)
│   ├── workspace-member-store.ts   # Member CRUD (wraps DAO add/remove member tx)
│   ├── workspace-invite-store.ts   # Token-based invite lifecycle
│   ├── workspace-activity-store.ts # Off-chain activity log
│   ├── workspace-role-store.ts     # Military label → DAO role mapping
│   └── types.ts                    # Workspace, WorkspaceMember, WorkspaceInvite types
├── api/
│   └── workspaces.ts               # REST routes: /api/workspaces/*
└── (existing: dao/, near/, lib/, auth/ unchanged)

frontend/src/
├── context/
│   └── WorkspaceContext.tsx        # Active workspace + user membership state
├── components/
│   └── workspace/
│       ├── WorkspaceSwitcher.tsx   # Sidebar workspace selector (Slack pattern)
│       ├── WorkspaceDashboard.tsx  # Role-adaptive dashboard shell
│       ├── ActivityFeed.tsx        # Shared base: chronological activity log
│       ├── CommanderPanel.tsx      # Commander-specific: pending decisions + command overview
│       ├── StaffPanel.tsx          # Staff-specific: role content panels
│       ├── ObserverPanel.tsx       # Observer-specific: read-only mission list
│       ├── OrgTree.tsx             # react-d3-tree hierarchy visualization
│       ├── MemberDirectory.tsx     # Compartment-filtered member list
│       ├── WorkspaceInviteModal.tsx # Generalized from InviteModal.tsx
│       ├── CreateWorkspaceWizard.tsx # Org/Unit/Team creation flow
│       └── WorkspaceMemberManager.tsx # Role assignment, suspend, remove
└── lib/
    └── workspace-service.ts        # API client (mirrors mission-service.ts pattern)
```

### Pattern 1: Workspace Store (extends existing singleton pattern)

**What:** Every workspace store class follows the same `ensureInitialized()` lazy-init pattern.
**When to use:** All backend store classes in this phase.

```typescript
// Source: Verified against backend/src/mission/invite-store.ts, participant-store.ts
import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

export class WorkspaceStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspaceTables();
      this.initialized = true;
    }
  }

  async createWorkspace(input: CreateWorkspaceInput, createdBy: string): Promise<Workspace> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `WS-${randomUUID()}`;
    // ... INSERT INTO workspaces ...
    return workspace;
  }
}

export const workspaceStore = new WorkspaceStore();
```

### Pattern 2: On-Chain DAO Creation via DAOService (existing contract)

**What:** Workspace creation calls `buildCreateDAOTx` on the existing DAO contract. The backend builds the TX args and either signs via `signAndSubmitFunctionCall` or returns args for frontend signing.
**When to use:** `POST /api/workspaces` — workspace creation triggers a DAO creation on-chain.

```typescript
// Source: Verified against backend/src/dao/dao-service.ts + near/tx-signer.ts
import { getDAOService } from '../dao/dao-service.js';
import { signAndSubmitFunctionCall } from '../near/tx-signer.js';
import { deriveUserSecretFromAccount } from '../near/user-secret.js';
import { Classification, AutonomyLevel } from '../dao/types.js';

async function createWorkspaceDAO(
  input: CreateWorkspaceInput,
  creatorAccountId: string
): Promise<{ daoId: string; txHash: string }> {
  const daoService = getDAOService();
  const userSecret = deriveUserSecretFromAccount(creatorAccountId);

  // DAO ID = workspace ID (e.g., "ws-org-{uuid}" or slugified name)
  const daoId = `ws-${input.type.toLowerCase()}-${randomUUID()}`;

  const config = {
    name: input.name,
    description: input.description || '',
    classification: mapClassification(input.classification),
    default_autonomy_level: AutonomyLevel.NotAutonomous,
    proposal_bond: '0',           // No bond for workspace governance initially
    voting_period_ns: '604800000000000', // 7 days in nanoseconds
    parent_dao_id: input.parentDaoId || null,
  };

  // Sign and submit via server-side signing (same as tx-signer.ts pattern)
  const result = await signAndSubmitFunctionCall(
    userSecret,
    process.env.DAO_CONTRACT_ID!,
    'create_dao',
    { dao_id: daoId, config },
  );

  if (!result.success) throw new Error(result.error);

  // After DAO created, set parent relationship if nested
  if (input.parentDaoId) {
    await signAndSubmitFunctionCall(
      userSecret,
      process.env.DAO_CONTRACT_ID!,
      'set_dao_parent',
      { child_dao_id: daoId, parent_dao_id: input.parentDaoId },
    );
  }

  return { daoId, txHash: result.txHash! };
}
```

### Pattern 3: Military Role Templates (new initialization step)

**What:** After DAO creation, assign military staff section role templates by calling `assign_role` on the contract. Military labels map to DAO role names in an off-chain table.
**When to use:** On workspace creation, immediately after `create_dao` succeeds.

```typescript
// Source: Inferred from backend/src/exercise/types.ts STAFF_ROLE_CONFIG + dao/dao-service.ts buildAssignRoleTx

const MILITARY_ROLE_TEMPLATES = {
  Organization: ['commander', 'xo', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'],
  Unit: ['commander', 'xo', 's2', 's3', 's4'],
  Team: ['team_lead', 'member', 'observer'],
};

// Each military role gets created as a custom DAO role via create_proposal(AddMember)
// or directly via assign_role. The mapping is stored off-chain:
//
// workspace_roles table:
//   workspace_id, military_label, dao_role_name, permissions[], created_at
```

### Pattern 4: Invite Store Extension

**What:** `WorkspaceInviteStore` mirrors `InviteStore` exactly, substituting `workspace_id` for `mission_id`. Clearance check added at accept time.
**When to use:** All invite operations for workspace membership.

```typescript
// Source: Verified against backend/src/mission/invite-store.ts

async acceptInvite(token: string, acceptorDid: string, acceptorClearance: string): Promise<WorkspaceInvite | null> {
  const invite = await this.getInviteByToken(token);
  if (!invite) return null;

  // NEW: clearance gate — check workspace classification vs acceptor clearance
  const workspace = await workspaceStore.getWorkspace(invite.workspaceId);
  if (!clearanceSufficient(acceptorClearance, workspace.classification)) {
    throw new Error('Insufficient clearance for this workspace');
  }

  // Check gated vs open mode
  if (workspace.inviteMode === 'gated' && !invite.approvedAt) {
    throw new Error('This workspace requires admin approval');
  }

  // On-chain: buildAddMemberTx
  await signAndSubmitFunctionCall(userSecret, DAO_CONTRACT_ID, 'add_member', {
    dao_id: workspace.daoId,
    account_id: acceptorAccountId,
    roles: [invite.role],
  });

  // Off-chain: insert into workspace_members
  await workspaceMemberStore.addMember(invite.workspaceId, acceptorDid, invite.role, invite.createdBy);

  return { ...invite, acceptedAt: new Date() };
}
```

### Pattern 5: WorkspaceContext (frontend auth extension)

**What:** A React context that tracks the active workspace and the current user's memberships. Sits alongside `UserContext`.
**When to use:** App-level provider; consumed by WorkspaceSwitcher, WorkspaceDashboard.

```typescript
// Source: Pattern from frontend/src/context/UserContext.tsx

interface WorkspaceContextType {
  activeWorkspaceId: string | null;
  memberships: WorkspaceMembership[];      // All workspaces user belongs to
  primaryWorkspaceId: string | null;       // User's designated primary
  activeWorkspace: WorkspaceDetail | null; // Full data for active workspace
  userRoleInActive: string | null;         // User's role in active workspace
  setActiveWorkspace: (id: string) => void;
  notificationCounts: Record<string, number>; // workspace_id -> unread count
}
```

### Pattern 6: Role-Adaptive Dashboard (composite panel pattern)

**What:** `WorkspaceDashboard` renders a shared `ActivityFeed` plus a role-specific panel selected by the user's role string. No separate pages per role — one component with conditional panel rendering.
**When to use:** The workspace dashboard route.

```typescript
// Source: Pattern from frontend/src/components/exercise/ExerciseDashboard.tsx composite layout

function WorkspaceDashboard() {
  const { activeWorkspace, userRoleInActive } = useWorkspace();

  const RolePanel = useMemo(() => {
    if (!userRoleInActive) return ObserverPanel;
    if (userRoleInActive === 'commander') return CommanderPanel;
    if (INTELLIGENCE_ROLES.includes(userRoleInActive)) return S2IntelPanel;
    return StaffPanel; // generic staff panel with role label
  }, [userRoleInActive]);

  return (
    <div className="workspace-dashboard">
      <OrgTree workspaceId={activeWorkspace?.id} />
      <ActivityFeed workspaceId={activeWorkspace?.id} userRole={userRoleInActive} />
      <RolePanel workspaceId={activeWorkspace?.id} />
    </div>
  );
}
```

### Pattern 7: Workspace Switcher (sidebar, Slack pattern)

**What:** A vertical list of workspace icons/abbreviations in the left sidebar with notification badges. Clicking switches active workspace and redirects to `/workspace/{id}`.
**When to use:** Always visible for authenticated users in the main app layout.

```typescript
// Source: Pattern inferred from App.tsx nav + UserContext

function WorkspaceSwitcher() {
  const { memberships, activeWorkspaceId, setActiveWorkspace, notificationCounts } = useWorkspace();

  return (
    <aside className="workspace-switcher">
      {memberships.map(ws => (
        <WorkspaceIcon
          key={ws.workspaceId}
          workspace={ws}
          isActive={ws.workspaceId === activeWorkspaceId}
          unreadCount={notificationCounts[ws.workspaceId] || 0}
          onClick={() => setActiveWorkspace(ws.workspaceId)}
        />
      ))}
      <CreateWorkspaceButton />
    </aside>
  );
}
```

### Anti-Patterns to Avoid

- **Separate pages per role:** Do NOT create `/workspace/commander`, `/workspace/s2`. Use a single `WorkspaceDashboard` that conditionally renders panels — this is the "CMS dashboard that adapts" pattern the user requested.
- **Auto-joining child workspaces on parent join:** Parent membership = visibility only, NOT access. The invite-then-join gate must be explicit at each level.
- **Polling too frequently for notifications:** 5-second intervals for notification badge counts are sufficient. Do not open WebSocket connections for this.
- **Storing raw tokens:** Only the SHA-256 hash of the token goes in the DB (proven pattern from `InviteStore`).
- **Rebuilding DAO interaction from scratch:** The `DAOService` class in `backend/src/dao/dao-service.ts` already has all the tx builders (`buildAddMemberTx`, `buildAssignRoleTx`, `buildCreateDAOTx`). Use these — do not call the contract directly.
- **Skipping on-chain writes for role changes:** The user decision is explicit: all role changes must fire a DAO transaction AND write an off-chain activity log entry. Never skip the on-chain step.

---

## Database Schema

### New Tables Required

```sql
-- Primary workspace registry (off-chain mirror of on-chain DAOs)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,                    -- "WS-{uuid}"
  dao_id TEXT NOT NULL UNIQUE,            -- On-chain DAO ID
  name TEXT NOT NULL,
  description TEXT,
  workspace_type TEXT NOT NULL,           -- 'Organization' | 'Unit' | 'Team'
  classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED', -- 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET'
  parent_workspace_id TEXT REFERENCES workspaces(id),
  invite_mode TEXT NOT NULL DEFAULT 'gated', -- 'open' | 'gated'
  discoverability TEXT NOT NULL DEFAULT 'private', -- 'discoverable' | 'private'
  created_by TEXT NOT NULL,               -- DID of creator
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workspace_parent ON workspaces(parent_workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_classification ON workspaces(classification);

-- Workspace members (off-chain mirror of on-chain DAO membership)
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,                    -- "WM-{uuid}"
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_did TEXT NOT NULL,
  role TEXT NOT NULL,                     -- Military label: 'commander', 's2', 'observer', etc.
  dao_role TEXT NOT NULL,                 -- On-chain DAO role name: 'council', 'member', 'agent'
  is_primary BOOLEAN NOT NULL DEFAULT false, -- User's primary workspace flag
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended'
  suspended_at TIMESTAMPTZ,
  suspended_by TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by TEXT NOT NULL,
  UNIQUE(workspace_id, user_did)
);
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_did);
CREATE INDEX IF NOT EXISTS idx_wm_primary ON workspace_members(user_did, is_primary);

-- Workspace invites (extends mission_invites pattern)
CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,                    -- "WI-{uuid}"
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,             -- SHA-256 hashed
  invitee_email TEXT,
  invitee_did TEXT,
  role TEXT NOT NULL,                     -- Military role label
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,               -- For gated workspaces: admin approval timestamp
  approved_by TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wi_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wi_token ON workspace_invites(token);

-- Off-chain activity log (richer than on-chain, not a replacement)
CREATE TABLE IF NOT EXISTS workspace_activity (
  id TEXT PRIMARY KEY,                    -- "WA-{uuid}"
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,            -- 'member_joined' | 'member_removed' | 'role_changed' | 'mission_created' | 'invite_sent' | 'member_suspended' | etc.
  actor_did TEXT NOT NULL,               -- Who performed the action
  subject_did TEXT,                      -- Who was affected (if applicable)
  metadata JSONB NOT NULL DEFAULT '{}',  -- Role changes, old/new values, reason, tx_hash
  tx_hash TEXT,                          -- On-chain tx hash for auditable actions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_workspace ON workspace_activity(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_created ON workspace_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_actor ON workspace_activity(actor_did);

-- Compartment access flags (need-to-know beyond classification)
CREATE TABLE IF NOT EXISTS workspace_compartments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g., 'SIGINT', 'HUMINT', 'OP-PLAN-X'
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS workspace_member_compartments (
  member_id TEXT NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
  compartment_id TEXT NOT NULL REFERENCES workspace_compartments(id) ON DELETE CASCADE,
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, compartment_id)
);

-- Foreign key: missions link to workspaces (workspace_id already exists as nullable column)
-- ALTER TABLE missions ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id);
-- (workspace_id already exists on missions table — no migration needed, just add FK constraint)

-- Foreign key: exercises link to workspaces (new column)
-- ALTER TABLE exercise_scenarios ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id);
```

### Existing Table Migration Notes

The `missions` table already has `workspace_id TEXT` (nullable). Phase 19 adds a foreign key reference to the new `workspaces` table. Exercises (`exercise_scenarios`) need a `workspace_id` column added.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation + hashing | Custom crypto | Existing `InviteStore.generateInviteToken()` pattern | Already proven: `randomBytes(32).toString('base64url')` + `createHash('sha256')` |
| DAO on-chain write | New NEAR SDK calls | `signAndSubmitFunctionCall` from `near/tx-signer.ts` | Handles key derivation, account lookup, error handling |
| DAO role assignment | Custom role system | `buildAssignRoleTx` / `buildAddMemberTx` from `DAOService` | Contract already has full role management |
| Parent-child DAO linkage | Custom hierarchy table | `set_dao_parent` contract call + `parent_workspace_id` FK in `workspaces` table | Contract already has `DAOLinkageManager.set_parent()` |
| Auth middleware | Custom session parsing | `requireAuth` from `auth/auth-instance.ts` | Already wired; `req.anonUser!.nearAccountId` available |
| Clearance comparison | Custom enum comparison | `CLASSIFICATION_LEVELS` from `security/index.ts` | Already has numeric ordering: UNCLASS=0, SECRET=3, TOPSECRET=4 |
| Org tree rendering | Custom SVG tree | `react-d3-tree` | Handles pan, zoom, curved connectors, node customization |

**Key insight:** The DAO contract (`near-contracts/src/dao/`) is already a full workspace governance engine. Phase 19's primary job is wiring it to a clean REST API and building the off-chain shadow tables and UI — not modifying the contract.

---

## Common Pitfalls

### Pitfall 1: Forgetting the Dual-Write (on-chain + off-chain)
**What goes wrong:** Role changes or member additions succeed on-chain but the off-chain `workspace_members` table is not updated (or vice versa), causing UI to show stale state.
**Why it happens:** Two separate systems, each can fail independently.
**How to avoid:** Use a try/finally or transactional pattern: attempt on-chain write first; only if successful, write off-chain. Log the tx_hash in the activity record for correlation. If on-chain succeeds but off-chain fails, queue a retry (or at minimum log for manual reconciliation).
**Warning signs:** Member appears in DAO contract but not in member directory; or vice versa.

### Pitfall 2: Clearance Check at Accept-Time, Not Create-Time
**What goes wrong:** An invite is created targeting a user at a higher clearance level than the workspace requires. The invite link works, but the user's actual clearance at accept-time isn't verified.
**Why it happens:** Clearance is on the user's profile/credential, not embedded in the invite.
**How to avoid:** Verify clearance at `acceptInvite` time: fetch user's clearance from `user_profiles` or auth context, compare against `workspaces.classification` using `CLASSIFICATION_LEVELS`. Block if insufficient.

### Pitfall 3: Primary Workspace UNIQUE Violation
**What goes wrong:** A user's `is_primary` flag on `workspace_members` gets set to `true` on multiple rows when they join multiple workspaces.
**Why it happens:** INSERT without first clearing the old primary.
**How to avoid:** Use a transaction: `UPDATE workspace_members SET is_primary = false WHERE user_did = $1` before `UPDATE workspace_members SET is_primary = true WHERE id = $2`. Or use a PostgreSQL partial unique index: `CREATE UNIQUE INDEX idx_one_primary_per_user ON workspace_members(user_did) WHERE is_primary = true`.

### Pitfall 4: Parent Visibility Without Join Access
**What goes wrong:** A user joins an Organization-level workspace. Frontend then shows them all child Unit/Team workspaces as fully accessible (joins automatically or reveals content).
**Why it happens:** Membership query returns child workspace IDs without checking whether the user has an explicit membership row in that child.
**How to avoid:** Always gate content access on explicit `workspace_members` row existence. Parent membership only grants `visibility` (show the workspace name/count in org tree). Explicit invite + accept is required to interact with child content.

### Pitfall 5: Exercise Scenario workspace_id Integration
**What goes wrong:** Exercises have an `exercise_scenarios` table without `workspace_id`, so exercise scenarios cannot be scoped to a workspace even though the decision is that missions AND exercises nest under workspaces.
**Why it happens:** Exercise system was built before workspaces existed.
**How to avoid:** Add `workspace_id TEXT REFERENCES workspaces(id)` to `exercise_scenarios` table as part of Phase 19 Wave 0. This is a nullable column migration — existing exercises remain unaffected.

### Pitfall 6: DAO ID Naming Collisions
**What goes wrong:** Two workspaces with the same or similar names generate the same DAO ID string on-chain, causing the contract's `assert!(!self.daos.contains_key(&dao_id))` to panic.
**Why it happens:** DAO ID is built from workspace name without UUID suffix.
**How to avoid:** Always include a UUID in the DAO ID: `ws-org-${uuid}` format. Never derive DAO ID purely from workspace name.

### Pitfall 7: Notification Polling and Stale Counts
**What goes wrong:** The notification badge count for cross-workspace unread activity becomes stale when the user sits on a workspace for a long time.
**Why it happens:** Polling interval too long, or polling stops when tab is hidden.
**How to avoid:** Use a 5-second interval with `document.addEventListener('visibilitychange')` to restart polling on tab focus. Store last-seen timestamp per workspace in localStorage and compare against `workspace_activity.created_at`.

---

## Code Examples

### Workspace Creation Handler (backend)

```typescript
// Source: Pattern from backend/src/api/missions.ts + backend/src/near/tx-signer.ts

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { nearAccountId } = req.anonUser!;
    const userDid = `did:near:${nearAccountId}`;
    const input = CreateWorkspaceSchema.parse(req.body);

    // 1. Create on-chain DAO
    const daoId = `ws-${input.workspaceType.toLowerCase()}-${randomUUID()}`;
    const userSecret = deriveUserSecretFromAccount(nearAccountId);
    const onChainResult = await signAndSubmitFunctionCall(
      userSecret,
      process.env.DAO_CONTRACT_ID!,
      'create_dao',
      {
        dao_id: daoId,
        config: {
          name: input.name,
          description: input.description || '',
          classification: mapClassificationToContract(input.classification),
          default_autonomy_level: 'NotAutonomous',
          proposal_bond: '0',
          voting_period_ns: '604800000000000',
          parent_dao_id: input.parentDaoId || null,
        },
      },
    );
    if (!onChainResult.success) throw new Error(onChainResult.error);

    // 2. Set parent relationship if nested
    if (input.parentDaoId) {
      await signAndSubmitFunctionCall(userSecret, process.env.DAO_CONTRACT_ID!, 'set_dao_parent', {
        child_dao_id: daoId,
        parent_dao_id: input.parentDaoId,
      });
    }

    // 3. Create off-chain workspace record
    const workspace = await workspaceStore.createWorkspace({
      ...input,
      daoId,
    }, userDid);

    // 4. Add creator as member with commander role
    await workspaceMemberStore.addMember(workspace.id, userDid, 'commander', 'council', userDid);

    // 5. Log activity
    await workspaceActivityStore.log(workspace.id, 'workspace_created', userDid, null, {
      txHash: onChainResult.txHash,
    });

    res.status(201).json({ workspace });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create workspace' });
  }
});
```

### Workspace Invite Accept with Clearance Gate (backend)

```typescript
// Source: Pattern from backend/src/mission/invite-store.ts acceptInvite()

async acceptInvite(token: string, acceptorAccountId: string): Promise<WorkspaceMember> {
  await this.ensureInitialized();

  const invite = await this.getInviteByToken(token);
  if (!invite) throw new Error('Invalid or expired invite');

  if (invite.inviteeDid && invite.inviteeDid !== `did:near:${acceptorAccountId}`) {
    throw new Error('This invite is for a different user');
  }

  const workspace = await workspaceStore.getWorkspace(invite.workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  // Clearance gate
  const userProfile = await getUserProfile(acceptorAccountId);
  const userClearance = userProfile?.clearance ?? 'UNCLASSIFIED';
  if (!clearanceSufficient(userClearance, workspace.classification)) {
    throw new Error(`Insufficient clearance. This workspace requires ${workspace.classification}`);
  }

  // Gated mode — require admin approval
  if (workspace.inviteMode === 'gated' && !invite.approvedAt) {
    // Mark as pending approval instead of accepting
    await this.markPendingApproval(invite.id, acceptorAccountId);
    return null; // Awaiting approval
  }

  // On-chain: add member to DAO
  const userSecret = deriveUserSecretFromAccount(acceptorAccountId);
  const onChainResult = await signAndSubmitFunctionCall(
    userSecret,
    process.env.DAO_CONTRACT_ID!,
    'add_member',
    { dao_id: workspace.daoId, account_id: acceptorAccountId, roles: [invite.daoRole] },
  );
  if (!onChainResult.success) throw new Error(onChainResult.error);

  // Off-chain: create member record
  const member = await workspaceMemberStore.addMember(
    invite.workspaceId,
    `did:near:${acceptorAccountId}`,
    invite.role,
    invite.daoRole,
    invite.createdBy,
  );

  // Mark invite accepted
  await this.markAccepted(invite.id);

  // Activity log
  await workspaceActivityStore.log(invite.workspaceId, 'member_joined', invite.createdBy, member.userDid, {
    role: invite.role,
    txHash: onChainResult.txHash,
  });

  return member;
}
```

### Clearance Comparison Utility

```typescript
// Source: Pattern from backend/src/security/index.ts CLASSIFICATION_LEVELS

const WORKSPACE_CLEARANCE_LEVELS: Record<string, number> = {
  'UNCLASSIFIED': 0,
  'SECRET': 1,
  'TOPSECRET': 2,
};

function clearanceSufficient(userClearance: string, workspaceClassification: string): boolean {
  const userLevel = WORKSPACE_CLEARANCE_LEVELS[userClearance] ?? 0;
  const requiredLevel = WORKSPACE_CLEARANCE_LEVELS[workspaceClassification] ?? 0;
  return userLevel >= requiredLevel;
}
```

### WorkspaceContext (frontend)

```typescript
// Source: Pattern from frontend/src/context/UserContext.tsx

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { workspaceService } from '../lib/workspace-service.js';
import { useUser } from './UserContext.js';

interface WorkspaceMembership {
  workspaceId: string;
  name: string;
  workspaceType: 'Organization' | 'Unit' | 'Team';
  role: string;
  isPrimary: boolean;
}

interface WorkspaceContextType {
  activeWorkspaceId: string | null;
  memberships: WorkspaceMembership[];
  userRoleInActive: string | null;
  notificationCounts: Record<string, number>;
  setActiveWorkspace: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  activeWorkspaceId: null,
  memberships: [],
  userRoleInActive: null,
  notificationCounts: {},
  setActiveWorkspace: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { userDID, isAuthenticated } = useUser();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isAuthenticated || !userDID) return;
    workspaceService.listMyMemberships(userDID).then(setMemberships);
  }, [isAuthenticated, userDID]);

  // 5-second polling for notification badges
  useEffect(() => {
    if (!isAuthenticated || !userDID) return;
    const poll = () => workspaceService.getNotificationCounts(userDID).then(setNotificationCounts);
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, userDID]);

  const userRoleInActive = memberships.find(m => m.workspaceId === activeWorkspaceId)?.role ?? null;

  return (
    <WorkspaceContext.Provider value={{ activeWorkspaceId, memberships, userRoleInActive, notificationCounts, setActiveWorkspace: setActiveWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
```

### OrgTree with react-d3-tree

```typescript
// Source: react-d3-tree v3 API (confidence: MEDIUM — check npm docs at install time)

import Tree from 'react-d3-tree';

interface WorkspaceNode {
  name: string;
  attributes?: { members: number; classification: string };
  children?: WorkspaceNode[];
}

function OrgTree({ rootWorkspaceId }: { rootWorkspaceId: string }) {
  const [treeData, setTreeData] = useState<WorkspaceNode | null>(null);

  useEffect(() => {
    workspaceService.getHierarchy(rootWorkspaceId).then(hierarchy => {
      setTreeData(transformToTreeData(hierarchy));
    });
  }, [rootWorkspaceId]);

  if (!treeData) return null;

  return (
    <div style={{ height: 400, width: '100%' }}>
      <Tree
        data={treeData}
        orientation="vertical"
        pathFunc="step"
        collapsible={false}
        renderCustomNodeElement={({ nodeDatum }) => (
          <WorkspaceTreeNode node={nodeDatum} />
        )}
      />
    </div>
  );
}
```

### Activity Feed with Role-Based Visibility Filtering

```typescript
// Source: Logic from backend/src/exercise/information-barrier.ts pattern

// Backend: filter activity by role visibility
function filterActivityByRole(activities: WorkspaceActivity[], role: string): WorkspaceActivity[] {
  if (role === 'commander') return activities; // Commanders see everything
  if (STAFF_ROLES.includes(role)) {
    // Staff sees joins/departures/mission events but not command decisions
    return activities.filter(a => ['member_joined', 'member_removed', 'mission_created'].includes(a.activityType));
  }
  // Observers see summary only
  return activities.filter(a => a.activityType === 'mission_created');
}
```

---

## Integration Points

### Missions → Workspace Link
The `missions` table already has `workspace_id TEXT` (nullable). After Phase 19, missions created within a workspace set this column. The `listMissions` endpoint already filters by `workspaceId`. No structural change needed — only behavior change: workspace-level membership check gates who can see/join missions within a workspace.

### Exercises → Workspace Link
The `exercise_scenarios` table needs `workspace_id TEXT REFERENCES workspaces(id)` added (nullable migration). This is a Wave 0 database migration task.

### Exercise Roles → Workspace Roles Coexistence
Exercise roles (`blue_staff`, `red_cell`, `exercise_control`) are scoped to exercises, not workspaces. Workspace roles are scoped to workspace membership. A user can have `commander` workspace role AND `blue_staff` exercise role simultaneously — they are independent systems. The `withExerciseBarrier` middleware reads from `req.user.exerciseRole` which is exercise-session-scoped and unaffected by workspace roles.

### App Navigation
The sidebar `WorkspaceSwitcher` is injected into `App.tsx` above the existing tab navigation. The workspace dashboard is a new route: `/workspace/:workspaceId`. Switching workspaces navigates to `/workspace/{id}`, which always renders `WorkspaceDashboard`. The existing Decide/Design/Campaign/Monitor/Exercise tabs remain unchanged and are workspace-unaware (they operate on the global scope or filter by `activeWorkspaceId` from context).

### AI Agent Membership
AI agents are DID-bearing entities. Their DID (`did:near:{agentAccountId}`) can be added to `workspace_members` with `role = 'agent'` and `dao_role = 'agent'`. The existing `AgentTier` system in the DAO contract (`SupportAgent`, `RepresentAgent`, `OrganizeAgent`) maps to workspace roles. The `humans_only: false` flag on the `agent` role in the contract allows this.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded roles per feature | DAO role system with wildcard permissions | Phase 4 | Workspace roles inherit from DAO permission model |
| Mission-only invites | Generalized token-based invite infrastructure | Phase 4.4 | Phase 19 extends this directly |
| No hierarchy | DAOLinkageManager with parent_dao_id | Pre-Phase 19 | Hierarchical workspace already contractually supported |
| All-or-nothing access | Classification + compartment flags | Phase 19 | Need-to-know compartmentalization beyond classification |

**No deprecated patterns identified** — the invite pattern, DAO pattern, and auth pattern are all current and actively used.

---

## Open Questions

1. **Gated invite approval UX**
   - What we know: Workspace can be configured `invite_mode: 'gated'` requiring admin approval before a member is fully admitted.
   - What's unclear: Which UI screen shows pending approvals to admins? Is there a separate "Pending Members" panel, or does it appear in the activity feed with an "Approve" button?
   - Recommendation: Add a `PendingMembersPanel` to the `CommanderPanel` (and any role with `manage_members` permission). Pending approvals appear as action items, not just log entries.

2. **Primary workspace designation persistence**
   - What we know: Users can designate one workspace as primary. This is stored in `workspace_members.is_primary`.
   - What's unclear: Where does the user set/change their primary workspace? Is it in profile settings or in the workspace switcher itself?
   - Recommendation: Add a context menu on each workspace icon in the switcher: "Set as Primary". Also, auto-set first joined workspace as primary.

3. **Register-then-join flow for non-account users**
   - What we know: Non-account users who receive an invite link should be redirected to registration, then auto-accept the invite.
   - What's unclear: How is the invite token persisted through the registration flow? The token must survive the registration redirect.
   - Recommendation: Pass the invite token as a URL query parameter during registration (`/register?invite={token}`). After registration completes, the `AuthWrapper` detects the `invite` param and calls `acceptInvite`. Store the pending token in `sessionStorage` as a fallback if registration spans multiple pages.

4. **Notification backend query efficiency**
   - What we know: Notification counts require querying `workspace_activity` for each workspace the user belongs to, filtered by `created_at > last_seen_at`.
   - What's unclear: With many workspaces and frequent polling (5s), this could be expensive.
   - Recommendation: Add a `workspace_member_notification_state` table with `(user_did, workspace_id, last_seen_at)` and a single denormalized `unread_count` integer. Update via trigger or on activity INSERT. Query is then O(n memberships) with a single row lookup per workspace.

5. **Exact military role template permissions**
   - What we know: Role templates (commander, xo, s1-s9) are auto-created on workspace setup. The DAO contract has `council`, `member`, `agent` as default roles.
   - What's unclear: Which DAO role does each military template map to? Commander → council (full permissions)? S-staff → member (basic voting)? Observers → everyone (read-only)?
   - Recommendation: Use a 3-tier mapping: `commander/xo` → `council`; `s1-s9/special_staff` → `member`; `observer` → custom `observer` role with only `AddProposal:VoteApprove`. Store this mapping in `workspace_roles` table with `permissions[]` for fine-tuning.

---

## Sources

### Primary (HIGH confidence)
- `backend/src/mission/invite-store.ts` — Token hashing, expiry, accept flow; directly reused
- `backend/src/mission/participant-store.ts` — Member CRUD pattern; directly reused
- `backend/src/dao/dao-service.ts` — All DAO tx builders; `buildCreateDAOTx`, `buildAddMemberTx`, `buildAssignRoleTx`
- `backend/src/near/tx-signer.ts` — `signAndSubmitFunctionCall`, key derivation pattern
- `near-contracts/src/dao/types.rs` — `DAOConfig`, `parent_dao_id`, `DAOMetadata`
- `near-contracts/src/dao/roles.rs` — `Role`, `create_default_roles`, `council/member/agent` defaults, `AgentTier`
- `near-contracts/src/dao/linkages.rs` — `DAORelationship`, `set_parent()`, parent-child hierarchy
- `near-contracts/src/dao/mod.rs` — Module overview: confirms hierarchy, coalition, linkage all exist
- `backend/src/security/index.ts` — `CLASSIFICATION_LEVELS` numeric ordering
- `frontend/src/context/UserContext.tsx` — Context provider pattern
- `frontend/src/components/mission/InviteModal.tsx` — Invite UI to generalize
- `frontend/src/lib/mission-service.ts` — API client class pattern
- `backend/src/exercise/information-barrier.ts` — Compartment/barrier middleware pattern
- `backend/src/exercise/types.ts` — `STAFF_ROLE_CONFIG` with all military S-staff labels

### Secondary (MEDIUM confidence)
- `react-d3-tree` npm package v3.x — Organization tree rendering; verified as current active package (2024-2025); verify exact API at install time against npm docs

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries already in use in the project; only react-d3-tree is new
- Architecture: HIGH — patterns directly verified against existing mission invite, participant, DAO, and exercise codebase
- Pitfalls: HIGH — identified from actual code inspection (dual-write pattern, is_primary uniqueness, parent visibility gate)
- Database schema: HIGH — modeled exactly on existing `mission_invites` and `mission_participants` tables
- On-chain contract calls: HIGH — contract methods verified in `near-contracts/src/dao/` source

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain; only risk is if DAO contract changes before Phase 19 executes)
