/**
 * COPTab
 *
 * Phase 21 Plan 08: Entry point component for the COP workspace tab.
 * Composes COPMapView, COPLayerControls, and COPPerspectiveToggle
 * into a full-height layout with controls overlaid.
 *
 * This is the component rendered by WorkspaceTabContainer when the
 * user navigates to the 'cop' tab.
 */

import { useState, useCallback } from 'react';
import type { COPLayer, Perspective } from '../../types/cop.js';
import { COPMapView } from './COPMapView.js';
import { COPLayerControls } from './COPLayerControls.js';
import { COPPerspectiveToggle } from './COPPerspectiveToggle.js';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPTabProps {
  workspaceId: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function COPTab({ workspaceId }: COPTabProps) {
  const [layers, setLayers] = useState<COPLayer[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
  const [currentPerspective, setCurrentPerspective] = useState<Perspective>('combined');
  const [controlsOpen, setControlsOpen] = useState(true);

  // When layers are fetched, initialize visibility/opacity defaults
  const handleLayersLoaded = useCallback((loadedLayers: COPLayer[]) => {
    setLayers(loadedLayers);

    // Initialize visibility (all visible by default)
    setLayerVisibility((prev) => {
      const next = { ...prev };
      for (const layer of loadedLayers) {
        if (next[layer.id] === undefined) {
          next[layer.id] = true;
        }
      }
      return next;
    });

    // Initialize opacity (100% by default)
    setLayerOpacity((prev) => {
      const next = { ...prev };
      for (const layer of loadedLayers) {
        if (next[layer.id] === undefined) {
          next[layer.id] = 100;
        }
      }
      return next;
    });
  }, []);

  function handleVisibilityChange(layerId: string, visible: boolean) {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }));
  }

  function handleOpacityChange(layerId: string, opacity: number) {
    setLayerOpacity((prev) => ({ ...prev, [layerId]: opacity }));
  }

  return (
    <div className="flex flex-1 min-h-0 relative" style={{ height: '100%' }}>
      {/* Main map area */}
      <div className="flex-1 min-w-0 relative">
        {/* Perspective toggle - top left corner */}
        <div className="absolute top-3 left-3 z-[1000]">
          <COPPerspectiveToggle
            currentPerspective={currentPerspective}
            onPerspectiveChange={setCurrentPerspective}
          />
        </div>

        {/* Layer controls toggle button (when panel is closed) */}
        {!controlsOpen && (
          <button
            onClick={() => setControlsOpen(true)}
            className="absolute top-3 right-3 z-[1000] px-3 py-1.5 text-xs font-medium bg-gray-800/90 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Show layer controls"
          >
            Layers ({layers.length})
          </button>
        )}

        <COPMapView
          workspaceId={workspaceId}
          layerVisibility={layerVisibility}
          layerOpacity={layerOpacity}
          currentPerspective={currentPerspective}
          onLayersLoaded={handleLayersLoaded}
        />
      </div>

      {/* Layer controls sidebar */}
      {controlsOpen && (
        <div className="flex flex-col border-l border-gray-700 bg-gray-800">
          {/* Close button */}
          <div className="flex items-center justify-end px-2 py-1 border-b border-gray-700">
            <button
              onClick={() => setControlsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Hide layer controls"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <COPLayerControls
            layers={layers}
            layerVisibility={layerVisibility}
            layerOpacity={layerOpacity}
            onVisibilityChange={handleVisibilityChange}
            onOpacityChange={handleOpacityChange}
          />
        </div>
      )}
    </div>
  );
}
