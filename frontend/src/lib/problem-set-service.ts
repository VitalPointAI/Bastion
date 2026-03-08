/**
 * Problem Set Service
 *
 * API client for all problem set operations:
 * - Problem Set CRUD
 * - Membership management
 * - Invite management
 * - Roles and activity
 * - Notification counts
 * - Panel config
 * - Cross-problem-set subscriptions
 * - Escalation rules
 */

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Request Types ────────────────────────────────────────────────────────────

export interface CreateProblemSetInput {
  name: string;
  description?: string;
  echelon: 'strategic' | 'operational' | 'tactical';
  classification?: string;
  parentProblemSetId?: string;
  inviteMode?: 'open' | 'gated';
  discoverability?: 'discoverable' | 'private';
  problemStatement?: string;
  /** App mode — new problem sets inherit the user's current mode */
  mode?: 'training' | 'operational';
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface ProblemSetMembership {
  problemSetId: string;
  name: string;
  echelon: 'strategic' | 'operational' | 'tactical';
  classification: string;
  role: string;
  daoRole: string;
  isPrimary: boolean;
  status: string;
}

export interface ProblemSetDetail {
  id: string;
  daoId: string;
  name: string;
  description: string | null;
  echelon: 'strategic' | 'operational' | 'tactical';
  problemStatement: string | null;
  classification: string;
  parentProblemSetId: string | null;
  inviteMode: string;
  discoverability: string;
  memberCount: number;
  createdBy: string;
  createdAt: string;
}

export interface ProblemSetMemberDetail {
  id: string;
  problemSetId: string;
  userDid: string;
  role: string;
  daoRole: string;
  isPrimary: boolean;
  status: string;
  joinedAt: string;
  displayName?: string | null;
}

export interface ProblemSetInviteDetail {
  id: string;
  problemSetId: string;
  role: string;
  daoRole: string;
  shortCode: string | null;
  inviteeEmail: string | null;
  inviteeDid: string | null;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  rawToken?: string;
}

export interface ProblemSetActivityItem {
  id: string;
  activityType: string;
  actorDid: string;
  subjectDid: string | null;
  metadata: Record<string, unknown>;
  txHash: string | null;
  createdAt: string;
}

export interface ProblemSetRole {
  id: string;
  militaryLabel: string;
  daoRoleName: string;
  permissions: string[];
}

export interface HierarchyNode {
  id: string;
  name: string;
  echelon: string;
  memberCount: number;
  children?: HierarchyNode[];
}

export interface ProblemSetCompartment {
  id: string;
  problemSetId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  /** Member DIDs assigned to this compartment (populated when requested with members) */
  memberDids?: string[];
}

export interface Subscription {
  id: string;
  subscriberProblemSetId: string;
  publisherProblemSetId: string;
  dataTypes: string[];
  approvalStatus: string;
  approvalMechanism: string;
  approvedBy: string | null;
  requestedBy: string;
  createdAt: string;
}

export interface EscalationRule {
  id: string;
  problemSetId: string;
  ruleType: string;
  proposalKind: string;
  votingMechanism: string;
  autoRouteTo: string | null;
  isActive: boolean;
}

// ─── Service Class ────────────────────────────────────────────────────────────

class ProblemSetService {
  private baseUrl = `${API_BASE}/api/problem-sets`;

