/**
 * ContainerDocumentList Component
 *
 * Shows documents within a selected container.
 * Reuses styling from DocumentList cards with classification badges and agent badges.
 * Document cards are draggable for drag-and-drop reassignment between containers.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { StrategicDocument, DocumentAgentAssignment } from '../../lib/types/strategic.js';
import {
  strategicService,
  getDocumentLevelName,
  getClassificationColor,
  API_BASE,
} from '../../lib/strategic-service.js';
import { AgentBadges } from './AgentBadges.js';
import { AgentAssignmentModal } from './AgentAssignmentModal.js';

interface ExtractionProgress {
  phase: 'chunking' | 'extracting' | 'consolidating' | 'complete';
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  objectivesFound: number;
  latestObjectivePreview?: string;
}

interface ContainerDocumentListProps {
  containerId: string;
  onSelectDocument: (doc: StrategicDocument) => void;
  onBack: () => void;
  containerName: string;
  categoryColor: string;
  userDID?: string;
  onManageAgents?: () => void;
  agentCount?: number;
}

/**
 * Draggable wrapper for a document card.
 */
function DraggableDocumentCard({
  doc,
  containerId,
  onSelectDocument,
  assignments,
  formatDate,
  onAssignAgent,
  onExtract,
  extracting,
  progress,
}: {
  doc: StrategicDocument;
  containerId: string | null;
  onSelectDocument: (doc: StrategicDocument) => void;
  assignments: DocumentAgentAssignment[];
  formatDate: (d: string) => string;
  onAssignAgent: (docId: string) => void;
  onExtract: (doc: StrategicDocument, e: React.MouseEvent) => void;
  extracting: string | null;
  progress: ExtractionProgress | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `doc-${doc.id}`,
    data: {
      type: 'document',
      documentId: doc.id,
      documentTitle: doc.title,
      sourceContainerId: containerId,
    },
  });

  const getPhaseDescription = (phase: ExtractionProgress['phase']): string => {
    switch (phase) {
      case 'chunking': return 'Analyzing document structure...';
      case 'extracting': return 'Extracting objectives with AI...';
      case 'consolidating': return 'Consolidating results...';
      case 'complete': return 'Complete!';
      default: return 'Processing...';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className="document-card"
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'pointer' }}
      onClick={() => onSelectDocument(doc)}
      onKeyPress={(e) => e.key === 'Enter' && onSelectDocument(doc)}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-roledescription="draggable document"
    >
      {/* Drag handle — only this element initiates drag */}
      <div
        className="drag-handle"
        {...listeners}
        style={{ cursor: 'grab', padding: '4px', position: 'absolute', top: 4, right: 4, opacity: 0.5 }}
        title="Drag to move"
        onClick={(e) => e.stopPropagation()}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ width: 14, height: 14 }}>
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Classification badge */}
      <div className={`classification-badge ${getClassificationColor(doc.classification)}`}>
        {doc.classification}
      </div>

      {/* Document level badge */}
      <div className="level-badge">{doc.level}</div>

      {/* Document icon */}
      <div className="doc-icon">
        {doc.mimeType === 'application/pdf' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        )}
      </div>

      {/* Document info */}
      <div className="doc-info">
        <h4 className="doc-title">{doc.title}</h4>
        <p className="doc-level-name">{getDocumentLevelName(doc.level)}</p>

        <div className="doc-meta">
          {doc.pageCount && (
            <span className="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
              {doc.pageCount} pages
            </span>
          )}
          <span className="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            {formatDate(doc.createdAt)}
          </span>
        </div>

        {/* Agent assignments */}
        <div className="doc-agents">
          {assignments.length > 0 && (
            <AgentBadges assignments={assignments} compact />
          )}
          <button
            className="assign-agent-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAssignAgent(doc.id);
            }}
            title="Assign agent or team to analyze this document"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            <span>Assign Agent</span>
          </button>
        </div>
      </div>

      {/* Objectives status */}
      <div className="doc-objectives">
        {extracting === doc.id && progress ? (
          <div className="extraction-progress">
            <div className="progress-header">
              <span className="progress-phase">{getPhaseDescription(progress.phase)}</span>
              <span className="progress-percent">{progress.percentComplete}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
            <div className="progress-details">
              {progress.totalChunks > 0 && (
                <span className="progress-chunks">
                  Chunk {progress.currentChunk} of {progress.totalChunks}
                </span>
              )}
              <span className="progress-found">
                {progress.objectivesFound} objective{progress.objectivesFound !== 1 ? 's' : ''} found
              </span>
            </div>
            {progress.latestObjectivePreview && (
              <div className="progress-preview">
                <span className="preview-label">Latest:</span>
                <span className="preview-text">{progress.latestObjectivePreview}</span>
              </div>
            )}
          </div>
        ) : doc.objectiveCount !== undefined && doc.objectiveCount > 0 ? (
          <div className="objectives-status">
            <div className="objectives-count">
              <span className="count-value">{doc.objectiveCount}</span>
              <span className="count-label">Objectives</span>
            </div>
            <button
              className="re-extract-button"
              onClick={(e) => onExtract(doc, e)}
              disabled={extracting === doc.id}
              title="Re-extract objectives (will replace existing)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,4 23,10 17,10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Re-extract
            </button>
          </div>
        ) : (
          <button
            className="extract-button"
            onClick={(e) => onExtract(doc, e)}
            disabled={extracting === doc.id}
          >
            {extracting === doc.id ? (
              <>
                <span className="extract-spinner" />
                Starting...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                Extract Objectives
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function ContainerDocumentList({
  containerId,
  onSelectDocument,
  onBack,
  containerName,
  categoryColor,
  userDID,
  onManageAgents,
  agentCount,
}: ContainerDocumentListProps) {
  const [documents, setDocuments] = useState<StrategicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, DocumentAgentAssignment[]>>({});
  const [assigningDocId, setAssigningDocId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await strategicService.getContainerDocuments(containerId);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  const loadAssignments = useCallback(
    async (docIds: string[]) => {
      if (!userDID || docIds.length === 0) return;
      try {
        const results: Record<string, DocumentAgentAssignment[]> = {};
        await Promise.all(
          docIds.map(async (docId) => {
            try {
              const response = await fetch(
                `${API_BASE}/api/strategic/documents/${encodeURIComponent(docId)}/assignments`,
                { headers: { 'X-DID': userDID } }
              );
              if (response.ok) {
                const data = await response.json();
                results[docId] = data.assignments || [];
              }
            } catch {
              // Ignore individual failures
            }
          })
        );
        setAssignments(results);
      } catch {
        // Silently fail
      }
    },
    [userDID]
  );

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (documents.length > 0) {
      loadAssignments(documents.map((d) => d.id));
    }
  }, [documents, loadAssignments]);

  const handleExtract = async (doc: StrategicDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (extracting) return;

    setExtracting(doc.id);
    setProgress(null);
    setError(null);

    try {
      if (!userDID) {
        throw new Error('Please log in to extract objectives');
      }

      const url = `${API_BASE}/api/strategic/documents/${doc.id}/extract/stream?did=${encodeURIComponent(userDID)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'X-DID': userDID,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Extraction failed');
        } else {
          const errorText = await response.text();
          throw new Error(errorText || `Extraction failed (${response.status})`);
        }
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEvent === 'progress') {
                setProgress(data as ExtractionProgress);
              } else if (currentEvent === 'complete') {
                setProgress(null);
                await loadDocuments();
              } else if (currentEvent === 'error') {
                throw new Error(data.error || 'Extraction failed');
              }
            } catch (parseErr) {
              console.error('Failed to parse SSE data:', parseErr);
            }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setProgress(null);
    } finally {
      setExtracting(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container-document-list">
      {/* Back button */}
      <button className="back-button" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12,19 5,12 12,5" />
        </svg>
        Back to Containers
      </button>

      {/* Container header */}
      <div className="container-doc-header" style={{ borderLeftColor: categoryColor }}>
        <div className="container-doc-header-info">
          <h3>{containerName}</h3>
          {!loading && (
            <span className="doc-count">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {onManageAgents && (
          <button className="manage-agents-btn" onClick={onManageAgents}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v10M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M1 12h6m6 0h10M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
            </svg>
            Manage Agents
            {agentCount !== undefined && agentCount > 0 && (
              <span className="agent-count-pill">{agentCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="document-list loading">
          <div className="loading-content">
            <div className="loading-spinner" />
            <span>Loading documents...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="document-list error">
          <div className="error-content">
            <p>{error}</p>
            <button onClick={loadDocuments}>Retry</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && documents.length === 0 && (
        <div className="document-list empty">
          <div className="empty-content">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
            </div>
            <p>No documents in this container yet</p>
            <span>Upload documents or drag them here</span>
          </div>
        </div>
      )}

      {/* Document grid */}
      {!loading && !error && documents.length > 0 && (
        <div className="document-grid">
          {documents.map((doc) => (
            <DraggableDocumentCard
              key={doc.id}
              doc={doc}
              containerId={containerId}
              onSelectDocument={onSelectDocument}
              assignments={assignments[doc.id] || []}
              formatDate={formatDate}
              onAssignAgent={(docId) => setAssigningDocId(docId)}
              onExtract={handleExtract}
              extracting={extracting}
              progress={progress}
            />
          ))}
        </div>
      )}

      {/* Agent Assignment Modal */}
      {assigningDocId && userDID && (
        <AgentAssignmentModal
          documentId={assigningDocId}
          userDID={userDID}
          onClose={() => setAssigningDocId(null)}
          onAssigned={() => {
            setAssigningDocId(null);
            loadAssignments([assigningDocId]);
          }}
        />
      )}
    </div>
  );
}
