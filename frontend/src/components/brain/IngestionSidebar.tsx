/**
 * IngestionSidebar — left column of the brain visualization
 *
 * Shows a real-time unified ingestion feed: all documents being processed,
 * recent node creation events, and filter tags by source type.
 *
 * Includes OSINT source management: lists current connections, add/edit modal,
 * and optional COP layer creation for geo-referenced feeds.
 *
 * The sidebar also exposes an "Ingest Documents" button that opens the
 * DocIntelligencePanel in a collapsible section for document upload.
 */

import { type ReactNode, useState, useCallback, useEffect } from 'react';
import { useBrainIngestion } from './hooks/useBrainIngestion.js';
import { DocIntelligencePanel } from '../doc-intelligence/DocIntelligencePanel.js';
import { osintService } from '../../lib/osint-service.js';
import type { OSINTFeedConfig, FeedSourceType, CreateFeedInput } from '../../lib/osint-service.js';
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

const FEED_SOURCE_TYPES: { value: FeedSourceType; label: string }[] = [
  { value: 'rss', label: 'RSS Feed' },
  { value: 'api', label: 'API Endpoint' },
  { value: 'argus_webhook', label: 'Argus Webhook' },
  { value: 'simulated', label: 'Simulated / Manual' },
];

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
  badge?: string | number;
  children: ReactNode;
}

