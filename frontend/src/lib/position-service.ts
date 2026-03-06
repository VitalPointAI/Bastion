/**
 * Position Service
 *
 * Quick Task 9: API client for exercise position CRUD, phase mappings, and bulk operations.
 * Follows the ProblemSetService pattern.
 */

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PositionSide = 'blue' | 'red' | 'neutral' | 'green';

export interface PositionPhaseMapping {
  id: string;
  positionId: string;
  exercisePhase: string;
  title: string;
  duties: string | null;
}

export interface ExercisePosition {
  id: string;
  problemSetId: string;
  side: PositionSide;
  title: string;
  duties: string | null;
  sortOrder: number;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  phaseMappings?: PositionPhaseMapping[];
}

export interface CreatePositionInput {
  side: PositionSide;
  title: string;
  duties?: string;
  sortOrder?: number;
  assignedTo?: string;
  phaseMappings?: Array<{ exercisePhase: string; title: string; duties?: string }>;
}

export interface UpdatePositionInput {
  side?: PositionSide;
  title?: string;
  duties?: string;
  sortOrder?: number;
  assignedTo?: string | null;
}

export interface PhaseMappingInput {
  exercisePhase: string;
  title: string;
  duties?: string;
}

// ─── Service Class ───────────────────────────────────────────────────────────

class PositionService {
  private baseUrl(problemSetId: string) {
    return `${API_BASE}/api/problem-sets/${problemSetId}/positions`;
  }

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

  async listPositions(problemSetId: string, userDID: string): Promise<ExercisePosition[]> {
    const response = await this.fetchJSON<{ positions: ExercisePosition[] }>(
      this.baseUrl(problemSetId),
      { headers: { 'X-DID': userDID } }
    );
    return response.positions;
  }

  async createPosition(
    problemSetId: string,
    input: CreatePositionInput,
    userDID: string
  ): Promise<ExercisePosition> {
    const response = await this.fetchJSON<{ position: ExercisePosition }>(
      this.baseUrl(problemSetId),
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify(input),
      }
    );
    return response.position;
  }

  async updatePosition(
    problemSetId: string,
    positionId: string,
    input: UpdatePositionInput,
    userDID: string
  ): Promise<ExercisePosition> {
    const response = await this.fetchJSON<{ position: ExercisePosition }>(
      `${this.baseUrl(problemSetId)}/${positionId}`,
      {
        method: 'PATCH',
        headers: { 'X-DID': userDID },
        body: JSON.stringify(input),
      }
    );
    return response.position;
  }

  async deletePosition(
    problemSetId: string,
    positionId: string,
    userDID: string
  ): Promise<void> {
    await fetch(`${this.baseUrl(problemSetId)}/${positionId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-DID': userDID },
    }).then((res) => {
      if (!res.ok) return res.json().then((b: { error?: string }) => { throw new Error(b.error || `HTTP ${res.status}`); });
    });
  }

  async setPhaseMappings(
    problemSetId: string,
    positionId: string,
    mappings: PhaseMappingInput[],
    userDID: string
  ): Promise<PositionPhaseMapping[]> {
    const response = await this.fetchJSON<{ mappings: PositionPhaseMapping[] }>(
      `${this.baseUrl(problemSetId)}/${positionId}/phase-mappings`,
      {
        method: 'PUT',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ mappings }),
      }
    );
    return response.mappings;
  }

  async bulkCreate(
    problemSetId: string,
    positions: CreatePositionInput[],
    userDID: string
  ): Promise<ExercisePosition[]> {
    const response = await this.fetchJSON<{ positions: ExercisePosition[] }>(
      `${this.baseUrl(problemSetId)}/bulk`,
      {
        method: 'POST',
        headers: { 'X-DID': userDID },
        body: JSON.stringify({ positions }),
      }
    );
    return response.positions;
  }
}

export const positionService = new PositionService();
