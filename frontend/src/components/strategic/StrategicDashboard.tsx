/**
 * StrategicDashboard Component
 *
 * Main dashboard for strategic planning document management.
 * Combines document upload, list, and extraction workflows.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { StrategicDocument } from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';
import { buildDID } from '../../lib/identity.js';
import { DocumentUpload } from './DocumentUpload.js';
import { DocumentList } from './DocumentList.js';
import './StrategicDashboard.css';

export function StrategicDashboard() {
  const { authenticated, user } = usePrivy();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<StrategicDocument | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Set user DID on service when authenticated
  useEffect(() => {
    if (authenticated && user) {
      // Build DID from user's Privy ID (same pattern as AuthWrapper)
      const accountId = `${user.id.replace('did:privy:', '')}.testnet`;
      const did = buildDID(accountId);
      strategicService.setUserDID(did);
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [authenticated, user]);

  const handleUploadComplete = useCallback((doc: StrategicDocument) => {
    setRefreshTrigger((prev) => prev + 1);
    setShowUpload(false);
    console.log('Document uploaded:', doc.title);
  }, []);

  const handleSelectDocument = useCallback((doc: StrategicDocument) => {
    setSelectedDocument(doc);
    console.log('Document selected:', doc.title);
  }, []);

  const handleExtractComplete = useCallback((doc: StrategicDocument) => {
    setRefreshTrigger((prev) => prev + 1);
    console.log('Extraction complete for:', doc.title);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedDocument(null);
  }, []);

  return (
    <div className="strategic-dashboard">
      <header className="dashboard-header">
        <h1>Strategic Planning</h1>
        <div className="header-actions">
          <button
            className={`toggle-upload-btn ${showUpload ? 'active' : ''}`}
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17,8 12,3 7,8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload Document
              </>
            )}
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Upload Panel */}
        {showUpload && (
          <section className="upload-section">
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </section>
        )}

        {/* Document Detail Panel */}
        {selectedDocument && (
          <section className="detail-section">
            <div className="detail-header">
              <button className="back-button" onClick={handleCloseDetail}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12,19 5,12 12,5" />
                </svg>
                Back to Documents
              </button>
              <h2>{selectedDocument.title}</h2>
            </div>
            <div className="detail-content">
              <div className="detail-meta">
                <div className="meta-row">
                  <span className="meta-label">Classification</span>
                  <span className={`meta-value classification-${selectedDocument.classification.toLowerCase()}`}>
                    {selectedDocument.classification}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Document Level</span>
                  <span className="meta-value">{selectedDocument.level}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">File</span>
                  <span className="meta-value">{selectedDocument.originalFilename}</span>
                </div>
                {selectedDocument.pageCount && (
                  <div className="meta-row">
                    <span className="meta-label">Pages</span>
                    <span className="meta-value">{selectedDocument.pageCount}</span>
                  </div>
                )}
                <div className="meta-row">
                  <span className="meta-label">Text Length</span>
                  <span className="meta-value">{selectedDocument.textLength.toLocaleString()} characters</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Objectives Extracted</span>
                  <span className="meta-value">{selectedDocument.objectiveCount ?? 0}</span>
                </div>
              </div>
              <p className="detail-placeholder">
                Objective list and workflow views coming in Phase 5.
              </p>
            </div>
          </section>
        )}

        {/* Document List */}
        {!selectedDocument && isReady && (
          <section className="documents-section">
            <DocumentList
              onSelectDocument={handleSelectDocument}
              onExtractObjectives={handleExtractComplete}
              refreshTrigger={refreshTrigger}
            />
          </section>
        )}

        {/* Loading state while waiting for auth */}
        {!selectedDocument && !isReady && (
          <section className="documents-section">
            <div className="document-list loading">
              <div className="loading-content">
                <div className="loading-spinner" />
                <span>Initializing...</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
