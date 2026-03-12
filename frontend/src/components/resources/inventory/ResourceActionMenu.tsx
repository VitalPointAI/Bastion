/**
 * ResourceActionMenu
 *
 * Three-dot action menu for resource rows in the inventory table.
 * Shows context-sensitive actions based on distribution type and status.
 *
 * Distribution constraint enforcement (per Phase 42 CONTEXT.md decisions):
 *   ASSGN  — "Redistribute" disabled (assigned resources cannot be redistributed)
 *   ALLOC  — "Dispose/Decommission" disabled (must be returned to parent echelon)
 *   APPRTN — "Redistribute" and "Dispose" both disabled (managed at parent echelon)
 *
 * Phase 42 Plan 02: Initial action menu with constraint enforcement.
 */

import { useState, useEffect, useRef } from 'react';

interface ResourceActionMenuProps {
  resourceId: string;
  status: string;
  distributionType?: string;
  onAction: (action: string, resourceId: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

export function ResourceActionMenu({ resourceId, status, distributionType, onAction }: ResourceActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // If resource is already disposed, only show View Detail
  if (status === 'disposed') {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="p-1 text-gray-400 hover:text-gray-200 transition-colors rounded"
          title="Actions"
          aria-label="Resource actions"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 min-w-[160px]">
            <button
              onClick={() => { onAction('view-detail', resourceId); setOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              View Detail
            </button>
          </div>
        )}
      </div>
    );
  }

  // Build menu items with distribution constraint enforcement
  const dt = distributionType?.toUpperCase();

  const menuItems: MenuItem[] = [
    { id: 'view-detail', label: 'View Detail' },
    { id: 'reassign', label: 'Reassign' },
    {
      id: 'loan-out',
      label: 'Loan Out',
    },
    {
      id: 'redistribute',
      label: 'Redistribute',
      disabled: dt === 'ASSGN' || dt === 'APPRTN',
      tooltip:
        dt === 'ASSGN'
          ? 'Assigned resources cannot be redistributed'
          : dt === 'APPRTN'
          ? 'Apportioned resources are managed at parent echelon'
          : undefined,
    },
    {
      id: 'report-damaged',
      label: 'Report Damaged',
    },
    {
      id: 'dispose',
      label: 'Dispose / Decommission',
      disabled: dt === 'ALLOC' || dt === 'APPRTN',
      tooltip:
        dt === 'ALLOC'
          ? 'Allocated resources must be returned to parent echelon'
          : dt === 'APPRTN'
          ? 'Apportioned resources are managed at parent echelon'
          : undefined,
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-gray-400 hover:text-gray-200 transition-colors rounded"
        title="Actions"
        aria-label="Resource actions"
      >
        {/* Vertical ellipsis (three dots) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 min-w-[200px]">
          {menuItems.map((item) => (
            <div key={item.id} title={item.tooltip}>
              <button
                onClick={() => {
                  if (!item.disabled) {
                    onAction(item.id, resourceId);
                    setOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={[
                  'block w-full text-left px-3 py-2 text-sm transition-colors',
                  item.disabled
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-200 hover:bg-gray-700',
                ].join(' ')}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
