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

// Annotation marker icon (small blue circle for SVG annotation positions)
const ANNOTATION_ICON = L.divIcon({
  className: 'milsymbol-marker',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:rgba(59,130,246,0.6);border:2px solid rgba(59,130,246,0.9);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});
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
import { KillZoneOverlay } from './KillZoneOverlay.js';
import { latLngToMGRS } from '../../lib/mgrs-coordinator.js';
import { SwarmCOPLayer } from './SwarmCOPLayer.js';
import type { RegisteredResource } from '../../lib/resource-registry-service.js';

// ─── Props ──────────────────────────────────────────────────────────────────

// Design overlay data from overlay_producer skill
export interface DesignOverlayData {
  /** Root SVG markup string */
  svg: string;
  /** Named layers that can be toggled independently */
  layers: Array<{ name: string; svg: string }>;
  /** Optional geo-bounds [sw_lat, sw_lng, ne_lat, ne_lng] for overlay placement */
  ao_bounds?: [number, number, number, number];
}

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
  /** Increment to trigger layer re-fetch (e.g. after seeding COP data) */
  refreshKey?: number;
  /** Design overlay SVG from overlay_producer skill (design.overlay_produced event) */
  designOverlay?: DesignOverlayData | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check if symbol passes perspective filter */
function matchesPerspective(symbol: COPSymbolSpec, perspective: Perspective): boolean {
  if (perspective === 'combined') return true;
  // OSINT symbols are intelligence — always show regardless of perspective
  if (symbol.assertedVia === 'osint_feed_pipeline') return true;
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
 * Create a custom OSINT icon from pre-built HTML (emoji-based markers).
 * Used for non-military OSINT events that shouldn't render as milsymbol.
 */
function createOSINTIcon(
  iconHtml: string,
  _tier: 'high' | 'medium' | 'low',
  _confidencePct: number,
): L.DivIcon {
  // Small markers — no confidence badge for OSINT events (too noisy at scale)
  const size = 18;
  return L.divIcon({
    className: 'osint-marker',
    html: iconHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
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
  const baseIcon = createMilSymbolIcon(sidc);
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
  onMapReady,
  refreshKey,
  designOverlay,
}: COPMapViewProps) {
  const [layers, setLayers] = useState<COPLayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch layers on mount and when problemSetId changes
  const fetchLayers = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const allLayers = await copService.queryLayers(problemSetId);
      // Only update state if data actually changed (prevents unnecessary re-renders/flicker)
      setLayers((prev) => {
        const prevJson = JSON.stringify(prev);
        const newJson = JSON.stringify(allLayers);
        if (prevJson === newJson) return prev;
        return allLayers;
      });
      onLayersLoaded?.(allLayers);
    } catch (err) {
      console.error('[COPMapView] Failed to fetch layers:', err);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [problemSetId, onLayersLoaded]);

  useEffect(() => {
    fetchLayers(false);
  }, [fetchLayers, refreshKey]);

  // Auto-refresh layers every 10s to pick up vision detections and destroyed markers
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLayers(true);
    }, 10000);
    return () => clearInterval(interval);
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
        minZoom={2}
        maxZoom={19}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
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

        {/* Kill zone and arcs of fire (autonomous mission) */}
        <KillZoneOverlay />

        {/* Swarm formation layer (Phase 48) — renders behind robot dots */}
        <SwarmCOPLayer />

        {/* Design overlay layer — SVG output from overlay_producer skill */}
        {designOverlay && (
          <DesignOverlayLayer overlay={designOverlay} />
        )}

        {/* MGRS coordinate display on mouse hover */}
        <MGRSCoordinateDisplay />

        {/* Expose flyTo for external map control (gate notifications, zoom to action) */}
        {onMapReady && <MapFlyToController onMapReady={onMapReady} />}
      </MapContainer>
    </div>
  );
}

// ─── DesignOverlayLayer ──────────────────────────────────────────────────────

