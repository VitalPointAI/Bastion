/**
 * Resource Management Service
 *
 * Client for resource management API endpoints.
 * Handles equipment, personnel, and consumables for mission force structures.
 */

// Use environment variable or empty string for relative URLs (Vite proxy)
export const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

/**
 * Resource types
 */
export type ResourceStatus = 'FMC' | 'PMC' | 'NMC';
export type ResourceCategory =
  | 'vehicles'
  | 'weapons'
  | 'communications'
  | 'sensors'
  | 'medical'
  | 'other';

export type PersonnelStatus = 'ready' | 'limited' | 'unavailable';

export interface Resource {
  id: string;
  missionId: string;
  name: string;
  category: ResourceCategory;
  serialNumber?: string;
  status: ResourceStatus;
  specifications?: Record<string, unknown>;
  location?: string;
  createdAt: string;
  updatedAt: string;
  // Registry extensions (Phase 27 - DID identity)
  did?: string;
  isAutonomous?: boolean;
  capabilities?: string[];
  groupId?: string;
}

export interface Personnel {
  id: string;
  missionId: string;
  name: string;
  rank?: string;
  unitId?: string;
  status: PersonnelStatus;
  specializations?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Consumable {
  id: string;
  missionId: string;
  name: string;
  category: string;
  currentLevel: number;
  minimumLevel: number;
  unit: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkImportRow {
  [key: string]: unknown;
  name: string;
  category: string;
  serialNumber?: string;
  status?: ResourceStatus;
  location?: string;
}

export interface BulkImportResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Resource Management Service class.
 */
class ResourceService {
  private userDID: string | null = null;

  /**
   * Set user DID for API requests.
   */
  setUserDID(did: string): void {
    this.userDID = did;
  }

  /**
   * Make authenticated API request.
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
  // Resource Operations (Equipment)
  // ============================================================================

  /**
   * Create a new resource.
   */
  async createResource(data: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
    return this.fetch<Resource>('/api/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get resources for a mission, optionally filtered by category.
   */
  async getResources(missionId: string, category?: ResourceCategory): Promise<Resource[]> {
    const params = new URLSearchParams({ missionId });
    if (category) {
      params.append('category', category);
    }

    const response = await this.fetch<{ resources: Resource[] }>(
      `/api/resources?${params.toString()}`
    );
    return response.resources || [];
  }

  /**
   * Update a resource.
   */
  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource> {
    return this.fetch<Resource>(`/api/resources/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Update resource status.
   */
  async updateStatus(id: string, status: ResourceStatus): Promise<Resource> {
    return this.fetch<Resource>(`/api/resources/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Delete a resource.
   */
  async deleteResource(id: string): Promise<void> {
    await this.fetch<void>(`/api/resources/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Bulk import resources from CSV data.
   */
  async bulkImport(missionId: string, rows: BulkImportRow[]): Promise<BulkImportResult> {
    return this.fetch<BulkImportResult>('/api/resources/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ missionId, rows }),
    });
  }

  // ============================================================================
  // Personnel Operations
  // ============================================================================

  /**
   * Create new personnel.
   */
  async createPersonnel(data: Omit<Personnel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Personnel> {
    return this.fetch<Personnel>('/api/resources/personnel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get personnel for a mission, optionally filtered by unit.
   */
  async getPersonnel(missionId: string, unitId?: string): Promise<Personnel[]> {
    const params = new URLSearchParams({ missionId });
    if (unitId) {
      params.append('unitId', unitId);
    }

    const response = await this.fetch<{ personnel: Personnel[] }>(
      `/api/resources/personnel?${params.toString()}`
    );
    return response.personnel || [];
  }

  /**
   * Update personnel.
   */
  async updatePersonnel(id: string, updates: Partial<Personnel>): Promise<Personnel> {
    return this.fetch<Personnel>(`/api/resources/personnel/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Assign personnel to a unit.
   */
  async assignToUnit(id: string, unitId: string | null): Promise<Personnel> {
    return this.fetch<Personnel>(`/api/resources/personnel/${encodeURIComponent(id)}/unit`, {
      method: 'PATCH',
      body: JSON.stringify({ unitId }),
    });
  }

  /**
   * Delete personnel.
   */
  async deletePersonnel(id: string): Promise<void> {
    await this.fetch<void>(`/api/resources/personnel/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Consumable Operations
  // ============================================================================

  /**
   * Create new consumable.
   */
  async createConsumable(data: Omit<Consumable, 'id' | 'createdAt' | 'updatedAt'>): Promise<Consumable> {
    return this.fetch<Consumable>('/api/resources/consumables', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get consumables for a mission, optionally filtered by category.
   */
  async getConsumables(missionId: string, category?: string): Promise<Consumable[]> {
    const params = new URLSearchParams({ missionId });
    if (category) {
      params.append('category', category);
    }

    const response = await this.fetch<{ consumables: Consumable[] }>(
      `/api/resources/consumables?${params.toString()}`
    );
    return response.consumables || [];
  }

  /**
   * Update consumable level.
   */
  async updateLevel(id: string, currentLevel: number): Promise<Consumable> {
    return this.fetch<Consumable>(`/api/resources/consumables/${encodeURIComponent(id)}/level`, {
      method: 'PATCH',
      body: JSON.stringify({ currentLevel }),
    });
  }

  /**
   * Get low stock consumables for a mission.
   */
  async getLowStock(missionId: string): Promise<Consumable[]> {
    const response = await this.fetch<{ consumables: Consumable[] }>(
      `/api/resources/consumables/low-stock?missionId=${encodeURIComponent(missionId)}`
    );
    return response.consumables || [];
  }
}

/**
 * Singleton instance of the resource service.
 */
export const resourceService = new ResourceService();

/**
 * Get status badge label.
 */
export function getStatusLabel(status: ResourceStatus): string {
  switch (status) {
    case 'FMC':
      return 'Fully Mission Capable';
    case 'PMC':
      return 'Partially Mission Capable';
    case 'NMC':
      return 'Not Mission Capable';
    default:
      return status;
  }
}

/**
 * Get status badge color.
 */
export function getStatusColor(status: ResourceStatus): string {
  switch (status) {
    case 'FMC':
      return 'green';
    case 'PMC':
      return 'yellow';
    case 'NMC':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get category display name.
 */
export function getCategoryName(category: ResourceCategory): string {
  const names: Record<ResourceCategory, string> = {
    vehicles: 'Vehicles',
    weapons: 'Weapons',
    communications: 'Communications',
    sensors: 'Sensors',
    medical: 'Medical',
    other: 'Other',
  };
  return names[category] || category;
}
