/**
 * SwarmCOPLayer
 *
 * Phase 48 Plan 05: Renders swarm formations as state-colored translucent
 * polygons on the COP Leaflet map. Each formation shows:
 *   - A convex-hull polygon connecting member positions (color by swarm state)
 *   - Individual circle markers per member (leader visually distinct)
 *   - Smooth position interpolation via requestAnimationFrame (mirrors SmoothRobotMarker)
 *   - Clickable polygon to open a SwarmTelemetryPanel
 *
 * WebSocket subscription: connects to /ws/messages and subscribes to the
 * 'swarm:cop_update' channel. Receives SwarmFormationSpec payloads with
 * messageType 'swarm.cop.update'.
 *
 * Positions in SwarmFormationSpec are already geo-coordinates (converted by
 * swarm-cop-bridge.ts in Plan 02) — no roomToLatLng transform needed.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// ─── Types (mirrors backend/src/cop/layers/layer-types.ts) ──────────────────

interface LatLng {
  lat: number;
  lng: number;
}

interface SwarmMemberSpec {
  robotId: string;
  role: 'leader' | 'follower';
  position: LatLng;
  slotIndex: number;
  batteryPct: number;
  nationalDid?: string;
}

interface SwarmFormationSpec {
  swarmId: string;
  leaderId: string;
  state: 'forming' | 'ready' | 'moving' | 'holding' | 'dispersing' | 'contact';
  formation: 'line' | 'wedge' | 'column' | 'echelon_left' | 'echelon_right' | 'vee';
  technique: 'traveling' | 'traveling_overwatch' | 'bounding_overwatch' | 'successive_bounds';
  memberCount: number;
  members: SwarmMemberSpec[];
  centerOfMass: LatLng;
  heading: number;
  missionId?: string;
  detectionAttributions?: unknown[];
}

// ─── State colors ────────────────────────────────────────────────────────────

const FORMATION_STATE_COLORS: Record<string, string> = {
  forming: '#3b82f6',    // blue
  ready: '#22c55e',      // green
  moving: '#f59e0b',     // amber
  holding: '#22c55e',    // green (same as ready)
  dispersing: '#6b7280', // gray
  contact: '#ef4444',    // red
};

const DEFAULT_FORMATION_COLOR = '#6b7280';

// ─── WebSocket constants ─────────────────────────────────────────────────────

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/messages`
    : 'ws://localhost:3001/ws/messages';

const SWARM_COP_CHANNEL = 'swarm:cop_update';
const ANIM_DURATION_MS = 1000; // interpolation duration matches poll interval

// ─── Hull ordering utility ───────────────────────────────────────────────────

/**
 * Sort positions by angle from centroid to avoid self-intersecting polygons.
 * For 3 members this prevents the "bowtie" artefact.
 */
function convexHullOrder(positions: LatLng[]): LatLng[] {
  if (positions.length <= 2) return positions;
  const cx = positions.reduce((s, p) => s + p.lat, 0) / positions.length;
  const cy = positions.reduce((s, p) => s + p.lng, 0) / positions.length;
  return [...positions].sort(
    (a, b) =>
      Math.atan2(a.lat - cx, a.lng - cy) - Math.atan2(b.lat - cx, b.lng - cy),
  );
}

// ─── SwarmFormationPolygon ────────────────────────────────────────────────────

interface SwarmFormationPolygonProps {
  swarm: SwarmFormationSpec;
  onSwarmClick: (swarmId: string) => void;
}

function SwarmFormationPolygon({ swarm, onSwarmClick }: SwarmFormationPolygonProps) {
  const map = useMap();
  const polygonRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    const color = FORMATION_STATE_COLORS[swarm.state] ?? DEFAULT_FORMATION_COLOR;
    const positions = convexHullOrder(swarm.members.map((m) => m.position));
    const latlngs = positions.map((p) => [p.lat, p.lng] as [number, number]);

    const polygon = L.polygon(latlngs, {
      color,
      fillColor: color,
      fillOpacity: 0.15,
      weight: 2,
      dashArray: swarm.state === 'forming' ? '6 4' : undefined,
    }).addTo(map);

    polygon.bindTooltip(
      `${swarm.swarmId} — ${swarm.formation} (${swarm.state})`,
      { sticky: true },
    );

    polygon.on('click', () => onSwarmClick(swarm.swarmId));

    polygonRef.current = polygon;

    return () => {
      if (polygonRef.current) {
        polygonRef.current.remove();
        polygonRef.current = null;
      }
    };
    // Re-create polygon whenever swarm data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, swarm.swarmId, swarm.state, swarm.formation, swarm.members]);

  return null;
}

