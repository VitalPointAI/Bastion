/**
 * BrainContextMenu — right-click context menu for brain graph nodes.
 *
 * Actions:
 * - View details (single-click equivalent)
 * - Create subspace from selection
 * - Create smart subspace
 * - Drill into node
 */

import { useEffect, useRef } from 'react';
import type { BrainNode } from './types.js';

export interface ContextMenuState {
  x: number;
  y: number;
  node: BrainNode | null;
  selectedCount: number;
}

interface BrainContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onViewDetails: () => void;
  onDrillInto: () => void;
  onCreateSubspaceFromSelection: () => void;
  onCreateSmartSubspace: () => void;
}

export function BrainContextMenu({
  menu,
  onClose,
  onViewDetails,
  onDrillInto,
  onCreateSubspaceFromSelection,
  onCreateSmartSubspace,
}: BrainContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 100,
        minWidth: 180,
        background: '#1e293b',
        border: '1px solid #475569',
        borderRadius: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: '4px 0',
      }}
    >
      {menu.node && (
        <>
          {/* Header: node name */}
          <div style={{
            padding: '6px 12px',
            fontSize: '0.7rem',
            color: '#94a3b8',
            borderBottom: '1px solid #334155',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 220,
          }}>
            {menu.node.label || menu.node.id}
          </div>

          <MenuItem label="View Details" onClick={() => { onViewDetails(); onClose(); }} />
          <MenuItem label="Drill Into" onClick={() => { onDrillInto(); onClose(); }} />
        </>
      )}

      <div style={{ borderTop: '1px solid #334155', margin: '4px 0' }} />

      <MenuItem
        label={menu.selectedCount > 0 ? `Create Subspace (${menu.selectedCount} nodes)` : 'Create Subspace from Selection'}
        onClick={() => { onCreateSubspaceFromSelection(); onClose(); }}
        disabled={menu.selectedCount === 0 && !menu.node}
      />
      <MenuItem
        label="Create Smart Subspace"
        onClick={() => { onCreateSmartSubspace(); onClose(); }}
      />
    </div>
  );
}

function MenuItem({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 12px',
        background: 'none',
        border: 'none',
        color: disabled ? '#475569' : '#e2e8f0',
        fontSize: '0.8rem',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = '#334155';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none';
      }}
    >
      {label}
    </button>
  );
}
