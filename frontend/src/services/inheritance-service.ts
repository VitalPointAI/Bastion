/**
 * Inheritance Frontend Service
 *
 * Phase 38 Plan 06: API client and WebSocket client for inheritance deepening.
 *
 * Covers:
 * - FRAGO lifecycle (get drafts, approve, distribute, acknowledge)
 * - Mission status (aggregated cards, drill-down, publish)
 * - Campaign assessment (aggregated progress)
 * - Notification counts (tab badges)
 * - WebSocket real-time streaming (parent subscribe, child publish)
 * - DDIL fallback (queue updates, reconnect with exponential backoff)
 *
 * All REST calls go to /api/problem-sets/:id/* with credentials: 'include'.
 */

// ============================================================================
// Types (mirrored from backend inheritance-types.ts for frontend use)
// ============================================================================

export type FRAGOStatus = 'draft' | 'approved' | 'distributed' | 'acknowledged';

export interface FRAGODraft {
  id: string;
  parentProblemSetId: string;
  childProblemSetId: string;
  sourceOpordVersion: string;
  previousOpordVersion: string;
  changedParagraphs: number[];
  aiDraftContent: string;
  status: FRAGOStatus;
  approvedBy: string | null;
  editedContent: string | null;
  distributedAt: Date | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

export interface MissionKeyEvent {
  timestamp: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface MissionResourceStatus {
  personnel: { assigned: number; available: number };
  equipment: { operational: number; total: number };
  supplies: Record<string, string>;
}

export interface ObjectiveProgress {
  objectiveId: string;
  objectiveName: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'failed';
  percentComplete: number;
}

export interface MissionStatusSnapshot {
  id: string;
  childProblemSetId: string;
  childProblemSetName: string;
  parentProblemSetId: string;
  missionState: 'planning' | 'active' | 'complete' | 'archived';
  mdmpPhase: string;
  percentComplete: number;
  keyEvents: MissionKeyEvent[];
  resourceStatus: MissionResourceStatus;
  objectiveProgress: ObjectiveProgress[];
  lastUpdated: Date | string;
}

export interface StatusUpdateMessage {
  type: 'mission_status' | 'status_batch' | 'drill_down_request' | 'drill_down_response';
  payload: MissionStatusSnapshot | MissionStatusSnapshot[] | { childProblemSetId: string } | object;
  timestamp: string;
}

// Types from the aggregation service (duplicated here for frontend use)
export interface AggregatedMissionStatus {
  childPsId: string;
  childPsName: string;
  missionState: 'planning' | 'active' | 'complete' | 'archived';
  mdmpPhase: string;
  percentComplete: number;
  latestKeyEvent: MissionKeyEvent | null;
  overallResourceHealth: 'green' | 'amber' | 'red';
  objectiveCount: number;
  completedCount: number;
  lastUpdated: string;
}

export interface CampaignAssessment {
  overallProgress: number;
  objectiveSummaries: Array<{
    name: string;
    childStatuses: Array<{
      childPsId: string;
      childPsName: string;
      status: ObjectiveProgress['status'];
      percentComplete: number;
    }>;
    overallStatus: ObjectiveProgress['status'];
  }>;
  missionCount: number;
  completedMissions: number;
}

export interface NotificationCounts {
  pendingAcks: number;
  unreadChangelog: number;
  openRFIs: number;
  pendingFRAGOs: number;
  total: number;
}

// ============================================================================
// Helpers
// ============================================================================

const API_BASE = '/api/problem-sets';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json();
}

function getWsUrl(path: string): string {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path}`;
  }
  return `ws://localhost:3001${path}`;
}

// ============================================================================
// Service Class
// ============================================================================

class InheritanceApiService {

  // --------------------------------------------------------------------------
  // Notification Counts
  // --------------------------------------------------------------------------

  getNotificationCounts(psId: string): Promise<NotificationCounts> {
    return fetchJson<NotificationCounts>(
      `${API_BASE}/${encodeURIComponent(psId)}/notification-counts`,
    );
  }

  // --------------------------------------------------------------------------
  // FRAGO Methods
  // --------------------------------------------------------------------------

  getFRAGODrafts(psId: string): Promise<FRAGODraft[]> {
    return fetchJson<FRAGODraft[]>(
      `${API_BASE}/${encodeURIComponent(psId)}/fragos`,
    );
  }

