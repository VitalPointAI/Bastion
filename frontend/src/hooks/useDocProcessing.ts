/**
 * useDocProcessing - SSE hook for document intelligence processing
 *
 * Connects to the backend SSE endpoint when a processingId is provided,
 * tracks specialist agent status, accumulates processing events, and
 * surfaces the final intelligence report.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Types (frontend mirrors of backend doc-intelligence types)
// ============================================================================

export type SpecialistAgentStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'error'
  | 'skipped';

export interface SpecialistStatus {
  id: string;
  name: string;
  status: SpecialistAgentStatus;
  startedAt?: string;
  completedAt?: string;
  entitiesFound?: number;
  duration?: number;
  stage?: string;
  error?: string;
}

export interface ProcessingEvent {
  id: string;
  timestamp: string;
  eventType: string;
  agentId?: string;
  agentName?: string;
  detail?: string;
  entitiesFound?: number;
}

export interface FlaggedState {
  reason: string;
  trustStatus: string;
}

// Specialist display names keyed by agent ID
const SPECIALIST_NAMES: Record<string, string> = {
  'format-converter': 'Format Converter',
  'document-classifier': 'Document Classifier',
  'fact-extractor': 'Fact Extractor',
  'objective-extractor': 'Objective Extractor',
  'perspective-analyst': 'Perspective Analyst',
  'cross-doc-linker': 'Cross-Doc Linker',
  'bias-identifier': 'Bias Identifier',
  'quality-assessor': 'Quality Assessor',
  'trust-agent': 'Trust Agent',
  'researcher': 'Researcher',
};

// Default specialist pipeline order
const DEFAULT_SPECIALISTS = [
  'format-converter',
  'document-classifier',
  'trust-agent',
  'fact-extractor',
  'objective-extractor',
  'perspective-analyst',
  'bias-identifier',
  'cross-doc-linker',
  'quality-assessor',
];

export interface DuplicateWarning {
  file: File;
  message: string;
  duplicates: Array<{ documentId: string; title: string; similarity: number }>;
}

export interface DocProcessingState {
  specialists: Map<string, SpecialistStatus>;
  events: ProcessingEvent[];
  isProcessing: boolean;
  report: Record<string, unknown> | null;
  flagged: FlaggedState | null;
  error: string | null;
  documentName: string | null;
  startTime: string | null;
  uploadDocument: (file: File, force?: boolean) => Promise<void>;
  pendingDuplicate: DuplicateWarning | null;
  forceUpload: () => Promise<void>;
  dismissDuplicate: () => void;
}

/**
 * React hook for managing SSE connection to the document intelligence pipeline.
 *
 * @param problemSetId - The problem set to process documents against
 * @param processingId - When set, connects to SSE stream for this processing session
 */
