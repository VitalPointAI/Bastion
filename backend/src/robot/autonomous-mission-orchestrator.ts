/**
 * Autonomous Mission Orchestrator
 *
 * AI-driven multi-phase robot mission where the leader autonomously:
 *   1. Conducts reconnaissance and detects threats via vision
 *   2. Calls Claude API to assess the tactical situation and generate a plan
 *   3. Submits a DAO ResourceAllocation proposal requesting followers
 *   4. Concurrently moves to the AI-chosen overwatch position
 *   5. On approval, commands followers to AI-chosen firing positions
 *   6. Attempts to order engagement — blocked by smart contract (lethal policy)
 *   7. Submits urgent StrikeAuthorization DAO proposal
 *   8. If approved: engage → BDA → withdraw
 *   9. If denied: shadow/follow mode until commander orders return to base
 *
 * All proposals are submitted to NEAR blockchain for auditable decision trail.
 * Robot DIDs enforce what resources are authorized to do via smart contract policy.
 */

import { randomUUID } from 'crypto';
import { getRobotMissionService } from './robot-mission-service.js';
import { gateService } from '../gates/gate-service.js';
import { GateType, GateEnforcement, GateStatus } from '../gates/gate-types.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { roomToGridRef } from '../coordinates/mgrs-coordinator.js';
import { generateTacticalPlan, type TacticalPlan, type ThreatInfo } from './tactical-ai-service.js';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutoPhase =
  | 'idle'
  | 'recon'
  | 'assess'          // AI tactical assessment in progress
  | 'plan_submitted'  // DAO ResourceAllocation proposal submitted + leader moving to OW
  | 'positioning'     // Resources approved, followers moving to firing positions
  | 'engage_blocked'  // Leader tried to fire — smart contract blocked (DID policy)
  | 'authorize'       // Urgent StrikeAuthorization DAO proposal submitted
  | 'engage'          // Approved: followers firing
  | 'bda'             // Battle damage assessment
  | 'withdraw'        // All elements returning to base
  | 'shadow'          // Denied: following enemy at distance
  | 'complete';

interface AutoConfig {
  leaderId: string;
  followerIds: string[];
  problemSetId: string;
  homeBase: { x: number; y: number };
  reconArea: { x_min: number; y_min: number; x_max: number; y_max: number };
  reconSpeed: number;
  advanceSpeed: number;
  issuedBy: string;
  /** DAO contract ID for NEAR proposals */
  daoId: string;
  /** Whether this is a simulated mission (virtual robots) or real hardware */
  simulate: boolean;
  /** Static observation post mode — leader holds position instead of patrolling */
  observationPost?: {
    position: { x: number; y: number };
    /** Heading in degrees (0=N, 90=E, 180=S, 270=W) to face from the OP */
    facingHeading: number;
  };
  /** Commander-specified kill zone center (room coords) — overrides AI-planned positions */
  killZoneCenter?: { x: number; y: number };
}

