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

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Types
// ============================================================================

interface DocIntelligencePanelProps {
  problemSetId: string;
}

interface ProblemSetContext {
  problemSetId: string;
  coreProblem: string;
  updatedAt: string;
  version: number;
  [key: string]: unknown;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const { events, isProcessing, report, flagged, error, documentName, startTime, specialists, uploadDocument } =
    useDocProcessing(problemSetId, processingId);

  // Build processingState for MissionControl from hook state
  const processingState = {
    specialists,
    isProcessing,
    flagged,
    error,
    documentName,
    startTime,
  };

  // ── Check for existing context on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function checkContext() {
      try {
        const res = await fetch(`${API_BASE}/api/doc-intelligence/context/${encodeURIComponent(problemSetId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && data.context) {
          setHasContext(true);
        }
      } catch {
        // Context check is best-effort
      }
    }

    checkContext();
    return () => { cancelled = true; };
  }, [problemSetId]);

  // ── Fetch reports on mount and when processing completes ─────────────────
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/doc-intelligence/reports/${encodeURIComponent(problemSetId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setReports(data.reports);
      }
    } catch {
      // Report fetch is best-effort
    }
  }, [problemSetId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // When a report comes back from SSE, refresh reports list
  useEffect(() => {
    if (report) {
      fetchReports();
    }
  }, [report, fetchReports]);

  // ── Document upload handler ──────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      await uploadDocument(file);
    } finally {
      setUploading(false);
    }
  }, [uploadDocument]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input so the same file can be re-uploaded
    e.target.value = '';
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Scoping interview completion ─────────────────────────────────────────
  const handleInterviewComplete = useCallback((_context: ProblemSetContext) => {
    setHasContext(true);
    setShowInterview(false);
  }, []);

  // ── Rating override handler ──────────────────────────────────────────────
  const handleRatingOverride = useCallback(async (documentId: string, newRating: Partial<NATORating>, reason: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/doc-intelligence/reports/${encodeURIComponent(documentId)}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: newRating, reason }),
      });
      if (res.ok) {
        fetchReports();
      }
    } catch {
      // Rating override is best-effort
    }
  }, [fetchReports]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, minHeight: 0 }}>

      {/* ── 1. Scoping Interview Section ── */}
      <div style={{
        background: 'var(--color-gray-900, #111827)',
        border: '1px solid var(--color-gray-700, #374151)',
        borderRadius: '0.5rem',
        padding: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Problem Set Scoping
          </h3>
          {hasContext && (
            <span style={{
              fontSize: '0.625rem',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#4ade80',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}>
              Context set
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          Define geographic scope, temporal range, actor focus, and core problem for intelligence analysis.
        </p>
        <button
          onClick={() => setShowInterview(true)}
          style={{
            padding: '0.375rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: hasContext ? 'transparent' : '#2563eb',
            color: hasContext ? '#60a5fa' : '#ffffff',
            border: hasContext ? '1px solid #3b82f6' : 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          {hasContext ? 'Re-run Interview' : 'Start Scoping Interview'}
        </button>
      </div>

      {/* Scoping Interview Modal Overlay */}
      {showInterview && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '48rem',
            height: '80vh',
            background: 'var(--color-background, #0a0a0a)',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-gray-700, #374151)',
            overflow: 'hidden',
          }}>
            <ScopingInterview
              problemSetId={problemSetId}
              onComplete={handleInterviewComplete}
              onClose={() => setShowInterview(false)}
            />
          </div>
        </div>
      )}

      {/* ── 2. Document Upload Section ── */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        style={{
          background: 'var(--color-gray-900, #111827)',
          border: '2px dashed var(--color-gray-600, #4b5563)',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          textAlign: 'center',
          cursor: uploading || isProcessing ? 'not-allowed' : 'pointer',
          opacity: uploading || isProcessing ? 0.5 : 1,
          transition: 'border-color 0.2s, opacity 0.2s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          accept=".pdf,.doc,.docx,.txt,.md,.html,.csv,.json,.xml"
          style={{ display: 'none' }}
          disabled={uploading || isProcessing}
        />
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          {uploading ? '\u23F3' : '\uD83D\uDCC4'}
        </div>
        <p style={{ fontSize: '0.875rem', color: '#d1d5db', fontWeight: 500 }}>
          {uploading ? 'Uploading...' : 'Drop a document here or click to upload'}
        </p>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
          PDF, DOCX, TXT, MD, HTML, CSV, JSON, XML
        </p>
      </div>

      {/* ── 3. Mission Control Section ── */}
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

      {/* ── 5. Intelligence Reports Section ── */}
      <div>
        <h3 style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.75rem',
        }}>
          Intelligence Reports
        </h3>
        <IntelligenceReportList
          reports={reports}
          onRatingOverride={handleRatingOverride}
        />
      </div>

      {/* Processing Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
        }}>
          <p style={{ fontSize: '0.875rem', color: '#f87171' }}>{error}</p>
        </div>
      )}
    </div>
  );
}