/**
 * Renders overlay_producer SVG output on the Leaflet map.
 * Uses a custom Leaflet pane at zIndex 450 (above tiles, below markers).
 * Each named layer gets its own SVG element for independent toggling.
 */
function DesignOverlayLayer({ overlay }: { overlay: DesignOverlayData }) {
  const map = useMap();
  const overlayRef = useRef<L.SVGOverlay | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Create the design-overlay pane if it doesn't exist
    if (!map.getPane('design-overlay')) {
      map.createPane('design-overlay');
      const pane = map.getPane('design-overlay');
      if (pane) {
        pane.style.zIndex = '450';
        pane.style.opacity = '0.7';
        paneRef.current = pane;
      }
    }

    // Determine bounds for overlay placement
    // Use ao_bounds if provided, else fall back to current map bounds
    let bounds: L.LatLngBoundsExpression;
    if (overlay.ao_bounds) {
      const [swLat, swLng, neLat, neLng] = overlay.ao_bounds;
      bounds = [[swLat, swLng], [neLat, neLng]];
    } else {
      const mapBounds = map.getBounds();
      bounds = [
        [mapBounds.getSouth(), mapBounds.getWest()],
        [mapBounds.getNorth(), mapBounds.getEast()],
      ];
    }

    // Parse and validate the SVG string
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(overlay.svg, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');

    if (!svgElement) {
      console.warn('[DesignOverlayLayer] Invalid SVG string — no <svg> element found');
      return;
    }

    // Clean up previous overlay
    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }

    // Create SVG overlay on the design-overlay pane
    const svgOverlay = L.svgOverlay(svgElement as SVGSVGElement, bounds, {
      opacity: 0.75,
      interactive: false,
      pane: 'design-overlay',
    });

    svgOverlay.addTo(map);
    overlayRef.current = svgOverlay;

    return () => {
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
    };
  }, [map, overlay]);

  return null;
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

// ─── MGRS Coordinate Display ─────────────────────────────────────────────────

