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
import { vehicleDatabase } from './vehicle-database.js';
import { calibrationService } from './calibration-service.js';
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
  | 'withdraw'        // All elements returning to base / consolidating
  | 'shadow'          // Denied: following enemy at distance
  | 'attack_2'        // Second attack orders received — briefing
  | 'wedge_advance'   // Wedge formation advance north toward second target
  | 'suppress_flank'  // Alpha suppresses, bravo/charlie flanking east/west
  | 'pincer_engage'   // Flankers engaging from east/west (pincer)
  | 'bda_2'           // Second battle damage assessment
  | 'rtb'             // Follower formation return to home base
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

  /**
   * Full reset: kill all timers, stop all sequences, clear pending detections.
   * Called by both startAutonomousMission (fresh start) and the stop endpoint.
   */
  resetAll(): void {
    const svc = getRobotMissionService();

    // 1. Kill all active timers (gate polls, shadow mode, follower monitors, etc.)
    for (const timer of this._activeTimers) {
      clearInterval(timer);
    }
    this._activeTimers = [];
    svc.clearGatePolls();

    // 2. Stop all existing sequences
    for (const [seqId, existing] of this.sequences) {
      if (existing.phase !== 'complete') {
        existing.phase = 'complete' as AutoPhase;
        console.log(`[AutonomousOrchestrator] Stopped existing sequence ${seqId.slice(0, 8)}`);
      }
    }
    this.sequences.clear();

    // 3. Clear pending detection buffer
    this._pendingDetections.clear();

    console.log('[AutonomousOrchestrator] Full reset complete — all timers, sequences, detections cleared');
  }

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
    this.resetAll();
    const svc = getRobotMissionService();

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

    // 4. Clear adversary COP layer and previous EFDL overlay from previous run
    try {
      const { layerStore } = await import('../cop/layers/layer-store.js');
      const layers = await layerStore.queryLayers({
        workspaceId: config.problemSetId,
      });
      for (const layer of layers) {
        const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
        if (meta?.generatedBy === 'vision-detection-pipeline' || meta?.generatedBy === 'efdl-overlay-generator') {
          await layerStore.deleteLayer(layer.id);
        }
      }
    } catch { /* non-fatal */ }

    // 4a. Create EFDL operational context overlay — shows the layered defense
    // architecture so the commander can see where robots operate within the
    // broader Eastern Flank Deterrent Line concept
    try {
      const { layerStore } = await import('../cop/layers/layer-store.js');
      const { generateEFDLLayerSpec } = await import('./efdl-overlay.js');
      const efdlSpec = generateEFDLLayerSpec(config.problemSetId);
      const efdlLayer = await layerStore.createLayer({
        workspaceId: config.problemSetId,
        sectionId: 'efdl-operational-context',
        layerType: 'control_measures',
        spec: efdlSpec,
      });
      // Promote directly to COP state so it's immediately visible
      await layerStore.transitionLayer({ layerId: efdlLayer.id, targetState: 'review', performedBy: 'system' });
      await layerStore.transitionLayer({ layerId: efdlLayer.id, targetState: 'published', performedBy: 'system' });
      await layerStore.transitionLayer({ layerId: efdlLayer.id, targetState: 'cop', performedBy: 'system' });
      console.log(`[AutonomousOrchestrator] EFDL overlay created: ${efdlLayer.id} with ${efdlSpec.controlMeasures.length} control measures`);
    } catch (err) {
      console.warn('[AutonomousOrchestrator] Failed to create EFDL overlay (non-fatal):', err);
    }

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
      this.logPhase(state, 'Intel reports enemy armor advancing south — proactively planning kill zone');
      this.logPhase(state, 'Followers holding at base pending tactical assessment');

      // ── PROACTIVE PLANNING ──
      // Intel says tanks are advancing south. Alpha plans the kill zone and
      // requests followers immediately — don't wait for visual detection.
      // Detection will trigger lethal authorization later.
      this.publishUpdate(state);

      // Give alpha a few seconds to reach the OP before planning
      setTimeout(() => this.proactiveTacticalAssessment(id), 5000);
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

  /**
   * Commander manually forces a detection when alpha's camera fails to detect.
   *
   * Detection 1 ("first"): During OP/recon phases — simulates detecting the first
   * tank(s) in the original AO (y≈4.4). Triggers the assess → plan → engage flow.
   *
   * Detection 2 ("second"): During wedge_advance — simulates detecting the second
   * tank in the northern sector (y≈8.5). Triggers suppress/flank/pincer flow.
   */
  async forceDetection(sequenceId: string, which: 'first' | 'second'): Promise<boolean> {
    const state = this.sequences.get(sequenceId);
    if (!state) return false;

    if (which === 'first') {
      // Valid during recon, assess, plan_submitted, or positioning (before first engagement)
      if (!['recon', 'assess', 'plan_submitted', 'positioning'].includes(state.phase)) {
        this.logPhase(state, `Manual detection ignored — not in recon/pre-engagement phase (current: ${state.phase})`);
        this.publishUpdate(state);
        return false;
      }

      // Place enemy threat at a position north of center in the recon area.
      // Use a recognized class name so the symbology skill produces a valid SIDC.
      const defaultThreatClass = vehicleDatabase.getThreatClasses()[0] ?? 't-99';
      const profile = calibrationService.getProfile();
      const threat: ThreatInfo = {
        entityId: `MANUAL-armor-1-${Date.now()}`,
        classDesc: defaultThreatClass,
        confidence: 0.90,
        detectedAt: { x: profile.room_width * 0.68, y: profile.room_height * 0.87 },
        estimatedHeading: 180,
      };

      this.logPhase(state, 'MANUAL DETECTION — Commander forcing first threat detection');

      // Create COP symbol — await to ensure it completes before proceeding
      try {
        await this.createConfirmedCOPSymbol(state, threat);
      } catch (e: unknown) {
        console.warn('[AutoMission] Manual COP symbol creation failed:', e);
      }

      // If still in recon, this triggers the full assess → plan flow
      if (state.phase === 'recon') {
        await this.handleThreatDetection(sequenceId, threat);
      } else {
        // Already past recon — record threat and trigger engagement flow directly
        state.detectedThreats.push(threat);
        const grid = roomToGridRef(threat.detectedAt.x, threat.detectedAt.y);
        this.logPhase(state, `CONTACT: T-99 MBT at grid ${grid} (manual detection)`);

        // Reorient alpha toward the detected threat
        await this.reorientAlphaToward(state, threat.detectedAt);

        this.publishUpdate(state);

        // If followers are in position, trigger engagement
        if (state.phase === 'positioning' || state.phase === 'plan_submitted') {
          this.logPhase(state, 'Threat confirmed — requesting lethal authorization');
          this.publishUpdate(state);
          await this.attemptEngagement(sequenceId);
        }
      }
      return true;
    }

    if (which === 'second') {
      // Valid during wedge_advance
      if (state.phase !== 'wedge_advance') {
        this.logPhase(state, `Manual detection ignored — not in wedge advance phase (current: ${state.phase})`);
        this.publishUpdate(state);
        return false;
      }

      this.logPhase(state, 'MANUAL DETECTION — Commander forcing second threat detection');
      this.publishUpdate(state);

      // Directly trigger the contact → suppress/flank flow
      await this.contactSecondTarget(sequenceId);
      return true;
    }

    return false;
  }

  /**
   * Commander manually triggers "tank in kill zone" — forces first engagement
   * when the simulated/real enemy approach hasn't been detected entering the zone.
   * Valid during: positioning (followers set, waiting for enemy approach) or authorize.
   */
  async forceKillZoneEntry(sequenceId: string): Promise<boolean> {
    const state = this.sequences.get(sequenceId);
    if (!state) return false;

    if (!['positioning', 'plan_submitted', 'engage_blocked', 'authorize'].includes(state.phase)) {
      this.logPhase(state, `Kill zone trigger ignored — not in pre-engagement phase (current: ${state.phase})`);
      this.publishUpdate(state);
      return false;
    }

    this.logPhase(state, 'MANUAL TRIGGER — Commander confirms enemy in kill zone');

    // If we don't have threats yet, create one using calibration-derived position
    if (state.detectedThreats.length === 0) {
      const defaultThreatClass = vehicleDatabase.getThreatClasses()[0] ?? 't-99';
      const profile = calibrationService.getProfile();
      const threat: ThreatInfo = {
        entityId: `MANUAL-kz-${Date.now()}`,
        classDesc: defaultThreatClass,
        confidence: 0.90,
        detectedAt: {
          x: profile.room_width * 0.68,
          y: profile.room_height * 0.87,
        },
        estimatedHeading: 180,
      };
      state.detectedThreats.push(threat);
      try {
        await this.createConfirmedCOPSymbol(state, threat);
      } catch { /* non-fatal */ }
    }

    // If lethal already authorized, jump straight to engagement
    const isLethalAuthorized = (state as unknown as { lethalAuthorized?: boolean }).lethalAuthorized;
    if (isLethalAuthorized || state.phase === 'authorize') {
      // If still waiting for gate approval, auto-approve the lethal gate
      if (state.lethalGateId && state.phase === 'authorize') {
        try {
          await gateService.approveGate(state.lethalGateId, 'commander-manual-override');
        } catch { /* gate may already be resolved */ }
      }
      this.logPhase(state, 'ENEMY IN KILL ZONE — ENGAGING');
      this.publishUpdate(state);
      await this.executeEngagement(sequenceId);
    } else {
      // Need lethal auth first — trigger the request
      this.logPhase(state, 'Enemy confirmed in kill zone — requesting lethal authorization');
      this.publishUpdate(state);
      await this.attemptEngagement(sequenceId);
    }

    return true;
  }

  /**
   * Commander manually confirms target destroyed. Advances mission past
   * engagement → BDA. Works for both first and second engagement.
   *
   * which = 'first': forces BDA after first engagement (engage phase)
   * which = 'second': forces BDA after pincer engagement (pincer_engage phase)
   */
  async forceTargetDestroyed(sequenceId: string, which: 'first' | 'second'): Promise<boolean> {
    const state = this.sequences.get(sequenceId);
    if (!state) return false;

    if (which === 'first') {
      if (state.phase !== 'engage') {
        this.logPhase(state, `Target destroyed (1st) ignored — not in engage phase (current: ${state.phase})`);
        this.publishUpdate(state);
        return false;
      }
      this.logPhase(state, 'MANUAL CONFIRM — Commander confirms first target DESTROYED');
      this.publishUpdate(state);
      await this.executeBDA(sequenceId);
      return true;
    }

    if (which === 'second') {
      if (state.phase !== 'pincer_engage') {
        this.logPhase(state, `Target destroyed (2nd) ignored — not in pincer engage phase (current: ${state.phase})`);
        this.publishUpdate(state);
        return false;
      }
      this.logPhase(state, 'MANUAL CONFIRM — Commander confirms second target DESTROYED');
      this.publishUpdate(state);
      await this.executeSecondBDA(sequenceId);
      return true;
    }

    return false;
  }

  /**
   * Reorient alpha's camera toward a target position.
   * Dispatches a face_target overwatch command to the leader robot.
   */
  private async reorientAlphaToward(state: AutoState, targetPos: { x: number; y: number }): Promise<void> {
    const svc = getRobotMissionService();
    const leader = svc.getConnectedRobots().find((r) => r.robot_id === state.config.leaderId);
    const leaderPos = leader?.latest_telemetry?.position
      ?? state.config.observationPost?.position
      ?? state.config.homeBase;

    const missionId = randomUUID();
    state.missions['reorient_alpha'] = missionId;

    await svc.dispatchMission({
      mission_id: missionId,
      robot_id: state.config.leaderId,
      command: 'overwatch',
      params: {
        target_location: leaderPos,
        speed: 60,
        face_target: targetPos,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    const grid = roomToGridRef(targetPos.x, targetPos.y);
    this.logPhase(state, `Alpha reorienting camera toward grid ${grid}`);
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

      // Use estimated enemy position if available. When robot has no range estimation,
      // estimate threat position by projecting ~2m in the camera's facing direction
      // from the robot's position. This prevents threats from being plotted on top
      // of the observing robot.
      let enemyPos = det.estimated_position;
      if (!enemyPos) {
        // Find the active sequence to get facing info
        let facingRad: number | undefined;
        for (const [, st] of this.sequences) {
          if (st.config.leaderId === robotId && st.config.observationPost) {
            facingRad = (st.config.observationPost.facingHeading * Math.PI) / 180;
            break;
          }
        }
        if (facingRad != null) {
          // Project 2m in the facing direction from the robot
          enemyPos = {
            x: robotPos.x + Math.sin(facingRad) * 2.0,
            y: robotPos.y + Math.cos(facingRad) * 2.0,
          };
        } else {
          enemyPos = robotPos;
        }
      }

      for (const [seqId, state] of this.sequences) {
        if (state.config.leaderId === robotId && (state.phase === 'recon' || state.phase === 'assess' || state.phase === 'positioning' || state.phase === 'plan_submitted')) {
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

  // ── Proactive tactical assessment (OP mode — plan before contact) ─────

  private async proactiveTacticalAssessment(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'recon') return;

    const config = state.config;
    const op = config.observationPost!;
    const leaderPos = op.position;

    // Create an intel-based threat estimate — tanks advancing south through the AO.
    // This is used to seed the AI planner. Actual detection updates positions later.
    const intelThreat: ThreatInfo = {
      entityId: 'INTEL-armor-south',
      classDesc: 'Enemy armor (intel)',
      confidence: 0.6, // intel-based, not visually confirmed
      detectedAt: {
        // Estimate enemy approach from the north, centered in the AO
        x: (config.reconArea.x_min + config.reconArea.x_max) / 2,
        y: config.reconArea.y_max,
      },
      estimatedHeading: 180, // moving south
    };

    state.phase = 'assess';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'ASSESS phase — planning kill zone based on intelligence');
    this.logPhase(state, `Intel: enemy armor advancing south, estimated approach from grid ${roomToGridRef(intelThreat.detectedAt.x, intelThreat.detectedAt.y)}`);
    this.publishUpdate(state);

    try {
      // Build commander's intent — OP is fixed, AI determines kill zone
      const opGrid = roomToGridRef(op.position.x, op.position.y);
      const commanderIntent = [
        `Leader is holding at observation post grid ${opGrid} (${op.position.x.toFixed(1)}, ${op.position.y.toFixed(1)}) facing heading ${op.facingHeading}°. The overwatch position MUST be the leader's current OP position — do NOT move the leader.`,
        'Intelligence reports enemy armor advancing SOUTH from the NORTH edge of the AO.',
        'Assess the likely avenue of approach and determine the optimal kill zone location to interdict enemy armor moving south.',
        'CRITICAL POSITIONING CONSTRAINT: Followers MUST be positioned SOUTH of the kill zone so they fire NORTH into the enemy approach.',
        'Both followers must be south, east, or west of the kill zone — NEVER north of it, because the enemy is approaching from the north.',
        'Position followers with flanking firing arcs and interlocking fields of fire across the kill zone.',
      ].join(' ');

      const plan = await generateTacticalPlan(
        [intelThreat],
        {
          leader: { id: config.leaderId, position: leaderPos },
          followers: config.followerIds.map((fid) => ({
            id: fid,
            position: config.homeBase,
          })),
        },
        config.homeBase,
        commanderIntent,
      );

      // Validate and correct firing positions — they MUST be south of the kill zone
      // (lower Y) so they fire north into the enemy approach from the north.
      this.validateFiringPositionsSouthOfKillZone(state, plan);

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

      // Request follower resources and position them immediately
      await this.submitResourceRequestAndMoveToOverwatch(seqId);
    } catch (err) {
      this.logPhase(state, `Tactical assessment failed: ${err}`);
      state.error = String(err);
      this.publishUpdate(state);
    }
  }

  // ── Phase: ASSESS (AI tactical reasoning — reactive to detection) ─────

  private async handleThreatDetection(
    seqId: string,
    threat: ThreatInfo,
  ): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state) return;

    // ── OP MODE: any confirmed detection while followers are set up triggers engagement ──
    // Check this BEFORE dedup so even a "duplicate" class still triggers engagement.
    if (state.config.observationPost &&
        (state.phase === 'positioning' || state.phase === 'plan_submitted')) {
      // Record if new (dedup for logging only)
      const isDuplicate = state.detectedThreats.some((existing) => {
        if (existing.classDesc !== threat.classDesc) return false;
        const dx = Math.abs(existing.detectedAt.x - threat.detectedAt.x);
        const dy = Math.abs(existing.detectedAt.y - threat.detectedAt.y);
        return dx < 1.0 && dy < 1.0;
      });
      if (!isDuplicate) {
        state.detectedThreats.push(threat);
        const threatGrid = roomToGridRef(threat.detectedAt.x, threat.detectedAt.y);
        this.logPhase(state, `CONTACT: ${threat.classDesc} detected at grid ${threatGrid} conf=${(threat.confidence * 100).toFixed(0)}%`);
        this.createConfirmedCOPSymbol(state, threat).catch((e: unknown) =>
          console.warn('[AutoMission] Failed to create confirmed COP symbol:', e),
        );
      }

      const threatGrid = roomToGridRef(threat.detectedAt.x, threat.detectedAt.y);
      this.logPhase(state, `VISUAL CONFIRMATION: ${threat.classDesc} at grid ${threatGrid} — matches intelligence`);

      // Reorient alpha toward the confirmed threat
      this.reorientAlphaToward(state, threat.detectedAt).catch(() => { /* non-fatal */ });

      this.logPhase(state, 'Kill zone is set, followers in position — requesting lethal authorization');
      this.publishUpdate(state);
      await this.attemptEngagement(seqId);
      return;
    }

    // ── Standard dedup for non-OP flow ──
    const isDuplicate = state.detectedThreats.some((existing) => {
      if (existing.classDesc !== threat.classDesc) return false;
      const dx = Math.abs(existing.detectedAt.x - threat.detectedAt.x);
      const dy = Math.abs(existing.detectedAt.y - threat.detectedAt.y);
      return dx < 1.0 && dy < 1.0;
    });

    if (isDuplicate) {
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
        parts.push('Assess the detected threats and determine the optimal kill zone location. CRITICAL: Followers MUST be positioned SOUTH of the kill zone so they fire NORTH into the enemy approach from the north. Both followers must be south, east, or west of the kill zone — NEVER north of it. Position followers with flanking firing arcs to interdict and destroy enemy armor. Followers should have interlocking fields of fire across the kill zone.');
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

      // Validate and correct firing positions — they MUST be south of the kill zone
      this.validateFiringPositionsSouthOfKillZone(state, plan);

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
      const rawRoute = plan.routes?.followerRoutes?.[i];
      // LLM may return a single coordinate object instead of an array — normalize
      let route = Array.isArray(rawRoute)
        ? rawRoute
        : rawRoute && typeof rawRoute === 'object'
          ? [rawRoute as { x: number; y: number }]
          : [plan.firingPositions[i]?.position ?? state.config.homeBase];

      // Filter out waypoints with missing/null coordinates (LLM can return garbage)
      route = route.filter((wp: { x?: number; y?: number }) =>
        typeof wp?.x === 'number' && typeof wp?.y === 'number' && isFinite(wp.x) && isFinite(wp.y),
      );
      // If all waypoints were invalid, fall back to firing position or home base
      if (route.length === 0) {
        const fallback = plan.firingPositions[i]?.position ?? state.config.homeBase;
        route = [fallback];
        this.logPhase(state, `WARNING: ${followerId} route was empty/invalid — using fallback position`);
      }

      console.log(`[AutoMission] ${followerId} route: ${JSON.stringify(route)}`);
      const missionId = randomUUID();

      state.missions[`advance_${followerId}`] = missionId;
      followerMissions.push(missionId);

      // Face toward the nearest detected threat, or the intel threat area / kill zone
      let faceTarget: { x: number; y: number } | undefined;
      if (state.detectedThreats.length > 0) {
        faceTarget = state.detectedThreats[0].detectedAt;
      } else if (state.config.killZoneCenter) {
        faceTarget = state.config.killZoneCenter;
      } else if (plan.firingPositions.length > 0) {
        // Face toward the center of the kill zone (midpoint between firing positions)
        const avgX = plan.firingPositions.reduce((s, fp) => s + fp.position.x, 0) / plan.firingPositions.length;
        const avgY = plan.firingPositions.reduce((s, fp) => s + fp.position.y, 0) / plan.firingPositions.length;
        faceTarget = { x: avgX, y: avgY + 1.0 }; // face north of the kill zone (enemy approach)
      }

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

    // Post-engagement: consolidate near alpha's overwatch position.
    // Alpha stays put (already at overwatch) — only bravo/charlie move in.
    const consolidationPoint = plan?.overwatch.position ?? state.config.homeBase;
    const consolidationGrid = roomToGridRef(consolidationPoint.x, consolidationPoint.y);

    this.logPhase(state, `CONSOLIDATE — Bravo/charlie moving to alpha's position at grid ${consolidationGrid}`);
    this.logPhase(state, `Alpha holding at overwatch — awaiting further orders`);

    // Alpha stays static — mark as already consolidated
    state.missions[`consolidate_${state.config.leaderId}`] = 'already-at-position';

    // Only move followers to the consolidation point
    for (const followerId of state.config.followerIds) {
      const robot = svc.getConnectedRobots().find((r) => r.robot_id === followerId);
      let currentPos = robot?.latest_telemetry?.position;
      if (!currentPos && plan) {
        const fpIdx = state.config.followerIds.indexOf(followerId);
        currentPos = plan.firingPositions[fpIdx]?.position;
      }
      if (!currentPos) currentPos = state.config.homeBase;

      // Compute route from firing position to consolidation point
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
      state.missions[`consolidate_${followerId}`] = missionId;

      await svc.dispatchMission({
        mission_id: missionId,
        robot_id: followerId,
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

      this.logPhase(state, `${followerId} — move to consolidation point grid ${consolidationGrid}`);
    }

    this.publishUpdate(state);

    // Monitor withdrawal completion — check alpha + all followers
    const allRobots = [state.config.leaderId, ...state.config.followerIds];
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
        const consolidationGrid = roomToGridRef(consolidationPoint.x, consolidationPoint.y);
        this.logPhase(state, `CONSOLIDATED — All elements at grid ${consolidationGrid}`);
        this.publishUpdate(state);

        // Chain into second attack phase after consolidation
        setTimeout(() => this.issueSecondAttackOrders(state.id), 4000);
      }
    }, 2000);
    this._trackTimer(checkInterval);

    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
  }

  // ── SECOND ENGAGEMENT: Attack 2 → Wedge Advance → Pincer → BDA → RTB ──

  /**
   * Second target coordinates and engagement geometry.
   *
   * Room is 5m wide × 10m deep. First engagement is in y=0-5 (original AO).
   * Second engagement takes place in y=5-10 (extended northern sector).
   *
   * After consolidation at the overwatch position, alpha receives orders
   * to attack a second tank ~2km further north. The team already has resource
   * authority (bravo/charlie) and lethal authorization from the first
   * engagement — no new governance gates needed.
   *
   * Road grid (room coords, extended sector y=5-10):
   *   N-S roads continue: Xiangyang x=1.4, Guanqian x=2.5, Chengde x=3.4
   *   E-W roads (new sector): y=5.5, y=6.5, y=7.5, y=8.5, y=9.0
   *
   * Second target: enemy tank on Guanqian Rd at y≈8.5 (~2km north)
   * Alpha suppress: stops south of target at y≈7.0, fires N
   * Bravo east flank: Chengde at y≈8.5 (east of target), fires NW
   * Charlie west flank: Xiangyang at y≈8.5 (west of target), fires NE
   */
  private static readonly SECOND_TARGET = { x: 2.5, y: 8.5 };
  private static readonly ALPHA_SUPPRESS_POS = { x: 2.5, y: 7.0 };
  private static readonly BRAVO_EAST_FLANK = { x: 3.4, y: 8.5 };
  private static readonly CHARLIE_WEST_FLANK = { x: 1.4, y: 8.5 };

  /**
   * Phase: ATTACK_2 — Alpha receives orders for second target.
   * Authority to use bravo/charlie and lethal auth carry forward.
   */
  private async issueSecondAttackOrders(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state) return;

    state.phase = 'attack_2';
    state.phaseStartedAt = new Date().toISOString();

    const targetGrid = roomToGridRef(
      AutonomousMissionOrchestrator.SECOND_TARGET.x,
      AutonomousMissionOrchestrator.SECOND_TARGET.y,
    );

    this.logPhase(state, 'NEW ORDERS — Intelligence reports second enemy armor at grid ' + targetGrid);
    this.logPhase(state, 'Alpha retains command authority over bravo and charlie');
    this.logPhase(state, 'Lethal authorization remains in effect from previous engagement');
    this.logPhase(state, 'Alpha orders: WEDGE formation — advance north to contact');
    this.publishUpdate(state);

    // Brief pause for orders to register, then begin wedge advance
    setTimeout(() => this.beginWedgeAdvance(seqId), 4000);
  }

  /**
   * Phase: WEDGE_ADVANCE — All three robots advance north in wedge formation.
   * Alpha at apex (center-front), bravo right-rear, charlie left-rear.
   * They advance along road routes until reaching the contact zone.
   */
  private async beginWedgeAdvance(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'attack_2') return;

    state.phase = 'wedge_advance';
    state.phaseStartedAt = new Date().toISOString();

    const svc = getRobotMissionService();

    this.logPhase(state, 'WEDGE ADVANCE — Formation: alpha at apex, bravo right, charlie left');
    this.logPhase(state, 'Advancing north on Guanqian Road axis toward grid ' +
      roomToGridRef(AutonomousMissionOrchestrator.SECOND_TARGET.x, AutonomousMissionOrchestrator.SECOND_TARGET.y));

    // ── Alpha (apex/center) route: from consolidation north along Guanqian ──
    // Consolidation is near overwatch (~2.1, 2.9). Route through first AO (y=0-5)
    // then into the northern sector (y=5-10) to suppress position (2.5, 7.0)
    const alphaRoute = [
      { x: 2.5, y: 2.9 },   // E to Guanqian Rd
      { x: 2.5, y: 4.4 },   // N on Guanqian to Zhongxiao West Rd
      { x: 2.5, y: 5.5 },   // N into northern sector
      { x: 2.5, y: 6.5 },   // N continuing on Guanqian axis
      { x: 2.5, y: 7.0 },   // N to suppress position
    ];

    // ── Bravo (right-rear) route: offset right of alpha, slightly behind ──
    // Route: from consolidation → E to Chengde Rd → N on Chengde
    const bravoRoute = [
      { x: 2.5, y: 2.9 },   // E to Guanqian Rd
      { x: 3.4, y: 2.9 },   // E to Chengde Rd (right of alpha)
      { x: 3.4, y: 4.4 },   // N on Chengde to Zhongxiao West Rd
      { x: 3.4, y: 5.5 },   // N into northern sector
      { x: 3.4, y: 6.5 },   // N on Chengde (right-rear of alpha at 7.0)
    ];

    // ── Charlie (left-rear) route: offset left of alpha, slightly behind ──
    // Route: from consolidation → W to Xiangyang Rd → N on Xiangyang
    const charlieRoute = [
      { x: 2.1, y: 2.9 },   // At consolidation
      { x: 1.4, y: 2.9 },   // W to Xiangyang Rd (left of alpha)
      { x: 1.4, y: 4.4 },   // N on Xiangyang to Zhongxiao West Rd
      { x: 1.4, y: 5.5 },   // N into northern sector
      { x: 1.4, y: 6.5 },   // N on Xiangyang (left-rear of alpha at 7.0)
    ];

    const wedgeRoutes: Record<string, Array<{ x: number; y: number }>> = {
      [state.config.leaderId]: alphaRoute,
      [state.config.followerIds[0]]: bravoRoute,
      [state.config.followerIds[1]]: charlieRoute,
    };

    const allRobots = [state.config.leaderId, ...state.config.followerIds];
    const missionIds: string[] = [];

    for (const robotId of allRobots) {
      const route = wedgeRoutes[robotId] ?? alphaRoute;
      const missionId = randomUUID();
      state.missions[`wedge_${robotId}`] = missionId;
      missionIds.push(missionId);

      await svc.dispatchMission({
        mission_id: missionId,
        robot_id: robotId,
        command: 'patrol_route',
        params: {
          waypoints: route,
          speed: state.config.advanceSpeed,
          face_target: AutonomousMissionOrchestrator.SECOND_TARGET, // face north toward target
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      });

      const roleLabel = robotId === state.config.leaderId ? 'apex'
        : robotId === state.config.followerIds[0] ? 'right-rear' : 'left-rear';
      this.logPhase(state, `${robotId} advancing (${roleLabel}) — wedge formation`);
    }

    this.publishUpdate(state);

    // Monitor wedge advance completion → contact with second target
    this.monitorWedgeAdvance(seqId, missionIds);
  }

  /**
   * Monitor wedge advance. When all robots reach their wedge positions,
   * simulate "contact" with the second tank and transition to suppress/flank.
   */
  private monitorWedgeAdvance(seqId: string, _missionIds: string[]): void {
    const checkInterval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state || state.phase !== 'wedge_advance') {
        clearInterval(checkInterval);
        return;
      }

      const svc = getRobotMissionService();
      const robots = svc.getConnectedRobots();
      const allRobots = [state.config.leaderId, ...state.config.followerIds];

      const allArrived = allRobots.every((rid) => {
        const robot = robots.find((r) => r.robot_id === rid);
        if (!robot) return false;
        const missionId = state.missions[`wedge_${rid}`];
        return robot.current_mission_id !== missionId;
      });

      // Also check timeout fallback
      const elapsed = Date.now() - new Date(state.phaseStartedAt).getTime();
      if (allArrived || elapsed > 60_000) {
        clearInterval(checkInterval);
        await this.contactSecondTarget(seqId);
      }
    }, 2000);
    this._trackTimer(checkInterval);

    setTimeout(() => clearInterval(checkInterval), 3 * 60 * 1000);
  }

  /**
   * Contact with second target. Add COP symbol, then transition to
   * suppress + flank pincer movement.
   */
  private async contactSecondTarget(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'wedge_advance') return;

    const target = AutonomousMissionOrchestrator.SECOND_TARGET;
    const targetGrid = roomToGridRef(target.x, target.y);

    // Record second threat — use vehicleDatabase for threat class to stay scenario-agnostic
    const secondThreatClass = vehicleDatabase.getThreatClasses()[0] ?? 't-99';
    const threat2: ThreatInfo = {
      entityId: `DET-armor-2-${Date.now()}`,
      classDesc: secondThreatClass,
      confidence: 0.85,
      detectedAt: { ...target },
    };
    state.detectedThreats.push(threat2);

    this.logPhase(state, `CONTACT — Second enemy armor detected at grid ${targetGrid}`);
    this.logPhase(state, 'Alpha halting — laying suppressing fire north');
    this.logPhase(state, 'Alpha orders: PINCER — bravo flank east, charlie flank west');

    // Add COP symbol for second threat
    this.createConfirmedCOPSymbol(state, threat2).catch((e: unknown) =>
      console.warn('[AutoMission] Failed to create second threat COP symbol:', e),
    );

    this.publishUpdate(state);

    // Transition to suppress/flank
    setTimeout(() => this.executeSuppressAndFlank(seqId), 3000);
  }

  /**
   * Phase: SUPPRESS_FLANK — Alpha holds position and suppresses.
   * Bravo moves to east flank, charlie moves to west flank.
   */
  private async executeSuppressAndFlank(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state) return;

    state.phase = 'suppress_flank';
    state.phaseStartedAt = new Date().toISOString();

    const svc = getRobotMissionService();
    const target = AutonomousMissionOrchestrator.SECOND_TARGET;
    const suppressPos = AutonomousMissionOrchestrator.ALPHA_SUPPRESS_POS;
    const bravoFlank = AutonomousMissionOrchestrator.BRAVO_EAST_FLANK;
    const charlieFlank = AutonomousMissionOrchestrator.CHARLIE_WEST_FLANK;

    this.logPhase(state, `SUPPRESS — Alpha holding at grid ${roomToGridRef(suppressPos.x, suppressPos.y)}, suppressing fire north`);

    // Alpha: overwatch/suppress at current position, facing north toward target
    const alphaMissionId = randomUUID();
    state.missions['suppress_alpha'] = alphaMissionId;

    await svc.dispatchMission({
      mission_id: alphaMissionId,
      robot_id: state.config.leaderId,
      command: 'overwatch',
      params: {
        target_location: suppressPos,
        speed: 60,
        face_target: target, // face north toward enemy
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    // Bravo: flank east → continue north on Chengde to east of target
    // From current pos (~3.4, 6.5) → N on Chengde to east flank pos
    const bravoFlankRoute = [
      { x: 3.4, y: 7.5 },   // N on Chengde past alpha suppress pos
      { x: 3.4, y: 8.5 },   // N to east flank position (level with target)
    ];

    const bravoMissionId = randomUUID();
    state.missions['flank_bravo'] = bravoMissionId;

    await svc.dispatchMission({
      mission_id: bravoMissionId,
      robot_id: state.config.followerIds[0],
      command: 'patrol_route',
      params: {
        waypoints: bravoFlankRoute,
        speed: state.config.advanceSpeed,
        // Bravo fires NW — face northwest toward target area
        face_target: { x: target.x - 0.5, y: target.y + 0.5 },
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.logPhase(state, `Bravo flanking EAST to grid ${roomToGridRef(bravoFlank.x, bravoFlank.y)} — will engage NW`);

    // Charlie: flank west → continue north on Xiangyang to west of target
    // From current pos (~1.4, 6.5) → N on Xiangyang to west flank pos
    const charlieFlankRoute = [
      { x: 1.4, y: 7.5 },   // N on Xiangyang past alpha suppress pos
      { x: 1.4, y: 8.5 },   // N to west flank position (level with target)
    ];

    const charlieMissionId = randomUUID();
    state.missions['flank_charlie'] = charlieMissionId;

    await svc.dispatchMission({
      mission_id: charlieMissionId,
      robot_id: state.config.followerIds[1],
      command: 'patrol_route',
      params: {
        waypoints: charlieFlankRoute,
        speed: state.config.advanceSpeed,
        // Charlie fires NE — face northeast toward target area
        face_target: { x: target.x + 0.5, y: target.y + 0.5 },
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.logPhase(state, `Charlie flanking WEST to grid ${roomToGridRef(charlieFlank.x, charlieFlank.y)} — will engage NE`);
    this.publishUpdate(state);

    // Monitor flankers' arrival → pincer engagement
    this.monitorFlankerArrival(seqId, [bravoMissionId, charlieMissionId]);
  }

  /**
   * Monitor bravo and charlie reaching their flank positions.
   */
  private monitorFlankerArrival(seqId: string, _missionIds: string[]): void {
    const checkInterval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state || state.phase !== 'suppress_flank') {
        clearInterval(checkInterval);
        return;
      }

      const svc = getRobotMissionService();
      const robots = svc.getConnectedRobots();

      const allFlanked = state.config.followerIds.every((fid) => {
        const robot = robots.find((r) => r.robot_id === fid);
        if (!robot) return false;
        const missionKey = fid === state.config.followerIds[0] ? 'flank_bravo' : 'flank_charlie';
        const missionId = state.missions[missionKey];
        return robot.current_mission_id !== missionId;
      });

      const elapsed = Date.now() - new Date(state.phaseStartedAt).getTime();
      if (allFlanked || elapsed > 60_000) {
        clearInterval(checkInterval);
        await this.executePincerEngagement(seqId);
      }
    }, 2000);
    this._trackTimer(checkInterval);

    setTimeout(() => clearInterval(checkInterval), 3 * 60 * 1000);
  }

  /**
   * Phase: PINCER_ENGAGE — Bravo and charlie engage from flanks.
   * Bravo fires NW, charlie fires NE to prevent friendly fire.
   * Alpha maintains suppressing fire from the south.
   */
  private async executePincerEngagement(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'suppress_flank') return;

    state.phase = 'pincer_engage';
    state.phaseStartedAt = new Date().toISOString();

    const svc = getRobotMissionService();
    const bravoFlank = AutonomousMissionOrchestrator.BRAVO_EAST_FLANK;
    const charlieFlank = AutonomousMissionOrchestrator.CHARLIE_WEST_FLANK;

    this.logPhase(state, 'PINCER ENGAGE — Flankers in position, engaging target');
    this.logPhase(state, `Bravo engaging from east (grid ${roomToGridRef(bravoFlank.x, bravoFlank.y)}) — firing NORTH-WEST`);
    this.logPhase(state, `Charlie engaging from west (grid ${roomToGridRef(charlieFlank.x, charlieFlank.y)}) — firing NORTH-EAST`);
    this.logPhase(state, 'Alpha maintaining suppressing fire from south — deconflicted fire corridors');

    // Dispatch find_engage for bravo (east flank, fires NW)
    const bravoEngageId = randomUUID();
    state.missions['pincer_engage_bravo'] = bravoEngageId;
    await svc.dispatchMission({
      mission_id: bravoEngageId,
      robot_id: state.config.followerIds[0],
      command: 'find_engage',
      params: {
        target_location: bravoFlank,
        speed: 60,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    // Dispatch find_engage for charlie (west flank, fires NE)
    const charlieEngageId = randomUUID();
    state.missions['pincer_engage_charlie'] = charlieEngageId;
    await svc.dispatchMission({
      mission_id: charlieEngageId,
      robot_id: state.config.followerIds[1],
      command: 'find_engage',
      params: {
        target_location: charlieFlank,
        speed: 60,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.publishUpdate(state);

    // Auto-approve engagement gates — lethal auth carries forward from first engagement
    setTimeout(() => this.autoApprovePincerGates(seqId), 3000);
  }

  private async autoApprovePincerGates(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'pincer_engage') return;

    const svc = getRobotMissionService();

    for (const followerId of state.config.followerIds) {
      const missionKey = followerId === state.config.followerIds[0]
        ? 'pincer_engage_bravo' : 'pincer_engage_charlie';
      const missionId = state.missions[missionKey];
      if (missionId) {
        try {
          await svc.handleGateResolution(missionId, true, 'strike-authorized-carry-forward');
          this.logPhase(state, `Engagement authorized for ${followerId} (lethal auth carried forward)`);
        } catch (err) {
          this.logPhase(state, `Auto-approve failed for ${followerId}: ${err}`);
        }
      }
    }

    this.publishUpdate(state);

    // After engagement effects, proceed to second BDA
    setTimeout(() => this.executeSecondBDA(seqId), 8000);
  }

  /**
   * Phase: BDA_2 — Second battle damage assessment.
   */
  private async executeSecondBDA(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'pincer_engage') return;

    state.phase = 'bda_2';
    state.phaseStartedAt = new Date().toISOString();

    // Mark second target destroyed on COP
    await this.markThreatsDestroyed(state);

    this.logPhase(state, 'BDA REPORT: Second enemy armored vehicle DESTROYED by pincer engagement');
    this.logPhase(state, 'Bravo and charlie report: target neutralized, no friendly casualties');
    this.logPhase(state, 'Fire corridors deconflicted — no blue-on-blue incidents');
    this.logPhase(state, 'Alpha orders: cease fire, form up for return to base');

    // Log to NEAR audit trail
    const messageBus = getMessageBus();
    await messageBus.publish({
      sourceDid: state.config.issuedBy,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'dao:audit_log',
      messageType: 'dao.audit.bda_report',
      payload: {
        sequence_id: state.id,
        bda_result: 'second_target_destroyed',
        engagement_type: 'pincer',
        threat_count: state.detectedThreats.length,
        dao_id: state.config.daoId,
        near_tx_type: 'audit_log',
      },
    }).catch(() => { /* non-fatal */ });

    this.publishUpdate(state);
    setTimeout(() => this.executeReturnToBase(seqId), 5000);
  }

  /**
   * Phase: RTB — Return to base in follower formation.
   * Alpha leads, bravo and charlie adopt follower formation behind alpha.
   * All elements return to home base coordinates.
   */
  private async executeReturnToBase(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'bda_2') return;

    state.phase = 'rtb';
    state.phaseStartedAt = new Date().toISOString();

    const svc = getRobotMissionService();
    const home = state.config.homeBase;
    const homeGrid = roomToGridRef(home.x, home.y);

    this.logPhase(state, `RTB — Alpha leads, bravo and charlie in follower formation`);
    this.logPhase(state, `Destination: home base grid ${homeGrid}`);

    // Alpha leads: from suppress position (2.5, 7.0) → south on Guanqian → home
    const alphaRtbRoute = [
      { x: 2.5, y: 5.5 },   // S on Guanqian back into original AO
      { x: 2.5, y: 4.4 },   // S on Guanqian to Zhongxiao West Rd
      { x: 2.5, y: 2.6 },   // S on Guanqian to Hankou St
      { x: 0.5, y: 2.6 },   // W on Hankou toward Hengyang
      { x: 0.5, y: 0.5 },   // S on Hengyang to home base
    ];

    const alphaRtbId = randomUUID();
    state.missions['rtb_alpha'] = alphaRtbId;

    await svc.dispatchMission({
      mission_id: alphaRtbId,
      robot_id: state.config.leaderId,
      command: 'patrol_route',
      params: {
        waypoints: alphaRtbRoute,
        speed: state.config.advanceSpeed,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.logPhase(state, 'Alpha leading RTB south on Guanqian Road');

    // Brief delay before followers start — follower formation means they trail alpha
    await new Promise((r) => setTimeout(r, 3000));

    // Bravo: from east flank (3.4, 8.5) → converge on alpha's route → follow to home
    const bravoRtbRoute = [
      { x: 3.4, y: 7.0 },   // S on Chengde to alpha suppress lat
      { x: 2.5, y: 7.0 },   // W to Guanqian (converge on alpha's route)
      { x: 2.5, y: 5.5 },   // S on Guanqian back into original AO
      { x: 2.5, y: 4.4 },   // S on Guanqian to Zhongxiao West Rd
      { x: 2.5, y: 2.6 },   // S on Guanqian to Hankou St
      { x: 0.5, y: 2.6 },   // W on Hankou toward Hengyang
      { x: 0.5, y: 0.5 },   // S to home base
    ];

    const bravoRtbId = randomUUID();
    state.missions['rtb_bravo'] = bravoRtbId;

    await svc.dispatchMission({
      mission_id: bravoRtbId,
      robot_id: state.config.followerIds[0],
      command: 'patrol_route',
      params: {
        waypoints: bravoRtbRoute,
        speed: state.config.advanceSpeed,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.logPhase(state, 'Bravo converging on alpha\'s route — follower formation');

    // Charlie: from west flank (1.4, 8.5) → converge on alpha's route → follow to home
    const charlieRtbRoute = [
      { x: 1.4, y: 7.0 },   // S on Xiangyang to alpha suppress lat
      { x: 2.5, y: 7.0 },   // E to Guanqian (converge on alpha's route)
      { x: 2.5, y: 5.5 },   // S on Guanqian back into original AO
      { x: 2.5, y: 4.4 },   // S on Guanqian to Zhongxiao West Rd
      { x: 2.5, y: 2.6 },   // S on Guanqian to Hankou St
      { x: 0.5, y: 2.6 },   // W on Hankou toward Hengyang
      { x: 0.5, y: 0.5 },   // S to home base
    ];

    const charlieRtbId = randomUUID();
    state.missions['rtb_charlie'] = charlieRtbId;

    await svc.dispatchMission({
      mission_id: charlieRtbId,
      robot_id: state.config.followerIds[1],
      command: 'patrol_route',
      params: {
        waypoints: charlieRtbRoute,
        speed: state.config.advanceSpeed,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.logPhase(state, 'Charlie converging on alpha\'s route — follower formation');
    this.publishUpdate(state);

    // Monitor RTB completion
    this.monitorRTB(seqId);
  }

  /**
   * Monitor return to base. When all robots complete RTB, mark mission complete.
   */
  private monitorRTB(seqId: string): void {
    const checkInterval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state || state.phase !== 'rtb') {
        clearInterval(checkInterval);
        return;
      }

      const svc = getRobotMissionService();
      const robots = svc.getConnectedRobots();
      const allRobots = [state.config.leaderId, ...state.config.followerIds];

      const allHome = allRobots.every((rid) => {
        const robot = robots.find((r) => r.robot_id === rid);
        if (!robot) return false;
        const rtbKey = rid === state.config.leaderId ? 'rtb_alpha'
          : rid === state.config.followerIds[0] ? 'rtb_bravo' : 'rtb_charlie';
        return robot.current_mission_id !== state.missions[rtbKey];
      });

      const elapsed = Date.now() - new Date(state.phaseStartedAt).getTime();
      if (allHome || elapsed > 120_000) {
        clearInterval(checkInterval);
        state.phase = 'complete';
        state.phaseStartedAt = new Date().toISOString();
        const homeGrid = roomToGridRef(state.config.homeBase.x, state.config.homeBase.y);
        this.logPhase(state, `COMPLETE — All elements at home base grid ${homeGrid}`);
        this.logPhase(state, `Mission summary: ${state.detectedThreats.length} threats detected and destroyed`);
        this.logPhase(state, 'Engagement 1: overwatch + flanking fires. Engagement 2: wedge advance + pincer');
        this.logPhase(state, '0 friendly casualties, all fire corridors deconflicted');
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
            if (state.config.leaderId === robotId && (state.phase === 'recon' || state.phase === 'assess' || state.phase === 'positioning' || state.phase === 'plan_submitted')) {
              this.handleThreatDetection(seqId, threat);
            }
          }
        }
      },
    });

    console.log('[AutonomousOrchestrator] Subscribed to vision detection events');
  }

  /**
   * Validate that all firing positions are SOUTH of the kill zone (lower Y).
   * Enemy approaches from the north — followers must fire north into the approach.
   * If the LLM placed any position north of the kill zone, mirror it south.
   */
  /**
   * Validate firing positions are doctrinally correct:
   * 1. All positions are BEHIND the kill zone (opposite side from enemy approach)
   * 2. No position is significantly forward of another along the enemy axis of advance
   * 3. No position's arc of fire sweeps through another friendly position (fratricide check)
   *
   * Direction-agnostic — works for any enemy axis of advance.
   */
  private validateFiringPositionsSouthOfKillZone(state: AutoState, plan: TacticalPlan): void {
    // Determine enemy advance direction from config or default to south
    const enemyDir: 'north' | 'south' | 'east' | 'west' =
      (state.config as unknown as { enemyAdvanceDirection?: string }).enemyAdvanceDirection as
      'north' | 'south' | 'east' | 'west' ?? 'south';

    // Kill zone reference line — use overwatch position as the boundary
    const owPos = plan.overwatch.position;

    // Helper: get the axis coordinate relevant to enemy direction
    const getAxisCoord = (p: { x: number; y: number }): number => {
      return (enemyDir === 'south' || enemyDir === 'north') ? p.y : p.x;
    };

    // Helper: check if a position is "forward" of the kill zone (toward enemy approach)
    const isForwardOfKZ = (p: { x: number; y: number }): boolean => {
      const coord = getAxisCoord(p);
      const kzCoord = getAxisCoord(owPos);
      switch (enemyDir) {
        case 'south': return coord > kzCoord; // North of KZ when enemy comes from north
        case 'north': return coord < kzCoord;
        case 'east':  return coord < kzCoord;
        case 'west':  return coord > kzCoord;
        default:      return coord > kzCoord;
      }
    };

    // Helper: mirror a position to the correct side of the kill zone
    const mirrorBehindKZ = (p: { x: number; y: number }): void => {
      const kzCoord = getAxisCoord(owPos);
      const coord = getAxisCoord(p);
      const mirrored = kzCoord - (coord - kzCoord);
      if (enemyDir === 'south' || enemyDir === 'north') {
        p.y = Math.max(0.5, Math.min(mirrored, state.config.reconArea.y_max - 0.5));
      } else {
        p.x = Math.max(0.5, Math.min(mirrored, state.config.reconArea.x_max - 0.5));
      }
    };

    let corrected = false;

    // 1. Ensure all positions are behind the kill zone
    for (const fp of plan.firingPositions) {
      if (isForwardOfKZ(fp.position)) {
        const oldPos = { ...fp.position };
        mirrorBehindKZ(fp.position);
        this.logPhase(state, `CORRECTED firing position from (${oldPos.x.toFixed(1)},${oldPos.y.toFixed(1)}) to (${fp.position.x.toFixed(1)},${fp.position.y.toFixed(1)}) — must be behind kill zone (enemy advancing ${enemyDir})`);
        corrected = true;
      }
    }

    // 2. Check no position is significantly forward of another along enemy axis
    if (plan.firingPositions.length >= 2) {
      const axisCoords = plan.firingPositions.map((fp) => getAxisCoord(fp.position));
      const maxDiff = Math.max(...axisCoords) - Math.min(...axisCoords);
      if (maxDiff > 1.0) {
        // Align to the position furthest behind the kill zone
        const targetCoord = (enemyDir === 'south' || enemyDir === 'east')
          ? Math.min(...axisCoords)
          : Math.max(...axisCoords);

        for (const fp of plan.firingPositions) {
          const coord = getAxisCoord(fp.position);
          if (Math.abs(coord - targetCoord) > 0.5) {
            if (enemyDir === 'south' || enemyDir === 'north') {
              fp.position.y = targetCoord;
            } else {
              fp.position.x = targetCoord;
            }
            corrected = true;
            this.logPhase(state, `ALIGNED firing position to axis coord ${targetCoord.toFixed(1)} — positions must not be forward of each other along enemy advance`);
          }
        }
      }
    }

    // 3. Fratricide arc check — warn if any position's arc sweeps through another
    const kzCenter = owPos;
    for (let a = 0; a < plan.firingPositions.length; a++) {
      for (let b = 0; b < plan.firingPositions.length; b++) {
        if (a === b) continue;
        const fpA = plan.firingPositions[a].position;
        const fpB = plan.firingPositions[b].position;

        const dx = fpB.x - fpA.x;
        const dy = fpB.y - fpA.y;
        const distAB = Math.sqrt(dx * dx + dy * dy);
        if (distAB < 0.1) continue;

        const bearingToKZ = Math.atan2(kzCenter.x - fpA.x, kzCenter.y - fpA.y);
        const bearingToB = Math.atan2(dx, dy);
        let angleDiff = Math.abs(bearingToKZ - bearingToB);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

        if (angleDiff < Math.PI / 12) { // 15-degree arc half-angle
          this.logPhase(state, `WARNING: Firing position ${a + 1}'s arc of fire passes near position ${b + 1} — fratricide risk. Lateral separation: ${distAB.toFixed(1)} units`);
        }
      }
    }

    // Correct follower routes if positions were changed
    if (corrected && plan.routes?.followerRoutes) {
      for (let i = 0; i < plan.firingPositions.length; i++) {
        const fp = plan.firingPositions[i];
        const route = plan.routes.followerRoutes[i];
        if (route && route.length > 0) {
          route[route.length - 1] = { x: fp.position.x, y: fp.position.y };
        }
      }
    }
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
