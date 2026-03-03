import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MissionMap.css';
import { MilSymbolMarker } from './MilSymbolMarker.js';
import { SensorCoverage } from './SensorCoverage.js';
import { commandService } from '../../../lib/command-service.js';
import { sensorService, type CoverageArea } from '../../../lib/sensor-service.js';
import type { CommandUnit as CommandUnitBase } from '../../../lib/types/command.js';

interface CommandUnitWithLocation extends CommandUnitBase {
  location?: { lat: number; lng: number };
}

/**
 * MissionMap
 *
 * Phase 4.4 Plan 08: Mission map with MIL-STD-2525D symbology and sensor coverage
 */

interface MissionMapProps {
  missionId: string;
  areaOfOps?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  onMarkerClick?: (unitId: string) => void;
}

/**
 * Component to handle map zoom to fit all markers
 */
function MapBounds({
  units,
  coverageAreas,
  areaOfOps,
}: {
  units: CommandUnitWithLocation[];
  coverageAreas: CoverageArea[];
  areaOfOps?: { type: 'Polygon'; coordinates: number[][][] };
}) {
  const map = useMap();

  useEffect(() => {
    const allPoints: L.LatLngExpression[] = [];

    // Add unit locations
    units.forEach(unit => {
      if (unit.location) {
        allPoints.push([unit.location.lat, unit.location.lng]);
      }
    });

    // Add sensor coverage centers
    coverageAreas.forEach(coverage => {
      allPoints.push([coverage.location.lat, coverage.location.lng]);
    });

    // Add area of operations boundary points
    if (areaOfOps?.coordinates?.[0]) {
      areaOfOps.coordinates[0].forEach(([lng, lat]) => {
        allPoints.push([lat, lng]);
      });
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [map, units, coverageAreas, areaOfOps]);

  return null;
}

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export function MissionMap({ missionId, areaOfOps, onMarkerClick }: MissionMapProps) {
  const [units, setUnits] = useState<CommandUnitWithLocation[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch units and sensors
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch units from command service
        const unitsData = await commandService.getUnits(missionId);
        if (mounted) {
          setUnits(unitsData);
        }

        // Fetch sensor coverage from sensor service
        const coverageData = await sensorService.getCoverage(missionId);
        if (mounted) {
          setCoverageAreas(coverageData);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load map data');
          console.error('Error loading map data:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      mounted = false;
    };
  }, [missionId]);

  // Calculate center point
  const defaultCenter: L.LatLngExpression = areaOfOps?.coordinates?.[0]?.[0]
    ? [areaOfOps.coordinates[0][0][1], areaOfOps.coordinates[0][0][0]]
    : [20, 0];

  const defaultZoom = 2;

  // World bounds to prevent showing multiple world copies
  const worldBounds: L.LatLngBoundsExpression = [
    [-85, -180], // Southwest corner
    [85, 180],   // Northeast corner
  ];

  // Convert AO coordinates from GeoJSON (lng, lat) to Leaflet (lat, lng)
  const aoPolygonPositions: L.LatLngExpression[] = areaOfOps?.coordinates?.[0]
    ? areaOfOps.coordinates[0].map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
    : [];

  // Filter units that have location data
  const unitsWithLocation = units.filter(unit => unit.location);

  return (
    <div className="mission-map">
      {loading && (
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <p>Loading mission data...</p>
        </div>
      )}

      {error && (
        <div className="map-error">
          <p>Error: {error}</p>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom={true}
        maxBounds={worldBounds}
        maxBoundsViscosity={1.0}
        className="map-container"
      >
        {/* Dark theme tiles from CARTO */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={DARK_TILE_URL}
          subdomains="abcd"
          maxZoom={18}
          noWrap={true}
          bounds={[[-85, -180], [85, 180]]}
        />

        {/* Area of Operations boundary */}
        {aoPolygonPositions.length > 0 && (
          <Polygon
            positions={aoPolygonPositions}
            pathOptions={{
              color: '#4a9eff',
              fillColor: '#4a9eff',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '10, 10',
            }}
          />
        )}

        {/* Unit markers with military symbols */}
        {unitsWithLocation.map(unit => (
          <MilSymbolMarker
            key={unit.id}
            position={[unit.location!.lat, unit.location!.lng]}
            sidc={unit.sidc}
            name={unit.name}
            uniqueDesignation={unit.echelon}
            onClick={() => onMarkerClick?.(unit.id)}
          />
        ))}

        {/* Sensor coverage areas */}
        {coverageAreas.map(coverage => (
          <SensorCoverage
            key={coverage.id}
            coverage={coverage}
          />
        ))}

        {/* Auto-fit bounds to show all content */}
        <MapBounds units={unitsWithLocation} coverageAreas={coverageAreas} areaOfOps={areaOfOps} />
      </MapContainer>

      {/* Map info overlay */}
      <div className="map-info">
        <div className="info-item">
          <span className="info-label">Units:</span>
          <span className="info-value">{unitsWithLocation.length}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Sensors:</span>
          <span className="info-value">{coverageAreas.length}</span>
        </div>
      </div>
    </div>
  );
}
