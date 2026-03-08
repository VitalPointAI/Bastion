/**
 * MissionStatusDrilldown
 *
 * Phase 38 Plan 06: Expanded tactical detail view for a child mission.
 * Renders inline below the clicked MissionStatusCard (not a modal).
 *
 * Shows full key events list, resource breakdown, and objective progress table.
 */

import type { MissionStatusSnapshot } from '../../services/inheritance-service.js';

// ============================================================================
// Types
// ============================================================================

interface MissionStatusDrilldownProps {
  childPsId: string;
  snapshot: MissionStatusSnapshot;
  onClose: () => void;
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

const SEVERITY_COLORS: Record<string, string> = {
  info: '#60a5fa',
  warning: '#fbbf24',
  critical: '#ef4444',
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  not_started: { bg: '#374151', text: '#9ca3af' },
  in_progress: { bg: '#1e3a5f', text: '#60a5fa' },
  achieved: { bg: '#064e3b', text: '#34d399' },
  failed: { bg: '#7f1d1d', text: '#fca5a5' },
};

function healthIndicator(assigned: number, available: number): { label: string; color: string } {
  if (assigned === 0) return { label: 'N/A', color: '#6b7280' };
  const rate = available / assigned;
  if (rate >= 0.75) return { label: `${Math.round(rate * 100)}%`, color: '#34d399' };
  if (rate >= 0.5) return { label: `${Math.round(rate * 100)}%`, color: '#fbbf24' };
  return { label: `${Math.round(rate * 100)}%`, color: '#ef4444' };
}

// ============================================================================
// Component
// ============================================================================

export function MissionStatusDrilldown({ snapshot, onClose }: MissionStatusDrilldownProps) {
  const stateBadge = STATE_BADGE[snapshot.missionState] ?? STATE_BADGE.planning;

  const personnelHealth = healthIndicator(
    snapshot.resourceStatus?.personnel?.assigned ?? 0,
    snapshot.resourceStatus?.personnel?.available ?? 0,
  );

  const equipmentHealth = healthIndicator(
    snapshot.resourceStatus?.equipment?.total ?? 0,
    snapshot.resourceStatus?.equipment?.operational ?? 0,
  );

  return (
    <div style={{
      border: '1px solid #4b5563',
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: '#111827',
      marginTop: '8px',
      marginBottom: '12px',
    }}>
      {/* Header with close button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#e5e7eb' }}>
            {snapshot.childProblemSetName}
          </span>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: stateBadge.bg,
            color: stateBadge.text,
            textTransform: 'capitalize',
          }}>
            {snapshot.missionState}
          </span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            MDMP: {snapshot.mdmpPhase}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: '1px solid #4b5563',
            backgroundColor: '#374151',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Close
        </button>
      </div>

      {/* Three columns: Events, Resources, Objectives */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>

        {/* Key Events */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Key Events
          </h4>
          {(!snapshot.keyEvents || snapshot.keyEvents.length === 0) ? (
            <div style={{ fontSize: '11px', color: '#6b7280' }}>No events reported</div>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {[...snapshot.keyEvents]
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .map((event, i) => (
                  <div key={i} style={{
                    padding: '4px 0',
                    borderBottom: '1px solid #1f2937',
                    fontSize: '11px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontSize: '9px',
                        fontWeight: 600,
                        backgroundColor: SEVERITY_COLORS[event.severity] ?? '#6b7280',
                        color: '#111827',
                        textTransform: 'uppercase',
                      }}>
                        {event.severity}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '10px' }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ color: '#d1d5db' }}>{event.description}</div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Resource Status */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Resources
          </h4>

          {/* Personnel */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Personnel</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#d1d5db' }}>
                {snapshot.resourceStatus?.personnel?.available ?? 0} / {snapshot.resourceStatus?.personnel?.assigned ?? 0}
              </span>
              <span style={{ color: personnelHealth.color, fontWeight: 600 }}>
                {personnelHealth.label}
              </span>
            </div>
          </div>

          {/* Equipment */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Equipment</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#d1d5db' }}>
                {snapshot.resourceStatus?.equipment?.operational ?? 0} / {snapshot.resourceStatus?.equipment?.total ?? 0}
              </span>
              <span style={{ color: equipmentHealth.color, fontWeight: 600 }}>
                {equipmentHealth.label}
              </span>
            </div>
          </div>

          {/* Supplies */}
          {snapshot.resourceStatus?.supplies && Object.keys(snapshot.resourceStatus.supplies).length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Supplies by Class</div>
              {Object.entries(snapshot.resourceStatus.supplies).map(([cls, val]) => (
                <div key={cls} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                  <span style={{ color: '#9ca3af' }}>{cls}</span>
                  <span style={{ color: '#d1d5db' }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Objective Progress */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Objectives
          </h4>
          {(!snapshot.objectiveProgress || snapshot.objectiveProgress.length === 0) ? (
            <div style={{ fontSize: '11px', color: '#6b7280' }}>No objectives reported</div>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {snapshot.objectiveProgress.map((obj) => {
                const sb = STATUS_BADGE[obj.status] ?? STATUS_BADGE.not_started;
                return (
                  <div key={obj.objectiveId} style={{
                    padding: '6px 0',
                    borderBottom: '1px solid #1f2937',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#d1d5db', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {obj.objectiveName}
                      </span>
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 600,
                        backgroundColor: sb.bg,
                        color: sb.text,
                      }}>
                        {obj.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {/* Percent bar */}
                    <div style={{
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: '#374151',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        borderRadius: '2px',
                        backgroundColor: sb.text,
                        width: `${Math.min(100, Math.max(0, obj.percentComplete))}%`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
