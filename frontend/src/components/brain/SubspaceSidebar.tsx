/**
 * SubspaceSidebar — collapsible tree navigation for brain subspaces.
 *
 * Shows:
 *   - "Full Graph" home entry (clears active subspace)
 *   - "Containers" collapsible section (auto-detected from containerId data)
 *   - "Custom" collapsible section (manual + smart, user-created)
 *
 * Footer actions:
 *   - "Create from selection" (disabled when no nodes selected)
 *   - "Create smart subspace" (opens smart subspace dialog via callback)
 */

import React, { useState, useCallback } from 'react';
import type { BrainSubspace } from './types.js';
import './SubspaceSidebar.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SubspaceSidebarProps {
  subspaces: BrainSubspace[];
  activeSubspaceId: string | null;
  onSubspaceSelect: (id: string | null) => void;
  onCreateManual?: (name: string, nodeIds: string[]) => void;
  onCreateSmart?: () => void;
  onDelete?: (id: string) => void;
  /** Node IDs currently selected in the graph (for "Create from selection") */
  selectedNodeIds?: string[];
}

// ─── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: 'container' | 'manual' | 'smart' }) {
  const labels: Record<string, string> = { container: 'auto', manual: 'manual', smart: 'smart' };
  return (
    <span className={`subspace-badge subspace-badge--${type}`}>{labels[type]}</span>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  open,
  onToggle,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="subspace-section-header"
      onClick={onToggle}
      aria-expanded={open}
    >
      <span className="subspace-section-label">{label}</span>
      <span className="subspace-section-right">
        <span className="subspace-section-count">{count}</span>
        <span className={`subspace-section-chevron${open ? ' open' : ''}`}>▾</span>
      </span>
    </button>
  );
}

// ─── Subspace item ─────────────────────────────────────────────────────────────