  getReceivedFRAGOs(psId: string): Promise<FRAGODraft[]> {
    return fetchJson<FRAGODraft[]>(
      `${API_BASE}/${encodeURIComponent(psId)}/fragos/received`,
    );
  }

  async approveFRAGO(psId: string, fragoId: string, editedContent?: string): Promise<void> {
    await fetchJson<{ success: boolean }>(
      `${API_BASE}/${encodeURIComponent(psId)}/fragos/${encodeURIComponent(fragoId)}/approve`,
      {
        method: 'PUT',
        body: JSON.stringify(editedContent ? { editedContent } : {}),
      },
    );
  }

  async distributeFRAGO(psId: string, fragoId: string): Promise<void> {
    await fetchJson<{ success: boolean }>(
      `${API_BASE}/${encodeURIComponent(psId)}/fragos/${encodeURIComponent(fragoId)}/distribute`,
      { method: 'POST' },
    );
  }

  async acknowledgeFRAGO(psId: string, fragoId: string): Promise<void> {
    await fetchJson<{ success: boolean }>(
      `${API_BASE}/${encodeURIComponent(psId)}/fragos/${encodeURIComponent(fragoId)}/acknowledge`,
      { method: 'POST' },
    );
  }

  // --------------------------------------------------------------------------
  // Mission Status Methods
  // --------------------------------------------------------------------------

  getMissionStatus(psId: string): Promise<AggregatedMissionStatus[]> {
    return fetchJson<AggregatedMissionStatus[]>(
      `${API_BASE}/${encodeURIComponent(psId)}/mission-status`,
    );
  }

  getMissionDrilldown(psId: string, childPsId: string): Promise<MissionStatusSnapshot> {
    return fetchJson<MissionStatusSnapshot>(
      `${API_BASE}/${encodeURIComponent(psId)}/mission-status/${encodeURIComponent(childPsId)}`,
    );
  }

  async publishMissionStatus(psId: string, snapshot: Omit<MissionStatusSnapshot, 'id' | 'lastUpdated'>): Promise<void> {
    await fetchJson<{ success: boolean }>(
      `${API_BASE}/${encodeURIComponent(psId)}/mission-status`,
      {
        method: 'POST',
        body: JSON.stringify(snapshot),
      },
    );
  }

  // --------------------------------------------------------------------------
  // Campaign Assessment
  // --------------------------------------------------------------------------

  getCampaignAssessment(psId: string): Promise<CampaignAssessment> {
    return fetchJson<CampaignAssessment>(
      `${API_BASE}/${encodeURIComponent(psId)}/campaign-assessment`,
    );
  }

  // --------------------------------------------------------------------------
  // WebSocket: Parent subscribes to child status updates
  // --------------------------------------------------------------------------

