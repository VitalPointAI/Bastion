import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, LayersControl, LayerGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import ms from 'milsymbol';
import 'leaflet/dist/leaflet.css';
import { DARK_TILE_URL, DARK_TILE_ATTRIBUTION, DARK_TILE_SUBDOMAINS } from '../../lib/map-tiles';
import './ValidityMap.css';
import type { IPBLayer } from '../../types/exercise';

// Fix for default marker icons in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ─── IPB Layer Colors ──────────────────────────────────────────────────────────

const IPB_LAYER_COLORS: Record<string, string> = {
  blue_forces: '#0066cc',
  red_forces: '#cc0000',
  red_self: '#990000',
  key_terrain: '#50c878',
  avenue_of_approach: '#ffa500',
  named_area: '#ffcc00',
  engagement_area: '#ff00ff',
  obstacle: '#888888',
};

/** Get color for a given IPB layer */
function getIPBLayerColor(layer: IPBLayer): string {
  if (layer.layerType === 'forces') {
    return layer.team === 'red' ? IPB_LAYER_COLORS.red_forces : IPB_LAYER_COLORS.blue_forces;
  }
  const colorMap: Record<string, string> = {
    key_terrain: IPB_LAYER_COLORS.key_terrain,
    avenue_of_approach: IPB_LAYER_COLORS.avenue_of_approach,
    nai: IPB_LAYER_COLORS.named_area,
    engagement_area: IPB_LAYER_COLORS.engagement_area,
    obstacle: IPB_LAYER_COLORS.obstacle,
  };
  return colorMap[layer.layerType] ?? '#888888';
}

// ─── Existing Marker Interfaces ────────────────────────────────────────────────

interface EventMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  relevance: 'supporting' | 'contradicting' | 'neutral';
  timestamp: string;
  sourceUrl?: string;
}

interface ActorMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: 'nation' | 'organization' | 'individual' | 'non_state_actor';
  description?: string;
}

interface TensionCircle {
  id: string;
  lat: number;
  lng: number;
  description: string;
  intensity: 'low' | 'medium' | 'high' | 'critical';
  radius: number; // in meters
}

// ─── ValidityMap Props ─────────────────────────────────────────────────────────

interface ValidityMapProps {
  problemSetId?: string;
  events?: EventMarker[];
  actors?: ActorMarker[];
  tensions?: TensionCircle[];
  onEventClick?: (event: EventMarker) => void;
  onActorClick?: (actor: ActorMarker) => void;
  // IPB layer props — all optional; when absent, component behaves exactly as before
  ipbLayers?: IPBLayer[];
  layerVisibility?: Record<string, boolean>;
  perspective?: 'blue' | 'red';
  onPerspectiveChange?: (p: 'blue' | 'red') => void;
  center?: [number, number];
  zoom?: number;
}

// ─── Custom Event Marker Icons ─────────────────────────────────────────────────

