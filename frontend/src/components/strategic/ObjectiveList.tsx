/**
 * ObjectiveList Component
 *
 * Displays a list of strategic objectives for a document.
 * Shows MIDLIFE category badges with color coding, AI/Human badges,
 * and confidence indicators for AI categorizations.
 */

import { useState, useEffect, useCallback } from 'react';
import type { StrategicObjective, MidlifeCategory } from '../../lib/types/strategic.js';
import { MIDLIFE_METADATA } from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';
import './ObjectiveList.css';

interface ObjectiveListProps {
  documentId: string;
  onSelectObjective?: (objective: StrategicObjective) => void;
}

/**
 * Get color for MIDLIFE category
 */
function getMidlifeColor(category: MidlifeCategory | undefined): string {
  if (!category) return '#666678';
  return MIDLIFE_METADATA[category]?.color || '#666678';
}

/**
 * Get label for MIDLIFE category
 */
function getMidlifeLabel(category: MidlifeCategory | undefined): string {
  if (!category) return 'Uncategorized';
  return MIDLIFE_METADATA[category]?.label || category;
}

/**
 * Get confidence level description
 */
function getConfidenceLevel(confidence: number | undefined): { label: string; className: string } {
  if (confidence === undefined) return { label: 'N/A', className: 'confidence-na' };
  if (confidence >= 0.9) return { label: 'High', className: 'confidence-high' };
  if (confidence >= 0.7) return { label: 'Medium', className: 'confidence-medium' };
  return { label: 'Low', className: 'confidence-low' };
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

export function ObjectiveList({ documentId, onSelectObjective }: ObjectiveListProps) {
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadObjectives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await strategicService.getObjectivesForDocument(documentId);
      setObjectives(response.objectives || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objectives');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);

  if (loading) {
    return (
      <div className="objective-list loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <span>Loading objectives...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="objective-list error">
        <div className="error-content">
          <p>{error}</p>
          <button onClick={loadObjectives}>Retry</button>
        </div>
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div className="objective-list empty">
        <div className="empty-content">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p>No objectives extracted yet</p>
          <span>Extract objectives from the document to see them here</span>
        </div>
      </div>
    );
  }

  return (
    <div className="objective-list">
      <div className="list-header">
        <h3>Strategic Objectives</h3>
        <span className="obj-count">{objectives.length} objective{objectives.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="objective-items">
        {objectives.map((obj) => {
          const confidence = getConfidenceLevel(obj.midlifeConfidence);

          return (
            <div
              key={obj.id}
              className="objective-item"
              onClick={() => onSelectObjective?.(obj)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && onSelectObjective?.(obj)}
            >
              {/* MIDLIFE Category Badge */}
              <div
                className="midlife-badge"
                style={{ backgroundColor: `${getMidlifeColor(obj.midlifeCategory)}20`, borderColor: getMidlifeColor(obj.midlifeCategory) }}
              >
                <span style={{ color: getMidlifeColor(obj.midlifeCategory) }}>
                  {getMidlifeLabel(obj.midlifeCategory)}
                </span>
              </div>

              {/* Priority Badge */}
              <div className={`priority-badge ${getPriorityClass(obj.priority)}`}>
                {obj.priority}
              </div>

              {/* Objective Description */}
              <p className="objective-description">{obj.description}</p>

              {/* Footer with metadata */}
              <div className="objective-footer">
                {/* Source Reference */}
                {obj.sourceReference && (
                  <span className="source-ref" title={obj.sourceReference}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                    {obj.sourceReference}
                  </span>
                )}

                {/* Categorization Source */}
                <span className={`categorization-source ${obj.midlifeCategorizedBy === 'HUMAN' ? 'human' : 'ai'}`}>
                  {obj.midlifeCategorizedBy === 'HUMAN' ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Human
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
                        <circle cx="12" cy="5" r="2" />
                        <path d="M12 7v4" />
                        <line x1="8" y1="16" x2="8" y2="16" />
                        <line x1="16" y1="16" x2="16" y2="16" />
                      </svg>
                      AI
                    </>
                  )}
                </span>

                {/* Confidence (for AI categorizations) */}
                {obj.midlifeCategorizedBy === 'AI' && obj.midlifeConfidence !== undefined && (
                  <span className={`confidence-badge ${confidence.className}`} title={`Confidence: ${Math.round(obj.midlifeConfidence * 100)}%`}>
                    {confidence.label} ({Math.round(obj.midlifeConfidence * 100)}%)
                  </span>
                )}

                {/* Human Verified Badge */}
                {obj.humanVerified && (
                  <span className="verified-badge" title="Human Verified">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22,4 12,14.01 9,11.01" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
