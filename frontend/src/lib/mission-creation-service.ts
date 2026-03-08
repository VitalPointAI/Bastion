/**
 * Mission Creation Service
 *
 * Phase 35 Plan 03: API client for mission creation endpoints.
 * Mirrors backend types per project convention (backend is authoritative).
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types (mirrored from backend/src/mission-creation/mission-creation-types.ts) ─

export const MISSION_STATES = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  COMPLETE: 'complete',
  ARCHIVED: 'archived',
} as const;

export type MissionState = (typeof MISSION_STATES)[keyof typeof MISSION_STATES];

export interface MissionMetadata {
  areaOfOperations: { type: string; coordinates: number[][][] } | null;
  missionState: MissionState;
  activatedAt: string | null;
  completedAt: string | null;
}

export interface OPORDSubordinateTask {
  id: string;
  unitId: string;
  unitName: string;
  task: string;
  purpose: string;
  missionGroupId: string | null;
}

export interface MissionGroup {
  id: string;
  name: string;
  taskIds: string[];
  assignedUnitId: string | null;
  status: 'draft' | 'created';
  childProblemSetId: string | null;
}

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

export interface RoleAssignment {
  did: string;
  displayName: string;
  role: string;
  daoRole: string;
  isAgent: boolean;
}

export interface CreateMissionInput {
  missionName: string;
  missionStatement: string;
  parentProblemSetId: string;
  classification: string;
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

export interface MissionCreationResult {
  problemSet: {
    id: string;
    daoId: string;
    name: string;
    echelon: string;
    parentProblemSetId: string | null;
  };
  missionAssignmentId: string;
  workflowCreated: boolean;
  warnoDrafted: boolean;
  membersInvited: number;
}

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

// ─── Service ────────────────────────────────────────────────────────────────

export const missionCreationService = {
  /**
   * Create a tactical mission (child problem set) from grouped OPORD tasks.
   */
  async createMission(
    problemSetId: string,
    input: CreateMissionInput,
  ): Promise<MissionCreationResult> {
    const res = await fetch(
      `${API_BASE}/api/problem-sets/${problemSetId}/missions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      throw new Error(`Failed to create mission: ${errBody}`);
    }
    return res.json();
  },

  /**
   * List all missions created from this problem set's OPORD.
   */
  async listMissions(problemSetId: string): Promise<MissionAssignment[]> {
    const res = await fetch(
      `${API_BASE}/api/problem-sets/${problemSetId}/missions`,
      { credentials: 'include' },
    );
    if (!res.ok) throw new Error(`Failed to list missions: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create a CCIR/PIR request from child PS to parent.
   */
  async createCcirRequest(
    problemSetId: string,
    input: { targetPsId: string; requestType: 'ccir' | 'pir'; description: string },
  ): Promise<CcirRequest> {
    const res = await fetch(
      `${API_BASE}/api/problem-sets/${problemSetId}/ccir-requests`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(`Failed to create CCIR request: ${res.statusText}`);
    return res.json();
  },

  /**
   * List outgoing CCIR/PIR requests from this problem set.
   */
  async listCcirRequests(problemSetId: string): Promise<CcirRequest[]> {
    const res = await fetch(
      `${API_BASE}/api/problem-sets/${problemSetId}/ccir-requests`,
      { credentials: 'include' },
    );
    if (!res.ok) throw new Error(`Failed to list CCIR requests: ${res.statusText}`);
    return res.json();
  },

  /**
   * List incoming CCIR/PIR requests targeting this problem set.
   */
  async listIncomingCcirRequests(problemSetId: string): Promise<CcirRequest[]> {
    const res = await fetch(
      `${API_BASE}/api/problem-sets/${problemSetId}/ccir-requests/incoming`,
      { credentials: 'include' },
    );
    if (!res.ok) throw new Error(`Failed to list incoming CCIR requests: ${res.statusText}`);
    return res.json();
  },

  /**
   * Resolve (approve/deny) an incoming CCIR/PIR request.
   */
  async resolveCcirRequest(
    problemSetId: string,
    requestId: string,
    status: 'approved' | 'denied',
    responseData?: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch(
      `${API_BASE}/api/problem-sets/${problemSetId}/ccir-requests/${requestId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, responseData }),
      },
    );
    if (!res.ok) throw new Error(`Failed to resolve CCIR request: ${res.statusText}`);
  },
};