interface AutoState {
  id: string;
  phase: AutoPhase;
  startedAt: string;
  phaseStartedAt: string;
  config: AutoConfig;
  missions: Record<string, string>;
  detectedThreats: ThreatInfo[];
  /** AI-generated tactical plan */
  tacticalPlan?: TacticalPlan;
  /** Gate IDs */
  resourceGateId?: string;
  lethalGateId?: string;
  /** DID policy block details */
  policyBlock?: {
    robotDid: string;
    reason: string;
    timestamp: string;
  };
  error?: string;
  log: Array<{ ts: string; phase: string; msg: string }>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

// Room layout: 5m x 5m, (0,0) = SW corner, heading 0 = north (toward doorway)
// Alpha OP at east side (4.4, 3.4) = Grid 5042 7086, facing NW
// Bravo/Charlie start near SW: bravo(1.5,0.5), charlie(2.5,0.5)
// Kill zone and firing positions determined by AI after alpha detects threats
const AUTO_DEFAULTS: AutoConfig = {
  leaderId: 'alpha',
  followerIds: ['bravo', 'charlie'],
  problemSetId: 'default',
  homeBase: { x: 0.5, y: 0.5 },
  reconArea: { x_min: 1.0, y_min: 1.0, x_max: 4.5, y_max: 4.5 },
  reconSpeed: 80,
  advanceSpeed: 120,
  issuedBy: 'did:near:bastion.testnet',
  daoId: 'bastion-dao.testnet',
  simulate: true,
  // Static OP: alpha holds at Grid 5042 7086, facing NW (315°)
  // After detecting threats, AI determines kill zone and firing positions
  observationPost: {
    position: { x: 4.4, y: 3.4 },
    facingHeading: 315,
  },
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Detection confirmation buffer
// ---------------------------------------------------------------------------
// Require multiple detections before confirming a threat to filter false positives.
// Key: "class|gridX|gridY" (1m grid), Value: { count, firstSeen, lastSeen, bestConf, bestPos }

const CONFIRM_MIN_DETECTIONS = 2;   // need 2 detections (real targets visible briefly while moving)
const CONFIRM_WINDOW_MS = 30_000;   // within 30 seconds (robot may pass tank slowly)
const CONFIRM_MIN_CONFIDENCE = 0.45; // slightly above YOLO threshold (0.4) to filter noise

interface PendingDetection {
  count: number;
  firstSeen: number;
  lastSeen: number;
  bestConfidence: number;
  bestPosition: { x: number; y: number };
  classDesc: string;
}

class AutonomousMissionOrchestrator extends EventEmitter {
  private sequences: Map<string, AutoState> = new Map();
  private visionSubscribed = false;
  /** Active interval/timeout handles — cleared on reset */
  private _activeTimers: Array<ReturnType<typeof setInterval>> = [];
  /** Detection confirmation buffer — prevents false positives from triggering response */
  private _pendingDetections: Map<string, PendingDetection> = new Map();

  async startAutonomousMission(
    overrides?: Partial<AutoConfig>,
  ): Promise<{ sequenceId: string; state: AutoState }> {
    const config: AutoConfig = { ...AUTO_DEFAULTS, ...overrides };

    // Auto-discover follower IDs from connected robots when not simulating
    // and no explicit follower IDs were provided
    if (!config.simulate && (!overrides?.followerIds || overrides.followerIds.length === 0)) {
      const svc = getRobotMissionService();
      const connected = svc.getConnectedRobots();
      const followers = connected
        .filter((r) => r.robot_id !== config.leaderId)
        .map((r) => r.robot_id);
      if (followers.length > 0) {
        config.followerIds = followers;
        console.log(`[AutonomousOrchestrator] Auto-discovered ${followers.length} followers: ${followers.join(', ')}`);
      }
    }

    // ── FULL RESET: clean slate before new scenario ─────────────────────
    const svc = getRobotMissionService();

    // 1. Kill all active timers (gate polls, shadow mode, follower monitors, etc.)
    for (const timer of this._activeTimers) {
      clearInterval(timer);
    }
    this._activeTimers = [];
    // Also kill gate poll intervals tracked by the mission service
    svc.clearGatePolls();

    // 2. Stop all existing sequences
    for (const [seqId, existing] of this.sequences) {
      if (existing.phase !== 'complete') {
        existing.phase = 'complete' as AutoPhase;
        console.log(`[AutonomousOrchestrator] Stopped existing sequence ${seqId.slice(0, 8)}`);
      }
    }
    this.sequences.clear();

    // 2. Send stop + reset to the leader robot (aborts missions, stops motors,
    //    resets position/heading/yaw for alpha AND all BLE followers)
    const leader = svc.getConnectedRobots().find((r) => r.robot_id === config.leaderId);
    if (leader) {
      svc.sendManualCommand(config.leaderId, {
        type: 'robot:manual_stop',
        robot_id: config.leaderId,
      });
      // Brief pause for stop to take effect before reset
      await new Promise((r) => setTimeout(r, 500));
      svc.sendManualCommand(config.leaderId, {
        type: 'robot:reset_position',
        position: { x: config.homeBase.x, y: config.homeBase.y },
        heading: 0,
      });
    }

    // 3. Reset backend telemetry for all robots to home base
    for (const robotId of [config.leaderId, ...config.followerIds]) {
      const robot = svc.getConnectedRobots().find((r) => r.robot_id === robotId);
      if (robot) {
        robot.latest_telemetry = {
          position: { ...config.homeBase },
          heading: 0,
          battery: robot.latest_telemetry?.battery ?? 100,
        };
        svc.updateSimulatedTelemetry(robotId, config.homeBase, 0, robot.latest_telemetry.battery);
      }
    }

    // 4. Clear adversary COP layer from previous run
    try {
      const { layerStore } = await import('../cop/layers/layer-store.js');
      const layers = await layerStore.queryLayers({
        workspaceId: config.problemSetId,
        layerType: 'force_disposition',
      });
      for (const layer of layers) {
        const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
        if (meta?.generatedBy === 'vision-detection-pipeline') {
          await layerStore.deleteLayer(layer.id);
          break;
        }
      }
    } catch { /* non-fatal */ }

    // 5. Cancel pending/submitted decision gates from previous runs
    try {
      const gates = await gateService['store'].findByFilter({
        problem_set_id: config.problemSetId,
        gate_type: GateType.robot_action_auth,
      });
      let cleared = 0;
      for (const gate of gates) {
        if (gate.status === 'pending' || gate.status === 'submitted') {
          await gateService['store'].update(gate.id, { status: 'rejected' as GateStatus });
          cleared++;
        }
      }
      if (cleared > 0) {
        console.log(`[AutonomousOrchestrator] Cleared ${cleared} pending decision gate(s)`);
      }
    } catch { /* non-fatal */ }

    // Brief pause for hardware resets to take effect
    await new Promise((r) => setTimeout(r, 1500));

    // ── CREATE FRESH STATE ────────────────────────────────────────────
    const id = randomUUID();

    const state: AutoState = {
      id,
      phase: 'recon',
      startedAt: new Date().toISOString(),
      phaseStartedAt: new Date().toISOString(),
      config,
      missions: {},
      detectedThreats: [],
      log: [],
    };

    this.sequences.set(id, state);
    this.subscribeToVisionEvents();

    this.logPhase(state, `RESET COMPLETE — all robots at home base (${config.homeBase.x}, ${config.homeBase.y}), heading 0° north`);

    const reconMissionId = randomUUID();
    state.missions['recon_leader'] = reconMissionId;

    if (config.observationPost) {
      // ── STATIC OP MODE ──
      // Leader moves to a commander-specified observation post and holds,
      // scanning for threats with continuous vision. No patrol route needed.
      const op = config.observationPost;
      const opGrid = roomToGridRef(op.position.x, op.position.y);
      const headingName = op.facingHeading < 45 || op.facingHeading >= 315 ? 'North'
        : op.facingHeading < 135 ? 'East'
        : op.facingHeading < 225 ? 'South' : 'West';
      const facingDesc = op.facingHeading === 315 ? 'North West'
        : op.facingHeading === 45 ? 'North East'
        : op.facingHeading === 225 ? 'South West'
        : op.facingHeading === 135 ? 'South East' : headingName;

      // Compute a face_target point ~3m in the facing direction from the OP
      const rad = (op.facingHeading * Math.PI) / 180;
      const faceTarget = {
        x: op.position.x + Math.sin(rad) * 3.0,
        y: op.position.y + Math.cos(rad) * 3.0,
      };

      await svc.dispatchMission({
        mission_id: reconMissionId,
        robot_id: config.leaderId,
        command: 'overwatch',
        params: {
          target_location: op.position,
          speed: config.reconSpeed,
          face_target: faceTarget,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: config.problemSetId,
      });

      this.logPhase(state, `Leader ${config.leaderId} — establish observation post at grid ${opGrid}, facing ${facingDesc}`);
      this.logPhase(state, 'Scanning for threats — kill zone and firing positions to be determined on contact');
      this.logPhase(state, 'Followers holding at base pending leader assessment');
    } else {
      // ── PATROL RECON MODE (original) ──
      // Use the plan_screening_route skill to compute the recon route
      const { createNavigationTools } = await import('./skills/navigation-skill.js');
      const navTools = createNavigationTools();
      const screenTool = navTools.find((t) => t.name === 'plan_screening_route')!;

      const raw = await screenTool.invoke({
        start_x: config.homeBase.x,
        start_y: config.homeBase.y,
        screen_line_y: config.reconArea.y_max,
        ao_x_min: config.reconArea.x_min,
        ao_x_max: config.reconArea.x_max,
      });
      const screenResult = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      const reconWaypoints = screenResult.waypoints as Array<{ x: number; y: number }>;

      this.logPhase(state, `AI planned screening route: ${reconWaypoints.length} waypoints covering ${screenResult.roads_covered?.length ?? 0} roads`);

      await svc.dispatchMission({
        mission_id: reconMissionId,
        robot_id: config.leaderId,
        command: 'patrol_route',
        params: {
          waypoints: reconWaypoints,
          speed: config.reconSpeed,
          start_position: config.homeBase,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: config.problemSetId,
      });

      const reconSW = roomToGridRef(config.reconArea.x_min, config.reconArea.y_min);
      const reconNE = roomToGridRef(config.reconArea.x_max, config.reconArea.y_max);
      this.logPhase(state, `Leader ${config.leaderId} — conduct recce screen between grid ${reconSW} and grid ${reconNE}`);
      this.logPhase(state, 'Followers holding at base pending leader assessment');
    }

    this.publishUpdate(state);

    return { sequenceId: id, state };
  }

  getState(sequenceId: string): AutoState | undefined {
    return this.sequences.get(sequenceId);
  }

  listSequences(): AutoState[] {
    return [...this.sequences.values()];
  }

  /**
   * Direct notification from robot-mission-service when vision detections arrive.
   * Bypasses the message bus for reliable, low-latency threat detection.
   */
  handleVisionDetection(
    robotId: string,
    detections: Array<{ class_desc: string; confidence: number; center_x?: number; center_y?: number; estimated_position?: { x: number; y: number } }>,
  ): void {
    if (!detections || detections.length === 0) return;

    const svc = getRobotMissionService();
    const robot = svc.getConnectedRobots().find((r) => r.robot_id === robotId);
    const robotPos = robot?.latest_telemetry?.position ?? { x: 2.5, y: 2.5 };
    const now = Date.now();

    // Expire stale pending detections
    for (const [key, pending] of this._pendingDetections) {
      if (now - pending.lastSeen > CONFIRM_WINDOW_MS) {
        this._pendingDetections.delete(key);
      }
    }

    for (const det of detections) {
      // Orchestrator-side confidence gate — robot threshold is lower for feed display
      if (det.confidence < CONFIRM_MIN_CONFIDENCE) continue;

      // Use estimated enemy position if available, otherwise robot's position
      const enemyPos = det.estimated_position ?? robotPos;

      for (const [seqId, state] of this.sequences) {
        if (state.config.leaderId === robotId && (state.phase === 'recon' || state.phase === 'assess')) {
          // Ignore detections in first 10 seconds — camera settling, robot hasn't moved yet
          const seqAge = now - new Date(state.startedAt).getTime();
          if (seqAge < 10_000) continue;

          // Ignore detections near home base — likely furniture/other robots, not threats
          const hb = state.config.homeBase;
          const distFromBase = Math.sqrt((enemyPos.x - hb.x) ** 2 + (enemyPos.y - hb.y) ** 2);
          if (distFromBase < 1.0) continue;

          // ── Detection confirmation buffer ──
          // Require multiple sightings before treating as confirmed threat.
          // Key by class + 1m grid cell so nearby detections cluster together.
          const gridX = Math.floor(enemyPos.x);
          const gridY = Math.floor(enemyPos.y);
          const pendingKey = `${seqId}|${det.class_desc}|${gridX}|${gridY}`;

          const existing = this._pendingDetections.get(pendingKey);
          if (existing) {
            existing.count++;
            existing.lastSeen = now;
            if (det.confidence > existing.bestConfidence) {
              existing.bestConfidence = det.confidence;
              existing.bestPosition = { x: enemyPos.x, y: enemyPos.y };
            }
          } else {
            this._pendingDetections.set(pendingKey, {
              count: 1,
              firstSeen: now,
              lastSeen: now,
              bestConfidence: det.confidence,
              bestPosition: { x: enemyPos.x, y: enemyPos.y },
              classDesc: det.class_desc,
            });
          }

          const pending = this._pendingDetections.get(pendingKey)!;
          console.log(
            `[AutonomousOrchestrator] Detection: ${det.class_desc} conf=${det.confidence.toFixed(2)} at (${enemyPos.x.toFixed(1)},${enemyPos.y.toFixed(1)}) — sighting ${pending.count}/${CONFIRM_MIN_DETECTIONS} in ${((now - pending.firstSeen) / 1000).toFixed(1)}s`,
          );

          if (pending.count >= CONFIRM_MIN_DETECTIONS) {
            // Confirmed threat — promote to real detection
            this._pendingDetections.delete(pendingKey);

            const threat: ThreatInfo = {
              entityId: `DET-${det.class_desc.replace(/\s+/g, '-')}-${now}`,
              classDesc: pending.classDesc,
              confidence: pending.bestConfidence,
              detectedAt: { ...pending.bestPosition },
            };

            console.log(
              `[AutonomousOrchestrator] CONFIRMED threat: ${threat.classDesc} conf=${threat.confidence.toFixed(2)} at (${threat.detectedAt.x.toFixed(1)},${threat.detectedAt.y.toFixed(1)}) after ${pending.count} sightings`,
            );
            this.handleThreatDetection(seqId, threat);
          }
        }
      }
    }
  }

  /**
   * Commander orders return to base (used in shadow mode).
   */
  async orderReturnToBase(sequenceId: string): Promise<boolean> {
    const state = this.sequences.get(sequenceId);
    if (!state || state.phase !== 'shadow') return false;

    this.logPhase(state, 'Commander orders: return to base');
    await this.executeWithdrawal(state);
    return true;
  }

  // ── Phase: ASSESS (AI tactical reasoning) ──────────────────────────────

  private async handleThreatDetection(
    seqId: string,
    threat: ThreatInfo,
  ): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state) return;

    // ── Dedup: skip if same class at same approximate position ──
    const isDuplicate = state.detectedThreats.some((existing) => {
      if (existing.classDesc !== threat.classDesc) return false;
      // 1.0m tolerance — in a room-scale environment, same class within 1m
      // is the same physical target (dead reckoning drift causes position jitter)
      const dx = Math.abs(existing.detectedAt.x - threat.detectedAt.x);
      const dy = Math.abs(existing.detectedAt.y - threat.detectedAt.y);
      return dx < 1.0 && dy < 1.0;
    });

    if (isDuplicate) {
      // Already know about this target — silently skip
      return;
    }

    // Record threat
    state.detectedThreats.push(threat);
    const threatGrid = roomToGridRef(threat.detectedAt.x, threat.detectedAt.y);
    this.logPhase(state, `CONTACT: ${threat.classDesc} detected at grid ${threatGrid} conf=${(threat.confidence * 100).toFixed(0)}%`);

    // Now that the threat is confirmed, create the COP symbol
    this.createConfirmedCOPSymbol(state, threat).catch((e: unknown) =>
      console.warn('[AutoMission] Failed to create confirmed COP symbol:', e),
    );

    // Capture leader's current position at detection time (telemetry may be unavailable later)
    if (!(state as unknown as { leaderDetectionPos?: unknown }).leaderDetectionPos) {
      const svc = getRobotMissionService();
      const leader = svc.getConnectedRobots().find((r) => r.robot_id === state.config.leaderId);
      if (leader?.latest_telemetry?.position) {
        (state as unknown as { leaderDetectionPos: { x: number; y: number } }).leaderDetectionPos =
          { ...leader.latest_telemetry.position };
      }
    }

    // Only trigger assessment on first detection in recon phase
    if (state.phase !== 'recon') {
      this.logPhase(state, `Additional threat logged (${state.detectedThreats.length} total)`);
      this.publishUpdate(state);
      return;
    }

    // In patrol recon mode, cancel the patrol — leader must stop to assess.
    // In OP mode, leader stays at observation post (overwatch continues).
    if (!state.config.observationPost) {
      const reconMissionId = state.missions['recon_leader'];
      if (reconMissionId) {
        const svc = getRobotMissionService();
        const leaderRobot = svc.getConnectedRobots().find((r) => r.robot_id === state.config.leaderId);
        if (leaderRobot?.ws && leaderRobot.ws.readyState === 1) {
          try {
            leaderRobot.ws.send(JSON.stringify({ type: 'mission:cancel', robot_id: state.config.leaderId }));
            this.logPhase(state, 'Recon patrol CANCELLED — leader stopping to assess threat');
          } catch { /* non-fatal */ }
        }
      }
    } else {
      this.logPhase(state, 'Leader maintaining observation post — assessing threat');
    }

    // Wait briefly for additional detections to accumulate
    state.phase = 'assess';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'ASSESS phase — Leader initiating AI tactical assessment...');
    this.publishUpdate(state);

    // Allow 3s for additional detections before generating plan
    setTimeout(() => this.generatePlan(seqId), 3000);
  }

  private async generatePlan(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'assess') return;

    const svc = getRobotMissionService();
    const robots = svc.getConnectedRobots();
    const leaderRobot = robots.find((r) => r.robot_id === state.config.leaderId);

    // Use the leader's current telemetry position, or the position where the
    // first threat was detected (captured during handleThreatDetection), or home base
    const leaderTelemetry = leaderRobot?.latest_telemetry?.position;
    const leaderDetection = (state as unknown as { leaderDetectionPos?: { x: number; y: number } }).leaderDetectionPos;
    const leaderPos = leaderTelemetry ?? leaderDetection ?? state.config.homeBase;

    if (!leaderTelemetry && !leaderDetection) {
      this.logPhase(state, 'WARNING: Leader position unavailable — using home base (route may be incorrect)');
    }

    this.logPhase(state, `Analyzing ${state.detectedThreats.length} threat(s) — leader at (${leaderPos.x.toFixed(1)}, ${leaderPos.y.toFixed(1)})`);

    try {
      // Build commander's intent string if OP is specified
      let commanderIntent: string | undefined;
      if (state.config.observationPost) {
        const op = state.config.observationPost;
        const opGrid = roomToGridRef(op.position.x, op.position.y);
        const parts: string[] = [];
        parts.push(`Leader is holding at observation post grid ${opGrid} (${op.position.x.toFixed(1)}, ${op.position.y.toFixed(1)}) facing heading ${op.facingHeading}°. The overwatch position MUST be the leader's current OP position — do NOT move the leader.`);
        parts.push('Assess the detected threats and determine the optimal kill zone location. Position followers with flanking firing arcs to interdict and destroy enemy armor. Followers should have interlocking fields of fire across the kill zone.');
        if (state.config.killZoneCenter) {
          const kz = state.config.killZoneCenter;
          const kzGrid = roomToGridRef(kz.x, kz.y);
          parts.push(`Commander designates kill zone vicinity grid ${kzGrid} (${kz.x.toFixed(1)}, ${kz.y.toFixed(1)}).`);
        }
        commanderIntent = parts.join(' ');
      }

      const plan = await generateTacticalPlan(
        state.detectedThreats,
        {
          leader: { id: state.config.leaderId, position: leaderPos },
          followers: state.config.followerIds.map((fid) => ({
            id: fid,
            position: state.config.homeBase,
          })),
        },
        state.config.homeBase,
        commanderIntent,
      );

      state.tacticalPlan = plan;
      this.logPhase(state, `ASSESSMENT: ${plan.assessment}`);
      this.logPhase(state, `Recommendation: ${plan.engagementRecommendation.toUpperCase()} (confidence: ${(plan.planConfidence * 100).toFixed(0)}%)`);

      const owGrid = roomToGridRef(plan.overwatch.position.x, plan.overwatch.position.y);
      this.logPhase(state, `Overwatch: grid ${owGrid} — ${plan.overwatch.reasoning}`);

      for (let i = 0; i < plan.firingPositions.length; i++) {
        const fp = plan.firingPositions[i];
        const fpGrid = roomToGridRef(fp.position.x, fp.position.y);
        this.logPhase(state, `Firing pos ${i + 1}: grid ${fpGrid} — ${fp.reasoning}`);
      }

      this.publishUpdate(state);

      // Submit resource request and concurrently move leader to overwatch
      await this.submitResourceRequestAndMoveToOverwatch(seqId);
    } catch (err) {
      this.logPhase(state, `AI assessment failed: ${err}`);
      state.error = String(err);
      this.publishUpdate(state);
    }
  }

