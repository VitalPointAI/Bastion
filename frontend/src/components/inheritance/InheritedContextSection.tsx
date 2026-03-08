/**
 * InheritedContextSection
 *
 * Phase 26 Plan 05: Top-level orchestrating component for inherited strategic
 * context display. Composes ContextDashboardWidget, AcknowledgmentBanner,
 * InheritedItemCard, ChangelogView, AnnotationPanel, RFIThread, and RFIList
 * into a collapsible section with slide-out panels.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  inheritanceApi,
  ECHELON_COLORS,
} from '../../lib/inheritance-service.ts';
import type {
  InheritedContextResponse,
  InheritedDocument,
  InheritedGraphSummary,
  InheritanceAnnotation,
  PendingAck,
} from '../../lib/inheritance-service.ts';
import { ContextDashboardWidget } from './ContextDashboardWidget.tsx';
import { AcknowledgmentBanner } from './AcknowledgmentBanner.tsx';
import { InheritedItemCard } from './InheritedItemCard.tsx';
import { ChangelogView } from './ChangelogView.tsx';
import { AnnotationPanel } from './AnnotationPanel.tsx';
import { RFIThread, RFIList } from './RFIThread.tsx';
import './InheritedContextSection.css';

type Echelon = 'strategic' | 'operational' | 'tactical';

interface InheritedContextSectionProps {
  problemSetId: string;
}

function getLocalStorageKey(problemSetId: string): string {
  return `inherited-context-collapsed-${problemSetId}`;
}

function getInitialCollapsed(problemSetId: string): boolean {
  try {
    const stored = localStorage.getItem(getLocalStorageKey(problemSetId));
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Group documents by source echelon, maintaining the echelon display order:
 * strategic -> operational -> tactical
 */
function groupByEchelon(
  documents: InheritedDocument[],
): { echelon: Echelon; label: string; docs: InheritedDocument[] }[] {
  const echelonOrder: Echelon[] = ['strategic', 'operational', 'tactical'];
  const groups: Record<string, InheritedDocument[]> = {};

  for (const doc of documents) {
    const key = doc.sourceEchelon || 'operational';
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  }

  return echelonOrder
    .filter((e) => groups[e] && groups[e].length > 0)
    .map((e) => ({
      echelon: e,
      label: ECHELON_COLORS[e].label,
      docs: groups[e],
    }));
}

/**
 * Look up item metadata by itemId from the inherited context data.
 * Returns source PS info needed for AnnotationPanel and RFI creation.
 */
function findItemMeta(
  data: InheritedContextResponse,
  itemId: string,
): {
  sourceProblemSetId: string;
  sourceProblemSetName: string;
  sourceEchelon: Echelon;
  itemTitle: string;
  itemType: 'strategic_document' | 'graph_summary';
} | null {
  const doc = data.inheritedDocuments.find((d) => d.id === itemId);
  if (doc) {
    return {
      sourceProblemSetId: doc.sourceProblemSetId,
      sourceProblemSetName: doc.sourceProblemSetName,
      sourceEchelon: (doc.sourceEchelon || 'operational') as Echelon,
      itemTitle: doc.title,
      itemType: 'strategic_document',
    };
  }
  const gs = data.inheritedGraphSummaries.find(
    (g) => g.containerName === itemId,
  );
  if (gs) {
    return {
      sourceProblemSetId: gs.sourceProblemSetId,
      sourceProblemSetName: gs.sourceProblemSetName,
      sourceEchelon: (gs.sourceEchelon || 'operational') as Echelon,
      itemTitle: gs.containerName,
      itemType: 'graph_summary',
    };
  }
  return null;
}

