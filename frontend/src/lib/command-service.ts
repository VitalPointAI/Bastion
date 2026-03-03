/**
 * Command Service
 *
 * Client for command operations API endpoints.
 * Provides typed methods for units, relationships, hierarchy, and validation.
 */

import type {
  CommandUnit,
  CommandRelationship,
  RelationshipType,
  HierarchyNode,
  CommandMatrix,
} from './types/command.js';

// Use environment variable or empty string for relative URLs (Vite proxy)
export const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

/**
 * Paginated list response from backend.
 */
interface PaginatedResponse<T> {
  units?: T[];
  relationships?: T[];
  count: number;
  total?: number;
  limit: number;
  offset: number;
}

/**
 * Hierarchy response from backend.
 */
interface HierarchyResponse {
  rootUnits: HierarchyNode[];
  totalUnits: number;
}

/**
 * Validation response from backend.
 */
interface ValidationResponse {
  valid: boolean;
  errors?: string[];
  cycles?: string[][];
}

/**
 * Command Service class.
 * Manages command units, relationships, hierarchy, and validation.
 */
class CommandService {
  private userDID: string | null = null;

  /**
   * Set user DID for API requests.
   */
  setUserDID(did: string): void {
    this.userDID = did;
  }

  /**
   * Make authenticated API request.
   * Returns raw JSON response from backend (no success wrapper expected).
   * Authentication is via HttpOnly cookie sent automatically with credentials: 'include'.
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============================================================================
  // Unit Operations
  // ============================================================================

  /**
   * Create a new command unit.
   */
  async createUnit(
    missionId: string,
    data: {
      name: string;
      sidc: string;
      echelon: string;
      description?: string;
    }
  ): Promise<CommandUnit> {
    return this.fetch<CommandUnit>('/api/command/units', {
      method: 'POST',
      body: JSON.stringify({ missionId, ...data }),
    });
  }

  /**
   * Get all units for a mission.
   */
  async getUnits(missionId: string): Promise<CommandUnit[]> {
    const response = await this.fetch<PaginatedResponse<CommandUnit>>(
      `/api/command/units?missionId=${encodeURIComponent(missionId)}`
    );
    return response.units || [];
  }

  /**
   * Get a specific unit by ID.
   */
  async getUnit(id: string): Promise<CommandUnit> {
    return this.fetch<CommandUnit>(`/api/command/units/${encodeURIComponent(id)}`);
  }

  /**
   * Update a unit.
   */
  async updateUnit(
    id: string,
    updates: Partial<CommandUnit>
  ): Promise<CommandUnit> {
    return this.fetch<CommandUnit>(`/api/command/units/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a unit.
   */
  async deleteUnit(id: string): Promise<void> {
    await this.fetch<void>(`/api/command/units/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Relationship Operations
  // ============================================================================

  /**
   * Create a new command relationship.
   */
  async createRelationship(data: {
    missionId: string;
    superiorUnitId: string;
    subordinateUnitId: string;
    relationshipType: RelationshipType;
    effectiveFrom?: string;
    effectiveTo?: string;
  }): Promise<CommandRelationship> {
    return this.fetch<CommandRelationship>('/api/command/relationships', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get all relationships for a mission.
   */
  async getRelationships(missionId: string): Promise<CommandRelationship[]> {
    const response = await this.fetch<PaginatedResponse<CommandRelationship>>(
      `/api/command/relationships?missionId=${encodeURIComponent(missionId)}`
    );
    return response.relationships || [];
  }

  /**
   * Delete a relationship.
   */
  async deleteRelationship(id: string): Promise<void> {
    await this.fetch<void>(`/api/command/relationships/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Hierarchy Operations
  // ============================================================================

  /**
   * Get command hierarchy for a mission.
   */
  async getHierarchy(missionId: string): Promise<HierarchyNode[]> {
    const response = await this.fetch<HierarchyResponse>(
      `/api/command/hierarchy/${encodeURIComponent(missionId)}`
    );
    return response.rootUnits || [];
  }

  /**
   * Validate command hierarchy for cycles.
   */
  async validateHierarchy(missionId: string): Promise<ValidationResponse> {
    return this.fetch<ValidationResponse>(
      `/api/command/validate-hierarchy/${encodeURIComponent(missionId)}`
    );
  }

  // ============================================================================
  // Matrix Operations
  // ============================================================================

  /**
   * Get command matrix for a mission.
   */
  async getMatrix(missionId: string): Promise<CommandMatrix> {
    return this.fetch<CommandMatrix>(
      `/api/command/matrix/${encodeURIComponent(missionId)}`
    );
  }
}

/**
 * Singleton instance of the command service.
 */
export const commandService = new CommandService();

/**
 * Get display name for relationship type.
 */
export function getRelationshipTypeName(type: RelationshipType): string {
  const names: Record<RelationshipType, string> = {
    OPCON: 'Operational Control',
    TACON: 'Tactical Control',
    ADCON: 'Administrative Control',
    COCOM: 'Combatant Command',
    DS: 'Direct Support',
    GS: 'General Support',
    GSR: 'General Support Reinforcing',
    R: 'Reinforcing',
  };
  return names[type] || type;
}

/**
 * Get relationship type color class.
 */
export function getRelationshipTypeColor(type: RelationshipType): string {
  switch (type) {
    case 'COCOM':
      return 'relationship-cocom';
    case 'OPCON':
      return 'relationship-opcon';
    case 'TACON':
      return 'relationship-tacon';
    case 'ADCON':
      return 'relationship-adcon';
    case 'DS':
    case 'GS':
    case 'GSR':
    case 'R':
      return 'relationship-support';
    default:
      return 'relationship-default';
  }
}
