/**
 * CrossWorkspaceLayerToggle
 *
 * Panel showing approved cross-workspace subscriptions as toggle switches.
 * Allows commanders to show/hide data layers from subscribed workspaces
 * on the overview map/panel.
 *
 * - Loads subscriptions from workspace-service on mount
 * - Filters to approved subscriptions where this workspace is the subscriber
 * - Renders each as a toggle row with workspace name and data type badges
 * - Notifies parent of enabled layer set via onLayersChange callback
 *
 * Phase 20 Plan 07: Cross-workspace layer visibility toggles
 */

import { useState, useEffect, useCallback } from 'react';
import {
  workspaceService,
  type Subscription,
} from '../../lib/workspace-service';
import { useUser } from '../../context/UserContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CrossWorkspaceLayerToggleProps {
  workspaceId: string;
  onLayersChange?: (enabledIds: string[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map raw data type keys to human-readable badge labels */
const DATA_TYPE_LABELS: Record<string, string> = {
  decide: 'Decide',
  monitor: 'Monitor',
  design: 'Design',
  campaign: 'Campaign',
  train: 'Train',
  intelligence: 'Intel',
  escalations: 'Escalations',
  directives: 'Directives',
};

function dataTypeLabel(type: string): string {
  return DATA_TYPE_LABELS[type] ?? type;
}

/** Badge color per data type */
const DATA_TYPE_COLORS: Record<string, string> = {
  decide: 'bg-purple-700 text-purple-100',
  monitor: 'bg-blue-700 text-blue-100',
  design: 'bg-teal-700 text-teal-100',
  campaign: 'bg-orange-700 text-orange-100',
  train: 'bg-green-700 text-green-100',
  intelligence: 'bg-cyan-700 text-cyan-100',
  escalations: 'bg-red-700 text-red-100',
  directives: 'bg-yellow-700 text-yellow-100',
};

function dataTypeColor(type: string): string {
  return DATA_TYPE_COLORS[type] ?? 'bg-gray-600 text-gray-100';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CrossWorkspaceLayerToggle({
  workspaceId,
  onLayersChange,
}: CrossWorkspaceLayerToggleProps) {
  const { userDID } = useUser();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load subscriptions ────────────────────────────────────────────────────

  const loadSubscriptions = useCallback(async () => {
    if (!workspaceId || !userDID) return;
    setLoading(true);
    setError(null);
    try {
      const result = await workspaceService.getSubscriptions(workspaceId, userDID);
      // Only show subscriptions where we are the subscriber and status is approved
      const approved = result.asSubscriber.filter(
        (s) => s.approvalStatus === 'approved'
      );
      setSubscriptions(approved);
      // Enable all layers by default
      setEnabledLayers(new Set(approved.map((s) => s.publisherWorkspaceId)));
    } catch {
      setError('Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userDID]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  // Notify parent when enabled layers change
  useEffect(() => {
    if (onLayersChange) {
      onLayersChange(Array.from(enabledLayers));
    }
  }, [enabledLayers, onLayersChange]);

  // ─── Toggle handler ────────────────────────────────────────────────────────

  function handleToggle(publisherWorkspaceId: string) {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(publisherWorkspaceId)) {
        next.delete(publisherWorkspaceId);
      } else {
        next.add(publisherWorkspaceId);
      }
      return next;
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          Cross-Workspace Layers
        </h4>
        {subscriptions.length > 0 && (
          <span className="text-xs text-gray-500">
            {enabledLayers.size}/{subscriptions.length} active
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-2 text-gray-400 text-sm">
          <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-gray-300" />
          Loading subscriptions...
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <p className="text-xs text-red-400 py-1">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && subscriptions.length === 0 && (
        <p className="text-xs text-gray-500 py-2 leading-relaxed">
          No cross-workspace subscriptions. Request access from workspace commanders.
        </p>
      )}

      {/* Subscription rows */}
      {!loading && !error && subscriptions.length > 0 && (
        <div className="max-h-48 overflow-auto space-y-0">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0"
            >
              {/* Left: workspace name + data type badges */}
              <div className="flex flex-col gap-1 min-w-0 flex-1 pr-3">
                <span className="text-sm text-gray-200 font-medium truncate">
                  {sub.publisherWorkspaceId}
                </span>
                {sub.dataTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sub.dataTypes.map((type) => (
                      <span
                        key={type}
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${dataTypeColor(type)}`}
                      >
                        {dataTypeLabel(type)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enabledLayers.has(sub.publisherWorkspaceId)}
                  onChange={() => handleToggle(sub.publisherWorkspaceId)}
                  className="sr-only peer"
                  aria-label={`Toggle ${sub.publisherWorkspaceId} data layer`}
                />
                <div
                  className={[
                    'w-9 h-5 rounded-full transition-colors',
                    enabledLayers.has(sub.publisherWorkspaceId)
                      ? 'bg-blue-600'
                      : 'bg-gray-600',
                    'after:content-[""] after:absolute after:top-0.5 after:inset-s-0.5',
                    'after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all',
                    enabledLayers.has(sub.publisherWorkspaceId)
                      ? 'after:translate-x-4'
                      : 'after:translate-x-0',
                    'relative',
                  ].join(' ')}
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CrossWorkspaceLayerToggle;
