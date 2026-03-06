/**
 * DesignStatusBadge
 *
 * Phase 25 Plan 01: Small badge showing section completion status.
 * Renders colored dot + text for not-started / in-progress / complete.
 */

import type { SectionStatus } from '../../lib/design-service.ts';

interface DesignStatusBadgeProps {
  status?: SectionStatus;
}

const STATUS_CONFIG: Record<SectionStatus, { dot: string; text: string; label: string }> = {
  'not-started': { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Not Started' },
  'in-progress': { dot: 'bg-amber-500', text: 'text-amber-400', label: 'In Progress' },
  'complete': { dot: 'bg-green-500', text: 'text-green-400', label: 'Complete' },
};

export function DesignStatusBadge({ status }: DesignStatusBadgeProps) {
  if (!status) return null;

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span className="inline-flex items-center gap-1.5 ml-auto text-xs">
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className={config.text}>{config.label}</span>
    </span>
  );
}
