/**
 * AgentActivityPanel Component
 *
 * Real-time filterable feed of all agent and Ironclaw activity.
 * Shows every LLM invocation, tool call, message, action card, delegation,
 * team dispatch, and error across the entire system.
 *
 * Features:
 * - Stats header (total, success rate, avg duration)
 * - Filter bar (agent, team, action type, status, date range)
 * - TanStack Table with expandable rows showing input/output/metadata
 * - Auto-refresh (5s polling, toggleable)
 * - CSV export
 * - Pagination (50 per page)
 */

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getExpandedRowModel,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { adminService } from '../../lib/admin-service';
import { AgentActivityFilters } from './AgentActivityFilters';
import type {
  ActivityEntry,
  ActivityFilter,
  ActivityStats,
} from '../../types/admin';

// ============================================================================
// Utilities
// ============================================================================

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const ACTION_TYPE_CLASS: Record<string, string> = {
  llm_invocation: 'action-badge--llm',
  tool_call: 'action-badge--tool',
  message_received: 'action-badge--msg-in',
  message_sent: 'action-badge--msg-out',
  action_card: 'action-badge--card',
  delegation: 'action-badge--delegate',
  team_dispatch: 'action-badge--dispatch',
  specialist_handoff: 'action-badge--handoff',
  checkpoint: 'action-badge--checkpoint',
  error: 'action-badge--error',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  llm_invocation: 'LLM',
  tool_call: 'Tool',
  message_received: 'Msg In',
  message_sent: 'Msg Out',
  action_card: 'Card',
  delegation: 'Delegate',
  team_dispatch: 'Dispatch',
  specialist_handoff: 'Handoff',
  checkpoint: 'Checkpoint',
  error: 'Error',
};

