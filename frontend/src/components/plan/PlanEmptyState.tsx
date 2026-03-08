/**
 * PlanEmptyState
 *
 * Rendered when a problem set has no active workflow instance.
 * Shows a centered card with a "Start Planning" CTA button.
 */

interface PlanEmptyStateProps {
  workflowName: string;
  onStartPlanning: () => void;
  loading?: boolean;
}

export function PlanEmptyState({ workflowName, onStartPlanning, loading }: PlanEmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-md text-center">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">
          No {workflowName} Started
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Begin the {workflowName} planning workflow for this problem set.
        </p>
        <button
          onClick={onStartPlanning}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
        >
          {loading ? 'Starting...' : 'Start Planning'}
        </button>
      </div>
    </div>
  );
}
