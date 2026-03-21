/**
 * Mission Simulator
 *
 * Creates virtual robots that register with the mission service and simulate
 * movement, telemetry, and vision detections. Allows testing the full mission
 * sequence flow (map symbols moving, decision gates, COP updates) without
 * physical robots connected.
 *
 * Usage:
 *   POST /api/robot/scenarios/autonomous?simulate=true
 *   POST /api/robot/scenarios/iron-bastion?simulate=true
 *
 * The simulator:
 *   1. Registers virtual robots with the mission service (fake WebSocket)
 *   2. Runs a telemetry loop that moves robots along dispatched waypoints
 *   3. Generates mock vision detections when the leader enters the recon area
 *   4. Responds to mission:assign messages by executing movement simulation
 */

import { randomUUID } from 'crypto';
import { getRobotMissionService } from './robot-mission-service.js';
import type { RobotVisionMsg } from './robot-types.js';
import { getResourceRegistry } from '../resources/resource-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimRobot {
  id: string;
  did: string;
  position: { x: number; y: number };
  heading: number;
  battery: number;
  capabilities: string[];
  /** Current movement target queue */
  waypoints: Array<{ x: number; y: number }>;
  /** Current mission being executed */
  activeMissionId?: string;
  activeCommand?: string;
  /** Speed in room-meters per second (scaled for simulation) */
  speed: number;
}

interface SimSession {
  id: string;
  robots: Map<string, SimRobot>;
  telemetryInterval?: ReturnType<typeof setInterval>;
  running: boolean;
  paused: boolean;
  /** Detection trigger area */
  reconArea?: { x_min: number; y_min: number; x_max: number; y_max: number };
  /** Whether detection has been triggered */
  detectionTriggered: boolean;
  /** Threat classes to simulate detecting */
  threatClasses: string[];
  /** Home base for reset */
  homeBase: { x: number; y: number };
  /** Problem set for workspace routing */
  problemSetId?: string;
  /** Config for re-initialization on reset */
  config: {
    robotIds: string[];
    leaderId: string;
  };
}

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

const sessions: Map<string, SimSession> = new Map();

// ---------------------------------------------------------------------------
// Fake WebSocket that captures messages sent to robots
// ---------------------------------------------------------------------------

class FakeWebSocket {
  readyState = 1; // OPEN
  private robotId: string;
  private sessionId: string;

  constructor(robotId: string, sessionId: string) {
    this.robotId = robotId;
    this.sessionId = sessionId;
  }

  send(data: string): void {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'mission:assign') {
        // Handle mission assignment by setting up waypoints
        const session = sessions.get(this.sessionId);
        const robot = session?.robots.get(this.robotId);
        if (!robot || !session) return;

        const mission = msg.mission;
        robot.activeMissionId = mission.mission_id;
        robot.activeCommand = mission.command;

        // Extract waypoints based on command type
        if (mission.params.waypoints) {
          robot.waypoints = [...mission.params.waypoints];
        } else if (mission.params.target_location) {
          robot.waypoints = [mission.params.target_location];
        } else if (mission.params.area) {
          // Generate a road-following sweep path for recon_area
          // Uses actual Taipei Zhongzheng District street grid (room coords):
          //   N-S: Hengyang x=0.3, Chongqing S x=1.1, Xiangyang x=1.4,
          //        Guanqian x=2.5, Chengde x=3.4, Gongyuan x=4.4
          //   E-W: Hankou y=2.6, Xuchang y=2.9, Kaifeng y=3.3, Zhongxiao W y=4.4
          robot.waypoints = [
            // Start: Hengyang/Hankou intersection
            { x: 0.3, y: 2.6 },
            // E on Hankou St to Guanqian Rd
            { x: 2.5, y: 2.6 },
            // N on Guanqian to Xuchang St
            { x: 2.5, y: 2.9 },
            // E on Xuchang to Chengde Rd
            { x: 3.4, y: 2.9 },
            // N on Chengde to Kaifeng St
            { x: 3.4, y: 3.3 },
            // W on Kaifeng to Guanqian Rd
            { x: 2.5, y: 3.3 },
            // N on Guanqian to Zhongxiao W Rd
            { x: 2.5, y: 4.4 },
            // E on Zhongxiao W to Chengde Rd (enemy axis)
            { x: 3.4, y: 4.4 },
            // E on Zhongxiao W to Gongyuan Rd
            { x: 4.4, y: 4.4 },
            // S on Gongyuan to Kaifeng St
            { x: 4.4, y: 3.3 },
            // W on Kaifeng back to Chengde (sweep complete)
            { x: 3.4, y: 3.3 },
          ];
        }

        robot.speed = mission.params.speed ?? 100; // Raw 0-255 value — scaled in simulationTick

        // Send accepted state
        const svc = getRobotMissionService();
        svc.handleSimulatedStateUpdate(this.robotId, mission.mission_id, 'accepted');

        // Then transition to executing after brief delay
        setTimeout(() => {
          svc.handleSimulatedStateUpdate(this.robotId, mission.mission_id, 'executing');
        }, 500);

        console.log(`[Simulator] ${this.robotId} received mission ${mission.command} (${mission.mission_id.slice(0, 8)}) — ${robot.waypoints.length} waypoints, current pos (${robot.position.x.toFixed(2)}, ${robot.position.y.toFixed(2)}), first wp ${robot.waypoints[0] ? `(${robot.waypoints[0].x.toFixed(2)}, ${robot.waypoints[0].y.toFixed(2)})` : 'none'}`);
      }

