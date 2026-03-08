/**
 * DocumentVersionHistory
 *
 * Phase 33 Plan 10: Version history sidebar panel showing draft lifecycle
 * and distribution log as a vertical timeline.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  documentService,
  type VersionRecord,
  type VersionStatus,
  type DistributionRecord,
} from '../../lib/document-service.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DocumentVersionHistoryProps {
  problemSetId: string;
  planId: string;
}

type TimelineEntry =
  | { type: 'version'; data: VersionRecord }
  | { type: 'distribution'; data: DistributionRecord };

// ─── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.5)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.75rem',
};

const toggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  color: '#e5e7eb',
  fontSize: '0.85rem',
  fontWeight: 600,
};

const timelineDotBase: React.CSSProperties = {
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '50%',
  flexShrink: 0,
  marginTop: '0.25rem',
};

const statusColors: Record<VersionStatus, string> = {
  draft: '#6b7280',
  coordinating_draft: '#f59e0b',
  final: '#10b981',
};

const statusLabels: Record<VersionStatus, string> = {
  draft: 'Draft',
  coordinating_draft: 'Coordinating Draft',
  final: 'Final',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function DocumentVersionHistory({ problemSetId, planId }: DocumentVersionHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [vers, dists] = await Promise.all([
        documentService.getVersions(problemSetId, planId),
        documentService.getDistributions(problemSetId, planId),
      ]);
      setVersions(vers);
      setDistributions(dists);
    } catch (err) {
      console.error('[DocumentVersionHistory] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [problemSetId, planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge versions and distributions into a single timeline
  const timeline: TimelineEntry[] = [
    ...versions.map((v) => ({ type: 'version' as const, data: v })),
    ...distributions.map((d) => ({ type: 'distribution' as const, data: d })),
  ].sort((a, b) => {
    const dateA = a.type === 'version' ? a.data.createdAt : a.data.distributedAt;
    const dateB = b.type === 'version' ? b.data.createdAt : b.data.distributedAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const entryCount = timeline.length;

  return (
    <div style={panelStyle}>
      <button onClick={() => setExpanded(!expanded)} style={toggleStyle}>
        <span>
          Version History
          {entryCount > 0 && (
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 400, marginLeft: '0.5rem' }}>
              ({entryCount} entries)
            </span>
          )}
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        >
          &#9660;
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          {loading ? (
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Loading version history...</div>
          ) : timeline.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              No versions yet. Save the plan to create the first draft.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {timeline.map((entry, idx) => {
                const isLast = idx === timeline.length - 1;

                if (entry.type === 'version') {
                  const v = entry.data;
                  const dotColor = statusColors[v.status] || '#6b7280';

                  return (
                    <div
                      key={`v-${v.versionId}`}
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        paddingBottom: isLast ? 0 : '0.5rem',
                      }}
                    >
                      {/* Timeline connector */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '1rem' }}>
                        <div style={{ ...timelineDotBase, backgroundColor: dotColor }} />
                        {!isLast && (
                          <div
                            style={{
                              width: '1px',
                              flex: 1,
                              backgroundColor: 'rgba(75, 85, 99, 0.4)',
                              marginTop: '0.125rem',
                            }}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.1rem 0.3rem',
                              borderRadius: '0.2rem',
                              fontSize: '0.6rem',
                              fontWeight: 600,
                              textTransform: 'uppercase' as const,
                              backgroundColor: `${dotColor}22`,
                              border: `1px solid ${dotColor}44`,
                              color: dotColor,
                            }}
                          >
                            {statusLabels[v.status]}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                            {new Date(v.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                          by {v.createdBy}
                        </div>
                        {v.notes && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#d1d5db',
                              marginTop: '0.125rem',
                              fontStyle: 'italic',
                            }}
                          >
                            {v.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Distribution entry
                const d = entry.data;
                return (
                  <div
                    key={`d-${d.distributionId}-${d.targetProblemSetId}`}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      paddingBottom: isLast ? 0 : '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '1rem' }}>
                      <div
                        style={{
                          ...timelineDotBase,
                          backgroundColor: '#3b82f6',
                          borderRadius: '0.125rem',
                        }}
                      />
                      {!isLast && (
                        <div
                          style={{
                            width: '1px',
                            flex: 1,
                            backgroundColor: 'rgba(75, 85, 99, 0.4)',
                            marginTop: '0.125rem',
                          }}
                        />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>
                        Distributed to {d.targetProblemSetId}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                        {new Date(d.distributedAt).toLocaleString()} by {d.distributedBy}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
