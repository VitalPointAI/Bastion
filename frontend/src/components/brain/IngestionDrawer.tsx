/**
 * IngestionDrawer — slide-out overlay drawer replacing the narrow IngestionSidebar
 *
 * Phase 50 Plan 07. Replaces the 280px left column sidebar with a ~33vw overlay
 * drawer that provides proper space for processing progress, document summaries,
 * and classification details.
 *
 * Key behaviors:
 * - UNIV-30: Overlay drawer at min(33vw, 520px), does not resize workspace grid
 * - UNIV-31: Auto-opens when items go from 0 → >0 (new submission)
 * - UNIV-32: Auto-closes 2s after all items reach terminal state
 * - UNIV-33: Persistent trigger button on left edge when collapsed
 * - UNIV-34: Enlarged processing cards with classification, confidence, entity counts
 * - UNIV-35: Document management (list + cascade delete)
 * - UNIV-36: OSINT feed management (list + pause/resume/delete)
 *
 * What is NOT in this drawer:
 * - No Advanced wrapper / DocIntelligencePanel
 * - No AddOSINTSourceModal (RSS auto-detection replaces it)
 * - No SubspaceSidebar (remains in the left grid column)
 */

import { type ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useBrainIngestion } from './hooks/useBrainIngestion.js';
import { useUniversalIngest } from './hooks/useUniversalIngest.js';
import { UniversalInputZone } from './UniversalInputZone.js';
import { IngestItemStatus } from './IngestItemStatus.js';
import { SmartSuggestionChips } from './SmartSuggestionChips.js';
import { osintService } from '../../lib/osint-service.js';
import type { OSINTFeedConfig } from '../../lib/osint-service.js';
import type { IngestionEvent } from './hooks/useBrainIngestion.js';
import type { IngestItem } from './hooks/useUniversalIngest.js';
import './IngestionDrawer.css';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestionDrawerProps {
  problemSetId: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_FILTERS = ['All', 'Documents', 'OSINT', 'Subscriptions', 'Research'] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

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

function dotColor(event: IngestionEvent): string {
  if (event.nodeType) return NODE_TYPE_EVENT_COLORS[event.nodeType] ?? '#888888';
  return NODE_TYPE_EVENT_COLORS[event.type] ?? '#888888';
}

/** Derive a type badge label and color for an IngestItem */
function ingestItemBadge(item: IngestItem): { label: string; color: string } {
  const pipeline = item.classification?.suggestedPipeline;
  const inputType = item.classification?.inputType;

  if (pipeline === 'osint-subscribe' || inputType === 'rss_url') {
    return { label: 'RSS', color: '#ff9933' };
  }
  if (inputType === 'raw_text' || inputType === 'json_data' || inputType === 'xml_data') {
    return { label: 'TEXT', color: '#888888' };
  }
  if (pipeline === 'doc-intelligence' || inputType === 'file' || inputType === 'pdf_url' || inputType === 'article_url') {
    return { label: 'DOC', color: '#4a9eff' };
  }
  return { label: 'DOC', color: '#4a9eff' };
}

function eventBadge(event: IngestionEvent): { label: string; color: string } {
  const st = event.sourceType?.toLowerCase() ?? '';
  if (st.includes('osint') || st.includes('subscript')) return { label: 'OSINT', color: '#44cc66' };
  if (st.includes('research')) return { label: 'DOC', color: '#4a9eff' };
  return { label: 'DOC', color: '#4a9eff' };
}

function matchesFilter(filter: SourceFilter, badge: string): boolean {
  if (filter === 'All') return true;
  if (filter === 'Documents' && badge === 'DOC') return true;
  if (filter === 'OSINT' && badge === 'OSINT') return true;
  if (filter === 'Subscriptions' && badge === 'RSS') return true;
  if (filter === 'Research' && badge === 'TEXT') return true;
  return false;
}

function isTerminalStatus(status: IngestItem['status']): boolean {
  return status === 'complete' || status === 'error';
}

// ─── Document types ───────────────────────────────────────────────────────────

interface IngestionDocument {
  id: string;
  title: string;
  classification?: string;
  objectiveCount?: number;
  createdAt?: string;
}

// ─── Unified feed item types ──────────────────────────────────────────────────

type UnifiedFeedItem =
  | { kind: 'ingest'; item: IngestItem; timestamp: string; badge: { label: string; color: string } }
  | { kind: 'event'; event: IngestionEvent; badge: { label: string; color: string } };

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: string | number;
  children: ReactNode;
  id?: string;
}

function CollapsibleSection({ title, defaultOpen = false, badge, children, id }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="drawer-section" id={id}>
      <div className="drawer-section-header" onClick={() => setOpen((v) => !v)}>
        <span>
          {title}
          {badge != null && <span className="drawer-section-badge">{badge}</span>}
        </span>
        <span className={`drawer-section-chevron${open ? ' open' : ''}`}>&#x25BC;</span>
      </div>
      <div className={`drawer-section-body${open ? ' open' : ''}`}>
        {children}
      </div>
    </div>
  );
}