  private async fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: response.statusText })) as {
        error?: string;
        details?: Array<{ path?: (string | number)[]; message?: string }>;
      };
      let message = errBody.error || `HTTP ${response.status}`;
      if (errBody.details?.length) {
        message = errBody.details
          .map((d) => d.path?.length ? `${d.path.join('.')}: ${d.message}` : d.message)
          .join('; ');
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  // ─── Problem Set CRUD ──────────────────────────────────────────────────────

  async createProblemSet(input: CreateProblemSetInput, userDID: string): Promise<ProblemSetDetail> {
    return this.fetchJSON<ProblemSetDetail>(this.baseUrl, {
      method: 'POST',
      headers: { 'X-DID': userDID },
      body: JSON.stringify(input),
    });
  }

  async listMyMemberships(userDID: string, mode?: string): Promise<ProblemSetMembership[]> {
    const url = mode ? `${this.baseUrl}/me?mode=${encodeURIComponent(mode)}` : `${this.baseUrl}/me`;
    const response = await this.fetchJSON<{ memberships: ProblemSetMembership[] }>(
      url,
      { headers: { 'X-DID': userDID } }
    );
    return response.memberships;
  }

  async getProblemSet(id: string, userDID: string): Promise<ProblemSetDetail> {
    return this.fetchJSON<ProblemSetDetail>(`${this.baseUrl}/${id}`, {
      headers: { 'X-DID': userDID },
    });
  }

  async getHierarchy(problemSetId: string, userDID: string): Promise<HierarchyNode[]> {
    const response = await this.fetchJSON<{ hierarchy: HierarchyNode[] }>(
      `${this.baseUrl}/${problemSetId}/hierarchy`,
      { headers: { 'X-DID': userDID } }
    );
    return response.hierarchy;
  }

  async deleteProblemSet(id: string, userDID: string): Promise<void> {
    await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-DID': userDID },
    }).then((res) => {
      if (!res.ok) return res.json().then((b: { error?: string }) => { throw new Error(b.error || `HTTP ${res.status}`); });
    });
  }

  async updateProblemSet(
    id: string,
    updates: Partial<{ name: string; description: string; inviteMode: string; discoverability: string; problemStatement: string }>,
    userDID: string
  ): Promise<ProblemSetDetail> {
    return this.fetchJSON<ProblemSetDetail>(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'X-DID': userDID },
      body: JSON.stringify(updates),
    });
  }

  // ─── Membership Management ──────────────────────────────────────────────────

  async listMembers(problemSetId: string, userDID: string): Promise<ProblemSetMemberDetail[]> {
    const response = await this.fetchJSON<{ members: ProblemSetMemberDetail[] }>(
      `${this.baseUrl}/${problemSetId}/members`,
      { headers: { 'X-DID': userDID } }
    );
    return response.members;
  }

  async changeRole(
    problemSetId: string,
    memberDid: string,
    newRole: string,
    newDaoRole: string,
    userDID: string
  ): Promise<ProblemSetMemberDetail> {
    return this.fetchJSON<ProblemSetMemberDetail>(
      `${this.baseUrl}/${problemSetId}/members/${memberDid}/role`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ role: newRole, daoRole: newDaoRole }),
      }
    );
  }

  async suspendMember(problemSetId: string, memberDid: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/members/${memberDid}/suspend`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
      }
    );
  }

  async unsuspendMember(problemSetId: string, memberDid: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/members/${memberDid}/unsuspend`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
      }
    );
  }

  async removeMember(problemSetId: string, memberDid: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/members/${memberDid}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      }
    );
  }

  // ─── Invite Management ──────────────────────────────────────────────────────

  async createInvite(
    problemSetId: string,
    role: string,
    daoRole: string,
    userDID: string,
    options?: { inviteeEmail?: string; inviteeDid?: string; expiresInHours?: number }
  ): Promise<{ invite: ProblemSetInviteDetail; rawToken: string }> {
    return this.fetchJSON<{ invite: ProblemSetInviteDetail; rawToken: string }>(
      `${this.baseUrl}/${problemSetId}/invite`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ role, daoRole, ...options }),
      }
    );
  }

  async listPendingInvites(problemSetId: string, userDID: string): Promise<ProblemSetInviteDetail[]> {
    const response = await this.fetchJSON<{ invites: ProblemSetInviteDetail[] }>(
      `${this.baseUrl}/${problemSetId}/invites`,
      { headers: { 'X-DID': userDID } }
    );
    return response.invites;
  }

  async acceptInvite(token: string, userDID: string): Promise<ProblemSetMemberDetail | null> {
    const response = await fetch(`${this.baseUrl}/invite/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DID': userDID,
      },
      body: JSON.stringify({ token }),
    });

    // 202 means pending approval (gated problem set)
    if (response.status === 202) {
      return null;
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: response.statusText })) as {
        error?: string;
        details?: Array<{ path?: (string | number)[]; message?: string }>;
      };
      let message = errBody.error || `HTTP ${response.status}`;
      if (errBody.details?.length) {
        message = errBody.details
          .map((d) => d.path?.length ? `${d.path.join('.')}: ${d.message}` : d.message)
          .join('; ');
      }
      throw new Error(message);
    }

    return response.json() as Promise<ProblemSetMemberDetail>;
  }

  async acceptInviteByCode(code: string, userDID: string): Promise<ProblemSetMemberDetail | null> {
    const response = await fetch(`${this.baseUrl}/invite/accept-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DID': userDID,
      },
      body: JSON.stringify({ code }),
    });

    if (response.status === 202) return null;

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: response.statusText })) as {
        error?: string;
      };
      throw new Error(errBody.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<ProblemSetMemberDetail>;
  }

  async lookupInviteCode(code: string): Promise<{ inviteId: string; problemSetId: string; shortCode: string } | null> {
    const response = await fetch(`${this.baseUrl}/invite/code/${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    return response.json() as Promise<{ inviteId: string; problemSetId: string; shortCode: string }>;
  }

  async approveInvite(problemSetId: string, inviteId: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/invites/${inviteId}/approve`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
      }
    );
  }

  async cancelInvite(problemSetId: string, inviteId: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/invites/${inviteId}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      }
    );
  }

  // ─── Problem Set Settings ──────────────────────────────────────────────────

  async setPrimary(problemSetId: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(`${this.baseUrl}/me/primary`, {
      method: 'PUT',
      headers: { 'X-DID': userDID },
      body: JSON.stringify({ problemSetId }),
    });
  }

  // ─── Roles & Activity ─────────────────────────────────────────────────────

  async listRoles(problemSetId: string, userDID: string): Promise<ProblemSetRole[]> {
    const response = await this.fetchJSON<{ roles: ProblemSetRole[] }>(
      `${this.baseUrl}/${problemSetId}/roles`,
      { headers: { 'X-DID': userDID } }
    );
    return response.roles;
  }

  async listActivity(
    problemSetId: string,
    userDID: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ activities: ProblemSetActivityItem[]; displayNames: Record<string, string> }> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const response = await this.fetchJSON<{ activities: ProblemSetActivityItem[]; displayNames?: Record<string, string> }>(
      `${this.baseUrl}/${problemSetId}/activity${queryString}`,
      { headers: { 'X-DID': userDID } }
    );
    return { activities: response.activities, displayNames: response.displayNames ?? {} };
  }

  // ─── Compartments ──────────────────────────────────────────────────────────

  async listCompartments(
    problemSetId: string,
    userDID: string,
  ): Promise<ProblemSetCompartment[]> {
    const response = await this.fetchJSON<{ compartments: ProblemSetCompartment[] }>(
      `${this.baseUrl}/${problemSetId}/compartments`,
      { headers: { 'X-DID': userDID } },
    );
    return response.compartments;
  }

  async createCompartment(
    problemSetId: string,
    name: string,
    description: string | null,
    userDID: string,
  ): Promise<ProblemSetCompartment> {
    return this.fetchJSON<ProblemSetCompartment>(
      `${this.baseUrl}/${problemSetId}/compartments`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ name, description }),
      },
    );
  }

  async deleteCompartment(
    problemSetId: string,
    compartmentId: string,
    userDID: string,
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/compartments/${compartmentId}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      },
    );
  }

  async assignMemberToCompartment(
    problemSetId: string,
    compartmentId: string,
    memberDid: string,
    userDID: string,
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/compartments/${compartmentId}/members`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ memberDid }),
      },
    );
  }

  async removeMemberFromCompartment(
    problemSetId: string,
    compartmentId: string,
    memberDid: string,
    userDID: string,
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/compartments/${compartmentId}/members/${memberDid}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      },
    );
  }

  async getMyCompartments(
    problemSetId: string,
    userDID: string,
  ): Promise<string[]> {
    const response = await this.fetchJSON<{ compartmentIds: string[] }>(
      `${this.baseUrl}/${problemSetId}/members/${encodeURIComponent(userDID)}/compartments`,
      { headers: { 'X-DID': userDID } },
    );
    return response.compartmentIds;
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  async getNotificationCounts(
    lastSeenMap: Record<string, string>,
    userDID: string
  ): Promise<Record<string, number>> {
    const response = await this.fetchJSON<{ counts: Record<string, number> }>(
      `${this.baseUrl}/notifications/counts`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ lastSeenMap }),
      }
    );
    return response.counts;
  }

  // ─── Panel Config ──────────────────────────────────────────────────────────

  async getPanelConfig(
    problemSetId: string,
    userDID: string
  ): Promise<{ panelVisibility: Record<string, string[]>; defaultTab: string }> {
    return this.fetchJSON<{ panelVisibility: Record<string, string[]>; defaultTab: string }>(
      `${this.baseUrl}/${problemSetId}/panel-config`,
      { headers: { 'X-DID': userDID } }
    );
  }

  async updatePanelConfig(
    problemSetId: string,
    panelVisibility: Record<string, string[]>,
    userDID: string,
    defaultTab?: string
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/panel-config`,
      {
        method: 'PUT',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ panelVisibility, defaultTab }),
      }
    );
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  async getSubscriptions(
    problemSetId: string,
    userDID: string
  ): Promise<{ asSubscriber: Subscription[]; asPublisher: Subscription[] }> {
    return this.fetchJSON<{ asSubscriber: Subscription[]; asPublisher: Subscription[] }>(
      `${this.baseUrl}/${problemSetId}/subscriptions`,
      { headers: { 'X-DID': userDID } }
    );
  }

  async createSubscription(
    problemSetId: string,
    publisherProblemSetId: string,
    dataTypes: string[],
    userDID: string
  ): Promise<Subscription> {
    return this.fetchJSON<Subscription>(
      `${this.baseUrl}/${problemSetId}/subscriptions`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ publisherProblemSetId, dataTypes }),
      }
    );
  }

  async updateSubscriptionStatus(
    problemSetId: string,
    subId: string,
    status: 'approved' | 'rejected',
    userDID: string
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/subscriptions/${subId}/status`,
      {
        method: 'PUT',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ status }),
      }
    );
  }

  async deleteSubscription(
    problemSetId: string,
    subId: string,
    userDID: string
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${problemSetId}/subscriptions/${subId}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      }
    );
  }

  // ─── Escalation ────────────────────────────────────────────────────────────

  async escalateDecision(
    problemSetId: string,
    data: { proposalKind: string; description: string; urgency: 'urgent' | 'standard' },
    userDID: string
  ): Promise<{ escalationId: string; parentProblemSetId: string; votingMechanism: string; status: string }> {
    return this.fetchJSON<{ escalationId: string; parentProblemSetId: string; votingMechanism: string; status: string }>(
      `${this.baseUrl}/${problemSetId}/escalate`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify(data),
      }
    );
  }

  async getEscalationRules(
    problemSetId: string,
    userDID: string
  ): Promise<EscalationRule[]> {
    const response = await this.fetchJSON<{ rules: EscalationRule[] }>(
      `${this.baseUrl}/${problemSetId}/escalation-rules`,
      { headers: { 'X-DID': userDID } }
    );
    return response.rules;
  }

  async createEscalationRule(
    problemSetId: string,
    rule: { ruleType: string; proposalKind: string; votingMechanism?: string },
    userDID: string
  ): Promise<EscalationRule> {
    return this.fetchJSON<EscalationRule>(
      `${this.baseUrl}/${problemSetId}/escalation-rules`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify(rule),
      }
    );
  }

  // ─── Scenario-to-ProblemSet ────────────────────────────────────────────────

  async createFromScenario(
    scenarioId: string,
    fields?: {
      name?: string; description?: string; echelon?: string;
      classification?: string; inviteMode?: string;
      discoverability?: string; problemStatement?: string;
    }
  ): Promise<ProblemSetDetail> {
    return this.fetchJSON<ProblemSetDetail>(`${this.baseUrl}/from-scenario`, {
      method: 'POST',
      body: JSON.stringify({ scenarioId, ...fields }),
    });
  }

  async getScenarioUsageCounts(): Promise<Record<string, number>> {
    return this.fetchJSON<Record<string, number>>(`${this.baseUrl}/scenario-usage-counts`);
  }

  async getLinkedScenario(problemSetId: string): Promise<import('../types/exercise').ExerciseScenario | null> {
    try {
      return await this.fetchJSON<import('../types/exercise').ExerciseScenario>(`${this.baseUrl}/${problemSetId}/linked-scenario`);
    } catch {
      return null;
    }
  }

  async createLinkedScenario(
    problemSetId: string,
    data: {
      name: string;
      designation?: 'training/exercise' | 'operational';
      exercisePhases?: string[];
      enabledRoles?: string[];
    }
  ): Promise<import('../types/exercise').ExerciseScenario> {
    return this.fetchJSON<import('../types/exercise').ExerciseScenario>(
      `${this.baseUrl}/${problemSetId}/scenario`,
      { method: 'POST', body: JSON.stringify(data) },
    );
  }

  // ─── Public Agent / Team Listing ───────────────────────────────────────────

  /** List active agents (no admin required) */
  async listAgents(): Promise<{ agentId: string; name: string; description: string; agentDID: string; role: string; active: boolean }[]> {
    return this.fetchJSON(`${this.baseUrl}/agents/list`);
  }

  /** List enabled teams (no admin required) */
  async listTeams(): Promise<{ teamId: string; name: string; description: string; teamDID: string; isEnabled: boolean }[]> {
    return this.fetchJSON(`${this.baseUrl}/teams/list`);
  }
}

export const problemSetService = new ProblemSetService();