function MGRSCoordinateDisplay() {
  const map = useMap();
  const [mgrs, setMgrs] = useState('');
  const [latLng, setLatLng] = useState('');

  useEffect(() => {
    function handleMouseMove(e: L.LeafletMouseEvent) {
      const { lat, lng } = e.latlng;
      try {
        setMgrs(latLngToMGRS(lat, lng, 4));
        setLatLng(`${lat.toFixed(5)}°N ${lng.toFixed(5)}°E`);
      } catch {
        setMgrs('');
        setLatLng(`${lat.toFixed(5)} ${lng.toFixed(5)}`);
      }
    }

    map.on('mousemove', handleMouseMove);
    return () => { map.off('mousemove', handleMouseMove); };
  }, [map]);

  if (!mgrs && !latLng) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      left: 10,
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#e2e8f0',
      padding: '4px 8px',
      borderRadius: 4,
      fontSize: '0.7rem',
      fontFamily: "'Fira Code', monospace",
      pointerEvents: 'none',
      display: 'flex',
      gap: '12px',
    }}>
      {mgrs && <span style={{ color: '#93c5fd' }}>{mgrs}</span>}
      {latLng && <span style={{ color: '#94a3b8' }}>{latLng}</span>}
    </div>
  );
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

          // Use custom OSINT icon when provided, otherwise milsymbol
          const icon = symbol.iconHtml
            ? createOSINTIcon(symbol.iconHtml, tier, confidencePct)
            : createMilSymbolIconWithBadge(
                symbol.sidc,
                symbol.designation,
                tier,
                confidencePct,
              );

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
              <Popup maxWidth={320}>
                <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 300 }}>
                  {/* Title */}
                  <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                    {symbol.designation}
                  </h4>

                  {/* Category + Affiliation badges */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {symbol.iconHtml && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: '#1e293b', color: '#94a3b8',
                      }}>
                        {symbol.ccoClass?.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: symbol.affiliation === 'enemy' ? '#7f1d1d' :
                                  symbol.affiliation === 'friendly' ? '#1e3a5f' : '#374151',
                      color: symbol.affiliation === 'enemy' ? '#fca5a5' :
                             symbol.affiliation === 'friendly' ? '#93c5fd' : '#9ca3af',
                    }}>
                      {symbol.affiliation}
                    </span>
                    {badgeColor && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: badgeColor, color: '#fff', fontWeight: 600,
                      }}>
                        {Math.round((symbol.confidence ?? 1) * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {symbol.description && (
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>
                      {symbol.description}
                    </p>
                  )}

                  {/* Actors / Linkages */}
                  {symbol.actors && symbol.actors.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Linked actors: </span>
                      <span style={{ fontSize: 10, color: '#374151' }}>
                        {symbol.actors.slice(0, 5).join(', ')}
                        {symbol.actors.length > 5 ? ` +${symbol.actors.length - 5} more` : ''}
                      </span>
                    </div>
                  )}

                  {/* Source */}
                  <div style={{ fontSize: 10, color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: 4, marginTop: 2 }}>
                    <span>{symbol.sourceAuthority}</span>
                    {symbol.sourceUrl && (
                      <>
                        {' — '}
                        <a
                          href={symbol.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#3b82f6', textDecoration: 'underline' }}
                        >
                          View source
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* Animated directional arrows for OSINT events with origin→target */}
      {(spec.symbols ?? [])
        .filter((s) => s.originPosition && s.targetPosition)
        .filter((s) => matchesPerspective(s, perspective))
        .map((symbol) => {
          const origin = symbol.originPosition!;
          const target = symbol.targetPosition!;
          // Category-based color
          const arrowColor =
            symbol.affiliation === 'enemy' ? '#ef4444' :
            symbol.affiliation === 'friendly' ? '#3b82f6' :
            '#f59e0b';

          return (
            <Polyline
              key={`${layer.id}-arrow-${symbol.entityId}`}
              positions={[
                [origin.lat, origin.lng],
                [target.lat, target.lng],
              ]}
              pathOptions={{
                color: arrowColor,
                weight: 2,
                opacity: opacity * 0.7,
                dashArray: '8 4',
                className: 'cop-osint-arrow',
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h4 className="font-semibold">{symbol.designation}</h4>
                  <p className="text-gray-500 text-xs">
                    {symbol.ccoClass?.replace(/_/g, ' ')} — directional event
                  </p>
                </div>
              </Popup>
            </Polyline>
          );
        })}

      {/* Arrowhead markers at target end of directional OSINT events */}
      {(spec.symbols ?? [])
        .filter((s) => s.originPosition && s.targetPosition)
        .filter((s) => matchesPerspective(s, perspective))
        .map((symbol) => {
          const origin = symbol.originPosition!;
          const target = symbol.targetPosition!;
          // Compute arrow angle for the arrowhead
          const dx = target.lng - origin.lng;
          const dy = target.lat - origin.lat;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const arrowColor =
            symbol.affiliation === 'enemy' ? '#ef4444' :
            symbol.affiliation === 'friendly' ? '#3b82f6' :
            '#f59e0b';

          const arrowheadIcon = L.divIcon({
            className: 'osint-arrowhead',
            html: `<div style="
              width:0;height:0;
              border-left:6px solid transparent;
              border-right:6px solid transparent;
              border-bottom:10px solid ${arrowColor};
              transform:rotate(${90 - angle}deg);
              opacity:0.8;
            "></div>`,
            iconSize: [12, 10],
            iconAnchor: [6, 5],
          });

          return (
            <Marker
              key={`${layer.id}-arrowhead-${symbol.entityId}`}
              position={[target.lat, target.lng]}
              icon={arrowheadIcon}
              opacity={opacity * 0.8}
              interactive={false}
            />
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
      icon={ANNOTATION_ICON}
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