const createEventIcon = (relevance: string) => {
  const color = relevance === 'supporting' ? '#50c878' :
                relevance === 'contradicting' ? '#ff6b6b' :
                '#4a9eff';

  return L.divIcon({
    className: 'custom-event-marker',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.8);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// ─── Custom Actor Marker Icons ─────────────────────────────────────────────────

const createActorIcon = (type: string) => {
  const typeInitials: Record<string, string> = {
    nation: 'N',
    organization: 'O',
    individual: 'I',
    non_state_actor: 'NSA',
  };

  const color = type === 'nation' ? '#4a9eff' :
                type === 'organization' ? '#50c878' :
                type === 'individual' ? '#ffa500' :
                '#ff6b6b';

  const initials = typeInitials[type] || '?';

  return L.divIcon({
    className: 'custom-actor-marker',
    html: `<div style="background-color: ${color}; color: #fff; width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">${initials}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// ─── Tension Circle Colors ─────────────────────────────────────────────────────

const getTensionColor = (intensity: string) => {
  switch (intensity) {
    case 'critical': return '#ff0000';
    case 'high': return '#ff6b6b';
    case 'medium': return '#ffa500';
    case 'low': return '#ffcc00';
    default: return '#888888';
  }
};

// ─── MapBounds Component ───────────────────────────────────────────────────────

function MapBounds({ events, actors, tensions }: { events?: EventMarker[], actors?: ActorMarker[], tensions?: TensionCircle[] }) {
  const map = useMap();

  useEffect(() => {
    const allPoints: L.LatLngExpression[] = [];

    events?.forEach(e => allPoints.push([e.lat, e.lng]));
    actors?.forEach(a => allPoints.push([a.lat, a.lng]));
    tensions?.forEach(t => allPoints.push([t.lat, t.lng]));

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [map, events, actors, tensions]);

  return null;
}

// ─── MapResizer Component ──────────────────────────────────────────────────────

function MapResizer() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 300);
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

// ─── IPB Unit Marker (milsymbol) ───────────────────────────────────────────────

function createMilsymbolIcon(sidc: string, perspective?: 'blue' | 'red'): L.DivIcon {
  try {
    const symbol = new ms.Symbol(sidc, { size: 30 });
    return L.divIcon({
      className: 'milsymbol-marker',
      html: symbol.asSVG(),
      iconSize: [symbol.getSize().width, symbol.getSize().height],
      iconAnchor: [symbol.getAnchor().x, symbol.getAnchor().y],
    });
  } catch {
    // Fallback to colored circle if SIDC is invalid
    const color = perspective === 'red' ? '#cc0000' : '#0066cc';
    return L.divIcon({
      className: 'milsymbol-marker',
      html: `<div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.8);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }
}

function createUnitFallbackIcon(team: 'blue' | 'red'): L.DivIcon {
  const color = team === 'red' ? '#cc0000' : '#0066cc';
  return L.divIcon({
    className: 'milsymbol-marker',
    html: `<div style="background-color:${color};width:20px;height:20px;border-radius:3px;border:2px solid rgba(255,255,255,0.8);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// ─── IPBLayerRenderer Component ────────────────────────────────────────────────

interface IPBLayerRendererProps {
  ipbLayers: IPBLayer[];
  layerVisibility: Record<string, boolean>;
  perspective?: 'blue' | 'red';
}

function IPBLayerRenderer({ ipbLayers, layerVisibility, perspective }: IPBLayerRendererProps) {
  // Group by layerType for LayersControl.Overlay grouping
  const groups: Record<string, IPBLayer[]> = {};
  for (const layer of ipbLayers) {
    if (!groups[layer.layerType]) groups[layer.layerType] = [];
    groups[layer.layerType].push(layer);
  }

  const groupLabels: Record<string, string> = {
    forces: 'Force Dispositions',
    key_terrain: 'Key Terrain',
    avenue_of_approach: 'Avenues of Approach',
    nai: 'Named Areas of Interest',
    engagement_area: 'Engagement Areas',
    obstacle: 'Obstacles',
  };

  return (
    <>
      {Object.entries(groups).map(([layerType, layers]) => {
        // Group is visible if at least one layer in it is visible
        const anyVisible = layers.some((l) => layerVisibility[l.id] !== false);
        const groupLabel = groupLabels[layerType] ?? layerType;

        return (
          <LayersControl.Overlay
            key={layerType}
            checked={anyVisible}
            name={groupLabel}
          >
            <LayerGroup>
              {layers.map((layer) => {
                // Skip individually invisible layers
                if (layerVisibility[layer.id] === false) return null;

                const color = getIPBLayerColor(layer);
                const isPerspectiveOwn = (layer.team === 'blue' && perspective === 'blue') ||
                                         (layer.team === 'red' && perspective === 'red');
                // Own-perspective layers are slightly more opaque/thick
                const strokeWeight = isPerspectiveOwn ? 3 : 2;
                const fillOpacity = isPerspectiveOwn ? 0.25 : 0.15;

                // ── type='unit' — force disposition ──
                if (layer.type === 'unit') {
                  // Extract coordinates from geometry
                  const geom = layer.geometry as { coordinates?: [number, number]; lat?: number; lng?: number };
                  let lat = 0;
                  let lng = 0;
                  if (geom.coordinates) {
                    [lng, lat] = geom.coordinates; // GeoJSON is [lng, lat]
                  } else if (geom.lat !== undefined && geom.lng !== undefined) {
                    lat = geom.lat;
                    lng = geom.lng;
                  }

                  if (!lat && !lng) return null;

                  const markerIcon = layer.sidc
                    ? createMilsymbolIcon(layer.sidc, perspective)
                    : createUnitFallbackIcon(layer.team);

                  const props = layer.properties as Record<string, unknown>;

                  return (
                    <Marker
                      key={layer.id}
                      position={[lat, lng]}
                      icon={markerIcon}
                    >
                      <Popup>
                        <div className="ipb-unit-popup">
                          <div
                            className="ipb-unit-team-badge"
                            style={{ color, borderColor: color }}
                          >
                            {layer.team.toUpperCase()} FORCE
                          </div>
                          <h4>{layer.name}</h4>
                          {!!props.echelon && (
                            <p className="ipb-unit-detail">
                              <span>Echelon:</span> {String(props.echelon)}
                            </p>
                          )}
                          {!!props.strength && (
                            <p className="ipb-unit-detail">
                              <span>Strength:</span> {String(props.strength)}
                            </p>
                          )}
                          {Array.isArray(props.equipment) && props.equipment.length > 0 && (
                            <p className="ipb-unit-detail">
                              <span>Equipment:</span> {(props.equipment as string[]).join(', ')}
                            </p>
                          )}
                          {layer.sidc && (
                            <p className="ipb-unit-sidc">SIDC: {layer.sidc}</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                }

                // ── type='area' — key terrain, engagement areas, etc. ──
                if (layer.type === 'area') {
                  const geom = layer.geometry as {
                    coordinates?: number[][][] | number[][][][];
                    type?: string;
                  };
                  let positions: L.LatLngExpression[] = [];

                  if (geom.coordinates) {
                    // GeoJSON Polygon: coordinates[0] is outer ring [lng, lat][]
                    const ring = Array.isArray(geom.coordinates[0]?.[0])
                      ? (geom.coordinates[0] as unknown as number[][])
                      : (geom.coordinates as unknown as number[][]);
                    positions = ring.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
                  }

                  if (positions.length < 3) return null;

                  return (
                    <Polygon
                      key={layer.id}
                      positions={positions}
                      pathOptions={{
                        color,
                        fillColor: color,
                        fillOpacity,
                        weight: strokeWeight,
                        opacity: 0.7,
                      }}
                    >
                      <Popup>
                        <div className="ipb-area-popup">
                          <div className="ipb-area-type" style={{ color }}>
                            {layer.layerType.replace('_', ' ').toUpperCase()}
                          </div>
                          <h4>{layer.name}</h4>
                          {Object.entries(layer.properties).map(([k, v]) => (
                            <p key={k} className="ipb-area-detail">
                              <span>{k}:</span> {String(v)}
                            </p>
                          ))}
                        </div>
                      </Popup>
                    </Polygon>
                  );
                }

                // ── type='line' — avenues of approach ──
                if (layer.type === 'line') {
                  const geom = layer.geometry as {
                    coordinates?: number[][];
                  };
                  let positions: L.LatLngExpression[] = [];

                  if (geom.coordinates) {
                    positions = geom.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
                  }

                  if (positions.length < 2) return null;

                  const props = layer.properties as Record<string, unknown>;

                  return (
                    <Polyline
                      key={layer.id}
                      positions={positions}
                      pathOptions={{
                        color,
                        weight: strokeWeight + 1,
                        opacity: 0.8,
                        dashArray: '8 4',
                      }}
                    >
                      <Popup>
                        <div className="ipb-line-popup">
                          <div className="ipb-line-type" style={{ color }}>
                            AVENUE OF APPROACH
                          </div>
                          <h4>{layer.name}</h4>
                          {!!props.direction && (
                            <p className="ipb-line-detail">
                              <span>Direction:</span> {String(props.direction)}
                            </p>
                          )}
                          {!!props.classification && (
                            <p className="ipb-line-detail">
                              <span>Classification:</span> {String(props.classification)}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Polyline>
                  );
                }

                // ── type='point' — NAIs ──
                if (layer.type === 'point') {
                  const geom = layer.geometry as {
                    coordinates?: [number, number];
                    lat?: number;
                    lng?: number;
                  };
                  let lat = 0;
                  let lng = 0;
                  if (geom.coordinates) {
                    [lng, lat] = geom.coordinates;
                  } else if (geom.lat !== undefined && geom.lng !== undefined) {
                    lat = geom.lat;
                    lng = geom.lng;
                  }

                  if (!lat && !lng) return null;

                  const props = layer.properties as Record<string, unknown>;
                  // Radius in meters — use a sensible default for NAI visualization
                  const radius = typeof props.radius === 'number' ? props.radius : 15000;

                  return (
                    <Circle
                      key={layer.id}
                      center={[lat, lng]}
                      radius={radius}
                      pathOptions={{
                        color,
                        fillColor: color,
                        fillOpacity: fillOpacity * 0.6,
                        weight: 2,
                        dashArray: '4 4',
                        opacity: 0.8,
                      }}
                      className="ipb-nai-circle"
                    >
                      <Popup>
                        <div className="ipb-nai-popup">
                          <div className="ipb-nai-badge" style={{ color }}>
                            NAI
                          </div>
                          <h4>{layer.name}</h4>
                          {!!props.purpose && (
                            <p className="ipb-nai-detail">
                              <span>Purpose:</span> {String(props.purpose)}
                            </p>
                          )}
                          {!!props.triggers && (
                            <p className="ipb-nai-detail">
                              <span>Triggers:</span> {String(props.triggers)}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Circle>
                  );
                }

                return null;
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        );
      })}
    </>
  );
}

// ─── Dark Tile Config ─────────────────────────────────────────────────────────

// Tile URL imported from shared map-tiles config

// ─── ValidityMap ───────────────────────────────────────────────────────────────

export function ValidityMap({
  problemSetId: _problemSetId,
  events = [],
  actors = [],
  tensions = [],
  onEventClick,
  onActorClick,
  ipbLayers,
  layerVisibility = {},
  perspective,
  onPerspectiveChange: _onPerspectiveChange,
  center,
  zoom,
}: ValidityMapProps) {
  void _problemSetId; // Reserved for future problem-set-specific filtering
  void _onPerspectiveChange; // Perspective changes handled externally by IPBPanel
  const [visibleLayers] = useState({
    events: true,
    actors: true,
    tensions: true,
  });

  // Use provided center/zoom if given (e.g. for IPB theater view), else default
  const mapCenter: L.LatLngExpression = center ?? [20, 0];
  const mapZoom = zoom ?? 2;

  // World bounds to prevent showing multiple world copies
  const worldBounds: L.LatLngBoundsExpression = [
    [-85, -180], // Southwest corner
    [85, 180],   // Northeast corner
  ];

  // When IPB layers are provided, skip auto-fit-bounds for existing markers
  // to keep the theater view stable
  const hasIPBLayers = Boolean(ipbLayers && ipbLayers.length > 0);

  const layersKey = [
    events.length,
    actors.length,
    tensions.length,
    ipbLayers?.length ?? 0,
  ].join('-');

  return (
    <div className={`validity-map${perspective ? ` validity-map--${perspective}` : ''}`}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom={true}
        maxBounds={worldBounds}
        maxBoundsViscosity={1.0}
        className="map-container"
      >
        {/* Dark theme tiles with English labels */}
        <TileLayer
          attribution={DARK_TILE_ATTRIBUTION}
          url={DARK_TILE_URL}
          subdomains={DARK_TILE_SUBDOMAINS}
          maxZoom={18}
          noWrap={true}
          bounds={[[-85, -180], [85, 180]]}
        />

        <LayersControl position="topright" key={`layers-${layersKey}`}>
          {/* ── Existing overlays ── */}
          {events.length > 0 && (
            <LayersControl.Overlay checked={visibleLayers.events} name={`OSINT Events (${events.length})`}>
              <LayerGroup>
                {events.map(event => (
                  <Marker
                    key={event.id}
                    position={[event.lat, event.lng]}
                    icon={createEventIcon(event.relevance)}
                    eventHandlers={{
                      click: () => onEventClick?.(event),
                    }}
                  >
                    <Popup>
                      <div className="event-popup">
                        <div className={`event-relevance ${event.relevance}`}>
                          {event.relevance}
                        </div>
                        <h4>{event.title}</h4>
                        <p className="event-description">{event.description}</p>
                        <p className="event-timestamp">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                        {event.sourceUrl && (
                          <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
                            View Source
                          </a>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
          )}

          {actors.length > 0 && (
            <LayersControl.Overlay checked={visibleLayers.actors} name={`Actor Locations (${actors.length})`}>
              <LayerGroup>
                {actors.map(actor => (
                  <Marker
                    key={actor.id}
                    position={[actor.lat, actor.lng]}
                    icon={createActorIcon(actor.type)}
                    eventHandlers={{
                      click: () => onActorClick?.(actor),
                    }}
                  >
                    <Popup>
                      <div className="actor-popup">
                        <div className={`actor-type-badge ${actor.type}`}>
                          {actor.type.replace('_', ' ')}
                        </div>
                        <h4>{actor.name}</h4>
                        {actor.description && (
                          <p className="actor-description">{actor.description}</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
          )}

          {tensions.length > 0 && (
            <LayersControl.Overlay checked={visibleLayers.tensions} name={`Tension Zones (${tensions.length})`}>
              <LayerGroup>
                {tensions.map(tension => (
                  <Circle
                    key={tension.id}
                    center={[tension.lat, tension.lng]}
                    radius={tension.radius}
                    pathOptions={{
                      color: getTensionColor(tension.intensity),
                      fillColor: getTensionColor(tension.intensity),
                      fillOpacity: 0.2,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="tension-popup">
                        <div className={`tension-intensity ${tension.intensity}`}>
                          {tension.intensity} intensity
                        </div>
                        <p className="tension-description">{tension.description}</p>
                      </div>
                    </Popup>
                  </Circle>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
          )}

          {/* ── IPB overlay layers ── */}
          {ipbLayers && ipbLayers.length > 0 && (
            <IPBLayerRenderer
              ipbLayers={ipbLayers}
              layerVisibility={layerVisibility}
              perspective={perspective}
            />
          )}
        </LayersControl>

        {/* Only auto-fit bounds when there are no IPB layers (preserves theater view) */}
        {!hasIPBLayers && (
          <MapBounds events={events} actors={actors} tensions={tensions} />
        )}
        <MapResizer />
      </MapContainer>

      <div className="map-legend">
        <div className="legend-title">Map Legend</div>

        {/* Existing legend items — only shown when relevant */}
        {events.length > 0 && (
          <div className="legend-section">
            <div className="legend-subtitle">Events</div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#50c878' }} />
              <span>Supporting</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#ff6b6b' }} />
              <span>Contradicting</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#4a9eff' }} />
              <span>Neutral</span>
            </div>
          </div>
        )}

        {actors.length > 0 && (
          <div className="legend-section">
            <div className="legend-subtitle">Actors</div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#4a9eff' }} />
              <span>Nation</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#50c878' }} />
              <span>Organization</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#ffa500' }} />
              <span>Individual</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#ff6b6b' }} />
              <span>Non-State Actor</span>
            </div>
          </div>
        )}

        {tensions.length > 0 && (
          <div className="legend-section">
            <div className="legend-subtitle">Tensions</div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: '#ff0000' }} />
              <span>Critical</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: '#ff6b6b' }} />
              <span>High</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: '#ffa500' }} />
              <span>Medium</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: '#ffcc00' }} />
              <span>Low</span>
            </div>
          </div>
        )}

        {/* IPB legend — shown when IPB layers are present */}
        {ipbLayers && ipbLayers.length > 0 && (
          <div className="legend-section">
            <div className="legend-subtitle">IPB Layers</div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#0066cc' }} />
              <span>Blue Forces</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#cc0000' }} />
              <span>Red Forces</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#50c878' }} />
              <span>Key Terrain</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: '#ffa500' }} />
              <span>Avenue of Approach</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#ffcc00' }} />
              <span>NAI</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#ff00ff' }} />
              <span>Engagement Area</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#888888' }} />
              <span>Obstacle</span>
            </div>
          </div>
        )}

        {/* Fallback — show all legend items if neither events/actors/tensions nor IPB layers */}
        {events.length === 0 && actors.length === 0 && tensions.length === 0 && (!ipbLayers || ipbLayers.length === 0) && (
          <>
            <div className="legend-section">
              <div className="legend-subtitle">Events</div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#50c878' }} />
                <span>Supporting</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#ff6b6b' }} />
                <span>Contradicting</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#4a9eff' }} />
                <span>Neutral</span>
              </div>
            </div>
            <div className="legend-section">
              <div className="legend-subtitle">Actors</div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#4a9eff' }} />
                <span>Nation</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#50c878' }} />
                <span>Organization</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#ffa500' }} />
                <span>Individual</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#ff6b6b' }} />
                <span>Non-State Actor</span>
              </div>
            </div>
            <div className="legend-section">
              <div className="legend-subtitle">Tensions</div>
              <div className="legend-item">
                <span className="legend-line" style={{ backgroundColor: '#ff0000' }} />
                <span>Critical</span>
              </div>
              <div className="legend-item">
                <span className="legend-line" style={{ backgroundColor: '#ff6b6b' }} />
                <span>High</span>
              </div>
              <div className="legend-item">
                <span className="legend-line" style={{ backgroundColor: '#ffa500' }} />
                <span>Medium</span>
              </div>
              <div className="legend-item">
                <span className="legend-line" style={{ backgroundColor: '#ffcc00' }} />
                <span>Low</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
