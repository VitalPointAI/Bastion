/**
 * useUniversalIngest — State machine for tracking ingest items + API calls
 *
 * Phase 50 Plan 03. Replaces fragmented UI (doc upload, OSINT modal) with a
 * single unified hook tracking every submitted item through its full lifecycle:
 * queued -> classifying -> routing -> processing -> complete/error
 *
 * Key design decisions:
 * - Internal state is Map<id, IngestItem> for O(1) updates by ID
 * - items returned as array sorted newest-first
 * - submitFiles uses Promise.allSettled so one failure doesn't kill the batch
 * - handleSSEEvent is imperative (not effect-based) so caller controls SSE integration
 */

import { useState, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemStatus =
  | 'queued'
  | 'classifying'
  | 'routing'
  | 'processing'
  | 'complete'
  | 'error';

export type InputType =
  | 'file'
  | 'rss_url'
  | 'article_url'
  | 'pdf_url'
  | 'api_url'
  | 'raw_text'
  | 'json_data'
  | 'xml_data'
  | 'unknown';

export interface ClassificationResult {
  inputType: InputType;
  confidence: number;
  suggestedPipeline: 'doc-intelligence' | 'osint-subscribe' | 'text-ingest' | 'manual';
  metadata: {
    contentType?: string;
    title?: string;
    description?: string;
    feedUrl?: string;
    isRss?: boolean;
  };
}

export interface IngestItem {
  id: string;             // crypto.randomUUID()
  label: string;          // filename, URL, or first 60 chars of text
  status: ItemStatus;
  progress: number;       // 0-1
  processId?: string;     // backend processId for SSE tracking
  classification?: ClassificationResult;
  error?: string;
  retryCount: number;
  createdAt: string;      // ISO timestamp
  /** Monotonically increasing insertion order for stable newest-first sort */
  _order?: number;
  /** Original content stored for retry support */
  _originalContent?: string;
}

export interface UseUniversalIngestReturn {
  items: IngestItem[];
  submitText: (text: string) => Promise<void>;
  submitFiles: (files: File[]) => Promise<void>;
  retryItem: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => void;
  clearCompleted: () => void;
  isInterviewRequired: boolean;
  handleSSEEvent: (event: string, data: unknown) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Monotonically increasing insertion order counter — avoids same-millisecond
// sort ambiguity when multiple items are created rapidly.
let _insertionOrder = 0;

function mapToArray(map: Map<string, IngestItem>): IngestItem[] {
  // Return newest-first (highest _order first)
  return Array.from(map.values()).sort(
    (a, b) => (b._order ?? 0) - (a._order ?? 0),
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUniversalIngest(problemSetId: string): UseUniversalIngestReturn {
  const [itemsMap, setItemsMap] = useState<Map<string, IngestItem>>(new Map());
  const [isInterviewRequired, setIsInterviewRequired] = useState(false);
  // Ref mirror of itemsMap for synchronous reads in async callbacks
  const itemsMapRef = useRef<Map<string, IngestItem>>(new Map());

  // ── Internal updater ──────────────────────────────────────────────────────

  const updateItem = useCallback((id: string, patch: Partial<IngestItem>) => {
    setItemsMap((prev) => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const updated = { ...existing, ...patch };
      const next = new Map(prev);
      next.set(id, updated);
      itemsMapRef.current = next; // keep ref in sync
      return next;
    });
  }, []);

  const addItem = useCallback((item: IngestItem) => {
    setItemsMap((prev) => {
      const next = new Map(prev);
      next.set(item.id, item);
      itemsMapRef.current = next; // keep ref in sync
      return next;
    });
  }, []);

  // ── submitText ────────────────────────────────────────────────────────────

  const submitText = useCallback(
    async (text: string): Promise<void> => {
      const id = generateId();
      const label = text.slice(0, 60);

      const item: IngestItem = {
        id,
        label,
        status: 'classifying',
        progress: 0,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        _order: ++_insertionOrder,
        _originalContent: text,
      };

      addItem(item);

      try {
        // ── Step 1: Classify ───────────────────────────────────────────────
        const classifyRes = await fetch(`${API_BASE}/api/ingest/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: text, problemSetId }),
        });

        if (!classifyRes.ok) {
          throw new Error(`Classify failed: ${classifyRes.status}`);
        }

        const classification = (await classifyRes.json()) as ClassificationResult;

        updateItem(id, { classification, status: 'routing' });

        // ── Step 2: Submit ─────────────────────────────────────────────────
        const submitRes = await fetch(`${API_BASE}/api/ingest/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: text, problemSetId }),
        });

        if (!submitRes.ok) {
          throw new Error(`Submit failed: ${submitRes.status}`);
        }

        const submitData = (await submitRes.json()) as {
          processId?: string | null;
          status?: string;
        };

        if (submitData.status === 'interview_required') {
          setIsInterviewRequired(true);
          updateItem(id, {
            status: 'error',
            error: 'Complete scoping interview first',
          });
          return;
        }

        if (submitData.status === 'duplicate') {
          updateItem(id, {
            status: 'error',
            error: 'Already ingested',
          });
          return;
        }

        updateItem(id, {
          processId: submitData.processId ?? undefined,
          status: 'processing',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        updateItem(id, { status: 'error', error: message });
      }
    },
    [problemSetId, addItem, updateItem],
  );

  // ── submitFiles ───────────────────────────────────────────────────────────

  const submitFiles = useCallback(
    async (files: File[]): Promise<void> => {
      // Create items immediately so UI shows them as queued
      const fileItems: IngestItem[] = files.map((file) => ({
        id: generateId(),
        label: file.name,
        status: 'classifying' as ItemStatus,
        progress: 0,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        _order: ++_insertionOrder,
        _originalContent: undefined,
      }));

      // Add all items before any async work
      setItemsMap((prev) => {
        const next = new Map(prev);
        for (const item of fileItems) {
          next.set(item.id, item);
        }
        itemsMapRef.current = next; // keep ref in sync
        return next;
      });

      // Submit each independently using Promise.allSettled so one failure
      // does not cancel the rest
      const submissions = fileItems.map(async (item, i) => {
        const file = files[i];
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('problemSetId', problemSetId);

          const res = await fetch(`${API_BASE}/api/ingest/submit`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`Upload failed: ${res.status}`);
          }

          const data = (await res.json()) as {
            processId?: string | null;
            status?: string;
          };

          if (data.status === 'interview_required') {
            setIsInterviewRequired(true);
            updateItem(item.id, {
              status: 'error',
              error: 'Complete scoping interview first',
            });
            return;
          }

          if (data.status === 'duplicate') {
            updateItem(item.id, { status: 'error', error: 'Already ingested' });
            return;
          }

          updateItem(item.id, {
            processId: data.processId ?? undefined,
            status: 'processing',
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed';
          updateItem(item.id, { status: 'error', error: message });
        }
      });

      await Promise.allSettled(submissions);
    },
    [problemSetId, updateItem],
  );

  // ── handleSSEEvent ────────────────────────────────────────────────────────

  const handleSSEEvent = useCallback(
    (event: string, data: unknown) => {
      const payload = data as { processId?: string; error?: string; classification?: ClassificationResult };
      const processId = payload?.processId;
      if (!processId) return;

      // Find item by processId
      setItemsMap((prev) => {
        // Find matching item
        let matchId: string | undefined;
        for (const [id, item] of prev) {
          if (item.processId === processId) {
            matchId = id;
            break;
          }
        }
        if (!matchId) return prev; // Unknown processId — ignore

        const existing = prev.get(matchId)!;
        const next = new Map(prev);

        switch (event) {
          case 'classify:result':
            next.set(matchId, {
              ...existing,
              classification: payload.classification ?? existing.classification,
            });
            break;

          case 'route:selected':
            next.set(matchId, { ...existing, status: 'processing' });
            break;

          case 'route:error':
            next.set(matchId, {
              ...existing,
              status: 'error',
              error: payload.error ?? 'Routing failed',
            });
            break;

          case 'processing:complete':
            next.set(matchId, { ...existing, status: 'complete', progress: 1 });
            break;

          case 'processing:error':
            next.set(matchId, {
              ...existing,
              status: 'error',
              error: payload.error ?? 'Processing failed',
            });
            break;
        }

        itemsMapRef.current = next;
        return next;
      });
    },
    [],
  );

  // ── retryItem ─────────────────────────────────────────────────────────────

  const retryItem = useCallback(
    async (itemId: string): Promise<void> => {
      // Read item synchronously from the ref mirror
      const capturedItem = itemsMapRef.current.get(itemId);
      if (!capturedItem) return;

      const prevRetryCount = capturedItem.retryCount;
      const newRetryCount = prevRetryCount + 1;
      const originalContent = capturedItem._originalContent;

      // Reset to queued with incremented retry count
      updateItem(itemId, {
        status: 'queued',
        retryCount: newRetryCount,
        error: undefined,
        processId: undefined,
      });

      // Exponential backoff (skip delay for first retry to speed up tests)
      const delay = prevRetryCount > 0 ? 3000 * Math.pow(2, prevRetryCount) : 0;
      if (delay > 0) {
        await new Promise((res) => setTimeout(res, delay));
      }

      // Re-submit in-place (do NOT call submitText which creates a new item)
      updateItem(itemId, { status: 'classifying' });

      try {
        if (originalContent !== undefined) {
          // Text/URL retry
          const classifyRes = await fetch(`${API_BASE}/api/ingest/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content: originalContent, problemSetId }),
          });
          if (!classifyRes.ok) throw new Error(`Classify failed: ${classifyRes.status}`);
          const classification = (await classifyRes.json()) as ClassificationResult;
          updateItem(itemId, { classification, status: 'routing' });

          const submitRes = await fetch(`${API_BASE}/api/ingest/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content: originalContent, problemSetId }),
          });
          if (!submitRes.ok) throw new Error(`Submit failed: ${submitRes.status}`);
          const submitData = (await submitRes.json()) as { processId?: string; status?: string };

          if (submitData.status === 'interview_required') {
            setIsInterviewRequired(true);
            updateItem(itemId, { status: 'error', error: 'Complete scoping interview first' });
            return;
          }
          if (submitData.status === 'duplicate') {
            updateItem(itemId, { status: 'error', error: 'Already ingested' });
            return;
          }
          updateItem(itemId, { processId: submitData.processId ?? undefined, status: 'processing' });
        } else {
          // File retry: re-submit with just the itemId
          const res = await fetch(`${API_BASE}/api/ingest/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ itemId, problemSetId, retry: true }),
          });
          if (!res.ok) throw new Error(`Retry failed: ${res.status}`);
          const data = (await res.json()) as { processId?: string };
          updateItem(itemId, { processId: data.processId, status: 'processing' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Retry failed';
        updateItem(itemId, { status: 'error', error: message });
      }
    },
    [updateItem, problemSetId],
  );

  // ── dismissItem ───────────────────────────────────────────────────────────

  const dismissItem = useCallback((itemId: string) => {
    setItemsMap((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Map(prev);
      next.delete(itemId);
      itemsMapRef.current = next;
      return next;
    });
  }, []);

  // ── clearCompleted ────────────────────────────────────────────────────────

  const clearCompleted = useCallback(() => {
    setItemsMap((prev) => {
      const next = new Map(prev);
      for (const [id, item] of prev) {
        if (item.status === 'complete') {
          next.delete(id);
        }
      }
      itemsMapRef.current = next;
      return next;
    });
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    items: mapToArray(itemsMap),
    submitText,
    submitFiles,
    retryItem,
    dismissItem,
    clearCompleted,
    isInterviewRequired,
    handleSSEEvent,
  };
}
