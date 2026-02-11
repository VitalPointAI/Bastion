/**
 * AssumptionTracker Component
 *
 * Assumption lifecycle management panel for MDMP planning.
 * Shows all assumptions with sensitivity color coding, status badges, and action buttons.
 */

import { useState, useMemo } from 'react';
import './AssumptionTracker.css';

export interface AssumptionDisplayData {
  id: string;
  description: string;
  sensitivity: string; // 'Critical' | 'High' | 'Medium' | 'Low'
  validationMethod: string;
  acceptedBy?: string;
  status: string; // 'Pending' | 'Accepted' | 'Rejected' | 'Invalidated' | 'Expired'
  sourcePhase: string;
}

interface AssumptionTrackerProps {
  missionId: string;
  assumptions: AssumptionDisplayData[];
  onAccept: (assumptionId: string) => void;
  onReject: (assumptionId: string) => void;
  onInvalidate: (assumptionId: string, evidence: string) => void;
}

export function AssumptionTracker({
  missionId,
  assumptions,
  onAccept,
  onReject,
  onInvalidate,
}: AssumptionTrackerProps) {
  const [sortBy, setSortBy] = useState<'sensitivity' | 'status' | 'phase'>('sensitivity');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSensitivity, setFilterSensitivity] = useState<string>('all');
  const [invalidatingId, setInvalidatingId] = useState<string | null>(null);
  const [invalidationEvidence, setInvalidationEvidence] = useState('');

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = assumptions.length;
    const byStatus = assumptions.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const bySensitivity = assumptions.reduce((acc, a) => {
      acc[a.sensitivity] = (acc[a.sensitivity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, byStatus, bySensitivity };
  }, [assumptions]);

  // Filter and sort assumptions
  const filteredAssumptions = useMemo(() => {
    let filtered = [...assumptions];

    // Apply filters
    if (filterStatus !== 'all') {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }
    if (filterSensitivity !== 'all') {
      filtered = filtered.filter((a) => a.sensitivity === filterSensitivity);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'sensitivity') {
        const sensitivityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return (
          (sensitivityOrder[a.sensitivity as keyof typeof sensitivityOrder] || 999) -
          (sensitivityOrder[b.sensitivity as keyof typeof sensitivityOrder] || 999)
        );
      } else if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      } else if (sortBy === 'phase') {
        return a.sourcePhase.localeCompare(b.sourcePhase);
      }
      return 0;
    });

    return filtered;
  }, [assumptions, filterStatus, filterSensitivity, sortBy]);

  // Sensitivity color mapping
  const getSensitivityClass = (sensitivity: string): string => {
    const map: Record<string, string> = {
      Critical: 'critical',
      High: 'high',
      Medium: 'medium',
      Low: 'low',
    };
    return map[sensitivity] || 'default';
  };

  // Status badge styling
  const getStatusClass = (status: string): string => {
    const map: Record<string, string> = {
      Pending: 'pending',
      Accepted: 'accepted',
      Rejected: 'rejected',
      Invalidated: 'invalidated',
      Expired: 'expired',
    };
    return map[status] || 'default';
  };

  // Handle invalidation submission
  const handleInvalidateSubmit = (assumptionId: string) => {
    if (invalidationEvidence.trim()) {
      onInvalidate(assumptionId, invalidationEvidence);
      setInvalidatingId(null);
      setInvalidationEvidence('');
    }
  };

  return (
    <div className="assumption-tracker">
      <header className="tracker-header">
        <div className="header-content">
          <h2>Assumption Tracker</h2>
          <div className="mission-info">
            <span className="mission-label">Mission:</span>
            <span className="mission-id">{missionId}</span>
          </div>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Assumptions</div>
        </div>
        <div className="stat-card accepted">
          <div className="stat-value">{stats.byStatus.Accepted || 0}</div>
          <div className="stat-label">Accepted</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{stats.byStatus.Pending || 0}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-value">{stats.byStatus.Rejected || 0}</div>
          <div className="stat-label">Rejected</div>
        </div>
        <div className="stat-card invalidated">
          <div className="stat-value">{stats.byStatus.Invalidated || 0}</div>
          <div className="stat-label">Invalidated</div>
        </div>
        <div className="stat-card critical-count">
          <div className="stat-value">{stats.bySensitivity.Critical || 0}</div>
          <div className="stat-label">Critical Sensitivity</div>
        </div>
      </div>

      {/* Controls: Sort and Filter */}
      <div className="tracker-controls">
        <div className="control-group">
          <label htmlFor="sort-by">Sort by:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'sensitivity' | 'status' | 'phase')}
          >
            <option value="sensitivity">Sensitivity</option>
            <option value="status">Status</option>
            <option value="phase">Source Phase</option>
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="filter-status">Status:</label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Invalidated">Invalidated</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="filter-sensitivity">Sensitivity:</label>
          <select
            id="filter-sensitivity"
            value={filterSensitivity}
            onChange={(e) => setFilterSensitivity(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Assumptions List */}
      <div className="assumptions-list">
        {filteredAssumptions.length === 0 ? (
          <div className="no-assumptions">
            <p>No assumptions found for the selected filters.</p>
          </div>
        ) : (
          filteredAssumptions.map((assumption) => (
            <div
              key={assumption.id}
              className={`assumption-card ${getSensitivityClass(assumption.sensitivity)}`}
            >
              <div className="assumption-header">
                <span
                  className={`sensitivity-badge ${getSensitivityClass(assumption.sensitivity)}`}
                >
                  {assumption.sensitivity}
                </span>
                <span className={`status-badge ${getStatusClass(assumption.status)}`}>
                  {assumption.status}
                </span>
              </div>

              <div className="assumption-body">
                <p className="assumption-description">{assumption.description}</p>

                <div className="assumption-meta">
                  <div className="meta-row">
                    <span className="meta-label">Validation Method:</span>
                    <span className="meta-value">{assumption.validationMethod}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Source Phase:</span>
                    <span className="meta-value">{assumption.sourcePhase}</span>
                  </div>
                  {assumption.acceptedBy && (
                    <div className="meta-row">
                      <span className="meta-label">Accepted By:</span>
                      <span className="meta-value">{assumption.acceptedBy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons for pending assumptions */}
              {assumption.status === 'Pending' && (
                <div className="assumption-actions">
                  <button
                    className="action-btn accept"
                    onClick={() => onAccept(assumption.id)}
                    title="Accept this assumption (creates AssumptionAcceptance proposal)"
                  >
                    Accept
                  </button>
                  <button
                    className="action-btn reject"
                    onClick={() => onReject(assumption.id)}
                    title="Reject this assumption"
                  >
                    Reject
                  </button>
                  <button
                    className="action-btn invalidate"
                    onClick={() => setInvalidatingId(assumption.id)}
                    title="Mark as invalidated with evidence"
                  >
                    Invalidate
                  </button>
                </div>
              )}

              {/* Invalidation form */}
              {invalidatingId === assumption.id && (
                <div className="invalidation-form">
                  <label htmlFor={`evidence-${assumption.id}`}>Evidence for Invalidation:</label>
                  <textarea
                    id={`evidence-${assumption.id}`}
                    value={invalidationEvidence}
                    onChange={(e) => setInvalidationEvidence(e.target.value)}
                    placeholder="Provide evidence that this assumption no longer holds..."
                    rows={3}
                  />
                  <div className="invalidation-actions">
                    <button
                      className="submit-btn"
                      onClick={() => handleInvalidateSubmit(assumption.id)}
                      disabled={!invalidationEvidence.trim()}
                    >
                      Submit Invalidation
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setInvalidatingId(null);
                        setInvalidationEvidence('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Invalidate action button for accepted assumptions */}
              {assumption.status === 'Accepted' && invalidatingId !== assumption.id && (
                <div className="assumption-actions">
                  <button
                    className="action-btn invalidate"
                    onClick={() => setInvalidatingId(assumption.id)}
                    title="Mark as invalidated with evidence"
                  >
                    Invalidate
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
