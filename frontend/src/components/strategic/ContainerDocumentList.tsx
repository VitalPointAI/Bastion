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
}: {
  doc: StrategicDocument;
  containerId: string | null;
  onSelectDocument: (doc: StrategicDocument) => void;
  assignments: DocumentAgentAssignment[];
  formatDate: (d: string) => string;
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

  return (
    <div
      ref={setNodeRef}
      className="document-card"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onSelectDocument(doc)}
      onKeyPress={(e) => e.key === 'Enter' && onSelectDocument(doc)}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-roledescription="draggable document"
    >
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
          <AgentBadges assignments={assignments} compact />
        </div>
      </div>

      {/* Objectives count */}
      {doc.objectiveCount !== undefined && doc.objectiveCount > 0 && (
        <div className="doc-objectives">
          <div className="objectives-status">
            <div className="objectives-count">
              <span className="count-value">{doc.objectiveCount}</span>
              <span className="count-label">Objectives</span>
            </div>
          </div>
        </div>
      )}
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