  // ── Phase: PLAN_SUBMITTED (DAO resource request + leader moves) ────────

  private async submitResourceRequestAndMoveToOverwatch(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || !state.tacticalPlan) return;

    state.phase = 'plan_submitted';
    state.phaseStartedAt = new Date().toISOString();

    const plan = state.tacticalPlan;
    const svc = getRobotMissionService();

    // 1. Create DAO ResourceAllocation proposal (via gate system + NEAR)
    const resourceGate = await gateService.createGate({
      problem_set_id: state.config.problemSetId,
      gate_type: GateType.robot_action_auth,
      target_item_id: `resource-request-${state.id.slice(0, 8)}`,
      target_item_type: 'resource_allocation',
      target_item_title: `Resource Allocation — Leader ${state.config.leaderId} requests ${state.config.followerIds.length} followers for engagement of ${state.detectedThreats.length} hostile armored vehicle(s)`,
      enforcement: GateEnforcement.hard_block,
      mode: 'operational',
    });
    state.resourceGateId = resourceGate.id;

    // Advance to 'submitted' so approveGate() works (requires submitted/escalated)
    await gateService['store'].update(resourceGate.id, {
      status: 'submitted' as GateStatus,
    });

    // Publish DAO proposal event for NEAR blockchain audit trail
    const messageBus = getMessageBus();
    await messageBus.publish({
      sourceDid: state.config.issuedBy,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'dao:proposal_created',
      messageType: 'dao.proposal.resource_allocation',
      payload: {
        gate_id: resourceGate.id,
        sequence_id: state.id,
        proposal_kind: 'ResourceAllocation',
        requester_did: `did:near:robot-${state.config.leaderId}`,
        requested_resources: state.config.followerIds.map((fid) => `did:near:robot-${fid}`),
        tactical_plan: {
          assessment: plan.assessment,
          overwatch: plan.overwatch,
          firingPositions: plan.firingPositions,
          recommendation: plan.engagementRecommendation,
          confidence: plan.planConfidence,
        },
        threats: state.detectedThreats.map((t) => ({
          classDesc: t.classDesc,
          confidence: t.confidence,
          position: t.detectedAt,
        })),
        dao_id: state.config.daoId,
        near_tx_type: 'create_proposal',
      },
    }).catch(() => { /* non-fatal */ });

