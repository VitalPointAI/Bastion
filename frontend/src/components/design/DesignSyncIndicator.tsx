/**
 * DesignSyncIndicator
 *
 * Phase 49 Plan 02: Unified progress + sync display. Shows each Design section's
 * completion status and which Plan tab JPP step it feeds into. Replaces the
 * separate DesignProgressBar and old sync status panel with a single component.
 */

import type { DesignStatus, SectionStatus } from '../../lib/design-service.ts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncMapping {
  sectionKey: keyof DesignStatus;
  sectionName: string;
  targetStep: number;
  targetStepLabel: string;
}

const SYNC_MAPPINGS: SyncMapping[] = [
  {
    sectionKey: 'problemFraming',
    sectionName: 'Problem Framing',
    targetStep: 2,
    targetStepLabel: 'Mission Analysis',
  },
  {
    sectionKey: 'cogAnalysis',
    sectionName: 'CoG Analysis',
    targetStep: 2,
    targetStepLabel: 'Mission Analysis',
  },
  {
    sectionKey: 'linesOfEffort',
    sectionName: 'Lines of Effort',
    targetStep: 3,
    targetStepLabel: 'COA Development',
  },
  {
    sectionKey: 'operationalApproach',
    sectionName: 'Operational Approach',
    targetStep: 7,
    targetStepLabel: 'Plan/Order Development',
  },
];

// ─── Status helpers ──────────────────────────────────────────────────────────

function statusColor(status: SectionStatus): string {
  switch (status) {
    case 'complete': return '#34d399';
    case 'in-progress': return '#fbbf24';
    default: return '#4b5563';
  }
}

function statusIcon(status: SectionStatus): string {
  switch (status) {
    case 'complete': return '✓';
    case 'in-progress': return '◆';
    default: return '○';
  }
}

function statusLabel(status: SectionStatus): string {
  switch (status) {
    case 'complete': return 'Complete';
    case 'in-progress': return 'In Progress';
    default: return 'Not Started';
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DesignSyncIndicatorProps {
  status: DesignStatus;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DesignSyncIndicator({ status }: DesignSyncIndicatorProps) {
  const completeCount = SYNC_MAPPINGS.filter(m => status[m.sectionKey] === 'complete').length;
  const totalSections = SYNC_MAPPINGS.length;

  return (
    <div
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.6)',
        border: '1px solid rgba(75, 85, 99, 0.4)',
        borderRadius: '0.5rem',
        padding: '1rem',
      }}
    >
      {/* Header with progress summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb', margin: 0 }}>
          Design Progress
        </h3>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          {completeCount}/{totalSections} sections complete
        </span>
      </div>

      {/* Compact progress bar */}
      <div style={{ display: 'flex', gap: '3px', height: '4px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.75rem' }}>
        {SYNC_MAPPINGS.map((mapping) => (
          <div
            key={mapping.sectionKey}
            style={{
              flex: 1,
              backgroundColor: statusColor(status[mapping.sectionKey]),
              transition: 'background-color 0.3s',
            }}
          />
        ))}
      </div>

      {/* Section rows — progress + sync combined */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {SYNC_MAPPINGS.map((mapping) => {
          const sectionStatus = status[mapping.sectionKey];
          const color = statusColor(sectionStatus);

          return (
            <div
              key={mapping.sectionKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.375rem 0.5rem',
                borderRadius: '0.25rem',
                backgroundColor: sectionStatus === 'not-started' ? 'transparent' : 'rgba(255,255,255,0.03)',
              }}
            >
              {/* Status icon */}
              <span style={{ fontSize: '0.7rem', color, width: '0.875rem', textAlign: 'center', flexShrink: 0 }}>
                {statusIcon(sectionStatus)}
              </span>

              {/* Section name */}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#d1d5db', minWidth: '8.5rem', flexShrink: 0 }}>
                {mapping.sectionName}
              </span>

              {/* Arrow + Plan step target */}
              <span style={{ fontSize: '0.65rem', color: '#4b5563', flexShrink: 0 }}>→</span>
              <span style={{ fontSize: '0.7rem', color: '#60a5fa', whiteSpace: 'nowrap' }}>
                Step {mapping.targetStep}: {mapping.targetStepLabel}
              </span>

              {/* Status label */}
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.625rem',
                  color,
                  fontWeight: sectionStatus === 'complete' ? 600 : 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  flexShrink: 0,
                }}
              >
                {statusLabel(sectionStatus)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
