/**
 * Mission Service
 *
 * API client for all mission operations:
 * - Mission CRUD
 * - Participant management
 * - Invitation management
 * - Mission lifecycle (activate, complete, archive)
 */

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

export type MissionStatus = 'planning' | 'active' | 'complete' | 'archived';
export type Classification = 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
export type ParticipantRole = 'commander' | 'staff' | 'observer';

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface CreateMissionInput {
  name: string;
  description?: string;
  classification: Classification;
  problemSetId?: string;
  areaOfOperations?: GeoJSONPolygon;
  pendingInvites?: {
    inviteeDID?: string;
    email?: string;
    role: ParticipantRole;
    expiresInHours?: number;
  }[];
}

export interface Mission {
  missionId: string;
  name: string;
  description?: string;
  classification: Classification;
  status: MissionStatus;
  workspaceId?: string; // Backend wire format — will be renamed when backend is updated
  areaOfOperations?: GeoJSONPolygon;
  creatorDID: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface Participant {
  participantId: string;
  missionId: string;
  userDID: string;
  role: ParticipantRole;
  joinedAt: string;
  addedBy: string;
}

export interface Invite {
  inviteId: string;
  missionId: string;
  inviteeDID?: string;
  email?: string;
  role: ParticipantRole;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  cancelledAt?: string;
}

export interface ListMissionsFilters {
  status?: MissionStatus;
  classification?: Classification;
  problemSetId?: string;
  includeArchived?: boolean;
}

class MissionService {
  private async fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Mission CRUD

  async createMission(data: CreateMissionInput, userDID: string): Promise<Mission> {
    // Map problemSetId to workspaceId for backend compatibility
    const { problemSetId, ...rest } = data;
    const payload = { ...rest, workspaceId: problemSetId };
    return this.fetchJSON<Mission>(`${API_BASE}/api/missions`, {
      method: 'POST',
      headers: { 'X-DID': userDID },
      body: JSON.stringify(payload),
    });
  }

  async getMission(missionId: string, userDID: string): Promise<Mission> {
    return this.fetchJSON<Mission>(`${API_BASE}/api/missions/${missionId}`, {
      headers: { 'X-DID': userDID },
    });
  }

  async listMissions(filters: ListMissionsFilters, userDID: string): Promise<Mission[]> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.classification) params.append('classification', filters.classification);
    if (filters.problemSetId) params.append('workspaceId', filters.problemSetId);
    if (filters.includeArchived) params.append('includeArchived', 'true');

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await this.fetchJSON<{ missions: Mission[] }>(
      `${API_BASE}/api/missions${queryString}`,
      { headers: { 'X-DID': userDID } }
    );
    return response.missions;
  }

  async updateMission(
    missionId: string,
    updates: Partial<Omit<Mission, 'missionId' | 'creatorDID' | 'createdAt'>>,
    userDID: string
  ): Promise<Mission> {
    return this.fetchJSON<Mission>(`${API_BASE}/api/missions/${missionId}`, {
      method: 'PATCH',
      headers: { 'X-DID': userDID },
      body: JSON.stringify(updates),
    });
  }

  // Mission Lifecycle

  async activateMission(missionId: string, userDID: string): Promise<Mission> {
    return this.fetchJSON<Mission>(`${API_BASE}/api/missions/${missionId}/activate`, {
      method: 'POST',
      headers: { 'X-DID': userDID },
    });
  }

  async completeMission(missionId: string, userDID: string): Promise<Mission> {
    return this.fetchJSON<Mission>(`${API_BASE}/api/missions/${missionId}/complete`, {
      method: 'POST',
      headers: { 'X-DID': userDID },
    });
  }

  async archiveMission(missionId: string, userDID: string): Promise<Mission> {
    return this.fetchJSON<Mission>(`${API_BASE}/api/missions/${missionId}/archive`, {
      method: 'POST',
      headers: { 'X-DID': userDID },
    });
  }

  // Participants

  async listParticipants(missionId: string, userDID: string): Promise<Participant[]> {
    const response = await this.fetchJSON<{ participants: Participant[] }>(
      `${API_BASE}/api/missions/${missionId}/participants`,
      { headers: { 'X-DID': userDID } }
    );
    return response.participants;
  }

  async removeParticipant(
    missionId: string,
    participantId: string,
    userDID: string
  ): Promise<void> {
    await this.fetchJSON<void>(
      `${API_BASE}/api/missions/${missionId}/participants/${participantId}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      }
    );
  }

  // Invites

  async createInvite(
    missionId: string,
    data: {
      inviteeDID?: string;
      email?: string;
      role: ParticipantRole;
      expiresInHours?: number;
    },
    userDID: string
  ): Promise<Invite> {
    return this.fetchJSON<Invite>(`${API_BASE}/api/missions/${missionId}/invites`, {
      method: 'POST',
      headers: { 'X-DID': userDID },
      body: JSON.stringify(data),
    });
  }

  async listInvites(missionId: string, userDID: string): Promise<Invite[]> {
    const response = await this.fetchJSON<{ invites: Invite[] }>(
      `${API_BASE}/api/missions/${missionId}/invites`,
      { headers: { 'X-DID': userDID } }
    );
    return response.invites;
  }

  async cancelInvite(missionId: string, inviteId: string, userDID: string): Promise<void> {
    await this.fetchJSON<void>(
      `${API_BASE}/api/missions/${missionId}/invites/${inviteId}`,
      {
        method: 'DELETE',
        headers: { 'X-DID': userDID },
      }
    );
  }

  async acceptInvite(token: string, userDID: string): Promise<Participant> {
    return this.fetchJSON<Participant>(`${API_BASE}/api/missions/accept-invite`, {
      method: 'POST',
      headers: { 'X-DID': userDID },
      body: JSON.stringify({ token }),
    });
  }
}

export const missionService = new MissionService();