  /**
   * Connect to /ws/inheritance as parent subscriber.
   * Returns a cleanup function to disconnect.
   *
   * DDIL fallback: queues updates in memory during disconnect,
   * reconnects with exponential backoff (1s, 2s, 4s, max 30s),
   * flushes queue on reconnect via 'status_batch' message.
   */
  connectStatusStream(
    parentPsId: string,
    onUpdate: (status: AggregatedMissionStatus) => void,
  ): () => void {
    let ws: WebSocket | null = null;
    let stopped = false;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_DELAY = 30000;

    function connect() {
      if (stopped) return;

      const url = getWsUrl(`/ws/inheritance?parentPsId=${encodeURIComponent(parentPsId)}`);
      ws = new WebSocket(url);

      ws.onopen = () => {
        reconnectDelay = 1000; // Reset backoff on successful connect
      };

      ws.onmessage = (event) => {
        try {
          const msg: StatusUpdateMessage = JSON.parse(event.data as string);

          if (msg.type === 'mission_status') {
            const snapshot = msg.payload as MissionStatusSnapshot;
            onUpdate(snapshotToAggregated(snapshot));
          } else if (msg.type === 'status_batch') {
            const snapshots = msg.payload as MissionStatusSnapshot[];
            for (const snapshot of snapshots) {
              onUpdate(snapshotToAggregated(snapshot));
            }
          }
        } catch (err) {
          console.warn('[inheritance-ws] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        // Reconnect with exponential backoff
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
          connect();
        }, reconnectDelay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror, handling reconnect
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }

  // --------------------------------------------------------------------------
  // WebSocket: Child publishes status updates
  // --------------------------------------------------------------------------

  /**
   * Connect as child publisher. If WS unavailable, fall back to REST POST.
   * Queue updates during disconnect, flush on reconnect.
   */
  connectStatusPublisher(childPsId: string): {
    publish: (snapshot: Omit<MissionStatusSnapshot, 'id' | 'lastUpdated'>) => void;
    disconnect: () => void;
  } {
    let ws: WebSocket | null = null;
    let connected = false;
    let stopped = false;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_DELAY = 30000;
    const queue: StatusUpdateMessage[] = [];
    // Capture `this` for use inside returned object methods
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const connect = () => {
      if (stopped) return;

      const url = getWsUrl(`/ws/inheritance?childPsId=${encodeURIComponent(childPsId)}`);
      ws = new WebSocket(url);

      ws.onopen = () => {
        connected = true;
        reconnectDelay = 1000;
        // Flush queued updates
        if (queue.length > 0) {
          // Send as batch
          const batchMsg: StatusUpdateMessage = {
            type: 'status_batch',
            payload: queue.map((m) => m.payload) as MissionStatusSnapshot[],
            timestamp: new Date().toISOString(),
          };
          ws!.send(JSON.stringify(batchMsg));
          queue.length = 0;
        }
      };

      ws.onclose = () => {
        connected = false;
        if (stopped) return;
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
          connect();
        }, reconnectDelay);
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };
    };

    connect();

    return {
      publish(snapshot) {
        const msg: StatusUpdateMessage = {
          type: 'mission_status',
          payload: {
            ...snapshot,
            id: `MSTAT-local-${Date.now()}`,
            lastUpdated: new Date(),
          } as MissionStatusSnapshot,
          timestamp: new Date().toISOString(),
        };

        if (connected && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        } else {
          // Queue for later or fall back to REST
          queue.push(msg);

          // If WS never connects, fall back to REST
          if (!ws || ws.readyState === WebSocket.CLOSED) {
            const restSnapshot = msg.payload as MissionStatusSnapshot;
            self.publishViaRest(restSnapshot.parentProblemSetId, restSnapshot).catch((err: unknown) => {
              console.warn('[inheritance-ws] REST fallback failed:', err);
            });
          }
        }
      },

      disconnect() {
        stopped = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (ws) {
          ws.onclose = null;
          ws.close();
        }
      },
    };
  }

  private async publishViaRest(
    parentPsId: string,
    snapshot: MissionStatusSnapshot,
  ): Promise<void> {
    await this.publishMissionStatus(parentPsId, snapshot);
  }
}

// ============================================================================
// Helper: Convert raw snapshot to aggregated summary
// ============================================================================

function snapshotToAggregated(snapshot: MissionStatusSnapshot): AggregatedMissionStatus {
  const latestKeyEvent = snapshot.keyEvents?.length
    ? [...snapshot.keyEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    : null;

  const completedCount = snapshot.objectiveProgress?.filter(
    (o) => o.status === 'achieved',
  ).length ?? 0;

  return {
    childPsId: snapshot.childProblemSetId,
    childPsName: snapshot.childProblemSetName,
    missionState: snapshot.missionState,
    mdmpPhase: snapshot.mdmpPhase,
    percentComplete: snapshot.percentComplete,
    latestKeyEvent,
    overallResourceHealth: computeResourceHealth(snapshot.resourceStatus),
    objectiveCount: snapshot.objectiveProgress?.length ?? 0,
    completedCount,
    lastUpdated: typeof snapshot.lastUpdated === 'string'
      ? snapshot.lastUpdated
      : (snapshot.lastUpdated as Date).toISOString(),
  };
}

function computeResourceHealth(
  status: MissionResourceStatus | null | undefined,
): 'green' | 'amber' | 'red' {
  if (!status?.personnel || !status?.equipment) return 'green';

  const personnelRate = status.personnel.assigned > 0
    ? status.personnel.available / status.personnel.assigned
    : 1;
  const equipmentRate = status.equipment.total > 0
    ? status.equipment.operational / status.equipment.total
    : 1;

  if (personnelRate < 0.5 || equipmentRate < 0.5) return 'red';
  if (personnelRate < 0.75 || equipmentRate < 0.75) return 'amber';
  return 'green';
}

// ============================================================================
// Singleton
// ============================================================================

export const inheritanceApiService = new InheritanceApiService();
