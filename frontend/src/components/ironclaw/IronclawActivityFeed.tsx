/**
 * IronclawActivityFeed -- Autonomous activity log panel
 *
 * Phase 65 Plan 05: Shows what Ironclaw has been doing autonomously between
 * interactions. Updates in real-time via WebSocket subscription.
 *
 * Visually distinct from chat — this is a structured log, not a conversation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AutonomousActivityEntry } from '../../types/ironclaw.ts';

// ─── Rating State ─────────────────────────────────────────────────────────────

interface ActivityRatingState {
  rating: number;
  notes: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/messages`
    : 'ws://localhost:3001/ws/messages';

// ─── Props ───────────────────────────────────────────────────────────────────

interface IronclawActivityFeedProps {
  problemSetId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a date as a relative time string (e.g. "5 min ago", "2 hours ago").
 * Falls back to locale string for older entries.
 */
function relativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m} min ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h} hour${h !== 1 ? 's' : ''} ago`;
  }
  const d = Math.floor(diffSec / 86400);
  if (d < 7) return `${d} day${d !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Severity badge colors.
 */
const SEVERITY_STYLES: Record<string, { label: string; cls: string }> = {
  critical: { label: 'CRITICAL', cls: 'bg-red-900/60 text-red-300 border border-red-700/60' },
  urgent:   { label: 'URGENT',   cls: 'bg-amber-900/60 text-amber-300 border border-amber-700/60' },
  routine:  { label: 'ROUTINE',  cls: 'bg-blue-900/40 text-blue-300 border border-blue-700/40' },
  informational: { label: 'INFO', cls: 'bg-slate-700/60 text-slate-400 border border-slate-600/40' },
};

/**
 * Activity type icon — renders an inline SVG based on the activity type string.
 */
function ActivityIcon({ activityType }: { activityType: string }) {
  const type = activityType.toLowerCase();

  // Gap detected — magnifying glass
  if (type.includes('gap')) {
    return (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );
  }

  // Conflict or contradiction — warning triangle
  if (type.includes('conflict') || type.includes('contradiction')) {
    return (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }

  // Assessment or situation report — clipboard/document
  if (type.includes('assessment') || type.includes('situation') || type.includes('draft')) {
    return (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  // Skill creation — wrench/gear
  if (type.includes('skill') || type.includes('creation')) {
    return (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      </svg>
    );
  }

  // Alert — bell
  if (type.includes('alert')) {
    return (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    );
  }

  // Default — info circle
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Icon color based on severity.
 */
function iconColorClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400';
    case 'urgent':   return 'text-amber-400';
    case 'routine':  return 'text-blue-400';
    default:         return 'text-slate-400';
  }
}

// ─── Activity Entry Card ──────────────────────────────────────────────────────

interface ActivityCardProps {
  entry: AutonomousActivityEntry;
  problemSetId: string;
  currentRating: number | null;
  onRate: (activityId: string, rating: number) => Promise<void>;
  onNotesSubmit: (activityId: string, notes: string) => Promise<void>;
}

function ActivityCard({ entry, problemSetId: _problemSetId, currentRating, onRate, onNotesSubmit }: ActivityCardProps) {
  const badge = SEVERITY_STYLES[entry.severity] ?? SEVERITY_STYLES.informational;
  const color = iconColorClass(entry.severity);

  // Show rating controls only for activities older than 30 seconds
  const [showRating, setShowRating] = useState(
    () => globalThis.Date.now() - new Date(entry.createdAt).getTime() > 30000,
  );
  useEffect(() => {
    if (showRating) return;
    const remaining = 30000 - (globalThis.Date.now() - new Date(entry.createdAt).getTime());
    if (remaining <= 0) { setShowRating(true); return; }
    const timer = setTimeout(() => setShowRating(true), remaining);
    return () => clearTimeout(timer);
  }, [showRating, entry.createdAt]);

  return (
    <div className="flex gap-3 px-3 py-2.5 border-b border-slate-700/40 hover:bg-slate-800/30 transition-colors">
      {/* Icon */}
      <div className={`mt-0.5 ${color}`}>
        <ActivityIcon activityType={entry.activityType} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: severity badge + timestamp */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-[10px] text-slate-500">
            {relativeTime(entry.createdAt)}
          </span>
          <span className="text-[9px] text-slate-600 font-mono truncate max-w-24" title={entry.activityType}>
            {entry.activityType.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Summary */}
        <p className="text-xs text-slate-300 leading-snug">{entry.summary}</p>

        {/* Decision link */}
        {entry.decisionId && (
          <a
            href={`#/decisions/${entry.decisionId}`}
            className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Decision
          </a>
        )}

        {/* Rating row — only show for activities older than 30 seconds */}
        {showRating && (
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => void onRate(entry.id, 1)}
              aria-label="Mark as helpful"
              aria-pressed={currentRating === 1}
              className={`p-1 rounded transition-colors ${
                currentRating === 1
                  ? 'text-emerald-400 bg-emerald-900/20'
                  : 'text-slate-600 hover:text-emerald-400'
              }`}
            >
              {/* Thumbs-up SVG 16px */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M4 15h0" />
              </svg>
            </button>
            <button
              onClick={() => void onRate(entry.id, -1)}
              aria-label="Mark as not helpful"
              aria-pressed={currentRating === -1}
              className={`p-1 rounded transition-colors ${
                currentRating === -1
                  ? 'text-red-400 bg-red-900/20'
                  : 'text-slate-600 hover:text-red-400'
              }`}
            >
              {/* Thumbs-down SVG 16px */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z M20 9h0" />
              </svg>
            </button>
            {/* Notes input — appears after rating click */}
            {currentRating != null && (
              <input
                type="text"
                placeholder="Optional note..."
                defaultValue={entry.commanderNotes ?? ''}
                onBlur={(e) => void onNotesSubmit(entry.id, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void onNotesSubmit(entry.id, (e.target as HTMLInputElement).value)}
                className="text-[10px] text-slate-400 placeholder:text-slate-600 bg-transparent border-b border-slate-700 outline-none flex-1"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IronclawActivityFeed({ problemSetId }: IronclawActivityFeedProps) {
  const [activities, setActivities] = useState<AutonomousActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, ActivityRatingState>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  // ─── Fetch historical activity ────────────────────────────────────────────

  const fetchActivity = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `/api/ironclaw/activity/${encodeURIComponent(problemSetId)}?limit=50`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        throw new Error(`Activity fetch failed: ${res.status}`);
      }
      const data = await res.json() as { activities: AutonomousActivityEntry[]; total: number };
      if (mountedRef.current) {
        setActivities(data.activities);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [problemSetId]);

  // ─── WebSocket subscription for real-time updates ─────────────────────────

  useEffect(() => {
    if (!problemSetId) return;

    const channel = `ironclaw.${problemSetId}`;
    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: Record<string, unknown>;
        };

        if (msg.type !== 'message' || !msg.data) return;

        const envelope = msg.data as Record<string, unknown>;
        const messageType = (envelope.messageType ?? envelope.message_type) as string | undefined;

        // Only handle autonomous-activity messages
        if (messageType !== 'ironclaw.autonomous-activity') return;

        const payload = (envelope.payload ?? {}) as Record<string, unknown>;

        // Build a frontend activity entry from the WebSocket payload
        const newEntry: AutonomousActivityEntry = {
          id: (payload.id ?? crypto.randomUUID()) as string,
          problemSetId,
          activityType: (payload.type ?? payload.activity_type ?? 'unknown') as string,
          severity: (payload.severity ?? 'informational') as AutonomousActivityEntry['severity'],
          summary: (payload.summary ?? '') as string,
          detail: (payload.detail ?? null) as Record<string, unknown> | null,
          decisionId: (payload.decision_id ?? payload.decisionId ?? null) as string | null,
          createdAt: (payload.created_at ?? payload.createdAt ?? new Date().toISOString()) as string,
        };

        if (!newEntry.summary) return; // Skip empty entries

        setActivities((prev) => [newEntry, ...prev]);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // Silently ignore WebSocket errors in the feed — not critical
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [problemSetId]);

  // ─── Initial fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    void fetchActivity();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchActivity]);

  // ─── Rating Handlers ──────────────────────────────────────────────────────

  const handleRate = useCallback(async (activityId: string, rating: number) => {
    // Optimistic update
    setRatings(prev => ({
      ...prev,
      [activityId]: { rating, notes: prev[activityId]?.notes ?? '' },
    }));
    try {
      await fetch(`/api/ironclaw/${problemSetId}/activity/${activityId}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, notes: ratings[activityId]?.notes || null }),
      });
    } catch {
      // Revert on error
      setRatings(prev => {
        const next = { ...prev };
        delete next[activityId];
        return next;
      });
    }
  }, [problemSetId, ratings]);

  const handleNotesSubmit = useCallback(async (activityId: string, notes: string) => {
    const currentRating = ratings[activityId]?.rating ?? null;
    if (currentRating == null) return;
    setRatings(prev => ({
      ...prev,
      [activityId]: { ...prev[activityId], notes },
    }));
    try {
      await fetch(`/api/ironclaw/${problemSetId}/activity/${activityId}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: currentRating, notes }),
      });
    } catch {
      // Silent failure for notes — rating was already saved
    }
  }, [problemSetId, ratings]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      {/* Feed header */}
      <div className="px-3 py-2 border-b border-slate-700/60 bg-slate-800/40 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
            Autonomous Activity
          </p>
          <p className="text-[9px] text-slate-500 mt-0.5">
            Actions Ironclaw took between interactions
          </p>
        </div>
        <button
          onClick={() => void fetchActivity()}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-700"
          title="Refresh activity"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Scrollable entry list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-24">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <div className="w-3 h-3 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
              Loading activity...
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="p-4 text-center">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => void fetchActivity()}
              className="mt-2 text-[10px] text-slate-400 hover:text-slate-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && activities.length === 0 && (
          <div className="p-6 text-center">
            <svg className="w-8 h-8 text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs text-slate-500 leading-relaxed max-w-48 mx-auto">
              No autonomous activity yet. Ironclaw will begin monitoring on the next heartbeat cycle.
            </p>
          </div>
        )}

        {!isLoading && !error && activities.length > 0 &&
          activities.map((entry) => {
            const currentRating = ratings[entry.id]?.rating ?? entry.commanderRating ?? null;
            return (
              <ActivityCard
                key={entry.id}
                entry={entry}
                problemSetId={problemSetId}
                currentRating={currentRating}
                onRate={handleRate}
                onNotesSubmit={handleNotesSubmit}
              />
            );
          })
        }
      </div>
    </div>
  );
}
