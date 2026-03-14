/**
 * IngestionSidebar — left column of the brain visualization
 *
 * Shows a real-time unified ingestion feed: all documents being processed,
 * recent node creation events, and filter tags by source type. When
 * mode='training', surfaces the TrainingPackagesView in a collapsible section.
 *
 * The sidebar also exposes an "Ingest Documents" button that opens the
 * DocIntelligencePanel in a collapsible section for document upload.
 */

import { type ReactNode, useState, useCallback, useEffect } from 'react';
import { useBrainIngestion } from './hooks/useBrainIngestion.js';
import { DocIntelligencePanel } from '../doc-intelligence/DocIntelligencePanel.js';
import type { IngestionEvent, ProcessStatus } from './hooks/useBrainIngestion.js';
import './IngestionSidebar.css';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestionSidebarProps {
  problemSetId: string;
  /** Called when user wants to open the upload dialog (for external consumers) */
  onUploadClick?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_FILTERS = ['All', 'Documents', 'OSINT', 'Subscriptions', 'Research'] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

// Maps BrainNodeType → particle/dot color (mirrors useBrainIngestion)
const NODE_TYPE_EVENT_COLORS: Record<string, string> = {
  entity: '#4a9eff',
  objective: '#ff9933',
  document: '#44cc66',
  concept: '#aa66ff',
  specialist_start: '#8888aa',
  specialist_complete: '#44cc66',
  document_added: '#44cc66',
  node_created: '#4a9eff',
  error: '#ff4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function eventStatusIcon(type: string): string {
  if (type === 'specialist_start') return '...';
  if (type === 'specialist_complete' || type === 'document_added') return '\u2713';
  if (type === 'error') return '\u2717';
  if (type === 'node_created') return '\u25CF';
  return '\u25E6';
}

function dotColor(event: IngestionEvent): string {
  if (event.nodeType) return NODE_TYPE_EVENT_COLORS[event.nodeType] ?? '#888888';
  return NODE_TYPE_EVENT_COLORS[event.type] ?? '#888888';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function CollapsibleSection({ title, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ingestion-section">
      <div className="ingestion-section-header" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className={`ingestion-section-chevron${open ? ' open' : ''}`}>&#x25BC;</span>
      </div>
      <div className={`ingestion-section-body${open ? ' open' : ''}`}>
        {children}
      </div>
    </div>
  );
}

interface ActiveProcessItemProps {
  process: ProcessStatus;
}

function ActiveProcessItem({ process }: ActiveProcessItemProps) {
  const pct = Math.round(process.progress * 100);
  return (
    <div className="ingestion-process-active">
      <div className="ingestion-process-name" title={process.documentName}>
        {process.documentName}
      </div>
      <div className="ingestion-process-bar-track">
        <div className="ingestion-process-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface EventItemProps {
  event: IngestionEvent;
}

function EventItem({ event }: EventItemProps) {
  return (
    <div className="ingestion-event">
      <div
        className="ingestion-event-dot"
        style={{ background: dotColor(event) }}
      />
      <div className="ingestion-event-body">
        <div className="ingestion-event-label" title={event.label}>
          {event.label}
        </div>
        <div className="ingestion-event-meta">
          <span className="ingestion-event-badge">{event.sourceType}</span>
          <span className="ingestion-event-time">{relativeTime(event.timestamp)}</span>
        </div>
      </div>
      <div className="ingestion-event-status" title={event.type}>
        {eventStatusIcon(event.type)}
      </div>
    </div>
  );
}

// ─── Document types ──────────────────────────────────────────────────────────

interface IngestionDocument {
  id: string;
  title: string;
  classification?: string;
  objectiveCount?: number;
  createdAt?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IngestionSidebar({ problemSetId, onUploadClick }: IngestionSidebarProps) {
  const [activeFilter, setActiveFilter] = useState<SourceFilter>('All');
  const [docIntelOpen, setDocIntelOpen] = useState(false);
  const [documents, setDocuments] = useState<IngestionDocument[]>([]);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  const { events, activeProcesses } = useBrainIngestion(
    problemSetId,
    !!problemSetId,
  );

  // ── Fetch documents ──────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    if (!problemSetId) return;
    setDocsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/strategic/documents?workspaceId=${encodeURIComponent(problemSetId)}`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const data = await res.json() as { documents?: IngestionDocument[] };
      setDocuments(data.documents ?? []);
    } catch {
      // Non-fatal
    } finally {
      setDocsLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // ── Delete document with cascade ────────────────────────────────────────
  const handleDeleteDocument = useCallback(async (docId: string, docTitle: string) => {
    if (!confirm(`Delete "${docTitle}" and all related objectives, actors, and graph nodes?`)) return;
    setDeletingDocId(docId);
    try {
      const res = await fetch(
        `${API_BASE}/api/strategic/documents/${encodeURIComponent(docId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch {
      // Non-fatal
    } finally {
      setDeletingDocId(null);
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    setDocIntelOpen(true);
    onUploadClick?.();
  }, [onUploadClick]);

  // Filter events by source type
  const filteredEvents = activeFilter === 'All'
    ? events
    : events.filter((e) => e.sourceType === activeFilter);

  const isIngesting = activeProcesses.length > 0;

  return (
    <div className="ingestion-sidebar">

      {/* ── Header ── */}
      <div className="ingestion-header">
        <div className="ingestion-header-left">
          <div className={`ingestion-pulse${isIngesting ? '' : ' inactive'}`} />
          <span>Intelligence Feed</span>
        </div>
        <button className="ingestion-upload-btn" onClick={handleUploadClick}>
          &#x2B06; Ingest
        </button>
      </div>

      {/* ── DocIntelligencePanel section (collapsible) ── */}
      {docIntelOpen && (
        <CollapsibleSection title="Document Upload" defaultOpen={true}>
          <div className="ingestion-doc-intel-wrapper">
            <DocIntelligencePanel problemSetId={problemSetId} />
          </div>
        </CollapsibleSection>
      )}

      {/* ── Documents list with delete ── */}
      {documents.length > 0 && (
        <CollapsibleSection title={`Documents (${documents.length})`} defaultOpen={true}>
          <div className="ingestion-doc-list">
            {docsLoading && <div className="ingestion-doc-loading">Loading...</div>}
            {documents.map((doc) => (
              <div key={doc.id} className="ingestion-doc-item">
                <div className="ingestion-doc-info">
                  <div className="ingestion-doc-title" title={doc.title}>
                    {doc.title}
                  </div>
                  <div className="ingestion-doc-meta">
                    {doc.classification ?? 'UNCLASSIFIED'}
                    {doc.objectiveCount != null && doc.objectiveCount > 0
                      ? ` · ${doc.objectiveCount} objectives`
                      : ''}
                  </div>
                </div>
                <button
                  className="ingestion-doc-delete-btn"
                  onClick={() => handleDeleteDocument(doc.id, doc.title)}
                  disabled={deletingDocId === doc.id}
                  title="Delete document and related graph data"
                  aria-label={`Delete ${doc.title}`}
                >
                  {deletingDocId === doc.id ? '...' : '\u2715'}
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Filter tags ── */}
      <div className="ingestion-filters">
        {SOURCE_FILTERS.map((tag) => (
          <button
            key={tag}
            className={`ingestion-filter-tag${activeFilter === tag ? ' active' : ''}`}
            onClick={() => setActiveFilter(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* ── Active processes ── */}
      {activeProcesses.length > 0 && (
        <div className="ingestion-processes">
          {activeProcesses.map((p) => (
            <ActiveProcessItem key={p.processId} process={p} />
          ))}
        </div>
      )}

      {/* ── Event feed ── */}
      <div className="ingestion-feed">
        {filteredEvents.length === 0 ? (
          <div className="ingestion-empty">
            <p>Feed documents to grow the brain</p>
            <button className="ingestion-empty-cta" onClick={handleUploadClick}>
              &#x2B06; Ingest Documents
            </button>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventItem key={event.id} event={event} />
          ))
        )}
      </div>

    </div>
  );
}
