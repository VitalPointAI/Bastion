/**
 * useAgentRouting
 *
 * Tab-aware agent routing hook. Fetches routing config from the backend
 * and merges with doctrinal defaults from AgentRoutingConfig.
 *
 * - Backend overrides defaults when user has customized agent assignments
 * - Provides updateRouting for persisting user changes
 * - Returns combined agent list for the active tab
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { aiStaffService } from '../lib/ai-staff-service.ts';
import { DEFAULT_TAB_AGENTS } from '../components/ai-staff/AgentRoutingConfig.ts';
import type { ProblemSetTab } from '../types/ai-staff.ts';

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseAgentRoutingResult {
  /** Combined list of agent IDs for the active tab (defaults + user-added) */
  agents: string[];
  /** Whether the user has customized agents for this tab */
  isCustomized: boolean;
  /** Persist updated agent list for the active tab */
  updateRouting: (agentIds: string[]) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAgentRouting(
  problemSetId: string | null,
  activeTab: string,
): UseAgentRoutingResult {
  const tabId = activeTab as ProblemSetTab;
  const defaults = DEFAULT_TAB_AGENTS[tabId] ?? [];

  const [agents, setAgents] = useState<string[]>(defaults);
  const [isCustomized, setIsCustomized] = useState(false);
  const mountedRef = useRef(true);

  // ─── Fetch routing config on mount / tab change ──────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (!problemSetId) {
      setAgents(defaults);
      setIsCustomized(false);
      return;
    }

    aiStaffService
      .getRouting(problemSetId)
      .then((config) => {
        if (!mountedRef.current) return;

        // Find config for this tab
        const tabConfig = config.configs?.find((c) => c.tabId === tabId);

        if (tabConfig && tabConfig.userAddedAgents.length > 0) {
          // User has customized -- merge defaults with user additions
          const combined = [...new Set([...tabConfig.defaultAgents, ...tabConfig.userAddedAgents])];
          setAgents(combined);
          setIsCustomized(true);
        } else {
          // Use doctrinal defaults
          setAgents(defaults);
          setIsCustomized(false);
        }
      })
      .catch((err) => {
        console.error('[useAgentRouting] fetch failed, using defaults:', err);
        if (mountedRef.current) {
          setAgents(defaults);
          setIsCustomized(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [problemSetId, tabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update routing ──────────────────────────────────────────────────────

  const updateRouting = useCallback(
    async (agentIds: string[]): Promise<void> => {
      if (!problemSetId) return;

      try {
        const updated = await aiStaffService.updateRouting(problemSetId, tabId, agentIds);
        if (mountedRef.current) {
          const combined = [
            ...new Set([...updated.defaultAgents, ...updated.userAddedAgents]),
          ];
          setAgents(combined);
          setIsCustomized(updated.userAddedAgents.length > 0);
        }
      } catch (err) {
        console.error('[useAgentRouting] updateRouting failed:', err);
        throw err;
      }
    },
    [problemSetId, tabId],
  );

  return { agents, isCustomized, updateRouting };
}
