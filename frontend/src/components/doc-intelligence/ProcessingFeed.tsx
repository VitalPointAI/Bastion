/**
 * ProcessingFeed - Real-time activity log for document intelligence processing
 *
 * Scrollable feed displaying SSE events as specialists analyze, extract,
 * and link document content. Most recent events at top, auto-scrolls,
 * color-coded by specialist type.
 */

import { useEffect, useRef } from 'react';
import type { ProcessingEvent } from '../../hooks/useDocProcessing';

// ============================================================================
// Color coding by specialist
// ============================================================================

const AGENT_COLORS: Record<string, string> = {
  'format-converter': 'text-gray-400',
  'document-classifier': 'text-purple-400',
  'trust-agent': 'text-yellow-400',
  'fact-extractor': 'text-cyan-400',
  'objective-extractor': 'text-orange-400',
  'perspective-analyst': 'text-emerald-400',
  'bias-identifier': 'text-rose-400',
  'cross-doc-linker': 'text-indigo-400',
  'quality-assessor': 'text-amber-400',
  'researcher': 'text-teal-400',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  'specialist:start': 'Started',
  'specialist:progress': 'Progress',
  'specialist:complete': 'Complete',
  'specialist:error': 'Specialist Error',
  'report:assembled': 'Report Ready',
  'processing:error': 'Error',
  'processing:flagged': 'Flagged',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return '--:--:--';
  }
}

// ============================================================================
// ProcessingFeed Component
// ============================================================================

interface ProcessingFeedProps {
  events: ProcessingEvent[];
  maxHeight?: string;
}

export function ProcessingFeed({ events, maxHeight = '300px' }: ProcessingFeedProps) {
  const topRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest event) when events change
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Processing Feed
        </h3>
        <p className="text-xs text-gray-500 text-center py-4">
          Waiting for processing events...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-950 px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Processing Feed
        </h3>
        <span className="text-[10px] text-gray-500 font-mono">
          {events.length} events
        </span>
      </div>
      <div
        className="overflow-y-auto font-mono text-xs"
        style={{ maxHeight }}
      >
        <div ref={topRef} />
        {events.map((evt) => {
          const agentColor = evt.agentId
            ? AGENT_COLORS[evt.agentId] || 'text-gray-400'
            : 'text-gray-400';
          const isError = evt.eventType === 'processing:error' || evt.eventType === 'specialist:error';
          const isFlagged = evt.eventType === 'processing:flagged';
          const isComplete = evt.eventType === 'specialist:complete' || evt.eventType === 'report:assembled';

          return (
            <div
              key={evt.id}
              className={`px-3 py-1.5 border-b border-gray-800/50 hover:bg-gray-800/30 flex items-start gap-2 ${
                isError ? 'bg-red-950/20' : isFlagged ? 'bg-amber-950/20' : ''
              }`}
            >
              {/* Timestamp */}
              <span className="text-gray-500 shrink-0">
                [{formatTimestamp(evt.timestamp)}]
              </span>

              {/* Agent name */}
              {evt.agentName && (
                <span className={`${agentColor} shrink-0 font-medium`}>
                  {evt.agentName}:
                </span>
              )}

              {/* Event detail */}
              <span
                className={`${
                  isError
                    ? 'text-red-400'
                    : isFlagged
                    ? 'text-amber-400'
                    : isComplete
                    ? 'text-green-400'
                    : 'text-gray-300'
                } flex-1`}
              >
                {evt.detail ||
                  EVENT_TYPE_LABELS[evt.eventType] ||
                  evt.eventType}
                {evt.entitiesFound != null && evt.entitiesFound > 0 && (
                  <span className="text-cyan-400 ml-1">
                    ({evt.entitiesFound} entities)
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
