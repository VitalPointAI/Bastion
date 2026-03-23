/**
 * useDesignInterview — React hook for design interview lifecycle
 *
 * Phase 55 Plan 04: Manages the full guided design interview lifecycle
 * including start, continue, confirm section, resume, and reset.
 * Listens for real-time design.section_updated WebSocket events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionCoverage {
  met: boolean;
  criteria: string[];
  metCriteria: string[];
}

export interface DesignInterviewMeta {
  currentSection: 'problem-framing' | 'cog-analysis' | 'loes' | 'operational-approach';
  sectionCoverage: Record<string, SectionCoverage>;
  questionsAsked: number;
  isComplete: boolean;
  interviewMode: 'new' | 'revision';
}

export interface UseDesignInterviewResult {
  interviewState: DesignInterviewMeta | null;
  isActive: boolean;
  isLoading: boolean;
  lastMessage: string | null;
  error: string | null;
  startInterview: (mode?: 'new' | 'revision') => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  confirmSection: () => Promise<void>;
  resetInterview: () => Promise<void>;
  awaitingConfirm: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDesignInterview(problemSetId: string): UseDesignInterviewResult {
  const [interviewState, setInterviewState] = useState<DesignInterviewMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Derive computed state
  const isActive = interviewState !== null && !interviewState.isComplete;
  const awaitingConfirm = interviewState !== null &&
    interviewState.sectionCoverage[interviewState.currentSection]?.met === true;

  // Resume on mount — check for existing interview state
  useEffect(() => {
    mountedRef.current = true;
    if (!problemSetId) return;

    (async () => {
      try {
        const res = await fetch(`/api/design-interview/${problemSetId}/state`);
        if (!res.ok) return;
        const data = await res.json() as { state: DesignInterviewMeta | null };
        if (mountedRef.current && data.state) {
          setInterviewState(data.state);
        }
      } catch {
        // Silent — no interview to resume
      }
    })();

    return () => { mountedRef.current = false; };
  }, [problemSetId]);

  const startInterview = useCallback(async (mode: 'new' | 'revision' = 'new') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' })) as { error: string };
        throw new Error(errBody.error);
      }
      const data = await res.json() as { message: string; state: DesignInterviewMeta };
      if (mountedRef.current) {
        setInterviewState(data.state);
        setLastMessage(data.message);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId]);

  const sendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' })) as { error: string };
        throw new Error(errBody.error);
      }
      const data = await res.json() as { message: string; state: DesignInterviewMeta };
      if (mountedRef.current) {
        setInterviewState(data.state);
        setLastMessage(data.message);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId]);

  const confirmSection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}/confirm-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' })) as { error: string };
        throw new Error(errBody.error);
      }
      const data = await res.json() as { message: string; state: DesignInterviewMeta };
      if (mountedRef.current) {
        setInterviewState(data.state);
        setLastMessage(data.message);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId]);

  const resetInterview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to reset interview');
      }
      if (mountedRef.current) {
        setInterviewState(null);
        setLastMessage(null);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId]);

  return {
    interviewState,
    isActive,
    isLoading,
    lastMessage,
    error,
    startInterview,
    sendMessage,
    confirmSection,
    resetInterview,
    awaitingConfirm,
  };
}
