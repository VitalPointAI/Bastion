/**
 * Swarm → COP Bridge (Phase 48)
 *
 * Converts SwarmTelemetryMsg (robot-space room coordinates) into a
 * SwarmFormationSpec (geo coordinates) and emits it on the COP event bus.
 *
 * Called from RobotMissionService.handleSwarmTelemetry() as a post-processor
 * to connect swarm telemetry to the COP visualization pipeline.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SwarmTelemetryMsg } from './robot-types.js';
import type { SwarmFormationSpec, SwarmMemberSpec, LatLng } from '../cop/layers/layer-types.js';

// ---------------------------------------------------------------------------
// Calibration helpers (mirrors robot-mission-service.ts loadDefaultCalibration)
// ---------------------------------------------------------------------------

const __bridge_filename = fileURLToPath(import.meta.url);
const __bridge_dirname = dirname(__bridge_filename);
const CALIBRATION_FILE = join(__bridge_dirname, '../../data/calibration-profiles.json');

interface CalibrationBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface CalibrationProfile {
  room_width: number;
  room_height: number;
  map_bounds: CalibrationBounds;
}

function loadDefaultCalibration(): CalibrationProfile {
  try {
    if (existsSync(CALIBRATION_FILE)) {
      const profiles = JSON.parse(readFileSync(CALIBRATION_FILE, 'utf-8')) as Record<string, CalibrationProfile>;
      if (profiles.default) return profiles.default;
    }
  } catch { /* fallback below */ }
  return {
    room_width: 5,
    room_height: 5,
    map_bounds: { north: 25.0340, south: 25.0330, east: 121.5650, west: 121.5640 },
  };
}

/**
 * Convert room-space (x, y) meters to geo (lat, lng) using calibration profile.
 * Exported for reuse by other robot subsystems.
 */
export function roomToGeo(x: number, y: number, calibration?: CalibrationProfile): LatLng {
  const cal = calibration ?? loadDefaultCalibration();
  const { north, south, east, west } = cal.map_bounds;
  return {
    lat: south + (y / cal.room_height) * (north - south),
    lng: west + (x / cal.room_width) * (east - west),
  };
}

// ---------------------------------------------------------------------------
// Formation technique lookup
// ---------------------------------------------------------------------------

/** Map SwarmState to a movement technique heuristic */
function inferTechnique(
  state: string,
): SwarmFormationSpec['technique'] {
  switch (state) {
    case 'moving':
      return 'traveling';
    case 'holding':
      return 'traveling_overwatch';
    case 'contact':
      return 'bounding_overwatch';
    default:
      return 'traveling';
  }
}

// ---------------------------------------------------------------------------
// Bridge function
// ---------------------------------------------------------------------------

/**
 * Convert a SwarmTelemetryMsg into a SwarmFormationSpec and emit it on the
 * COP event bus.
 *
 * @param msg     Incoming swarm telemetry message from the leader robot
 * @param emit    Event emitter callback — typically `messageBus.publish` bound
 *                to the COP channel, or a WebSocket broadcast function.
 *                Signature: (event: string, data: unknown) => void
 * @returns       The constructed SwarmFormationSpec (for callers that need it)
 */
export function bridgeSwarmTelemetryToCOP(
  msg: SwarmTelemetryMsg,
  emit: (event: string, data: unknown) => void,
): SwarmFormationSpec {
  const cal = loadDefaultCalibration();

  // Build geo-coordinate member specs
  const members: SwarmMemberSpec[] = msg.members.map((m) => ({
    robotId: m.robot_id,
    role: m.robot_id === msg.leader_id ? 'leader' : 'follower',
    position: roomToGeo(m.position.x, m.position.y, cal),
    slotIndex: m.slot_index ?? 0,
    batteryPct: m.battery_pct,
  }));

  // Map robot-space SwarmState to COP SwarmFormationSpec state
  // SwarmFormationSpec state includes 'contact' which is not in robot-space SwarmState
  const copState: SwarmFormationSpec['state'] =
    (msg.state as string) === 'contact'
      ? 'contact'
      : (msg.state as SwarmFormationSpec['state']);

  const spec: SwarmFormationSpec = {
    swarmId: msg.swarm_id,
    leaderId: msg.leader_id,
    state: copState,
    formation: msg.formation as SwarmFormationSpec['formation'],
    technique: inferTechnique(msg.state),
    memberCount: msg.member_count,
    members,
    centerOfMass: roomToGeo(msg.center_of_mass.x, msg.center_of_mass.y, cal),
    heading: msg.heading,
  };

  // Emit COP update event
  emit('swarm:cop_update', spec);

  return spec;
}
