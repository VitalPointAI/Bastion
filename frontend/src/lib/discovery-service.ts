/**
 * Discovery Service
 *
 * Phase 32 Plan 09: Frontend REST API client for discovery scanner control,
 * device management, access lists, EM spectrum awareness, and network topology.
 * Follows GovernanceService pattern with cookie auth (Phase 18).
 */

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ---------------------------------------------------------------------------
// Frontend Discovery Types (duplicated from backend per project convention)
// ---------------------------------------------------------------------------

export const TransportType = {
  ble: 'ble',
  wifi: 'wifi',
  usb: 'usb',
  tak: 'tak',
} as const;
export type TransportType = (typeof TransportType)[keyof typeof TransportType];

export const DeviceState = {
  discovered: 'discovered',
  fingerprinting: 'fingerprinting',
  authenticating: 'authenticating',
  gate_check: 'gate_check',
  ironclaw_analysis: 'ironclaw_analysis',
  pending_dao: 'pending_dao',
  onboarding: 'onboarding',
  connected: 'connected',
  disconnected: 'disconnected',
  quarantined: 'quarantined',
  rejected: 'rejected',
  revoked: 'revoked',
} as const;
export type DeviceState = (typeof DeviceState)[keyof typeof DeviceState];

export interface DeviceFingerprint {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  protocolVersions?: string[];
  capabilities: string[];
  hardwareId?: string;
  displayName?: string;
}

export interface ScannerConfig {
  intervalMs: number;
  enabled: boolean;
  interfaceFilter?: string[];
}

