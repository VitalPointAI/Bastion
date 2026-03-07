/**
 * Resource Registry Service
 *
 * Phase 27 Plan 05: Frontend client for the resource registry API.
 * Handles registry queries, DID resolution, resource grouping,
 * telemetry ingestion, and WebSocket position updates.
 *
 * Follows resource-service.ts patterns (authenticated fetch, singleton, credentials: 'include').
 */

import type { ResourceStatus, ResourceCategory } from './resource-service.js';

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Resource with registry extensions (DID, capabilities, trust, grouping) */
export interface RegisteredResource {
  id: string;
  missionId: string;
  name: string;
  category: ResourceCategory;
  serialNumber?: string;
  status: ResourceStatus;
  specifications?: Record<string, unknown>;
  location?: string;
  lat?: number;
  lng?: number;
  sidc?: string;
  createdAt: string;
  updatedAt: string;
  // Registry extensions
  did?: string;
  blindedKey?: string;
  publicKey?: string;
  trustTier?: 'explicit' | 'vouched' | 'verified' | 'autonomous';
  isAutonomous?: boolean;
  capabilities?: string[];
  groupId?: string;
}

/** Resource group with aggregate capabilities */
export interface ResourceGroup {
  id: string;
  missionId: string;
  name: string;
  groupType: 'task_force' | 'support' | 'reserve' | 'custom';
  aggregateCapabilities: string[];
  memberCount: number;
}

/** Search parameters for the registry */
export interface RegistrySearchParams {
  capability?: string;
  category?: ResourceCategory;
  status?: ResourceStatus;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  did?: string;
  missionId?: string;
}

/** Telemetry frame for real-time position updates */
export interface TelemetryFrame {
  resourceId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

/** Registry statistics */
export interface RegistryStats {
  totalResources: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  withDID: number;
  autonomous: number;
  groupCount: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

class ResourceRegistryService {
  private userDID: string | null = null;
  private positionListeners: Set<(positions: Record<string, TelemetryFrame>) => void> = new Set();
  private wsCleanup: (() => void) | null = null;

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
  // Registry Queries
  // ============================================================================

  /**
   * Search the resource registry with optional filters.
   */
  async searchRegistry(params: RegistrySearchParams): Promise<RegisteredResource[]> {
    const searchParams = new URLSearchParams();
    if (params.capability) searchParams.append('capability', params.capability);
    if (params.category) searchParams.append('category', params.category);
    if (params.status) searchParams.append('status', params.status);
    if (params.north !== undefined) searchParams.append('north', String(params.north));
    if (params.south !== undefined) searchParams.append('south', String(params.south));
    if (params.east !== undefined) searchParams.append('east', String(params.east));
    if (params.west !== undefined) searchParams.append('west', String(params.west));
    if (params.did) searchParams.append('did', params.did);
    if (params.missionId) searchParams.append('missionId', params.missionId);

    const qs = searchParams.toString();
    const response = await this.fetch<{ resources: RegisteredResource[] }>(
      `/api/resources/registry/search${qs ? `?${qs}` : ''}`
    );
    return response.resources || [];
  }

  /**
   * Get registry statistics.
   */
  async getRegistryStats(): Promise<RegistryStats> {
    return this.fetch<RegistryStats>('/api/resources/registry/stats');
  }

  /**
   * Get available capabilities across all registered resources.
   */
  async getAvailableCapabilities(): Promise<string[]> {
    const response = await this.fetch<{ capabilities: string[] }>(
      '/api/resources/registry/capabilities'
    );
    return response.capabilities || [];
  }

  /**
   * Resolve a resource by DID.
   */
  async resolveByDID(did: string): Promise<RegisteredResource> {
    return this.fetch<RegisteredResource>(
      `/api/resources/did/${encodeURIComponent(did)}`
    );
  }

  /**
   * Register a new resource with DID.
   */
  async registerResource(
    manifest: Omit<RegisteredResource, 'id' | 'did' | 'createdAt' | 'updatedAt'>
  ): Promise<RegisteredResource> {
    return this.fetch<RegisteredResource>('/api/resources/registry/register', {
      method: 'POST',
      body: JSON.stringify(manifest),
    });
  }

  // ============================================================================
  // Group Operations
  // ============================================================================

  /**
   * List resource groups for a mission.
   */
  async listGroups(missionId: string): Promise<ResourceGroup[]> {
    const response = await this.fetch<{ groups: ResourceGroup[] }>(
      `/api/resources/groups?missionId=${encodeURIComponent(missionId)}`
    );
    return response.groups || [];
  }

  /**
   * Create a resource group.
   */
  async createGroup(data: {
    missionId: string;
    name: string;
    groupType: ResourceGroup['groupType'];
  }): Promise<ResourceGroup> {
    return this.fetch<ResourceGroup>('/api/resources/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Add a resource to a group.
   */
  async addToGroup(groupId: string, resourceId: string): Promise<void> {
    await this.fetch<void>(
      `/api/resources/groups/${encodeURIComponent(groupId)}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ resourceId }),
      }
    );
  }

  /**
   * Remove a resource from a group.
   */
  async removeFromGroup(groupId: string, resourceId: string): Promise<void> {
    await this.fetch<void>(
      `/api/resources/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(resourceId)}`,
      { method: 'DELETE' }
    );
  }

  // ============================================================================
  // Telemetry
  // ============================================================================

  /**
   * Ingest a telemetry frame (manual push).
   */
  async ingestTelemetry(data: TelemetryFrame): Promise<void> {
    await this.fetch<void>('/api/resources/telemetry', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // WebSocket Position Updates
  // ============================================================================

  /**
   * Subscribe to real-time resource position updates.
   * Listens on the existing WebSocket for `resource:position_batch` messages.
   * Returns an unsubscribe function.
   */
  subscribeToPositions(
    callback: (positions: Record<string, TelemetryFrame>) => void
  ): () => void {
    this.positionListeners.add(callback);

    // Set up WebSocket listener if this is the first subscriber
    if (this.positionListeners.size === 1) {
      this.connectPositionWebSocket();
    }

    return () => {
      this.positionListeners.delete(callback);
      // Clean up WebSocket if no more listeners
      if (this.positionListeners.size === 0 && this.wsCleanup) {
        this.wsCleanup();
        this.wsCleanup = null;
      }
    };
  }

  private connectPositionWebSocket(): void {
    // Determine WebSocket URL from API base or window location
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsBase = API_BASE
      ? API_BASE.replace(/^http/, 'ws')
      : `${wsProtocol}//${window.location.host}`;
    const wsUrl = `${wsBase}/ws/resources`;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;

      try {
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'resource:position_batch' && msg.positions) {
              const positions = msg.positions as Record<string, TelemetryFrame>;
              for (const listener of this.positionListeners) {
                listener(positions);
              }
            }
          } catch {
            // Ignore non-JSON messages
          }
        };

        ws.onclose = () => {
          if (!stopped) {
            // Reconnect after 5 seconds
            reconnectTimer = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // Connection failed, retry
        if (!stopped) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    this.wsCleanup = () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }
}

/**
 * Singleton instance of the resource registry service.
 */
export const resourceRegistryService = new ResourceRegistryService();