function SubspaceItem({
  subspace,
  isActive,
  onSelect,
  onDelete,
  nodeCount,
}: {
  subspace: BrainSubspace;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  nodeCount: number;
}) {
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={`subspace-item${isActive ? ' subspace-item--active' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
    >
      <span className="subspace-item-name" title={subspace.name}>
        {subspace.name}
      </span>
      <span className="subspace-item-right">
        <span className="subspace-item-count">{nodeCount}</span>
        <TypeBadge type={subspace.subspaceType} />
        {subspace.subspaceType !== 'container' && onDelete && (
          <button
            type="button"
            className="subspace-item-delete"
            title="Delete subspace"
            onClick={handleDeleteClick}
            aria-label={`Delete ${subspace.name}`}
          >
            ×
          </button>
        )}
      </span>
    </div>
  );
}

// ─── Create-from-selection dialog ─────────────────────────────────────────────

function CreateManualDialog({
  nodeCount,
  onConfirm,
  onCancel,
}: {
  nodeCount: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (trimmed) onConfirm(trimmed);
    },
    [name, onConfirm],
  );

  return (
    <form className="subspace-create-dialog" onSubmit={handleSubmit}>
      <input
        autoFocus
        type="text"
        className="subspace-create-input"
        placeholder={`Name (${nodeCount} nodes)`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
      />
      <div className="subspace-create-actions">
        <button type="submit" className="subspace-create-confirm" disabled={!name.trim()}>
          Create
        </button>
        <button type="button" className="subspace-create-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SubspaceSidebar({
  subspaces,
  activeSubspaceId,
  onSubspaceSelect,
  onCreateManual,
  onCreateSmart,
  onDelete,
  selectedNodeIds = [],
}: SubspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [containersOpen, setContainersOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const containerSubspaces = subspaces.filter((s) => s.subspaceType === 'container');
  const customSubspaces = subspaces.filter((s) => s.subspaceType !== 'container');

  const handleCreateFromSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setShowCreateDialog(true);
  }, [selectedNodeIds.length]);

  const handleConfirmCreate = useCallback(
    (name: string) => {
      onCreateManual?.(name, selectedNodeIds);
      setShowCreateDialog(false);
    },
    [onCreateManual, selectedNodeIds],
  );

  // Derive node count per subspace for display
  function getNodeCount(subspace: BrainSubspace): number {
    if (subspace.subspaceType === 'container' || subspace.subspaceType === 'manual') {
      return subspace.nodeIds?.length ?? 0;
    }
    // Smart: we don't have live data here — show 0 as placeholder
    // The real count is visible via the filtered graph; sidebar shows "~"
    return 0;
  }

  if (collapsed) {
    return (
      <div className="subspace-sidebar subspace-sidebar--collapsed">
        <button
          type="button"
          className="subspace-sidebar-toggle"
          onClick={() => setCollapsed(false)}
          title="Expand Subspaces"
        >
          &#9656;
        </button>
      </div>
    );
  }

  return (
    <div className="subspace-sidebar">
      {/* Header */}
      <div className="subspace-header">
        <span className="subspace-header-title">Subspaces</span>
        <button
          type="button"
          className="subspace-sidebar-toggle"
          onClick={() => setCollapsed(true)}
          title="Collapse"
        >
          &#9666;
        </button>
      </div>

      {/* Full Graph entry */}
      <div
        role="button"
        tabIndex={0}
        className={`subspace-item subspace-item--home${activeSubspaceId === null ? ' subspace-item--active' : ''}`}
        onClick={() => onSubspaceSelect(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSubspaceSelect(null);
        }}
      >
        <span className="subspace-item-icon">&#9675;</span>
        <span className="subspace-item-name">Full Graph</span>
      </div>

      {/* Containers section */}
      {containerSubspaces.length > 0 && (
        <div className="subspace-section">
          <SectionHeader
            label="Containers"
            count={containerSubspaces.length}
            open={containersOpen}
            onToggle={() => setContainersOpen((v) => !v)}
          />
          <div className={`subspace-section-body${containersOpen ? ' open' : ''}`}>
            {containerSubspaces.map((sub) => (
              <SubspaceItem
                key={sub.id}
                subspace={sub}
                isActive={activeSubspaceId === sub.id}
                onSelect={() => onSubspaceSelect(sub.id)}
                nodeCount={getNodeCount(sub)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom section */}
      {customSubspaces.length > 0 && (
        <div className="subspace-section">
          <SectionHeader
            label="Custom"
            count={customSubspaces.length}
            open={customOpen}
            onToggle={() => setCustomOpen((v) => !v)}
          />
          <div className={`subspace-section-body${customOpen ? ' open' : ''}`}>
            {customSubspaces.map((sub) => (
              <SubspaceItem
                key={sub.id}
                subspace={sub}
                isActive={activeSubspaceId === sub.id}
                onSelect={() => onSubspaceSelect(sub.id)}
                onDelete={onDelete ? () => onDelete(sub.id) : undefined}
                nodeCount={
                  sub.subspaceType === 'smart'
                    ? (sub.nodeIds?.length ?? 0)
                    : getNodeCount(sub)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no subspaces */}
      {containerSubspaces.length === 0 && customSubspaces.length === 0 && (
        <div className="subspace-empty">
          No subspaces yet.
          <br />
          Select nodes or add container data.
        </div>
      )}

      {/* Footer actions */}
      <div className="subspace-footer">
        {showCreateDialog ? (
          <CreateManualDialog
            nodeCount={selectedNodeIds.length}
            onConfirm={handleConfirmCreate}
            onCancel={() => setShowCreateDialog(false)}
          />
        ) : (
          <>
            <button
              type="button"
              className="subspace-footer-btn"
              onClick={handleCreateFromSelection}
              disabled={selectedNodeIds.length === 0}
              title={
                selectedNodeIds.length === 0
                  ? 'Select nodes in the graph first'
                  : `Create subspace from ${selectedNodeIds.length} selected nodes`
              }
            >
              + From selection{selectedNodeIds.length > 0 ? ` (${selectedNodeIds.length})` : ''}
            </button>
            <button
              type="button"
              className="subspace-footer-btn subspace-footer-btn--smart"
              onClick={onCreateSmart}
            >
              + Smart subspace
            </button>
          </>
        )}
      </div>
    </div>
  );
}
