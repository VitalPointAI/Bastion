/**
 * COPMapView
 *
 * Phase 21 Plan 08: Main COP map component with stacked layer rendering.
 * Renders military symbols via milsymbol on a Leaflet map, control measures
 * as polylines/polygons, and LLM-generated SVG annotations in shadow DOM.
 *
 * Symbols are filtered by the current perspective (Friendly/Adversary/Combined).
 * Layer visibility and opacity are controlled via the COPLayerControls panel.
 */

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DARK_TILE_URL, DARK_TILE_ATTRIBUTION, DARK_TILE_SUBDOMAINS } from '../../lib/map-tiles';
import './COPMapView.css';

import type {
  COPLayer,
  COPSymbolSpec,
  COPControlMeasureSpec,
  COPAnnotationSpec,
  Perspective,
} from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
import { createMilSymbolIcon } from '../mission/map/MilSymbolMarker.js';
import { SandboxedSVG } from './SandboxedSVG.js';
import { COPResourceLayer } from './COPResourceLayer.js';
import { COPRobotLayer } from './COPRobotLayer.js';
import type { RegisteredResource } from '../../lib/resource-registry-service.js';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPMapViewProps {
  problemSetId: string;
  layerVisibility: Record<string, boolean>;
  layerOpacity: Record<string, number>;
  currentPerspective: Perspective;
  /** Optional phase for temporal filtering (used by COPPhaseSlider in Plan 10) */
  currentPhase?: number;
  /** Callback when layers are fetched (used by parent to update layer list) */
  onLayersLoaded?: (layers: COPLayer[]) => void;
  /** Callback when entity is clicked */
  onEntityClick?: (entityId: string) => void;
  /** Whether resource layer is visible */
  resourceLayerVisible?: boolean;
  /** Callback when a resource marker is selected */
  onResourceSelect?: (resource: RegisteredResource) => void;
  /** Whether robot layer is visible (Phase 06) */
  robotLayerVisible?: boolean;
  /** Callback when a robot marker is clicked (Phase 06) */
  onRobotClick?: (robotId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check if symbol passes perspective filter */
function matchesPerspective(symbol: COPSymbolSpec, perspective: Perspective): boolean {
  if (perspective === 'combined') return true;
  if (perspective === 'friendly') return symbol.affiliation === 'friendly';
  // adversary perspective shows enemy symbols
  return symbol.affiliation === 'enemy';
}

/** Check if control measure is visible in current phase */
function isInPhase(measure: COPControlMeasureSpec, currentPhase?: number): boolean {
  if (currentPhase === undefined || !measure.phaseRange) return true;
  return currentPhase >= measure.phaseRange.start && currentPhase <= measure.phaseRange.end;
}

/** Convert LatLng to Leaflet tuple */
function toLatLng(pos: { lat: number; lng: number }): [number, number] {
  return [pos.lat, pos.lng];
}

// ─── Default map center (Indo-Pacific — aligned with Pacific Strategy scenario) ──

const DEFAULT_CENTER: [number, number] = [25.0, 121.5];
const DEFAULT_ZOOM = 6;

// ─── Component ──────────────────────────────────────────────────────────────

export function COPMapView({
  problemSetId,
  layerVisibility,
  layerOpacity,
  currentPerspective,
  currentPhase,
  onLayersLoaded,
  onEntityClick,
  resourceLayerVisible = true,
  onResourceSelect,
  robotLayerVisible = true,
  onRobotClick,
}: COPMapViewProps) {
  const [layers, setLayers] = useState<COPLayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch layers on mount and when problemSetId changes
  const fetchLayers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all layers for this workspace (draft, published, cop, review)
      const allLayers = await copService.queryLayers(problemSetId);
      setLayers(allLayers);
      onLayersLoaded?.(allLayers);
    } catch (err) {
      console.error('[COPMapView] Failed to fetch layers:', err);
    } finally {
      setLoading(false);
    }
  }, [problemSetId, onLayersLoaded]);

  useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  // Get visible layers
  const visibleLayers = layers.filter((l) => layerVisibility[l.id] !== false);

  return (
    <div className="cop-map-container">
      {loading && (
        <div className="cop-map-loading">
          <span className="cop-map-loading-text">Loading COP layers...</span>
        </div>
      )}

      {!loading && layers.length === 0 && (
        <div className="cop-map-empty">
          <h3>No COP Layers</h3>
          <p>No published or promoted layers found for this problem set.</p>
        </div>
      )}

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="cop-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution={DARK_TILE_ATTRIBUTION}
          url={DARK_TILE_URL}
          subdomains={DARK_TILE_SUBDOMAINS}
          maxZoom={18}
        />

        {/* Render each visible layer's content */}
        {visibleLayers.map((layer) => {
          const opacity = (layerOpacity[layer.id] ?? 100) / 100;
          const spec = layer.spec;
          if (!spec) return null;

          return (
            <LayerContent
              key={layer.id}
              layer={layer}
              opacity={opacity}
              perspective={currentPerspective}
              currentPhase={currentPhase}
              onEntityClick={onEntityClick}
            />
          );
        })}

        {/* Resource registry layer with MIL-STD-2525D symbols */}
        {onResourceSelect && (
          <COPResourceLayer
            missionId={problemSetId}
            visible={resourceLayerVisible}
            onResourceSelect={onResourceSelect}
          />
        )}

        {/* Robot layer (Phase 06) */}
        <COPRobotLayer
          problemSetId={problemSetId}
          visible={robotLayerVisible}
          onRobotClick={onRobotClick}
        />
      </MapContainer>
    </div>
  );
}

