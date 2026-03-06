/**
 * COP (Common Operating Picture) API Service
 *
 * Phase 21 Plan 08: Typed API client wrapping fetch calls to the COP REST API.
 * Follows the StrategicService pattern with authenticated fetch, error handling,
 * and singleton export.
 *
 * Covers all COP endpoints: layers, versions, agents, linkages, conflicts.
 */

import type {
  COPLayer,
  COPLayerSpec,
  COPLayerType,
  LayerState,
  LayerSnapshot,
  COPConflict,
  ReviewFeedback,
} from '../types/cop.js';

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types not yet in cop.ts (backend-defined) ─────────────────────────────

/** Discovery method for entity linkages */
export type DiscoveryMethod = 'graph_traversal' | 'embedding_similarity' | 'manual';

/** Entity-data linkage between RAFT graph entity and COP symbol */
export interface EntityLinkage {
  id: string;
  entityId: string;
  symbolEntityId: string;
  layerId: string;
  confidence: number;
  autoCommitted: boolean;
  discoveryMethod: DiscoveryMethod;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

/** Agent activity entry from the COP activity bridge */
export interface AgentActivity {
  agentId: string;
  action: string;
  detail: string;
  workspaceId: string; // Backend wire format
  sectionId: string;
  timestamp: string;
}

// ─── Filter types ───────────────────────────────────────────────────────────

interface LayerFilters {
  sectionId?: string;
  state?: LayerState;
  layerType?: COPLayerType;
}

// ─── Status types ────────────────────────────────────────────────────────────

export interface COPStatus {
  status: 'idle' | 'generating' | 'ready';
  layerCount: number;
  draftCount: number;
  copCount: number;
  hasLayers: boolean;
}

// ─── COP Service ────────────────────────────────────────────────────────────

class COPService {
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

  // ==========================================================================
  // Status Operations
  // ==========================================================================

  /**
   * Get COP generation status and layer counts for a workspace.
   */
  async getStatus(problemSetId: string): Promise<COPStatus> {
    return this.fetch<COPStatus>(`/api/cop/status?workspaceId=${encodeURIComponent(problemSetId)}`);
  }

  // ==========================================================================
  // Layer Operations
  // ==========================================================================

  /**
   * Query layers for a workspace with optional filters.
   */
  async queryLayers(problemSetId: string, filters?: LayerFilters): Promise<COPLayer[]> {
    const params = new URLSearchParams({ workspaceId: problemSetId });
    if (filters?.sectionId) params.append('sectionId', filters.sectionId);
    if (filters?.state) params.append('state', filters.state);
    if (filters?.layerType) params.append('layerType', filters.layerType);
    return this.fetch<COPLayer[]>(`/api/cop/layers?${params.toString()}`);
  }

  /**
   * Get a single layer by ID.
   */
  async getLayer(layerId: string): Promise<COPLayer> {
    return this.fetch<COPLayer>(`/api/cop/layers/${encodeURIComponent(layerId)}`);
  }

