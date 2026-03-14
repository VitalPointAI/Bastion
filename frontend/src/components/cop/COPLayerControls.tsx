/**
 * COPLayerControls
 *
 * GIS-style layer toggle panel for COP overlays.
 * Includes perspective toggle, resource/robot layer toggles,
 * grouped layer management by type with opacity sliders and delete.
 */

import { useState } from 'react';
import type { COPLayer, COPLayerType, Perspective } from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
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

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPLayerControlsProps {
  layers: COPLayer[];
  layerVisibility: Record<string, boolean>;
  layerOpacity: Record<string, number>;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
  onLayerDeleted?: (layerId: string) => void;
  currentPerspective: Perspective;
  onPerspectiveChange: (perspective: Perspective) => void;
  resourceLayerVisible: boolean;
  onResourceLayerToggle: () => void;
  robotLayerVisible: boolean;
  onRobotLayerToggle: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function COPLayerControls({
  layers,
  layerVisibility,
  layerOpacity,
  onVisibilityChange,
  onOpacityChange,
  onLayerDeleted,
  currentPerspective,
  onPerspectiveChange,
  resourceLayerVisible,
  onResourceLayerToggle,
  robotLayerVisible,
  onRobotLayerToggle,
}: COPLayerControlsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const t of LAYER_TYPE_ORDER) initial[t] = true;
    return initial;
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Group layers by layerType
  const groups: Record<string, COPLayer[]> = {};
  for (const layer of layers) {
    if (!groups[layer.layerType]) {
      groups[layer.layerType] = [];
    }
    groups[layer.layerType].push(layer);
  }

  const orderedTypes = LAYER_TYPE_ORDER.filter((t) => groups[t]?.length > 0);
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
    for (const layer of layers) onVisibilityChange(layer.id, true);
  }

  function handleHideAll() {
    for (const layer of layers) onVisibilityChange(layer.id, false);
  }

  async function handleDeleteLayer(layerId: string, layerName: string) {
    if (!confirm(`Delete layer "${layerName}"? This cannot be undone.`)) return;
    setDeletingId(layerId);
    try {
      await copService.deleteLayer(layerId);
      onLayerDeleted?.(layerId);
    } catch {
      // Non-fatal
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="cop-layer-controls">
      {/* ── Perspective Toggle ── */}
      <div className="cop-perspective-section">
        <span className="cop-section-label">Perspective</span>
        <div className="cop-perspective-toggle">
          {(['friendly', 'adversary', 'combined'] as Perspective[]).map((p) => (
            <button
              key={p}
              className={`cop-perspective-btn ${currentPerspective === p ? 'active' : ''} cop-perspective-${p}`}
              onClick={() => onPerspectiveChange(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Layers Header ── */}
      <div className="cop-layer-controls-header">
        <span className="cop-layer-controls-title">COP Layers</span>
        <span className="cop-layer-count">{totalVisible}/{layers.length} visible</span>
      </div>

      {/* Bulk actions */}
      <div className="cop-layer-bulk-actions">
        <button className="cop-layer-bulk-btn" onClick={handleShowAll}>Show All</button>
        <button className="cop-layer-bulk-btn" onClick={handleHideAll}>Hide All</button>
      </div>

      {/* ── Resources layer ── */}
      <div className="cop-layer-group">
        <div className="cop-layer-item">
          <input
            type="checkbox"
            id="cop-layer-resources"
            checked={resourceLayerVisible}
            onChange={onResourceLayerToggle}
            className="cop-layer-checkbox"
          />
          <span className="cop-layer-color-swatch" style={{ backgroundColor: '#f59e0b' }} />
          <label htmlFor="cop-layer-resources" className="cop-layer-item-label">
            Resources
          </label>
        </div>
      </div>

      {/* ── Robots layer ── */}
      <div className="cop-layer-group">
        <div className="cop-layer-item">
          <input
            type="checkbox"
            id="cop-layer-robots"
            checked={robotLayerVisible}
            onChange={onRobotLayerToggle}
            className="cop-layer-checkbox"
          />
          <span className="cop-layer-color-swatch" style={{ backgroundColor: '#22c55e' }} />
          <label htmlFor="cop-layer-robots" className="cop-layer-item-label">
            Robots
          </label>
        </div>
      </div>

      {/* ── COP Layer groups ── */}
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
                    const symbolCount = layer.spec?.symbols?.length ?? 0;
                    const label = `${LAYER_TYPE_LABELS[layer.layerType] ?? layer.layerType}${
                      symbolCount > 0 ? ` (${symbolCount})` : ''
                    }`;

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
                          <label htmlFor={`cop-layer-${layer.id}`} className="cop-layer-item-label" title={layer.id}>
                            {label}
                          </label>
                          <span className={`cop-layer-state-badge ${STATE_CLASSES[layer.state] ?? ''}`}>
                            {layer.state}
                          </span>
                          <button
                            className="cop-layer-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLayer(layer.id, label);
                            }}
                            disabled={deletingId === layer.id}
                            title="Delete layer"
                          >
                            {deletingId === layer.id ? '...' : '\u2715'}
                          </button>
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
