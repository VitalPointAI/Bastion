/**
 * MissionStatusCard
 *
 * Phase 38 Plan 06: Compact aggregated summary card per child mission.
 * Displayed in a grid on the parent COP tab.
 *
 * Shows mission state, progress bar, MDMP phase, resource health,
 * objective count, latest key event, and last updated time.
 * Click anywhere to drill down into tactical detail.
 */

import type { AggregatedMissionStatus } from '../../services/inheritance-service.js';

// ============================================================================
// Types
// ============================================================================

interface MissionStatusCardProps {
  status: AggregatedMissionStatus;
  onDrillDown: (childPsId: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

const STATE_BADGE: Record<string, { bg: string; text: string }> = {
  planning: { bg: '#1e3a5f', text: '#60a5fa' },
  active: { bg: '#064e3b', text: '#34d399' },
  complete: { bg: '#374151', text: '#9ca3af' },
  archived: { bg: '#1f2937', text: '#6b7280' },
};

const HEALTH_DOT: Record<string, string> = {
  green: '#34d399',
  amber: '#fbbf24',
  red: '#ef4444',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: '#60a5fa',
  warning: '#fbbf24',
  critical: '#ef4444',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ============================================================================
// Component
// ============================================================================

export function MissionStatusCard({ status, onDrillDown }: MissionStatusCardProps) {
  const badge = STATE_BADGE[status.missionState] ?? STATE_BADGE.planning;
  const healthColor = HEALTH_DOT[status.overallResourceHealth] ?? HEALTH_DOT.green;

  return (
    <div
      onClick={() => onDrillDown(status.childPsId)}
      style={{
        border: '1px solid #374151',
        borderRadius: '8px',
        padding: '12px',
        backgroundColor: '#1f2937',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        minWidth: '220px',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#60a5fa';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#374151';
      }}
    >
      {/* Header: name + state badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#e5e7eb',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '150px',
        }}>
          {status.childPsName}
        </div>
        <span style={{
          display: 'inline-block',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '10px',
          fontWeight: 600,
          backgroundColor: badge.bg,
          color: badge.text,
          textTransform: 'capitalize',
        }}>
          {status.missionState}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '6px',
        borderRadius: '3px',
        backgroundColor: '#374151',
        marginBottom: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: '3px',
          backgroundColor: status.percentComplete >= 100 ? '#34d399' : '#3b82f6',
          width: `${Math.min(100, Math.max(0, status.percentComplete))}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
        fontSize: '11px',
        color: '#9ca3af',
      }}>
        <span>{status.mdmpPhase}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: healthColor,
          }} />
          {status.completedCount}/{status.objectiveCount} obj
        </span>
      </div>

      {/* Latest key event */}
      {status.latestKeyEvent && (
        <div style={{
          fontSize: '11px',
          color: SEVERITY_COLORS[status.latestKeyEvent.severity] ?? '#9ca3af',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '4px',
        }}>
          {status.latestKeyEvent.description}
        </div>
      )}

      {/* Last updated */}
      <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'right' }}>
        Updated {relativeTime(status.lastUpdated)}
      </div>
    </div>
  );
}
