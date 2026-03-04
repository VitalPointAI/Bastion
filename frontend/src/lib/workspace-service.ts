/**
 * Workspace Service
 *
 * API client for all workspace operations:
 * - Workspace CRUD
 * - Membership management
 * - Invite management
 * - Roles and activity
 * - Notification counts
 */

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Request Types ────────────────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  workspaceType: 'Organization' | 'Unit' | 'Team';
  classification?: string;
  parentWorkspaceId?: string;
  inviteMode?: 'open' | 'gated';
  discoverability?: 'discoverable' | 'private';
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface WorkspaceMembership {
  workspaceId: string;
  name: string;
  workspaceType: 'Organization' | 'Unit' | 'Team';
  classification: string;
  role: string;
  daoRole: string;
  isPrimary: boolean;
  status: string;
}

export interface WorkspaceDetail {
  id: string;
  daoId: string;
  name: string;
  description: string | null;
  workspaceType: string;
  classification: string;
  parentWorkspaceId: string | null;
  inviteMode: string;
  discoverability: string;
  memberCount: number;
  createdBy: string;
  createdAt: string;
}

export interface WorkspaceMemberDetail {
  id: string;
  workspaceId: string;
  userDid: string;
  role: string;
  daoRole: string;
  isPrimary: boolean;
  status: string;
  joinedAt: string;
}

export interface WorkspaceInviteDetail {
  id: string;
  workspaceId: string;
  role: string;
  daoRole: string;
  inviteeEmail: string | null;
  inviteeDid: string | null;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  rawToken?: string;
}

export interface WorkspaceActivityItem {
  id: string;
  activityType: string;
  actorDid: string;
  subjectDid: string | null;
  metadata: Record<string, unknown>;
  txHash: string | null;
  createdAt: string;
}

export interface WorkspaceRole {
  id: string;
  militaryLabel: string;
  daoRoleName: string;
  permissions: string[];
}

export interface HierarchyNode {
  id: string;
  name: string;
  workspaceType: string;
  memberCount: number;
  children?: HierarchyNode[];
}

export interface WorkspaceCompartment {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  /** Member DIDs assigned to this compartment (populated when requested with members) */
  memberDids?: string[];
}

// ─── Service Class ────────────────────────────────────────────────────────────

class WorkspaceService {
  private baseUrl = `${API_BASE}/api/workspaces`;

  private async fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
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

  // ─── Workspace CRUD ─────────────────────────────────────────────────────────

  async createWorkspace(input: CreateWorkspaceInput, userDID: string): Promise<WorkspaceDetail> {
    return this.fetchJSON<WorkspaceDetail>(this.baseUrl, {
      method: 'POST',
      headers: { 'X-DID': userDID },
      body: JSON.stringify(input),
    });
  }

  async listMyMemberships(userDID: string): Promise<WorkspaceMembership[]> {
    const response = await this.fetchJSON<{ memberships: WorkspaceMembership[] }>(
      `${this.baseUrl}/me`,
      { headers: { 'X-DID': userDID } }
    );
    return response.memberships;
  }

  async getWorkspace(id: string, userDID: string): Promise<WorkspaceDetail> {
    return this.fetchJSON<WorkspaceDetail>(`${this.baseUrl}/${id}`, {
      headers: { 'X-DID': userDID },
    });
  }

  async getHierarchy(workspaceId: string, userDID: string): Promise<HierarchyNode[]> {
    const response = await this.fetchJSON<{ tree: HierarchyNode[] }>(
      `${this.baseUrl}/${workspaceId}/hierarchy`,
      { headers: { 'X-DID': userDID } }
    );
    return response.tree;
  }

