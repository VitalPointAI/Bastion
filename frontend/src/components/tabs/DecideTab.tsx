/**
 * DecideTab
 *
 * Full-width decision dashboard replacing DirectTab.
 * No sidebar. No TabLayout. No Robot Missions.
 *
 * Layout:
 *   1. Horizontal filter bar + "Show RACI Matrix" toggle
 *   2. Status summary cards (from DecisionDashboard)
 *   3. Expandable RACI Matrix section
 *   4. Decision list with inline actions (approve/reject/defer/info)
 *   5. Decision Gate Timeline (from old DirectTab governance view)
 *
 * Phase 53 Plan 05 — replaces DirectTab.
 */

import { useState, useCallback } from 'react';
import { DecisionDashboard } from '../decide/DecisionDashboard.js';
import { RACIMatrixView } from '../decide/RACIMatrixView.js';
import { useDecisions } from '../../hooks/useDecisions.js';
import { useUser } from '../../context/UserContext.js';
import { useProblemSet } from '../../context/ProblemSetContext.js';
import {
  DecisionGateBanner,
  DecisionGateTimeline,
  GateSubmitButton,
} from '../governance/index.js';
import type { DecisionGate } from '../../lib/gate-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: number;
}

function SectionHeader({ title, expanded, onToggle, badge }: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: '0.75rem 0',
        cursor: 'pointer',
        color: 'var(--text-primary, #e2e8f0)',
        textAlign: 'left',
      }}
    >
      <svg
        style={{
          width: '0.875rem',
          height: '0.875rem',
          transition: 'transform 0.15s',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          color: 'var(--text-secondary, #94a3b8)',
          flexShrink: 0,
        }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{title}</span>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.05rem 0.4rem',
            borderRadius: '9999px',
            background: 'rgba(245,158,11,0.2)',
            color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── DecideTab ────────────────────────────────────────────────────────────────

interface DecideTabProps {
  problemSetId: string;
  daoId?: string;
}

export function DecideTab({ problemSetId, daoId: _daoId }: DecideTabProps) {
  const { userRoleInActive } = useProblemSet();
  const { userDID } = useUser();

  // Derive user position from role (used for RACI-aware pending filter)
  // Map role names to JP position slugs used in RACI matrix
  const userPosition = userRoleInActive ?? undefined;

  const {
    decisions,
    summary,
    raciMatrix,
    loading,
    error,
    refresh,
    actOnDecision,
    setFilters,
  } = useDecisions(problemSetId, userPosition);

  const [showRaci, setShowRaci] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);

  const handleGateDetailClick = useCallback((_gate: DecisionGate) => {
    // Future: navigate to gate details
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: '1.25rem 1.5rem',
        gap: '0',
      }}
    >
      {/* Decision gate banner (commander view) */}
      <DecisionGateBanner tabId="decide" />

      {/* Page header */}
      <div style={{ marginBottom: '1rem', marginTop: '0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>
          Decide
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary, #94a3b8)' }}>
          Decisions pending your action, RACI matrix, and gate history.
        </p>
      </div>

      {/* Order Release gate (inline — moved from old DirectTab sidebar) */}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--surface-secondary, rgba(30, 41, 59, 0.5))',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color, #334155)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary, #e2e8f0)' }}>
            Order Release Gate
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.125rem' }}>
            Submit order for commander release authorization
          </div>
        </div>
        <GateSubmitButton
          gateType="order_release"
          itemId={`${problemSetId}-order-release`}
          itemTitle="Order Release"
          itemDescription="Submit order for commander release authorization"
          tabId="decide"
        />
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-color, #334155)', marginBottom: '1.25rem' }} />

      {/* Decision Dashboard — summary cards + filterable list */}
      <DecisionDashboard
        decisions={decisions}
        summary={summary}
        loading={loading}
        error={error}
        problemSetId={problemSetId}
        onActOnDecision={actOnDecision}
        onFilterChange={setFilters}
      />

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-color, #334155)', margin: '1.25rem 0' }} />

      {/* RACI Matrix — expandable */}
      <div>
        <SectionHeader
          title="RACI Matrix"
          expanded={showRaci}
          onToggle={() => setShowRaci((v) => !v)}
        />
        {showRaci && (
          <div style={{ marginBottom: '0.75rem' }}>
            <RACIMatrixView
              problemSetId={problemSetId}
              raciMatrix={raciMatrix}
              userRole={userRoleInActive}
              onRefresh={refresh}
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-color, #334155)', margin: '0.5rem 0 0' }} />

      {/* Decision Gate Timeline — expandable */}
      <div>
        <SectionHeader
          title="Decision Gate History"
          expanded={showTimeline}
          onToggle={() => setShowTimeline((v) => !v)}
        />
        {showTimeline && (
          <div style={{ marginBottom: '1rem' }}>
            <DecisionGateTimeline tabId="decide" onEntryClick={handleGateDetailClick} />
          </div>
        )}
      </div>

      {/* User context footer */}
      {userDID && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-secondary, #475569)' }}>
          Signed in as {userPosition ?? 'member'} &bull; {userDID.slice(0, 24)}...
        </div>
      )}
    </div>
  );
}
