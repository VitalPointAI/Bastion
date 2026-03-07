/**
 * ValidationDrillDown Component
 *
 * Phase 31 Plan 05: Time-series Recharts line charts with threshold reference
 * lines for a single agent. Shows score history per category and recent test
 * run detail log.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { validationService } from '../../lib/validation-service';
import type {
  ValidationAgentScoreRow,
  ThresholdConfigRow,
  TestRunRow,
  TestResultRow,
} from '../../lib/validation-service';

interface ValidationDrillDownProps {
  agentId: string;
}

type TimeRange = '7d' | '30d' | '90d';

const CATEGORIES = ['determinism', 'reliability', 'authority'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  determinism: '#3b82f6',
  reliability: '#22c55e',
  authority: '#a855f7',
};

const CATEGORY_LABELS: Record<string, string> = {
  determinism: 'Determinism',
  reliability: 'Reliability',
  authority: 'Authority Compliance',
};

function getLimitForRange(range: TimeRange): number {
  switch (range) {
    case '7d':
      return 20;
    case '30d':
      return 50;
    case '90d':
      return 100;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface RunDetail {
  run: TestRunRow;
  results: TestResultRow[];
  expanded: boolean;
}

export function ValidationDrillDown({ agentId }: ValidationDrillDownProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [scoresByCategory, setScoresByCategory] = useState<
    Record<string, ValidationAgentScoreRow[]>
  >({});
  const [thresholds, setThresholds] = useState<ThresholdConfigRow[]>([]);
  const [runDetails, setRunDetails] = useState<RunDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const limit = getLimitForRange(timeRange);

      // Fetch scores for each category in parallel
      const [detScores, relScores, authScores, thresholdData, recentRuns] =
        await Promise.all([
          validationService.getAgentScores(agentId, 'determinism', limit),
          validationService.getAgentScores(agentId, 'reliability', limit),
          validationService.getAgentScores(agentId, 'authority', limit),
          validationService
            .getThresholds('agent', agentId)
            .catch(() =>
              validationService.getThresholds('category').catch(() => []),
            ),
          validationService.getRecentRuns(20),
        ]);

      setScoresByCategory({
        determinism: detScores,
        reliability: relScores,
        authority: authScores,
      });
      setThresholds(thresholdData);
      setRunDetails(
        recentRuns.map((run) => ({ run, results: [], expanded: false })),
      );
    } catch (err) {
      console.error('[ValidationDrillDown] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getThresholdForCategory = (
    category: string,
  ): { warning: number; critical: number } => {
    const t = thresholds.find((th) => th.category === category);
    return {
      warning: t?.warning_threshold ?? 0.8,
      critical: t?.critical_threshold ?? 0.6,
    };
  };

  const toggleRunExpanded = async (index: number) => {
    const detail = runDetails[index];
    if (!detail.expanded && detail.results.length === 0) {
      try {
        const data = await validationService.getRunDetails(detail.run.id);
        const agentResults = data.results.filter(
          (r) => r.agent_id === agentId,
        );
        setRunDetails((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            results: agentResults,
            expanded: true,
          };
          return next;
        });
      } catch (err) {
        console.error('[ValidationDrillDown] Failed to load run details:', err);
      }
    } else {
      setRunDetails((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], expanded: !next[index].expanded };
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Time Range:</span>
        {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Category charts */}
      {CATEGORIES.map((category) => {
        const scores = scoresByCategory[category] || [];
        const chartData = scores
          .map((s) => ({
            date: formatDate(s.created_at),
            avg_score: s.avg_score,
            min_score: s.min_score,
            max_score: s.max_score,
            status: s.status,
            fullDate: s.created_at,
            scenarioCount: s.scenario_count,
          }))
          .reverse(); // oldest first for chart

        const thresh = getThresholdForCategory(category);

        return (
          <div
            key={category}
            className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4"
          >
            <h3 className="text-sm font-medium text-gray-200 mb-3">
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: CATEGORY_COLORS[category] }}
              />
              {CATEGORY_LABELS[category]}
            </h3>

            {chartData.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm">
                No score data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#e5e7eb',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      value.toFixed(3),
                      name === 'avg_score'
                        ? 'Average'
                        : name === 'min_score'
                          ? 'Min'
                          : 'Max',
                    ]}
                    labelFormatter={(label: string) => `Date: ${label}`}
                  />
                  <ReferenceLine
                    y={thresh.warning}
                    stroke="#eab308"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Warning',
                      position: 'right',
                      fill: '#eab308',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={thresh.critical}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Critical',
                      position: 'right',
                      fill: '#ef4444',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke={CATEGORY_COLORS[category]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CATEGORY_COLORS[category] }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="min_score"
                    stroke={CATEGORY_COLORS[category]}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    opacity={0.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="max_score"
                    stroke={CATEGORY_COLORS[category]}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    opacity={0.4}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })}

      {/* Recent test run detail log */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-200 mb-3">
          Recent Test Runs for This Agent
        </h3>
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {runDetails.length === 0 ? (
            <div className="text-center text-gray-500 py-4 text-sm">
              No test runs found
            </div>
          ) : (
            runDetails.map((detail, idx) => (
              <div
                key={detail.run.id}
                className="border border-gray-700/30 rounded"
              >
                <button
                  onClick={() => toggleRunExpanded(idx)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700/30 transition-colors"
                >
                  <span className="text-xs text-gray-500 font-mono w-16 truncate">
                    {detail.run.id.substring(0, 8)}
                  </span>
                  <StatusBadge status={detail.run.status} />
                  <span className="text-xs text-gray-400 flex-1">
                    {new Date(detail.run.started_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {detail.expanded ? '\u25B2' : '\u25BC'}
                  </span>
                </button>
                {detail.expanded && detail.results.length > 0 && (
                  <div className="px-3 pb-2 space-y-1">
                    {detail.results.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 text-xs text-gray-400 pl-4"
                      >
                        <span className="w-20 truncate">{r.scenario_id}</span>
                        <span className="w-16">{r.category}</span>
                        <span className="w-12 text-right">
                          {r.combined_score?.toFixed(3) ?? '--'}
                        </span>
                        {r.disagreement && (
                          <span className="text-yellow-500 text-[10px]">
                            DISAGREE
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {detail.expanded && detail.results.length === 0 && (
                  <div className="px-3 pb-2 text-xs text-gray-500 pl-4">
                    No results for this agent in this run
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded ${colors[status] || 'bg-gray-600 text-gray-300'}`}
    >
      {status}
    </span>
  );
}
