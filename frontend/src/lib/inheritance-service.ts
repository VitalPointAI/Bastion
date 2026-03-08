/**
 * Inheritance Service (Frontend API Client)
 *
 * Phase 26 Plan 02: Provides the frontend API client for all inheritance
 * endpoints — inherited context retrieval, acknowledgments, annotations,
 * and RFIs. Used by inheritance display components.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AncestorInfo {
  problemSetId: string;
  name: string;
  echelon: 'strategic' | 'operational' | 'tactical';
  depth: number;
}

export interface InheritedDocument {
  id: string;
  title: string;
  docType: string;
  summary: string;
  sourceProblemSetId: string;
  sourceProblemSetName: string;
  sourceEchelon: string;
  lastUpdated: string;
  isNew: boolean;
  isUpdated: boolean;
}

export interface InheritedGraphSummary {
  containerName: string;
  summary: unknown;
  sourceProblemSetId: string;
  sourceProblemSetName: string;
  sourceEchelon: string;
  lastUpdated: string;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  hasStaleCaches: boolean;
  pendingAcknowledgments: number;
}

export interface ChangelogEntry {
  id: string;
  changeType: string;
  changeSeverity: string;
  itemTitle: string;
  summary: string;
  createdAt: string;
  sourceProblemSetName: string;
}

export interface PendingAck {
  sourceProblemSetId: string;
  sourceProblemSetName: string;
  sourceEchelon: 'strategic' | 'operational' | 'tactical';
  pendingCount: number;
}

export interface InheritedContextResponse {
  ancestors: AncestorInfo[];
  inheritedDocuments: InheritedDocument[];
  inheritedGraphSummaries: InheritedGraphSummary[];
  syncStatus: SyncStatus;
  changelog: ChangelogEntry[];
}

export interface InheritanceAnnotation {
  id: string;
  problemSetId: string;
  targetItemId: string;
  targetItemType: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isStale: boolean;
}

export interface RFIMessage {
  id: string;
  rfiId: string;
  content: string;
  senderProblemSetId: string;
  senderProblemSetName: string;
  createdBy: string;
  createdAt: string;
}

export interface NotificationCounts {
  pendingAcks: number;
  unreadChangelog: number;
  openRFIs: number;
  pendingFRAGOs: number;
  total: number;
}

export interface InheritanceRFI {
  id: string;
  fromProblemSetId: string;
  fromProblemSetName: string;
  toProblemSetId: string;
  toProblemSetName: string;
  subject: string;
  content: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'routine' | 'priority' | 'immediate';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// ---------------------------------------------------------------------------
// Echelon colors
// ---------------------------------------------------------------------------

export const ECHELON_COLORS = {
  strategic: {
    border: '#D4A843',
    bg: 'rgba(212,168,67,0.1)',
    badge: 'bg-yellow-700 text-yellow-100',
    label: 'Strategic',
  },
  operational: {
    border: '#3B82F6',
    bg: 'rgba(59,130,246,0.1)',
    badge: 'bg-blue-700 text-blue-100',
    label: 'Operational',
  },
  tactical: {
    border: '#22C55E',
    bg: 'rgba(34,197,94,0.1)',
    badge: 'bg-green-700 text-green-100',
    label: 'Tactical',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basePath(problemSetId: string): string {
  return `${API_BASE}/api/problem-sets/${problemSetId}`;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Inheritance API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const inheritanceApi = {
  /** Fetch full inherited context for a problem set */
  getInheritedContext(problemSetId: string): Promise<InheritedContextResponse> {
    return request<InheritedContextResponse>(
      `${basePath(problemSetId)}/inherited-context`,
    );
  },

  /** Acknowledge inherited context from a specific source */
  acknowledgeContext(
    problemSetId: string,
    sourceProblemSetId: string,
  ): Promise<{ acknowledged: boolean }> {
    return request<{ acknowledged: boolean }>(
      `${basePath(problemSetId)}/inherited-context/acknowledge`,
      {
        method: 'POST',
        body: JSON.stringify({ sourceProblemSetId }),
      },
    );
  },

  /** Fetch changelog of inherited context changes */
  getChangelog(problemSetId: string): Promise<ChangelogEntry[]> {
    return request<ChangelogEntry[]>(
      `${basePath(problemSetId)}/inherited-context/changelog`,
    );
  },

  /** Create an annotation on an inherited item */
  createAnnotation(
    problemSetId: string,
    data: {
      targetItemId: string;
      targetItemType: string;
      content: string;
    },
  ): Promise<InheritanceAnnotation> {
    return request<InheritanceAnnotation>(
      `${basePath(problemSetId)}/annotations`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  /** Fetch annotations, optionally filtered by target item */
  getAnnotations(
    problemSetId: string,
    targetItemId?: string,
  ): Promise<InheritanceAnnotation[]> {
    const query = targetItemId
      ? `?targetItemId=${encodeURIComponent(targetItemId)}`
      : '';
    return request<InheritanceAnnotation[]>(
      `${basePath(problemSetId)}/annotations${query}`,
    );
  },

  /** Update an existing annotation */
  updateAnnotation(
    problemSetId: string,
    annotationId: string,
    content: string,
  ): Promise<InheritanceAnnotation> {
    return request<InheritanceAnnotation>(
      `${basePath(problemSetId)}/annotations/${annotationId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content }),
      },
    );
  },

  /** Fetch annotations visible to the parent problem set */
  getParentViewAnnotations(
    problemSetId: string,
  ): Promise<InheritanceAnnotation[]> {
    return request<InheritanceAnnotation[]>(
      `${basePath(problemSetId)}/annotations/parent-view`,
    );
  },

  /** Create a Request for Information */
  createRFI(
    problemSetId: string,
    data: {
      toProblemSetId: string;
      subject: string;
      content: string;
      priority?: 'routine' | 'priority' | 'immediate';
    },
  ): Promise<InheritanceRFI> {
    return request<InheritanceRFI>(`${basePath(problemSetId)}/rfis`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Fetch RFIs sent or received */
  getRFIs(
    problemSetId: string,
    direction: 'sent' | 'received',
  ): Promise<InheritanceRFI[]> {
    return request<InheritanceRFI[]>(
      `${basePath(problemSetId)}/rfis?direction=${direction}`,
    );
  },

  /** Add a message to an RFI thread */
  addRFIMessage(
    problemSetId: string,
    rfiId: string,
    content: string,
  ): Promise<RFIMessage> {
    return request<RFIMessage>(
      `${basePath(problemSetId)}/rfis/${rfiId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
    );
  },

  /** Fetch messages in an RFI thread */
  getRFIMessages(
    problemSetId: string,
    rfiId: string,
  ): Promise<RFIMessage[]> {
    return request<RFIMessage[]>(
      `${basePath(problemSetId)}/rfis/${rfiId}/messages`,
    );
  },

  /** Acknowledge a child interpretation annotation (parent action) */
  acknowledgeAnnotation(
    problemSetId: string,
    annotationId: string,
    action: 'acknowledge' | 'clarify' | 'correct',
    comment?: string,
  ): Promise<{ acknowledged: boolean }> {
    return request<{ acknowledged: boolean }>(
      `${basePath(problemSetId)}/annotations/${annotationId}/acknowledge`,
      {
        method: 'POST',
        body: JSON.stringify({ action, comment }),
      },
    );
  },

  /** Fetch notification counts for a problem set */
  getNotificationCounts(
    problemSetId: string,
  ): Promise<NotificationCounts> {
    return request<NotificationCounts>(
      `${basePath(problemSetId)}/notification-counts`,
    );
  },

  /** Submit a modification request for an inherited item */
  createModificationRequest(
    problemSetId: string,
    data: {
      targetProblemSetId: string;
      targetItemId: string;
      targetItemType: string;
      subject: string;
      description: string;
    },
  ): Promise<{ id: string }> {
    return request<{ id: string }>(
      `${basePath(problemSetId)}/modification-requests`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  /** Submit a guidance request */
  createGuidanceRequest(
    problemSetId: string,
    data: {
      targetProblemSetId: string;
      subject: string;
      situationDescription: string;
    },
  ): Promise<{ id: string }> {
    return request<{ id: string }>(
      `${basePath(problemSetId)}/guidance-requests`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  /** Resolve a modification request (parent action) */
  resolveModificationRequest(
    problemSetId: string,
    rfiId: string,
    resolution: 'approved' | 'denied',
  ): Promise<{ resolved: boolean }> {
    return request<{ resolved: boolean }>(
      `${basePath(problemSetId)}/modification-requests/${rfiId}/resolve`,
      {
        method: 'PUT',
        body: JSON.stringify({ resolution }),
      },
    );
  },

  /** Update the status of an RFI */
  updateRFIStatus(
    problemSetId: string,
    rfiId: string,
    status: InheritanceRFI['status'],
  ): Promise<InheritanceRFI> {
    return request<InheritanceRFI>(
      `${basePath(problemSetId)}/rfis/${rfiId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      },
    );
  },
};
