/**
 * COPRobotLayer
 *
 * Phase 06 Plan 04: Renders connected robots as state-colored markers on the
 * COP Leaflet map. Polls /api/robot/robots for position and state updates.
 * Smoothly interpolates marker positions between poll intervals.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { roomToLatLng as calibratedRoomToLatLng, latLngToRoom as calibratedLatLngToRoom } from '../../lib/mgrs-coordinator';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RobotInfo {
  robot_id: string;
  did: string;
  capabilities: string[];
  state: string;
  current_mission_id?: string;
  last_heartbeat: number;
  latest_telemetry?: {
    position: { x: number; y: number };
    heading: number;
    battery: number;
  };
  latest_vision?: {
    detections: { class_desc: string; confidence: number }[];
  };
}

interface COPRobotLayerProps {
  problemSetId: string;
  visible: boolean;
  onRobotClick?: (robotId: string) => void;
  /** When set, clicking the map sends a navigate command to this robot */
  selectedRobotId?: string | null;
}

// ─── State colors ───────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  executing: '#22c55e',
  awaiting_auth: '#eab308',
  failed: '#ef4444',
  accepted: '#3b82f6',
  pending: '#3b82f6',
  complete: '#6b7280',
  rejected: '#ef4444',
};

const DEFAULT_COLOR = '#6b7280'; // idle/connected

// ─── Icon factory ───────────────────────────────────────────────────────────

function createRobotIcon(state: string, heading?: number): L.DivIcon {
  const color = STATE_COLORS[state] || DEFAULT_COLOR;
  const isPulsing = state === 'awaiting_auth';

  // Heading indicator arrow — rotated to show facing direction
  const headingArrow = heading != null
    ? `<div style="
        position: absolute; top: -8px; left: 50%; transform: translateX(-50%) rotate(${heading}deg);
        transform-origin: center 20px;
        width: 0; height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 10px solid ${color};
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
      "></div>`
    : '';

  return L.divIcon({
    className: 'cop-robot-marker',
    html: `<div style="position: relative;">
      ${headingArrow}
      <div style="
        width: 24px; height: 24px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.8);
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        ${isPulsing ? 'animation: robot-pulse 1.5s ease-in-out infinite;' : ''}
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
          <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7v1H3v-1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 19v1a1 1 0 001 1h12a1 1 0 001-1v-1H5z"/>
        </svg>
      </div>
    </div>
    <style>
      @keyframes robot-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.15); }
      }
    </style>`,
    iconSize: [24, 34],
    iconAnchor: [12, 22],
  });
}

// ─── Room-to-map coordinate transform ───────────────────────────────────────

// Delegates to mgrs-coordinator which reads the active calibration profile.
// This ensures coordinates are scenario-agnostic and driven by the loaded AO profile.
const roomToLatLng = calibratedRoomToLatLng;
const latLngToRoom = calibratedLatLngToRoom;

// ─── Smooth marker component ──────────────────────────────────────────────

const POLL_INTERVAL = 3000;


function buildTooltip(robot: RobotInfo): string {
  const stateColor = STATE_COLORS[robot.state] || DEFAULT_COLOR;
  const stateLabel = robot.current_mission_id ? robot.state || 'active' : 'idle';
  const battery = robot.latest_telemetry ? `Battery: ${robot.latest_telemetry.battery ?? '?'}%` : '';
  const detections = robot.latest_vision?.detections;
  const visionLine = detections && detections.length > 0
    ? `Detected: ${detections.map(d => `${d.class_desc} (${(d.confidence * 100).toFixed(0)}%)`).join(', ')}`
    : '';

  return `
    <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-align: center;">
      <strong>${robot.robot_id}</strong><br/>
      <span style="color: ${stateColor}">${stateLabel}</span>
      ${battery ? `<br/><span style="color: #888">${battery}</span>` : ''}
      ${visionLine ? `<br/><span style="color: #22c55e">${visionLine}</span>` : ''}
    </div>
  `;
}

