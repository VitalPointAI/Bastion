/**
 * StrategicGuidanceStepLayout
 *
 * Phase 36 Plan 02: Shared layout wrapper for strategic guidance step components.
 * Mirrors MDMPStepLayout pattern with step header, AI agent panel,
 * governance gates, and step-specific content.
 */

import { useState, type ReactNode } from 'react';
import type { SGStepId } from './StrategicGuidanceStepConfig.ts';
import type { SectionStatus } from '../../lib/design-service.ts';
import { DesignStatusBadge } from '../design/DesignStatusBadge.tsx';
import { DecisionGateBanner, GateSubmitButton } from '../governance/index.ts';

export interface StrategicGuidanceStepLayoutProps {
  stepId: SGStepId;
  stepLabel: string;
  stepNumber: number;
  problemSetId: string;
  instanceId: string;
  status: 'not-started' | 'in-progress' | 'complete';
  aiAgentId: string;
  governanceGate?: { gateType: string; description: string };
  children: ReactNode;
}

export function StrategicGuidanceStepLayout({
  stepId,
  stepLabel,
  stepNumber,
  problemSetId: _problemSetId,
  instanceId,
  status,
  aiAgentId,
  governanceGate,
  children,
}: StrategicGuidanceStepLayoutProps) {
  const [aiPanelExpanded, setAiPanelExpanded] = useState(false);
  const badgeStatus: SectionStatus = status;

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
              Instance: <span style={{ color: '#d1d5db' }}>{instanceId.slice(0, 8)}...</span>
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

      {/* 3. Decision Gate Banner (for steps with governance gates) */}
      {governanceGate && <DecisionGateBanner tabId="plan" />}

      {/* 4. Step-specific content */}
      <div>{children}</div>

      {/* 5. Gate Submit Button (for steps with governance gates) */}
      {governanceGate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <GateSubmitButton
            gateType={governanceGate.gateType}
            itemId={`${instanceId}-${stepId}`}
            itemTitle={`Step ${stepNumber}: ${stepLabel}`}
            itemDescription={governanceGate.description}
            tabId="plan"
          />
        </div>
      )}
    </div>
  );
}