export interface DiscoveredDevice {
  id: string;
  transportType: TransportType;
  rawIdentifier: string;
  fingerprint: DeviceFingerprint | null;
  state: DeviceState;
  deviceDid?: string;
  resourceId?: string;
  firstSeen: string;
  lastSeen: string;
  signalStrength?: number;
  location?: { lat: number; lng: number };
  ironclawAnalysis?: Record<string, unknown>;
  gateId?: string;
  quarantineReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceAccessEntry {
  id: string;
  listType: 'allow' | 'block';
  scope: string;
  matchType: 'mac' | 'vendor_id' | 'product_id' | 'cot_type' | 'fingerprint_hash';
  matchValue: string;
  displayName?: string;
  addedBy: string;
  gateId?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface DiscoveryStatus {
  state: 'idle' | 'scanning' | 'paused' | 'unavailable';
  activeScanners?: string[];
  deviceCount?: number;
  message?: string;
}

export const EMBand = {
  bluetooth: 'bluetooth',
  wifi_2g: 'wifi_2g',
  wifi_5g: 'wifi_5g',
  vhf: 'vhf',
  uhf: 'uhf',
  hf: 'hf',
  satcom: 'satcom',
  unknown: 'unknown',
} as const;
export type EMBand = (typeof EMBand)[keyof typeof EMBand];

export interface EMSignalEntry {
  band: EMBand;
  frequencyMHz: number;
  signalStrengthDbm: number;
  sourceIdentifier: string;
  sourceType: 'discovered' | 'self' | 'unknown';
  timestamp: number;
  transportType?: TransportType;
}

export interface EMSnapshot {
  timestamp: number;
  environmentSignals: EMSignalEntry[];
  ownEmissions: EMSignalEntry[];
  bandSummary: Record<EMBand, { count: number; avgStrength: number }>;
}

export interface TopologyNode {
  id: string;
  type: 'device' | 'network' | 'bastion';
  displayName: string;
  transportType?: TransportType;
  deviceDid?: string;
  trustTier?: string;
  metadata: Record<string, unknown>;
}

export interface TopologyEdge {
  sourceId: string;
  targetId: string;
  connectionType: 'direct' | 'bridged' | 'discovered';
  transportType?: TransportType;
  signalStrength?: number;
  latency?: number;
  hopCount: number;
}

export interface TopologyNetwork {
  id: string;
  name?: string;
  cidr?: string;
  gatewayNodeId?: string;
  hopDepth: number;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  networks: TopologyNetwork[];
  stats: TopologyStats;
  hoppingEnabled: boolean;
}

export interface TopologyStats {
  totalNodes: number;
  totalEdges: number;
  maxHopDepth: number;
  bridgeCount: number;
  networkCount: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * DiscoveryApiService -- REST client for /api/discovery endpoints.
 * Authentication via HttpOnly cookie (credentials: 'include').
 */
export class DiscoveryApiService {
  /**
   * Make authenticated API request.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // ==========================================================================
  // Scanner Control
  // ==========================================================================

  /** Get current discovery scanner status. */
  async getStatus(): Promise<DiscoveryStatus> {
    return this.request<DiscoveryStatus>('/api/discovery/status');
  }

  /** Start scanning. */
  async startScanning(scope?: string): Promise<void> {
    await this.request('/api/discovery/start', {
      method: 'POST',
      body: JSON.stringify(scope ? { scope } : {}),
    });
  }

  /** Stop scanning. */
  async stopScanning(): Promise<void> {
    await this.request('/api/discovery/stop', { method: 'POST' });
  }

  /** Pause scanning. */
  async pauseScanning(): Promise<void> {
    await this.request('/api/discovery/pause', { method: 'POST' });
  }

  /** Resume scanning. */
  async resumeScanning(): Promise<void> {
    await this.request('/api/discovery/resume', { method: 'POST' });
  }

  /** Update scanner configuration for a transport type. */
  async updateScannerConfig(transport: string, config: Partial<ScannerConfig>): Promise<void> {
    await this.request(`/api/discovery/scanner/${encodeURIComponent(transport)}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // ==========================================================================
  // Device Management
  // ==========================================================================

  /** List discovered devices with optional filters. */
  async listDevices(params?: { state?: string; transport?: string }): Promise<DiscoveredDevice[]> {
    const query = new URLSearchParams();
    if (params?.state) query.set('state', params.state);
    if (params?.transport) query.set('transport', params.transport);
    const qs = query.toString();
    const result = await this.request<{ devices: DiscoveredDevice[] }>(
      `/api/discovery/devices${qs ? `?${qs}` : ''}`,
    );
    return result.devices;
  }

  /** Get a single device by ID. */
  async getDevice(id: string): Promise<DiscoveredDevice> {
    return this.request<DiscoveredDevice>(`/api/discovery/devices/${encodeURIComponent(id)}`);
  }

  /** Emergency disconnect a device. */
  async emergencyDisconnect(id: string, reason: string): Promise<void> {
    await this.request(`/api/discovery/devices/${encodeURIComponent(id)}/emergency-disconnect`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ==========================================================================
  // Access List
  // ==========================================================================

  /** Get access list entries. */
  async getAccessList(scope?: string, listType?: string): Promise<DeviceAccessEntry[]> {
    const query = new URLSearchParams();
    if (scope) query.set('scope', scope);
    if (listType) query.set('listType', listType);
    const qs = query.toString();
    const result = await this.request<{ entries: DeviceAccessEntry[] }>(
      `/api/discovery/access-list${qs ? `?${qs}` : ''}`,
    );
    return result.entries;
  }

  /** Add an access list entry. */
  async addAccessEntry(entry: Partial<DeviceAccessEntry>): Promise<DeviceAccessEntry> {
    return this.request<DeviceAccessEntry>('/api/discovery/access-list', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  /** Remove an access list entry. */
  async removeAccessEntry(id: string): Promise<void> {
    await this.request(`/api/discovery/access-list/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // EM Spectrum Awareness
  // ==========================================================================

  /** Get current EM environment snapshot. */
  async getEMSnapshot(): Promise<EMSnapshot> {
    return this.request<EMSnapshot>('/api/discovery/em/snapshot');
  }

  /** Get Bastion's own EM footprint. */
  async getOwnEMFootprint(): Promise<EMSignalEntry[]> {
    const result = await this.request<{ emissions: EMSignalEntry[] }>('/api/discovery/em/own-footprint');
    return result.emissions;
  }

  // ==========================================================================
  // Network Topology
  // ==========================================================================

  /** Get full network topology graph. */
  async getTopology(): Promise<TopologyGraph> {
    return this.request<TopologyGraph>('/api/discovery/topology');
  }

  /** Get topology statistics only. */
  async getTopologyStats(): Promise<TopologyStats> {
    return this.request<TopologyStats>('/api/discovery/topology/stats');
  }

  /** Find shortest path between two nodes. */
  async getTopologyPath(from: string, to: string): Promise<{ path: string[]; hops: number }> {
    return this.request<{ path: string[]; hops: number }>(
      `/api/discovery/topology/path/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
    );
  }
}

// Export singleton instance
export const discoveryService = new DiscoveryApiService();
