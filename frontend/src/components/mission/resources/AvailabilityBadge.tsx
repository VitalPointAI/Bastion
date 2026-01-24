/**
 * Availability Badge Component
 *
 * Displays resource availability status with color coding.
 * FMC (green), PMC (yellow), NMC (red) with tooltips.
 */

import { type ResourceStatus, getStatusLabel, getStatusColor } from '../../../lib/resource-service.js';

interface AvailabilityBadgeProps {
  status: ResourceStatus;
  showLabel?: boolean;
}

export function AvailabilityBadge({ status, showLabel = true }: AvailabilityBadgeProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className={`availability-badge availability-badge--${color}`}
      title={label}
    >
      {showLabel ? status : '●'}
    </span>
  );
}
