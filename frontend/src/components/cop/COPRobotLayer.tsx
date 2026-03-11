/**
 * COPRobotLayer
 *
 * Phase 06 Plan 04: Renders connected robots as state-colored markers on the
 * COP Leaflet map. Polls /api/robot/robots for position and state updates.
 */

import { useEffect, useState, useCallback } from 'react';
import { Marker, Tooltip, useMap } from 'react-leaflet';
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

// ─── Mission labels ─────────────────────────────────────────────────────────

function getMissionLabel(robot: RobotInfo): string {
  if (!robot.current_mission_id) return robot.robot_id;
  // Derive a short label from the robot's state
  return robot.robot_id;
}

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
  // MVP: simple linear mapping from room coords (0-10m range) to map coords
  // centered around a default position. Real calibration in Plan 05.
  const baseLat = 25.0;
  const baseLng = 121.5;
  const scale = 0.0001; // ~11m per 0.0001 degree
  return [baseLat + y * scale, baseLng + x * scale];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function COPRobotLayer({
  problemSetId: _problemSetId,
  visible,
  onRobotClick,
}: COPRobotLayerProps) {
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const _map = useMap();

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

  // Initial fetch + polling every 3 seconds
  useEffect(() => {
    fetchRobots();
    const interval = setInterval(fetchRobots, 3000);
    return () => clearInterval(interval);
  }, [fetchRobots]);

  if (!visible) return null;

  // Filter robots with telemetry positions
  const locatedRobots = robots.filter((r) => r.latest_telemetry?.position);

  return (
    <>
      {locatedRobots.map((robot) => {
        const pos = robot.latest_telemetry!.position;
        const [lat, lng] = roomToLatLng(pos.x, pos.y);
        const missionState = robot.current_mission_id ? 'executing' : 'idle';
        // Use a more specific state if available from the robot's context
        const icon = createRobotIcon(robot.state === 'connected' ? missionState : robot.state);

        return (
          <Marker
            key={`robot-${robot.robot_id}`}
            position={[lat, lng]}
            icon={icon}
            eventHandlers={{
              click: () => onRobotClick?.(robot.robot_id),
            }}
          >
            <Tooltip direction="bottom" offset={[0, 14]}>
              <div style={{ fontSize: '11px', fontFamily: "'Fira Code', monospace", textAlign: 'center' }}>
                <strong>{getMissionLabel(robot)}</strong>
                <br />
                <span style={{ color: STATE_COLORS[robot.state] || DEFAULT_COLOR }}>
                  {robot.current_mission_id ? robot.state || 'active' : 'idle'}
                </span>
                {robot.latest_telemetry && (
                  <>
                    <br />
                    <span style={{ color: '#888' }}>
                      Battery: {robot.latest_telemetry.battery}%
                    </span>
                  </>
                )}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
