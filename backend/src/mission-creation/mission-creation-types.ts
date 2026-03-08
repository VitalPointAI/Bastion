/**
 * Mission Creation Types
 *
 * Phase 35 Plan 01: Type definitions for the mission creation subsystem.
 * Covers mission assignments, OPORD subordinate tasks, WARNO drafts,
 * CCIR requests, and all supporting structures for doctrinal mission
 * creation from operational OPORD to tactical problem sets.
 */

import type { ProblemSetClassification, ProblemSet } from '../problem-set/types.js';

// ─── Mission State ──────────────────────────────────────────────────────────

export const MISSION_STATES = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  COMPLETE: 'complete',
  ARCHIVED: 'archived',
} as const;

export type MissionState = (typeof MISSION_STATES)[keyof typeof MISSION_STATES];

// ─── Mission Metadata (JSONB on problem_sets.metadata) ──────────────────────

export interface MissionMetadata {
  areaOfOperations: { type: string; coordinates: number[][][] } | null;
  missionState: MissionState;
  activatedAt: string | null;
  completedAt: string | null;
}

// ─── OPORD Subordinate Task ─────────────────────────────────────────────────

export interface OPORDSubordinateTask {
  id: string;
  unitId: string;
  unitName: string;
  task: string;
  purpose: string;
  missionGroupId: string | null;
}

// ─── Mission Group ──────────────────────────────────────────────────────────

export interface MissionGroup {
  id: string;
  name: string;
  taskIds: string[];
  assignedUnitId: string | null;
  status: 'draft' | 'created';
  childProblemSetId: string | null;
}

// ─── Commander's Intent Chain (2-up resolution) ─────────────────────────────

export interface CommandersIntentSnapshot {
  psId: string;
  psName: string;
  endState: string;
  purpose: string;
  keyTasks: string[];
  constraints: string[];
}

export interface CommandersIntentChain {
  own: CommandersIntentSnapshot | null;
  parent: CommandersIntentSnapshot | null;
  grandparent: CommandersIntentSnapshot | null;
}

// ─── Role Assignment ────────────────────────────────────────────────────────

export interface RoleAssignment {
  did: string;
  displayName: string;
  role: string;
  daoRole: string;
  isAgent: boolean;
}

// ─── Create Mission Input ───────────────────────────────────────────────────

export interface CreateMissionInput {
  missionName: string;
  missionStatement: string;
  parentProblemSetId: string;
  classification: ProblemSetClassification;
  mode: string;
  taskIds: string[];
  taskStatement: string;
  purpose: string;
  commandersIntent: CommandersIntentChain;
  taskOrganization: Record<string, unknown>;
  constraints: Record<string, unknown>;
  ccirs: Record<string, unknown>;
  roeReferences: string[];
  areaOfOperations: MissionMetadata['areaOfOperations'];
  timeline: Record<string, unknown>;
  roleAssignments: RoleAssignment[];
}

// ─── Mission Creation Result ────────────────────────────────────────────────

export interface MissionCreationResult {
  problemSet: ProblemSet;
  missionAssignmentId: string;
  workflowCreated: boolean;
  warnoDrafted: boolean;
  membersInvited: number;
}

// ─── Mission Assignment (DB record) ─────────────────────────────────────────

export interface MissionAssignment {
  id: string;
  sourceOpordPsId: string;
  targetProblemSetId: string;
  taskIds: string[];
  taskStatement: string;
  purpose: string;
  commandersIntent: Record<string, unknown> | null;
  taskOrganization: Record<string, unknown> | null;
  constraints: Record<string, unknown> | null;
  ccirs: Record<string, unknown> | null;
  roeReferences: string[];
  areaOfOperations: Record<string, unknown> | null;
  timeline: Record<string, unknown> | null;
  warnoDrafted: boolean;
  createdBy: string;
  createdAt: string;
}

// ─── WARNO Draft ────────────────────────────────────────────────────────────

export interface WARNODraft {
  situation: string;
  mission: string;
  generalInstructions: {
    timeline: string;
    initialCoordination: string;
    movementInstructions: string;
  };
  serviceSupport: string;
  commandSignal: {
    commandPost: string;
    succession: string[];
    frequency: string;
  };
  draftedAt: string;
  status: 'draft' | 'reviewed' | 'approved';
  reviewedBy: string | null;
  approvedBy: string | null;
}

// ─── CCIR Request ───────────────────────────────────────────────────────────

export const CCIR_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
} as const;

export type CcirRequestStatus = (typeof CCIR_REQUEST_STATUS)[keyof typeof CCIR_REQUEST_STATUS];

export interface CcirRequest {
  id: string;
  requestingPsId: string;
  targetPsId: string;
  requestType: 'ccir' | 'pir';
  description: string;
  status: CcirRequestStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  responseData: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
}
