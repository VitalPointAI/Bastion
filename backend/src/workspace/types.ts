/**
 * Workspace Types
 *
 * Phase 19: Workspace Membership and Invite System
 * Type definitions, constants, and utility functions for the workspace system.
 * Workspace = DAO is the core invariant — every workspace has an on-chain NEAR DAO.
 */

// Workspace type hierarchy: Organization → Unit → Team (3-level max)
export type WorkspaceType = 'Organization' | 'Unit' | 'Team';
export type InviteMode = 'open' | 'gated';
export type Discoverability = 'discoverable' | 'private';
export type MemberStatus = 'active' | 'suspended';
export type WorkspaceClassification = 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';

export interface Workspace {
  id: string;           // "WS-{uuid}"
  daoId: string;        // On-chain DAO ID (e.g., "ws-org-{uuid}")
  name: string;
  description: string | null;
  workspaceType: WorkspaceType;
  classification: WorkspaceClassification;
  parentWorkspaceId: string | null;
  inviteMode: InviteMode;
  discoverability: Discoverability;
  createdBy: string;    // DID (did:near:{accountId})
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;           // "WM-{uuid}"
  workspaceId: string;
  userDid: string;
  role: string;         // Military label: 'commander', 's2', etc.
  daoRole: string;      // On-chain DAO role: 'council', 'member', 'agent'
  isPrimary: boolean;
  status: MemberStatus;
  suspendedAt: Date | null;
  suspendedBy: string | null;
  joinedAt: Date;
  invitedBy: string;
}

export interface WorkspaceInvite {
  id: string;           // "WI-{uuid}"
  workspaceId: string;
  token: string;        // SHA-256 hashed
  inviteeEmail: string | null;
  inviteeDid: string | null;
  role: string;         // Military role label
  daoRole: string;      // DAO role for on-chain assignment
  expiresAt: Date;
  acceptedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface WorkspaceActivity {
  id: string;           // "WA-{uuid}"
  workspaceId: string;
  activityType: string; // 'member_joined' | 'role_changed' | 'member_suspended' | etc.
  actorDid: string;
  subjectDid: string | null;
  metadata: Record<string, unknown>;
  txHash: string | null;
  createdAt: Date;
}

export interface WorkspaceCompartment {
  id: string;
  workspaceId: string;
  name: string;         // e.g., 'SIGINT', 'HUMINT'
  description: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface WorkspaceRole {
  id: string;
  workspaceId: string;
  militaryLabel: string;   // 'commander', 'xo', 's1', etc.
  daoRoleName: string;     // 'council', 'member', 'agent'
  permissions: string[];
  createdAt: Date;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  workspaceType: WorkspaceType;
  classification: WorkspaceClassification;
  parentWorkspaceId?: string;
  parentDaoId?: string;
  inviteMode?: InviteMode;
  discoverability?: Discoverability;
}

// Military role templates per workspace type
// Auto-created on workspace setup; military labels map to DAO role names
export const MILITARY_ROLE_TEMPLATES: Record<
  WorkspaceType,
  Array<{ label: string; daoRole: string; permissions: string[] }>
> = {
  Organization: [
    {
      label: 'commander',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles', 'manage_workspace'],
    },
    {
      label: 'xo',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles'],
    },
    {
      label: 's1',
      daoRole: 'member',
      permissions: ['manage_members', 'create_proposals', 'vote'],
    },
    {
      label: 's2',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'view_intelligence'],
    },
    {
      label: 's3',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_operations'],
    },
    {
      label: 's4',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_logistics'],
    },
    {
      label: 's5',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_plans'],
    },
    {
      label: 's6',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_comms'],
    },
    {
      label: 's7',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote'],
    },
    {
      label: 's8',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_finance'],
    },
    {
      label: 's9',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_civil'],
    },
  ],
  Unit: [
    {
      label: 'commander',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles', 'manage_workspace'],
    },
    {
      label: 'xo',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles'],
    },
    {
      label: 's2',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'view_intelligence'],
    },
    {
      label: 's3',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_operations'],
    },
    {
      label: 's4',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_logistics'],
    },
  ],
  Team: [
    {
      label: 'team_lead',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote'],
    },
    {
      label: 'member',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote'],
    },
    {
      label: 'observer',
      daoRole: 'member',
      permissions: ['view_only'],
    },
  ],
};

// Clearance level ordering for numeric comparison
export const CLEARANCE_LEVELS: Record<WorkspaceClassification, number> = {
  UNCLASSIFIED: 0,
  SECRET: 1,
  TOPSECRET: 2,
};

/**
 * Check whether a user's clearance level is sufficient for a given workspace classification.
 *
 * @param userClearance - The user's clearance level string (WorkspaceClassification)
 * @param workspaceClassification - The workspace's required classification level
 * @returns true if the user's clearance meets or exceeds the workspace requirement
 */
export function clearanceSufficient(
  userClearance: string,
  workspaceClassification: WorkspaceClassification,
): boolean {
  const userLevel = CLEARANCE_LEVELS[userClearance as WorkspaceClassification] ?? 0;
  const requiredLevel = CLEARANCE_LEVELS[workspaceClassification] ?? 0;
  return userLevel >= requiredLevel;
}