function SmoothRobotMarker({
  robot,
  onRobotClick,
}: {
  robot: RobotInfo;
  onRobotClick?: (robotId: string) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  const pos = robot.latest_telemetry!.position;
  const heading = robot.latest_telemetry!.heading;
  const [lat, lng] = roomToLatLng(pos.x, pos.y);
  const missionState = robot.current_mission_id ? 'executing' : 'idle';
  const iconState = robot.state === 'connected' ? missionState : robot.state;

  useEffect(() => {
    // Create marker on mount
    const icon = createRobotIcon(iconState, heading);
    const marker = L.marker([lat, lng], { icon }).addTo(map);
    marker.on('click', () => onRobotClick?.(robot.robot_id));

    marker.bindTooltip(buildTooltip(robot), { direction: 'bottom', offset: [0, 14] });

    markerRef.current = marker;

    return () => {
      map.removeLayer(marker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update marker position, heading, and icon on each poll
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    marker.setIcon(createRobotIcon(iconState, heading));
    marker.setTooltipContent(buildTooltip(robot));
    marker.setLatLng([lat, lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, heading, iconState, robot.state, robot.current_mission_id]);

  return null; // Marker is managed imperatively via Leaflet
}

// ─── Component ──────────────────────────────────────────────────────────────

// ─── Map click → navigate handler ────────────────────────────────────────────

function MapClickNavigator({ robotId }: { robotId: string }) {
  const map = useMap();
  const targetMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    async function handleClick(e: L.LeafletMouseEvent) {
      const { lat, lng } = e.latlng;
      const room = latLngToRoom(lat, lng);

      // Show target marker
      if (targetMarkerRef.current) {
        map.removeLayer(targetMarkerRef.current);
      }
      const targetIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border:2px solid #f59e0b;border-radius:50%;background:rgba(245,158,11,0.2);display:flex;align-items:center;justify-content:center"><div style="width:6px;height:6px;background:#f59e0b;border-radius:50%"></div></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker([lat, lng], { icon: targetIcon }).addTo(map);
      marker.bindTooltip(`Navigate to (${room.x.toFixed(1)}, ${room.y.toFixed(1)})`, { direction: 'bottom', offset: [0, 10] });
      targetMarkerRef.current = marker;

      // Auto-remove after 10s
      setTimeout(() => {
        if (targetMarkerRef.current === marker) {
          map.removeLayer(marker);
          targetMarkerRef.current = null;
        }
      }, 10000);

      // Send navigate command
      try {
        await fetch(`/api/robot/robots/${robotId}/navigate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: room.x, y: room.y, speed: 100 }),
        });
      } catch (err) {
        console.warn('[COPRobotLayer] Navigate command failed:', err);
      }
    }

    map.on('click', handleClick);

    // Change cursor to crosshair when navigate mode is active
    const container = map.getContainer();
    container.style.cursor = 'crosshair';

    return () => {
      map.off('click', handleClick);
      container.style.cursor = '';
      if (targetMarkerRef.current) {
        map.removeLayer(targetMarkerRef.current);
      }
    };
  }, [map, robotId]);

  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function COPRobotLayer({
  problemSetId: _problemSetId,
  visible,
  onRobotClick,
  selectedRobotId,
}: COPRobotLayerProps) {
  const [robots, setRobots] = useState<RobotInfo[]>([]);

  const fetchRobots = useCallback(async () => {
    try {
      const res = await fetch('/api/robot/robots');
      if (res.ok) {
        const data = (await res.json()) as RobotInfo[];
        // Only update state if data changed — prevents flicker from unnecessary re-renders
        setRobots((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      }
    } catch (err) {
      console.warn('[COPRobotLayer] Failed to fetch robots:', err);
    }
  }, []);

  useEffect(() => {
    fetchRobots();
    const interval = setInterval(fetchRobots, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRobots]);

  if (!visible) return null;

  const locatedRobots = robots.filter((r) => r.latest_telemetry?.position);

  return (
    <>
      {locatedRobots.map((robot) => (
        <SmoothRobotMarker
          key={`robot-${robot.robot_id}`}
          robot={robot}
          onRobotClick={onRobotClick}
        />
      ))}
      {/* When a robot is selected, enable map click-to-navigate */}
      {selectedRobotId && <MapClickNavigator robotId={selectedRobotId} />}
    </>
  );
}
