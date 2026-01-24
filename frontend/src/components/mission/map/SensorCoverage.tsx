import { Circle, Popup } from 'react-leaflet';
import type { SensorCategory, SensorStatus, CoverageArea } from '../../../lib/sensor-service.js';

/**
 * SensorCoverage
 *
 * Phase 4.4 Plan 08: Renders sensor coverage areas as circles on the map
 */

interface SensorCoverageProps {
  coverage: CoverageArea;
  onClick?: () => void;
}

/**
 * Get color for sensor category
 */
function getCategoryColor(category: SensorCategory): string {
  switch (category) {
    case 'airborne':
      return '#4a9eff'; // Blue
    case 'ground':
      return '#50c878'; // Green
    case 'maritime':
      return '#00CED1'; // Cyan
    case 'space':
      return '#9370DB'; // Purple
    case 'autonomous':
      return '#ffa500'; // Orange
    default:
      return '#888888'; // Gray
  }
}

/**
 * Get opacity based on status
 */
function getStatusOpacity(status: SensorStatus): number {
  switch (status) {
    case 'operational':
      return 0.3;
    case 'degraded':
      return 0.2;
    case 'offline':
      return 0.1;
    case 'maintenance':
      return 0.15;
    default:
      return 0.2;
  }
}

/**
 * Renders sensor coverage as a circle overlay
 */
export function SensorCoverage({ coverage, onClick }: SensorCoverageProps) {
  const color = getCategoryColor(coverage.category);
  const opacity = getStatusOpacity(coverage.status);

  return (
    <Circle
      center={[coverage.location.lat, coverage.location.lng]}
      radius={coverage.range}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: opacity,
        weight: 2,
        opacity: 0.8,
      }}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="sensor-popup">
          <h4>{coverage.sensorName}</h4>
          <div className={`sensor-category ${coverage.category}`}>
            {coverage.category}
          </div>
          <div className={`sensor-status status-${coverage.status}`}>
            Status: {coverage.status}
          </div>
          <p className="coverage-info">
            Range: {(coverage.range / 1000).toFixed(1)} km
          </p>
          {coverage.coverageArea && (
            <p className="coverage-info">
              Area: {(coverage.coverageArea / 1000000).toFixed(1)} km²
            </p>
          )}
        </div>
      </Popup>
    </Circle>
  );
}
