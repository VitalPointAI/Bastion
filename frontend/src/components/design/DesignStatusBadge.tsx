/**
 * DesignStatusBadge
 *
 * Small badge showing section completion status.
 *  - Default mode: colored dot + label text (for wide contexts like cards)
 *  - Compact mode: colored dot only with tooltip (for tight contexts like
 *    the sidebar where there's no room for text next to the section label)
 */

import type { SectionStatus } from '../../lib/design-service.ts';

interface DesignStatusBadgeProps {
  status?: SectionStatus;
  compact?: boolean;
}

const STATUS_CONFIG: Record<SectionStatus, { dot: string; text: string; label: string }> = {
  'not-started': { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Not Started' },
  'in-progress': { dot: 'bg-amber-500', text: 'text-amber-400', label: 'In Progress' },
  'complete': { dot: 'bg-green-500', text: 'text-green-400', label: 'Complete' },
};

export function DesignStatusBadge({ status, compact }: DesignStatusBadgeProps) {
  if (!status) return null;

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  if (compact) {
    return (
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`}
        title={config.label}
        aria-label={config.label}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs shrink-0">
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className={config.text}>{config.label}</span>
    </span>
  );
}
