/**
 * COPRobotLayer
 *
 * Phase 06 Plan 04: Renders connected robots as state-colored markers on the
 * COP Leaflet map. Polls /api/robot/robots for position and state updates.
 * Smoothly interpolates marker positions between poll intervals.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

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
}

interface COPRobotLayerProps {
  problemSetId: string;
  visible: boolean;
  onRobotClick?: (robotId: string) => void;
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

function createRobotIcon(state: string): L.DivIcon {
  const color = STATE_COLORS[state] || DEFAULT_COLOR;
  const isPulsing = state === 'awaiting_auth';

  return L.divIcon({
    className: 'cop-robot-marker',
    html: `<div style="
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
    <style>
      @keyframes robot-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.15); }
      }
    </style>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// ─── Room-to-map coordinate transform (MVP linear mapping) ──────────────────

function roomToLatLng(x: number, y: number): [number, number] {
  const south = 25.0330, north = 25.0340;
  const west = 121.5640, east = 121.5650;
  const roomWidth = 5, roomHeight = 5;
  return [
    south + (y / roomHeight) * (north - south),
    west + (x / roomWidth) * (east - west),
  ];
}

// ─── Smooth marker component ──────────────────────────────────────────────

const POLL_INTERVAL = 3000;
const LERP_STEP_MS = 50; // 20fps interpolation

interface SmoothTarget {
  lat: number;
  lng: number;
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
  const prevPos = useRef<SmoothTarget | null>(null);
  const targetPos = useRef<SmoothTarget | null>(null);
  const animFrame = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  const pos = robot.latest_telemetry!.position;
  const [lat, lng] = roomToLatLng(pos.x, pos.y);
  const missionState = robot.current_mission_id ? 'executing' : 'idle';
  const iconState = robot.state === 'connected' ? missionState : robot.state;

  useEffect(() => {
    // Create marker on mount
    const icon = createRobotIcon(iconState);
    const marker = L.marker([lat, lng], { icon }).addTo(map);
    marker.on('click', () => onRobotClick?.(robot.robot_id));

    // Add tooltip
    const tooltipContent = `
      <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-align: center;">
        <strong>${robot.robot_id}</strong><br/>
        <span style="color: ${STATE_COLORS[robot.state] || DEFAULT_COLOR}">
          ${robot.current_mission_id ? robot.state || 'active' : 'idle'}
        </span>
        ${robot.latest_telemetry ? `<br/><span style="color: #888">Battery: ${robot.latest_telemetry.battery ?? '?'}%</span>` : ''}
      </div>
    `;
    marker.bindTooltip(tooltipContent, { direction: 'bottom', offset: [0, 14] });

    markerRef.current = marker;
    prevPos.current = { lat, lng };
    targetPos.current = { lat, lng };

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      map.removeLayer(marker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // When position updates, start smooth interpolation
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    // Update icon for state changes
    marker.setIcon(createRobotIcon(iconState));

    // Update tooltip
    const tooltipContent = `
      <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-align: center;">
        <strong>${robot.robot_id}</strong><br/>
        <span style="color: ${STATE_COLORS[robot.state] || DEFAULT_COLOR}">
          ${robot.current_mission_id ? robot.state || 'active' : 'idle'}
        </span>
        ${robot.latest_telemetry ? `<br/><span style="color: #888">Battery: ${robot.latest_telemetry.battery ?? '?'}%</span>` : ''}
      </div>
    `;
    marker.setTooltipContent(tooltipContent);

    // Set up interpolation from current position to new target
    const currentLatLng = marker.getLatLng();
    prevPos.current = { lat: currentLatLng.lat, lng: currentLatLng.lng };
    targetPos.current = { lat, lng };
    startTime.current = performance.now();

    if (animFrame.current) cancelAnimationFrame(animFrame.current);

    function animate() {
      const marker = markerRef.current;
      const prev = prevPos.current;
      const target = targetPos.current;
      if (!marker || !prev || !target) return;

      const elapsed = performance.now() - startTime.current;
      const t = Math.min(elapsed / POLL_INTERVAL, 1); // 0..1 over poll interval
      // Ease-out for smooth deceleration
      const eased = 1 - (1 - t) * (1 - t);

      const newLat = prev.lat + (target.lat - prev.lat) * eased;
      const newLng = prev.lng + (target.lng - prev.lng) * eased;
      marker.setLatLng([newLat, newLng]);

      if (t < 1) {
        animFrame.current = requestAnimationFrame(animate);
      }
    }

    animFrame.current = requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, iconState, robot.state, robot.current_mission_id]);

  return null; // Marker is managed imperatively via Leaflet
}

// ─── Component ──────────────────────────────────────────────────────────────

export function COPRobotLayer({
  problemSetId: _problemSetId,
  visible,
  onRobotClick,
}: COPRobotLayerProps) {
  const [robots, setRobots] = useState<RobotInfo[]>([]);

  const fetchRobots = useCallback(async () => {
    try {
      const res = await fetch('/api/robot/robots');
      if (res.ok) {
        const data = (await res.json()) as RobotInfo[];
        setRobots(data);
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
    </>
  );
}
