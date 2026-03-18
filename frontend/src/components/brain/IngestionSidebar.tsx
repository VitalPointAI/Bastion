/**
 * IngestionSidebar — left column of the brain visualization
 *
 * Phase 50 Plan 04 refactor. UniversalInputZone is the PRIMARY interaction
 * surface at the top. Old document upload and OSINT modal are preserved but
 * hidden behind an "Advanced" collapsible link. The feed is unified:
 * all IngestItems (new pipeline) + legacy IngestionEvents are merged and
 * sorted chronologically.
 *
 * UNIV-12: Unified chronological feed
 * UNIV-13: Smart suggestion chips for ambiguous classifications
 * UNIV-18: Old panels deprecated behind "Advanced" link (not deleted)
 */

import { type ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useBrainIngestion } from './hooks/useBrainIngestion.js';
import { useUniversalIngest } from './hooks/useUniversalIngest.js';
import { UniversalInputZone } from './UniversalInputZone.js';
import { IngestItemStatus } from './IngestItemStatus.js';
import { SmartSuggestionChips } from './SmartSuggestionChips.js';
import { DocIntelligencePanel } from '../doc-intelligence/DocIntelligencePanel.js';
import { osintService } from '../../lib/osint-service.js';
import type { OSINTFeedConfig, FeedSourceType, CreateFeedInput } from '../../lib/osint-service.js';
import { copService } from '../../lib/cop-service.js';
import type { IngestionEvent, ProcessStatus } from './hooks/useBrainIngestion.js';
import type { IngestItem } from './hooks/useUniversalIngest.js';
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
  // Default
  return { label: 'DOC', color: '#4a9eff' };
}

/** Derive a type badge for legacy IngestionEvent */
function eventBadge(event: IngestionEvent): { label: string; color: string } {
  const st = event.sourceType?.toLowerCase() ?? '';
  if (st.includes('osint') || st.includes('subscript')) return { label: 'OSINT', color: '#44cc66' };
  if (st.includes('research')) return { label: 'DOC', color: '#4a9eff' };
  return { label: 'DOC', color: '#4a9eff' };
}