      if (msg.type === 'robot:auth_response') {
        // Handle auth response for find_engage
        const session = sessions.get(this.sessionId);
        const robot = session?.robots.get(this.robotId);
        if (!robot) return;

        if (msg.approved) {
          // Flash red (simulated) then complete
          const svc = getRobotMissionService();
          svc.handleSimulatedStateUpdate(this.robotId, robot.activeMissionId!, 'executing');
          setTimeout(() => {
            svc.handleSimulatedStateUpdate(this.robotId, robot.activeMissionId!, 'complete');
            robot.activeMissionId = undefined;
            robot.activeCommand = undefined;
          }, 3000);
        }
      }
    } catch { /* ignore parse errors */ }
  }

  close(): void { this.readyState = 3; }
  ping(): void { /* no-op */ }
  on(): this { return this; }
  once(): this { return this; }
  removeListener(): this { return this; }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a simulation session with virtual robots.
 */
export async function startSimulation(config: {
  robotIds: string[];
  leaderId: string;
  homeBase: { x: number; y: number };
  reconArea?: { x_min: number; y_min: number; x_max: number; y_max: number };
  threatClasses?: string[];
  problemSetId?: string;
}): Promise<string> {
  const sessionId = randomUUID();
  const session: SimSession = {
    id: sessionId,
    robots: new Map(),
    running: true,
    paused: false,
    reconArea: config.reconArea,
    detectionTriggered: false,
    threatClasses: config.threatClasses ?? ['CHN-99G', 'T-90'],
    homeBase: config.homeBase,
    problemSetId: config.problemSetId,
    config: { robotIds: config.robotIds, leaderId: config.leaderId },
  };

  const svc = getRobotMissionService();

  // Register virtual robots — await each so resource registry bridge completes
  // before missions are dispatched (prevents pre-flight validation failures)
  for (const robotId of config.robotIds) {
    const isLeader = robotId === config.leaderId;
    const did = `did:near:sim-robot-${robotId}`;
    const capabilities = isLeader
      ? ['patrol', 'find_engage', 'recon_area', 'visual_search', 'overwatch', 'resupply_route', 'vision', 'ISR', 'swarm_patrol', 'swarm_recon', 'swarm_advance', 'swarm_leader']
      : ['patrol', 'find_engage'];

    const robot: SimRobot = {
      id: robotId,
      did,
      position: { ...config.homeBase },
      heading: 0,
      battery: 95 + Math.random() * 5,
      capabilities,
      waypoints: [],
      speed: 1.0,
    };

    session.robots.set(robotId, robot);

    // Register with mission service using fake WebSocket — await resource bridge
    const fakeWs = new FakeWebSocket(robotId, sessionId) as unknown as import('ws').WebSocket;
    await svc.registerSimulatedRobot(robotId, did, capabilities, fakeWs);

    console.log(`[Simulator] Registered virtual robot '${robotId}' (DID: ${did})`);
  }

  sessions.set(sessionId, session);

  // Start telemetry/movement loop (runs every 500ms)
  session.telemetryInterval = setInterval(() => {
    simulationTick(session);
  }, 500);

  console.log(`[Simulator] Session ${sessionId.slice(0, 8)} started with ${config.robotIds.length} virtual robots`);
  return sessionId;
}

/**
 * Stop a simulation session.
 */
export function stopSimulation(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.running = false;
  if (session.telemetryInterval) {
    clearInterval(session.telemetryInterval);
  }

  // Disconnect virtual robots and remove from resource registry cache
  const svc = getRobotMissionService();
  const registry = getResourceRegistry();
  for (const [robotId] of session.robots) {
    // Remove sim resource from cache before disconnect (prevents NMC ghost entries)
    registry.unregisterSimulated(`RES-sim-${robotId}`);
    svc.handleRobotDisconnect(robotId);
  }

  sessions.delete(sessionId);
  console.log(`[Simulator] Session ${sessionId.slice(0, 8)} stopped`);
}

