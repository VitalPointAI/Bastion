/**
 * DocIntelligencePanel - Composite panel wiring all doc-intelligence components
 *
 * Orchestrates scoping interview, document upload, mission control dashboard,
 * processing feed, and intelligence reports in a single vertical layout.
 * Rendered as a sidebar view in the Understand tab.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDocProcessing } from '../../hooks/useDocProcessing';
import { MissionControl } from './MissionControl';
import { ScopingInterview } from './ScopingInterview';
import { IntelligenceReportList } from './IntelligenceReport';
import { ProcessingFeed } from './ProcessingFeed';
import type { DocumentIntelligenceReport } from './IntelligenceReport';
import type { NATORating } from './NATORatingPanel';

interface DocumentStatus {
  documentId: string;
  title: string;
  processingStatus: string;
  processingError?: string;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Shared Style Tokens
// ============================================================================

const card = {
  background: '#0d1117',
  border: '1px solid #21262d',
  borderRadius: '0.75rem',
  padding: '1.25rem',
} as const;

const sectionLabel = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: '#8b949e',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  margin: 0,
};

const btnPrimary = (disabled?: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center' as const,
  gap: '0.375rem',
  padding: '0.5rem 1rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  background: disabled ? '#21262d' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: disabled ? '#484f58' : '#fff',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.15s ease',
  boxShadow: disabled ? 'none' : '0 1px 3px rgba(37, 99, 235, 0.3)',
});

const btnOutline = {
  display: 'inline-flex',
  alignItems: 'center' as const,
  gap: '0.375rem',
  padding: '0.5rem 1rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  background: 'transparent',
  color: '#58a6ff',
  border: '1px solid #30363d',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const badge = (color: string, bg: string, borderColor: string) => ({
  fontSize: '0.625rem',
  fontWeight: 600,
  padding: '0.1875rem 0.625rem',
  borderRadius: '9999px',
  background: bg,
  color,
  border: `1px solid ${borderColor}`,
  letterSpacing: '0.04em',
});

// ============================================================================
// Types
// ============================================================================

interface DocIntelligencePanelProps {
  problemSetId: string;
}

// ============================================================================
// DocIntelligencePanel Component
// ============================================================================

export function DocIntelligencePanel({ problemSetId }: DocIntelligencePanelProps) {
  const [processingId] = useState<string | null>(null);
  const [reports, setReports] = useState<DocumentIntelligenceReport[]>([]);
  const [hasContext, setHasContext] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [interruptedDocs, setInterruptedDocs] = useState<DocumentStatus[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const {
    events, isProcessing, report, flagged, error,
    documentName, startTime, specialists, uploadDocument,
    pendingDuplicate, forceUpload, dismissDuplicate,
  } = useDocProcessing(problemSetId, processingId);

  const processingState = {
    specialists, isProcessing, flagged, error, documentName, startTime,
  };

  // ── Check for existing context on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function checkContext() {
      try {
        const res = await fetch(`${API_BASE}/api/doc-intelligence/context/${encodeURIComponent(problemSetId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && data.context) setHasContext(true);
      } catch { /* best-effort */ }
    }
    checkContext();
    return () => { cancelled = true; };
  }, [problemSetId]);

  // ── Fetch interrupted/failed documents ───────────────────────────────────
  const fetchInterruptedDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/doc-intelligence/documents/${encodeURIComponent(problemSetId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.documents)) {
        setInterruptedDocs(
          data.documents.filter((d: DocumentStatus) =>
            d.processingStatus === 'interrupted' || d.processingStatus === 'failed'
          )
        );
      }
    } catch { /* best-effort */ }
  }, [problemSetId]);

  useEffect(() => { fetchInterruptedDocs(); }, [fetchInterruptedDocs]);
  useEffect(() => { if (report) fetchInterruptedDocs(); }, [report, fetchInterruptedDocs]);

  const handleRetry = useCallback(async (documentId: string) => {
    setRetrying(documentId);
    try {
      const res = await fetch(
        `${API_BASE}/api/doc-intelligence/documents/${encodeURIComponent(problemSetId)}/${encodeURIComponent(documentId)}/retry`,
        { method: 'POST' },
      );
      if (res.ok) fetchInterruptedDocs();
    } catch { /* best-effort */ }
    finally { setRetrying(null); }
  }, [problemSetId, fetchInterruptedDocs]);

  // ── Fetch reports ───────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/doc-intelligence/reports/${encodeURIComponent(problemSetId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) setReports(data.reports);
    } catch { /* best-effort */ }
  }, [problemSetId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { if (report) fetchReports(); }, [report, fetchReports]);

  // ── Document upload handlers ─────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    try { await uploadDocument(file); }
    finally { setUploading(false); }
  }, [uploadDocument]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInterviewComplete = useCallback(() => {
    setHasContext(true);
    setShowInterview(false);
  }, []);

  const handleRatingOverride = useCallback(async (documentId: string, newRating: Partial<NATORating>, reason: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/doc-intelligence/reports/${encodeURIComponent(documentId)}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: newRating, reason }),
      });
      if (res.ok) fetchReports();
    } catch { /* best-effort */ }
  }, [fetchReports]);

  // ── Render ───────────────────────────────────────────────────────────────

  const uploadDisabled = uploading || isProcessing;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '1rem',
      flex: 1, minHeight: 0, padding: '0.5rem 1rem 1rem',
      overflowY: 'auto',
    }}>

      {/* ── 1. Scoping Interview ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1117 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8125rem',
            }}>
              {hasContext ? '\u2713' : '\u2699'}
            </div>
            <h3 style={sectionLabel}>Problem Set Scoping</h3>
          </div>
          {hasContext && (
            <span style={badge('#3fb950', 'rgba(63, 185, 80, 0.1)', 'rgba(63, 185, 80, 0.25)')}>
              CONFIGURED
            </span>
          )}
        </div>

        <p style={{ fontSize: '0.8125rem', color: '#8b949e', marginBottom: '1rem', lineHeight: 1.5 }}>
          {hasContext
            ? 'Intelligence analysis is scoped to your defined parameters. Re-run to update.'
            : 'Define geographic scope, temporal range, actor focus, and core problem before uploading documents.'}
        </p>

        <button
          onClick={() => setShowInterview(true)}
          style={hasContext ? btnOutline : btnPrimary()}
        >
          {hasContext ? 'Re-run Interview' : 'Start Scoping Interview'}
        </button>
      </div>

      {/* Scoping Interview Modal */}
      {showInterview && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: '3.5rem',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: '100%', maxWidth: '48rem', maxHeight: 'calc(100vh - 5rem)', height: '80vh',
            background: '#0d1117', borderRadius: '0.75rem', border: '1px solid #21262d',
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}>
            <ScopingInterview
              problemSetId={problemSetId}
              onComplete={handleInterviewComplete}
              onClose={() => setShowInterview(false)}
            />
          </div>
        </div>
      )}

      {/* ── 2. Document Upload ── */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploadDisabled && fileInputRef.current?.click()}
        style={{
          ...card,
          border: dragOver
            ? '2px solid #58a6ff'
            : uploadDisabled
              ? '2px dashed #21262d'
              : '2px dashed #30363d',
          textAlign: 'center',
          cursor: uploadDisabled ? 'not-allowed' : 'pointer',
          opacity: uploadDisabled ? 0.5 : 1,
          transition: 'all 0.2s ease',
          padding: '2rem 1.25rem',
          background: dragOver ? 'rgba(88, 166, 255, 0.04)' : '#0d1117',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          accept=".pdf,.doc,.docx,.txt,.md,.html,.csv,.json,.xml"
          style={{ display: 'none' }}
          disabled={uploadDisabled}
        />
        <div style={{
          width: '3rem', height: '3rem', margin: '0 auto 0.75rem',
          borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: uploading ? 'rgba(245, 158, 11, 0.1)' : 'rgba(88, 166, 255, 0.08)',
          border: `1px solid ${uploading ? 'rgba(245, 158, 11, 0.2)' : 'rgba(88, 166, 255, 0.15)'}`,
          fontSize: '1.25rem',
        }}>
          {uploading ? '\u23F3' : '\u2B06'}
        </div>
        <p style={{ fontSize: '0.875rem', color: '#c9d1d9', fontWeight: 500, marginBottom: '0.25rem' }}>
          {uploading ? 'Processing upload...' : 'Drop a document here or click to upload'}
        </p>
        <p style={{ fontSize: '0.75rem', color: '#484f58' }}>
          PDF, DOCX, TXT, MD, HTML, CSV, JSON, XML &middot; Max 50 MB
        </p>
      </div>

      {/* ── Duplicate Warning ── */}
      {pendingDuplicate && (
        <div style={{
          ...card,
          borderColor: 'rgba(210, 153, 34, 0.4)',
          background: 'rgba(210, 153, 34, 0.06)',
          padding: '1rem 1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.125rem', lineHeight: 1, marginTop: '0.125rem' }}>&#x26A0;</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.8125rem', color: '#d29922', fontWeight: 600, marginBottom: '0.375rem' }}>
                Possible Duplicate Detected
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#8b949e', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                {pendingDuplicate.message}
              </p>
              {pendingDuplicate.duplicates.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  {pendingDuplicate.duplicates.map((d) => (
                    <div key={d.documentId} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.375rem 0.5rem', marginBottom: '0.25rem',
                      background: 'rgba(0,0,0,0.2)', borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                    }}>
                      <span style={{ color: '#c9d1d9' }}>{d.title}</span>
                      <span style={badge('#d29922', 'rgba(210,153,34,0.15)', 'rgba(210,153,34,0.3)')}>
                        {Math.round(d.similarity * 100)}% match
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={forceUpload} style={{
                  ...btnPrimary(), background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                  boxShadow: '0 1px 3px rgba(217, 119, 6, 0.3)', padding: '0.375rem 0.875rem', fontSize: '0.75rem',
                }}>
                  Upload Anyway
                </button>
                <button onClick={dismissDuplicate} style={{ ...btnOutline, padding: '0.375rem 0.875rem', fontSize: '0.75rem' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Processing Error ── */}
      {error && (
        <div style={{
          ...card,
          borderColor: 'rgba(248, 81, 73, 0.4)',
          background: 'rgba(248, 81, 73, 0.06)',
          padding: '0.875rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <span style={{ color: '#f85149', fontSize: '1rem' }}>&#x2716;</span>
          <p style={{ fontSize: '0.8125rem', color: '#f85149', fontWeight: 500, flex: 1 }}>{error}</p>
        </div>
      )}

      {/* ── Interrupted / Failed Documents ── */}
      {interruptedDocs.length > 0 && (
        <div style={{ ...card, borderColor: 'rgba(210, 153, 34, 0.3)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h4 style={sectionLabel}>Needs Attention</h4>
            <span style={badge('#d29922', 'rgba(210,153,34,0.15)', 'rgba(210,153,34,0.3)')}>
              {interruptedDocs.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {interruptedDocs.map((doc) => (
              <div key={doc.documentId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.625rem',
                background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem',
                border: '1px solid #21262d',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.8125rem', color: '#c9d1d9', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: '0.125rem',
                  }}>
                    {doc.title}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: doc.processingStatus === 'failed' ? '#f85149' : '#d29922' }}>
                    {doc.processingStatus === 'failed'
                      ? `Failed: ${doc.processingError || 'Unknown error'}`
                      : 'Processing interrupted \u2014 retry to resume'}
                  </p>
                </div>
                <button
                  onClick={() => handleRetry(doc.documentId)}
                  disabled={retrying === doc.documentId}
                  style={{
                    ...btnPrimary(retrying === doc.documentId),
                    padding: '0.3125rem 0.75rem', fontSize: '0.6875rem', marginLeft: '0.5rem',
                  }}
                >
                  {retrying === doc.documentId ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Mission Control ── */}
      {(isProcessing || flagged || events.length > 0) && (
        <MissionControl
          problemSetId={problemSetId}
          processingState={processingState}
        />
      )}

      {/* ── 4. Processing Feed ── */}
      {events.length > 0 && (
        <ProcessingFeed events={events} maxHeight="250px" />
      )}

      {/* ── 5. Intelligence Reports ── */}
      <div style={{ ...card, padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1117 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8125rem',
          }}>
            &#x1F4CA;
          </div>
          <h3 style={sectionLabel}>Intelligence Reports</h3>
          {reports.length > 0 && (
            <span style={badge('#8b949e', 'rgba(139,148,158,0.1)', 'rgba(139,148,158,0.2)')}>
              {reports.length}
            </span>
          )}
        </div>
        <IntelligenceReportList
          reports={reports}
          onRatingOverride={handleRatingOverride}
        />
      </div>

    </div>
  );
}