// ─── LayerContent (renders symbols, control measures, annotations) ──────────

interface LayerContentProps {
  layer: COPLayer;
  opacity: number;
  perspective: Perspective;
  currentPhase?: number;
  onEntityClick?: (entityId: string) => void;
}

function LayerContent({ layer, opacity, perspective, currentPhase, onEntityClick }: LayerContentProps) {
  const spec = layer.spec;
  if (!spec) return null;

  return (
    <>
      {/* Military symbols */}
      {(spec.symbols ?? [])
        .filter((s) => matchesPerspective(s, perspective))
        .map((symbol) => {
          // Use movement path position if filtering by phase
          const position = getSymbolPosition(symbol, currentPhase);
          const icon = createMilSymbolIcon(symbol.sidc, {
            uniqueDesignation: symbol.designation,
          });

          return (
            <Marker
              key={`${layer.id}-${symbol.entityId}`}
              position={toLatLng(position)}
              icon={icon}
              opacity={opacity}
              eventHandlers={{
                click: () => onEntityClick?.(symbol.entityId),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h4 className="font-semibold">{symbol.designation}</h4>
                  <p className="text-gray-600 text-xs">SIDC: {symbol.sidc}</p>
                  <p className="text-gray-600 text-xs">
                    Affiliation: {symbol.affiliation}
                  </p>
                  {symbol.confidence < 1 && (
                    <p className="text-gray-500 text-xs">
                      Confidence: {Math.round(symbol.confidence * 100)}%
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* Control measures (polylines, polygons) */}
      {(spec.controlMeasures ?? [])
        .filter((cm) => isInPhase(cm, currentPhase))
        .map((cm) => {
          const positions = cm.points.map(toLatLng);
          const style = cm.style ?? {};
          const color = style.color ?? '#f59e0b';
          const weight = Number(style.weight ?? '2');

          if (cm.type === 'objective_area' || cm.type === 'boundary') {
            return (
              <Polygon
                key={`${layer.id}-cm-${cm.id}`}
                positions={positions}
                pathOptions={{
                  color,
                  weight,
                  opacity,
                  fillOpacity: opacity * 0.15,
                }}
              >
                <Popup><span className="text-sm">{cm.label}</span></Popup>
              </Polygon>
            );
          }

          return (
            <Polyline
              key={`${layer.id}-cm-${cm.id}`}
              positions={positions}
              pathOptions={{
                color,
                weight,
                opacity,
                dashArray: cm.type === 'phase_line' ? '8 4' : undefined,
              }}
            >
              <Popup><span className="text-sm">{cm.label}</span></Popup>
            </Polyline>
          );
        })}

      {/* Custom annotations (LLM-generated SVG in shadow DOM) */}
      {(spec.customAnnotations ?? []).map((annotation) => (
        <AnnotationOverlay
          key={`${layer.id}-ann-${annotation.id}`}
          annotation={annotation}
          opacity={opacity}
          onEntityClick={onEntityClick}
        />
      ))}
    </>
  );
}

// ─── AnnotationOverlay ──────────────────────────────────────────────────────

interface AnnotationOverlayProps {
  annotation: COPAnnotationSpec;
  opacity: number;
  onEntityClick?: (entityId: string) => void;
}

function AnnotationOverlay({ annotation, opacity, onEntityClick }: AnnotationOverlayProps) {
  // Render annotation as a marker with sandboxed SVG popup for now
  // Full SVG overlay positioning will use L.svgOverlay when bounds are available
  return (
    <Marker
      position={toLatLng(annotation.position)}
      opacity={opacity}
    >
      <Popup maxWidth={400}>
        <div>
          <p className="text-xs text-gray-500 mb-1">{annotation.description}</p>
          <SandboxedSVG
            svgFragment={annotation.svgFragment}
            width={300}
            height={200}
            onEntityClick={onEntityClick}
          />
        </div>
      </Popup>
    </Marker>
  );
}

// ─── Symbol Position Helper ─────────────────────────────────────────────────

function getSymbolPosition(
  symbol: COPSymbolSpec,
  currentPhase?: number
): { lat: number; lng: number } {
  if (currentPhase !== undefined && symbol.movementPath?.length) {
    // Find the position for the current phase
    const phasePos = symbol.movementPath.find((mp) => mp.phase === currentPhase);
    if (phasePos) return phasePos.position;

    // Find the closest earlier phase
    const earlier = symbol.movementPath
      .filter((mp) => mp.phase <= currentPhase)
      .sort((a, b) => b.phase - a.phase);
    if (earlier.length > 0) return earlier[0].position;
  }
  return symbol.position;
}
