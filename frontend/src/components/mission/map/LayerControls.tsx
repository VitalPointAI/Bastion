import { useState } from 'react';
import './LayerControls.css';

/**
 * LayerControls
 *
 * Phase 4.4 Plan 08: Floating control panel for map layer toggles
 */

export interface LayerVisibility {
  units: boolean;
  weaponSystems: boolean;
  vehicles: boolean;
  equipment: boolean;
  communication: boolean;
  sensorAirborne: boolean;
  sensorGround: boolean;
  sensorMaritime: boolean;
  sensorSpace: boolean;
  sensorAutonomous: boolean;
  aoBoundary: boolean;
  sensorCoverage: boolean;
}

interface LayerControlsProps {
  visibility: LayerVisibility;
  onToggle: (layer: keyof LayerVisibility) => void;
  onResetView: () => void;
}

export function LayerControls({ visibility, onToggle, onResetView }: LayerControlsProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`layer-controls ${collapsed ? 'collapsed' : ''}`}>
      <div className="controls-header">
        <h3>Map Layers</h3>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand controls' : 'Collapse controls'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && (
        <div className="controls-body">
          {/* Units section */}
          <div className="control-section">
            <h4>Units & Forces</h4>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.units}
                onChange={() => onToggle('units')}
              />
              <span className="control-icon">🎖️</span>
              <span className="control-label">Units</span>
            </label>
          </div>

          {/* Resources section */}
          <div className="control-section">
            <h4>Resources</h4>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.weaponSystems}
                onChange={() => onToggle('weaponSystems')}
              />
              <span className="control-icon">🔫</span>
              <span className="control-label">Weapon Systems</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.vehicles}
                onChange={() => onToggle('vehicles')}
              />
              <span className="control-icon">🚙</span>
              <span className="control-label">Vehicles</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.equipment}
                onChange={() => onToggle('equipment')}
              />
              <span className="control-icon">📦</span>
              <span className="control-label">Equipment</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.communication}
                onChange={() => onToggle('communication')}
              />
              <span className="control-icon">📡</span>
              <span className="control-label">Communications</span>
            </label>
          </div>

          {/* Sensors section */}
          <div className="control-section">
            <h4>Sensors</h4>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.sensorAirborne}
                onChange={() => onToggle('sensorAirborne')}
              />
              <span className="control-icon">✈️</span>
              <span className="control-label">Airborne</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.sensorGround}
                onChange={() => onToggle('sensorGround')}
              />
              <span className="control-icon">📍</span>
              <span className="control-label">Ground</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.sensorMaritime}
                onChange={() => onToggle('sensorMaritime')}
              />
              <span className="control-icon">⚓</span>
              <span className="control-label">Maritime</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.sensorSpace}
                onChange={() => onToggle('sensorSpace')}
              />
              <span className="control-icon">🛰️</span>
              <span className="control-label">Space</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.sensorAutonomous}
                onChange={() => onToggle('sensorAutonomous')}
              />
              <span className="control-icon">🤖</span>
              <span className="control-label">Autonomous</span>
            </label>
          </div>

          {/* Overlays section */}
          <div className="control-section">
            <h4>Overlays</h4>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.aoBoundary}
                onChange={() => onToggle('aoBoundary')}
              />
              <span className="control-icon">🔲</span>
              <span className="control-label">AO Boundary</span>
            </label>
            <label className="control-item">
              <input
                type="checkbox"
                checked={visibility.sensorCoverage}
                onChange={() => onToggle('sensorCoverage')}
              />
              <span className="control-icon">📊</span>
              <span className="control-label">Sensor Coverage</span>
            </label>
          </div>

          {/* Actions */}
          <div className="control-section">
            <button className="reset-view-btn" onClick={onResetView}>
              🔄 Reset View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