// ─── SwarmMemberMarker ────────────────────────────────────────────────────────

interface SwarmMemberMarkerProps {
  member: SwarmMemberSpec;
  swarmState: SwarmFormationSpec['state'];
}

function SwarmMemberMarker({ member, swarmState }: SwarmMemberMarkerProps) {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);
  const prevPosRef = useRef<LatLng | null>(null);
  const targetPosRef = useRef<LatLng | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const isLeader = member.role === 'leader';
  const color = FORMATION_STATE_COLORS[swarmState] ?? DEFAULT_FORMATION_COLOR;

  // Mount: create circle marker
  useEffect(() => {
    const { lat, lng } = member.position;
    const marker = L.circleMarker([lat, lng], {
      radius: isLeader ? 10 : 6,
      color: isLeader ? '#f59e0b' : color, // gold border for leader
      fillColor: isLeader ? '#fbbf24' : color,
      fillOpacity: 0.9,
      weight: isLeader ? 3 : 2,
    }).addTo(map);

    marker.bindTooltip(
      `${isLeader ? 'LEAD ' : ''}${member.robotId}<br/>Battery: ${member.batteryPct}%`,
      { direction: 'top', offset: [0, -12] },
    );

    markerRef.current = marker;
    prevPosRef.current = { lat, lng };
    targetPosRef.current = { lat, lng };

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Position update: start smooth interpolation
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    // Update style on state change
    marker.setStyle({
      color: isLeader ? '#f59e0b' : color,
      fillColor: isLeader ? '#fbbf24' : color,
    });

    // Update tooltip
    marker.setTooltipContent(
      `${isLeader ? 'LEAD ' : ''}${member.robotId}<br/>Battery: ${member.batteryPct}%`,
    );

    const currentLatLng = marker.getLatLng();
    prevPosRef.current = { lat: currentLatLng.lat, lng: currentLatLng.lng };
    targetPosRef.current = member.position;
    startTimeRef.current = performance.now();

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    function animate() {
      const m = markerRef.current;
      const prev = prevPosRef.current;
      const target = targetPosRef.current;
      if (!m || !prev || !target) return;

      const elapsed = performance.now() - startTimeRef.current;
      const t = Math.min(elapsed / ANIM_DURATION_MS, 1);
      // Ease-out quadratic: t * (2 - t)
      const eased = t * (2 - t);

      const newLat = prev.lat + (target.lat - prev.lat) * eased;
      const newLng = prev.lng + (target.lng - prev.lng) * eased;
      m.setLatLng([newLat, newLng]);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.position.lat, member.position.lng, member.batteryPct, swarmState]);

  return null;
}

// ─── SwarmTelemetryPanel ──────────────────────────────────────────────────────

interface SwarmTelemetryPanelProps {
  swarm: SwarmFormationSpec;
  onClose: () => void;
}

