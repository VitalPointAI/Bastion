/**
 * ObjectiveDetail Component
 *
 * Panel for viewing and editing a single strategic objective.
 * Shows full description, Ends/Ways/Means breakdown, source reference,
 * editable MIDLIFE category dropdown, constraints and assumptions,
 * and a save button for updates.
 *
 * Phase 4-10: Full edit mode for all fields (description, status, priority,
 * constraints, assumptions, risks, MIDLIFE category).
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  StrategicObjective,
  MidlifeCategory,
  ObjectiveEnds,
  ObjectiveWays,
  ObjectiveMeans,
  ObjectiveStatus,
  Priority,
} from '../../lib/types/strategic.js';
import { MIDLIFE_METADATA, ObjectiveStatus as StatusValues, Priority as PriorityValues } from '../../lib/types/strategic.js';
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

  // Edited values - all editable fields
  const [editedDescription, setEditedDescription] = useState('');
  const [editedCategory, setEditedCategory] = useState<MidlifeCategory | undefined>(undefined);
  const [editedStatus, setEditedStatus] = useState<ObjectiveStatus>('DRAFT');
  const [editedPriority, setEditedPriority] = useState<Priority>('MEDIUM');
  const [editedConstraints, setEditedConstraints] = useState<string[]>([]);
  const [editedAssumptions, setEditedAssumptions] = useState<string[]>([]);
  const [editedRisks, setEditedRisks] = useState<string[]>([]);

  // Ends-Ways-Means editing
  const [editedEnds, setEditedEnds] = useState<ObjectiveEnds>({ description: '', conditions: [] });
  const [editedWays, setEditedWays] = useState<ObjectiveWays>({ strategies: [], concepts: [], keyTasks: [] });
  const [editedMeans, setEditedMeans] = useState<ObjectiveMeans>({ forces: [], capabilities: [], resources: [] });

  const loadObjective = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const obj = await strategicService.getObjective(objectiveId);
      setObjective(obj);
      // Initialize all editable fields
      setEditedDescription(obj.description);
      setEditedCategory(obj.midlifeCategory);
      setEditedStatus(obj.status);
      setEditedPriority(obj.priority);
      setEditedConstraints(obj.constraints || []);
      setEditedAssumptions(obj.assumptions || []);
      setEditedRisks(obj.risks || []);
      // Initialize EWM
      const ewmData = getEndsWaysMeans(obj);
      if (ewmData) {
        setEditedEnds({ ...ewmData.ends });
        setEditedWays({ ...ewmData.ways });
        setEditedMeans({ ...ewmData.means });
      }
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
      const updates: Record<string, unknown> = {};

      // Only include changed fields
      if (editedDescription !== objective.description) {
        updates.description = editedDescription;
      }
      if (editedCategory !== objective.midlifeCategory) {
        updates.midlifeCategory = editedCategory;
      }
      if (editedStatus !== objective.status) {
        updates.status = editedStatus;
      }
      if (editedPriority !== objective.priority) {
        updates.priority = editedPriority;
      }
      if (JSON.stringify(editedConstraints) !== JSON.stringify(objective.constraints || [])) {
        updates.constraints = editedConstraints;
      }
      if (JSON.stringify(editedAssumptions) !== JSON.stringify(objective.assumptions || [])) {
        updates.assumptions = editedAssumptions;
      }
      if (JSON.stringify(editedRisks) !== JSON.stringify(objective.risks || [])) {
        updates.risks = editedRisks;
      }

      // Check EWM changes
      const currentEwm = getEndsWaysMeans(objective);
      if (currentEwm) {
        const endsChanged = JSON.stringify(editedEnds) !== JSON.stringify(currentEwm.ends);
        const waysChanged = JSON.stringify(editedWays) !== JSON.stringify(currentEwm.ways);
        const meansChanged = JSON.stringify(editedMeans) !== JSON.stringify(currentEwm.means);
        if (endsChanged || waysChanged || meansChanged) {
          updates.endsWaysMeans = {
            ends: editedEnds,
            ways: editedWays,
            means: editedMeans,
          };
        }
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
      // Reset all fields to original values
      setEditedDescription(objective.description);
      setEditedCategory(objective.midlifeCategory);
      setEditedStatus(objective.status);
      setEditedPriority(objective.priority);
      setEditedConstraints(objective.constraints || []);
      setEditedAssumptions(objective.assumptions || []);
      setEditedRisks(objective.risks || []);
      // Reset EWM
      const ewmData = getEndsWaysMeans(objective);
      if (ewmData) {
        setEditedEnds({ ...ewmData.ends });
        setEditedWays({ ...ewmData.ways });
        setEditedMeans({ ...ewmData.means });
      }
    }
    setEditMode(false);
  };

  // List editing helpers
  const handleAddItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList([...list, '']);
  };

  const handleUpdateItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    const newList = [...list];
    newList[index] = value;
    setList(newList);
  };

  const handleRemoveItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    setList(list.filter((_, i) => i !== index));
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
          {editMode ? (
            <>
              <select
                className="status-select"
                value={editedStatus}
                onChange={(e) => setEditedStatus(e.target.value as ObjectiveStatus)}
              >
                {Object.values(StatusValues).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="priority-select"
                value={editedPriority}
                onChange={(e) => setEditedPriority(e.target.value as Priority)}
              >
                {Object.values(PriorityValues).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span className={`status-badge ${getStatusClass(objective.status)}`}>
                {objective.status}
              </span>
              <span className={`priority-badge ${getPriorityClass(objective.priority)}`}>
                {objective.priority}
              </span>
            </>
          )}
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
        {editMode ? (
          <textarea
            className="description-editor"
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            rows={4}
            placeholder="Enter objective description..."
          />
        ) : (
          <p className="full-description">{objective.description}</p>
        )}
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
                backgroundColor: objective.midlifeCategory
                  ? `${MIDLIFE_METADATA[objective.midlifeCategory]?.color || '#666'}20`
                  : '#66667820',
                borderColor: objective.midlifeCategory
                  ? MIDLIFE_METADATA[objective.midlifeCategory]?.color || '#666'
                  : '#666678',
              }}
            >
              <span style={{ color: objective.midlifeCategory
                ? MIDLIFE_METADATA[objective.midlifeCategory]?.color || '#666'
                : '#666678'
              }}>
                {objective.midlifeCategory
                  ? MIDLIFE_METADATA[objective.midlifeCategory]?.label || objective.midlifeCategory
                  : 'Uncategorized'}
              </span>
            </div>
            <p className="category-description">
              {objective.midlifeCategory
                ? MIDLIFE_METADATA[objective.midlifeCategory]?.description || ''
                : 'No MIDLIFE category assigned. Use Edit mode to assign a category.'}
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
      {(ewm || editMode) && (
        <section className="detail-section ewm-section">
          <h3>Ends-Ways-Means Analysis</h3>

          {/* ENDS */}
          <div className="ewm-block">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2 2 4-4" />
              </svg>
              Ends (Desired Outcome)
            </h4>
            {editMode ? (
              <>
                <textarea
                  className="ewm-description-editor"
                  value={editedEnds.description}
                  onChange={(e) => setEditedEnds({ ...editedEnds, description: e.target.value })}
                  placeholder="Describe the desired end state..."
                  rows={2}
                />
                <div className="ewm-editable-list">
                  <span className="list-label">Conditions for success:</span>
                  {editedEnds.conditions.map((c, i) => (
                    <div key={i} className="editable-list-item">
                      <input
                        type="text"
                        value={c}
                        onChange={(e) => {
                          const newConditions = [...editedEnds.conditions];
                          newConditions[i] = e.target.value;
                          setEditedEnds({ ...editedEnds, conditions: newConditions });
                        }}
                        placeholder="Condition..."
                      />
                      <button
                        className="remove-item-btn"
                        onClick={() => setEditedEnds({ ...editedEnds, conditions: editedEnds.conditions.filter((_, idx) => idx !== i) })}
                        title="Remove"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-item-btn" onClick={() => setEditedEnds({ ...editedEnds, conditions: [...editedEnds.conditions, ''] })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Condition
                  </button>
                </div>
                <div className="ewm-timeframe-edit">
                  <span className="list-label">Timeframe:</span>
                  <input
                    type="text"
                    value={editedEnds.timeframe || ''}
                    onChange={(e) => setEditedEnds({ ...editedEnds, timeframe: e.target.value || undefined })}
                    placeholder="When should this be achieved?"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="ewm-description">{ewm?.ends.description}</p>
                {ewm?.ends.conditions && ewm.ends.conditions.length > 0 && (
                  <div className="ewm-list">
                    <span className="list-label">Conditions for success:</span>
                    <ul>{ewm.ends.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                )}
                {ewm?.ends.timeframe && (
                  <div className="ewm-timeframe">
                    <span className="list-label">Timeframe:</span> {ewm.ends.timeframe}
                  </div>
                )}
              </>
            )}
          </div>

          {/* WAYS */}
          <div className="ewm-block">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
              Ways (Approach)
            </h4>
            {editMode ? (
              <>
                {/* Strategies */}
                <div className="ewm-editable-list">
                  <span className="list-label">Strategies:</span>
                  {editedWays.strategies.map((s, i) => (
                    <div key={i} className="editable-list-item">
                      <input
                        type="text"
                        value={s}
                        onChange={(e) => {
                          const newStrategies = [...editedWays.strategies];
                          newStrategies[i] = e.target.value;
                          setEditedWays({ ...editedWays, strategies: newStrategies });
                        }}
                        placeholder="Strategy..."
                      />
                      <button className="remove-item-btn" onClick={() => setEditedWays({ ...editedWays, strategies: editedWays.strategies.filter((_, idx) => idx !== i) })} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-item-btn" onClick={() => setEditedWays({ ...editedWays, strategies: [...editedWays.strategies, ''] })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Strategy
                  </button>
                </div>
                {/* Concepts */}
                <div className="ewm-editable-list">
                  <span className="list-label">Concepts:</span>
                  {editedWays.concepts.map((c, i) => (
                    <div key={i} className="editable-list-item">
                      <input
                        type="text"
                        value={c}
                        onChange={(e) => {
                          const newConcepts = [...editedWays.concepts];
                          newConcepts[i] = e.target.value;
                          setEditedWays({ ...editedWays, concepts: newConcepts });
                        }}
                        placeholder="Concept..."
                      />
                      <button className="remove-item-btn" onClick={() => setEditedWays({ ...editedWays, concepts: editedWays.concepts.filter((_, idx) => idx !== i) })} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-item-btn" onClick={() => setEditedWays({ ...editedWays, concepts: [...editedWays.concepts, ''] })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Concept
                  </button>
                </div>
                {/* Key Tasks */}
                <div className="ewm-editable-list">
                  <span className="list-label">Key Tasks:</span>
                  {editedWays.keyTasks.map((t, i) => (
                    <div key={i} className="editable-list-item">
                      <input
                        type="text"
                        value={t}
                        onChange={(e) => {
                          const newTasks = [...editedWays.keyTasks];
                          newTasks[i] = e.target.value;
                          setEditedWays({ ...editedWays, keyTasks: newTasks });
                        }}
                        placeholder="Key task..."
                      />
                      <button className="remove-item-btn" onClick={() => setEditedWays({ ...editedWays, keyTasks: editedWays.keyTasks.filter((_, idx) => idx !== i) })} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-item-btn" onClick={() => setEditedWays({ ...editedWays, keyTasks: [...editedWays.keyTasks, ''] })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Key Task
                  </button>
                </div>
              </>
            ) : (
              <>
                {ewm?.ways.strategies && ewm.ways.strategies.length > 0 && (
                  <div className="ewm-list"><span className="list-label">Strategies:</span><ul>{ewm.ways.strategies.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                )}
                {ewm?.ways.concepts && ewm.ways.concepts.length > 0 && (
                  <div className="ewm-list"><span className="list-label">Concepts:</span><ul>{ewm.ways.concepts.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                )}
                {ewm?.ways.keyTasks && ewm.ways.keyTasks.length > 0 && (
                  <div className="ewm-list"><span className="list-label">Key Tasks:</span><ul>{ewm.ways.keyTasks.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                )}
              </>
            )}
          </div>

          {/* MEANS */}
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
            {editMode ? (
              <>
                {/* Forces */}
                <div className="ewm-editable-list">
                  <span className="list-label">Forces:</span>
                  {editedMeans.forces.map((f, i) => (
                    <div key={i} className="editable-list-item">
                      <input
                        type="text"
                        value={f}
                        onChange={(e) => {
                          const newForces = [...editedMeans.forces];
                          newForces[i] = e.target.value;
                          setEditedMeans({ ...editedMeans, forces: newForces });
                        }}
                        placeholder="Force..."
                      />
                      <button className="remove-item-btn" onClick={() => setEditedMeans({ ...editedMeans, forces: editedMeans.forces.filter((_, idx) => idx !== i) })} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-item-btn" onClick={() => setEditedMeans({ ...editedMeans, forces: [...editedMeans.forces, ''] })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Force
                  </button>
                </div>
                {/* Capabilities */}
                <div className="ewm-editable-list">
                  <span className="list-label">Capabilities:</span>
                  {editedMeans.capabilities.map((c, i) => (
                    <div key={i} className="editable-list-item">
                      <input
                        type="text"
                        value={c}
                        onChange={(e) => {
                          const newCapabilities = [...editedMeans.capabilities];
                          newCapabilities[i] = e.target.value;
                          setEditedMeans({ ...editedMeans, capabilities: newCapabilities });
                        }}
                        placeholder="Capability..."
                      />
                      <button className="remove-item-btn" onClick={() => setEditedMeans({ ...editedMeans, capabilities: editedMeans.capabilities.filter((_, idx) => idx !== i) })} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-item-btn" onClick={() => setEditedMeans({ ...editedMeans, capabilities: [...editedMeans.capabilities, ''] })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Capability
                  </button>
                </div>
                {/* Resources */}
                <div className="ewm-editable-list">
                  <span className="list-label">Resources:</span>
                  {editedMeans.resources.map((r, i) => (
                    <div key={i} className="editable-list-item">
                      <input
                        type="text"
                        value={r}
                        onChange={(e) => {
                          const newResources = [...editedMeans.resources];
                          newResources[i] = e.target.value;
                          setEditedMeans({ ...editedMeans, resources: newResources });
                        }}
                        placeholder="Resource..."
                      />
                      <button className="remove-item-btn" onClick={() => setEditedMeans({ ...editedMeans, resources: editedMeans.resources.filter((_, idx) => idx !== i) })} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-item-btn" onClick={() => setEditedMeans({ ...editedMeans, resources: [...editedMeans.resources, ''] })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Resource
                  </button>
                </div>
              </>
            ) : (
              <>
                {ewm?.means.forces && ewm.means.forces.length > 0 && (
                  <div className="ewm-list"><span className="list-label">Forces:</span><ul>{ewm.means.forces.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                )}
                {ewm?.means.capabilities && ewm.means.capabilities.length > 0 && (
                  <div className="ewm-list"><span className="list-label">Capabilities:</span><ul>{ewm.means.capabilities.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                )}
                {ewm?.means.resources && ewm.means.resources.length > 0 && (
                  <div className="ewm-list"><span className="list-label">Resources:</span><ul>{ewm.means.resources.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Constraints */}
      <section className="detail-section">
        <h3>Constraints</h3>
        {editMode ? (
          <div className="editable-list">
            {editedConstraints.map((c, i) => (
              <div key={i} className="editable-list-item">
                <input
                  type="text"
                  value={c}
                  onChange={(e) => handleUpdateItem(editedConstraints, setEditedConstraints, i, e.target.value)}
                  placeholder="Enter constraint..."
                />
                <button
                  className="remove-item-btn"
                  onClick={() => handleRemoveItem(editedConstraints, setEditedConstraints, i)}
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="add-item-btn"
              onClick={() => handleAddItem(editedConstraints, setEditedConstraints)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Constraint
            </button>
          </div>
        ) : objective.constraints && objective.constraints.length > 0 ? (
          <ul className="constraint-list">
            {objective.constraints.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        ) : (
          <p className="empty-list">No constraints defined</p>
        )}
      </section>

      {/* Assumptions */}
      <section className="detail-section">
        <h3>Assumptions</h3>
        {editMode ? (
          <div className="editable-list">
            {editedAssumptions.map((a, i) => (
              <div key={i} className="editable-list-item">
                <input
                  type="text"
                  value={a}
                  onChange={(e) => handleUpdateItem(editedAssumptions, setEditedAssumptions, i, e.target.value)}
                  placeholder="Enter assumption..."
                />
                <button
                  className="remove-item-btn"
                  onClick={() => handleRemoveItem(editedAssumptions, setEditedAssumptions, i)}
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="add-item-btn"
              onClick={() => handleAddItem(editedAssumptions, setEditedAssumptions)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Assumption
            </button>
          </div>
        ) : objective.assumptions && objective.assumptions.length > 0 ? (
          <ul className="assumption-list">
            {objective.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        ) : (
          <p className="empty-list">No assumptions defined</p>
        )}
      </section>

      {/* Risks */}
      <section className="detail-section">
        <h3>Risks</h3>
        {editMode ? (
          <div className="editable-list">
            {editedRisks.map((r, i) => (
              <div key={i} className="editable-list-item">
                <input
                  type="text"
                  value={r}
                  onChange={(e) => handleUpdateItem(editedRisks, setEditedRisks, i, e.target.value)}
                  placeholder="Enter risk..."
                />
                <button
                  className="remove-item-btn"
                  onClick={() => handleRemoveItem(editedRisks, setEditedRisks, i)}
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="add-item-btn"
              onClick={() => handleAddItem(editedRisks, setEditedRisks)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Risk
            </button>
          </div>
        ) : objective.risks && objective.risks.length > 0 ? (
          <ul className="risk-list">
            {objective.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : (
          <p className="empty-list">No risks identified</p>
        )}
      </section>

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
