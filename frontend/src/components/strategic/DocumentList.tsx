/**
 * DocumentList Component
 *
 * Displays a grid of uploaded strategic documents.
 * Shows document metadata, classification, and extraction status.
 * Uses SSE streaming for real-time extraction progress.
 */

import { useState, useEffect, useCallback } from 'react';
import type { StrategicDocument } from '../../lib/types/strategic.js';
import {
  strategicService,
  getDocumentLevelName,
  getClassificationColor,
} from '../../lib/strategic-service.js';
import './DocumentList.css';

/**
 * Extraction progress state from SSE stream
 */
interface ExtractionProgress {
  phase: 'chunking' | 'extracting' | 'consolidating' | 'complete';
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  objectivesFound: number;
  latestObjectivePreview?: string;
  chunkSummary?: string;
}

interface DocumentListProps {
  onSelectDocument?: (doc: StrategicDocument) => void;
  onExtractObjectives?: (doc: StrategicDocument) => void;
  refreshTrigger?: number;
}

export function DocumentList({
  onSelectDocument,
  onExtractObjectives,
  refreshTrigger,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<StrategicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await strategicService.getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger, loadDocuments]);

  /**
   * Handle extraction with SSE streaming for progress updates
   */
  const handleExtract = async (doc: StrategicDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (extracting) return;

    setExtracting(doc.id);
    setProgress(null);
    setError(null);

    try {
      // Use EventSource for SSE streaming
      const userDID = localStorage.getItem('userDID') || '';
      const url = `/api/strategic/documents/${doc.id}/extract/stream`;

      const eventSource = new EventSource(url, {
        // Note: EventSource doesn't support custom headers
        // The backend will get auth from cookies/session
      });

      // For auth, we need to make a fetch request with credentials instead
      // EventSource doesn't support custom headers, so we'll use fetch with ReadableStream
      eventSource.close(); // Close the basic EventSource

      // Use fetch with streaming response
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'X-DID': userDID,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        // Try to parse error as JSON, but handle case where it's not JSON
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

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
                // Refresh to get updated objective count
                await loadDocuments();
                onExtractObjectives?.(doc);
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

  /**
   * Get human-readable phase description
   */
  const getPhaseDescription = (phase: ExtractionProgress['phase']): string => {
    switch (phase) {
      case 'chunking':
        return 'Analyzing document structure...';
      case 'extracting':
        return 'Extracting objectives with AI...';
      case 'consolidating':
        return 'Consolidating results...';
      case 'complete':
        return 'Complete!';
      default:
        return 'Processing...';
    }
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
            </div>

            {/* Objectives status */}
            <div className="doc-objectives">
              {doc.objectiveCount !== undefined && doc.objectiveCount > 0 ? (
                <div className="objectives-count">
                  <span className="count-value">{doc.objectiveCount}</span>
                  <span className="count-label">Objectives</span>
                </div>
              ) : extracting === doc.id && progress ? (
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
              ) : (
                <button
                  className="extract-button"
                  onClick={(e) => handleExtract(doc, e)}
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
        ))}
      </div>
    </div>
  );
}
