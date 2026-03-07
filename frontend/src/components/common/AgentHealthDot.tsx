/**
 * AgentHealthDot Component
 *
 * Reusable inline health indicator dot for agent validation status.
 * Renders a colored circle based on validation status with optional tooltip.
 *
 * Phase 31 Plan 06 — visible at all agent touchpoints.
 */

interface AgentHealthDotProps {
  status: 'passing' | 'warning' | 'critical' | 'disabled' | 'unknown';
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const STATUS_COLORS: Record<AgentHealthDotProps['status'], string> = {
  passing: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
  disabled: 'bg-gray-400',
  unknown: 'bg-gray-300',
};

const STATUS_LABELS: Record<AgentHealthDotProps['status'], string> = {
  passing: 'Validation passing',
  warning: 'Validation warning',
  critical: 'Validation critical',
  disabled: 'Validation disabled',
  unknown: 'Validation unknown',
};

const SIZE_CLASSES: Record<NonNullable<AgentHealthDotProps['size']>, string> = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
};

export function AgentHealthDot({
  status,
  size = 'md',
  showTooltip = true,
}: AgentHealthDotProps) {
  const colorClass = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  const sizeClass = SIZE_CLASSES[size];
  const pulseClass = status === 'critical' ? 'animate-pulse' : '';

  return (
    <span
      className={`inline-block rounded-full ${colorClass} ${sizeClass} ${pulseClass}`}
      title={showTooltip ? STATUS_LABELS[status] ?? STATUS_LABELS.unknown : undefined}
      role="img"
      aria-label={STATUS_LABELS[status] ?? STATUS_LABELS.unknown}
    />
  );
}
