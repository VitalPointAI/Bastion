/**
 * useBrainIngestion - SSE hook for brain ingestion events and particle emission
 *
 * Connects to the doc-intelligence SSE endpoint for a problem set, listens for
 * ingestion events (specialist:start, specialist:complete, node:added), builds a
 * real-time feed, and emits particles for animation by particleRenderer.
 *
 * Particle state lives in a ref (NOT React state) so the animation loop never
 * triggers React re-renders.
 */

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Particle, BrainNodeType } from '../types.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Color map for particle emission ─────────────────────────────────────────
// Keyed by BrainNodeType — maps node types to particle trail colors.
const NODE_TYPE_COLORS: Record<BrainNodeType, string> = {
  entity: '#4a9eff',     // blue
  objective: '#ff9933',  // orange
  document: '#44cc66',   // green
  concept: '#aa66ff',    // purple
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type IngestionEventType =
  | 'document_added'
  | 'node_created'
  | 'specialist_start'
  | 'specialist_complete'
  | 'error';

export interface IngestionEvent {
  id: string;
  type: IngestionEventType;
  label: string;
  sourceType: string;
  timestamp: string;
  nodeType?: BrainNodeType;
}

export interface ProcessStatus {
  processId: string;
  documentName: string;
  status: 'processing' | 'complete' | 'error';
  progress: number;
}

export interface UseBrainIngestionReturn {
  events: IngestionEvent[];
  activeProcesses: ProcessStatus[];
  particlesRef: MutableRefObject<Particle[]>;
  isConnected: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0;
function nextId(): string {
  return `bi-${Date.now()}-${idCounter++}`;
}

function makeParticle(nodeId: string, nodeType: BrainNodeType, canvasHeight: number): Particle {
  return {
    id: nextId(),
    x: 0,                                       // sidebar exit point (left edge)
    y: Math.random() * Math.max(canvasHeight, 400),
    targetNodeId: nodeId,
    color: NODE_TYPE_COLORS[nodeType] ?? '#4a9eff',
    alpha: 1,
    born: performance.now(),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param problemSetId - Active problem set to watch for ingestion events
 * @param enabled - Set to false to skip connecting (e.g. no problemSetId yet)
 * @param canvasHeight - Height of the canvas so particles spawn at valid y coords
 */
export function useBrainIngestion(
  problemSetId: string,
  enabled: boolean = true,
  canvasHeight: number = 600,
): UseBrainIngestionReturn {
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const [activeProcesses, setActiveProcesses] = useState<Map<string, ProcessStatus>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  // Particles live in a ref — NEVER setState here; the animation loop reads directly
  const particlesRef = useRef<Particle[]>([]);

  // Reconnect timer ref — cleared on unmount / reconnect
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // EventSource ref — closed on unmount
  const esRef = useRef<EventSource | null>(null);
  // Ref to hold connect fn for use in onerror without forward-reference
  const connectRef = useRef<() => void>(() => {});

  const addEvent = useCallback((evt: IngestionEvent) => {
    setEvents((prev) => {
      const next = [evt, ...prev];
      // Keep at most 50 events in the feed
      return next.length > 50 ? next.slice(0, 50) : next;
    });
  }, []);

  const emitParticle = useCallback(
    (nodeId: string, nodeType: BrainNodeType) => {
      particlesRef.current.push(makeParticle(nodeId, nodeType, canvasHeight));
    },
    [canvasHeight],
  );

  const connect = useCallback(() => {
    if (!problemSetId || !enabled) return;

    // Build the SSE URL — the hook watches the problem-set-level stream which
    // receives multiplexed events across all active processing sessions.
    // NOTE: This endpoint pattern mirrors useDocProcessing but without a pid.
    // If the backend doesn't yet support a problem-set-wide stream, the hook
    // gracefully handles the connection error and schedules a reconnect.
    const url = `${API_BASE}/api/doc-intelligence/stream/${encodeURIComponent(problemSetId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);

    // ── specialist:start ────────────────────────────────────────────────────
    es.addEventListener('specialist:start', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        agentId: string;
        processId?: string;
        documentName?: string;
        timestamp?: string;
      };

      const pid = data.processId ?? data.agentId;

      setActiveProcesses((prev) => {
        const next = new Map(prev);
        const existing = next.get(pid);
        next.set(pid, {
          processId: pid,
          documentName: data.documentName ?? existing?.documentName ?? 'Document',
          status: 'processing',
          progress: existing?.progress ?? 0,
        });
        return next;
      });

      addEvent({
        id: nextId(),
        type: 'specialist_start',
        label: `${data.documentName ?? 'Document'} — ${data.agentId} started`,
        sourceType: 'Documents',
        timestamp: data.timestamp ?? new Date().toISOString(),
      });
    });

    // ── specialist:complete ──────────────────────────────────────────────────
    es.addEventListener('specialist:complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        agentId: string;
        processId?: string;
        documentName?: string;
        timestamp?: string;
        result?: { entitiesFound?: number };
      };

      const pid = data.processId ?? data.agentId;

      setActiveProcesses((prev) => {
        const next = new Map(prev);
        const existing = next.get(pid);
        if (!existing) return prev;
        const newProgress = Math.min((existing.progress ?? 0) + 0.1, 0.99);
        next.set(pid, { ...existing, progress: newProgress });
        return next;
      });

      // Fallback: emit a document-type particle on specialist:complete so there
      // is always visual feedback even when node:added events aren't present.
      emitParticle(pid, 'document');

      addEvent({
        id: nextId(),
        type: 'specialist_complete',
        label: `${data.documentName ?? 'Document'} — ${data.agentId} done`,
        sourceType: 'Documents',
        timestamp: data.timestamp ?? new Date().toISOString(),
        nodeType: 'document',
      });
    });

    // ── node:added (new event — may not yet be emitted by backend) ───────────
    es.addEventListener('node:added', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        nodeId: string;
        nodeType?: string;
        label?: string;
        timestamp?: string;
      };

      // Map the raw string from the SSE payload to a valid BrainNodeType
      const nodeTypeMap: Record<string, BrainNodeType> = {
        entity: 'entity',
        objective: 'objective',
        document: 'document',
        concept: 'concept',
      };
      const nodeType: BrainNodeType = nodeTypeMap[data.nodeType ?? ''] ?? 'concept';

      emitParticle(data.nodeId, nodeType);

      addEvent({
        id: nextId(),
        type: 'node_created',
        label: data.label ?? `Node ${data.nodeId}`,
        sourceType: 'Documents',
        timestamp: data.timestamp ?? new Date().toISOString(),
        nodeType,
      });
    });

    // ── report:assembled → mark process complete ─────────────────────────────
    es.addEventListener('report:assembled', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { processId?: string; timestamp?: string };
      const pid = data.processId ?? '';

      setActiveProcesses((prev) => {
        const next = new Map(prev);
        const existing = next.get(pid);
        if (existing) {
          next.set(pid, { ...existing, status: 'complete', progress: 1 });
        }
        return next;
      });

      addEvent({
        id: nextId(),
        type: 'document_added',
        label: 'Intelligence report assembled',
        sourceType: 'Documents',
        timestamp: data.timestamp ?? new Date().toISOString(),
      });
    });

    // ── processing:error ────────────────────────────────────────────────────
    es.addEventListener('processing:error', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { processId?: string; error?: string; timestamp?: string };
      const pid = data.processId ?? '';

      setActiveProcesses((prev) => {
        const next = new Map(prev);
        const existing = next.get(pid);
        if (existing) {
          next.set(pid, { ...existing, status: 'error' });
        }
        return next;
      });

      addEvent({
        id: nextId(),
        type: 'error',
        label: data.error ?? 'Processing error',
        sourceType: 'Documents',
        timestamp: data.timestamp ?? new Date().toISOString(),
      });
    });

    // ── onerror → reconnect ─────────────────────────────────────────────────
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        esRef.current = null;
        reconnectTimer.current = setTimeout(() => connectRef.current(), 3000);
      }
    };
  }, [problemSetId, enabled, addEvent, emitParticle]);

  connectRef.current = connect;

  // Connect on mount / when problemSetId changes
  useEffect(() => {
    if (!enabled || !problemSetId) return;
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      setIsConnected(false);
    };
  }, [problemSetId, enabled, connect]);

  // Convert activeProcesses Map → array for consumers
  const activeProcessesArray = Array.from(activeProcesses.values()).filter(
    (p) => p.status === 'processing',
  );

  return { events, activeProcesses: activeProcessesArray, particlesRef, isConnected };
}
