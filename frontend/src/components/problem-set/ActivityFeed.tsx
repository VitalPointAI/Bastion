/**
 * ActivityFeed
 *
 * Chronological activity feed component with role-based visibility filtering.
 * - Commanders/XO see all activity types
 * - Staff (s1-s9, team_lead, member) sees joins/departures/missions
 * - Observers see summary-level activity only
 * - Polls for new activity every 15 seconds
 * - "Load more" pagination
 * - Shows on-chain TX hash links for anchored events
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { problemSetService, type ProblemSetActivityItem } from '../../lib/problem-set-service';
import { useUser } from '../../context/UserContext';

// ─── Role-based visibility ────────────────────────────────────────────────────

const ROBOT_EVENT_TYPES = [
  'robot_mission_accepted',
  'robot_mission_executing',
  'robot_mission_awaiting_auth',
  'robot_mission_complete',
  'robot_mission_failed',
];

const COMMANDER_VISIBLE = [
  'workspace_created',
  'member_joined',
  'member_removed',
  'member_suspended',
  'member_unsuspended',
  'role_changed',
  'invite_sent',
  'invite_accepted',
  'invite_cancelled',
  'mission_created',
  'exercise_created',
  'workspace_updated',
  ...ROBOT_EVENT_TYPES,
];

const STAFF_VISIBLE = [
  'member_joined',
  'member_removed',
  'mission_created',
  'exercise_created',
  'workspace_updated',
  ...ROBOT_EVENT_TYPES,
];

const OBSERVER_VISIBLE = ['workspace_updated', 'mission_created'];

function getVisibleTypes(role: string | null): string[] {
  if (!role) return OBSERVER_VISIBLE;
  if (['commander', 'xo'].includes(role)) return COMMANDER_VISIBLE;
  if (role === 'observer') return OBSERVER_VISIBLE;
  return STAFF_VISIBLE; // s1-s9, team_lead, member
}

// ─── Activity description builder ────────────────────────────────────────────

function shortDid(did: string): string {
  if (!did) return 'Unknown';
  const parts = did.split(':');
  const last = parts[parts.length - 1];
  return last.length > 10 ? `${last.slice(0, 6)}...${last.slice(-4)}` : last;
}

function resolveName(did: string, displayNames: Record<string, string>): string {
  if (!did) return 'Unknown';
  if (displayNames[did]) return displayNames[did];
  return shortDid(did);
}

function buildDescription(item: ProblemSetActivityItem, displayNames: Record<string, string>): string {
  const actor = resolveName(item.actorDid, displayNames);
  const subject = item.subjectDid ? resolveName(item.subjectDid, displayNames) : null;
  const meta = item.metadata;

  switch (item.activityType) {
    case 'workspace_created':
      return `${actor} created this problem set`;
    case 'workspace_updated':
      return `${actor} updated problem set settings`;
    case 'member_joined':
      if (subject) {
        return `${actor} invited ${subject} as ${String(meta.role ?? 'member')}`;
      }
      return `${actor} joined as ${String(meta.role ?? 'member')}`;
    case 'member_removed':
      return `${actor} removed ${subject ?? 'a member'}`;
    case 'member_suspended':
      return `${actor} suspended ${subject ?? 'a member'}`;
    case 'member_unsuspended':
      return `${actor} unsuspended ${subject ?? 'a member'}`;
    case 'role_changed':
      return `${actor} changed ${subject ?? 'a member'}'s role from ${String(meta.oldRole ?? '?')} to ${String(meta.newRole ?? '?')}`;
    case 'invite_sent':
      return `${actor} sent an invite for role ${String(meta.role ?? 'member')}`;
    case 'invite_accepted':
      return `${subject ?? actor} accepted an invite`;
    case 'invite_cancelled':
      return `${actor} cancelled an invite`;
    case 'mission_created':
      return `${actor} created mission${meta.missionName ? `: ${String(meta.missionName)}` : ''}`;
    case 'exercise_created':
      return `${actor} created exercise${meta.exerciseName ? `: ${String(meta.exerciseName)}` : ''}`;
    case 'robot_mission_accepted':
      return `Robot ${String(meta.robot_id ?? actor)} accepted mission ${String(meta.mission_command ?? '')}`;
    case 'robot_mission_executing':
      return `Robot ${String(meta.robot_id ?? actor)} executing ${String(meta.mission_command ?? 'mission')}`;
    case 'robot_mission_awaiting_auth':
      return `Robot ${String(meta.robot_id ?? actor)} requesting authorization`;
    case 'robot_mission_complete':
      return `Robot ${String(meta.robot_id ?? actor)} completed ${String(meta.mission_command ?? 'mission')}`;
    case 'robot_mission_failed':
      return `Robot ${String(meta.robot_id ?? actor)} mission failed${meta.reason ? `: ${String(meta.reason)}` : ''}`;
    default:
      return `${actor} performed ${item.activityType.replace(/_/g, ' ')}`;
  }
}

// ─── Relative time formatter ──────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return new Date(isoString).toLocaleDateString();
}

// ─── Activity type icon ───────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  const base =
    'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm';

  switch (type) {
    case 'workspace_created':
    case 'workspace_updated':
      return (
        <div className={`${base} bg-blue-900 text-blue-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 10.414V16a1 1 0 01-.553.894l-4 2A1 1 0 017 18v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
        </div>
      );
    case 'member_joined':
    case 'invite_accepted':
      return (
        <div className={`${base} bg-green-900 text-green-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zm4 0a1 1 0 10-2 0v1H9a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V9z" />
          </svg>
        </div>
      );
    case 'member_removed':
      return (
        <div className={`${base} bg-red-900 text-red-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM14 17a6 6 0 00-12 0h12zM13 8a1 1 0 100 2h4a1 1 0 100-2h-4z" />
          </svg>
        </div>
      );
    case 'member_suspended':
    case 'member_unsuspended':
      return (
        <div className={`${base} bg-yellow-900 text-yellow-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'role_changed':
      return (
        <div className={`${base} bg-purple-900 text-purple-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'invite_sent':
    case 'invite_cancelled':
      return (
        <div className={`${base} bg-indigo-900 text-indigo-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
        </div>
      );
    case 'mission_created':
    case 'exercise_created':
      return (
        <div className={`${base} bg-orange-900 text-orange-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'robot_mission_accepted':
    case 'robot_mission_executing':
    case 'robot_mission_complete':
    case 'robot_mission_awaiting_auth':
    case 'robot_mission_failed':
      return (
        <div className={`${base} ${type.includes('failed') ? 'bg-red-900 text-red-300' : type.includes('awaiting') ? 'bg-yellow-900 text-yellow-300' : 'bg-cyan-900 text-cyan-300'}`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10 2a1.5 1.5 0 011.5 1.5c0 .56-.31 1.04-.76 1.3V6h.76a5.5 5.5 0 015.5 5.5V12H3v-.5A5.5 5.5 0 018.5 6h.76V4.8c-.45-.26-.76-.74-.76-1.3A1.5 1.5 0 0110 2zM6 13.5a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zM4 16.5v.5a1 1 0 001 1h10a1 1 0 001-1v-.5H4z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className={`${base} bg-gray-700 text-gray-300`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
  }
}

// ─── NEAR explorer link ───────────────────────────────────────────────────────

const NEAR_EXPLORER_BASE = 'https://nearblocks.io/txns';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  problemSetId: string;
  userRole: string | null;
  limit?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityFeed({ problemSetId, userRole, limit = 20 }: ActivityFeedProps) {
  const { userDID } = useUser();
  const [activities, setActivities] = useState<ProblemSetActivityItem[]>([]);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const visibleTypes = getVisibleTypes(userRole);

  // ─── Fetch activities ──────────────────────────────────────────────────────

  const fetchActivities = useCallback(
    async (currentOffset: number, replace = false) => {
      if (!userDID) return;
      setLoading(true);
      setError(null);
      try {
        const result = await problemSetService.listActivity(problemSetId, userDID, {
          limit: limit + 1,
          offset: currentOffset,
        });

        const hasMoreItems = result.activities.length > limit;
        const page = hasMoreItems ? result.activities.slice(0, limit) : result.activities;

        setHasMore(hasMoreItems);
        setActivities((prev) => (replace ? page : [...prev, ...page]));
        setDisplayNames((prev) => ({ ...prev, ...result.displayNames }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    },
    [problemSetId, userDID, limit]
  );

  // ─── Initial load and problem set change ────────────────────────────────────

  useEffect(() => {
    setActivities([]);
    setOffset(0);
    setHasMore(true);
    void fetchActivities(0, true);
  }, [problemSetId, fetchActivities]);

  // ─── Auto-refresh every 15 seconds ────────────────────────────────────────

  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      void fetchActivities(0, true);
      setOffset(0);
    }, 15000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchActivities]);

  // ─── Load more ────────────────────────────────────────────────────────────

  const handleLoadMore = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    void fetchActivities(newOffset);
  };

  // ─── Filter by visible types ──────────────────────────────────────────────

  const filtered = activities.filter((item) => visibleTypes.includes(item.activityType));

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="text-red-400 text-sm p-4 bg-red-900 bg-opacity-20 rounded-lg">
        Failed to load activity: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Timeline items */}
      {filtered.length === 0 && !loading ? (
        <div className="text-gray-500 text-sm text-center py-8">No activity yet</div>
      ) : (
        <ol className="relative" aria-label="Problem Set activity feed">
          {filtered.map((item, index) => (
            <li key={item.id} className="flex gap-3 pb-4 relative">
              {/* Connecting timeline line */}
              {index < filtered.length - 1 && (
                <div
                  className="absolute top-8 left-4 w-0.5 bg-gray-700"
                  style={{ bottom: 0 }}
                  aria-hidden="true"
                />
              )}

              {/* Icon */}
              <ActivityIcon type={item.activityType} />

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm text-gray-200 leading-snug">
                  {buildDescription(item, displayNames)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <time
                    className="text-xs text-gray-500"
                    dateTime={item.createdAt}
                    title={new Date(item.createdAt).toLocaleString()}
                  >
                    {relativeTime(item.createdAt)}
                  </time>

                  {/* On-chain badge */}
                  {item.txHash && (
                    <a
                      href={`${NEAR_EXPLORER_BASE}/${item.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      title="View on NEAR explorer"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                          clipRule="evenodd"
                        />
                      </svg>
                      on-chain
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-gray-500 text-sm text-center py-3 animate-pulse">
          Loading activity...
        </div>
      )}

      {/* Load more button */}
      {!loading && hasMore && filtered.length > 0 && (
        <button
          onClick={handleLoadMore}
          className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors self-center"
        >
          Load more
        </button>
      )}
    </div>
  );
}
