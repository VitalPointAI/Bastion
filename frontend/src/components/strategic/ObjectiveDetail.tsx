/**
 * ObjectiveDetail Component
 *
 * Panel for viewing and editing a single strategic objective.
 * Shows full description, Ends/Ways/Means breakdown, source reference,
 * editable MIDLIFE category dropdown, constraints and assumptions,
 * and a save button for updates.
 */

import { useState, useEffect, useCallback } from 'react';
import type { StrategicObjective, MidlifeCategory, ObjectiveEnds, ObjectiveWays, ObjectiveMeans } from '../../lib/types/strategic.js';
import { MIDLIFE_METADATA } from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';
import { MidlifeCategorySelector } from './MidlifeCategorySelector.js';
import './ObjectiveDetail.css';

interface ObjectiveDetailProps {
  objectiveId: string;
  onClose?: () => void;
  onSave?: (objective: StrategicObjective) => void;
}

/**
 * Get Ends/Ways/Means from objective (handles both nested and flat structures)
 */
function getEndsWaysMeans(obj: StrategicObjective): { ends: ObjectiveEnds; ways: ObjectiveWays; means: ObjectiveMeans } | null {
  if (obj.endsWaysMeans) {
    return obj.endsWaysMeans;
  }
  if (obj.ends && obj.ways && obj.means) {
    return { ends: obj.ends, ways: obj.ways, means: obj.means };
  }
  return null;
}

/**
 * Get priority badge color class
 */
function getPriorityClass(priority: string): string {
  switch (priority) {
    case 'CRITICAL': return 'priority-critical';
    case 'HIGH': return 'priority-high';
    case 'MEDIUM': return 'priority-medium';
    case 'LOW': return 'priority-low';
    default: return 'priority-medium';
  }
}

/**
 * Get status badge color class
 */
function getStatusClass(status: string): string {
  switch (status) {
    case 'APPROVED':
    case 'OPERATIONALIZED':
      return 'status-approved';
    case 'REJECTED':
      return 'status-rejected';
    case 'UNDER_REVIEW':
    case 'SUBMITTED':
      return 'status-pending';
    case 'DRAFT':
    default:
      return 'status-draft';
  }
}