// ─── Enlarged Processing Card ─────────────────────────────────────────────────

interface ProcessingCardProps {
  entry: UnifiedFeedItem;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  onSuggestionSelect: (itemId: string, pipeline: string) => void;
}

function ProcessingCard({ entry, onRetry, onDismiss, onSuggestionSelect }: ProcessingCardProps) {
  if (entry.kind === 'event') {
    const { event, badge } = entry;
    return (
      <div className="drawer-card drawer-card--event">
        <div className="drawer-card-header">
          <div
            className="drawer-card-dot"
            style={{ background: dotColor(event) }}
            aria-hidden="true"
          />
          <span
            className="drawer-card-type-badge"
            style={{ background: badge.color }}
          >
            {badge.label}
          </span>
          <span className="drawer-card-time">{relativeTime(event.timestamp)}</span>
          <span className="drawer-card-status-icon" title={event.type}>
            {eventStatusIcon(event.type)}
          </span>
        </div>
        <div className="drawer-card-label" title={event.label}>
          {event.label}
        </div>
        <div className="drawer-card-meta">
          <span className="drawer-card-meta-badge">{event.sourceType}</span>
        </div>
      </div>
    );
  }

  // IngestItem card — enlarged with classification details
  const { item, badge } = entry;
  const conf = item.classification?.confidence;
  const inputType = item.classification?.inputType;
  const pipeline = item.classification?.suggestedPipeline;
  const confPct = conf != null ? `${Math.round(conf * 100)}%` : null;

  const cardClass = [
    'drawer-card',
    `drawer-card--${item.status}`,
  ].join(' ');

  return (
    <div className={cardClass}>
      <div className="drawer-card-header">
        <span
          className="drawer-card-type-badge"
          style={{ background: badge.color }}
        >
          {badge.label}
        </span>
        {inputType && (
          <span className="drawer-card-input-type">{inputType.replace(/_/g, ' ')}</span>
        )}
        {confPct && (
          <span className="drawer-card-confidence" title="Classification confidence">
            {confPct}
          </span>
        )}
        {pipeline && (
          <span className="drawer-card-pipeline">{pipeline.replace(/-/g, ' ')}</span>
        )}
      </div>

      {/* Main status chip (reuse existing IngestItemStatus) */}
      <IngestItemStatus
        item={item}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />

      {/* Smart suggestion chips for ambiguous items */}
      <SmartSuggestionChips
        item={item}
        onSelect={onSuggestionSelect}
      />
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
    <div className="drawer-osint-feed-item">
      <div
        className={`drawer-osint-status-dot ${feed.active ? 'active' : 'inactive'}`}
        title={feed.active ? 'Active' : 'Paused'}
        aria-label={feed.active ? 'Active feed' : 'Paused feed'}
      />
      <div className="drawer-osint-feed-info">
        <div className="drawer-osint-feed-name" title={feed.sourceName}>
          {feed.sourceName}
        </div>
        <div className="drawer-osint-feed-meta">
          <span className="drawer-meta-badge">{osintService.sourceTypeLabel(feed.sourceType)}</span>
          {feed.endpointUrl && (
            <span className="drawer-osint-feed-url" title={feed.endpointUrl}>
              {feed.endpointUrl.length > 32 ? `${feed.endpointUrl.slice(0, 32)}...` : feed.endpointUrl}
            </span>
          )}
        </div>
      </div>
      <div className="drawer-osint-feed-actions">
        <button
          className={`drawer-feed-toggle ${feed.active ? 'on' : 'off'}`}
          onClick={() => onToggle(feed.id, !feed.active)}
          title={feed.active ? 'Pause feed' : 'Resume feed'}
          aria-label={feed.active ? `Pause ${feed.sourceName}` : `Resume ${feed.sourceName}`}
        >
          {feed.active ? '\u23F8' : '\u25B6'}
        </button>
        <button
          className="drawer-delete-btn"
          onClick={() => onDelete(feed.id, feed.sourceName)}
          title="Remove source"
          aria-label={`Remove ${feed.sourceName}`}
        >
          \u2715
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IngestionDrawer({ problemSetId, isOpen, onOpen, onClose }: IngestionDrawerProps) {
  const [activeFilter, setActiveFilter] = useState<SourceFilter>('All');
  const [documents, setDocuments] = useState<IngestionDocument[]>([]);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [osintFeeds, setOsintFeeds] = useState<OSINTFeedConfig[]>([]);
  const [osintLoading, setOsintLoading] = useState(false);

  // Auto-close timer ref — cancelled if new content arrives
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Universal ingest hook ─────────────────────────────────────────────────
  const {
    items: universalItems,
    retryItem,
    dismissItem,
    handleSSEEvent,
    submitText: submitWithForcedPipeline,
  } = useUniversalIngest(problemSetId);

  // ── Brain ingestion hook — owns legacy SSE + particles ────────────────────
  const { events, activeProcesses } = useBrainIngestion(
    problemSetId,
    !!problemSetId,
    600,
    handleSSEEvent,
  );

  // ── Auto-open: when items go from 0 → >0 ──────────────────────────────────
  const prevItemCountRef = useRef(universalItems.length);
  useEffect(() => {
    const prev = prevItemCountRef.current;
    const curr = universalItems.length;
    prevItemCountRef.current = curr;

    if (prev === 0 && curr > 0) {
      // New submission — open drawer and cancel any pending auto-close
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
      onOpen();
    }
  }, [universalItems.length, onOpen]);

  // ── Auto-close: 2s after all items reach terminal state ───────────────────
  useEffect(() => {
    if (universalItems.length === 0) return;

    const allTerminal = universalItems.every((item) => isTerminalStatus(item.status));
    const hasActive = activeProcesses.length > 0;

    if (allTerminal && !hasActive && isOpen) {
      // Start auto-close timer
      if (!autoCloseTimerRef.current) {
        autoCloseTimerRef.current = setTimeout(() => {
          autoCloseTimerRef.current = null;
          onClose();
        }, 2000);
      }
    } else {
      // Cancel timer if not all done
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }

    return () => {
      // Cleanup on unmount
    };
  }, [universalItems, activeProcesses, isOpen, onClose]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // ── Fetch documents ───────────────────────────────────────────────────────
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

  // ── Fetch OSINT feeds ─────────────────────────────────────────────────────
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

  useEffect(() => { void fetchDocuments(); }, [fetchDocuments]);
  useEffect(() => { void fetchOsintFeeds(); }, [fetchOsintFeeds]);

  // ── Delete document with cascade ──────────────────────────────────────────
  const handleDeleteDocument = useCallback(async (docId: string, docTitle: string) => {
    if (!confirm(`Delete "${docTitle}" and remove its effects from the knowledge graph?`)) return;
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

  // ── OSINT feed actions ────────────────────────────────────────────────────
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

  // ── Suggestion chip handler ───────────────────────────────────────────────
  const handleSuggestionSelect = useCallback(
    (itemId: string, pipeline: string) => {
      const item = universalItems.find((i) => i.id === itemId);
      if (!item) return;
      dismissItem(itemId);
      const content = item._originalContent ?? item.label;
      void submitWithForcedPipeline(`[pipeline:${pipeline}] ${content}`);
    },
    [universalItems, dismissItem, submitWithForcedPipeline],
  );

  // ── Build unified chronological feed ─────────────────────────────────────
  const unifiedFeed: UnifiedFeedItem[] = [
    ...universalItems.map((item): UnifiedFeedItem => ({
      kind: 'ingest',
      item,
      timestamp: item.createdAt,
      badge: ingestItemBadge(item),
    })),
    ...events.map((event): UnifiedFeedItem => ({
      kind: 'event',
      event,
      badge: eventBadge(event),
    })),
  ].sort((a, b) => {
    const tA = a.kind === 'ingest' ? a.timestamp : a.event.timestamp;
    const tB = b.kind === 'ingest' ? b.timestamp : b.event.timestamp;
    return new Date(tB).getTime() - new Date(tA).getTime();
  });

  const filteredFeed = unifiedFeed.filter((entry) =>
    matchesFilter(activeFilter, entry.badge.label),
  );

  const activeItemCount = universalItems.filter((i) => !isTerminalStatus(i.status)).length;
  const activeFeeds = osintFeeds.filter((f) => f.active).length;
  const isIngesting = activeProcesses.length > 0 || activeItemCount > 0;

  return (
    <>
      {/* ── Backdrop (click to close) ── */}
      {isOpen && (
        <div
          className="ingestion-drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Trigger button (always visible when drawer is closed) ── */}
      {!isOpen && (
        <button
          className="ingestion-drawer-trigger"
          onClick={onOpen}
          aria-label={activeItemCount > 0
            ? `Open ingestion drawer — ${activeItemCount} item${activeItemCount !== 1 ? 's' : ''} processing`
            : 'Open ingestion drawer'}
          title="Open Intelligence Ingestion"
        >
          <span className={`ingestion-drawer-trigger-icon${isIngesting ? ' pulsing' : ''}`} aria-hidden="true">
            +
          </span>
          {activeItemCount > 0 && (
            <span className="ingestion-drawer-trigger-badge" aria-hidden="true">
              {activeItemCount}
            </span>
          )}
        </button>
      )}

      {/* ── Drawer panel ── */}
      <div
        className={`ingestion-drawer${isOpen ? ' open' : ''}`}
        role="complementary"
        aria-label="Intelligence Ingestion"
        aria-hidden={!isOpen}
      >
        {/* ── Drawer header ── */}
        <div className="ingestion-drawer-header">
          <div className="ingestion-drawer-header-left">
            <div className={`ingestion-drawer-pulse${isIngesting ? '' : ' inactive'}`} aria-hidden="true" />
            <span className="ingestion-drawer-title">Intelligence Ingestion</span>
          </div>
          <button
            className="ingestion-drawer-close"
            onClick={onClose}
            aria-label="Close ingestion drawer"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="ingestion-drawer-content">

          {/* ── UniversalInputZone ── */}
          <div className="ingestion-drawer-input-zone">
            <UniversalInputZone problemSetId={problemSetId} />
          </div>

          {/* ── Filter tags ── */}
          <div className="ingestion-drawer-filters" role="group" aria-label="Filter by source type">
            {SOURCE_FILTERS.map((tag) => (
              <button
                key={tag}
                className={`ingestion-drawer-filter-tag${activeFilter === tag ? ' active' : ''}`}
                onClick={() => setActiveFilter(tag)}
                aria-pressed={activeFilter === tag}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* ── Active legacy processes ── */}
          {activeProcesses.length > 0 && (
            <div className="ingestion-drawer-processes">
              {activeProcesses.map((p) => (
                <div key={p.processId} className="drawer-process-active">
                  <div className="drawer-process-name" title={p.documentName}>
                    {p.documentName}
                  </div>
                  <div
                    className="drawer-process-bar-track"
                    role="progressbar"
                    aria-valuenow={Math.round(p.progress * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="drawer-process-bar-fill"
                      style={{ width: `${Math.round(p.progress * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Unified chronological feed ── */}
          <div
            className="ingestion-drawer-feed"
            role="log"
            aria-live="polite"
            aria-label="Intelligence feed"
          >
            {filteredFeed.length === 0 ? (
              <div className="ingestion-drawer-empty">
                <p>Drop files, paste URLs, or type content to grow the brain</p>
              </div>
            ) : (
              filteredFeed.map((entry) => {
                const key = entry.kind === 'event' ? entry.event.id : entry.item.id;
                return (
                  <ProcessingCard
                    key={key}
                    entry={entry}
                    onRetry={retryItem}
                    onDismiss={dismissItem}
                    onSuggestionSelect={handleSuggestionSelect}
                  />
                );
              })
            )}
          </div>

          {/* ── Document management section ── */}
          <CollapsibleSection
            title={`Ingested Documents${documents.length > 0 ? ` (${documents.length})` : ''}`}
            defaultOpen={documents.length > 0}
            id="drawer-documents"
          >
            <div className="ingestion-drawer-doc-list">
              {docsLoading && (
                <div className="ingestion-drawer-loading">Loading documents...</div>
              )}
              {!docsLoading && documents.length === 0 && (
                <div className="ingestion-drawer-empty-section">No documents ingested yet.</div>
              )}
              {documents.map((doc) => (
                <div key={doc.id} className="drawer-doc-item">
                  <div className="drawer-doc-info">
                    <div className="drawer-doc-title" title={doc.title}>
                      {doc.title}
                    </div>
                    <div className="drawer-doc-meta">
                      <span className="drawer-meta-badge">
                        {doc.classification ?? 'UNCLASSIFIED'}
                      </span>
                      {doc.objectiveCount != null && doc.objectiveCount > 0 && (
                        <span className="drawer-doc-meta-text">
                          {doc.objectiveCount} objective{doc.objectiveCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {doc.createdAt && (
                        <span className="drawer-doc-meta-text">{relativeTime(doc.createdAt)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    className="drawer-delete-btn"
                    onClick={() => void handleDeleteDocument(doc.id, doc.title)}
                    disabled={deletingDocId === doc.id}
                    title="Delete document and remove its effects from the knowledge graph"
                    aria-label={`Delete ${doc.title}`}
                  >
                    {deletingDocId === doc.id ? '...' : '\u2715'}
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* ── OSINT feed management section ── */}
          <CollapsibleSection
            title="OSINT Feeds"
            badge={osintFeeds.length > 0 ? `${activeFeeds}/${osintFeeds.length}` : undefined}
            defaultOpen={osintFeeds.length > 0}
            id="drawer-osint-feeds"
          >
            <div className="ingestion-drawer-feeds-list">
              {osintLoading && (
                <div className="ingestion-drawer-loading">Loading feeds...</div>
              )}
              {!osintLoading && osintFeeds.length === 0 && (
                <div className="ingestion-drawer-empty-section">
                  No OSINT feeds. Paste an RSS URL into the input zone to add one.
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
            </div>
          </CollapsibleSection>

        </div>
      </div>
    </>
  );
}
