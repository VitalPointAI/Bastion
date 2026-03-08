/**
 * METLDashboard
 *
 * Phase 37 Plan 05: Heat map matrix showing METL task proficiency
 * with T/P/U color-coded cells and decay warning indicators.
 *
 * Rows: METL tasks grouped by competency area
 * Cells: colored boxes (T=green, P=yellow, U=red, empty=gray)
 * Decay: amber pulsing border for warning, red dashed for expired
 */

import type { METLProficiencySummary } from '../../lib/assessment-service.ts';
import './METLDashboard.css';

interface METLDashboardProps {
  problemSetId: string;
  proficiencyData: METLProficiencySummary[];
}

/** Group proficiency data by competency area */
function groupByCompetency(data: METLProficiencySummary[]): Map<string, METLProficiencySummary[]> {
  const groups = new Map<string, METLProficiencySummary[]>();
  for (const item of data) {
    const area = item.competencyArea || 'Uncategorized';
    const existing = groups.get(area) || [];
    existing.push(item);
    groups.set(area, existing);
  }
  return groups;
}

function ratingLabel(rating?: string): string {
  switch (rating) {
    case 'T': return 'Trained';
    case 'P': return 'Practiced';
    case 'U': return 'Untrained';
    default: return 'Not Assessed';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function METLDashboard({ proficiencyData }: METLDashboardProps) {
  const grouped = groupByCompetency(proficiencyData);
  const areas = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Summary stats
  const total = proficiencyData.length;
  const tCount = proficiencyData.filter(p => p.rating === 'T').length;
  const pCount = proficiencyData.filter(p => p.rating === 'P').length;
  const uCount = proficiencyData.filter(p => p.rating === 'U').length;
  const decayWarnings = proficiencyData.filter(p => p.decayStatus === 'warning' || p.decayStatus === 'expired').length;

  return (
    <div className="metl-dashboard">
      {/* Summary Stats */}
      <div className="metl-summary-stats">
        <div className="metl-stat">
          <span className="metl-stat-value">{total}</span>
          <span className="metl-stat-label">Total Tasks</span>
        </div>
        <div className="metl-stat stat-trained">
          <span className="metl-stat-value">{tCount}</span>
          <span className="metl-stat-label">Trained</span>
        </div>
        <div className="metl-stat stat-practiced">
          <span className="metl-stat-value">{pCount}</span>
          <span className="metl-stat-label">Practiced</span>
        </div>
        <div className="metl-stat stat-untrained">
          <span className="metl-stat-value">{uCount}</span>
          <span className="metl-stat-label">Untrained</span>
        </div>
        {decayWarnings > 0 && (
          <div className="metl-stat stat-decay">
            <span className="metl-stat-value">{decayWarnings}</span>
            <span className="metl-stat-label">Decay Warnings</span>
          </div>
        )}
      </div>

      {/* Heat Map Grid */}
      <div className="metl-heatmap">
        {areas.length === 0 && (
          <p className="metl-empty">No METL tasks defined. Use Manage METL Tasks to create tasks.</p>
        )}
        {areas.map(([area, tasks]) => (
          <div key={area} className="metl-area-group">
            <div className="metl-area-header">{area}</div>
            <div className="metl-area-rows">
              {tasks.map(task => {
                const ratingClass = task.rating ? `rating-${task.rating}` : 'rating-none';
                const decayClass = task.decayStatus === 'warning'
                  ? 'decay-warning'
                  : task.decayStatus === 'expired'
                    ? 'decay-expired'
                    : '';

                return (
                  <div key={task.metlTaskId} className="metl-row">
                    <div className="metl-task-name" title={task.taskName}>
                      {task.taskName}
                    </div>
                    <div className={`metl-cell ${ratingClass} ${decayClass}`}>
                      <span className="metl-cell-rating">
                        {task.rating || '--'}
                      </span>
                      {task.decayStatus === 'expired' && (
                        <span className="metl-decay-label">(Decayed)</span>
                      )}
                    </div>
                    <div className="metl-assessed-date">
                      {formatDate(task.assessedAt)}
                      {task.commanderOverride && (
                        <span className="metl-override-badge" title="Commander Override">CDR</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="metl-legend">
        <span className="metl-legend-title">Legend:</span>
        <span className="metl-legend-item">
          <span className="metl-legend-swatch rating-T" />T = Trained
        </span>
        <span className="metl-legend-item">
          <span className="metl-legend-swatch rating-P" />P = Practiced
        </span>
        <span className="metl-legend-item">
          <span className="metl-legend-swatch rating-U" />U = Untrained
        </span>
        <span className="metl-legend-item">
          <span className="metl-legend-swatch decay-warning-swatch" />Decay Warning
        </span>
        <span className="metl-legend-item">
          <span className="metl-legend-swatch decay-expired-swatch" />Expired
        </span>
      </div>
    </div>
  );
}
