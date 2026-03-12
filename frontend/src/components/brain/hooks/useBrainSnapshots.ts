/**
 * useBrainSnapshots — CRUD hook for brain context snapshots.
 *
 * Calls the /api/brain/snapshots endpoints defined in Plan 02.
 * Snapshots capture a "source of truth" summary of the strategic environment
 * at a point in time, available to all BASTION AI agents via assembleContext().
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth.js';

const BACKEND_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrainSnapshot {
  id: string;
  title: string;
  summary: string;
  timeScale?: string;
  nodeCount: number;
  edgeCount: number;
  createdBy: string;
  createdAt: string;
}

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface SaveSnapshotInput {
  title: string;
  summary: string;
  timeScale?: Date;
  nodeCount?: number;
  edgeCount?: number;
}

// ─── Hook return ──────────────────────────────────────────────────────────────

export interface UseBrainSnapshotsReturn {
  snapshots: BrainSnapshot[];
  loading: boolean;
  error: string | null;
  saveSnapshot: (input: SaveSnapshotInput) => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;
  getSnapshot: (id: string) => Promise<BrainSnapshot | null>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function useBrainSnapshots(problemSetId: string): UseBrainSnapshotsReturn {
  const { accountId } = useAuth();
  const [snapshots, setSnapshots] = useState<BrainSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all snapshots for this problem set on mount / problemSetId change
  useEffect(() => {
    if (!problemSetId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${BACKEND_URL}/api/brain/snapshots?problemSetId=${encodeURIComponent(problemSetId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load snapshots: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // API returns { snapshots: [...] } wrapper
        const list = Array.isArray(data) ? data : Array.isArray(data?.snapshots) ? data.snapshots : [];
        if (!cancelled) setSnapshots(list);
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

  // ── Save (POST) ─────────────────────────────────────────────────────────────

  const saveSnapshot = useCallback(
    async (input: SaveSnapshotInput): Promise<void> => {
      const payload = {
        problemSetId,
        title: input.title,
        summary: input.summary,
        timeScale: input.timeScale?.toISOString() ?? null,
        nodeCount: input.nodeCount ?? 0,
        edgeCount: input.edgeCount ?? 0,
        createdBy: accountId ?? 'unknown',
      };

      const res = await fetch(`${BACKEND_URL}/api/brain/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save snapshot failed: ${res.status} ${text}`);
      }

      const created = (await res.json()) as BrainSnapshot;
      // Insert at the front (most recent first)
      setSnapshots((prev) => [created, ...prev]);
    },
    [problemSetId, accountId],
  );

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteSnapshot = useCallback(
    async (id: string): Promise<void> => {
      // Optimistic removal
      setSnapshots((prev) => prev.filter((s) => s.id !== id));

      const res = await fetch(`${BACKEND_URL}/api/brain/snapshots/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setError(`Delete snapshot failed: ${res.status}`);
        // Revert — re-fetch
        const refreshRes = await fetch(
          `${BACKEND_URL}/api/brain/snapshots?problemSetId=${encodeURIComponent(problemSetId)}`,
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as BrainSnapshot[];
          setSnapshots(data);
        }
        throw new Error(`Delete snapshot failed: ${res.status}`);
      }
    },
    [problemSetId],
  );

  // ── Get by ID ───────────────────────────────────────────────────────────────

  const getSnapshot = useCallback(
    async (id: string): Promise<BrainSnapshot | null> => {
      const res = await fetch(`${BACKEND_URL}/api/brain/snapshots/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Get snapshot failed: ${res.status}`);
      }
      return (await res.json()) as BrainSnapshot;
    },
    [],
  );

  return { snapshots, loading, error, saveSnapshot, deleteSnapshot, getSnapshot };
}
