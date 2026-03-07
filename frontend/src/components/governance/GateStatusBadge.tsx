/**
 * GateStatusBadge
 *
 * Small inline status badge for decision gates.
 * Read-only -- used by non-commander roles next to items they submitted.
 *
 * Status colors:
 * - Pending/Submitted: Amber
 * - Approved: Green
 * - Rejected: Red
 * - Escalated: Purple
 * - Overridden: Gray
 */

import { useMemo } from 'react';
import { useDecisionGates } from '../../context/DecisionGateContext';
import { GateStatus } from '../../lib/gate-service';
import './GateStatusBadge.css';

// ============================================================================
// Status Label Map
// ============================================================================

const STATUS_LABELS: Record<string, string> = {
  [GateStatus.pending]: 'Pending',
  [GateStatus.submitted]: 'Pending Approval',
  [GateStatus.approved]: 'Approved',
  [GateStatus.rejected]: 'Rejected',
  [GateStatus.escalated]: 'Escalated',
  [GateStatus.overridden]: 'Overridden',
};

// ============================================================================
// Props
// ============================================================================

interface GateStatusBadgeProps {
  /** Gate ID to look up status from context */
  gateId?: string;
  /** Direct status string (alternative to gateId lookup) */
  status?: string;
  /** Custom label override */
  label?: string;
}

// ============================================================================
// Component
// ============================================================================

export function GateStatusBadge({ gateId, status: directStatus, label }: GateStatusBadgeProps) {
  const { gates } = useDecisionGates();

  // Resolve status: prefer direct status prop, fall back to gate lookup
  const resolvedStatus = useMemo(() => {
    if (directStatus) return directStatus;
    if (gateId) {
      const gate = gates.find((g) => g.id === gateId);
      return gate?.status || null;
    }
    return null;
  }, [directStatus, gateId, gates]);

  if (!resolvedStatus) return null;

  const displayLabel = label || STATUS_LABELS[resolvedStatus] || resolvedStatus;
  const statusClass = `status-${resolvedStatus}`;

  return (
    <span className={`gate-status-badge ${statusClass}`}>
      {displayLabel}
    </span>
  );
}