export function ObjectiveDetail({ objectiveId, onClose, onSave }: ObjectiveDetailProps) {
  const [objective, setObjective] = useState<StrategicObjective | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edited values
  const [editedCategory, setEditedCategory] = useState<MidlifeCategory | undefined>(undefined);

  const loadObjective = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const obj = await strategicService.getObjective(objectiveId);
      setObjective(obj);
      setEditedCategory(obj.midlifeCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objective');
    } finally {
      setLoading(false);
    }
  }, [objectiveId]);

  useEffect(() => {
    loadObjective();
  }, [loadObjective]);

  const handleSave = async () => {
    if (!objective) return;

    setSaving(true);
    setError(null);

    try {
      const updates: Partial<StrategicObjective> = {};

      // Only include changed fields
      if (editedCategory !== objective.midlifeCategory) {
        updates.midlifeCategory = editedCategory;
      }

      // Call the API with PUT method
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/strategic/objectives/${encodeURIComponent(objectiveId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': strategicService['userDID'] || '',
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const updatedObjective = await response.json();
      setObjective(updatedObjective);
      setEditMode(false);
      onSave?.(updatedObjective);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (objective) {
      setEditedCategory(objective.midlifeCategory);
    }
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="objective-detail loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <span>Loading objective...</span>
        </div>
      </div>
    );
  }

  if (error && !objective) {
    return (
      <div className="objective-detail error">
        <div className="error-content">
          <p>{error}</p>
          <button onClick={loadObjective}>Retry</button>
        </div>
      </div>
    );
  }

  if (!objective) {
    return (
      <div className="objective-detail error">
        <div className="error-content">
          <p>Objective not found</p>
          <button onClick={onClose}>Go Back</button>
        </div>
      </div>
    );
  }

  const ewm = getEndsWaysMeans(objective);

  return (
    <div className="objective-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="back-button" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12,19 5,12 12,5" />
          </svg>
          Back
        </button>
        <div className="header-badges">
          <span className={`status-badge ${getStatusClass(objective.status)}`}>
            {objective.status}
          </span>
          <span className={`priority-badge ${getPriorityClass(objective.priority)}`}>
            {objective.priority}
          </span>
        </div>
        <div className="header-actions">
          {!editMode ? (
            <button className="edit-button" onClick={() => setEditMode(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          ) : (
            <>
              <button className="cancel-button" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button className="save-button" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <span className="button-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17,21 17,13 7,13 7,21" />
                      <polyline points="7,3 7,8 15,8" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Description */}
      <section className="detail-section">
        <h3>Description</h3>
        <p className="full-description">{objective.description}</p>
      </section>

      {/* Source Reference */}
      {objective.sourceReference && (
        <section className="detail-section source-section">
          <h3>Source Reference</h3>
          <p className="source-reference">{objective.sourceReference}</p>
        </section>
      )}

      {/* MIDLIFE Category */}
      <section className="detail-section category-section">
        <h3>MIDLIFE Category</h3>
        {editMode ? (
          <MidlifeCategorySelector
            value={editedCategory}
            onChange={setEditedCategory}
            currentCategorizedBy={objective.midlifeCategorizedBy}
          />
        ) : (
          <div className="category-display">
            <div
              className="midlife-badge large"
              style={{
                backgroundColor: `${MIDLIFE_METADATA[objective.midlifeCategory || 'MILITARY']?.color || '#666'}20`,
                borderColor: MIDLIFE_METADATA[objective.midlifeCategory || 'MILITARY']?.color || '#666',
              }}
            >
              <span style={{ color: MIDLIFE_METADATA[objective.midlifeCategory || 'MILITARY']?.color || '#666' }}>
                {MIDLIFE_METADATA[objective.midlifeCategory || 'MILITARY']?.label || 'Unknown'}
              </span>
            </div>
            <p className="category-description">
              {MIDLIFE_METADATA[objective.midlifeCategory || 'MILITARY']?.description || ''}
            </p>
            <div className="category-meta">
              <span className={`categorized-by ${objective.midlifeCategorizedBy === 'HUMAN' ? 'human' : 'ai'}`}>
                Categorized by: {objective.midlifeCategorizedBy || 'AI'}
              </span>
              {objective.midlifeConfidence !== undefined && (
                <span className="confidence">
                  Confidence: {Math.round(objective.midlifeConfidence * 100)}%
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Ends-Ways-Means */}
      {ewm && (
        <section className="detail-section ewm-section">
          <h3>Ends-Ways-Means Analysis</h3>

          <div className="ewm-block">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2 2 4-4" />
              </svg>
              Ends (Desired Outcome)
            </h4>
            <p className="ewm-description">{ewm.ends.description}</p>
            {ewm.ends.conditions && ewm.ends.conditions.length > 0 && (
              <div className="ewm-list">
                <span className="list-label">Conditions for success:</span>
                <ul>
                  {ewm.ends.conditions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {ewm.ends.timeframe && (
              <div className="ewm-timeframe">
                <span className="list-label">Timeframe:</span> {ewm.ends.timeframe}
              </div>
            )}
          </div>

          <div className="ewm-block">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
              Ways (Approach)
            </h4>
            {ewm.ways.strategies && ewm.ways.strategies.length > 0 && (
              <div className="ewm-list">
                <span className="list-label">Strategies:</span>
                <ul>
                  {ewm.ways.strategies.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {ewm.ways.concepts && ewm.ways.concepts.length > 0 && (
              <div className="ewm-list">
                <span className="list-label">Concepts:</span>
                <ul>
                  {ewm.ways.concepts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {ewm.ways.keyTasks && ewm.ways.keyTasks.length > 0 && (
              <div className="ewm-list">
                <span className="list-label">Key Tasks:</span>
                <ul>
                  {ewm.ways.keyTasks.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="ewm-block">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16,8 20,8 23,11 23,16 16,16" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              Means (Resources)
            </h4>
            {ewm.means.forces && ewm.means.forces.length > 0 && (
              <div className="ewm-list">
                <span className="list-label">Forces:</span>
                <ul>
                  {ewm.means.forces.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
            {ewm.means.capabilities && ewm.means.capabilities.length > 0 && (
              <div className="ewm-list">
                <span className="list-label">Capabilities:</span>
                <ul>
                  {ewm.means.capabilities.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {ewm.means.resources && ewm.means.resources.length > 0 && (
              <div className="ewm-list">
                <span className="list-label">Resources:</span>
                <ul>
                  {ewm.means.resources.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Constraints */}
      {objective.constraints && objective.constraints.length > 0 && (
        <section className="detail-section">
          <h3>Constraints</h3>
          <ul className="constraint-list">
            {objective.constraints.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </section>
      )}

      {/* Assumptions */}
      {objective.assumptions && objective.assumptions.length > 0 && (
        <section className="detail-section">
          <h3>Assumptions</h3>
          <ul className="assumption-list">
            {objective.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </section>
      )}

      {/* Risks */}
      {objective.risks && objective.risks.length > 0 && (
        <section className="detail-section">
          <h3>Risks</h3>
          <ul className="risk-list">
            {objective.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      {/* Metadata Footer */}
      <section className="detail-footer">
        <div className="footer-meta">
          <span>ID: {objective.id}</span>
          {objective.humanVerified && (
            <span className="verified-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
              Human Verified
            </span>
          )}
        </div>
        {objective.createdAt && (
          <span className="timestamp">
            Created: {new Date(objective.createdAt).toLocaleDateString()}
          </span>
        )}
      </section>
    </div>
  );
}
