/**
 * ContainerManager Component
 *
 * Inline CRUD for containers and categories.
 * Handles: create container, rename container, delete container,
 * create category (with color picker), reassign container category.
 */

import { useState, useEffect, useRef } from 'react';
import type { CategoryGroup } from '../../lib/types/strategic.js';
import { CUSTOM_CATEGORY_PALETTE } from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';

type ManagerAction =
  | { type: 'create-container'; categoryId: string }
  | { type: 'create-category' }
  | { type: 'rename-container'; containerId: string; currentName: string }
  | { type: 'delete-container'; containerId: string; containerName: string; documentCount: number }
  | { type: 'reassign-container'; containerId: string; currentCategoryId: string };

interface ContainerManagerProps {
  environmentId: string;
  categories: CategoryGroup[];
  action: ManagerAction;
  onClose: () => void;
  onRefresh: () => void;
}

export function ContainerManager({
  environmentId,
  categories,
  action,
  onClose,
  onRefresh,
}: ContainerManagerProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create container state
  const [containerName, setContainerName] = useState('');
  const [containerDesc, setContainerDesc] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    action.type === 'create-container' ? action.categoryId : ''
  );

  // Rename state
  const [renameValue, setRenameValue] = useState(
    action.type === 'rename-container' ? action.currentName : ''
  );

  // Create category state
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState<string>(CUSTOM_CATEGORY_PALETTE[0]);

  // Reassign state
  const [reassignCategoryId, setReassignCategoryId] = useState(
    action.type === 'reassign-container' ? action.currentCategoryId : ''
  );

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the first input on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  /**
   * Create a new container.
   */
  const handleCreateContainer = async () => {
    if (!containerName.trim() || containerName.trim().length < 2) {
      setError('Container name must be at least 2 characters');
      return;
    }
    if (containerName.trim().length > 100) {
      setError('Container name must be under 100 characters');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select a category');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await strategicService.createContainer(environmentId, {
        categoryId: selectedCategoryId,
        name: containerName.trim(),
        description: containerDesc.trim() || undefined,
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create container');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Rename a container.
   */
  const handleRenameContainer = async () => {
    if (action.type !== 'rename-container') return;
    if (!renameValue.trim() || renameValue.trim().length < 2) {
      setError('Container name must be at least 2 characters');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await strategicService.updateContainer(action.containerId, {
        name: renameValue.trim(),
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename container');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Delete a container.
   */
  const handleDeleteContainer = async () => {
    if (action.type !== 'delete-container') return;

    setSaving(true);
    setError(null);
    try {
      const result = await strategicService.deleteContainer(action.containerId);
      if (result.orphanedDocumentIds.length > 0) {
        console.log(
          `Container deleted. ${result.orphanedDocumentIds.length} document(s) moved to Unorganized.`
        );
      }
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete container');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Create a new custom category.
   */
  const handleCreateCategory = async () => {
    if (!categoryName.trim() || categoryName.trim().length < 2) {
      setError('Category name must be at least 2 characters');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await strategicService.createCategory(environmentId, {
        name: categoryName.trim(),
        color: categoryColor,
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reassign container to a different category.
   */
  const handleReassignContainer = async () => {
    if (action.type !== 'reassign-container') return;
    if (!reassignCategoryId || reassignCategoryId === action.currentCategoryId) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await strategicService.updateContainer(action.containerId, {
        categoryId: reassignCategoryId,
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reassign container');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Render dialog content based on action type.
   */
  const renderContent = () => {
    switch (action.type) {
      case 'create-container':
        return (
          <>
            <h3>Create Container</h3>
            <div className="manager-form-group">
              <label htmlFor="container-name">Name</label>
              <input
                id="container-name"
                ref={inputRef}
                type="text"
                value={containerName}
                onChange={(e) => setContainerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateContainer();
                  handleKeyDown(e);
                }}
                placeholder="e.g., China, NATO, Regional Threats"
                maxLength={100}
              />
            </div>
            <div className="manager-form-group">
              <label htmlFor="container-desc">Description (optional)</label>
              <textarea
                id="container-desc"
                value={containerDesc}
                onChange={(e) => setContainerDesc(e.target.value)}
                placeholder="Brief description of this container"
                rows={2}
              />
            </div>
            <div className="manager-form-group">
              <label htmlFor="container-category">Category</label>
              <select
                id="container-category"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="">Select category...</option>
                {categories.map((g) => (
                  <option key={g.category.id} value={g.category.id}>
                    {g.category.name}
                  </option>
                ))}
              </select>
            </div>
            {error && <div className="delete-warning">{error}</div>}
            <div className="manager-actions">
              <button className="manager-btn manager-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="manager-btn manager-btn-primary"
                onClick={handleCreateContainer}
                disabled={saving || !containerName.trim() || !selectedCategoryId}
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </>
        );

      case 'rename-container':
        return (
          <>
            <h3>Rename Container</h3>
            <div className="manager-form-group">
              <label htmlFor="rename-input">New Name</label>
              <input
                id="rename-input"
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameContainer();
                  handleKeyDown(e);
                }}
                maxLength={100}
              />
            </div>
            {error && <div className="delete-warning">{error}</div>}
            <div className="manager-actions">
              <button className="manager-btn manager-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="manager-btn manager-btn-primary"
                onClick={handleRenameContainer}
                disabled={saving || !renameValue.trim()}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        );

      case 'delete-container':
        return (
          <>
            <h3>Delete Container</h3>
            <p style={{ color: 'var(--text-secondary, #a0a0b0)', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
              Are you sure you want to delete <strong>{action.containerName}</strong>?
            </p>
            {action.documentCount > 0 && (
              <div className="delete-warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {action.documentCount} document{action.documentCount !== 1 ? 's' : ''} will be
                moved to Unorganized
              </div>
            )}
            {error && <div className="delete-warning">{error}</div>}
            <div className="manager-actions">
              <button className="manager-btn manager-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="manager-btn manager-btn-danger"
                onClick={handleDeleteContainer}
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete Container'}
              </button>
            </div>
          </>
        );

      case 'create-category':
        return (
          <>
            <h3>Create Category</h3>
            <div className="manager-form-group">
              <label htmlFor="category-name">Name</label>
              <input
                id="category-name"
                ref={inputRef}
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                  handleKeyDown(e);
                }}
                placeholder="e.g., Coalition, Threat, Regional Orgs"
                maxLength={50}
              />
            </div>
            <div className="manager-form-group">
              <label>Color</label>
              <div className="color-palette">
                {CUSTOM_CATEGORY_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${categoryColor === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setCategoryColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
            {error && <div className="delete-warning">{error}</div>}
            <div className="manager-actions">
              <button className="manager-btn manager-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="manager-btn manager-btn-primary"
                onClick={handleCreateCategory}
                disabled={saving || !categoryName.trim()}
              >
                {saving ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </>
        );

      case 'reassign-container':
        return (
          <>
            <h3>Move Container</h3>
            <div className="manager-form-group">
              <label htmlFor="reassign-category">Move to Category</label>
              <select
                id="reassign-category"
                value={reassignCategoryId}
                onChange={(e) => setReassignCategoryId(e.target.value)}
              >
                {categories.map((g) => (
                  <option key={g.category.id} value={g.category.id}>
                    {g.category.name}
                    {g.category.id === action.currentCategoryId ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {error && <div className="delete-warning">{error}</div>}
            <div className="manager-actions">
              <button className="manager-btn manager-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="manager-btn manager-btn-primary"
                onClick={handleReassignContainer}
                disabled={saving || reassignCategoryId === action.currentCategoryId}
              >
                {saving ? 'Moving...' : 'Move'}
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="container-manager-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="container-manager-dialog">{renderContent()}</div>
    </div>
  );
}
