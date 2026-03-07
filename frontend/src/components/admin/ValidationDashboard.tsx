/**
 * ValidationDashboard Component
 *
 * Phase 31 Plan 05: Main validation dashboard with agent grid, drill-down,
 * run log, circuit breaker panel, and export controls. Auto-refreshes every
 * 30 seconds.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { validationService } from '../../lib/validation-service';
import type {
  ValidationDashboardSummary,
  TestRunRow,
} from '../../lib/validation-service';
import { useUser } from '../../context/UserContext';
import { ValidationAgentCard } from './ValidationAgentCard';
import { ValidationDrillDown } from './ValidationDrillDown';
import { ValidationRunLog } from './ValidationRunLog';
import { CircuitBreakerPanel } from './CircuitBreakerPanel';
import { ValidationExportButton } from './ValidationExportButton';

const POLL_INTERVAL = 30_000;

export function ValidationDashboard() {
  const { userDID } = useUser();
  const [summaries, setSummaries] = useState<ValidationDashboardSummary[]>([]);
  const [recentRuns, setRecentRuns] = useState<TestRunRow[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningValidation, setRunningValidation] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set DID on service
  useEffect(() => {
    if (userDID) {
      validationService.setUserDID(userDID);
    }
  }, [userDID]);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashData, runsData] = await Promise.all([
        validationService.getDashboard(),
        validationService.getRecentRuns(20),
      ]);
      setSummaries(dashData);
      setRecentRuns(runsData);
    } catch (err) {
      console.error('[ValidationDashboard] Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchDashboard();
    pollRef.current = setInterval(fetchDashboard, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDashboard]);

  const handleRunValidation = async () => {
    setRunningValidation(true);
    try {
      await validationService.triggerRun();
      // Refresh after a short delay to pick up the new run
      setTimeout(fetchDashboard, 2000);
    } catch (err) {
      console.error('[ValidationDashboard] Failed to trigger run:', err);
    } finally {
      setRunningValidation(false);
    }
  };

  // Compute summary stats
  const stats = {
    total: summaries.length,
    passing: summaries.filter((s) => s.overallStatus === 'passing').length,
    warning: summaries.filter((s) => s.overallStatus === 'warning').length,
    critical: summaries.filter((s) => s.overallStatus === 'critical').length,
    disabled: summaries.filter((s) => s.overallStatus === 'disabled').length,
  };

  const selectedSummary = selectedAgent
    ? summaries.find((s) => s.agentId === selectedAgent)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  // Drill-down view
  if (selectedAgent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedAgent(null)}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <span>&larr;</span> Back to Dashboard
          </button>
          <h2 className="text-lg font-medium text-gray-100">
            {selectedSummary?.agentName || selectedAgent}
          </h2>
          {selectedSummary && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-300">
              {selectedSummary.agentRole}
            </span>
          )}
          <div className="ml-auto">
            <ValidationExportButton agentId={selectedAgent} />
          </div>
        </div>

        <ValidationDrillDown agentId={selectedAgent} />
        <CircuitBreakerPanel agentId={selectedAgent} />
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-100">
          Agent Validation & Compliance
        </h2>
        <div className="flex items-center gap-3">
          <ValidationExportButton />
          <button
            onClick={handleRunValidation}
            disabled={runningValidation}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
          >
            {runningValidation && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            Run Validation
          </button>
        </div>
      </div>

      {/* Summary stats bar */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total Agents" value={stats.total} color="text-gray-100" />
        <StatCard label="Passing" value={stats.passing} color="text-green-400" />
        <StatCard label="Warning" value={stats.warning} color="text-yellow-400" />
        <StatCard label="Critical" value={stats.critical} color="text-red-400" />
        <StatCard label="Disabled" value={stats.disabled} color="text-gray-400" />
      </div>

      {/* Agent grid */}
      {summaries.length === 0 ? (
        <div className="text-center text-gray-500 py-12 text-sm">
          No agents registered for validation. Run a validation test to populate
          the dashboard.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {summaries.map((summary) => (
            <ValidationAgentCard
              key={summary.agentId}
              summary={summary}
              onClick={setSelectedAgent}
            />
          ))}
        </div>
      )}

      {/* Recent runs log */}
      <ValidationRunLog runs={recentRuns} />
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg px-4 py-3 text-center">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
