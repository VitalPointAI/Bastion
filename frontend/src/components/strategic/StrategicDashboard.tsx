/**
 * StrategicDashboard Component
 *
 * Main dashboard for strategic planning document management.
 * Combines document upload, list, extraction workflows, and objective management.
 * Phase 4-10: Now includes ObjectiveList and ObjectiveDetail with MIDLIFE categorization.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../context/UserContext';
import type { StrategicDocument, StrategicObjective } from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';
import { DocumentUpload } from './DocumentUpload.js';
import { DocumentList } from './DocumentList.js';
import { ObjectiveList } from './ObjectiveList.js';
import { ObjectiveDetail } from './ObjectiveDetail.js';
import { MidlifeLegend } from './MidlifeLegend.js';
import { ReviewPanel } from './ReviewPanel.js';
import './StrategicDashboard.css';

export function StrategicDashboard() {
  const { isAuthenticated } = useAuth();
  const { userDID, accountId: _accountId } = useUser();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<StrategicDocument | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Set user DID on service when authenticated
  useEffect(() => {
    if (isAuthenticated && userDID) {
      strategicService.setUserDID(userDID);
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [isAuthenticated, userDID]);

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
    setSelectedObjective(null);
  }, []);

  const handleSelectObjective = useCallback((objective: StrategicObjective) => {
    setSelectedObjective(objective);
    console.log('Objective selected:', objective.id);
  }, []);

  const handleCloseObjective = useCallback(() => {
    setSelectedObjective(null);
  }, []);

  const handleObjectiveSave = useCallback((objective: StrategicObjective) => {
    console.log('Objective saved:', objective.id);
    // Could trigger a refresh of the objective list here if needed
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
        {selectedDocument && !selectedObjective && (
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

              {/* MIDLIFE Legend */}
              <div className="legend-container">
                <MidlifeLegend compact />
              </div>

              {/* Objective List for this document */}
              <div className="objectives-container">
                <ObjectiveList
                  documentId={selectedDocument.id}
                  onSelectObjective={handleSelectObjective}
                />
              </div>

              {/* Agent Review Panel */}
              {userDID && (
                <ReviewPanel
                  documentId={selectedDocument.id}
                  userDID={userDID}
                  onReviewComplete={() => setRefreshTrigger((prev) => prev + 1)}
                />
              )}
            </div>
          </section>
        )}

        {/* Objective Detail Panel */}
        {selectedDocument && selectedObjective && (
          <section className="detail-section objective-detail-section">
            <ObjectiveDetail
              objectiveId={selectedObjective.id}
              onClose={handleCloseObjective}
              onSave={handleObjectiveSave}
            />
          </section>
        )}

        {/* Document List */}
        {!selectedDocument && isReady && (
          <section className="documents-section">
            <DocumentList
              onSelectDocument={handleSelectDocument}
              onExtractObjectives={handleExtractComplete}
              refreshTrigger={refreshTrigger}
              userDID={userDID || undefined}
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
