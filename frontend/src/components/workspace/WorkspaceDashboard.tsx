/**
 * WorkspaceDashboard
 *
 * Map-centric Overview tab. The StrategicValidityDashboard fills the entire
 * content area as the Common Operating Picture. A narrow always-visible left
 * sidebar shows activity and decision feed badges; clicking expands to show
 * full feed details with navigation to actionable items.
 *
 * Phase 20: Redesigned from stacked panels to map-first layout with sidebar drawer.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ActivityFeed } from './ActivityFeed';
import { StrategicValidityDashboard } from '../validity/index.js';

// ─── WorkspaceDashboard ───────────────────────────────────────────────────────

export function WorkspaceDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const {
    activeWorkspaceId,
    userRoleInActive,
    memberships,
    loading,
    setActiveWorkspace,
    tabNotifications,
    crossWorkspaceUpdates,
  } = useWorkspace();

  // Sidebar expanded state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Which feed is visible when expanded: 'activity' | 'decisions'
  const [activeFeed, setActiveFeed] = useState<'activity' | 'decisions'>('activity');

  // Sync URL workspaceId → context
  useEffect(() => {
    if (workspaceId && workspaceId !== activeWorkspaceId) {
      setActiveWorkspace(workspaceId);
    }
  }, [workspaceId, activeWorkspaceId, setActiveWorkspace]);

  // ─── Guards ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspaceId && !activeWorkspaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Workspace Selected</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select a workspace from the sidebar or create a new one.
        </p>
      </div>
    );
  }

  const resolvedId = workspaceId ?? activeWorkspaceId;
  const isMember = memberships.some((m) => m.workspaceId === resolvedId);

  if (resolvedId && !loading && memberships.length > 0 && !isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <div className="text-4xl mb-3">&#128274;</div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Access Denied</h3>
        <p className="text-sm text-gray-500">You are not a member of this workspace.</p>
      </div>
    );
  }

  const displayId = workspaceId ?? activeWorkspaceId ?? '';

  // Badge counts
  const activityCount = tabNotifications['activity'] ?? 0;
  const decisionCount = (tabNotifications['escalations'] ?? 0) + (tabNotifications['directives'] ?? 0);

  // Decision items from cross-workspace updates
  const decisionItems = crossWorkspaceUpdates.filter(
    (u) => u.updateType === 'escalation' || u.updateType === 'new_directive'
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex h-full bg-gray-900 overflow-hidden">

      {/* ── Left sidebar: always visible narrow strip ──────────────────────── */}
      <div
        className={[
          'flex flex-col bg-gray-800 border-r border-gray-700 transition-all duration-200 shrink-0 z-10',
          sidebarOpen ? 'w-80' : 'w-12',
        ].join(' ')}
      >
        {/* Collapsed: icon buttons with badges */}
        <div className={`flex flex-col items-center gap-1 pt-3 ${sidebarOpen ? 'hidden' : ''}`}>
          {/* Activity button */}
          <button
            onClick={() => { setSidebarOpen(true); setActiveFeed('activity'); }}
            className="relative p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            title="Activity Feed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {activityCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-blue-500 rounded-full px-1">
                {activityCount > 99 ? '99+' : activityCount}
              </span>
            )}
          </button>

          {/* Decisions button */}
          <button
            onClick={() => { setSidebarOpen(true); setActiveFeed('decisions'); }}
            className="relative p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            title="Decision Feed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {decisionCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-amber-500 rounded-full px-1">
                {decisionCount > 99 ? '99+' : decisionCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded: full feed panel */}
        {sidebarOpen && (
          <div className="flex flex-col h-full min-h-0">
            {/* Header with feed toggle + close */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveFeed('activity')}
                  className={[
                    'px-2 py-1 text-xs font-medium rounded transition-colors',
                    activeFeed === 'activity'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200',
                  ].join(' ')}
                >
                  Activity
                  {activityCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 text-[10px] font-bold bg-blue-500 text-white rounded-full px-1">
                      {activityCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveFeed('decisions')}
                  className={[
                    'px-2 py-1 text-xs font-medium rounded transition-colors',
                    activeFeed === 'decisions'
                      ? 'bg-amber-600 text-white'
                      : 'text-gray-400 hover:text-gray-200',
                  ].join(' ')}
                >
                  Decisions
                  {decisionCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 text-[10px] font-bold bg-amber-500 text-white rounded-full px-1">
                      {decisionCount}
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Collapse sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Feed content */}
            <div className="flex-1 overflow-y-auto p-3">
              {activeFeed === 'activity' && displayId && (
                <ActivityFeed workspaceId={displayId} userRole={userRoleInActive} limit={15} />
              )}
              {activeFeed === 'decisions' && (
                <div className="flex flex-col gap-2">
                  {decisionItems.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-6">No pending decisions</p>
                  ) : (
                    decisionItems.map((item, i) => (
                      <div
                        key={`${item.actionableItemId}-${i}`}
                        className="bg-gray-750 border border-gray-600 rounded-lg p-3 hover:border-amber-600 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <span className={[
                            'shrink-0 mt-0.5 w-2 h-2 rounded-full',
                            item.updateType === 'escalation' ? 'bg-red-400' : 'bg-amber-400',
                          ].join(' ')} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-200 leading-snug">{item.summary}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              from {item.sourceWorkspaceName}
                              {' · '}
                              {item.updateType === 'escalation' ? 'Escalation' : 'Directive'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Map: fills remaining space ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <StrategicValidityDashboard />
      </div>

    </div>
  );
}
