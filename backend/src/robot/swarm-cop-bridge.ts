/**
 * Swarm → COP Bridge (Phase 48)
 *
 * Converts SwarmTelemetryMsg (robot-space room coordinates) into a
 * SwarmFormationSpec (geo coordinates) and emits it on the COP event bus.
 *
 * Called from RobotMissionService.handleSwarmTelemetry() as a post-processor
 * to connect swarm telemetry to the COP visualization pipeline.
 */

import type { SwarmTelemetryMsg } from './robot-types.js';
import type { SwarmFormationSpec, SwarmMemberSpec } from '../cop/layers/layer-types.js';
import { calibrationService } from './calibration-service.js';

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
  // Build geo-coordinate member specs
  const members: SwarmMemberSpec[] = msg.members.map((m) => ({
    robotId: m.robot_id,
    role: m.robot_id === msg.leader_id ? 'leader' : 'follower',
    position: calibrationService.roomToGeo(m.position.x, m.position.y),
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
    centerOfMass: calibrationService.roomToGeo(msg.center_of_mass.x, msg.center_of_mass.y),
    heading: msg.heading,
  };

  // Emit COP update event
  emit('swarm:cop_update', spec);

  return spec;
}