// ---------------------------------------------------------------------------
// Threat-facing heading computation
// ---------------------------------------------------------------------------

/**
 * Compute a heading that orients the robot toward the nearest known threat.
 * Uses the autonomous orchestrator's detected threats if available.
 * Returns null if no threats are known.
 */
function computeThreatFacingHeading(robot: SimRobot, _session: SimSession): number | null {
  try {
    // Dynamic import to avoid circular dependency at module load
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAutonomousOrchestrator } = require('./autonomous-mission-orchestrator.js');
    const orchestrator = getAutonomousOrchestrator();
    const sequences = orchestrator.listSequences();

    // Find threats from any active sequence
    for (const seq of sequences) {
      if (seq.detectedThreats && seq.detectedThreats.length > 0) {
        // Find nearest threat
        let nearest = seq.detectedThreats[0];
        let nearestDist = Infinity;
        for (const threat of seq.detectedThreats) {
          const dx = threat.detectedAt.x - robot.position.x;
          const dy = threat.detectedAt.y - robot.position.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = threat;
          }
        }

        const dx = nearest.detectedAt.x - robot.position.x;
        const dy = nearest.detectedAt.y - robot.position.y;
        return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      }
    }
  } catch {
    // Orchestrator not available — fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Simulation tick — move robots, send telemetry, trigger detections
// ---------------------------------------------------------------------------

function simulationTick(session: SimSession): void {
  if (!session.running || session.paused) return;

  const svc = getRobotMissionService();

  for (const [robotId, robot] of session.robots) {
    // Move toward current waypoint
    if (robot.waypoints.length > 0) {
      const target = robot.waypoints[0];
      const dx = target.x - robot.position.x;
      const dy = target.y - robot.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) {
        // Reached waypoint
        robot.waypoints.shift();

        // Orient toward nearest known threat when stationary
        robot.heading = computeThreatFacingHeading(robot, session) ?? robot.heading;

        // If no more waypoints, handle mission completion based on command type
        if (robot.waypoints.length === 0 && robot.activeMissionId) {
          if (robot.activeCommand === 'find_engage') {
            svc.handleSimulatedStateUpdate(robotId, robot.activeMissionId, 'awaiting_auth');
          } else if (robot.activeCommand === 'overwatch' || robot.activeCommand === 'patrol_route') {
            // Mark complete but hold position — robot stays at final waypoint
            svc.handleSimulatedStateUpdate(robotId, robot.activeMissionId, 'complete');
            robot.activeMissionId = undefined;
            robot.activeCommand = undefined;
          } else if (robot.activeCommand === 'return_to_base') {
            svc.handleSimulatedStateUpdate(robotId, robot.activeMissionId, 'complete');
            robot.activeMissionId = undefined;
            robot.activeCommand = undefined;
          } else {
            svc.handleSimulatedStateUpdate(robotId, robot.activeMissionId, 'complete');
            robot.activeMissionId = undefined;
            robot.activeCommand = undefined;
          }
        }
      } else {
        // Move toward target
        // Speed scaling: room coords map to ~130m per unit on the ground.
        // Speed 0-255 maps to 0-10 m/s (36 km/h max — realistic urban UGV).
        // Per 500ms tick: (speed/255) * 10 m/s * 0.5s / 130 m/unit
        const metersPerTick = (robot.speed / 255) * 10 * 0.5;
        const roomUnitsPerTick = metersPerTick / 130;
        const step = Math.min(roomUnitsPerTick, dist);
        robot.position.x += (dx / dist) * step;
        robot.position.y += (dy / dist) * step;
        robot.heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      }
    }

    // Drain battery slowly
    robot.battery = Math.max(0, robot.battery - 0.01);

    // Update telemetry in mission service
    svc.updateSimulatedTelemetry(robotId, robot.position, robot.heading, Math.round(robot.battery));

    // Check if leader is entering the near edge of the recon area → trigger
    // forward detection. A proper recce screen detects threats at range — the
    // enemy should be spotted several km ahead, well outside weapons range.
    if (
      robotId === [...session.robots.keys()][0] && // leader is first
      session.reconArea &&
      !session.detectionTriggered &&
      robot.position.x >= session.reconArea.x_min &&
      robot.position.y >= session.reconArea.y_min &&
      robot.position.y <= session.reconArea.y_max
    ) {
      session.detectionTriggered = true;
      triggerSimulatedDetection(session, robot);
    }
  }
}