function ActionTypeBadge({ type }: { type: string }) {
  return (
    <span className={`action-badge ${ACTION_TYPE_CLASS[type] ?? ''}`}>
      {ACTION_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {status}
    </span>
  );
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================================================
// Expanded row detail
// ============================================================================

function ActivityDetail({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="activity-detail">
      {entry.inputSummary && (
        <div className="activity-detail-section">
          <div className="activity-detail-label">Input</div>
          <pre className="activity-detail-content">{entry.inputSummary}</pre>
        </div>
      )}
      {entry.outputSummary && (
        <div className="activity-detail-section">
          <div className="activity-detail-label">Output</div>
          <pre className="activity-detail-content">{entry.outputSummary}</pre>
        </div>
      )}
      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <div className="activity-detail-section">
          <div className="activity-detail-label">Metadata</div>
          <pre className="activity-detail-content activity-detail-content--metadata">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats header
// ============================================================================

function ActivityStatsHeader({ stats, isLoading }: { stats: ActivityStats | null; isLoading: boolean }) {
  if (isLoading && !stats) {
    return (
      <div className="activity-stats">
        <div className="activity-stats-card activity-stats-card--loading">Loading stats...</div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="activity-stats">
      <div className="activity-stats-card">
        <div className="activity-stats-value">{stats.total.toLocaleString()}</div>
        <div className="activity-stats-label">Total Activities</div>
      </div>
      <div className="activity-stats-card">
        <div className="activity-stats-value activity-stats-value--success">
          {(stats.successRate * 100).toFixed(1)}%
        </div>
        <div className="activity-stats-label">Success Rate</div>
      </div>
      <div className="activity-stats-card">
        <div className="activity-stats-value">
          {formatDuration(stats.avgDurationMs)}
        </div>
        <div className="activity-stats-label">Avg Duration</div>
      </div>
      <div className="activity-stats-card">
        <div className="activity-stats-value activity-stats-value--error">
          {stats.errorCount.toLocaleString()}
        </div>
        <div className="activity-stats-label">Errors</div>
      </div>
    </div>
  );
}

// ============================================================================
// CSV Export
// ============================================================================

function exportToCsv(entries: ActivityEntry[]): void {
  const headers = [
    'ID', 'Timestamp', 'Agent', 'Team', 'Action Type', 'Detail',
    'Duration (ms)', 'Status', 'Problem Set'
  ];
  const rows = entries.map((e) => [
    e.activityId,
    e.createdAt,
    e.agentName ?? e.agentId,
    e.teamName ?? e.teamId ?? '',
    e.actionType,
    e.actionDetail ?? '',
    e.durationMs ?? '',
    e.status,
    e.problemSetId ?? '',
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agent-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentActivityPanel() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<ActivityFilter>({ limit: 50, offset: 0 });
  const [page, setPage] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageSize = 50;

  // Stable filter reference combining user filter + pagination
  const effectiveFilter = useMemo<ActivityFilter>(
    () => ({ ...currentFilter, limit: pageSize, offset: page * pageSize }),
    [currentFilter, page]
  );

  const loadActivity = useCallback(async (filter: ActivityFilter) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await adminService.getAgentActivity(filter);
      setEntries(result.entries);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async (filter: ActivityFilter) => {
    try {
      setIsStatsLoading(true);
      const result = await adminService.getAgentActivityStats({
        agentId: filter.agentId,
        teamId: filter.teamId,
      });
      setStats(result);
    } catch {
      // Stats are non-critical — don't show error
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Load on filter/page change
  useEffect(() => {
    loadActivity(effectiveFilter);
    loadStats(effectiveFilter);
  }, [effectiveFilter, loadActivity, loadStats]);

  // Auto-refresh polling
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadActivity(effectiveFilter);
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, effectiveFilter, loadActivity]);

  // Reset page to 0 when filter changes
  const handleFilterChange = useCallback((filter: ActivityFilter) => {
    setPage(0);
    setCurrentFilter(filter);
  }, []);

  // Table columns
  const columns = useMemo<ColumnDef<ActivityEntry>[]>(
    () => [
      {
        id: 'expander',
        header: () => null,
        size: 32,
        cell: ({ row }) => (
          <button
            type="button"
            className="expand-btn"
            onClick={() => row.toggleExpanded()}
            aria-label={row.getIsExpanded() ? 'Collapse' : 'Expand'}
          >
            {row.getIsExpanded() ? '▼' : '▶'}
          </button>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Timestamp',
        size: 100,
        cell: ({ getValue }) => {
          const ts = getValue<string>();
          return (
            <span className="timestamp" title={ts}>
              {getRelativeTime(ts)}
            </span>
          );
        },
      },
      {
        id: 'agent',
        header: 'Agent',
        cell: ({ row }) => (
          <span className="agent-cell" title={row.original.agentId}>
            {row.original.agentName ?? row.original.agentId}
          </span>
        ),
      },
      {
        id: 'team',
        header: 'Team',
        cell: ({ row }) =>
          row.original.teamName ?? row.original.teamId ? (
            <span className="team-cell">
              {row.original.teamName ?? row.original.teamId}
            </span>
          ) : (
            <span className="empty-cell">—</span>
          ),
      },
      {
        accessorKey: 'actionType',
        header: 'Type',
        size: 100,
        cell: ({ getValue }) => <ActionTypeBadge type={getValue<string>()} />,
      },
      {
        accessorKey: 'actionDetail',
        header: 'Detail',
        cell: ({ getValue }) => {
          const detail = getValue<string | undefined>();
          return detail ? (
            <span className="detail-cell" title={detail}>
              {detail.length > 80 ? detail.slice(0, 80) + '...' : detail}
            </span>
          ) : (
            <span className="empty-cell">—</span>
          );
        },
      },
      {
        accessorKey: 'durationMs',
        header: 'Duration',
        size: 80,
        cell: ({ getValue }) => (
          <span className="duration-cell">{formatDuration(getValue<number | undefined>())}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 80,
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
    ],
    []
  );

  const renderSubRow = useCallback(
    ({ row }: { row: Row<ActivityEntry> }) => (
      <tr className="expanded-row">
        <td colSpan={columns.length}>
          <ActivityDetail entry={row.original} />
        </td>
      </tr>
    ),
    [columns.length]
  );

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const totalPages = Math.ceil(total / pageSize);

  if (isLoading && entries.length === 0) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading activity log...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      {/* Header */}
      <div className="config-panel-header">
        <div className="config-panel-header-row">
          <div>
            <h2>Agent Activity</h2>
            <p>Real-time audit trail of all agent and Ironclaw operations.</p>
          </div>
          <div className="header-actions-inline">
            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh (5s)</span>
            </label>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => loadActivity(effectiveFilter)}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => exportToCsv(entries)}
              disabled={entries.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats header */}
      <ActivityStatsHeader stats={stats} isLoading={isStatsLoading} />

      {/* Filters */}
      <AgentActivityFilters onChange={handleFilterChange} disabled={isLoading} />

      {/* Error */}
      {error && (
        <div className="alert alert--error">
          <span className="alert-icon">!</span>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="admin-table admin-table--activity">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: header.column.getSize() }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-state">
                  No activity entries found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className={row.getIsExpanded() ? 'row--expanded' : ''}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && renderSubRow({ row })}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {page + 1} of {totalPages} ({total.toLocaleString()} entries)
          </span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