function SwarmTelemetryPanel({ swarm, onClose }: SwarmTelemetryPanelProps) {
  const stateColor = FORMATION_STATE_COLORS[swarm.state] ?? DEFAULT_FORMATION_COLOR;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 16,
        zIndex: 1000,
        background: 'rgba(10, 14, 20, 0.92)',
        border: `1px solid ${stateColor}`,
        borderRadius: 6,
        padding: '12px 16px',
        minWidth: 260,
        maxWidth: 320,
        fontFamily: "'Fira Code', monospace",
        fontSize: 12,
        color: '#e2e8f0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        pointerEvents: 'all',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>
          SWARM: {swarm.swarmId}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
          }}
          aria-label="Close swarm panel"
        >
          ×
        </button>
      </div>

      {/* State badge */}
      <div style={{ marginBottom: 6 }}>
        <span
          style={{
            display: 'inline-block',
            background: stateColor,
            color: '#fff',
            borderRadius: 3,
            padding: '1px 6px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {swarm.state}
        </span>
      </div>

      {/* Metadata rows */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <Row label="Formation" value={swarm.formation} />
          <Row label="Technique" value={swarm.technique.replace(/_/g, ' ')} />
          <Row label="Members" value={String(swarm.memberCount)} />
          {swarm.missionId && <Row label="Mission" value={swarm.missionId} />}
          <Row label="Heading" value={`${swarm.heading.toFixed(0)}°`} />
          <Row label="Leader" value={swarm.leaderId} />
        </tbody>
      </table>

      {/* Per-member battery */}
      {swarm.members.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
          <div style={{ color: '#94a3b8', marginBottom: 4, fontSize: 11 }}>MEMBER STATUS</div>
          {swarm.members.map((m) => (
            <div
              key={m.robotId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 0',
                color: m.role === 'leader' ? '#fbbf24' : '#e2e8f0',
              }}
            >
              <span>
                {m.role === 'leader' ? '★ ' : '  '}
                {m.robotId}
              </span>
              <span style={{ color: m.batteryPct < 20 ? '#ef4444' : '#94a3b8' }}>
                {m.batteryPct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ color: '#64748b', paddingRight: 8, paddingBottom: 2, whiteSpace: 'nowrap' }}>
        {label}
      </td>
      <td style={{ color: '#e2e8f0' }}>{value}</td>
    </tr>
  );
}

// ─── SwarmCOPLayer (main component) ─────────────────────────────────────────

/**
 * SwarmCOPLayer
 *
 * Renders swarm formations on the COP Leaflet map. Subscribes internally to
 * the /ws/messages WebSocket on channel 'swarm:cop_update'. No props required.
 * Renders nothing when no swarm data is present.
 *
 * Must be rendered inside a react-leaflet <MapContainer>.
 */
export function SwarmCOPLayer() {
  const [swarms, setSwarms] = useState<Map<string, SwarmFormationSpec>>(new Map());
  const [selectedSwarmId, setSelectedSwarmId] = useState<string | null>(null);

  // WebSocket subscription to swarm:cop_update channel
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const handleSwarmUpdate = useCallback((spec: SwarmFormationSpec) => {
    setSwarms((prev) => {
      const next = new Map(prev);
      next.set(spec.swarmId, spec);
      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (!mountedRef.current) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_BASE_URL);
      } catch {
        // Retry connection on failure
        if (mountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        ws.send(JSON.stringify({ type: 'subscribe', channel: SWARM_COP_CHANNEL }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: {
              messageType?: string;
              payload?: unknown;
            };
          };

          if (
            msg.type === 'message' &&
            msg.data?.messageType === 'swarm.cop.update' &&
            msg.data.payload
          ) {
            handleSwarmUpdate(msg.data.payload as SwarmFormationSpec);
          }
        } catch {
          // Non-JSON or unexpected message — ignore
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [handleSwarmUpdate]);

  const swarmArray = Array.from(swarms.values());
  const selectedSwarm = selectedSwarmId ? swarms.get(selectedSwarmId) ?? null : null;

  return (
    <>
      {/* Formation polygons and member markers for each swarm */}
      {swarmArray.map((swarm) => (
        <SwarmFormationPolygon
          key={`swarm-polygon-${swarm.swarmId}`}
          swarm={swarm}
          onSwarmClick={setSelectedSwarmId}
        />
      ))}

      {swarmArray.flatMap((swarm) =>
        swarm.members.map((member) => (
          <SwarmMemberMarker
            key={`swarm-member-${swarm.swarmId}-${member.robotId}`}
            member={member}
            swarmState={swarm.state}
          />
        )),
      )}

      {/* Telemetry detail panel for selected swarm */}
      {selectedSwarm && (
        <SwarmTelemetryPanel
          swarm={selectedSwarm}
          onClose={() => setSelectedSwarmId(null)}
        />
      )}
    </>
  );
}
