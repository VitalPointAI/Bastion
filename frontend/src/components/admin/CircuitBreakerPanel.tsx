/**
 * CircuitBreakerPanel Component
 *
 * Phase 31 Plan 05: Shows circuit breaker state for an agent with reinstate
 * and admin override controls. Includes event timeline for audit trail.
 */

import { useState, useEffect, useCallback } from 'react';
import { validationService } from '../../lib/validation-service';
import type { CircuitBreakerEventRow } from '../../lib/validation-service';

interface CircuitBreakerPanelProps {
  agentId: string;
}

const STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  closed: {
    bg: 'bg-green-500/20 border-green-500/40',
    text: 'text-green-400',
    label: 'CLOSED (Active)',
  },
  warning: {
    bg: 'bg-yellow-500/20 border-yellow-500/40',
    text: 'text-yellow-400',
    label: 'WARNING',
  },
  open: {
    bg: 'bg-red-500/20 border-red-500/40',
    text: 'text-red-400',
    label: 'OPEN (Disabled)',
  },
};

const EVENT_ICONS: Record<string, string> = {
  disabled: '\u26D4',
  reinstated: '\u2705',
  override: '\u26A0',
  warning: '\u26A0',
  fallback_activated: '\u21C4',
};

export function CircuitBreakerPanel({ agentId }: CircuitBreakerPanelProps) {
  const [events, setEvents] = useState<CircuitBreakerEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reinstating, setReinstating] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [justification, setJustification] = useState('');
  const [actionResult, setActionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await validationService.getCircuitEvents(agentId);
      setEvents(data);
    } catch (err) {
      console.error('[CircuitBreakerPanel] Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Derive current state from most recent event
  const currentState = events.length > 0 ? events[0].new_state : 'closed';
  const stateConfig = STATE_COLORS[currentState] || STATE_COLORS.closed;
  const isOpen = currentState === 'open';

  const handleReinstate = async () => {
    setReinstating(true);
    setActionResult(null);
    try {
      const result = await validationService.reinstateAgent(agentId);
      setActionResult({
        success: result.reinstated,
        message: result.reason,
      });
      if (result.reinstated) {
        await fetchEvents();
      }
    } catch (err) {
      setActionResult({
        success: false,
        message: err instanceof Error ? err.message : 'Reinstatement failed',
      });
    } finally {
      setReinstating(false);
    }
  };

  const handleOverride = async () => {
    if (!justification.trim()) {
      setActionResult({
        success: false,
        message: 'Justification is required for admin override',
      });
      return;
    }

    setReinstating(true);
    setActionResult(null);
    try {
      const result = await validationService.reinstateAgent(
        agentId,
        justification.trim(),
      );
      setActionResult({
        success: result.reinstated,
        message: result.reason,
      });
      if (result.reinstated) {
        setShowOverride(false);
        setJustification('');
        await fetchEvents();
      }
    } catch (err) {
      setActionResult({
        success: false,
        message: err instanceof Error ? err.message : 'Override failed',
      });
    } finally {
      setReinstating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-gray-200">Circuit Breaker</h3>

      {/* Current state indicator */}
      <div
        className={`border rounded-lg p-4 flex items-center justify-between ${stateConfig.bg}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-4 h-4 rounded-full ${
              currentState === 'closed'
                ? 'bg-green-500'
                : currentState === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          />
          <span className={`text-sm font-medium ${stateConfig.text}`}>
            {stateConfig.label}
          </span>
        </div>

        {isOpen && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReinstate}
              disabled={reinstating}
              className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white rounded transition-colors"
            >
              {reinstating ? 'Processing...' : 'Reinstate'}
            </button>
            <button
              onClick={() => setShowOverride(!showOverride)}
              className="text-xs px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
            >
              Admin Override
            </button>
          </div>
        )}
      </div>

      {/* Admin override form */}
      {showOverride && isOpen && (
        <div className="border border-yellow-700/30 bg-yellow-900/10 rounded-lg p-3 space-y-2">
          <div className="text-xs text-yellow-400">
            Admin Override: Force-reactivate without re-testing. A justification
            is mandatory for the audit trail.
          </div>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Provide justification for overriding the circuit breaker..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 h-20 resize-none"
          />
          <button
            onClick={handleOverride}
            disabled={reinstating || !justification.trim()}
            className="text-xs px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {reinstating ? 'Processing...' : 'Submit Override'}
          </button>
        </div>
      )}

      {/* Action result */}
      {actionResult && (
        <div
          className={`text-xs px-3 py-2 rounded border ${
            actionResult.success
              ? 'bg-green-900/20 border-green-700/30 text-green-400'
              : 'bg-red-900/20 border-red-700/30 text-red-400'
          }`}
        >
          {actionResult.message}
        </div>
      )}

      {/* Event timeline */}
      <div>
        <h4 className="text-xs font-medium text-gray-400 mb-2">
          Event Timeline
        </h4>
        {events.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">
            No circuit breaker events recorded
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="flex items-start gap-2 text-xs border-l-2 border-gray-700/50 pl-3 py-1.5"
              >
                <span className="flex-shrink-0 w-4 text-center">
                  {EVENT_ICONS[evt.event_type] || '\u2022'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-medium">
                      {evt.event_type}
                    </span>
                    <span className="text-gray-500">
                      {evt.previous_state} &rarr; {evt.new_state}
                    </span>
                    <span className="text-gray-500">{evt.category}</span>
                  </div>
                  <div className="text-gray-500 mt-0.5">
                    by {evt.triggered_by} at{' '}
                    {new Date(evt.created_at).toLocaleString()}
                  </div>
                  {evt.justification && (
                    <div className="text-gray-400 mt-0.5 italic">
                      "{evt.justification}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