  async updateWorkspace(
    id: string,
    updates: Partial<{ name: string; description: string; inviteMode: string; discoverability: string }>,
    userDID: string
  ): Promise<WorkspaceDetail> {
    return this.fetchJSON<WorkspaceDetail>(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'X-DID': userDID },
      body: JSON.stringify(updates),
    });
  }

  // ─── Membership Management ──────────────────────────────────────────────────

  async listMembers(workspaceId: string, userDID: string): Promise<WorkspaceMemberDetail[]> {
    const response = await this.fetchJSON<{ members: WorkspaceMemberDetail[] }>(
      `${this.baseUrl}/${workspaceId}/members`,
      { headers: { 'X-DID': userDID } }
    );
    return response.members;
  }

  async changeRole(
    workspaceId: string,
    memberDid: string,
    newRole: string,
    newDaoRole: string,
    userDID: string
  ): Promise<WorkspaceMemberDetail> {
    return this.fetchJSON<WorkspaceMemberDetail>(
      `${this.baseUrl}/${workspaceId}/members/${memberDid}/role`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ role: newRole, daoRole: newDaoRole }),
      }
    );
  }

  async suspendMember(workspaceId: string, memberDid: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/members/${memberDid}/suspend`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
      }
    );
  }

  async unsuspendMember(workspaceId: string, memberDid: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/members/${memberDid}/unsuspend`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
      }
    );
  }

  async removeMember(workspaceId: string, memberDid: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/members/${memberDid}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      }
    );
  }

  // ─── Invite Management ──────────────────────────────────────────────────────

  async createInvite(
    workspaceId: string,
    role: string,
    daoRole: string,
    userDID: string,
    options?: { inviteeEmail?: string; inviteeDid?: string; expiresInHours?: number }
  ): Promise<{ invite: WorkspaceInviteDetail; rawToken: string }> {
    return this.fetchJSON<{ invite: WorkspaceInviteDetail; rawToken: string }>(
      `${this.baseUrl}/${workspaceId}/invite`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ role, daoRole, ...options }),
      }
    );
  }

  async listPendingInvites(workspaceId: string, userDID: string): Promise<WorkspaceInviteDetail[]> {
    const response = await this.fetchJSON<{ invites: WorkspaceInviteDetail[] }>(
      `${this.baseUrl}/${workspaceId}/invites`,
      { headers: { 'X-DID': userDID } }
    );
    return response.invites;
  }

  async acceptInvite(token: string, userDID: string): Promise<WorkspaceMemberDetail | null> {
    const response = await fetch(`${this.baseUrl}/invite/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DID': userDID,
      },
      body: JSON.stringify({ token }),
    });

    // 202 means pending approval (gated workspace)
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

    return response.json() as Promise<WorkspaceMemberDetail>;
  }

  async approveInvite(workspaceId: string, inviteId: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/invites/${inviteId}/approve`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
      }
    );
  }

  async cancelInvite(workspaceId: string, inviteId: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/invites/${inviteId}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      }
    );
  }

  // ─── Workspace Settings ─────────────────────────────────────────────────────

  async setPrimary(workspaceId: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(`${this.baseUrl}/me/primary`, {
      method: 'PUT',
      headers: { 'X-DID': userDID },
      body: JSON.stringify({ workspaceId }),
    });
  }

  // ─── Roles & Activity ───────────────────────────────────────────────────────

  async listRoles(workspaceId: string, userDID: string): Promise<WorkspaceRole[]> {
    const response = await this.fetchJSON<{ roles: WorkspaceRole[] }>(
      `${this.baseUrl}/${workspaceId}/roles`,
      { headers: { 'X-DID': userDID } }
    );
    return response.roles;
  }

  async listActivity(
    workspaceId: string,
    userDID: string,
    options?: { limit?: number; offset?: number }
  ): Promise<WorkspaceActivityItem[]> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const response = await this.fetchJSON<{ activity: WorkspaceActivityItem[] }>(
      `${this.baseUrl}/${workspaceId}/activity${queryString}`,
      { headers: { 'X-DID': userDID } }
    );
    return response.activity;
  }

  // ─── Compartments ────────────────────────────────────────────────────────────

  async listCompartments(
    workspaceId: string,
    userDID: string,
  ): Promise<WorkspaceCompartment[]> {
    const response = await this.fetchJSON<{ compartments: WorkspaceCompartment[] }>(
      `${this.baseUrl}/${workspaceId}/compartments`,
      { headers: { 'X-DID': userDID } },
    );
    return response.compartments;
  }

  async createCompartment(
    workspaceId: string,
    name: string,
    description: string | null,
    userDID: string,
  ): Promise<WorkspaceCompartment> {
    return this.fetchJSON<WorkspaceCompartment>(
      `${this.baseUrl}/${workspaceId}/compartments`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ name, description }),
      },
    );
  }

  async deleteCompartment(
    workspaceId: string,
    compartmentId: string,
    userDID: string,
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/compartments/${compartmentId}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      },
    );
  }

  async assignMemberToCompartment(
    workspaceId: string,
    compartmentId: string,
    memberDid: string,
    userDID: string,
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/compartments/${compartmentId}/members`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ memberDid }),
      },
    );
  }

  async removeMemberFromCompartment(
    workspaceId: string,
    compartmentId: string,
    memberDid: string,
    userDID: string,
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${this.baseUrl}/${workspaceId}/compartments/${compartmentId}/members/${memberDid}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      },
    );
  }

  async getMyCompartments(
    workspaceId: string,
    userDID: string,
  ): Promise<string[]> {
    const response = await this.fetchJSON<{ compartmentIds: string[] }>(
      `${this.baseUrl}/${workspaceId}/members/${encodeURIComponent(userDID)}/compartments`,
      { headers: { 'X-DID': userDID } },
    );
    return response.compartmentIds;
  }

  // ─── Notifications ──────────────────────────────────────────────────────────

  async getNotificationCounts(
    lastSeenMap: Record<string, string>,
    userDID: string
  ): Promise<Record<string, number>> {
    return this.fetchJSON<Record<string, number>>(
      `${this.baseUrl}/notifications/counts`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ lastSeenMap }),
      }
    );
  }
}

export const workspaceService = new WorkspaceService();
