import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import ms from 'milsymbol';
import 'leaflet/dist/leaflet.css';
import { DARK_TILE_URL, DARK_TILE_ATTRIBUTION, DARK_TILE_SUBDOMAINS } from '../../lib/map-tiles';
import './COASketchMap.css';

// ==========================================================================
// Frontend Type Definitions (mirroring backend types)
// ==========================================================================

type SymbolAffiliationFE = 'friendly' | 'enemy' | 'neutral' | 'unknown' | 'combined' | 'partner';
type SymbolDimensionFE = 'land_unit' | 'air' | 'sea_surface' | 'subsurface' | 'equipment' | 'installation';
type EchelonFE = 'team' | 'squad' | 'section' | 'platoon' | 'company' | 'battalion' | 'brigade' | 'division' | 'corps' | 'army';

interface SketchSymbolFE {
  id: string;
  sidc: string;
  designation: string;
  affiliation: SymbolAffiliationFE;
  dimension: SymbolDimensionFE;
  echelon: EchelonFE;
  position: { lat: number; lng: number };
  resources: Array<{ type: string; description: string; quantity: number }>;
  tasks: string[];
  activeInPhases: number[];
  movementPath?: Array<{ phase: number; position: { lat: number; lng: number } }>;
}

interface ControlMeasureFE {
  id: string;
  type: string;
  label: string;
  geometry: {
    type: 'line' | 'polygon' | 'point';
    coordinates: Array<{ lat: number; lng: number }>;
  };
  affiliation: SymbolAffiliationFE;
  activeInPhases: number[];
}

interface SketchPhaseFE {
  number: number;
  name: string;
  description: string;
  estimatedDuration: string;
  keyTasks: string[];
}

interface AOBoundsFE {
  southwest: { lat: number; lng: number };
  northeast: { lat: number; lng: number };
}

export interface COASketchDataFE {
  coaId: string;
  coaName: string;
  aoBounds: AOBoundsFE;
  symbols: SketchSymbolFE[];
  controlMeasures: ControlMeasureFE[];
  phases: SketchPhaseFE[];
  legend: Array<{ sidc: string; description: string }>;
  createdAt: number;
}

// ==========================================================================
// Component Props
// ==========================================================================

interface COASketchMapProps {
  sketch: COASketchDataFE;
  currentPhase: number;
  visibleAffiliations: Set<string>;
  onSymbolClick?: (symbol: SketchSymbolFE) => void;
  onPhaseChange?: (phase: number) => void;
}

// ==========================================================================
// Helper: Get Symbol Position for Phase
// ==========================================================================

function getSymbolPositionForPhase(symbol: SketchSymbolFE, phaseNumber: number): { lat: number; lng: number } {
  if (symbol.movementPath && symbol.movementPath.length > 0) {
    const phasePosition = symbol.movementPath.find((p) => p.phase === phaseNumber);
    if (phasePosition) {
      return phasePosition.position;
    }
  }
  return symbol.position;
}

// ==========================================================================
// SVG Overlay Component (renders symbols and control measures)
// ==========================================================================

