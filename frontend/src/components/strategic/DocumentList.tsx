/**
 * DocumentList Component
 *
 * Displays a grid of uploaded strategic documents.
 * Shows document metadata, classification, and extraction status.
 * Uses SSE streaming for real-time extraction progress.
 */

import { useState, useEffect, useCallback } from 'react';
import type { StrategicDocument, DocumentAgentAssignment } from '../../lib/types/strategic.js';
import {
  strategicService,
  getDocumentLevelName,
  getClassificationColor,
  API_BASE,
} from '../../lib/strategic-service.js';
import { useUser } from '../../context/UserContext.js';
import { AgentBadges } from './AgentBadges.js';
import { AgentAssignmentModal } from './AgentAssignmentModal.js';
import { ExtractionTheater } from './ExtractionTheater.js';
import './DocumentList.css';

interface DocumentListProps {
  onSelectDocument?: (doc: StrategicDocument) => void;
  onExtractObjectives?: (doc: StrategicDocument) => void;
  refreshTrigger?: number;
  userDID?: string;
  problemSetId?: string;
}

export function DocumentList({
  onSelectDocument,
  onExtractObjectives,
  refreshTrigger,
  userDID: propUserDID,
  problemSetId,
}: DocumentListProps) {
  // Prefer prop DID (from parent component), fall back to context
  const contextUser = useUser();
  const userDID = propUserDID || contextUser.userDID;
  const [documents, setDocuments] = useState<StrategicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, DocumentAgentAssignment[]>>({});
  const [assigningDocId, setAssigningDocId] = useState<string | null>(null);
  const [theaterDoc, setTheaterDoc] = useState<StrategicDocument | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await strategicService.getDocuments(problemSetId);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  const loadAssignments = useCallback(async (docIds: string[]) => {
    if (!userDID || docIds.length === 0) return;

    try {
      const results: Record<string, DocumentAgentAssignment[]> = {};
      await Promise.all(
        docIds.map(async (docId) => {
          try {
            const response = await fetch(
              `${API_BASE}/api/strategic/documents/${encodeURIComponent(docId)}/assignments`,
              {
                headers: { 'X-DID': userDID },
              }
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
      // Silently fail - assignments are optional
    }
  }, [userDID]);

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger, loadDocuments]);

  useEffect(() => {
    if (documents.length > 0) {
      loadAssignments(documents.map(d => d.id));
    }
  }, [documents, loadAssignments]);

  /**
   * Open the ExtractionTheater for full visualization
   */
  const handleExtract = (doc: StrategicDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userDID) {
      setError('Please log in to extract objectives');
      return;
    }
    setTheaterDoc(doc);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && documents.length === 0) {
    return (
      <div className="document-list loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <span>Loading documents...</span>
        </div>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="document-list error">
        <div className="error-content">
          <p>{error}</p>
          <button onClick={loadDocuments}>Retry</button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="document-list empty">
        <div className="empty-content">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
          </div>
          <p>No documents uploaded yet</p>
          <span>Upload a strategic document to get started</span>
        </div>
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="list-header">
        <h3>Strategic Documents</h3>
        <span className="doc-count">{documents.length} documents</span>
      </div>

      {error && (
        <div className="list-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      <div className="document-grid">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="document-card"
            onClick={() => onSelectDocument?.(doc)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && onSelectDocument?.(doc)}
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
                {(assignments[doc.id] || []).length > 0 ? (
                  <AgentBadges assignments={assignments[doc.id] || []} />
                ) : null}
                <button
                  className="assign-agent-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssigningDocId(doc.id);
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
              {doc.objectiveCount !== undefined && doc.objectiveCount > 0 ? (
                <div className="objectives-status">
                  <div className="objectives-count">
                    <span className="count-value">{doc.objectiveCount}</span>
                    <span className="count-label">Objectives</span>
                  </div>
                  <button
                    className="re-extract-button"
                    onClick={(e) => handleExtract(doc, e)}
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
                  onClick={(e) => handleExtract(doc, e)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  Extract Objectives
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

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

      {/* Extraction Theater — full-screen extraction + live graph */}
      {theaterDoc && userDID && problemSetId && (
        <ExtractionTheater
          documentId={theaterDoc.id}
          documentTitle={theaterDoc.title}
          problemSetId={problemSetId}
          userDID={userDID}
          onClose={() => setTheaterDoc(null)}
          onComplete={() => {
            loadDocuments();
            onExtractObjectives?.(theaterDoc);
          }}
        />
      )}
    </div>
  );
}