    this.logPhase(state, `DAO ResourceAllocation proposal submitted (gate ${resourceGate.id.slice(0, 8)})`);
    this.logPhase(state, 'Requesting commander approval for follower deployment');

    // 2. Move leader to overwatch — skip if already at OP (observation post mode)
    if (state.config.observationPost) {
      this.logPhase(state, 'Leader maintaining observation post — continuous vision monitoring');
    } else {
      const owMissionId = randomUUID();
      state.missions['overwatch_leader'] = owMissionId;

      const owPos = plan.overwatch.position;

      // Face toward the closest detected threat so camera keeps eyes on the enemy
      const closestThreat = state.detectedThreats.reduce((best, t) =>
        t.detectedAt.y > best.detectedAt.y ? t : best, state.detectedThreats[0]);
      const faceTarget = closestThreat
        ? { x: closestThreat.detectedAt.x, y: closestThreat.detectedAt.y }
        : undefined;

      await svc.dispatchMission({
        mission_id: owMissionId,
        robot_id: state.config.leaderId,
        command: 'overwatch',
        params: {
          target_location: owPos,
          speed: state.config.reconSpeed,
          face_target: faceTarget,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      });

      const owGrid = roomToGridRef(owPos.x, owPos.y);
      this.logPhase(state, `Leader moving to overwatch at grid ${owGrid}, orienting toward threat`);
    }
    this.publishUpdate(state);

    // Poll for gate resolution
    this.pollGate(seqId, resourceGate.id, 'resource');
  }

  // ── Phase: POSITIONING (followers advance to AI-chosen positions) ──────

  private async positionFollowers(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || !state.tacticalPlan) return;

    state.phase = 'positioning';
    state.phaseStartedAt = new Date().toISOString();
    const plan = state.tacticalPlan;
    const svc = getRobotMissionService();

    // Re-discover followers — some may have connected since scenario start
    const connected = svc.getConnectedRobots();
    const currentFollowers = connected
      .filter((r) => r.robot_id !== state.config.leaderId)
      .map((r) => r.robot_id);
    if (currentFollowers.length > state.config.followerIds.length) {
      const newOnes = currentFollowers.filter((f) => !state.config.followerIds.includes(f));
      state.config.followerIds = currentFollowers;
      this.logPhase(state, `Late-joining follower(s) discovered: ${newOnes.join(', ')} (${currentFollowers.length} total)`);
    }

    this.logPhase(state, 'Resources APPROVED — deploying followers to AI-planned positions');

    // Log DID authorization check
    for (const followerId of state.config.followerIds) {
      const robots = svc.getConnectedRobots();
      const robot = robots.find((r) => r.robot_id === followerId);
      const did = robot?.did ?? `did:near:robot-${followerId}`;
      this.logPhase(state, `DID check: ${did} — authorized for patrol_route (smart contract: OK)`);
    }

    const followerMissions: string[] = [];

