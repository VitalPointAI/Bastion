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

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, LIGHT_TILE_SUBDOMAINS } from '../../lib/map-tiles';
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
import { SwarmCOPLayer } from './SwarmCOPLayer.js';
import type { RegisteredResource } from '../../lib/resource-registry-service.js';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPMapViewProps {
  problemSetId: string;
  layerVisibility: Record<string, boolean>;
  layerOpacity: Record<string, number>;
  currentPerspective: Perspective;
  /** Optional phase for temporal filtering (used by COPPhaseSlider in Plan 10) */
  currentPhase?: number;
  /** Confidence threshold (0-1): symbols below this value are hidden. Default 0 (show all) */
  confidenceThreshold?: number;
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
  /** Currently selected robot ID for map click-to-navigate */
  selectedRobotId?: string | null;
  /** Callback providing a flyTo function for external map control (e.g. gate zoom) */
  onMapReady?: (flyTo: (lat: number, lng: number, zoom: number) => void) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check if symbol passes perspective filter */
function matchesPerspective(symbol: COPSymbolSpec, perspective: Perspective): boolean {
  if (perspective === 'combined') return true;
  if (perspective === 'friendly') return symbol.affiliation === 'friendly';
  // adversary perspective shows enemy symbols
  return symbol.affiliation === 'enemy';
}

/**
 * Derive the confidence tier from a symbol, falling back to the raw confidence value.
 * Phase 47 Plan 07 added confidenceTier to symbols; older symbols may only have confidence.
 */
function getSymbolTier(symbol: COPSymbolSpec): 'high' | 'medium' | 'low' {
  if (symbol.confidenceTier) return symbol.confidenceTier;
  const c = symbol.confidence ?? 1;
  if (c > 0.85) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

/**
 * Compute marker opacity modifier based on confidence tier.
 * Applied on top of the layer-level opacity.
 */
function getTierOpacityModifier(tier: 'high' | 'medium' | 'low'): number {
  switch (tier) {
    case 'high': return 1.0;
    case 'medium': return 0.7;
    case 'low': return 0.4;
  }
}

/**
 * Create a MIL-STD-2525D marker icon with an optional confidence badge overlay.
 *
 * For ghosted symbols (low tier): adds a dotted border ring around the icon.
 * For medium tier: adds an amber confidence percentage pill above the symbol.
 * For high tier: adds a green confidence percentage pill above the symbol.
 * No badge is shown when confidence === 1 (default, unlabeled symbols).
 */
function createMilSymbolIconWithBadge(
  sidc: string,
  designation: string | undefined,
  tier: 'high' | 'medium' | 'low',
  confidencePct: number,
): L.DivIcon {
  const baseIcon = createMilSymbolIcon(sidc, { uniqueDesignation: designation });
  const [w, h] = baseIcon.options.iconSize as [number, number];

  const badgeColor =
    tier === 'high' ? '#22c55e' :
    tier === 'medium' ? '#f59e0b' :
    '#ef4444';

  // Ghost ring for low-confidence symbols (dotted border circle overlay)
  const ghostRing =
    tier === 'low'
      ? `<div style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;
           border:2px dotted #ef4444;border-radius:50%;box-sizing:border-box;
           pointer-events:none;"></div>`
      : '';

  // Confidence badge pill above the symbol (shown for medium and high)
  const badge =
    tier !== 'high' || confidencePct < 100
      ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);
           background:${badgeColor};color:#fff;font-size:9px;font-weight:700;
           padding:1px 4px;border-radius:9px;white-space:nowrap;pointer-events:none;
           font-family:'Fira Code',monospace;line-height:1.4;">${confidencePct}%</div>`
      : '';

  return L.divIcon({
    className: 'milsymbol-marker',
    html: `<div style="position:relative;display:inline-block;">${(baseIcon.options.html as string) ?? ''}${ghostRing}${badge}</div>`,
    iconSize: [w, h + 14],
    iconAnchor: [w / 2, h / 2 + 14],
  });
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
  confidenceThreshold = 0,
  onLayersLoaded,
  onEntityClick,
  resourceLayerVisible = true,
  onResourceSelect,
  robotLayerVisible = true,
  onRobotClick,
  selectedRobotId,
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
          attribution={LIGHT_TILE_ATTRIBUTION}
          url={LIGHT_TILE_URL}
          subdomains={LIGHT_TILE_SUBDOMAINS}
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
              confidenceThreshold={confidenceThreshold}
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
          selectedRobotId={selectedRobotId}
        />

        {/* Swarm formation layer (Phase 48) — renders behind robot dots */}
        <SwarmCOPLayer />

        {/* Expose flyTo for external map control (gate notifications, zoom to action) */}
        {onMapReady && <MapFlyToController onMapReady={onMapReady} />}
      </MapContainer>
    </div>
  );
}

