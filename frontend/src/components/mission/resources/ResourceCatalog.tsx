/**
 * Resource Catalog Component
 *
 * Tabbed interface for managing equipment, personnel, and consumables.
 * Includes category filtering, table view, and bulk import.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import {
  resourceService,
  getCategoryName,
  type Resource,
  type Personnel,
  type Consumable,
  type ResourceCategory,
} from '../../../lib/resource-service.js';
import { AvailabilityBadge } from './AvailabilityBadge.js';
import { ResourceForm } from './ResourceForm.js';
import { BulkImporter } from './BulkImporter.js';
import { ConsumableTracker } from './ConsumableTracker.js';
import './ResourceCatalog.css';

type TabType = 'equipment' | 'personnel' | 'consumables';

interface ResourceCatalogProps {
  problemSetId: string;
  showDisposed?: boolean;
}

export function ResourceCatalog({ problemSetId, showDisposed = false }: ResourceCatalogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const [resources, setResources] = useState<Resource[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingItem, setEditingItem] = useState<Resource | null>(null);

  // Load data
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemSetId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [resourcesData, personnelData, consumablesData] = await Promise.all([
        resourceService.getResources(problemSetId),
        resourceService.getPersonnel(problemSetId),
        resourceService.getConsumables(problemSetId),
      ]);

      setResources(resourcesData);
      setPersonnel(personnelData);
      setConsumables(consumablesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter resources by category and disposed status
  const filteredResources = useMemo(() => {
    let result = resources;
    // Hide disposed resources unless showDisposed is true
    if (!showDisposed) {
      result = result.filter((r) => (r.status as string) !== 'disposed');
    }
    if (selectedCategory !== 'all') {
      result = result.filter((r) => r.category === selectedCategory);
    }
    return result;
  }, [resources, selectedCategory, showDisposed]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<ResourceCategory, number> = {
      vehicles: 0,
      weapons: 0,
      communications: 0,
      sensors: 0,
      medical: 0,
      other: 0,
    };

    resources.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });

    return counts;
  }, [resources]);

  // Resource table columns
  const resourceColumns: ColumnDef<Resource>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: (info) => <strong>{info.getValue() as string}</strong>,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: (info) => getCategoryName(info.getValue() as ResourceCategory),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => <AvailabilityBadge status={info.getValue() as 'FMC' | 'PMC' | 'NMC'} />,
    },
    {
      accessorKey: 'serialNumber',
      header: 'Serial #',
      cell: (info) => info.getValue() || '—',
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: (info) => info.getValue() || '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="resource-actions">
          <button
            onClick={() => handleEdit(row.original)}
            className="btn-icon"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={() => handleDelete(row.original.id)}
            className="btn-icon btn-danger"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  // Personnel table columns
  const personnelColumns: ColumnDef<Personnel>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: (info) => <strong>{info.getValue() as string}</strong>,
    },
    {
      accessorKey: 'rank',
      header: 'Rank',
      cell: (info) => info.getValue() || '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        return (
          <span className={`personnel-status personnel-status--${status}`}>
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'specializations',
      header: 'Specializations',
      cell: (info) => {
        const specs = info.getValue() as string[] | undefined;
        return specs && specs.length > 0 ? specs.join(', ') : '—';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="resource-actions">
          <button
            onClick={() => handleDeletePersonnel(row.original.id)}
            className="btn-icon btn-danger"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  // Create tables
  const resourceTable = useReactTable({
    data: filteredResources,
    columns: resourceColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const personnelTable = useReactTable({
    data: personnel,
    columns: personnelColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Handlers
  const handleEdit = (resource: Resource) => {
    setEditingItem(resource);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource?')) return;

    try {
      await resourceService.deleteResource(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete resource:', err);
      alert('Failed to delete resource');
    }
  };

  const handleDeletePersonnel = async (id: string) => {
    if (!confirm('Delete this personnel?')) return;

    try {
      await resourceService.deletePersonnel(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete personnel:', err);
      alert('Failed to delete personnel');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    loadData();
  };

  const handleImportSuccess = () => {
    setShowImporter(false);
    loadData();
  };

  if (loading) {
    return <div className="resource-catalog-loading">Loading resources...</div>;
  }

  if (error) {
    return <div className="resource-catalog-error">Error: {error}</div>;
  }

  return (
    <div className="resource-catalog">
      <div className="resource-catalog-header">
        <h2>Resource Catalog</h2>
        <div className="resource-catalog-actions">
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            + Add Resource
          </button>
          {activeTab === 'equipment' && (
            <button
              onClick={() => setShowImporter(true)}
              className="btn btn-secondary"
            >
              📥 Bulk Import
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="resource-catalog-tabs">
        <button
          className={`tab-button ${activeTab === 'equipment' ? 'active' : ''}`}
          onClick={() => setActiveTab('equipment')}
        >
          Equipment ({resources.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'personnel' ? 'active' : ''}`}
          onClick={() => setActiveTab('personnel')}
        >
          Personnel ({personnel.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'consumables' ? 'active' : ''}`}
          onClick={() => setActiveTab('consumables')}
        >
          Consumables ({consumables.length})
        </button>
      </div>

      <div className="resource-catalog-content">
        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="equipment-view">
            {/* Category Sidebar */}
            <div className="category-sidebar">
              <h3>Categories</h3>
              <button
                className={`category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All ({resources.length})
              </button>
              {(Object.keys(categoryCounts) as ResourceCategory[]).map((cat) => (
                <button
                  key={cat}
                  className={`category-item ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {getCategoryName(cat)} ({categoryCounts[cat]})
                </button>
              ))}
            </div>

            {/* Resource Table */}
            <div className="resource-table-container">
              <table className="resource-table">
                <thead>
                  {resourceTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {resourceTable.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredResources.length === 0 && (
                <div className="empty-state">
                  No resources found. Click "Add Resource" to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Personnel Tab */}
        {activeTab === 'personnel' && (
          <div className="personnel-view">
            <table className="resource-table">
              <thead>
                {personnelTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {personnelTable.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {personnel.length === 0 && (
              <div className="empty-state">
                No personnel found. Click "Add Resource" to add personnel.
              </div>
            )}
          </div>
        )}

        {/* Consumables Tab */}
        {activeTab === 'consumables' && (
          <ConsumableTracker
            problemSetId={problemSetId}
            consumables={consumables}
            onUpdate={loadData}
          />
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ResourceForm
          problemSetId={problemSetId}
          resource={editingItem}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {showImporter && (
        <BulkImporter
          problemSetId={problemSetId}
          onClose={() => setShowImporter(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
