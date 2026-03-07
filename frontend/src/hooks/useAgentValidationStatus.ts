/**
 * useAgentValidationStatus Hook
 *
 * Fetches agent validation dashboard data and provides a status map
 * keyed by agentId. Falls back to 'unknown' when the validation API
 * is unavailable (e.g., before Plan 05 API deployment).
 *
 * Phase 31 Plan 06
 */

import { useState, useEffect } from 'react';

type ValidationStatus = 'passing' | 'warning' | 'critical' | 'disabled' | 'unknown';

interface DashboardEntry {
  agentId: string;
  overallStatus: ValidationStatus;
}

/**
 * Lightweight hook that fetches /api/validation/dashboard once and
 * returns a Map<agentId, ValidationStatus>.
 *
 * Returns `unknown` for all agents when the endpoint is not yet
 * deployed or returns an error.
 */
export function useAgentValidationStatus(): Map<string, ValidationStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, ValidationStatus>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      try {
        const res = await fetch('/api/validation/dashboard');
        if (!res.ok) return; // endpoint not available yet

        const data: DashboardEntry[] = await res.json();
        if (cancelled) return;

        const map = new Map<string, ValidationStatus>();
        for (const entry of data) {
          map.set(entry.agentId, entry.overallStatus);
        }
        setStatusMap(map);
      } catch {
        // Validation API not deployed yet — silently fall back to empty map
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return statusMap;
}
