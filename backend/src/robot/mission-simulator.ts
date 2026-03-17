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
import type { ConnectedRobot } from './robot-types.js';
import { RobotMissionState } from './robot-types.js';
import { getMessageBus } from '../messaging/message-bus.js';
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

        robot.speed = (mission.params.speed ?? 100) / 255 * 0.5; // Scale to ~0.5 m/s max (tactical crawl speed, ~1.8 km/h on map)

        // Send accepted state
        const svc = getRobotMissionService();
        svc.handleSimulatedStateUpdate(this.robotId, mission.mission_id, 'accepted');

        // Then transition to executing after brief delay
        setTimeout(() => {
          svc.handleSimulatedStateUpdate(this.robotId, mission.mission_id, 'executing');
        }, 500);

        console.log(`[Simulator] ${this.robotId} received mission ${mission.command} (${mission.mission_id.slice(0, 8)})`);
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
        robot.heading = 0;

        // If no more waypoints, mission is complete
        if (robot.waypoints.length === 0 && robot.activeMissionId) {
          // For find_engage, transition to awaiting_auth instead of complete
          if (robot.activeCommand === 'find_engage') {
            svc.handleSimulatedStateUpdate(robotId, robot.activeMissionId, 'awaiting_auth');
          } else if (robot.activeCommand === 'overwatch') {
            // Overwatch stays executing (holding position)
          } else {
            svc.handleSimulatedStateUpdate(robotId, robot.activeMissionId, 'complete');
            robot.activeMissionId = undefined;
            robot.activeCommand = undefined;
          }
        }
      } else {
        // Move toward target
        const step = Math.min(robot.speed * 0.5, dist); // 0.5s per tick
        robot.position.x += (dx / dist) * step;
        robot.position.y += (dy / dist) * step;
        robot.heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      }
    }

    // Drain battery slowly
    robot.battery = Math.max(0, robot.battery - 0.01);

    // Update telemetry in mission service
    svc.updateSimulatedTelemetry(robotId, robot.position, robot.heading, Math.round(robot.battery));

    // Check if leader is in recon area → trigger vision detection
    if (
      robotId === [...session.robots.keys()][0] && // leader is first
      session.reconArea &&
      !session.detectionTriggered &&
      robot.position.x >= session.reconArea.x_min &&
      robot.position.x <= session.reconArea.x_max &&
      robot.position.y >= session.reconArea.y_min &&
      robot.position.y <= session.reconArea.y_max
    ) {
      session.detectionTriggered = true;
      triggerSimulatedDetection(session, robot);
    }
  }
}

function triggerSimulatedDetection(session: SimSession, robot: SimRobot): void {
  console.log(`[Simulator] Triggering vision detection for ${robot.id} at (${robot.position.x.toFixed(1)}, ${robot.position.y.toFixed(1)})`);

  const messageBus = getMessageBus();

  // Simulate detection of each threat class with slight delay between them
  session.threatClasses.forEach((classDesc, i) => {
    setTimeout(() => {
      const visionMsg = {
        type: 'robot:vision',
        robot_id: robot.id,
        mission_id: robot.activeMissionId,
        timestamp: new Date().toISOString(),
        detections: [
          {
            class_desc: classDesc,
            confidence: 0.82 + Math.random() * 0.15,
            bbox: { left: 100, top: 80, right: 300, bottom: 420 },
            center_x: 200,
            center_y: 250,
          },
        ],
        message_id: randomUUID(),
      };

      // Feed through mission service vision handler
      const svc = getRobotMissionService();
      svc.handleVisionMsg(visionMsg as any);

      console.log(`[Simulator] Vision detection: ${classDesc} (conf=${visionMsg.detections[0].confidence.toFixed(2)})`);
    }, i * 2000);
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
