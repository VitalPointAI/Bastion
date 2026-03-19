/**
 * useDecisions
 *
 * Hook for fetching decisions, summary, and RACI matrix for a problem set.
 * Provides an actOnDecision helper that calls the API and refreshes state.
 *
 * Usage:
 *   const { decisions, summary, raciMatrix, pending, loading, error, refresh, actOnDecision } =
 *     useDecisions(problemSetId, position);
 */

import { useState, useEffect, useCallback } from 'react';
import {
  decisionApiService,
  type Decision,
  type DecisionSummary,
  type RACIAssignment,
  type ActOnDecisionParams,
} from '../lib/decision-service.js';

interface UseDecisionsResult {
  /** All decisions for the problem set (respects current filters) */
  decisions: Decision[];
  /** Summary counts */
  summary: DecisionSummary | null;
  /** RACI matrix entries */
  raciMatrix: RACIAssignment[];
  /** Pending decisions for the current user's position (only if position is supplied) */
  pending: Decision[];
  loading: boolean;
  error: string | null;
  /** Re-fetch all data */
  refresh: () => void;
  /** Act on a decision and refresh */
  actOnDecision: (decisionId: string, params: ActOnDecisionParams) => Promise<void>;
  /** Apply filters — triggers a re-fetch with new params */
  setFilters: (filters: { status?: string; decision_type?: string }) => void;
}

export function useDecisions(
  problemSetId: string,
  position?: string,
): UseDecisionsResult {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [summary, setSummary] = useState<DecisionSummary | null>(null);
  const [raciMatrix, setRaciMatrix] = useState<RACIAssignment[]>([]);
  const [pending, setPending] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ status?: string; decision_type?: string }>({});
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  // Main data fetch
  useEffect(() => {
    if (!problemSetId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchAll = async () => {
      try {
        const [decisionsData, summaryData, raciData] = await Promise.all([
          decisionApiService.getDecisions(problemSetId, filters),
          decisionApiService.getSummary(problemSetId),
          decisionApiService.getRACIMatrix(problemSetId),
        ]);

        if (cancelled) return;

        setDecisions(decisionsData);
        setSummary(summaryData);
        setRaciMatrix(raciData);

        // Also fetch pending for position if provided
        if (position) {
          const pendingData = await decisionApiService.getPendingForPosition(
            problemSetId,
            position,
          );
          if (!cancelled) setPending(pendingData);
        } else {
          setPending([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load decisions');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemSetId, position, tick, JSON.stringify(filters)]);

  const actOnDecision = useCallback(
    async (decisionId: string, params: ActOnDecisionParams) => {
      await decisionApiService.actOnDecision(problemSetId, decisionId, params);
      refresh();
    },
    [problemSetId, refresh],
  );

  return {
    decisions,
    summary,
    raciMatrix,
    pending,
    loading,
    error,
    refresh,
    actOnDecision,
    setFilters,
  };
}