  /**
   * Create a new COP layer.
   */
  async createLayer(input: {
    problemSetId: string;
    sectionId: string;
    layerType: COPLayerType;
    spec?: Partial<COPLayerSpec>;
  }): Promise<COPLayer> {
    // Backend expects workspaceId
    const { problemSetId, ...rest } = input;
    return this.fetch<COPLayer>('/api/cop/layers', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: problemSetId, ...rest }),
    });
  }

  /**
   * Update a layer's spec.
   */
  async updateLayerSpec(layerId: string, spec: COPLayerSpec): Promise<COPLayer> {
    return this.fetch<COPLayer>(`/api/cop/layers/${encodeURIComponent(layerId)}/spec`, {
      method: 'PUT',
      body: JSON.stringify({ spec }),
    });
  }

  /**
   * Transition a layer to a new lifecycle state.
   */
  async transitionLayer(layerId: string, targetState: LayerState, reason?: string): Promise<COPLayer> {
    return this.fetch<COPLayer>(`/api/cop/layers/${encodeURIComponent(layerId)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetState, reason }),
    });
  }

  /**
   * Add review feedback to a layer.
   */
  async addFeedback(
    layerId: string,
    feedback: Omit<ReviewFeedback, 'id' | 'createdAt'>
  ): Promise<COPLayer> {
    return this.fetch<COPLayer>(`/api/cop/layers/${encodeURIComponent(layerId)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  }

  /**
   * Recall a layer from COP back to review state.
   */
  async recallLayer(layerId: string, reason: string): Promise<COPLayer> {
    return this.fetch<COPLayer>(`/api/cop/layers/${encodeURIComponent(layerId)}/recall`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ==========================================================================
  // Version Operations
  // ==========================================================================

  /**
   * List version snapshots for a layer.
   */
  async listVersions(layerId: string): Promise<LayerSnapshot[]> {
    return this.fetch<LayerSnapshot[]>(
      `/api/cop/layers/${encodeURIComponent(layerId)}/versions`
    );
  }

  /**
   * Get a specific version snapshot.
   */
  async getVersion(layerId: string, version: number): Promise<LayerSnapshot> {
    return this.fetch<LayerSnapshot>(
      `/api/cop/layers/${encodeURIComponent(layerId)}/versions/${version}`
    );
  }

  /**
   * Get only the spec from a specific version.
   */
  async getVersionSpec(layerId: string, version: number): Promise<COPLayerSpec> {
    const snapshot = await this.getVersion(layerId, version);
    return snapshot.spec;
  }

  // ==========================================================================
  // Agent Operations
  // ==========================================================================

  /**
   * Trigger COP layer generation for a workspace section.
   */
  async triggerGeneration(problemSetId: string, sectionId: string): Promise<COPLayer> {
    return this.fetch<COPLayer>('/api/cop/agents/trigger', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: problemSetId, sectionId }),
    });
  }

  /**
   * Start polling for a problem set section.
   */
  async startPolling(problemSetId: string, sectionId: string, intervalMs?: number): Promise<void> {
    await this.fetch<void>('/api/cop/agents/polling/start', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: problemSetId, sectionId, intervalMs }),
    });
  }

  /**
   * Stop polling for a workspace section.
   */
  async stopPolling(problemSetId: string, sectionId: string): Promise<void> {
    await this.fetch<void>('/api/cop/agents/polling/stop', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: problemSetId, sectionId }),
    });
  }

  /**
   * Get recent agent activity for a problem set.
   */
  async getAgentActivity(problemSetId: string, limit?: number): Promise<AgentActivity[]> {
    const params = new URLSearchParams({ workspaceId: problemSetId });
    if (limit !== undefined) params.append('limit', String(limit));
    return this.fetch<AgentActivity[]>(`/api/cop/agents/activity?${params.toString()}`);
  }

  // ==========================================================================
  // Linkage Operations
  // ==========================================================================

  /**
   * Get pending (unreviewed) entity linkages.
   */
  async getPendingLinkages(problemSetId?: string): Promise<EntityLinkage[]> {
    const params = problemSetId
      ? `?workspaceId=${encodeURIComponent(problemSetId)}`
      : '';
    return this.fetch<EntityLinkage[]>(`/api/cop/linkages/pending${params}`);
  }

  /**
   * Review (approve/reject) an entity linkage.
   */
  async reviewLinkage(linkageId: string, approved: boolean): Promise<EntityLinkage> {
    return this.fetch<EntityLinkage>(
      `/api/cop/linkages/${encodeURIComponent(linkageId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ approved }),
      }
    );
  }

  /**
   * Get all linkages for a specific entity.
   */
  async getEntityLinkages(entityId: string): Promise<EntityLinkage[]> {
    return this.fetch<EntityLinkage[]>(
      `/api/cop/linkages/entity/${encodeURIComponent(entityId)}`
    );
  }

  // ==========================================================================
  // Conflict Operations
  // ==========================================================================

  /**
   * Get detected conflicts across COP layers in a workspace.
   */
  async getConflicts(problemSetId: string): Promise<COPConflict[]> {
    return this.fetch<COPConflict[]>(
      `/api/cop/conflicts?workspaceId=${encodeURIComponent(problemSetId)}`
    );
  }
}

/**
 * Singleton instance of the COP service.
 */
export const copService = new COPService();
