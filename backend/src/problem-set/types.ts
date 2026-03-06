/**
 * Problem Set Types
 *
 * Phase 23: Problem Set Model & Workspace Rename
 * Type definitions, constants, and utility functions for the problem set system.
 * Problem Set = DAO is the core invariant — every problem set has an on-chain NEAR DAO.
 *
 * Replaces workspace/types.ts with echelon model per JP 5-0 doctrine.
 * Echelon hierarchy: strategic > operational > tactical
 */

// Global application mode: training exercises vs operational use
export type AppMode = 'training' | 'operational';

// Echelon hierarchy: strategic → operational → tactical (3-level max)
// Replaces WorkspaceType ('Organization' | 'Unit' | 'Team')
export type Echelon = 'strategic' | 'operational' | 'tactical';

export type InviteMode = 'open' | 'gated';
export type Discoverability = 'discoverable' | 'private';
export type MemberStatus = 'active' | 'suspended';
export type ProblemSetClassification = 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';

export interface ProblemSet {
  id: string;           // "PS-{uuid}"
  daoId: string;        // On-chain DAO ID (e.g., "ps-strat-{uuid}")
  name: string;
  description: string | null;
  problemStatement: string | null;
  echelon: Echelon;
  classification: ProblemSetClassification;
  parentProblemSetId: string | null;
  inviteMode: InviteMode;
  discoverability: Discoverability;
  mode: AppMode;
  createdBy: string;    // DID (did:near:{accountId})
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemSetMember {
  id: string;           // "PM-{uuid}"
  problemSetId: string;
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

export interface ProblemSetInvite {
  id: string;           // "PI-{uuid}"
  problemSetId: string;
  token: string;        // SHA-256 hashed
  shortCode: string | null; // Memorable code like "BRAVO-742"
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

export interface ProblemSetActivity {
  id: string;           // "PA-{uuid}"
  problemSetId: string;
  activityType: string; // 'member_joined' | 'role_changed' | 'member_suspended' | etc.
  actorDid: string;
  subjectDid: string | null;
  metadata: Record<string, unknown>;
  txHash: string | null;
  createdAt: Date;
}

export interface ProblemSetCompartment {
  id: string;
  problemSetId: string;
  name: string;         // e.g., 'SIGINT', 'HUMINT'
  description: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface ProblemSetRole {
  id: string;
  problemSetId: string;
  militaryLabel: string;   // 'commander', 'xo', 's1', etc.
  daoRoleName: string;     // 'council', 'member', 'agent'
  permissions: string[];
  createdAt: Date;
}

export interface CreateProblemSetInput {
  name: string;
  description?: string;
  echelon: Echelon;
  classification: ProblemSetClassification;
  parentProblemSetId?: string;
  parentDaoId?: string;
  inviteMode?: InviteMode;
  discoverability?: Discoverability;
  problemStatement?: string;
  mode?: AppMode;
}

// Echelon hierarchy validation
// strategic can contain operational, operational can contain tactical, tactical is leaf
const ALLOWED_CHILD_ECHELON: Record<Echelon, Echelon | null> = {
  strategic: 'operational',
  operational: 'tactical',
  tactical: null,
};

/**
 * Validate that a child echelon is allowed under a parent echelon.
 * Top-level (no parent) must be strategic.
 *
 * @param parentEchelon - The parent problem set's echelon (null for top-level)
 * @param childEchelon - The child problem set's echelon
 * @returns true if the hierarchy is valid
 */
export function validateEchelonHierarchy(
  parentEchelon: Echelon | null,
  childEchelon: Echelon,
): boolean {
  if (!parentEchelon) return childEchelon === 'strategic';
  return ALLOWED_CHILD_ECHELON[parentEchelon] === childEchelon;
}

// JP 5-0 role templates per echelon level
// Auto-created on problem set setup; military labels map to DAO role names
export const ECHELON_ROLE_TEMPLATES: Record<
  Echelon,
  Array<{ label: string; daoRole: string; permissions: string[] }>
> = {
  // Theater/Combatant Command level — J-staff
  strategic: [
    {
      label: 'commander',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles', 'manage_workspace'],
    },
    {
      label: 'deputy_commander',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles'],
    },
    {
      label: 'chief_of_staff',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles'],
    },
    {
      label: 'j1',
      daoRole: 'member',
      permissions: ['manage_members', 'create_proposals', 'vote'],
    },
    {
      label: 'j2',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'view_intelligence'],
    },
    {
      label: 'j3',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_operations'],
    },
    {
      label: 'j4',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_logistics'],
    },
    {
      label: 'j5',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_plans'],
    },
    {
      label: 'j6',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_comms'],
    },
    {
      label: 'j7',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote'],
    },
    {
      label: 'j8',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_finance'],
    },
    {
      label: 'j9',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_civil'],
    },
    {
      label: 'polad',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'advise_political'],
    },
    {
      label: 'legad',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'advise_legal'],
    },
    {
      label: 'member',
      daoRole: 'member',
      permissions: ['vote'],
    },
  ],
  // Corps/Division level — G-staff
  operational: [
    {
      label: 'commander',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles', 'manage_workspace'],
    },
    {
      label: 'deputy_commander',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles'],
    },
    {
      label: 'chief_of_staff',
      daoRole: 'council',
      permissions: ['manage_members', 'create_proposals', 'vote', 'manage_roles'],
    },
    {
      label: 'g2',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'view_intelligence'],
    },
    {
      label: 'g3',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_operations'],
    },
    {
      label: 'g4',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_logistics'],
    },
    {
      label: 'g5',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_plans'],
    },
    {
      label: 'fires',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_fires'],
    },
    {
      label: 'member',
      daoRole: 'member',
      permissions: ['vote'],
    },
  ],
  // Brigade/Battalion level — S-staff
  tactical: [
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
    {
      label: 'fso',
      daoRole: 'member',
      permissions: ['create_proposals', 'vote', 'manage_fires'],
    },
    {
      label: 'member',
      daoRole: 'member',
      permissions: ['vote'],
    },
  ],
};

// Clearance level ordering for numeric comparison
export const CLEARANCE_LEVELS: Record<ProblemSetClassification, number> = {
  UNCLASSIFIED: 0,
  SECRET: 1,
  TOPSECRET: 2,
};

/**
 * Check whether a user's clearance level is sufficient for a given problem set classification.
 *
 * @param userClearance - The user's clearance level string (ProblemSetClassification)
 * @param problemSetClassification - The problem set's required classification level
 * @returns true if the user's clearance meets or exceeds the problem set requirement
 */
export function clearanceSufficient(
  userClearance: string,
  problemSetClassification: ProblemSetClassification,
): boolean {
  const userLevel = CLEARANCE_LEVELS[userClearance as ProblemSetClassification] ?? 0;
  const requiredLevel = CLEARANCE_LEVELS[problemSetClassification] ?? 0;
  return userLevel >= requiredLevel;
}
