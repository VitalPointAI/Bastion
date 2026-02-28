/**
 * IPBLayerControls
 *
 * Phase 14 Plan 07: GIS-style layer toggle panel for IPB overlays.
 * Groups layers by type with color swatches, toggle-all checkboxes,
 * and individual layer toggles with visible/total counts.
 */

import type { IPBLayer } from '../../types/exercise';

// ─── Layer Colors (IPB Military Convention Colors) ─────────────────────────────

export const IPB_LAYER_COLORS: Record<string, string> = {
  blue_forces: '#0066cc',
  red_forces: '#cc0000',
  red_self: '#990000',
  key_terrain: '#50c878',
  avenue_of_approach: '#ffa500',
  named_area: '#ffcc00',
  engagement_area: '#ff00ff',
  obstacle: '#888888',
};

// Map layerType to a display color key
function getLayerColorKey(layerType: string, team?: string): string {
  if (layerType === 'forces') {
    return team === 'red' ? 'red_forces' : 'blue_forces';
  }
  const direct: Record<string, string> = {
    key_terrain: 'key_terrain',
    avenue_of_approach: 'avenue_of_approach',
    nai: 'named_area',
    engagement_area: 'engagement_area',
    obstacle: 'obstacle',
  };
  return direct[layerType] ?? 'obstacle';
}

// Human-readable layer type labels
const LAYER_TYPE_LABELS: Record<string, string> = {
  forces: 'Force Dispositions',
  key_terrain: 'Key Terrain',
  avenue_of_approach: 'Avenues of Approach',
  nai: 'Named Areas of Interest',
  engagement_area: 'Engagement Areas',
  obstacle: 'Obstacles',
};

const LAYER_TYPE_ORDER = [
  'forces',
  'key_terrain',
  'avenue_of_approach',
  'nai',
  'engagement_area',
  'obstacle',
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface IPBLayerControlsProps {
  layers: IPBLayer[];
  layerVisibility: Record<string, boolean>;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
}

// ─── IPBLayerControls ──────────────────────────────────────────────────────────

export function IPBLayerControls({
  layers,
  layerVisibility,
  onVisibilityChange,
}: IPBLayerControlsProps) {
  // Group layers by layerType
  const groups: Record<string, IPBLayer[]> = {};
  for (const layer of layers) {
    if (!groups[layer.layerType]) {
      groups[layer.layerType] = [];
    }
    groups[layer.layerType].push(layer);
  }

  const handleGroupToggle = (layerType: string, allVisible: boolean) => {
    const group = groups[layerType] ?? [];
    for (const layer of group) {
      onVisibilityChange(layer.id, !allVisible);
    }
  };

  const orderedTypes = LAYER_TYPE_ORDER.filter((t) => groups[t]?.length > 0);

  if (orderedTypes.length === 0) {
    return (
      <div className="ipb-layer-controls">
        <div className="ipb-layer-controls-header">IPB Layers</div>
        <div className="ipb-layer-empty">No layers loaded</div>
      </div>
    );
  }

  return (
    <div className="ipb-layer-controls">
      <div className="ipb-layer-controls-header">IPB Layers</div>

      {orderedTypes.map((layerType) => {
        const group = groups[layerType];
        const visibleCount = group.filter((l) => layerVisibility[l.id] !== false).length;
        const totalCount = group.length;
        const allVisible = visibleCount === totalCount;
        const someVisible = visibleCount > 0 && visibleCount < totalCount;
        // Use the first layer's team for group color key
        const colorKey = getLayerColorKey(layerType, group[0]?.team);
        const color = IPB_LAYER_COLORS[colorKey] ?? '#888888';

        return (
          <div key={layerType} className="ipb-layer-group">
            <div className="ipb-layer-group-header">
              <input
                type="checkbox"
                id={`group-${layerType}`}
                checked={allVisible}
                ref={(el) => {
                  if (el) el.indeterminate = someVisible;
                }}
                onChange={() => handleGroupToggle(layerType, allVisible)}
                className="ipb-layer-checkbox"
              />
              <span
                className="ipb-layer-color-swatch"
                style={{ backgroundColor: color }}
              />
              <label htmlFor={`group-${layerType}`} className="ipb-layer-group-label">
                {LAYER_TYPE_LABELS[layerType] ?? layerType}
              </label>
              <span className="ipb-layer-count">
                {visibleCount}/{totalCount}
              </span>
            </div>

            <div className="ipb-layer-group-items">
              {group.map((layer) => {
                const visible = layerVisibility[layer.id] !== false;
                return (
                  <div key={layer.id} className="ipb-layer-item">
                    <input
                      type="checkbox"
                      id={`layer-${layer.id}`}
                      checked={visible}
                      onChange={(e) => onVisibilityChange(layer.id, e.target.checked)}
                      className="ipb-layer-checkbox"
                    />
                    <label htmlFor={`layer-${layer.id}`} className="ipb-layer-item-label">
                      {layer.name}
                    </label>
                    <span
                      className="ipb-layer-type-badge"
                      title={layer.type}
                    >
                      {layer.type[0].toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
