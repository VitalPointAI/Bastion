/**
 * InheritedContextSection
 *
 * Phase 26 Plan 03: Top-level orchestrating component for inherited strategic
 * context display. Composes ContextDashboardWidget, AcknowledgmentBanner,
 * InheritedItemCard, and ChangelogView into a collapsible section.
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
  PendingAck,
} from '../../lib/inheritance-service.ts';
import { ContextDashboardWidget } from './ContextDashboardWidget.tsx';
import { AcknowledgmentBanner } from './AcknowledgmentBanner.tsx';
import { InheritedItemCard } from './InheritedItemCard.tsx';
import { ChangelogView } from './ChangelogView.tsx';
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
  const [activeTab, setActiveTab] = useState<'documents' | 'changelog'>(
    'documents',
  );

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

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // Reset collapsed state from localStorage when problemSetId changes
  useEffect(() => {
    setIsCollapsed(getInitialCollapsed(problemSetId));
    setExpandedItemId(null);
    setActiveTab('documents');
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
        <div className="ics-content">
          {/* Dashboard widget */}
          <ContextDashboardWidget
            ancestors={data.ancestors}
            syncStatus={data.syncStatus}
            pendingAcknowledgments={data.syncStatus.pendingAcknowledgments}
            onRefresh={fetchContext}
          />

          {/* Acknowledgment banner */}
          {data.syncStatus.pendingAcknowledgments > 0 && (
            <AcknowledgmentBanner
              pendingAcks={pendingAcks}
              onAcknowledge={handleAcknowledge}
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

          {/* Changelog view */}
          {activeTab === 'changelog' && (
            <ChangelogView changelog={data.changelog} />
          )}
        </div>
      )}
    </div>
  );
}