function SVGOverlay({ sketch, currentPhase, visibleAffiliations, onSymbolClick }: {
  sketch: COASketchDataFE;
  currentPhase: number;
  visibleAffiliations: Set<string>;
  onSymbolClick?: (symbol: SketchSymbolFE) => void;
}) {
  const map = useMap();
  const overlayRef = useRef<L.SVGOverlay | null>(null);

  useEffect(() => {
    // Filter symbols for current phase and visible affiliations
    const activeSymbols = sketch.symbols.filter(
      (symbol) =>
        symbol.activeInPhases.includes(currentPhase) &&
        visibleAffiliations.has(symbol.affiliation)
    );

    // Filter control measures for current phase
    const activeControlMeasures = sketch.controlMeasures.filter((measure) =>
      measure.activeInPhases.includes(currentPhase)
    );

    // Create SVG container
    const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgContainer.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgContainer.setAttribute('viewBox', '0 0 1000 1000');
    svgContainer.style.width = '100%';
    svgContainer.style.height = '100%';

    // Render control measures
    activeControlMeasures.forEach((measure) => {
      const color = measure.affiliation === 'friendly' ? '#0066cc' : measure.affiliation === 'enemy' ? '#cc0000' : '#666666';

      if (measure.geometry.type === 'line') {
        const points = measure.geometry.coordinates.map((coord) => {
          const point = map.latLngToContainerPoint([coord.lat, coord.lng]);
          return `${point.x},${point.y}`;
        }).join(' ');

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', points);
        polyline.setAttribute('stroke', color);
        polyline.setAttribute('stroke-width', '2');
        polyline.setAttribute('fill', 'none');
        if (measure.type === 'phase_line') {
          polyline.setAttribute('stroke-dasharray', '5,5');
        }
        svgContainer.appendChild(polyline);

        // Add label
        if (measure.geometry.coordinates.length > 0) {
          const midIndex = Math.floor(measure.geometry.coordinates.length / 2);
          const labelPoint = map.latLngToContainerPoint([
            measure.geometry.coordinates[midIndex].lat,
            measure.geometry.coordinates[midIndex].lng,
          ]);
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', String(labelPoint.x));
          text.setAttribute('y', String(labelPoint.y - 5));
          text.setAttribute('fill', color);
          text.setAttribute('font-size', '12');
          text.setAttribute('font-weight', 'bold');
          text.textContent = measure.label;
          svgContainer.appendChild(text);
        }
      } else if (measure.geometry.type === 'polygon') {
        const points = measure.geometry.coordinates.map((coord) => {
          const point = map.latLngToContainerPoint([coord.lat, coord.lng]);
          return `${point.x},${point.y}`;
        }).join(' ');

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', points);
        polygon.setAttribute('stroke', color);
        polygon.setAttribute('stroke-width', '2');
        polygon.setAttribute('fill', color);
        polygon.setAttribute('fill-opacity', '0.1');
        svgContainer.appendChild(polygon);
      }
    });

    // Render symbols using milsymbol
    activeSymbols.forEach((symbol) => {
      const position = getSymbolPositionForPhase(symbol, currentPhase);
      const point = map.latLngToContainerPoint([position.lat, position.lng]);

      // Generate MIL-STD-2525D symbol using milsymbol
      const milSymbol = new ms.Symbol(symbol.sidc, {
        size: 30,
        uniqueDesignation: symbol.designation,
      });

      // Create image element from milsymbol SVG
      const symbolImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      symbolImage.setAttribute('x', String(point.x - 15));
      symbolImage.setAttribute('y', String(point.y - 15));
      symbolImage.setAttribute('width', '30');
      symbolImage.setAttribute('height', '30');
      symbolImage.setAttribute('href', milSymbol.toDataURL());
      symbolImage.setAttribute('class', 'coa-symbol');
      symbolImage.setAttribute('data-symbol-id', symbol.id);
      symbolImage.style.cursor = 'pointer';

      // Add click handler
      symbolImage.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onSymbolClick) {
          onSymbolClick(symbol);
        }
      });

      svgContainer.appendChild(symbolImage);
    });

    // Create bounds for overlay (cover entire map)
    const bounds = L.latLngBounds([
      [sketch.aoBounds.southwest.lat, sketch.aoBounds.southwest.lng],
      [sketch.aoBounds.northeast.lat, sketch.aoBounds.northeast.lng],
    ]);

    // Remove previous overlay if exists
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
    }

    // Add new SVG overlay
    const overlay = L.svgOverlay(svgContainer, bounds, {
      interactive: true,
    });
    overlay.addTo(map);
    overlayRef.current = overlay;

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
      }
    };
  }, [sketch, currentPhase, visibleAffiliations, map, onSymbolClick]);

  return null;
}

// ==========================================================================
// Main COASketchMap Component
// ==========================================================================