function CollapsibleSection({ title, defaultOpen = false, badge, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ingestion-section">
      <div className="ingestion-section-header" onClick={() => setOpen((v) => !v)}>
        <span>
          {title}
          {badge != null && <span className="ingestion-section-badge">{badge}</span>}
        </span>
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

// ─── OSINT Feed Item ──────────────────────────────────────────────────────────

interface OSINTFeedItemProps {
  feed: OSINTFeedConfig;
  onToggle: (feedId: string, active: boolean) => void;
  onDelete: (feedId: string, name: string) => void;
}

function OSINTFeedItem({ feed, onToggle, onDelete }: OSINTFeedItemProps) {
  return (
    <div className="osint-feed-item">
      <div
        className={`osint-feed-status-dot ${feed.active ? 'active' : 'inactive'}`}
        title={feed.active ? 'Active' : 'Inactive'}
      />
      <div className="osint-feed-info">
        <div className="osint-feed-name" title={feed.sourceName}>
          {feed.sourceName}
        </div>
        <div className="osint-feed-meta">
          <span className="ingestion-event-badge">{osintService.sourceTypeLabel(feed.sourceType)}</span>
          {feed.endpointUrl && (
            <span className="osint-feed-url" title={feed.endpointUrl}>
              {feed.endpointUrl.length > 28 ? `${feed.endpointUrl.slice(0, 28)}...` : feed.endpointUrl}
            </span>
          )}
        </div>
      </div>
      <div className="osint-feed-actions">
        <button
          className={`osint-feed-toggle ${feed.active ? 'on' : 'off'}`}
          onClick={() => onToggle(feed.id, !feed.active)}
          title={feed.active ? 'Pause feed' : 'Resume feed'}
        >
          {feed.active ? '\u23F8' : '\u25B6'}
        </button>
        <button
          className="ingestion-doc-delete-btn"
          onClick={() => onDelete(feed.id, feed.sourceName)}
          title="Remove source"
        >
          \u2715
        </button>
      </div>
    </div>
  );
}

// ─── Add OSINT Source Modal ───────────────────────────────────────────────────

interface AddOSINTModalProps {
  problemSetId: string;
  onClose: () => void;
  onCreated: () => void;
}

function AddOSINTSourceModal({ problemSetId, onClose, onCreated }: AddOSINTModalProps) {
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState<FeedSourceType>('rss');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [pollingInterval, setPollingInterval] = useState(5);
  const [createCopLayer, setCreateCopLayer] = useState(false);
  const [relevanceMode, setRelevanceMode] = useState<'entity_objective' | 'ai_semantic'>('entity_objective');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim()) { setError('Source name is required'); return; }
    if (sourceType !== 'simulated' && !endpointUrl.trim()) { setError('Endpoint URL is required'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const input: CreateFeedInput = {
        problemSetId,
        sourceName: sourceName.trim(),
        sourceType,
        endpointUrl: endpointUrl.trim() || undefined,
        pollingIntervalMs: pollingInterval * 60_000,
        relevanceMode,
        config: createCopLayer ? { createCopLayer: true } : undefined,
      };

      await osintService.createFeed(input);

      // If COP layer creation is requested, trigger intel layer generation
      // via the COP agent (which will populate it with actual content)
      if (createCopLayer) {
        try {
          const res = await fetch(`${API_BASE}/api/cop/agents/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              workspaceId: problemSetId,
              sectionId: 'default',
              triggeredBy: 'manual',
            }),
          });
          if (!res.ok) {
            console.warn('[OSINT] COP layer generation failed:', res.statusText);
          }
        } catch (err) {
          console.warn('[OSINT] COP layer generation failed:', err);
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="osint-modal-overlay" onClick={onClose}>
      <div className="osint-modal" onClick={(e) => e.stopPropagation()}>
        <div className="osint-modal-header">
          <span>Add Information Source</span>
          <button className="osint-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="osint-modal-body">
          {error && <div className="osint-modal-error">{error}</div>}

          <label className="osint-field">
            <span className="osint-field-label">Source Name</span>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g., Reuters World News, GDELT API"
              className="osint-field-input"
              autoFocus
            />
          </label>

          <label className="osint-field">
            <span className="osint-field-label">Source Type</span>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as FeedSourceType)}
              className="osint-field-input"
            >
              {FEED_SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {sourceType !== 'simulated' && (
            <label className="osint-field">
              <span className="osint-field-label">
                {sourceType === 'argus_webhook' ? 'Webhook URL' : sourceType === 'rss' ? 'Feed URL' : 'API Endpoint'}
              </span>
              <input
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder={sourceType === 'rss' ? 'https://example.com/feed.rss' : 'https://api.example.com/v1/events'}
                className="osint-field-input"
              />
            </label>
          )}

          <div className="osint-field-row">
            <label className="osint-field">
              <span className="osint-field-label">Poll Interval (min)</span>
              <input
                type="number"
                value={pollingInterval}
                onChange={(e) => setPollingInterval(Number(e.target.value))}
                min={1}
                max={1440}
                className="osint-field-input"
              />
            </label>

            <label className="osint-field">
              <span className="osint-field-label">Relevance Mode</span>
              <select
                value={relevanceMode}
                onChange={(e) => setRelevanceMode(e.target.value as 'entity_objective' | 'ai_semantic')}
                className="osint-field-input"
              >
                <option value="entity_objective">Entity &amp; Objective</option>
                <option value="ai_semantic">AI Semantic</option>
              </select>
            </label>
          </div>

          <label className="osint-checkbox">
            <input
              type="checkbox"
              checked={createCopLayer}
              onChange={(e) => setCreateCopLayer(e.target.checked)}
            />
            <span className="osint-checkbox-label">
              Create COP Layer
              <span className="osint-checkbox-hint">Geo-reference feed items and display as a layer on the COP dashboard</span>
            </span>
          </label>

          <div className="osint-modal-footer">
            <button type="button" className="osint-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="osint-btn-submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Source'}
            </button>
          </div>
        </form>
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

  // OSINT sources state
  const [osintFeeds, setOsintFeeds] = useState<OSINTFeedConfig[]>([]);
  const [osintLoading, setOsintLoading] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);

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

  // ── Fetch OSINT feeds ────────────────────────────────────────────────────
  const fetchOsintFeeds = useCallback(async () => {
    if (!problemSetId) return;
    setOsintLoading(true);
    try {
      const feeds = await osintService.getFeeds(problemSetId);
      setOsintFeeds(feeds);
    } catch {
      // Non-fatal
    } finally {
      setOsintLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);
  useEffect(() => { fetchOsintFeeds(); }, [fetchOsintFeeds]);

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

  // ── OSINT feed actions ──────────────────────────────────────────────────
  const handleToggleFeed = useCallback(async (feedId: string, active: boolean) => {
    try {
      await osintService.toggleFeed(feedId, active);
      setOsintFeeds((prev) => prev.map((f) => f.id === feedId ? { ...f, active } : f));
    } catch {
      // Non-fatal
    }
  }, []);

  const handleDeleteFeed = useCallback(async (feedId: string, name: string) => {
    if (!confirm(`Remove OSINT source "${name}"? This will stop ingesting from this source.`)) return;
    try {
      await osintService.deleteFeed(feedId);
      setOsintFeeds((prev) => prev.filter((f) => f.id !== feedId));
    } catch {
      // Non-fatal
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
  const activeFeeds = osintFeeds.filter((f) => f.active).length;

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

      {/* ── OSINT Sources section ── */}
      <CollapsibleSection
        title="OSINT Sources"
        badge={osintFeeds.length > 0 ? `${activeFeeds}/${osintFeeds.length}` : undefined}
        defaultOpen={true}
      >
        <div className="osint-sources-section">
          {osintLoading && <div className="ingestion-doc-loading">Loading sources...</div>}

          {!osintLoading && osintFeeds.length === 0 && (
            <div className="osint-empty-state">
              No OSINT sources connected.
            </div>
          )}

          {osintFeeds.map((feed) => (
            <OSINTFeedItem
              key={feed.id}
              feed={feed}
              onToggle={handleToggleFeed}
              onDelete={handleDeleteFeed}
            />
          ))}

          <button className="osint-add-btn" onClick={() => setShowAddSource(true)}>
            + Add Source
          </button>
        </div>
      </CollapsibleSection>

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
                      ? ` \u00B7 ${doc.objectiveCount} objectives`
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

      {/* ── Add OSINT Source Modal ── */}
      {showAddSource && (
        <AddOSINTSourceModal
          problemSetId={problemSetId}
          onClose={() => setShowAddSource(false)}
          onCreated={fetchOsintFeeds}
        />
      )}

    </div>
  );
}
