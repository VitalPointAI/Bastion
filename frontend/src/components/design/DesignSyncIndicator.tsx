/**
 * DesignSyncIndicator
 *
 * Phase 49 Plan 02: Shows which Design tab sections flow automatically
 * into which Plan tab JPP steps. Displayed in DesignOverview below the
 * progress bar.
 *
 * Intentionally uses arrow/flow language rather than status dots to
 * distinguish from the DesignStatusBadge pattern.
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

// ─── Status color helpers ─────────────────────────────────────────────────────

function statusColor(status: SectionStatus): string {
  switch (status) {
    case 'complete':
      return '#a7f3d0';
    case 'in-progress':
      return '#fde68a';
    default:
      return '#6b7280';
  }
}

function statusBgColor(status: SectionStatus): string {
  switch (status) {
    case 'complete':
      return 'rgba(16, 185, 129, 0.12)';
    case 'in-progress':
      return 'rgba(245, 158, 11, 0.1)';
    default:
      return 'rgba(75, 85, 99, 0.15)';
  }
}

function statusBorderColor(status: SectionStatus): string {
  switch (status) {
    case 'complete':
      return 'rgba(16, 185, 129, 0.3)';
    case 'in-progress':
      return 'rgba(245, 158, 11, 0.3)';
    default:
      return 'rgba(75, 85, 99, 0.25)';
  }
}

function statusLabel(status: SectionStatus): string {
  switch (status) {
    case 'complete':
      return 'complete';
    case 'in-progress':
      return 'in progress';
    default:
      return 'not started';
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DesignSyncIndicatorProps {
  status: DesignStatus;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DesignSyncIndicator({ status }: DesignSyncIndicatorProps) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(30, 58, 138, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '0.5rem',
        padding: '1rem',
      }}
    >
      {/* Section title */}
      <div style={{ marginBottom: '0.75rem' }}>
        <h3
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#93c5fd',
            margin: '0 0 0.25rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Plan Tab Sync Status
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
          Design artifacts automatically flow to the Plan tab's JPP steps.
        </p>
      </div>

      {/* Sync rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {SYNC_MAPPINGS.map((mapping) => {
          const sectionStatus = status[mapping.sectionKey];
          const color = statusColor(sectionStatus);
          const bg = statusBgColor(sectionStatus);
          const border = statusBorderColor(sectionStatus);

          return (
            <div
              key={mapping.sectionKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: bg,
                border: `1px solid ${border}`,
                borderRadius: '0.3rem',
                padding: '0.375rem 0.625rem',
              }}
            >
              {/* Section name */}
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color,
                  minWidth: '9rem',
                  flexShrink: 0,
                }}
              >
                {mapping.sectionName}
              </span>

              {/* Arrow */}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#374151',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                &#8594;
              </span>

              {/* Target step */}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#60a5fa',
                  flexShrink: 0,
                }}
              >
                Plan Step {mapping.targetStep}: {mapping.targetStepLabel}
              </span>

              {/* Status label */}
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  color,
                  fontStyle: 'italic',
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
