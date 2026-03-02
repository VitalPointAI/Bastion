/**
 * ChannelFeed
 *
 * Phase 16 Plan 05: SSE-connected real-time activity log for an AI-assigned role.
 *
 * Subscribes to GET /api/exercise/scenarios/:id/roles/:roleKey/channel (SSE stream).
 * Deduplicates events by ID on reconnect/backfill overlap.
 * Auto-scrolls to the bottom when new events arrive.
 *
 * The `review_required` event type calls onReviewRequired(runId) so the parent
 * workspace can surface the ProductReviewPanel.
 */

import { useEffect, useRef, useState } from 'react';
import './ChannelFeed.css';
import { ChannelEvent } from './ChannelEvent';
import type { AIChannelEvent } from '../../types/exercise';

interface ChannelFeedProps {
  scenarioId: string;
  roleKey: string;
  activeRunId?: string;
  onReviewRequired: (runId: string) => void;
}

export function ChannelFeed({ scenarioId, roleKey, onReviewRequired }: ChannelFeedProps) {
  const [events, setEvents] = useState<AIChannelEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // SSE subscription — reconnects when scenarioId or roleKey changes
  useEffect(() => {
    const API_BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';
    const url = `${API_BASE}/api/exercise/scenarios/${encodeURIComponent(scenarioId)}/roles/${encodeURIComponent(roleKey)}/channel`;
    const source = new EventSource(url);

    source.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    source.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as AIChannelEvent;
        setEvents(prev => {
          // Deduplicate by id in case of reconnect/backfill overlap
          if (prev.some(p => p.id === event.id)) return prev;
          return [...prev, event];
        });
      } catch {
        // Ignore malformed SSE data
      }
    };

    source.onerror = () => {
      setIsConnected(false);
      setError('Connection lost — reconnecting...');
      source.close();
    };

    return () => {
      source.close();
    };
  }, [scenarioId, roleKey]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events.length]);

  return (
    <div className="channel-feed">
      <div className="cf-header">
        <span className="cf-title">Activity</span>
        <div className="cf-status-group">
          {error && (
            <span className="cf-error-label" title={error}>!</span>
          )}
          <span
            className={`cf-status ${isConnected ? 'cf-connected' : 'cf-disconnected'}`}
            aria-label={isConnected ? 'Connected' : 'Disconnected'}
            title={isConnected ? 'Live' : 'Disconnected'}
          >
            {isConnected ? '●' : '○'}
          </span>
        </div>
      </div>
      <div className="cf-event-list" ref={listRef}>
        {events.length === 0 ? (
          <div className="cf-empty">
            Waiting for agent activity...
          </div>
        ) : (
          events.map(event => (
            <ChannelEvent
              key={event.id}
              event={event}
              onReviewAction={onReviewRequired}
            />
          ))
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