export function useDocProcessing(
  problemSetId: string,
  processingId: string | null
): DocProcessingState {
  const [specialists, setSpecialists] = useState<Map<string, SpecialistStatus>>(
    () => new Map()
  );
  const [events, setEvents] = useState<ProcessingEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [flagged, setFlagged] = useState<FlaggedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<DuplicateWarning | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const [activeProcessingId, setActiveProcessingId] = useState<string | null>(processingId);
  const eventCounterRef = useRef(0);

  // Initialize default specialist statuses
  const initializeSpecialists = useCallback(() => {
    const initial = new Map<string, SpecialistStatus>();
    for (const id of DEFAULT_SPECIALISTS) {
      initial.set(id, {
        id,
        name: SPECIALIST_NAMES[id] || id,
        status: 'queued',
      });
    }
    setSpecialists(initial);
  }, []);

  // Connect to SSE when processingId changes
  useEffect(() => {
    const pid = activeProcessingId || processingId;
    if (!pid || !problemSetId) return;

    // Clean up previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsProcessing(true);
    setError(null);
    setReport(null);
    setFlagged(null);
    setStartTime(new Date().toISOString());
    initializeSpecialists();

    const url = `${API_BASE}/api/doc-intelligence/process/${encodeURIComponent(problemSetId)}/stream/${encodeURIComponent(pid)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const addEvent = (eventType: string, data: Record<string, unknown>) => {
      const evt: ProcessingEvent = {
        id: `evt-${eventCounterRef.current++}`,
        timestamp: new Date().toISOString(),
        eventType,
        agentId: data.agentId as string | undefined,
        agentName: data.agentId
          ? SPECIALIST_NAMES[data.agentId as string] || (data.agentId as string)
          : undefined,
        detail: data.detail as string | undefined,
        entitiesFound: data.entitiesFound as number | undefined,
      };
      setEvents((prev) => [evt, ...prev]);
    };

    es.addEventListener('specialist:start', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setSpecialists((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.agentId);
        next.set(data.agentId, {
          id: data.agentId,
          name: SPECIALIST_NAMES[data.agentId] || data.agentId,
          status: 'running',
          startedAt: data.timestamp || new Date().toISOString(),
          entitiesFound: existing?.entitiesFound,
        });
        return next;
      });
      addEvent('specialist:start', data);
    });

    es.addEventListener('specialist:progress', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setSpecialists((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.agentId);
        if (existing) {
          next.set(data.agentId, {
            ...existing,
            stage: data.stage || data.detail,
            entitiesFound: data.entitiesFound ?? existing.entitiesFound,
          });
        }
        return next;
      });
      addEvent('specialist:progress', data);
    });

    es.addEventListener('specialist:complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setSpecialists((prev) => {
        const next = new Map(prev);
        next.set(data.agentId, {
          id: data.agentId,
          name: SPECIALIST_NAMES[data.agentId] || data.agentId,
          status: 'complete',
          startedAt: prev.get(data.agentId)?.startedAt,
          completedAt: new Date().toISOString(),
          entitiesFound: data.result?.entitiesFound ?? prev.get(data.agentId)?.entitiesFound,
          duration: data.duration,
        });
        return next;
      });
      addEvent('specialist:complete', data);
    });

    es.addEventListener('report:assembled', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setReport(data);
      setIsProcessing(false);
      addEvent('report:assembled', data);
      es.close();
    });

    // Non-fatal per-specialist error — mark specialist as errored but
    // do NOT set global error or close SSE; pipeline continues.
    es.addEventListener('specialist:error', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.agentId) {
        setSpecialists((prev) => {
          const next = new Map(prev);
          next.set(data.agentId, {
            id: data.agentId,
            name: SPECIALIST_NAMES[data.agentId] || data.agentId,
            status: 'error',
            error: data.error,
            startedAt: prev.get(data.agentId)?.startedAt,
          });
          return next;
        });
      }
      addEvent('specialist:error', data);
    });

    // Fatal pipeline-level error
    es.addEventListener('processing:error', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setError(data.error || 'Processing error occurred');
      addEvent('processing:error', data);
    });

    es.addEventListener('processing:flagged', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setFlagged({
        reason: data.reason || 'Source flagged for review',
        trustStatus: data.trustStatus || 'flagged',
      });
      setIsProcessing(false);
      addEvent('processing:flagged', data);
      es.close();
    });

    es.onerror = () => {
      // EventSource auto-reconnects; only mark error on permanent close
      if (es.readyState === EventSource.CLOSED) {
        setIsProcessing(false);
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [problemSetId, processingId, activeProcessingId, initializeSpecialists]);

  // Upload a document and start processing
  const uploadDocument = useCallback(
    async (file: File, force = false) => {
      setError(null);
      setReport(null);
      setFlagged(null);
      setDocumentName(file.name);
      setEvents([]);

      const formData = new FormData();
      formData.append('document', file);

      try {
        const url = `${API_BASE}/api/doc-intelligence/process/${encodeURIComponent(problemSetId)}${force ? '?force=true' : ''}`;
        const res = await fetch(url, { method: 'POST', body: formData });

        if (res.status === 409) {
          const body = await res.json().catch(() => ({ error: 'Duplicate document' }));
          // Store the file ref so the UI can offer a force-upload
          setPendingDuplicate({ file, message: body.error, duplicates: body.duplicates ?? [] });
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error || `Upload failed: ${res.status}`);
        }

        setPendingDuplicate(null);
        const { processingId: newPid } = await res.json();
        setActiveProcessingId(newPid);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [problemSetId]
  );

  // Force upload after duplicate warning
  const forceUpload = useCallback(async () => {
    if (!pendingDuplicate) return;
    await uploadDocument(pendingDuplicate.file, true);
  }, [pendingDuplicate, uploadDocument]);

  const dismissDuplicate = useCallback(() => {
    setPendingDuplicate(null);
  }, []);

  return {
    specialists,
    events,
    isProcessing,
    report,
    flagged,
    error,
    documentName,
    startTime,
    uploadDocument,
    pendingDuplicate,
    forceUpload,
    dismissDuplicate,
  };
}
