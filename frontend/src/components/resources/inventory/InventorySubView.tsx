/**
 * InventorySubView
 *
 * Default sub-view for the Resources tab. Mounts ResourceCatalog scoped
 * to the current problem set with a "Show Disposed" toolbar toggle.
 *
 * Disposed resources are hidden by default (per Phase 42 CONTEXT.md locked
 * decision). Toggle to amber state reveals them grayed-out in the table.
 *
 * Also renders the ResourceDetailPanel slide-over, which opens when
 * selectedResourceId is set in ResourcesContext.
 *
 * Phase 42 Plan 02: Initial inventory view wiring.
 */

import { useState } from 'react';
import { ResourceCatalog } from '../../mission/resources/ResourceCatalog';
import { ResourceDetailPanel } from '../ResourceDetailPanel';
import { useResourcesContext } from '../ResourcesContext';

interface InventorySubViewProps {
  problemSetId: string;
}

export function InventorySubView({ problemSetId }: InventorySubViewProps) {
  const [showDisposed, setShowDisposed] = useState(false);
  const { selectedResourceId, setSelectedResourceId } = useResourcesContext();

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* Toolbar row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 shrink-0">
        <button
          onClick={() => setShowDisposed(!showDisposed)}
          className={[
            'px-3 py-1.5 text-xs font-medium rounded border transition-colors',
            showDisposed
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
              : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200 hover:bg-gray-600',
          ].join(' ')}
          title={showDisposed ? 'Hide disposed resources' : 'Show disposed resources'}
        >
          {showDisposed ? 'Hide Disposed' : 'Show Disposed'}
        </button>
      </div>

      {/* Catalog + detail panel row */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ResourceCatalog takes remaining space */}
        <div className="flex-1 overflow-auto">
          <ResourceCatalog
            problemSetId={problemSetId}
            showDisposed={showDisposed}
          />
        </div>

        {/* Detail panel slides in from right — fixed positioning handles layout */}
        <ResourceDetailPanel
          resourceId={selectedResourceId}
          onClose={() => setSelectedResourceId(null)}
        />
      </div>
    </div>
  );
}
