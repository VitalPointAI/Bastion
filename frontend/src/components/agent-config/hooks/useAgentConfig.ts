/**
 * useAgentConfig
 *
 * Phase 60 Plan 04: Hook for fetching and saving per-user agent configuration.
 *
 * Features:
 * - Fetches AgentConfig via GET /api/agent-config/:userId on mount
 * - Provides updateConfig(partial) that merges and saves with 500ms debounce
 * - Tracks save status (idle / saving / saved / error)
 * - Authentication via HttpOnly cookie (credentials: 'include')
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentConfig } from '../../../types/agent-config.ts';

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAgentConfigResult {
  /** Current agent config, or null while loading */
  config: AgentConfig | null;
  loading: boolean;
  error: string | null;
  /** Merge partial config and trigger debounced save */
  updateConfig: (partial: Partial<AgentConfig>) => void;
  saving: boolean;
  saveStatus: SaveStatus;
  /** Manually trigger a save of current config */
  saveNow: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentConfig(userId: string): UseAgentConfigResult {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Track pending save payload — debounce writes to this ref
  const pendingSaveRef = useRef<AgentConfig | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ─── Fetch on mount ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/agent-config/${encodeURIComponent(userId)}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<AgentConfig>;
      })
      .then((data) => {
        if (!cancelled) {
          setConfig(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load agent configuration');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [userId]);

  // ─── Save function ───────────────────────────────────────────────────────

  const saveConfig = useCallback(async (toSave: AgentConfig) => {
    if (!mountedRef.current) return;
    setSaveStatus('saving');

    try {
      const res = await fetch(`${API_BASE}/api/agent-config/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const saved = await res.json() as AgentConfig;
      if (mountedRef.current) {
        setConfig(saved);
        setSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => {
          if (mountedRef.current) setSaveStatus('idle');
        }, 2000);
      }
    } catch (err) {
      if (mountedRef.current) {
        setSaveStatus('error');
        setError((err as Error).message || 'Failed to save configuration');
      }
    }
  }, [userId]);

  // ─── updateConfig: merge + debounce ─────────────────────────────────────

  const updateConfig = useCallback((partial: Partial<AgentConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...partial };
      pendingSaveRef.current = merged;

      // Clear existing debounce timer and set new one
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (pendingSaveRef.current && mountedRef.current) {
          void saveConfig(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      }, 500);

      return merged;
    });
  }, [saveConfig]);

  // ─── saveNow: flush pending save immediately ────────────────────────────

  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const toSave = pendingSaveRef.current ?? config;
    if (toSave) {
      pendingSaveRef.current = null;
      await saveConfig(toSave);
    }
  }, [config, saveConfig]);

  return {
    config,
    loading,
    error,
    updateConfig,
    saving: saveStatus === 'saving',
    saveStatus,
    saveNow,
  };
}
