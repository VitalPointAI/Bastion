import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, LayerGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ValidityMap.css';

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

interface ValidityMapProps {
  workspaceId?: string;
  events?: EventMarker[];
  actors?: ActorMarker[];
  tensions?: TensionCircle[];
  onEventClick?: (event: EventMarker) => void;
  onActorClick?: (actor: ActorMarker) => void;
}

// Custom event marker icons by relevance
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

// Custom actor marker icons by type
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

// Get tension circle color by intensity
const getTensionColor = (intensity: string) => {
  switch (intensity) {
    case 'critical': return '#ff0000';
    case 'high': return '#ff6b6b';
    case 'medium': return '#ffa500';
    case 'low': return '#ffcc00';
    default: return '#888888';
  }
};

// Component to handle map zoom to fit markers
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

// Force Leaflet to recalculate container size after mount and on resize
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

// Support optional API key for non-localhost deployments (Stadia Maps returns 401 without it)
const STADIA_API_KEY = import.meta.env.VITE_STADIA_MAPS_API_KEY as string | undefined;
const STADIA_TILE_URL = STADIA_API_KEY
  ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`
  : 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';

export function ValidityMap({
  workspaceId: _workspaceId,
  events = [],
  actors = [],
  tensions = [],
  onEventClick,
  onActorClick,
}: ValidityMapProps) {
  void _workspaceId; // Reserved for future workspace-specific filtering
  const [visibleLayers] = useState({
    events: true,
    actors: true,
    tensions: true,
  });

  // Default center (global view)
  const defaultCenter: L.LatLngExpression = [20, 0];
  const defaultZoom = 2;

  // World bounds to prevent showing multiple world copies
  const worldBounds: L.LatLngBoundsExpression = [
    [-85, -180], // Southwest corner
    [85, 180],   // Northeast corner
  ];

  return (
    <div className="validity-map">
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
        {/* Dark theme tiles from Stadia Maps */}
        <TileLayer
          attribution='&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={STADIA_TILE_URL}
          maxZoom={18}
          noWrap={true}
          bounds={[[-85, -180], [85, 180]]}
        />

        <LayersControl position="topright">
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
        </LayersControl>

        <MapBounds events={events} actors={actors} tensions={tensions} />
        <MapResizer />
      </MapContainer>

      <div className="map-legend">
        <div className="legend-title">Map Legend</div>

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
      </div>
    </div>
  );
}