// ─── MapFlyToController (exposes flyTo for external control) ─────────────────

function MapFlyToController({ onMapReady }: { onMapReady: (flyTo: (lat: number, lng: number, zoom: number) => void) => void }) {
  const map = useMap();
  const calledRef = useRef(false);

  useEffect(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      onMapReady((lat, lng, zoom) => {
        map.flyTo([lat, lng], zoom, { duration: 1.5 });
      });
    }
  }, [map, onMapReady]);

  return null;
}

// ─── LayerContent (renders symbols, control measures, annotations) ──────────

interface LayerContentProps {
  layer: COPLayer;
  opacity: number;
  perspective: Perspective;
  currentPhase?: number;
  /** Minimum confidence to show symbol (0 = show all) */
  confidenceThreshold?: number;
  onEntityClick?: (entityId: string) => void;
}

function LayerContent({ layer, opacity, perspective, currentPhase, confidenceThreshold = 0, onEntityClick }: LayerContentProps) {
  const spec = layer.spec;
  if (!spec) return null;

  return (
    <>
      {/* Military symbols with confidence visual encoding */}
      {(spec.symbols ?? [])
        .filter((s) => matchesPerspective(s, perspective))
        .filter((s) => (s.confidence ?? 1) >= confidenceThreshold)
        .map((symbol) => {
          // Use movement path position if filtering by phase
          const position = getSymbolPosition(symbol, currentPhase);

          // Determine confidence tier and apply visual encoding
          const tier = getSymbolTier(symbol);
          const tierOpacity = getTierOpacityModifier(tier);
          const effectiveOpacity = opacity * tierOpacity;

          const confidencePct = Math.round((symbol.confidence ?? 1) * 100);
          const icon = createMilSymbolIconWithBadge(
            symbol.sidc,
            symbol.designation,
            tier,
            confidencePct,
          );

          // SVG stroke style based on confidence tier
          // high = solid, medium = dashed, low = dotted/ghost
          const strokeDasharray =
            tier === 'medium' ? '5,3' :
            tier === 'low' ? '2,2' :
            undefined;

          // Confidence badge color (amber for medium, red for low)
          const badgeColor =
            tier === 'medium' ? '#f59e0b' :
            tier === 'low' ? '#ef4444' :
            undefined;

          return (
            <Marker
              key={`${layer.id}-${symbol.entityId}`}
              position={toLatLng(position)}
              icon={icon}
              opacity={effectiveOpacity}
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
                  {/* Confidence tier badge */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-gray-500 text-xs">
                      Confidence: {Math.round((symbol.confidence ?? 1) * 100)}%
                    </span>
                    {badgeColor && (
                      <span
                        className="text-xs px-1 rounded text-white font-bold"
                        style={{ backgroundColor: badgeColor }}
                      >
                        {tier.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Provenance summary when available */}
                  {symbol.provenanceSummary && (
                    <p className="text-gray-400 text-xs mt-1">{symbol.provenanceSummary}</p>
                  )}
                  {/* Stroke encoding hint for dashed/ghost symbols */}
                  {strokeDasharray && (
                    <svg width="40" height="8" className="mt-1">
                      <line
                        x1="0" y1="4" x2="40" y2="4"
                        stroke={badgeColor}
                        strokeWidth="2"
                        strokeDasharray={strokeDasharray}
                      />
                    </svg>
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