function triggerSimulatedDetection(session: SimSession, robot: SimRobot): void {
  // Enemy tanks detected at the NORTH EDGE of the map (y≈4.8), approaching south.
  // They will advance toward the kill zone which is set up further south.
  // Detection at range means the COP shows them well north of friendly positions.
  const enemyStartY = 4.8; // North edge — detected at max range
  const enemyPositions = [
    { x: 2.0, y: enemyStartY },  // Western lane
    { x: 3.0, y: enemyStartY },  // Eastern lane
    { x: 2.5, y: enemyStartY + 0.1 },  // Trailing vehicle
  ];

  console.log(`[Simulator] Leader ${robot.id} at (${robot.position.x.toFixed(1)}, ${robot.position.y.toFixed(1)}) — CONTACT! Enemy armor detected at ~4km range on Zhongxiao West Rd`);

  session.threatClasses.forEach((classDesc, i) => {
    const enemyPos = enemyPositions[i] ?? enemyPositions[0];

    setTimeout(() => {
      const visionMsg = {
        type: 'robot:vision',
        robot_id: robot.id,
        mission_id: robot.activeMissionId,
        problem_set_id: session.problemSetId,
        timestamp: new Date().toISOString(),
        detections: [
          {
            class_desc: classDesc,
            confidence: 0.85 + Math.random() * 0.12,
            bbox: { left: 100, top: 80, right: 300, bottom: 420 },
            center_x: 200,
            center_y: 250,
            estimated_position: enemyPos,
          },
        ],
        message_id: randomUUID(),
      };

      const svc = getRobotMissionService();
      svc.handleVisionMsg(visionMsg as RobotVisionMsg);

      console.log(`[Simulator] CONTACT: ${classDesc} at (${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}) — conf ${(visionMsg.detections[0].confidence * 100).toFixed(0)}%`);
    }, i * 1500);
  });
}

// ---------------------------------------------------------------------------
// Simulation control: pause, resume, reset, status
// ---------------------------------------------------------------------------

/**
 * Pause a simulation — robots freeze in place, timers stop.
 */
export function pauseSimulation(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.running) return false;
  session.paused = true;
  console.log(`[Simulator] Session ${sessionId.slice(0, 8)} PAUSED`);
  return true;
}

/**
 * Resume a paused simulation.
 */
export function resumeSimulation(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.running || !session.paused) return false;
  session.paused = false;
  console.log(`[Simulator] Session ${sessionId.slice(0, 8)} RESUMED`);
  return true;
}

/**
 * Reset a simulation — move all robots back to home base, clear state,
 * re-enable vision detection trigger. The session stays alive so you can
 * re-launch a scenario without re-registering robots.
 */
export function resetSimulation(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.paused = false;
  session.detectionTriggered = false;

  // Move all robots back to home base, clear missions
  for (const [, robot] of session.robots) {
    robot.position = { ...session.homeBase };
    robot.heading = 0;
    robot.waypoints = [];
    robot.activeMissionId = undefined;
    robot.activeCommand = undefined;
    robot.speed = 1.0;
    robot.battery = 95 + Math.random() * 5;
  }

  // Update telemetry to show robots at home
  const svc = getRobotMissionService();
  for (const [robotId, robot] of session.robots) {
    svc.updateSimulatedTelemetry(robotId, robot.position, robot.heading, Math.round(robot.battery));
  }

  console.log(`[Simulator] Session ${sessionId.slice(0, 8)} RESET — all robots at home base`);
  return true;
}

/**
 * Get simulation session status.
 */
export function getSimulationStatus(sessionId: string): {
  running: boolean;
  paused: boolean;
  robotCount: number;
  robots: Array<{ id: string; position: { x: number; y: number }; activeMission?: string }>;
} | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  return {
    running: session.running,
    paused: session.paused,
    robotCount: session.robots.size,
    robots: [...session.robots.values()].map((r) => ({
      id: r.id,
      position: { ...r.position },
      activeMission: r.activeMissionId,
    })),
  };
}

/**
 * List all active simulation sessions.
 */
export function listSimulations(): Array<{ id: string; running: boolean; paused: boolean; robotCount: number }> {
  return [...sessions.values()].map((s) => ({
    id: s.id,
    running: s.running,
    paused: s.paused,
    robotCount: s.robots.size,
  }));
}

// ---------------------------------------------------------------------------
// Mission service integration helpers
// ---------------------------------------------------------------------------

// These methods need to be added to RobotMissionService
// to support simulated robots without real WebSocket connections.
// We extend the service's public API via module augmentation.

declare module './robot-mission-service.js' {
  interface RobotMissionService {
    registerSimulatedRobot(robotId: string, did: string, capabilities: string[], fakeWs: import('ws').WebSocket): Promise<void>;
    handleSimulatedStateUpdate(robotId: string, missionId: string, state: string): void;
    updateSimulatedTelemetry(robotId: string, position: { x: number; y: number }, heading: number, battery: number): void;
  }
}