export function COASketchMap({
  sketch,
  currentPhase,
  visibleAffiliations,
  onSymbolClick,
}: COASketchMapProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<SketchSymbolFE | null>(null);
  const [activeAffiliations, setActiveAffiliations] = useState<Set<string>>(visibleAffiliations);

  // Update active affiliations when prop changes
  useEffect(() => {
    setActiveAffiliations(visibleAffiliations);
  }, [visibleAffiliations]);

  const toggleAffiliation = (affiliation: string) => {
    const newSet = new Set(activeAffiliations);
    if (newSet.has(affiliation)) {
      newSet.delete(affiliation);
    } else {
      newSet.add(affiliation);
    }
    setActiveAffiliations(newSet);
  };

  const handleSymbolClick = (symbol: SketchSymbolFE) => {
    setSelectedSymbol(symbol);
    if (onSymbolClick) {
      onSymbolClick(symbol);
    }
  };

  // Calculate map center from AO bounds
  const center: [number, number] = [
    (sketch.aoBounds.southwest.lat + sketch.aoBounds.northeast.lat) / 2,
    (sketch.aoBounds.southwest.lng + sketch.aoBounds.northeast.lng) / 2,
  ];

  return (
    <div className="coa-sketch-map-container">
      {/* Affiliation Filter Controls */}
      <div className="affiliation-filters">
        <h4>Affiliations</h4>
        {(['friendly', 'enemy', 'neutral', 'combined', 'partner', 'unknown'] as const).map((affiliation) => (
          <label key={affiliation} className="affiliation-checkbox">
            <input
              type="checkbox"
              checked={activeAffiliations.has(affiliation)}
              onChange={() => toggleAffiliation(affiliation)}
            />
            <span className={`affiliation-label affiliation-${affiliation}`}>
              {affiliation.charAt(0).toUpperCase() + affiliation.slice(1)}
            </span>
          </label>
        ))}
      </div>

      {/* Legend Panel */}
      <div className="legend-panel">
        <h4>Legend</h4>
        <div className="legend-items">
          {sketch.legend.map((item, idx) => {
            const milSymbol = new ms.Symbol(item.sidc, { size: 20 });
            return (
              <div key={idx} className="legend-item">
                <img src={milSymbol.toDataURL()} alt={item.description} />
                <span>{item.description}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={center}
        zoom={10}
        className="coa-map"
        bounds={[
          [sketch.aoBounds.southwest.lat, sketch.aoBounds.southwest.lng],
          [sketch.aoBounds.northeast.lat, sketch.aoBounds.northeast.lng],
        ]}
      >
        <TileLayer
          attribution={DARK_TILE_ATTRIBUTION}
          url={DARK_TILE_URL}
          subdomains={DARK_TILE_SUBDOMAINS}
          maxZoom={18}
        />
        <SVGOverlay
          sketch={sketch}
          currentPhase={currentPhase}
          visibleAffiliations={activeAffiliations}
          onSymbolClick={handleSymbolClick}
        />
      </MapContainer>

      {/* Symbol Details Popup */}
      {selectedSymbol && (
        <div className="symbol-popup">
          <button className="close-popup" onClick={() => setSelectedSymbol(null)}>
            ×
          </button>
          <h3>{selectedSymbol.designation}</h3>
          <p className="symbol-affiliation">Affiliation: {selectedSymbol.affiliation}</p>

          <div className="symbol-resources">
            <h4>Resources</h4>
            {selectedSymbol.resources.length > 0 ? (
              <ul>
                {selectedSymbol.resources.map((resource, idx) => (
                  <li key={idx}>
                    {resource.quantity}x {resource.type} - {resource.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No resources assigned</p>
            )}
          </div>

          <div className="symbol-tasks">
            <h4>Tasks</h4>
            {selectedSymbol.tasks.length > 0 ? (
              <ul>
                {selectedSymbol.tasks.map((task, idx) => (
                  <li key={idx}>{task}</li>
                ))}
              </ul>
            ) : (
              <p>No tasks assigned</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
