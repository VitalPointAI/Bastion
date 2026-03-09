/**
 * OSINTAlertBanner
 *
 * Phase 33 Plan 05: Contextual alert banner that shows recent relevant OSINT
 * events for the current JPP step. Collapsible amber banner with dismiss support.
 */

import { useState, useEffect, useCallback } from 'react';
import { osintService, type OSINTEvent } from '../../lib/osint-service.ts';

export interface OSINTAlertBannerProps {
  problemSetId: string;
  stepId: string;
  relevantEntityTypes?: string[];
  maxAlerts?: number;
}

/**
 * Maps JPP step IDs to relevance keywords for filtering OSINT events.
 * Events with entities matching these keywords score higher for the step.
 */
const STEP_RELEVANCE_KEYWORDS: Record<string, string[]> = {
  planning_initiation: ['directive', 'order', 'guidance', 'strategic'],
  mission_analysis: ['intelligence', 'threat', 'terrain', 'weather', 'civil'],
  coa_development: ['force', 'movement', 'maneuver', 'fires', 'logistics'],
  coa_analysis: ['wargame', 'scenario', 'outcome', 'casualty', 'risk'],
  coa_comparison: ['comparison', 'criteria', 'evaluation', 'advantage'],
  coa_approval: ['decision', 'approval', 'commander', 'authority'],
  plan_development: ['annex', 'order', 'task', 'synchronization', 'execution'],
};

export function OSINTAlertBanner({
  problemSetId,
  stepId,
  relevantEntityTypes,
  maxAlerts = 3,
}: OSINTAlertBannerProps) {
  const [events, setEvents] = useState<OSINTEvent[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const allEvents = await osintService.getRecentEvents(problemSetId, 50);

      // Filter by relevance to current step
      const keywords = STEP_RELEVANCE_KEYWORDS[stepId] || [];
      const filtered = allEvents
        .filter((evt) => {
          // Filter by entity types if provided
          if (relevantEntityTypes && relevantEntityTypes.length > 0) {
            // Check if any entity name loosely matches the types
            const hasRelevantEntity = evt.entities.some((e) =>
              relevantEntityTypes.some((t) =>
                e.entityName.toLowerCase().includes(t.toLowerCase()),
              ),
            );
            if (hasRelevantEntity) return true;
          }

          // Filter by step relevance keywords
          if (keywords.length > 0) {
            const text = `${evt.title} ${evt.content}`.toLowerCase();
            return keywords.some((kw) => text.includes(kw));
          }

          // If no filters match, include high-relevance events
          return evt.relevanceScore >= 0.7;
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxAlerts);

      setEvents(filtered);
    } catch (err) {
      console.error('[OSINTAlertBanner] Failed to fetch events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [problemSetId, stepId, relevantEntityTypes, maxAlerts]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDismiss = useCallback((eventId: string) => {
    setDismissedIds((prev) => new Set(prev).add(eventId));
  }, []);

  // Filter out dismissed events
  const visibleEvents = events.filter((evt) => !dismissedIds.has(evt.id));

  // Render nothing if no events or loading
  if (loading || visibleEvents.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(217, 119, 6, 0.1)',
        borderLeft: '3px solid #d97706',
        borderRadius: '0.375rem',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: '#fbbf24',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '1rem' }}>&#9888;</span>
        <span>
          {visibleEvents.length} new intelligence item{visibleEvents.length !== 1 ? 's' : ''}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            color: '#9ca3af',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        >
          &#9660;
        </span>
      </button>

      {/* Expanded event list */}
      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          {visibleEvents.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid rgba(107, 114, 128, 0.2)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: '#e5e7eb',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {evt.title}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginTop: '0.25rem',
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                  }}
                >
                  {evt.sourceUrl && <span>Source: {new URL(evt.sourceUrl).hostname}</span>}
                  <span>Relevance: {Math.round(evt.relevanceScore * 100)}%</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(evt.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '0.85rem',
                  padding: '0.125rem 0.25rem',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label={`Dismiss alert: ${evt.title}`}
              >
                &#10005;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