export function InheritedContextSection({
  problemSetId,
}: InheritedContextSectionProps) {
  const [data, setData] = useState<InheritedContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() =>
    getInitialCollapsed(problemSetId),
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'documents' | 'changelog' | 'rfis'
  >('documents');

  // Annotation panel state
  const [annotatingItemId, setAnnotatingItemId] = useState<string | null>(null);

  // RFI panel state
  const [rfiMode, setRfiMode] = useState<{
    itemId: string;
    targetPsId: string;
  } | null>(null);
  const [viewingRfiId, setViewingRfiId] = useState<string | null>(null);

  // Batch annotations keyed by targetItemId
  const [annotationsByItem, setAnnotationsByItem] = useState<
    Record<string, InheritanceAnnotation[]>
  >({});

  const fetchContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await inheritanceApi.getInheritedContext(problemSetId);
      setData(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load inherited context',
      );
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  // Batch-fetch all annotations for this PS
  const fetchAnnotations = useCallback(async () => {
    try {
      const allAnnotations =
        await inheritanceApi.getAnnotations(problemSetId);
      const byItem: Record<string, InheritanceAnnotation[]> = {};
      for (const ann of allAnnotations) {
        if (!byItem[ann.targetItemId]) byItem[ann.targetItemId] = [];
        byItem[ann.targetItemId].push(ann);
      }
      setAnnotationsByItem(byItem);
    } catch {
      // Non-critical: annotations may not be available
    }
  }, [problemSetId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  useEffect(() => {
    if (data && data.ancestors.length > 0) {
      fetchAnnotations();
    }
  }, [data, fetchAnnotations]);

  // Reset state when problemSetId changes
  useEffect(() => {
    setIsCollapsed(getInitialCollapsed(problemSetId));
    setExpandedItemId(null);
    setActiveTab('documents');
    setAnnotatingItemId(null);
    setRfiMode(null);
    setViewingRfiId(null);
    setAnnotationsByItem({});
  }, [problemSetId]);

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem(getLocalStorageKey(problemSetId), String(next));
    } catch {
      // localStorage might not be available
    }
  }

  function handleToggleExpand(itemId: string) {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }

  async function handleAcknowledge(sourceProblemSetId: string) {
    try {
      await inheritanceApi.acknowledgeContext(problemSetId, sourceProblemSetId);
      await fetchContext();
    } catch (err) {
      console.error('Failed to acknowledge context:', err);
    }
  }

  function handleAnnotate(itemId: string) {
    setAnnotatingItemId(itemId);
    // Close RFI panel if open
    setRfiMode(null);
    setViewingRfiId(null);
  }

  function handleRequestInfo(itemId: string) {
    if (!data) return;
    const meta = findItemMeta(data, itemId);
    if (meta) {
      setRfiMode({ itemId, targetPsId: meta.sourceProblemSetId });
      // Close annotation panel if open
      setAnnotatingItemId(null);
      setViewingRfiId(null);
    }
  }

  function handleCloseAnnotationPanel() {
    setAnnotatingItemId(null);
    // Refresh annotations and context when panel closes
    fetchAnnotations();
    fetchContext();
  }

  function handleCloseRfiPanel() {
    setRfiMode(null);
    setViewingRfiId(null);
    // Refresh context when RFI panel closes
    fetchContext();
  }

  function handleSelectRFI(rfiId: string) {
    setViewingRfiId(rfiId);
    setRfiMode(null);
    setAnnotatingItemId(null);
  }

  // Don't render anything while loading initially
  if (loading && !data) {
    return null;
  }

  // Don't render if there was an error and no cached data
  if (error && !data) {
    return null;
  }

  // Don't render if no ancestors (no inheritance)
  if (!data || data.ancestors.length === 0) {
    return null;
  }

  const totalItems =
    data.inheritedDocuments.length + data.inheritedGraphSummaries.length;
  const echelonGroups = groupByEchelon(data.inheritedDocuments);

  // Build pending acks list from syncStatus
  const pendingAcks: PendingAck[] = data.ancestors
    .filter(() => data.syncStatus.pendingAcknowledgments > 0)
    .map((a) => ({
      sourceProblemSetId: a.problemSetId,
      sourceProblemSetName: a.name,
      sourceEchelon: a.echelon,
      pendingCount: Math.ceil(
        data.syncStatus.pendingAcknowledgments / data.ancestors.length,
      ),
    }));

  // Resolve annotation panel item metadata
  const annotatingMeta =
    annotatingItemId ? findItemMeta(data, annotatingItemId) : null;

  // Resolve RFI create mode item metadata
  const rfiCreateMeta =
    rfiMode ? findItemMeta(data, rfiMode.itemId) : null;

  // Determine if a side panel is open
  const sidePanelOpen = !!(annotatingItemId || rfiMode || viewingRfiId);

  return (
    <div className="inherited-context-section">
      {/* Collapsible header */}
      <button
        className="ics-header"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
      >
        <span className={`ics-chevron ${isCollapsed ? 'collapsed' : ''}`}>
          {isCollapsed ? '\u25B6' : '\u25BC'}
        </span>
        <h3 className="ics-title">Inherited Strategic Context</h3>
        <span className="ics-count-badge">{totalItems}</span>
        {data.syncStatus.pendingAcknowledgments > 0 && (
          <span className="ics-pending-indicator">
            {data.syncStatus.pendingAcknowledgments} pending
          </span>
        )}
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className={`ics-content ${sidePanelOpen ? 'ics-with-panel' : ''}`}>
          <div className="ics-main-area">
            {/* Dashboard widget */}
            <ContextDashboardWidget
              ancestors={data.ancestors}
              syncStatus={data.syncStatus}
              pendingAcknowledgments={data.syncStatus.pendingAcknowledgments}
              onRefresh={fetchContext}
            />

            {/* Acknowledgment banner — severity-tiered */}
            {data.syncStatus.pendingAcknowledgments > 0 && (
              <AcknowledgmentBanner
                pendingAcks={pendingAcks}
                changelogEntries={data.changelog}
                onAcknowledge={handleAcknowledge}
                onViewChanges={() => setActiveTab('changelog')}
              />
            )}

            {/* Tab toggle */}
            <div className="ics-tab-bar">
              <button
                className={`ics-tab ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveTab('documents')}
              >
                Documents
              </button>
              <button
                className={`ics-tab ${activeTab === 'rfis' ? 'active' : ''}`}
                onClick={() => setActiveTab('rfis')}
              >
                RFIs
              </button>
              <button
                className={`ics-tab ${activeTab === 'changelog' ? 'active' : ''}`}
                onClick={() => setActiveTab('changelog')}
              >
                Changelog
                {data.changelog.length > 0 && (
                  <span className="ics-tab-count">{data.changelog.length}</span>
                )}
              </button>
            </div>

            {/* Documents view */}
            {activeTab === 'documents' && (
              <div className="ics-documents">
                {echelonGroups.map((group) => {
                  const colors = ECHELON_COLORS[group.echelon];
                  return (
                    <div key={group.echelon} className="ics-echelon-group">
                      <div
                        className="ics-echelon-header"
                        style={{ borderLeftColor: colors.border }}
                      >
                        <span
                          className="ics-echelon-label"
                          style={{ color: colors.border }}
                        >
                          {group.label}
                        </span>
                        <span className="ics-echelon-count">
                          {group.docs.length} document
                          {group.docs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="ics-card-list">
                        {group.docs.map((doc) => (
                          <InheritedItemCard
                            key={doc.id}
                            item={doc}
                            echelon={group.echelon}
                            isExpanded={expandedItemId === doc.id}
                            onToggleExpand={() => handleToggleExpand(doc.id)}
                            onAnnotate={handleAnnotate}
                            onRequestInfo={handleRequestInfo}
                            annotations={annotationsByItem[doc.id]}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Graph summaries */}
                {data.inheritedGraphSummaries.length > 0 && (
                  <div className="ics-echelon-group">
                    <div
                      className="ics-echelon-header"
                      style={{ borderLeftColor: '#8B5CF6' }}
                    >
                      <span
                        className="ics-echelon-label"
                        style={{ color: '#8B5CF6' }}
                      >
                        Knowledge Graph
                      </span>
                      <span className="ics-echelon-count">
                        {data.inheritedGraphSummaries.length} item
                        {data.inheritedGraphSummaries.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="ics-card-list">
                      {data.inheritedGraphSummaries.map(
                        (gs: InheritedGraphSummary) => {
                          const echelon = (gs.sourceEchelon || 'operational') as Echelon;
                          return (
                            <InheritedItemCard
                              key={gs.containerName}
                              item={gs}
                              echelon={echelon}
                              isExpanded={expandedItemId === gs.containerName}
                              onToggleExpand={() =>
                                handleToggleExpand(gs.containerName)
                              }
                              onAnnotate={handleAnnotate}
                              onRequestInfo={handleRequestInfo}
                              annotations={
                                annotationsByItem[gs.containerName]
                              }
                            />
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

                {totalItems === 0 && (
                  <div className="ics-empty">
                    No inherited documents or graph data available.
                  </div>
                )}
              </div>
            )}

            {/* RFIs view */}
            {activeTab === 'rfis' && (
              <div className="ics-rfis">
                <div className="ics-rfi-section">
                  <h4 style={{ color: '#e5e7eb', margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Sent RFIs
                  </h4>
                  <RFIList
                    problemSetId={problemSetId}
                    direction="sent"
                    onSelectRFI={handleSelectRFI}
                  />
                </div>
                <div className="ics-rfi-section" style={{ marginTop: '16px' }}>
                  <h4 style={{ color: '#e5e7eb', margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Received RFIs
                  </h4>
                  <RFIList
                    problemSetId={problemSetId}
                    direction="received"
                    onSelectRFI={handleSelectRFI}
                  />
                </div>
              </div>
            )}

            {/* Changelog view */}
            {activeTab === 'changelog' && (
              <ChangelogView changelog={data.changelog} />
            )}
          </div>

          {/* Slide-out Annotation Panel */}
          {annotatingItemId && annotatingMeta && (
            <div className="ics-side-panel">
              <AnnotationPanel
                problemSetId={problemSetId}
                sourceProblemSetId={annotatingMeta.sourceProblemSetId}
                targetItemId={annotatingItemId}
                targetItemType={annotatingMeta.itemType}
                itemTitle={annotatingMeta.itemTitle}
                sourceEchelon={annotatingMeta.sourceEchelon}
                onClose={handleCloseAnnotationPanel}
              />
            </div>
          )}

          {/* Slide-out RFI Panel — create mode */}
          {rfiMode && rfiCreateMeta && (
            <div className="ics-side-panel">
              <div className="ics-side-panel-header">
                <h4 style={{ color: '#e5e7eb', margin: 0, fontSize: '14px' }}>
                  Create RFI
                </h4>
                <button
                  className="ics-side-panel-close"
                  onClick={handleCloseRfiPanel}
                  aria-label="Close RFI panel"
                >
                  X
                </button>
              </div>
              <RFIThread
                problemSetId={problemSetId}
                targetProblemSetId={rfiMode.targetPsId}
                targetItemId={rfiMode.itemId}
                targetItemType={rfiCreateMeta.itemType}
                problemSetName=""
                targetProblemSetName={rfiCreateMeta.sourceProblemSetName}
                onClose={handleCloseRfiPanel}
              />
            </div>
          )}

          {/* Slide-out RFI Panel — thread view */}
          {viewingRfiId && (
            <div className="ics-side-panel">
              <div className="ics-side-panel-header">
                <h4 style={{ color: '#e5e7eb', margin: 0, fontSize: '14px' }}>
                  RFI Thread
                </h4>
                <button
                  className="ics-side-panel-close"
                  onClick={handleCloseRfiPanel}
                  aria-label="Close RFI panel"
                >
                  X
                </button>
              </div>
              <RFIThread
                problemSetId={problemSetId}
                rfiId={viewingRfiId}
                onClose={handleCloseRfiPanel}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
