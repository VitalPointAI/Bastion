/**
 * COPLayerControls
 *
 * Phase 21 Plan 08: GIS-style layer toggle panel for COP overlays.
 * Extends the IPBLayerControls pattern with opacity sliders, state badges,
 * and grouped layer management by layer type.
 */

import { useState } from 'react';
import type { COPLayer, COPLayerControlsProps, COPLayerType } from '../../types/cop.js';
import './COPLayerControls.css';

// ─── Layer Type Config ──────────────────────────────────────────────────────

const LAYER_TYPE_LABELS: Record<COPLayerType, string> = {
  force_disposition: 'Force Disposition',
  objectives: 'Objectives',
  control_measures: 'Control Measures',
  intel: 'Intelligence',
  logistics: 'Logistics',
  c2: 'Command & Control',
};

const LAYER_TYPE_COLORS: Record<COPLayerType, string> = {
  force_disposition: '#3b82f6',
  objectives: '#ef4444',
  control_measures: '#f59e0b',
  intel: '#8b5cf6',
  logistics: '#10b981',
  c2: '#06b6d4',
};

const LAYER_TYPE_ORDER: COPLayerType[] = [
  'force_disposition',
  'objectives',
  'control_measures',
  'intel',
  'logistics',
  'c2',
];

const STATE_CLASSES: Record<string, string> = {
  draft: 'cop-layer-state-draft',
  review: 'cop-layer-state-review',
  published: 'cop-layer-state-published',
  cop: 'cop-layer-state-cop',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function COPLayerControls({
  layers,
  layerVisibility,
  layerOpacity,
  onVisibilityChange,
  onOpacityChange,
}: Omit<COPLayerControlsProps, 'currentPerspective' | 'onPerspectiveChange'>) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // All groups expanded by default
    const initial: Record<string, boolean> = {};
    for (const t of LAYER_TYPE_ORDER) initial[t] = true;
    return initial;
  });

  // Group layers by layerType
  const groups: Record<string, COPLayer[]> = {};
  for (const layer of layers) {
    if (!groups[layer.layerType]) {
      groups[layer.layerType] = [];
    }
    groups[layer.layerType].push(layer);
  }

  const orderedTypes = LAYER_TYPE_ORDER.filter((t) => groups[t]?.length > 0);

  // Count visible layers across all groups
  const totalVisible = layers.filter((l) => layerVisibility[l.id] !== false).length;

  function toggleGroup(layerType: string) {
    setExpandedGroups((prev) => ({ ...prev, [layerType]: !prev[layerType] }));
  }

  function handleGroupToggle(layerType: string, allVisible: boolean) {
    const group = groups[layerType] ?? [];
    for (const layer of group) {
      onVisibilityChange(layer.id, !allVisible);
    }
  }

  function handleShowAll() {
    for (const layer of layers) {
      onVisibilityChange(layer.id, true);
    }
  }

  function handleHideAll() {
    for (const layer of layers) {
      onVisibilityChange(layer.id, false);
    }
  }

  if (layers.length === 0) {
    return (
      <div className="cop-layer-controls">
        <div className="cop-layer-controls-header">
          <span className="cop-layer-controls-title">COP Layers</span>
        </div>
        <div className="text-center py-4 text-gray-500 text-xs">No layers loaded</div>
      </div>
    );
  }

  return (
    <div className="cop-layer-controls">
      <div className="cop-layer-controls-header">
        <span className="cop-layer-controls-title">COP Layers</span>
        <span className="cop-layer-count">{totalVisible}/{layers.length} visible</span>
      </div>

      {/* Bulk actions */}
      <div className="cop-layer-bulk-actions">
        <button className="cop-layer-bulk-btn" onClick={handleShowAll}>Show All</button>
        <button className="cop-layer-bulk-btn" onClick={handleHideAll}>Hide All</button>
      </div>

      {/* Layer groups */}
      {orderedTypes.map((layerType) => {
        const group = groups[layerType];
        const visibleCount = group.filter((l) => layerVisibility[l.id] !== false).length;
        const totalCount = group.length;
        const allVisible = visibleCount === totalCount;
        const someVisible = visibleCount > 0 && visibleCount < totalCount;
        const expanded = expandedGroups[layerType] !== false;
        const color = LAYER_TYPE_COLORS[layerType as COPLayerType] ?? '#6b7280';

        return (
          <div key={layerType} className="cop-layer-group">
            <div className="cop-layer-group-header" onClick={() => toggleGroup(layerType)}>
              <span className={`cop-layer-group-expand ${expanded ? 'expanded' : ''}`}>
                &#9654;
              </span>
              <input
                type="checkbox"
                checked={allVisible}
                ref={(el) => {
                  if (el) el.indeterminate = someVisible;
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  handleGroupToggle(layerType, allVisible);
                }}
                onClick={(e) => e.stopPropagation()}
                className="cop-layer-checkbox"
              />
              <span className="cop-layer-color-swatch" style={{ backgroundColor: color }} />
              <span className="cop-layer-group-label">
                {LAYER_TYPE_LABELS[layerType as COPLayerType] ?? layerType}
              </span>
              <span className="cop-layer-group-count">{visibleCount}/{totalCount}</span>
            </div>

            <div className={`cop-layer-group-items ${expanded ? '' : 'collapsed'}`}>
              {group.map((layer) => {
                const visible = layerVisibility[layer.id] !== false;
                const opacity = layerOpacity[layer.id] ?? 100;

                return (
                  <div key={layer.id}>
                    <div className="cop-layer-item">
                      <input
                        type="checkbox"
                        id={`cop-layer-${layer.id}`}
                        checked={visible}
                        onChange={(e) => onVisibilityChange(layer.id, e.target.checked)}
                        className="cop-layer-checkbox"
                      />
                      <label htmlFor={`cop-layer-${layer.id}`} className="cop-layer-item-label">
                        {layer.spec?.metadata?.generatedBy
                          ? `${LAYER_TYPE_LABELS[layer.layerType] ?? layer.layerType} (${layer.sectionId})`
                          : `${LAYER_TYPE_LABELS[layer.layerType] ?? layer.layerType}`}
                      </label>
                      <span className={`cop-layer-state-badge ${STATE_CLASSES[layer.state] ?? ''}`}>
                        {layer.state}
                      </span>
                    </div>
                    {visible && (
                      <div className="cop-layer-opacity">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={opacity}
                          onChange={(e) => onOpacityChange(layer.id, Number(e.target.value))}
                          className="cop-layer-opacity-slider"
                          aria-label={`Opacity for ${layer.layerType}`}
                        />
                        <span className="cop-layer-opacity-value">{opacity}%</span>
                      </div>
                    )}
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
