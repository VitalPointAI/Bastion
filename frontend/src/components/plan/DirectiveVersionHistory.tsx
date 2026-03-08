/**
 * DirectiveVersionHistory
 *
 * Phase 36 Plan 04: Version list panel with changelog entries and
 * section-level diff indicators for strategic directive versions.
 */

import { useState, useEffect, useCallback } from 'react';
import { sgService, type DirectiveVersion } from '../../lib/strategic-guidance-service.ts';

// ---------------------------------------------------------------------------
// Section diff helpers
// ---------------------------------------------------------------------------

const DIFF_FIELDS = [
  { key: 'commandersIntent', label: "Commander's Intent" },
  { key: 'planningGuidance', label: 'Planning Guidance' },
  { key: 'directiveSections', label: 'Directive Sections' },
  { key: 'additionalGuidance', label: 'Additional Guidance' },
] as const;

function computeSectionDiffs(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): Array<{ label: string; changed: boolean }> {
  return DIFF_FIELDS.map(({ key, label }) => {
    const a = JSON.stringify((current as Record<string, unknown>)[key] ?? '');
    const b = JSON.stringify((previous as Record<string, unknown>)[key] ?? '');
    return { label, changed: a !== b };
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DirectiveVersionHistoryProps {
  instanceId: string;
  currentVersion?: number;
  refreshSignal?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DirectiveVersionHistory({
  instanceId,
  currentVersion: _currentVersion,
  refreshSignal,
}: DirectiveVersionHistoryProps) {
  const [versions, setVersions] = useState<DirectiveVersion[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sgService.getDirectiveVersions(instanceId);
      setVersions(data);
    } catch (err) {
      console.error('[DirectiveVersionHistory] Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions, refreshSignal]);

  if (loading && versions.length === 0) {
    return (
      <div style={{ color: '#9ca3af', fontSize: '0.8rem', padding: '0.5rem 0' }}>
        Loading version history...
      </div>
    );
  }

  const count = versions.length;

  return (
    <div
      style={{
        border: '1px solid rgba(107, 114, 128, 0.3)',
        borderRadius: '0.375rem',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.625rem 0.75rem',
          backgroundColor: 'rgba(55, 65, 81, 0.4)',
          border: 'none',
          cursor: 'pointer',
          color: '#d1d5db',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        <span>Version History ({count})</span>
        <span
          style={{
            fontSize: '0.6rem',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        >
          &#9660;
        </span>
      </button>

      {/* Version list */}
      {expanded && (
        <div style={{ padding: '0.5rem 0.75rem' }}>
          {count === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, fontStyle: 'italic' }}>
              No directive versions yet. Finalize the directive to create the first version.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[...versions].reverse().map((version, idx) => {
                const prevVersion = versions.find((v) => v.version === version.version - 1);
                const diffs =
                  prevVersion && version.content && prevVersion.content
                    ? computeSectionDiffs(
                        version.content as Record<string, unknown>,
                        prevVersion.content as Record<string, unknown>,
                      )
                    : null;
                const isExpanded = expandedVersion === version.version;

                return (
                  <div
                    key={version.id || idx}
                    style={{
                      border: '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '0.25rem',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Version header */}
                    <button
                      onClick={() =>
                        setExpandedVersion(isExpanded ? null : version.version)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.5rem 0.625rem',
                        backgroundColor: 'rgba(55, 65, 81, 0.25)',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#d1d5db',
                        fontSize: '0.8rem',
                      }}
                    >
                      {/* Version badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.125rem 0.5rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          borderRadius: '0.25rem',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        v{version.version}
                      </span>

                      {/* Date and author */}
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                        {new Date(version.createdAt).toLocaleDateString()} by{' '}
                        {version.createdBy || 'Unknown'}
                      </span>

                      {/* Section diff indicators */}
                      {diffs && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            gap: '0.25rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          {diffs
                            .filter((d) => d.changed)
                            .map((d) => (
                              <span
                                key={d.label}
                                style={{
                                  padding: '0.0625rem 0.375rem',
                                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                  color: '#fbbf24',
                                  borderRadius: '0.125rem',
                                  fontSize: '0.65rem',
                                  fontWeight: 500,
                                }}
                              >
                                {d.label}
                              </span>
                            ))}
                        </span>
                      )}
                    </button>

                    {/* Changelog */}
                    {version.changelog && (
                      <div
                        style={{
                          padding: '0.25rem 0.625rem',
                          fontSize: '0.75rem',
                          color: '#9ca3af',
                          fontStyle: 'italic',
                        }}
                      >
                        {version.changelog}
                      </div>
                    )}

                    {/* Expanded content view */}
                    {isExpanded && version.content && (
                      <div
                        style={{
                          padding: '0.625rem',
                          borderTop: '1px solid rgba(107, 114, 128, 0.2)',
                          fontSize: '0.8rem',
                          color: '#d1d5db',
                        }}
                      >
                        <VersionContentView content={version.content as Record<string, unknown>} />
                      </div>
                    )}
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

// ---------------------------------------------------------------------------
// Read-only version content view
// ---------------------------------------------------------------------------

function VersionContentView({ content }: { content: Record<string, unknown> }) {
  const intent = content.commandersIntent as Record<string, unknown> | undefined;
  const planningGuidance = (content.planningGuidance as string) || '';
  const sections = (content.directiveSections as Array<{ title: string; content: string }>) || [];
  const additionalGuidance = (content.additionalGuidance as string) || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Commander's Intent */}
      {intent && (
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#93c5fd' }}>
            Commander's Intent
          </h4>
          <div style={{ paddingLeft: '0.5rem', fontSize: '0.75rem' }}>
            <p style={{ margin: '0.125rem 0' }}>
              <strong>Purpose:</strong> {(intent.purpose as string) || 'N/A'}
            </p>
            <p style={{ margin: '0.125rem 0' }}>
              <strong>End State:</strong> {(intent.endState as string) || 'N/A'}
            </p>
            {Array.isArray(intent.keyTasks) && intent.keyTasks.length > 0 && (
              <p style={{ margin: '0.125rem 0' }}>
                <strong>Key Tasks:</strong> {intent.keyTasks.join('; ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Planning Guidance */}
      {planningGuidance && (
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#93c5fd' }}>
            Planning Guidance
          </h4>
          <p style={{ margin: 0, paddingLeft: '0.5rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {planningGuidance}
          </p>
        </div>
      )}

      {/* Directive Sections */}
      {sections.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#93c5fd' }}>
            Directive Sections
          </h4>
          {sections.map((s, i) => (
            <div key={i} style={{ paddingLeft: '0.5rem', marginBottom: '0.375rem' }}>
              <p style={{ margin: '0 0 0.125rem', fontWeight: 600, fontSize: '0.75rem' }}>
                {s.title}
              </p>
              <p style={{ margin: 0, fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>{s.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Additional Guidance */}
      {additionalGuidance && (
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#93c5fd' }}>
            Additional Guidance
          </h4>
          <p style={{ margin: 0, paddingLeft: '0.5rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {additionalGuidance}
          </p>
        </div>
      )}
    </div>
  );
}
