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
  const [showBulkOverride, setShowBulkOverride] = useState(false);
  const [bulkJustification, setBulkJustification] = useState('');
  const [bulkOverriding, setBulkOverriding] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: boolean; message: string } | null>(null);
  const [overrideActive, setOverrideActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set DID on service
  useEffect(() => {
    if (userDID) {
      validationService.setUserDID(userDID);
    }
  }, [userDID]);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashData, runsData, overrideData] = await Promise.all([
        validationService.getDashboard(),
        validationService.getRecentRuns(20),
        validationService.getOverrideStatus(),
      ]);
      setSummaries(dashData);
      setRecentRuns(runsData);
      setOverrideActive(overrideData.overrideActive);
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
      setTimeout(fetchDashboard, 2000);
    } catch (err) {
      console.error('[ValidationDashboard] Failed to trigger run:', err);
    } finally {
      setRunningValidation(false);
    }
  };

  const handleBulkOverride = async () => {
    if (!bulkJustification.trim()) {
      setBulkResult({ success: false, message: 'Justification is required' });
      return;
    }
    setBulkOverriding(true);
    setBulkResult(null);
    try {
      const result = await validationService.overrideAll(bulkJustification.trim());
      setBulkResult({
        success: true,
        message: `Override enabled. Reinstated ${result.reinstatedCount} agent(s).`,
      });
      setShowBulkOverride(false);
      setBulkJustification('');
      setTimeout(fetchDashboard, 1000);
    } catch (err) {
      setBulkResult({
        success: false,
        message: err instanceof Error ? err.message : 'Override failed',
      });
    } finally {
      setBulkOverriding(false);
    }
  };

  const handleDisableOverride = async () => {
    setBulkOverriding(true);
    setBulkResult(null);
    try {
      await validationService.disableOverride();
      setBulkResult({
        success: true,
        message: 'Override disabled. Validation re-evaluation started.',
      });
      setTimeout(fetchDashboard, 2000);
    } catch (err) {
      setBulkResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to disable override',
      });
    } finally {
      setBulkOverriding(false);
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
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-gray-100">
            Agent Validation & Compliance
          </h2>
          {overrideActive && (
            <span className="text-xs px-2 py-1 rounded bg-yellow-600/30 border border-yellow-600/50 text-yellow-400 font-medium">
              OVERRIDE ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ValidationExportButton />
          {overrideActive ? (
            <button
              onClick={handleDisableOverride}
              disabled={bulkOverriding}
              className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
            >
              {bulkOverriding && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              Disable Override
            </button>
          ) : (
            <button
              onClick={() => setShowBulkOverride(!showBulkOverride)}
              className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
            >
              Override Validation
            </button>
          )}
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

      {/* Bulk override form */}
      {showBulkOverride && !overrideActive && (
        <div className="border border-yellow-700/30 bg-yellow-900/10 rounded-lg p-4 space-y-3">
          <div className="text-sm text-yellow-400 font-medium">
            Validation Override
          </div>
          <div className="text-xs text-gray-400">
            This will temporarily disable validation enforcement and reinstate ALL
            disabled agents. Agents will not be auto-disabled while override is
            active. When you disable the override, a validation run will
            automatically execute and agents that fail will be disabled again.
          </div>
          <textarea
            value={bulkJustification}
            onChange={(e) => setBulkJustification(e.target.value)}
            placeholder="Provide justification for overriding validation (required for audit trail)..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 h-16 resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkOverride}
              disabled={bulkOverriding || !bulkJustification.trim()}
              className="text-xs px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              {bulkOverriding ? 'Processing...' : 'Enable Override & Reinstate All'}
            </button>
            <button
              onClick={() => {
                setShowBulkOverride(false);
                setBulkJustification('');
                setBulkResult(null);
              }}
              className="text-xs px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bulk action result */}
      {bulkResult && (
        <div
          className={`text-xs px-3 py-2 rounded border ${
            bulkResult.success
              ? 'bg-green-900/20 border-green-700/30 text-green-400'
              : 'bg-red-900/20 border-red-700/30 text-red-400'
          }`}
        >
          {bulkResult.message}
        </div>
      )}

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
