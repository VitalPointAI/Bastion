/**
 * ValidationAgentCard Component
 *
 * Phase 31 Plan 05: Health card for a single agent in the validation dashboard grid.
 * Shows health dot, agent name/role, per-category sparklines, and last run info.
 */

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { ValidationDashboardSummary } from '../../lib/validation-service';

interface ValidationAgentCardProps {
  summary: ValidationDashboardSummary;
  onClick: (agentId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  passing: '#22c55e',
  warning: '#eab308',
  critical: '#ef4444',
  disabled: '#6b7280',
  not_validated: '#6b7280',
  unknown: '#9ca3af',
};

const STATUS_BG: Record<string, string> = {
  passing: 'bg-green-900/20 border-green-700/30',
  warning: 'bg-yellow-900/20 border-yellow-700/30',
  critical: 'bg-red-900/20 border-red-700/30',
  disabled: 'bg-gray-800/40 border-gray-600/30',
  not_validated: 'bg-gray-800/40 border-gray-600/30',
  unknown: 'bg-gray-800/40 border-gray-600/30',
};

const CATEGORY_COLORS: Record<string, string> = {
  determinism: '#3b82f6',
  reliability: '#22c55e',
  authority: '#a855f7',
};

function AgentHealthDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  return (
    <span
      className="inline-block w-3 h-3 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={status}
    />
  );
}

function CategorySparkline({
  label,
  data,
  color,
}: {
  label: string;
  data: number[];
  color: string;
}) {
  const chartData = data.map((v, i) => ({ idx: i, score: v }));

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-20 truncate" title={label}>
        {label}
      </span>
      <ResponsiveContainer width={80} height={24}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <span className="text-xs text-gray-300 w-10 text-right">
        {data.length > 0 ? data[data.length - 1].toFixed(2) : '--'}
      </span>
    </div>
  );
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Never';
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ValidationAgentCard({ summary, onClick }: ValidationAgentCardProps) {
  const bgClass = STATUS_BG[summary.overallStatus] || STATUS_BG.unknown;

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 ${bgClass}`}
      onClick={() => onClick(summary.agentId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(summary.agentId);
        }
      }}
    >
      {/* Top row: health dot, name, role */}
      <div className="flex items-center gap-2 mb-3">
        <AgentHealthDot status={summary.overallStatus} />
        <span className="text-sm font-medium text-gray-100 truncate flex-1">
          {summary.agentName || summary.agentId}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-300 truncate max-w-25">
          {summary.agentRole}
        </span>
      </div>

      {/* Middle: sparklines per category */}
      <div className="space-y-1 mb-3">
        {(['determinism', 'reliability', 'authority'] as const).map((cat) => {
          const catData = summary.categories[cat];
          return (
            <CategorySparkline
              key={cat}
              label={cat.charAt(0).toUpperCase() + cat.slice(1)}
              data={catData?.trend || []}
              color={CATEGORY_COLORS[cat]}
            />
          );
        })}
      </div>

      {/* Bottom row: last run, scenario count */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{formatTimestamp(summary.lastRunAt)}</span>
        <span>{summary.scenarioCount} scenarios</span>
      </div>
    </div>
  );
}
