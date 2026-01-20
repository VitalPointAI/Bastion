/**
 * AuditLogPanel Component
 *
 * Configuration audit log viewer including:
 * - Table view of audit entries with TanStack Table
 * - Expandable row detail showing JSON diff
 * - Category filtering
 * - Relative timestamps
 */

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getExpandedRowModel,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { adminService, formatAuditTimestamp } from '../../lib/admin-service';
import type { ConfigAuditEntry, ConfigCategory } from '../../types/admin';

// Get relative time string
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatAuditTimestamp(timestamp);
}

// Render JSON diff between old and new values
function JsonDiff({ previous, current }: { previous: unknown; current: unknown }) {
  const prevStr = JSON.stringify(previous, null, 2);
  const currStr = JSON.stringify(current, null, 2);

  return (
    <div className="json-diff">
      <div className="json-diff-panel json-diff-panel--old">
        <div className="json-diff-header">Previous Value</div>
        <pre className="json-diff-content">{prevStr || 'null'}</pre>
      </div>
      <div className="json-diff-panel json-diff-panel--new">
        <div className="json-diff-header">New Value</div>
        <pre className="json-diff-content">{currStr || 'null'}</pre>
      </div>
    </div>
  );
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<ConfigAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [limit, setLimit] = useState(50);

  // Load audit log
  const loadAuditLog = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminService.getAuditLog({
        category: categoryFilter || undefined,
        limit,
      });
      setEntries(response.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, limit]);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  // Table columns
  const columns = useMemo<ColumnDef<ConfigAuditEntry>[]>(
    () => [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <button
            type="button"
            className="expand-btn"
            onClick={() => row.toggleExpanded()}
          >
            {row.getIsExpanded() ? '▼' : '▶'}
          </button>
        ),
      },
      {
        accessorKey: 'changedAt',
        header: 'Timestamp',
        cell: ({ getValue }) => {
          const timestamp = getValue<string>();
          return (
            <span className="timestamp" title={formatAuditTimestamp(timestamp)}>
              {getRelativeTime(timestamp)}
            </span>
          );
        },
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => (
          <span className={`category-badge category-badge--${getValue<string>()}`}>
            {getValue<string>().toUpperCase()}
          </span>
        ),
      },
      {
        accessorKey: 'key',
        header: 'Setting',
        cell: ({ getValue }) => <code className="setting-key">{getValue<string>()}</code>,
      },
      {
        accessorKey: 'changedBy',
        header: 'Changed By',
        cell: ({ getValue }) => {
          const did = getValue<string>();
          // Truncate DID for display
          return (
            <span className="changed-by" title={did}>
              {did.length > 30 ? `${did.substring(0, 30)}...` : did}
            </span>
          );
        },
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ getValue }) => {
          const reason = getValue<string | undefined>();
          return reason ? (
            <span className="reason">{reason}</span>
          ) : (
            <span className="reason reason--none">No reason provided</span>
          );
        },
      },
    ],
    []
  );

  // Row sub-component for expanded detail
  const renderSubRow = useCallback(({ row }: { row: Row<ConfigAuditEntry> }) => {
    return (
      <tr className="expanded-row">
        <td colSpan={columns.length}>
          <JsonDiff
            previous={row.original.previousValue}
            current={row.original.newValue}
          />
        </td>
      </tr>
    );
  }, [columns.length]);

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const categories: ConfigCategory[] = ['llm', 'agents', 'workflow', 'osint'];

  if (isLoading && entries.length === 0) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading audit log...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <div className="config-panel-header-row">
          <div>
            <h2>Configuration Audit Log</h2>
            <p>View history of configuration changes and administrative actions.</p>
          </div>
          <div className="header-actions-inline">
            <select
              className="form-select form-select--compact"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={loadAuditLog}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert--error">
          <span className="alert-icon">!</span>
          {error}
        </div>
      )}

      <div className="table-container">
        <table className="admin-table admin-table--audit">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
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
                  No audit entries found.
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

      {entries.length >= limit && (
        <div className="load-more">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setLimit((prev) => prev + 50)}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
