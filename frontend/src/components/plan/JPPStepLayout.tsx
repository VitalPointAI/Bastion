/**
 * JPPStepLayout
 *
 * Phase 33 Plan 05: Shared layout wrapper for all 7 JPP step components.
 * Provides consistent structure with step header, AI agent panel,
 * OSINT alerts, governance gates, and step-specific content.
 */

import { useState, type ReactNode } from 'react';
import type { JPPStepId, StepStatus } from '../../lib/jpp-service.ts';
import { DesignStatusBadge } from '../design/DesignStatusBadge.tsx';
import { OSINTAlertBanner } from './OSINTAlertBanner.tsx';
import { DecisionGateBanner, GateSubmitButton } from '../governance/index.ts';
import type { SectionStatus } from '../../lib/design-service.ts';

export interface JPPStepLayoutProps {
  stepId: JPPStepId;
  stepLabel: string;
  stepNumber: number;
  problemSetId: string;
  jppInstanceId: string;
  status: StepStatus;
  aiAgentId: string;
  children: ReactNode;
}

/** Map JPP StepStatus to SidebarItem/DesignStatusBadge status */
function mapStepStatus(status: StepStatus): SectionStatus {
  switch (status) {
    case 'not_started':
      return 'not-started';
    case 'in_progress':
      return 'in-progress';
    case 'ready':
    case 'approved':
      return 'complete';
    case 'rejected':
      return 'in-progress';
    default:
      return 'not-started';
  }
}

/** Steps that have governance decision gates */
const GATE_STEPS: JPPStepId[] = ['coa_development', 'coa_approval', 'plan_development'];

/** Map step IDs to governance gate types */
const STEP_GATE_TYPES: Record<string, string> = {
  coa_development: 'coa_selection',
  coa_approval: 'coa_selection',
  plan_development: 'plan_approval',
};

export function JPPStepLayout({
  stepId,
  stepLabel,
  stepNumber,
  problemSetId,
  jppInstanceId,
  status,
  aiAgentId,
  children,
}: JPPStepLayoutProps) {
  const [aiPanelExpanded, setAiPanelExpanded] = useState(false);
  const hasGate = GATE_STEPS.includes(stepId);
  const badgeStatus = mapStepStatus(status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Step header with number, label, and status badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid rgba(107, 114, 128, 0.3)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          {stepNumber}
        </span>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#e5e7eb' }}>
          {stepLabel}
        </h2>
        <div style={{ marginLeft: 'auto' }}>
          <DesignStatusBadge status={badgeStatus} />
        </div>
      </div>

      {/* 2. AI Agent panel (collapsible) */}
      <div
        style={{
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '0.375rem',
          padding: '0.5rem 0.75rem',
        }}
      >
        <button
          onClick={() => setAiPanelExpanded(!aiPanelExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: '#93c5fd',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          <span>AI Staff Assistant</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.65rem',
              transform: aiPanelExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}
          >
            &#9660;
          </span>
        </button>

        {aiPanelExpanded && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
            <p style={{ margin: '0 0 0.5rem' }}>
              Agent: <span style={{ color: '#d1d5db' }}>{aiAgentId}</span>
            </p>
            <p style={{ margin: '0 0 0.5rem' }}>
              Instance: <span style={{ color: '#d1d5db' }}>{jppInstanceId.slice(0, 8)}...</span>
            </p>
            <button
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '0.25rem',
                color: '#93c5fd',
                cursor: 'pointer',
              }}
            >
              Request AI Draft
            </button>
          </div>
        )}
      </div>

      {/* 3. OSINT Alert Banner */}
      <OSINTAlertBanner problemSetId={problemSetId} stepId={stepId} />

      {/* 4. Decision Gate Banner (for steps with governance gates) */}
      {hasGate && <DecisionGateBanner tabId="plan" />}

      {/* 5. Step-specific content (role-gated sections) */}
      <div>{children}</div>

      {/* 6. Gate Submit Button (for steps with governance gates) */}
      {hasGate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <GateSubmitButton
            gateType={STEP_GATE_TYPES[stepId] || 'coa_selection'}
            itemId={`${jppInstanceId}-${stepId}`}
            itemTitle={`Step ${stepNumber}: ${stepLabel}`}
            itemDescription={`Submit ${stepLabel} for approval`}
            tabId="plan"
          />
        </div>
      )}
    </div>
  );
}
