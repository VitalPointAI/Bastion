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
 * Phase 48 Plan 06 additions:
 *   - Detection attribution toggle: dashed polylines from detecting robot to
 *     detected entity, colored by nation (default OFF for clean COP)
 *   - Bounding overwatch animation: pulsing divIcon for bounding element,
 *     translucent sector arc for overwatch element (bounding_overwatch / successive_bounds)
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

interface DetectionAttribution {
  robotId: string;
  entityId: string;
  confidence: number;
  detectedAt: string;
  robotPosition?: LatLng;     // Injected by bridge from member position
  entityPosition?: LatLng;    // COP symbol position for the detected entity
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
  detectionAttributions?: DetectionAttribution[];
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

// Nation colors for attribution lines
const NATION_COLORS: Record<string, string> = {
  'did:near:resource-tw-coalition': '#22c55e',  // TW = green
  'did:near:resource-us-coalition': '#3b82f6',  // US = blue
  'did:near:resource-au-coalition': '#d97706',  // AU = gold/amber
};

function nationColor(nationalDid?: string): string {
  if (!nationalDid) return '#94a3b8';
  return NATION_COLORS[nationalDid] ?? '#94a3b8';
}

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

// ─── Attribution polyline layer ──────────────────────────────────────────────

/**
 * DetectionAttributionLayer
 *
 * Renders dashed polylines from each detecting robot to the detected entity
 * when showAttribution is true. Lines are keyed by robotId+entityId.
 * Also renders source count badges ("2x"/"3x") on entities with corroborated
 * detections from multiple robots.
 */
interface DetectionAttributionLayerProps {
  swarms: SwarmFormationSpec[];
  show: boolean;
}

/** Inject corroboration badge CSS once per page load */
let _corrobCssInjected = false;

function ensureCorrobCss() {
  if (_corrobCssInjected) return;
  _corrobCssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .swarm-corroboration-badge {
      background: rgba(34, 197, 94, 0.9);
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      font-family: 'Fira Code', monospace;
      border: 1px solid #16a34a;
      border-radius: 9px;
      padding: 1px 5px;
      white-space: nowrap;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function DetectionAttributionLayer({ swarms, show }: DetectionAttributionLayerProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Build or destroy attribution lines whenever show or swarms change
  useEffect(() => {
    // Ensure layer group exists and is on map
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup();
    }

    // Clear existing lines
    layerGroupRef.current.clearLayers();

    if (show) {
      layerGroupRef.current.addTo(map);
      ensureCorrobCss();

      // Build a robotId → position + nationalDid map from swarm members
      const robotPositions = new Map<string, { position: LatLng; nationalDid?: string }>();
      for (const swarm of swarms) {
        for (const member of swarm.members) {
          robotPositions.set(member.robotId, {
            position: member.position,
            nationalDid: member.nationalDid,
          });
        }
      }

      // Count how many distinct robots attribute to each entity (corroboration count)
      const entitySourceCount = new Map<string, Set<string>>();
      const entityPositionMap = new Map<string, LatLng>();

      for (const swarm of swarms) {
        const attributions = swarm.detectionAttributions ?? [];
        for (const attr of attributions) {
          if (!entitySourceCount.has(attr.entityId)) {
            entitySourceCount.set(attr.entityId, new Set());
          }
          entitySourceCount.get(attr.entityId)!.add(attr.robotId);

          if (attr.entityPosition) {
            entityPositionMap.set(attr.entityId, attr.entityPosition);
          }
        }
      }

      for (const swarm of swarms) {
        const attributions = swarm.detectionAttributions ?? [];
        for (const attr of attributions) {
          // Use robotPosition from attr (injected by bridge) or fall back to member lookup
          const robotInfo = robotPositions.get(attr.robotId);
          const robotPos = attr.robotPosition ?? robotInfo?.position;
          const entityPos = attr.entityPosition;

          if (!robotPos || !entityPos) continue;

          const nationDid = robotInfo?.nationalDid;
          const color = nationColor(nationDid);

          const line = L.polyline(
            [
              [robotPos.lat, robotPos.lng],
              [entityPos.lat, entityPos.lng],
            ],
            {
              color,
              weight: 1.5,
              dashArray: '4 4',
              opacity: 0.7,
            },
          );

          line.bindTooltip(
            `${attr.robotId} \u2192 ${attr.entityId} (${Math.round(attr.confidence * 100)}%)`,
            { sticky: true },
          );

          layerGroupRef.current?.addLayer(line);
        }
      }

      // Render corroboration source count badges for entities with 2+ detectors
      for (const [entityId, sources] of entitySourceCount.entries()) {
        if (sources.size < 2) continue;
        const entityPos = entityPositionMap.get(entityId);
        if (!entityPos) continue;

        const count = sources.size;
        const badge = L.marker([entityPos.lat, entityPos.lng], {
          icon: L.divIcon({
            className: 'swarm-corroboration-badge',
            html: `${count}x`,
            iconSize: undefined,
            iconAnchor: [-4, 16], // offset above-right of symbol
          }),
          zIndexOffset: 600,
          interactive: false,
        });

        badge.bindTooltip(
          `Corroborated by ${count} robots: ${Array.from(sources).join(', ')}`,
          { sticky: true },
        );

        layerGroupRef.current?.addLayer(badge);
      }
    } else {
      // Remove from map when hidden
      layerGroupRef.current.remove();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, JSON.stringify(swarms.map((s) => s.detectionAttributions))]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
    };
  }, []);

  return null;
}

// ─── Bounding overwatch animation layer ─────────────────────────────────────

/**
 * Creates CSS injection for the bounding pulse animation (once per page).
 */
let _pulseCssInjected = false;

function ensurePulseCss() {
  if (_pulseCssInjected) return;
  _pulseCssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes swarm-bound-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.8); }
      70%  { box-shadow: 0 0 0 8px rgba(251, 191, 36, 0); }
      100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
    }
    .swarm-bounding-marker {
      background: rgba(251, 191, 36, 0.9);
      border: 2px solid #f59e0b;
      border-radius: 50%;
      animation: swarm-bound-pulse 1.2s ease-out infinite;
    }
    .swarm-overwatch-marker {
      background: rgba(59, 130, 246, 0.6);
      border: 2px solid #3b82f6;
      border-radius: 50%;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Generate SVG fan-sector path for an overwatch arc.
 * Center at (cx, cy), radius r, heading in degrees, spread degrees.
 */
function buildSectorPath(cx: number, cy: number, r: number, headingDeg: number, spreadDeg: number): string {
  const startAngle = ((headingDeg - spreadDeg / 2) * Math.PI) / 180;
  const endAngle = ((headingDeg + spreadDeg / 2) * Math.PI) / 180;

  const x1 = cx + r * Math.sin(startAngle);
  const y1 = cy - r * Math.cos(startAngle);
  const x2 = cx + r * Math.sin(endAngle);
  const y2 = cy - r * Math.cos(endAngle);

  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

interface BoundingOverwatchLayerProps {
  swarm: SwarmFormationSpec;
}

function BoundingOverwatchLayer({ swarm }: BoundingOverwatchLayerProps) {
  const map = useMap();
  const layersRef = useRef<L.Layer[]>([]);

  const isBoundingTechnique =
    swarm.technique === 'bounding_overwatch' || swarm.technique === 'successive_bounds';

  const memberPositionKey = JSON.stringify(swarm.members.map((m) => `${m.robotId}:${m.position.lat}:${m.position.lng}`));

  useEffect(() => {
    // Clean up previous bounding layers
    for (const layer of layersRef.current) {
      layer.remove();
    }
    layersRef.current = [];

    if (!isBoundingTechnique || swarm.members.length === 0) return;

    ensurePulseCss();

    swarm.members.forEach((member, idx) => {
      const isBounding = idx % 2 === 0; // even slots bound, odd slots overwatch
      const { lat, lng } = member.position;

      if (isBounding) {
        // Pulsing divIcon marker for bounding element
        const icon = L.divIcon({
          className: 'swarm-bounding-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          html: '',
        });
        const marker = L.marker([lat, lng], { icon, zIndexOffset: 500 });
        marker.bindTooltip(`${member.robotId} — BOUNDING`, { direction: 'top', offset: [0, -14] });
        marker.addTo(map);
        layersRef.current.push(marker);

        // Arrow polyline pointing in swarm heading direction (short arrow, ~15m equivalent in lat/lng)
        const headingRad = (swarm.heading * Math.PI) / 180;
        const arrowLen = 0.00008; // roughly 9m at mid-latitudes
        const arrowLat = lat + arrowLen * Math.cos(headingRad);
        const arrowLng = lng + arrowLen * Math.sin(headingRad);

        const arrow = L.polyline(
          [
            [lat, lng],
            [arrowLat, arrowLng],
          ],
          {
            color: '#f59e0b',
            weight: 2.5,
            opacity: 0.85,
          },
        );
        arrow.addTo(map);
        layersRef.current.push(arrow);
      } else {
        // Overwatch element: divIcon + SVG sector arc
        const icon = L.divIcon({
          className: 'swarm-overwatch-marker',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: '',
        });
        const marker = L.marker([lat, lng], { icon, zIndexOffset: 400 });
        marker.bindTooltip(`${member.robotId} — OVERWATCH`, { direction: 'top', offset: [0, -12] });
        marker.addTo(map);
        layersRef.current.push(marker);

        // SVG sector fan using a Leaflet SVGOverlay
        const spreadDeg = 60;
        const sectorSize = 40; // pixels, purely visual
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${sectorSize * 2}" height="${sectorSize * 2}" viewBox="0 0 ${sectorSize * 2} ${sectorSize * 2}">
          <path d="${buildSectorPath(sectorSize, sectorSize, sectorSize * 0.9, swarm.heading, spreadDeg)}"
            fill="rgba(59,130,246,0.25)" stroke="#3b82f6" stroke-width="1.5" />
        </svg>`;

        // Convert lat/lng to a bounding box for the SVG overlay
        const metersPerDeg = 111320;
        const latDelta = (sectorSize * 0.00005); // ~5.5m half-extent
        const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);

        const bounds: L.LatLngBoundsExpression = [
          [lat - latDelta, lng - lngDelta],
          [lat + latDelta, lng + lngDelta],
        ];

        // Leaflet svgOverlay API requires an SVGElement
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgEl.setAttribute('viewBox', `0 0 ${sectorSize * 2} ${sectorSize * 2}`);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', buildSectorPath(sectorSize, sectorSize, sectorSize * 0.9, swarm.heading, spreadDeg));
        path.setAttribute('fill', 'rgba(59,130,246,0.25)');
        path.setAttribute('stroke', '#3b82f6');
        path.setAttribute('stroke-width', '1.5');
        svgEl.appendChild(path);

        const overlay = L.svgOverlay(svgEl, bounds, { opacity: 0.85, zIndex: 450 });
        overlay.addTo(map);
        layersRef.current.push(overlay);

        // Suppress unused variable warning for metersPerDeg
        void metersPerDeg;
        void svgContent;
      }
    });

    return () => {
      for (const layer of layersRef.current) {
        layer.remove();
      }
      layersRef.current = [];
    };
  }, [
    map,
    isBoundingTechnique,
    swarm.technique,
    swarm.heading,
    memberPositionKey,
  ]);

  return null;
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
  showAttribution: boolean;
  onToggleAttribution: () => void;
}

function SwarmTelemetryPanel({
  swarm,
  onClose,
  showAttribution,
  onToggleAttribution,
}: SwarmTelemetryPanelProps) {
  const stateColor = FORMATION_STATE_COLORS[swarm.state] ?? DEFAULT_FORMATION_COLOR;
  const hasAttributions = (swarm.detectionAttributions?.length ?? 0) > 0;

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

      {/* Detection attribution toggle */}
      {hasAttributions && (
        <div
          style={{
            marginTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#94a3b8', fontSize: 11 }}>SHOW ATTRIBUTION</span>
          <button
            onClick={onToggleAttribution}
            style={{
              background: showAttribution ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)',
              border: `1px solid ${showAttribution ? 'rgba(34,197,94,0.5)' : 'rgba(100,116,139,0.4)'}`,
              borderRadius: 4,
              color: showAttribution ? '#86efac' : '#64748b',
              cursor: 'pointer',
              fontSize: 10,
              padding: '2px 8px',
              fontFamily: 'inherit',
            }}
          >
            {showAttribution ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

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
  const [showAttribution, setShowAttribution] = useState(false); // default OFF

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

      {/* Bounding overwatch animation per swarm (only for bounding techniques) */}
      {swarmArray.map((swarm) => (
        <BoundingOverwatchLayer
          key={`swarm-bounding-${swarm.swarmId}`}
          swarm={swarm}
        />
      ))}

      {/* Detection attribution lines (global toggle, default OFF) */}
      <DetectionAttributionLayer swarms={swarmArray} show={showAttribution} />

      {/* Telemetry detail panel for selected swarm */}
      {selectedSwarm && (
        <SwarmTelemetryPanel
          swarm={selectedSwarm}
          onClose={() => setSelectedSwarmId(null)}
          showAttribution={showAttribution}
          onToggleAttribution={() => setShowAttribution((v) => !v)}
        />
      )}
    </>
  );
}
