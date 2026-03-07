/**
 * ValidationRunLog Component
 *
 * Phase 31 Plan 05: Scrollable list of recent validation runs with expandable
 * details. Shows run metadata and results grouped by agent.
 */

import { useState } from 'react';
import { validationService } from '../../lib/validation-service';
import type { TestRunRow, TestResultRow } from '../../lib/validation-service';

interface ValidationRunLogProps {
  runs: TestRunRow[];
}

interface ExpandedRun {
  results: TestResultRow[];
  loading: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  running: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
};

export function ValidationRunLog({ runs }: ValidationRunLogProps) {
  const [expandedRuns, setExpandedRuns] = useState<Record<string, ExpandedRun>>(
    {},
  );

  const toggleRun = async (runId: string) => {
    if (expandedRuns[runId] && !expandedRuns[runId].loading) {
      // Collapse
      setExpandedRuns((prev) => {
        const next = { ...prev };
        delete next[runId];
        return next;
      });
      return;
    }

    // Expand: fetch details
    setExpandedRuns((prev) => ({
      ...prev,
      [runId]: { results: [], loading: true },
    }));

    try {
      const data = await validationService.getRunDetails(runId);
      setExpandedRuns((prev) => ({
        ...prev,
        [runId]: { results: data.results, loading: false },
      }));
    } catch (err) {
      console.error('[ValidationRunLog] Failed to load run details:', err);
      setExpandedRuns((prev) => ({
        ...prev,
        [runId]: { results: [], loading: false },
      }));
    }
  };

  // Group results by agent
  const groupByAgent = (results: TestResultRow[]) => {
    const groups: Record<string, TestResultRow[]> = {};
    for (const r of results) {
      if (!groups[r.agent_id]) groups[r.agent_id] = [];
      groups[r.agent_id].push(r);
    }
    return groups;
  };

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-200 mb-3">
        Recent Validation Runs
      </h3>
      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {runs.length === 0 ? (
          <div className="text-center text-gray-500 py-4 text-sm">
            No validation runs recorded yet
          </div>
        ) : (
          runs.map((run) => {
            const expanded = expandedRuns[run.id];
            return (
              <div
                key={run.id}
                className="border border-gray-700/30 rounded"
              >
                {/* Run header row */}
                <button
                  onClick={() => toggleRun(run.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700/30 transition-colors"
                >
                  <span className="text-xs text-gray-500 font-mono w-20 truncate">
                    {run.id.substring(0, 8)}...
                  </span>
                  <span className="text-xs text-gray-400 w-20 truncate">
                    {run.triggered_by}
                  </span>
                  <span className="text-xs text-gray-400 flex-1">
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[run.status] || 'bg-gray-600 text-gray-300'}`}
                  >
                    {run.status}
                  </span>
                  <span className="text-xs text-gray-500 w-24 text-right">
                    {run.total_agents} agents / {run.total_scenarios} scen.
                  </span>
                  <span className="text-xs text-gray-500 w-4">
                    {expanded ? '\u25B2' : '\u25BC'}
                  </span>
                </button>

                {/* Expanded details */}
                {expanded && (
                  <div className="px-3 pb-3 border-t border-gray-700/20">
                    {expanded.loading ? (
                      <div className="flex items-center justify-center py-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
                      </div>
                    ) : expanded.results.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2 pl-4">
                        No results in this run
                      </div>
                    ) : (
                      <div className="space-y-3 mt-2">
                        {Object.entries(groupByAgent(expanded.results)).map(
                          ([agentId, results]) => (
                            <div key={agentId}>
                              <div className="text-xs font-medium text-gray-300 mb-1 pl-2">
                                {agentId}
                              </div>
                              <div className="space-y-0.5">
                                {results.map((r) => (
                                  <div
                                    key={r.id}
                                    className="flex items-center gap-2 text-xs text-gray-400 pl-4"
                                  >
                                    <span className="w-24 truncate font-mono">
                                      {r.scenario_id}
                                    </span>
                                    <span className="w-16">{r.category}</span>
                                    <span className="w-10 text-right">
                                      F:{r.functional_score?.toFixed(2) ?? '--'}
                                    </span>
                                    <span className="w-10 text-right">
                                      L:{r.llm_judge_score?.toFixed(2) ?? '--'}
                                    </span>
                                    <span className="w-10 text-right font-medium">
                                      C:{r.combined_score?.toFixed(2) ?? '--'}
                                    </span>
                                    {r.disagreement && (
                                      <span className="text-yellow-500 text-[10px]">
                                        DISAGREE
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
