/**
 * GateBlockOverlay
 *
 * Wraps children with a semi-transparent overlay for hard-block gates
 * in 'submitted' or 'pending' status. Disables pointer events and shows
 * "Awaiting commander approval for {gateLabel}" message.
 *
 * Behavior:
 * - Hard-block + pending/submitted: overlay shown, children disabled
 * - Soft-warning: no overlay, children render normally
 * - Approved/overridden: no overlay, children render normally
 */

import { useMemo, type ReactNode } from 'react';
import { useDecisionGates } from '../../context/DecisionGateContext';
import { GateEnforcement, GateStatus } from '../../lib/gate-service';
import './GateBlockOverlay.css';

// ============================================================================
// Props
// ============================================================================

interface GateBlockOverlayProps {
  /** Gate ID to check status and enforcement */
  gateId: string;
  /** Human-readable label for the gate (shown in message) */
  gateLabel: string;
  /** Content to wrap */
  children: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function GateBlockOverlay({ gateId, gateLabel, children }: GateBlockOverlayProps) {
  const { gates } = useDecisionGates();

  const gate = useMemo(
    () => gates.find((g) => g.id === gateId),
    [gates, gateId]
  );

  // Determine if overlay should be shown
  const shouldBlock = useMemo(() => {
    if (!gate) return false;

    // Only hard-block enforcement triggers overlay
    if (gate.enforcement !== GateEnforcement.hard_block) return false;

    // Only pending or submitted status blocks
    const blockingStatuses = [GateStatus.pending, GateStatus.submitted];
    return blockingStatuses.includes(gate.status as typeof GateStatus[keyof typeof GateStatus]);
  }, [gate]);

  // No blocking needed -- render children normally
  if (!shouldBlock) {
    return <>{children}</>;
  }

  return (
    <div className="gate-block-overlay-container">
      <div className="gate-block-children-disabled">
        {children}
      </div>
      <div className="gate-block-overlay">
        <div className="gate-block-overlay-message">
          <span className="gate-block-icon">&#9888;</span>
          <span className="gate-block-text">
            Awaiting commander approval for {gateLabel}
          </span>
          <span className="gate-block-subtext">
            This section is locked until the gate is approved or overridden.
          </span>
        </div>
      </div>
    </div>
  );
}