/** Map SourceFilter to feed-item test */
function matchesFilter(filter: SourceFilter, badge: string): boolean {
  if (filter === 'All') return true;
  if (filter === 'Documents' && (badge === 'DOC')) return true;
  if (filter === 'OSINT' && badge === 'OSINT') return true;
  if (filter === 'Subscriptions' && badge === 'RSS') return true;
  if (filter === 'Research' && badge === 'TEXT') return true;
  return false;
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
    <div className="ingestion-section" id={id}>
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

      // If COP layer creation is requested, create an intel COP layer directly
      // via copService (correct API base URL + auth). Layer appears in COP panel
      // immediately and will be populated as OSINT events arrive.
      if (createCopLayer) {
        try {
          await copService.createLayer({
            problemSetId,
            sectionId: 'default',
            layerType: 'intel',
            spec: {
              layerId: `osint-${Date.now()}`,
              layerType: 'intel',
              workspaceId: problemSetId,
              sectionId: 'default',
              symbols: [],
              controlMeasures: [],
              customAnnotations: [],
              temporalPhases: [],
              metadata: {
                generatedBy: `osint-${sourceName.trim().toLowerCase().replace(/\s+/g, '-')}`,
                generatedAt: new Date().toISOString(),
                sourceDocumentIds: [],
                ccoValidated: false,
                osintSourceName: sourceName.trim(),
                osintSourceType: sourceType,
                osintFeedEndpoint: endpointUrl.trim() || null,
              },
            } as unknown as import('../../types/cop.js').COPLayerSpec,
          });
        } catch (err) {
          console.warn('[OSINT] COP layer creation failed:', err);
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

  // Ref to advanced section for scroll-to behavior
  const advancedSectionRef = useRef<HTMLDivElement>(null);

  // ── Universal ingest hook — owns the new item state machine ──────────────
  const {
    items: universalItems,
    retryItem,
    dismissItem,
    handleSSEEvent,
    submitText: submitWithForcedPipeline,
  } = useUniversalIngest(problemSetId);

  // ── Brain ingestion hook — owns legacy SSE + particles ───────────────────
  // Pass handleSSEEvent as the callback so classify/route events forwarded here
  const { events, activeProcesses } = useBrainIngestion(
    problemSetId,
    !!problemSetId,
    600,
    handleSSEEvent,
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

  // ── Suggestion chip handler — re-submit item with forced pipeline ────────
  const handleSuggestionSelect = useCallback(
    (itemId: string, pipeline: string) => {
      // Re-submit the original item's content with forced pipeline in the label
      // For now, dismiss old item and re-submit with pipeline hint prepended
      const item = universalItems.find((i) => i.id === itemId);
      if (!item) return;
      dismissItem(itemId);
      // Submit with pipeline hint prefix so classifier can prioritize
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
    return new Date(tB).getTime() - new Date(tA).getTime(); // newest first
  });

  // Apply source filter
  const filteredFeed = unifiedFeed.filter((entry) =>
    matchesFilter(activeFilter, entry.badge.label),
  );

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

      {/* ── PRIMARY: UniversalInputZone ── */}
      <div className="ingestion-universal-zone">
        <UniversalInputZone problemSetId={problemSetId} />
        {/* "Advanced options" link — scrolls to/expands the Advanced section */}
        <button
          type="button"
          className="ingestion-advanced-link"
          onClick={() => {
            advancedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          aria-label="Open advanced ingestion options"
        >
          Advanced options...
        </button>
      </div>

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

      {/* ── Active processes (legacy doc-intelligence tracker) ── */}
      {activeProcesses.length > 0 && (
        <div className="ingestion-processes">
          {activeProcesses.map((p) => (
            <ActiveProcessItem key={p.processId} process={p} />
          ))}
        </div>
      )}

      {/* ── Unified chronological feed ── */}
      <div className="ingestion-feed" role="log" aria-live="polite" aria-label="Intelligence feed">
        {filteredFeed.length === 0 ? (
          <div className="ingestion-empty">
            <p>Feed documents to grow the brain</p>
            <button className="ingestion-empty-cta" onClick={handleUploadClick}>
              &#x2B06; Ingest Documents
            </button>
          </div>
        ) : (
          filteredFeed.map((entry) => {
            if (entry.kind === 'event') {
              return (
                <div key={entry.event.id} className="ingestion-feed-entry">
                  <span
                    className="ingestion-type-badge"
                    style={{ background: entry.badge.color }}
                  >
                    {entry.badge.label}
                  </span>
                  <EventItem event={entry.event} />
                </div>
              );
            }

            // IngestItem entry
            const { item, badge } = entry;
            return (
              <div key={item.id} className="ingestion-feed-entry">
                <span
                  className="ingestion-type-badge"
                  style={{ background: badge.color }}
                >
                  {badge.label}
                </span>
                <IngestItemStatus
                  item={item}
                  onRetry={retryItem}
                  onDismiss={dismissItem}
                />
                {/* Smart suggestion chips for ambiguous/low-confidence items */}
                <SmartSuggestionChips
                  item={item}
                  onSelect={handleSuggestionSelect}
                />
              </div>
            );
          })
        )}
      </div>

      {/* ── ADVANCED section (old panels, hidden by default) ── */}
      <div ref={advancedSectionRef}>
        <CollapsibleSection title="Advanced" defaultOpen={false} id="ingestion-advanced">

          {/* DocIntelligencePanel section (collapsible) */}
          {docIntelOpen && (
            <CollapsibleSection title="Document Upload" defaultOpen={true}>
              <div className="ingestion-doc-intel-wrapper">
                <DocIntelligencePanel problemSetId={problemSetId} />
              </div>
            </CollapsibleSection>
          )}

          {/* OSINT Sources section */}
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

          {/* Documents list with delete */}
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

        </CollapsibleSection>
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
