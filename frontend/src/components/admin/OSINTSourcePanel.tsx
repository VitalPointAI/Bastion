/**
 * OSINTSourcePanel Component
 *
 * Configuration panel for OSINT source management including:
 * - Table view of all sources with TanStack Table
 * - CRUD operations (add, edit, delete)
 * - Credibility rating display
 * - Enable/disable toggle
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminService, getSourceTypeDisplayName } from '../../lib/admin-service';
import type { OSINTSourceConfig, OSINTSourceConfigInput } from '../../types/admin';
import { FormField } from './common/FormField';

// Zod schema for OSINT source form
const OSINTSourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['RSS', 'API', 'SCRAPE', 'MANUAL']),
  url: z.string().url('Must be a valid URL'),
  credibilityRating: z.number().min(1).max(5),
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  rateLimit: z.number().min(1).max(1000).optional(),
  categories: z.string(),
  regions: z.string(),
});

type OSINTSourceFormData = z.infer<typeof OSINTSourceSchema>;

export function OSINTSourcePanel() {
  const [sources, setSources] = useState<OSINTSourceConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<OSINTSourceConfig | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<OSINTSourceConfig | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OSINTSourceFormData>({
    resolver: zodResolver(OSINTSourceSchema),
    defaultValues: {
      type: 'RSS',
      credibilityRating: 3,
      enabled: true,
      categories: '',
      regions: '',
    },
  });

  // Load sources
  const loadSources = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminService.getOSINTSources();
      setSources(response.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OSINT sources');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Open modal for adding new source
  const handleAddNew = () => {
    setEditingSource(null);
    reset({
      name: '',
      type: 'RSS',
      url: '',
      credibilityRating: 3,
      enabled: true,
      apiKey: '',
      rateLimit: 60,
      categories: '',
      regions: '',
    });
    setShowModal(true);
  };

  // Open modal for editing existing source
  const handleEdit = (source: OSINTSourceConfig) => {
    setEditingSource(source);
    reset({
      name: source.name,
      type: source.type,
      url: source.url,
      credibilityRating: source.credibilityRating,
      enabled: source.enabled,
      apiKey: '',
      rateLimit: source.rateLimit || 60,
      categories: source.categories.join(', '),
      regions: source.regions.join(', '),
    });
    setShowModal(true);
  };

  // Handle form submission
  const onSubmit = async (data: OSINTSourceFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const sourceData: OSINTSourceConfigInput = {
        name: data.name,
        type: data.type,
        url: data.url,
        credibilityRating: data.credibilityRating,
        enabled: data.enabled,
        rateLimit: data.rateLimit,
        categories: data.categories.split(',').map((s) => s.trim()).filter(Boolean),
        regions: data.regions.split(',').map((s) => s.trim()).filter(Boolean),
      };

      if (data.apiKey && data.apiKey.trim() !== '') {
        sourceData.apiKey = data.apiKey;
      }

      if (editingSource) {
        await adminService.updateOSINTSource(editingSource.id, sourceData);
        setSuccessMessage('Source updated successfully');
      } else {
        await adminService.addOSINTSource(sourceData);
        setSuccessMessage('Source added successfully');
      }

      setShowModal(false);
      loadSources();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save source');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await adminService.deleteOSINTSource(deleteConfirm.id, deleteReason);
      setSuccessMessage('Source deleted successfully');
      setDeleteConfirm(null);
      setDeleteReason('');
      loadSources();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render credibility stars
  const renderStars = (rating: number) => {
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`star ${star <= rating ? 'star--filled' : ''}`}>
            &#9733;
          </span>
        ))}
      </div>
    );
  };

  // Table columns
  const columns = useMemo<ColumnDef<OSINTSourceConfig>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => <span className="source-name">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => (
          <span className="source-type">{getSourceTypeDisplayName(getValue<string>())}</span>
        ),
      },
      {
        accessorKey: 'url',
        header: 'URL',
        cell: ({ getValue }) => (
          <span className="source-url" title={getValue<string>()}>
            {getValue<string>().length > 40
              ? `${getValue<string>().substring(0, 40)}...`
              : getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'credibilityRating',
        header: 'Credibility',
        cell: ({ getValue }) => renderStars(getValue<number>()),
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ getValue }) => (
          <span className={`status-badge ${getValue<boolean>() ? 'status-badge--enabled' : 'status-badge--disabled'}`}>
            {getValue<boolean>() ? 'Enabled' : 'Disabled'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="table-actions">
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => handleEdit(row.original)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => setDeleteConfirm(row.original)}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: sources,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading OSINT sources...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <div className="config-panel-header-row">
          <div>
            <h2>OSINT Sources</h2>
            <p>Manage open-source intelligence feeds, APIs, and data sources.</p>
          </div>
          <div className="header-actions-inline">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={loadSources}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleAddNew}
            >
              Add Source
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

      {successMessage && (
        <div className="alert alert--success">
          <span className="alert-icon">&#10003;</span>
          {successMessage}
        </div>
      )}

      <div className="table-container">
        <table className="admin-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() && (
                      <span className="sort-indicator">
                        {header.column.getIsSorted() === 'asc' ? ' ▲' : ' ▼'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-state">
                  No OSINT sources configured. Click "Add Source" to get started.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingSource ? 'Edit OSINT Source' : 'Add OSINT Source'}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="modal-body">
              <div className="form-row">
                <FormField label="Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    {...register('name')}
                    className="form-input"
                    placeholder="Reuters World News"
                  />
                </FormField>

                <FormField label="Type" required error={errors.type?.message}>
                  <select {...register('type')} className="form-select">
                    <option value="RSS">RSS Feed</option>
                    <option value="API">API</option>
                    <option value="SCRAPE">Web Scraper</option>
                    <option value="MANUAL">Manual Entry</option>
                  </select>
                </FormField>
              </div>

              <FormField label="URL" required error={errors.url?.message}>
                <input
                  type="text"
                  {...register('url')}
                  className="form-input"
                  placeholder="https://example.com/feed.rss"
                />
              </FormField>

              <div className="form-row">
                <FormField
                  label="Credibility Rating"
                  required
                  error={errors.credibilityRating?.message}
                  hint="1-5 stars"
                >
                  <select
                    {...register('credibilityRating', { valueAsNumber: true })}
                    className="form-select"
                  >
                    <option value={1}>1 - Low</option>
                    <option value={2}>2 - Below Average</option>
                    <option value={3}>3 - Average</option>
                    <option value={4}>4 - Above Average</option>
                    <option value={5}>5 - High</option>
                  </select>
                </FormField>

                <FormField label="Rate Limit" error={errors.rateLimit?.message} hint="Requests per minute">
                  <input
                    type="number"
                    {...register('rateLimit', { valueAsNumber: true })}
                    className="form-input"
                    min={1}
                    max={1000}
                  />
                </FormField>
              </div>

              <FormField
                label="API Key"
                error={errors.apiKey?.message}
                hint={editingSource ? 'Leave blank to keep current key' : 'Optional'}
              >
                <input
                  type="password"
                  {...register('apiKey')}
                  className="form-input"
                  placeholder="Enter API key"
                  autoComplete="new-password"
                />
              </FormField>

              <div className="form-row">
                <FormField
                  label="Categories"
                  error={errors.categories?.message}
                  hint="Comma-separated"
                >
                  <input
                    type="text"
                    {...register('categories')}
                    className="form-input"
                    placeholder="security, defense, policy"
                  />
                </FormField>

                <FormField
                  label="Regions"
                  error={errors.regions?.message}
                  hint="Comma-separated"
                >
                  <input
                    type="text"
                    {...register('regions')}
                    className="form-input"
                    placeholder="EMEA, APAC, US"
                  />
                </FormField>
              </div>

              <div className="checkbox-field" style={{ marginTop: '1rem' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...register('enabled')}
                    className="checkbox-input"
                  />
                  <span className="checkbox-box" />
                  <div className="checkbox-content">
                    <span className="checkbox-name">Enabled</span>
                    <span className="checkbox-desc">
                      Source will actively collect data when enabled.
                    </span>
                  </div>
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingSource ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-header--danger">
              <h3>Delete Source</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteConfirm(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              </p>
              <p className="text-muted">This action cannot be undone.</p>

              <FormField label="Reason for deletion" hint="Required for audit">
                <input
                  type="text"
                  className="form-input"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g., Source deprecated"
                />
              </FormField>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleDelete}
                  disabled={isSubmitting || !deleteReason.trim()}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