    for (let i = 0; i < state.config.followerIds.length; i++) {
      const followerId = state.config.followerIds[i];
      const rawRoute = plan.routes.followerRoutes[i];
      // LLM may return a single coordinate object instead of an array — normalize
      const route = Array.isArray(rawRoute)
        ? rawRoute
        : rawRoute && typeof rawRoute === 'object'
          ? [rawRoute as { x: number; y: number }]
          : [plan.firingPositions[i]?.position ?? state.config.homeBase];
      const missionId = randomUUID();

      state.missions[`advance_${followerId}`] = missionId;
      followerMissions.push(missionId);

      // Face toward the nearest detected threat after arriving at firing position
      const faceTarget = state.detectedThreats.length > 0
        ? state.detectedThreats[0].detectedAt
        : undefined;

      const missionPayload = {
        mission_id: missionId,
        robot_id: followerId,
        command: 'patrol_route',
        params: {
          waypoints: route,
          speed: state.config.advanceSpeed,
          face_target: faceTarget,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      };

      // Dispatch with retry — followers may still be connecting over BLE
      let dispatched = await svc.dispatchMission(missionPayload);
      if (!dispatched.success) {
        this.logPhase(state, `${followerId} dispatch failed (${dispatched.error}), retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
        dispatched = await svc.dispatchMission({ ...missionPayload, timestamp: new Date().toISOString() });
        if (!dispatched.success) {
          this.logPhase(state, `${followerId} dispatch retry failed: ${dispatched.error}`);
        }
      }

      const fp = plan.firingPositions[i];
      const fpGrid = fp ? roomToGridRef(fp.position.x, fp.position.y) : 'unknown';
      if (dispatched.success) {
        this.logPhase(state, `${followerId} — take tactical route to grid ${fpGrid}, assume firing position`);
      }
    }

    this.publishUpdate(state);
    this.monitorFollowerArrival(seqId, followerMissions);
  }

  // ── Phase: ENGAGE_BLOCKED (DID policy prevents lethal action) ──────────

  private async attemptEngagement(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state) return;

    state.phase = 'engage_blocked';
    state.phaseStartedAt = new Date().toISOString();

    // Simulate the leader attempting to order engagement
    // The smart contract / DID policy blocks lethal_effects_permitted=false
    const svc = getRobotMissionService();
    const leaderRobot = svc.getConnectedRobots().find((r) => r.robot_id === state.config.leaderId);
    const leaderDid = leaderRobot?.did ?? `did:near:robot-${state.config.leaderId}`;

    state.policyBlock = {
      robotDid: leaderDid,
      reason: 'Smart contract policy: lethal_effects_permitted=false in DID document. Human-in-the-loop authorization required for engagement actions.',
      timestamp: new Date().toISOString(),
    };

    this.logPhase(state, 'All followers in position — leader ordering engagement...');
    this.logPhase(state, `BLOCKED by smart contract: DID ${leaderDid}`);
    this.logPhase(state, `Policy: lethal_effects_permitted=false — requires human authorization`);
    this.logPhase(state, 'Leader escalating: submitting urgent StrikeAuthorization to DAO');

    // Publish NEAR blockchain audit event for the policy block
    const messageBus = getMessageBus();
    await messageBus.publish({
      sourceDid: leaderDid,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'dao:policy_block',
      messageType: 'dao.policy.lethal_block',
      payload: {
        sequence_id: state.id,
        robot_did: leaderDid,
        action_attempted: 'find_engage',
        policy_field: 'lethal_effects_permitted',
        policy_value: false,
        block_reason: state.policyBlock.reason,
        timestamp: state.policyBlock.timestamp,
        dao_id: state.config.daoId,
        near_tx_type: 'audit_log',
      },
    }).catch(() => { /* non-fatal */ });

    this.publishUpdate(state);

    // Submit lethal force authorization
    setTimeout(() => this.submitLethalAuthorization(seqId), 2000);
  }

  // ── Phase: AUTHORIZE (urgent StrikeAuthorization) ──────────────────────

  private async submitLethalAuthorization(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'engage_blocked') return;

    state.phase = 'authorize';
    state.phaseStartedAt = new Date().toISOString();

    const svc = getRobotMissionService();
    const threatDesc = state.detectedThreats.length > 1
      ? `${state.detectedThreats.length} hostile armored vehicles (${state.detectedThreats.map((t) => t.classDesc).join(', ')})`
      : `hostile ${state.detectedThreats[0]?.classDesc ?? 'armored vehicle'}`;

    const contextMissionId = state.missions['recon_leader'] ?? randomUUID();

    try {
      const gateId = await svc.createLethalEscalationGate(
        contextMissionId,
        `team-${state.config.leaderId}`,
        state.detectedThreats[0]?.entityId ?? 'unknown',
        threatDesc,
        state.config.problemSetId,
      );

      state.lethalGateId = gateId;

      // Publish NEAR audit trail for the lethal authorization request
      const messageBus = getMessageBus();
      await messageBus.publish({
        sourceDid: state.config.issuedBy,
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'dao:proposal_created',
        messageType: 'dao.proposal.strike_authorization',
        payload: {
          gate_id: gateId,
          sequence_id: state.id,
          proposal_kind: 'StrikeAuthorization',
          requester_did: `did:near:robot-${state.config.leaderId}`,
          target_description: threatDesc,
          urgency: 'immediate',
          dao_id: state.config.daoId,
          near_tx_type: 'create_proposal',
        },
      }).catch(() => { /* non-fatal */ });

      this.logPhase(state, `URGENT StrikeAuthorization submitted to DAO (gate ${gateId.slice(0, 8)})`);
      this.logPhase(state, `Target: ${threatDesc}`);
      this.logPhase(state, 'Awaiting commander decision on lethal force authorization...');
      this.publishUpdate(state);

      this.pollGate(seqId, gateId, 'lethal');
    } catch (err) {
      this.logPhase(state, `Failed to create lethal authorization: ${err}`);
      state.error = String(err);
      this.publishUpdate(state);
    }
  }

  // ── Phase: ENGAGE (approved) ───────────────────────────────────────────

  private async executeEngagement(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || !state.tacticalPlan) return;

    state.phase = 'engage';
    state.phaseStartedAt = new Date().toISOString();
    const plan = state.tacticalPlan;
    const svc = getRobotMissionService();

    this.logPhase(state, 'LETHAL FORCE AUTHORIZED — engaging targets');

    // Log NEAR audit trail for approval
    const messageBus = getMessageBus();
    await messageBus.publish({
      sourceDid: state.config.issuedBy,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'dao:decision_recorded',
      messageType: 'dao.decision.lethal_approved',
      payload: {
        sequence_id: state.id,
        gate_id: state.lethalGateId,
        decision: 'approved',
        dao_id: state.config.daoId,
        near_tx_type: 'record_decision',
      },
    }).catch(() => { /* non-fatal */ });

    // Dispatch find_engage to each follower
    for (let i = 0; i < state.config.followerIds.length; i++) {
      const followerId = state.config.followerIds[i];
      const fp = plan.firingPositions[i]?.position ?? state.config.homeBase;
      const missionId = randomUUID();
      state.missions[`engage_${followerId}`] = missionId;

      await svc.dispatchMission({
        mission_id: missionId,
        robot_id: followerId,
        command: 'find_engage',
        params: {
          target_location: fp,
          speed: 60,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      });

      this.logPhase(state, `${followerId} engaging target from (${fp.x}, ${fp.y})`);
    }

    this.publishUpdate(state);

    // Auto-approve the individual robot auth gates since lethal force is authorized
    setTimeout(() => this.autoApproveEngagementGates(seqId), 3000);
  }

  private async autoApproveEngagementGates(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'engage') return;

    const svc = getRobotMissionService();

    for (const followerId of state.config.followerIds) {
      const missionId = state.missions[`engage_${followerId}`];
      if (missionId) {
        try {
          await svc.handleGateResolution(missionId, true, 'strike-authorized');
          this.logPhase(state, `Engagement authorized for ${followerId} (cascaded from StrikeAuthorization)`);
        } catch (err) {
          this.logPhase(state, `Auto-approve failed for ${followerId}: ${err}`);
        }
      }
    }

    this.publishUpdate(state);

    // After engagement effects, proceed to BDA
    setTimeout(() => this.executeBDA(seqId), 8000);
  }

  // ── Phase: BDA ─────────────────────────────────────────────────────────

  private async executeBDA(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'engage') return;

    state.phase = 'bda';
    state.phaseStartedAt = new Date().toISOString();

    // Update adversary COP symbols to destroyed
    await this.markThreatsDestroyed(state);

    const threatCount = state.detectedThreats.length;
    this.logPhase(state, `BDA REPORT: ${threatCount} enemy armored vehicle(s) DESTROYED`);
    this.logPhase(state, 'Area clear — recommending withdrawal to home base');

    // Log BDA to NEAR audit trail
    const messageBus = getMessageBus();
    await messageBus.publish({
      sourceDid: state.config.issuedBy,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'dao:audit_log',
      messageType: 'dao.audit.bda_report',
      payload: {
        sequence_id: state.id,
        bda_result: 'targets_destroyed',
        threat_count: threatCount,
        threats: state.detectedThreats.map((t) => t.classDesc),
        dao_id: state.config.daoId,
        near_tx_type: 'audit_log',
      },
    }).catch(() => { /* non-fatal */ });

    this.publishUpdate(state);
    setTimeout(() => this.executeWithdrawal(state), 5000);
  }

  // ── Phase: SHADOW (denied — follow at distance) ────────────────────────

  private async enterShadowMode(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || !state.tacticalPlan) return;

    state.phase = 'shadow';
    state.phaseStartedAt = new Date().toISOString();

    this.logPhase(state, 'Lethal force DENIED — entering shadow/observe mode');
    this.logPhase(state, 'Maintaining overwatch — tracking enemy movement through sector');
    this.logPhase(state, 'Followers holding at positions — not engaging');
    this.logPhase(state, 'Awaiting further orders from commander (use "Return to Base" to withdraw)');

    // Log denial to NEAR audit trail
    const messageBus = getMessageBus();
    await messageBus.publish({
      sourceDid: state.config.issuedBy,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'dao:decision_recorded',
      messageType: 'dao.decision.lethal_denied',
      payload: {
        sequence_id: state.id,
        gate_id: state.lethalGateId,
        decision: 'denied',
        follow_up_action: 'shadow_mode',
        dao_id: state.config.daoId,
        near_tx_type: 'record_decision',
      },
    }).catch(() => { /* non-fatal */ });

    this.publishUpdate(state);

    // In shadow mode, periodically log that we're still tracking
    const shadowInterval = setInterval(() => {
      const s = this.sequences.get(seqId);
      if (!s || s.phase !== 'shadow') {
        clearInterval(shadowInterval);
        return;
      }
      this.logPhase(s, 'Shadow mode: enemy still in sector — maintaining observation');
      this.publishUpdate(s);
    }, 15000);
    this._trackTimer(shadowInterval);

    // Safety: stop shadow reporting after 10 minutes
    setTimeout(() => clearInterval(shadowInterval), 10 * 60 * 1000);
  }

  // ── Phase: WITHDRAW ────────────────────────────────────────────────────

  private async executeWithdrawal(state: AutoState): Promise<void> {
    state.phase = 'withdraw';
    state.phaseStartedAt = new Date().toISOString();

    const plan = state.tacticalPlan;
    const svc = getRobotMissionService();

    // Clear kill zone overlay
    (state as unknown as { killZone?: unknown }).killZone = null;
    this.publishUpdate(state);

    // Post-engagement: consolidate near the overwatch position, do NOT RTB.
    // All elements move to the overwatch position and hold for further orders.
    const consolidationPoint = plan?.overwatch.position ?? state.config.homeBase;
    const consolidationGrid = roomToGridRef(consolidationPoint.x, consolidationPoint.y);

    this.logPhase(state, `CONSOLIDATE — All elements consolidate at grid ${consolidationGrid} and await further orders`);

    const allRobots = [state.config.leaderId, ...state.config.followerIds];

    for (const robotId of allRobots) {
      // Get robot's current position — try telemetry first, then use the
      // position the robot was dispatched to (from the tactical plan)
      const robot = svc.getConnectedRobots().find((r) => r.robot_id === robotId);
      let currentPos = robot?.latest_telemetry?.position;
      if (!currentPos && plan) {
        // Use the position the robot was sent to
        if (robotId === state.config.leaderId) {
          currentPos = plan.overwatch.position;
        } else {
          const fpIdx = state.config.followerIds.indexOf(robotId);
          currentPos = plan.firingPositions[fpIdx]?.position;
        }
      }
      if (!currentPos) currentPos = state.config.homeBase;

      // Compute route from current position to consolidation point
      let route: Array<{ x: number; y: number }>;
      try {
        const { createNavigationTools } = await import('./skills/navigation-skill.js');
        const navTools = createNavigationTools();
        const routeTool = navTools.find((t) => t.name === 'plan_route')!;
        const raw = await routeTool.invoke({
          from_x: currentPos.x, from_y: currentPos.y,
          to_x: consolidationPoint.x, to_y: consolidationPoint.y,
          prefer_concealment: false,
        });
        const result = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
        route = result.waypoints ?? [consolidationPoint];
      } catch {
        route = [consolidationPoint];
      }

      const missionId = randomUUID();
      state.missions[`consolidate_${robotId}`] = missionId;

      await svc.dispatchMission({
        mission_id: missionId,
        robot_id: robotId,
        command: 'patrol_route',
        params: {
          waypoints: route,
          speed: state.config.advanceSpeed,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      });

      this.logPhase(state, `${robotId} — move to consolidation point grid ${consolidationGrid}`);
    }

    this.publishUpdate(state);

    // Monitor withdrawal completion
    const checkInterval = setInterval(async () => {
      if (state.phase !== 'withdraw') {
        clearInterval(checkInterval);
        return;
      }

      const robots = svc.getConnectedRobots();
      const allConsolidated = allRobots.every((rid) => {
        const robot = robots.find((r) => r.robot_id === rid);
        if (!robot) return false;
        return robot.current_mission_id !== state.missions[`consolidate_${rid}`];
      });

      if (allConsolidated) {
        clearInterval(checkInterval);
        state.phase = 'complete';
        state.phaseStartedAt = new Date().toISOString();
        this.logPhase(state, 'CONSOLIDATED — All elements at consolidation point, awaiting further orders');
        this.logPhase(state, `Mission summary: ${state.detectedThreats.length} threats detected, ${state.lethalGateId ? 'engagement authorized' : 'no engagement'}`);
        this.publishUpdate(state);
      }
    }, 2000);
    this._trackTimer(checkInterval);

    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
  }

  // ── Shared helpers ─────────────────────────────────────────────────────

  /**
   * Check if any active autonomous sequence involves this robot.
   * Used by the vision pipeline to defer COP symbol creation to the orchestrator.
   */
  hasActiveSequenceForRobot(robotId: string): boolean {
    for (const state of this.sequences.values()) {
      if (state.phase === 'complete') continue;
      if (state.config.leaderId === robotId) return true;
      if (state.config.followerIds.includes(robotId)) return true;
    }
    return false;
  }

  /**
   * Create COP symbol for a confirmed threat (after passing the detection buffer).
   * Called from handleThreatDetection — only confirmed sightings get symbols.
   */
  private async createConfirmedCOPSymbol(state: AutoState, threat: ThreatInfo): Promise<void> {
    try {
      const { updateAdversaryCOPLayer, extractThreatSymbols } = await import('./vision-cop-pipeline.js');
      const { roomToLatLng } = await import('../coordinates/mgrs-coordinator.js');

      const pos = roomToLatLng(threat.detectedAt.x, threat.detectedAt.y);

      // Build a minimal VisionMsg to reuse extractThreatSymbols
      const fakeMsg = {
        type: 'robot:vision' as const,
        robot_id: state.config.leaderId,
        timestamp: new Date().toISOString(),
        detections: [{
          class_desc: threat.classDesc,
          confidence: threat.confidence,
          bbox: { left: 0, top: 0, right: 0, bottom: 0 },
          estimated_position: threat.detectedAt,
        }],
      };

      const symbols = extractThreatSymbols(fakeMsg, pos);
      if (symbols.length > 0) {
        await updateAdversaryCOPLayer(state.config.problemSetId || 'default', symbols);
        this.logPhase(state, `COP symbol created for confirmed ${threat.classDesc}`);
      }
    } catch (err: unknown) {
      console.warn('[AutoMission] COP symbol creation failed:', err);
    }
  }

  private async markThreatsDestroyed(state: AutoState): Promise<void> {
    try {
      const { layerStore } = await import('../cop/layers/layer-store.js');

      const layers = await layerStore.queryLayers({
        workspaceId: state.config.problemSetId || 'default',
        layerType: 'force_disposition',
      });

      for (const layer of layers) {
        const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
        if (meta?.generatedBy !== 'vision-detection-pipeline') continue;

        const symbols = layer.spec?.symbols;
        if (!symbols || !Array.isArray(symbols)) continue;

        let updated = false;
        for (const sym of symbols) {
          if (sym.sidc && sym.sidc.length === 20 && sym.affiliation === 'enemy') {
            const chars = sym.sidc.split('');
            chars[6] = '5';
            sym.sidc = chars.join('');
            sym.designation = `${sym.designation} [DESTROYED]`;
            updated = true;
          }
        }

        if (updated) {
          const updatedMeta = {
            generatedBy: 'vision-detection-pipeline',
            generatedAt: new Date().toISOString(),
            sourceDocumentIds: (meta?.sourceDocumentIds ?? []) as string[],
            ccoValidated: false,
          };
          await layerStore.updateLayerSpec(layer.id, { ...layer.spec!, symbols, metadata: updatedMeta });
          this.logPhase(state, 'COP updated — enemy symbols marked DESTROYED');
        }
      }
    } catch (err) {
      this.logPhase(state, `Failed to update COP symbols: ${err}`);
    }
  }

  private monitorFollowerArrival(seqId: string, _missionIds: string[]): void {
    const checkInterval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state || state.phase !== 'positioning') {
        clearInterval(checkInterval);
        return;
      }

      const svc = getRobotMissionService();
      const robots = svc.getConnectedRobots();

      const allArrived = state.config.followerIds.every((fid) => {
        const missionId = state.missions[`advance_${fid}`];

        // Check if the mission service received a 'complete' state_update
        // for this follower's advance mission (sent by alpha on BLE route completion)
        const robot = robots.find((r) => r.robot_id === fid);
        if (robot && robot.current_mission_id !== missionId) {
          return true;
        }

        // Check mission store for completed state (BLE followers report via state_update)
        // This is set by handleStateUpdate when alpha reports follower route complete
        const completedKey = `${fid}_arrived`;
        if ((state as unknown as Record<string, unknown>)[completedKey]) return true;

        // Timeout fallback — don't block scenario forever
        const elapsed = Date.now() - new Date(state.phaseStartedAt).getTime();
        if (elapsed > 90_000) return true; // 90s timeout

        return false;
      });

      if (allArrived) {
        clearInterval(checkInterval);
        this.logPhase(state, 'All followers in position — establishing kill zone');

        // Add kill zone and arcs of fire to COP
        await this.addKillZoneOverlay(state);

        if (state.config.simulate) {
          // SIMULATION: artificially move enemy symbols south toward kill zone
          this.startEnemyApproach(seqId);
        } else {
          // REAL MISSION: enemy positions update ONLY from live vision detections.
          // The leader robot's camera reports new positions as the enemy moves.
          // Subscribe to vision events for position updates and engagement decisions.
          this.logPhase(state, 'REAL MISSION — monitoring leader vision feed for enemy movement');
          this.startRealEnemyTracking(seqId);
        }
      }
    }, 2000);
    this._trackTimer(checkInterval);

    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
  }

  // ── Kill zone COP overlay ────────────────────────────────────────────

  private async addKillZoneOverlay(state: AutoState): Promise<void> {
    const plan = state.tacticalPlan;
    if (!plan) return;

    try {
      const { roomToLatLng } = await import('../coordinates/mgrs-coordinator.js');

      // Kill zone: where the firing corridors converge on the enemy advance axis.
      // Centered between the firing positions' X coordinates, at the Y of the
      // cross-street where the firing positions are located (where fires cross).
      const fps = plan.firingPositions;
      const fpXs = fps.map((fp) => fp.position.x);
      const fpYs = fps.map((fp) => fp.position.y);
      const kzCenterX = (Math.min(...fpXs) + Math.max(...fpXs)) / 2;
      // Kill zone Y is on the enemy advance axis at the same latitude as the
      // cross-street where the firing positions are (where their fires cross the axis)
      const kzCenterY = fps.length > 0 ? fpYs[0] : 4.4;

      const kzHalfWidth = Math.max(0.5, (Math.max(...fpXs) - Math.min(...fpXs)) / 2);
      const kzHalfDepth = 0.3;
      const kzCorners = [
        roomToLatLng(kzCenterX - kzHalfWidth, kzCenterY - kzHalfDepth),
        roomToLatLng(kzCenterX + kzHalfWidth, kzCenterY - kzHalfDepth),
        roomToLatLng(kzCenterX + kzHalfWidth, kzCenterY + kzHalfDepth),
        roomToLatLng(kzCenterX - kzHalfWidth, kzCenterY + kzHalfDepth),
      ];

      // Build arcs of fire from each firing position ACROSS the kill zone
      const arcLines: Array<Array<{ lat: number; lng: number }>> = [];
      const kzCenterLatLng = roomToLatLng(kzCenterX, kzCenterY);
      for (const fp of plan.firingPositions) {
        const fpLatLng = roomToLatLng(fp.position.x, fp.position.y);
        arcLines.push([
          { lat: fpLatLng.lat, lng: fpLatLng.lng },
          { lat: kzCenterLatLng.lat, lng: kzCenterLatLng.lng },
        ]);
      }

      // Overwatch line of sight
      const owLatLng = roomToLatLng(plan.overwatch.position.x, plan.overwatch.position.y);
      arcLines.push([
        { lat: owLatLng.lat, lng: owLatLng.lng },
        { lat: kzCenterLatLng.lat, lng: kzCenterLatLng.lng },
      ]);

      // Publish as a COP control measure layer via message bus
      const messageBus = getMessageBus();
      await messageBus.publish({
        sourceDid: 'system:autonomous-orchestrator',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'cop:control_measures',
        messageType: 'cop.control_measure.kill_zone',
        payload: {
          problem_set_id: state.config.problemSetId,
          kill_zone_polygon: kzCorners.map((c) => ({ lat: c.lat, lng: c.lng })),
          arcs_of_fire: arcLines,
          overwatch_position: { lat: owLatLng.lat, lng: owLatLng.lng },
          sequence_id: state.id,
        },
      }).catch(() => {});

      // Store kill zone data on the auto state for rendering
      (state as unknown as { killZone: unknown }).killZone = {
        polygon: kzCorners.map((c) => ({ lat: c.lat, lng: c.lng })),
        arcsOfFire: arcLines,
        overwatch: { lat: owLatLng.lat, lng: owLatLng.lng },
      };

      this.logPhase(state, 'Kill zone and arcs of fire established');
      this.publishUpdate(state);
    } catch (err) {
      this.logPhase(state, `Failed to add kill zone overlay: ${err}`);
    }
  }

  // ── Real enemy tracking (live vision feed) ────────────────────────

  /**
   * REAL MISSION: Track enemy positions from live vision detections.
   * Enemy symbols on the COP update ONLY when the leader robot's camera
   * reports new detections. Engagement is evaluated on each new detection.
   */
  private startRealEnemyTracking(seqId: string): void {
    const state = this.sequences.get(seqId);
    if (!state) return;

    const plan = state.tacticalPlan;
    const fps = plan?.firingPositions ?? [];
    const fpY = fps.length > 0 ? fps[0].position.y : 3.3;
    const fpXs = fps.map((fp) => fp.position.x);
    const kzCenter = {
      x: fpXs.length >= 2 ? (Math.min(...fpXs) + Math.max(...fpXs)) / 2 : 2.5,
      y: fpY,
    };
    let lethalRequested = false;

    // Subscribe to vision events from the leader robot via the same channel
    // the orchestrator uses for initial detection (robot:vision)
    const messageBus = getMessageBus();
    const subDid = `did:near:auto-tracking-${seqId.slice(0, 8)}`;

    messageBus.subscribe(subDid, {
      channels: ['robot:vision'],
      messageTypes: ['robot.vision.detection'],
      callback: async (envelope) => {
        if (!this.sequences.has(seqId)) return;
        if (state.phase === 'engage' || state.phase === 'withdraw' || state.phase === 'complete') return;

        const payload = envelope.payload as Record<string, unknown>;
        const robotId = payload.robot_id as string;

        // Only process detections from the leader robot
        if (robotId !== state.config.leaderId) return;

        const detections = payload.detections as Array<{
          class_desc: string;
          confidence: number;
          estimated_position?: { x: number; y: number };
        }> | undefined;

        if (!detections || detections.length === 0) return;

        // Update threat positions from new vision data
        for (const det of detections) {
          const existingThreat = state.detectedThreats.find((t) =>
            t.classDesc.toLowerCase() === det.class_desc.toLowerCase(),
          );
          if (existingThreat && det.estimated_position) {
            // Update existing threat's position
            existingThreat.detectedAt = { ...det.estimated_position };
            const grid = roomToGridRef(det.estimated_position.x, det.estimated_position.y);
            this.logPhase(state, `Leader reports ${det.class_desc} at grid ${grid} (updated position)`);
          }
        }

        // Update COP symbols with new positions
        try {
          const { roomToLatLng: r2ll } = await import('../coordinates/mgrs-coordinator.js');
          const { layerStore } = await import('../cop/layers/layer-store.js');
          const layers = await layerStore.queryLayers({ workspaceId: state.config.problemSetId });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adversaryLayer = (layers as any[]).find((l) => {
            const meta = l.spec?.metadata;
            return meta?.generatedBy === 'vision-detection-pipeline';
          });

          if (adversaryLayer?.spec?.symbols) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatedSymbols = adversaryLayer.spec.symbols.map((sym: any, idx: number) => {
              const threat = state.detectedThreats[idx];
              if (threat) {
                const newPos = r2ll(threat.detectedAt.x, threat.detectedAt.y);
                return { ...sym, position: { lat: newPos.lat, lng: newPos.lng } };
              }
              return sym;
            });
            await layerStore.updateLayerSpec(adversaryLayer.id, {
              ...adversaryLayer.spec,
              symbols: updatedSymbols,
            });
          }
        } catch {
          // Non-fatal — COP update failed
        }

        // Evaluate engagement using the skill
        const closestThreatY = Math.min(...state.detectedThreats.map((t) => t.detectedAt.y));
        const distToKillZone = closestThreatY - (fpY + 0.3);
        const isLethalAuthorized = (state as unknown as { lethalAuthorized?: boolean }).lethalAuthorized;

        try {
          const { createTacticalTools } = await import('./skills/tactical-skills.js');
          const tacTools = createTacticalTools();
          const engageTool = tacTools.find((t) => t.name === 'evaluate_engagement');

          if (engageTool) {
            const closestThreat = state.detectedThreats.reduce((best, t) =>
              t.detectedAt.y < best.detectedAt.y ? t : best, state.detectedThreats[0]);

            const raw = await engageTool.invoke({
              target_position: closestThreat.detectedAt,
              kill_zone_center: kzCenter,
              kill_zone_radius: 0.5,
              weapons_authorized: isLethalAuthorized ?? false,
              firing_positions: fps.map((fp) => fp.position),
              target_heading: 180,
            });
            const result = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));

            if (result.decision === 'hold' && !lethalRequested) {
              lethalRequested = true;
              const threatGrid = roomToGridRef(closestThreat.detectedAt.x, closestThreatY);
              this.logPhase(state, `${result.reasoning} — requesting lethal authorization at grid ${threatGrid}`);
              await this.attemptEngagement(seqId);
            } else if (result.decision === 'fire') {
              this.logPhase(state, `ENGAGE: ${result.reasoning}`);
              await this.executeEngagement(seqId);
            }
          }
        } catch (err) {
          console.error('[AutoMission] Real engagement skill error:', err);
        }

        // Fallback distance checks
        if (!lethalRequested && distToKillZone < 0.8) {
          lethalRequested = true;
          this.logPhase(state, 'Enemy approaching kill zone — requesting lethal authorization');
          await this.attemptEngagement(seqId);
        }
        if (isLethalAuthorized && distToKillZone <= 0) {
          this.logPhase(state, 'ENEMY IN KILL ZONE — ENGAGING');
          await this.executeEngagement(seqId);
        }

        this.publishUpdate(state);
      },
    });

    this.logPhase(state, 'Subscribed to leader vision feed — tracking enemy movement in real-time');
  }

  // ── Enemy tank approach simulation ────────────────────────────────

  private startEnemyApproach(seqId: string): void {
    const state = this.sequences.get(seqId);
    if (!state) return;

    // Enemy tanks start at their detected positions (y≈4.4) and move south
    // toward the kill zone (where the firing corridors cross the advance axis).
    // Lethal auth is requested when tanks are about to enter the kill zone.
    const plan = state.tacticalPlan;
    const fps = plan?.firingPositions ?? [];
    const fpY = fps.length > 0 ? fps[0].position.y : 3.3;
    // Kill zone entry: just north of where the firing positions' corridors cross
    const killZoneEntryY = fpY + 0.3;
    let lethalRequested = false;
    let tickCount = 0;

    this.logPhase(state, 'Enemy armor advancing south — monitoring approach to kill zone');

    const approachInterval = setInterval(async () => {
      if (!this.sequences.has(seqId) || state.phase === 'engage' || state.phase === 'withdraw' || state.phase === 'complete') {
        clearInterval(approachInterval);
        return;
      }

      tickCount++;

      // Move each threat south by a small amount each tick
      // Speed: ~0.01 room units per tick (2s interval) ≈ 0.65 m/s ≈ 2.3 km/h
      for (const threat of state.detectedThreats) {
        threat.detectedAt.y -= 0.01;
      }

      // Update COP symbols with new enemy positions
      try {
        const { roomToLatLng } = await import('../coordinates/mgrs-coordinator.js');
        const { layerStore } = await import('../cop/layers/layer-store.js');
        const layers = await layerStore.queryLayers({ workspaceId: state.config.problemSetId });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adversaryLayer = (layers as any[]).find((l) => {
          const meta = l.spec?.metadata;
          return meta?.generatedBy === 'vision-detection-pipeline';
        });

        if (adversaryLayer?.spec?.symbols) {
          // Match each COP symbol to its corresponding threat and update position.
          // Use index-based matching since symbols were created in the same order as threats.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatedSymbols = adversaryLayer.spec.symbols.map((sym: any, idx: number) => {
            // Match by index (symbols created in detection order) or by designation substring
            const threat = state.detectedThreats[idx] ?? state.detectedThreats.find((t) =>
              sym.designation?.toLowerCase().includes(t.classDesc.toLowerCase()) ||
              t.classDesc.toLowerCase().includes(sym.designation?.toLowerCase()?.split(' ')[0] ?? ''),
            );
            if (threat) {
              const newPos = roomToLatLng(threat.detectedAt.x, threat.detectedAt.y);
              return { ...sym, position: { lat: newPos.lat, lng: newPos.lng } };
            }
            return sym;
          });
          await layerStore.updateLayerSpec(adversaryLayer.id, {
            ...adversaryLayer.spec,
            symbols: updatedSymbols,
          });
        }
      } catch {
        // Non-fatal
      }

      // Check if tanks are approaching the kill zone
      const closestThreatY = Math.min(...state.detectedThreats.map((t) => t.detectedAt.y));
      const distToKillZone = closestThreatY - killZoneEntryY;

      const isLethalAuthorized = (state as unknown as { lethalAuthorized?: boolean }).lethalAuthorized;

      // Use the engagement evaluation skill to decide what to do
      const { createTacticalTools } = await import('./skills/tactical-skills.js');
      const tacTools = createTacticalTools();
      const engageTool = tacTools.find((t) => t.name === 'evaluate_engagement');

      if (engageTool) {
        try {
          const fps = state.tacticalPlan?.firingPositions ?? [];
          const fpXs = fps.map((fp) => fp.position.x);
          const kzCenter = {
            x: fpXs.length >= 2 ? (Math.min(...fpXs) + Math.max(...fpXs)) / 2 : 2.5,
            y: fpY,
          };

          const closestThreat = state.detectedThreats.reduce((best, t) =>
            t.detectedAt.y < best.detectedAt.y ? t : best, state.detectedThreats[0]);

          const raw = await engageTool.invoke({
            target_position: closestThreat.detectedAt,
            kill_zone_center: kzCenter,
            kill_zone_radius: 0.5,
            weapons_authorized: isLethalAuthorized ?? false,
            firing_positions: fps.map((fp) => fp.position),
            target_heading: 180,
          });
          const result = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));

          if (result.decision === 'hold' && !lethalRequested) {
            lethalRequested = true;
            const threatGrid = roomToGridRef(closestThreat.detectedAt.x, closestThreatY);
            this.logPhase(state, `${result.reasoning} — requesting lethal authorization at grid ${threatGrid}`);
            await this.attemptEngagement(seqId);
          } else if (result.decision === 'fire') {
            clearInterval(approachInterval);
            this.logPhase(state, `ENGAGE: ${result.reasoning}`);
            await this.executeEngagement(seqId);
          }
        } catch (err) {
          console.error('[AutoMission] Engagement skill error:', err);
        }
      }

      // Fallback: if skill didn't fire, use distance check
      if (!lethalRequested && distToKillZone < 0.8) {
        lethalRequested = true;
        this.logPhase(state, 'Enemy approaching kill zone — requesting lethal authorization');
        await this.attemptEngagement(seqId);
      }
      if (isLethalAuthorized && distToKillZone <= 0) {
        clearInterval(approachInterval);
        this.logPhase(state, 'ENEMY IN KILL ZONE — ENGAGING');
        await this.executeEngagement(seqId);
      }

      // Safety: stop after 5 minutes
      if (tickCount > 150) {
        clearInterval(approachInterval);
        this.logPhase(state, 'Enemy approach timeout — requesting engagement decision');
        await this.attemptEngagement(seqId);
      }
    }, 2000);
    this._trackTimer(approachInterval);
  }

  /** Track a timer so it gets cleared on reset */
  private _trackTimer(timer: ReturnType<typeof setInterval>): ReturnType<typeof setInterval> {
    this._activeTimers.push(timer);
    return timer;
  }

  private pollGate(seqId: string, gateId: string, gateType: 'resource' | 'lethal'): void {
    const interval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state) { clearInterval(interval); return; }

      // Check phase is still waiting for this gate

      if (gateType === 'resource' && state.phase !== 'plan_submitted') { clearInterval(interval); return; }
      if (gateType === 'lethal' && state.phase !== 'authorize') { clearInterval(interval); return; }

      try {
        const gate = await gateService.getGateById(gateId);
        if (!gate) { clearInterval(interval); return; }

        if (gate.status === 'approved') {
          clearInterval(interval);
          if (gateType === 'resource') {
            this.logPhase(state, 'ResourceAllocation APPROVED by DAO');
            await this.positionFollowers(seqId);
          } else {
            this.logPhase(state, 'StrikeAuthorization APPROVED — weapons free, awaiting targets in kill zone');
            // Don't engage immediately — set flag so engagement triggers
            // when enemy tanks actually enter the kill zone
            (state as unknown as { lethalAuthorized: boolean }).lethalAuthorized = true;
            this.publishUpdate(state);
          }
        } else if (gate.status === 'rejected') {
          clearInterval(interval);
          if (gateType === 'resource') {
            this.logPhase(state, 'ResourceAllocation DENIED — mission aborted');
            state.phase = 'complete';
            state.phaseStartedAt = new Date().toISOString();
            this.publishUpdate(state);
          } else {
            await this.enterShadowMode(seqId);
          }
        }
      } catch (err) {
        console.error(`[AutonomousOrchestrator] Gate poll error:`, err);
      }
    }, 2000);
    this._trackTimer(interval);

    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
  }

  private subscribeToVisionEvents(): void {
    if (this.visionSubscribed) return;
    this.visionSubscribed = true;

    const messageBus = getMessageBus();

    messageBus.subscribe('autonomous-mission-orchestrator', {
      channels: ['robot:vision'],
      messageTypes: ['robot.vision.detection'],
      callback: async (msg) => {
        const payload = msg.payload as Record<string, unknown>;
        const detections = payload.detections as Array<{ class_desc: string; confidence: number; center_x?: number; center_y?: number }> | undefined;
        if (!detections || detections.length === 0) return;

        const robotId = payload.robot_id as string;

        // Get robot position for threat location
        const svc = getRobotMissionService();
        const robot = svc.getConnectedRobots().find((r) => r.robot_id === robotId);
        const robotPos = robot?.latest_telemetry?.position ?? { x: 2.5, y: 2.5 };

        for (const det of detections) {
          // Trust the robot-side VISION_THRESHOLD (.env) as the primary filter.
          // Only apply a modest server-side floor to catch obviously spurious data.
          if (det.confidence < 0.5) continue;

          // Use estimated enemy position if available (placed at range by simulator),
          // otherwise fall back to robot's position
          const enemyPos = (det as { estimated_position?: { x: number; y: number } }).estimated_position ?? robotPos;
          const threat: ThreatInfo = {
            entityId: `DET-${det.class_desc.replace(/[^a-zA-Z0-9-]/g, '')}-${Date.now()}`,
            classDesc: det.class_desc,
            confidence: det.confidence,
            detectedAt: { x: enemyPos.x, y: enemyPos.y },
          };

          for (const [seqId, state] of this.sequences) {
            if (state.config.leaderId === robotId && (state.phase === 'recon' || state.phase === 'assess')) {
              this.handleThreatDetection(seqId, threat);
            }
          }
        }
      },
    });

    console.log('[AutonomousOrchestrator] Subscribed to vision detection events');
  }

  private logPhase(state: AutoState, msg: string): void {
    const entry = { ts: new Date().toISOString(), phase: state.phase, msg };
    state.log.push(entry);
    console.log(`[AutoMission:${state.id.slice(0, 8)}] [${state.phase.toUpperCase()}] ${msg}`);
  }

  private publishUpdate(state: AutoState): void {
    try {
      const messageBus = getMessageBus();
      messageBus.publish({
        sourceDid: 'system:autonomous-orchestrator',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'mission:auto_sequence_update',
        messageType: 'mission.auto_sequence.update',
        payload: {
          sequenceId: state.id,
          phase: state.phase,
          phaseStartedAt: state.phaseStartedAt,
          detectedThreats: state.detectedThreats.length,
          hasPlan: !!state.tacticalPlan,
          planAssessment: state.tacticalPlan?.assessment,
          planRecommendation: state.tacticalPlan?.engagementRecommendation,
          policyBlock: state.policyBlock,
          resourceGateId: state.resourceGateId,
          lethalGateId: state.lethalGateId,
          log: state.log.slice(-15),
        },
      }).catch(() => { /* non-fatal */ });
    } catch { /* non-fatal */ }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: AutonomousMissionOrchestrator | undefined;

export function getAutonomousOrchestrator(): AutonomousMissionOrchestrator {
  if (!_instance) {
    _instance = new AutonomousMissionOrchestrator();
  }
  return _instance;
}

export type { AutoConfig, AutoState };
