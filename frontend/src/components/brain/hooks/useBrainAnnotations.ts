/**
 * useBrainAnnotations — CRUD hook for brain node annotations.
 *
 * Calls the /api/brain/annotations endpoints defined in Plan 02.
 * All operations optimistically update local state for instant UI response,
 * then reconcile on error.
 */

import { useState, useEffect, useCallback } from 'react';
import type { BrainAnnotation, BrainNodeType } from '../types.js';
import { useAuth } from '../../../hooks/useAuth.js';

const BACKEND_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface CreateAnnotationInput {
  nodeId: string;
  nodeType: BrainNodeType;
  annotationType: 'flag' | 'note' | 'questionable';
  content?: string;
  isShared?: boolean;
}

export interface UpdateAnnotationInput {
  content?: string;
  isShared?: boolean;
  annotationType?: string;
}

// ─── Hook return ──────────────────────────────────────────────────────────────

export interface UseBrainAnnotationsReturn {
  annotations: BrainAnnotation[];
  loading: boolean;
  error: string | null;
  createAnnotation: (input: CreateAnnotationInput) => Promise<void>;
  updateAnnotation: (id: string, input: UpdateAnnotationInput) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  getNodeAnnotations: (nodeId: string) => BrainAnnotation[];
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function useBrainAnnotations(problemSetId: string): UseBrainAnnotationsReturn {
  const { accountId } = useAuth();
  const [annotations, setAnnotations] = useState<BrainAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all annotations for this problem set on mount / problemSetId change
  useEffect(() => {
    if (!problemSetId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${BACKEND_URL}/api/brain/annotations?problemSetId=${encodeURIComponent(problemSetId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load annotations: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // API returns { annotations: [...] } wrapper
        const list = Array.isArray(data) ? data : Array.isArray(data?.annotations) ? data.annotations : [];
        if (!cancelled) setAnnotations(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [problemSetId]);

  // ── Create ─────────────────────────────────────────────────────────────────

  const createAnnotation = useCallback(
    async (input: CreateAnnotationInput): Promise<void> => {
      const payload = {
        ...input,
        problemSetId,
        createdBy: accountId ?? 'unknown',
      };

      const res = await fetch(`${BACKEND_URL}/api/brain/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Create annotation failed: ${res.status} ${text}`);
      }

      const created = (await res.json()) as BrainAnnotation;
      setAnnotations((prev) => [...prev, created]);
    },
    [problemSetId, accountId],
  );

  // ── Update ─────────────────────────────────────────────────────────────────

  const updateAnnotation = useCallback(
    async (id: string, input: UpdateAnnotationInput): Promise<void> => {
      // Optimistic update
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                ...(input.content !== undefined && { content: input.content }),
                ...(input.isShared !== undefined && { isShared: input.isShared }),
                ...(input.annotationType !== undefined && {
                  annotationType: input.annotationType as BrainAnnotation['annotationType'],
                }),
              }
            : a,
        ),
      );

      const res = await fetch(`${BACKEND_URL}/api/brain/annotations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        // Revert optimistic update on failure — re-fetch
        setError(`Update annotation failed: ${res.status}`);
        const refreshRes = await fetch(
          `${BACKEND_URL}/api/brain/annotations?problemSetId=${encodeURIComponent(problemSetId)}`,
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as BrainAnnotation[];
          setAnnotations(data);
        }
        throw new Error(`Update annotation failed: ${res.status}`);
      }

      const updated = (await res.json()) as BrainAnnotation;
      setAnnotations((prev) => prev.map((a) => (a.id === id ? updated : a)));
    },
    [problemSetId],
  );

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteAnnotation = useCallback(
    async (id: string): Promise<void> => {
      // Optimistic remove
      setAnnotations((prev) => prev.filter((a) => a.id !== id));

      const res = await fetch(`${BACKEND_URL}/api/brain/annotations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert on failure
        setError(`Delete annotation failed: ${res.status}`);
        const refreshRes = await fetch(
          `${BACKEND_URL}/api/brain/annotations?problemSetId=${encodeURIComponent(problemSetId)}`,
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as BrainAnnotation[];
          setAnnotations(data);
        }
        throw new Error(`Delete annotation failed: ${res.status}`);
      }
    },
    [problemSetId],
  );

  // ── Utility ────────────────────────────────────────────────────────────────

  const getNodeAnnotations = useCallback(
    (nodeId: string): BrainAnnotation[] => annotations.filter((a) => a.nodeId === nodeId),
    [annotations],
  );

  return { annotations, loading, error, createAnnotation, updateAnnotation, deleteAnnotation, getNodeAnnotations };
}
