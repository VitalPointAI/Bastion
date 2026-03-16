/**
 * Mission Sequence Orchestrator
 *
 * Choreographs multi-phase robot missions by dispatching individual missions
 * in sequence based on state transitions and vision events.
 *
 * The "Iron Bastion" scenario:
 *   1. HOLD       — All robots at home base
 *   2. RECON      — Leader sweeps AO; followers hold at base
 *   3. CONTACT    — Leader's vision detects enemy tanks → adversary COP updated
 *   4. OVERWATCH  — Leader takes overwatch position
 *   5. ADVANCE    — Followers move to firing positions
 *   6. SET        — Followers in position, report ready
 *   7. AUTHORIZE  — Lethal force governance gate created
 *   8. ENGAGE     — On approval, followers engage (red LED flash)
 */

import { randomUUID } from 'crypto';
import { getRobotMissionService } from './robot-mission-service.js';
import { gateService } from '../gates/gate-service.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SequencePhase =
  | 'idle'
  | 'hold'
  | 'recon'
  | 'contact'
  | 'overwatch'
  | 'advance'
  | 'set'
  | 'authorize'
  | 'engage'
  | 'complete';

interface SequenceConfig {
  /** Robot IDs */
  leaderId: string;
  followerIds: string[];
  /** Problem set for traceability */
  problemSetId: string;
  /** Room-space coordinates (meters, 0-5 range in 5x5m room) */
  homeBase: { x: number; y: number };
  /** Bounding box for recon sweep */
  reconArea: { x_min: number; y_min: number; x_max: number; y_max: number };
  /** Leader overwatch position after contact */
  overwatchPosition: { x: number; y: number };
  /** Follower firing positions (one per follower) */
  firingPositions: Array<{ x: number; y: number }>;
  /** Speeds */
  reconSpeed: number;
  advanceSpeed: number;
  /** Issued by DID */
  issuedBy: string;
}

interface SequenceState {
  id: string;
  phase: SequencePhase;
  startedAt: string;
  phaseStartedAt: string;
  config: SequenceConfig;
  /** Mission IDs dispatched per phase */
  missions: Record<string, string>;  // key = "recon_leader" etc, value = mission_id
  /** Detected threat entity IDs from vision pipeline */
  detectedThreats: string[];
  /** Gate ID for lethal force authorization */
  gateId?: string;
  /** Error message if failed */
  error?: string;
  log: Array<{ ts: string; msg: string }>;
}

// ---------------------------------------------------------------------------
// Default Iron Bastion scenario coordinates
// ---------------------------------------------------------------------------

const IRON_BASTION_DEFAULTS: SequenceConfig = {
  leaderId: 'alpha',
  followerIds: ['bravo', 'charlie'],
  problemSetId: 'default',
  // Home base: southwest corner of room
  homeBase: { x: 0.5, y: 0.5 },
  // Recon area: northeast quadrant where tanks are expected
  //   Expected enemy positions: T1 ~(3.5, 4.0), T2 ~(4.0, 3.5)
  reconArea: { x_min: 2.5, y_min: 2.5, x_max: 4.5, y_max: 4.5 },
  // Overwatch: SW of tanks, offset west so NOT in any follower firing line
  //   Fire line check: F1→T1 crosses x≈3.1 at this y, F2→T2 crosses x≈4.0
  //   Overwatch at x=1.5 is well clear of both firing corridors
  overwatchPosition: { x: 1.5, y: 3.5 },
  // Flanking positions: followers approach from the south, 2m apart
  //   F1 fires NE toward T1 (3.5,4.0), F2 fires NW toward T2 (4.0,3.5)
  //   Neither firing line passes near overwatch (1.5, 3.5)
  firingPositions: [
    { x: 2.5, y: 1.5 },  // F1 (bravo)  — south-center, flanking shot NE
    { x: 4.5, y: 1.5 },  // F2 (charlie) — south-east, flanking shot NW
  ],
  reconSpeed: 80,    // Slow for stealth recon
  advanceSpeed: 120, // Moderate for tactical advance
  issuedBy: 'did:near:bastion.testnet',
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

class MissionSequenceOrchestrator extends EventEmitter {
  private sequences: Map<string, SequenceState> = new Map();
  private visionSubscribed = false;

  /**
   * Start the Iron Bastion scenario with optional config overrides.
   */
  async startIronBastion(
    overrides?: Partial<SequenceConfig>,
  ): Promise<{ sequenceId: string; state: SequenceState }> {
    const config: SequenceConfig = { ...IRON_BASTION_DEFAULTS, ...overrides };
    const id = randomUUID();

    const state: SequenceState = {
      id,
      phase: 'hold',
      startedAt: new Date().toISOString(),
      phaseStartedAt: new Date().toISOString(),
      config,
      missions: {},
      detectedThreats: [],
      log: [],
    };

    this.sequences.set(id, state);
    this.logPhase(state, 'Sequence started — HOLD phase');

    // Subscribe to vision events if not already
    this.subscribeToVisionEvents();

    // Publish sequence start event for frontend
    this.publishUpdate(state);

    // Auto-advance to RECON after a brief hold (3 seconds for demo pacing)
    setTimeout(() => this.advanceToRecon(id), 3000);

    return { sequenceId: id, state };
  }

  /**
   * Get current state of a sequence.
   */
  getState(sequenceId: string): SequenceState | undefined {
    return this.sequences.get(sequenceId);
  }

  /**
   * List all sequences.
   */
  listSequences(): SequenceState[] {
    return [...this.sequences.values()];
  }

  // ── Phase Transitions ──────────────────────────────────────────────────

  private async advanceToRecon(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'hold') return;

    state.phase = 'recon';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'RECON phase — Leader deploying for area reconnaissance');

    const svc = getRobotMissionService();

    // Dispatch overwatch at home base for each follower (hold in place)
    for (const followerId of state.config.followerIds) {
      const missionId = randomUUID();
      state.missions[`hold_${followerId}`] = missionId;

      await svc.dispatchMission({
        mission_id: missionId,
        robot_id: followerId,
        command: 'overwatch',
        params: {
          target_location: state.config.homeBase,
          speed: 60,
          duration_sec: 600, // 10 min hold
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      });

      this.logPhase(state, `Follower ${followerId} holding at base (mission ${missionId.slice(0, 8)})`);
    }

    // Dispatch recon_area to leader
    const reconMissionId = randomUUID();
    state.missions['recon_leader'] = reconMissionId;

    await svc.dispatchMission({
      mission_id: reconMissionId,
      robot_id: state.config.leaderId,
      command: 'recon_area',
      params: {
        area: state.config.reconArea,
        speed: state.config.reconSpeed,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
        profile_name: 'stealth_recon',
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.logPhase(state, `Leader ${state.config.leaderId} dispatched for recon (mission ${reconMissionId.slice(0, 8)})`);
    this.publishUpdate(state);
  }

  /**
   * Called when the vision pipeline detects a threat during this sequence.
   * Triggers transition from RECON → CONTACT → OVERWATCH.
   */
  async handleThreatDetection(
    seqId: string,
    threatEntityId: string,
    threatDesignation: string,
  ): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || (state.phase !== 'recon' && state.phase !== 'contact')) return;

    // Record detection
    if (!state.detectedThreats.includes(threatEntityId)) {
      state.detectedThreats.push(threatEntityId);
    }

    if (state.phase === 'recon') {
      // First contact — transition to CONTACT phase
      state.phase = 'contact';
      state.phaseStartedAt = new Date().toISOString();
      this.logPhase(state, `CONTACT — Threat detected: ${threatDesignation} (${threatEntityId})`);
      this.publishUpdate(state);

      // Advance to overwatch after brief pause (let COP update render)
      setTimeout(() => this.advanceToOverwatch(seqId), 5000);
    } else {
      // Additional detections during contact phase
      this.logPhase(state, `Additional threat: ${threatDesignation} (${threatEntityId})`);
      this.publishUpdate(state);
    }
  }

  private async advanceToOverwatch(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'contact') return;

    state.phase = 'overwatch';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'OVERWATCH phase — Leader assuming overwatch position');

    const svc = getRobotMissionService();

    // Dispatch overwatch to leader at overwatch position
    const owMissionId = randomUUID();
    state.missions['overwatch_leader'] = owMissionId;

    await svc.dispatchMission({
      mission_id: owMissionId,
      robot_id: state.config.leaderId,
      command: 'overwatch',
      params: {
        target_location: state.config.overwatchPosition,
        speed: state.config.reconSpeed,
        duration_sec: 300, // Hold overwatch for 5 min or until sequence ends
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    this.logPhase(state, `Leader moving to overwatch at (${state.config.overwatchPosition.x}, ${state.config.overwatchPosition.y})`);
    this.publishUpdate(state);

    // Advance followers after leader reaches overwatch (8s travel time estimate)
    setTimeout(() => this.advanceFollowers(seqId), 8000);
  }

  private async advanceFollowers(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'overwatch') return;

    state.phase = 'advance';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'ADVANCE phase — Followers moving to firing positions');

    const svc = getRobotMissionService();

    const followerMissions: string[] = [];

    for (let i = 0; i < state.config.followerIds.length; i++) {
      const followerId = state.config.followerIds[i];
      const firingPos = state.config.firingPositions[i] ?? state.config.firingPositions[0];
      const missionId = randomUUID();

      state.missions[`advance_${followerId}`] = missionId;
      followerMissions.push(missionId);

      await svc.dispatchMission({
        mission_id: missionId,
        robot_id: followerId,
        command: 'patrol_route',
        params: {
          waypoints: [firingPos],
          speed: state.config.advanceSpeed,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      });

      this.logPhase(state, `Follower ${followerId} advancing to firing position (${firingPos.x}, ${firingPos.y})`);
    }

    this.publishUpdate(state);

    // Monitor follower missions for completion → SET phase
    this.monitorFollowerArrival(seqId, followerMissions);
  }

  /**
   * Poll mission states until all followers complete their advance.
   */
  private monitorFollowerArrival(seqId: string, missionIds: string[]): void {
    const checkInterval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state || state.phase !== 'advance') {
        clearInterval(checkInterval);
        return;
      }

      const svc = getRobotMissionService();
      const robots = svc.getConnectedRobots();

      // Check if all followers have completed their advance mission
      // (current_mission_id is cleared when mission completes)
      const allArrived = state.config.followerIds.every((fid) => {
        const robot = robots.find((r) => r.robot_id === fid);
        if (!robot) return false;
        // Mission complete when state is not executing for the advance mission
        const advanceMissionId = state.missions[`advance_${fid}`];
        return robot.current_mission_id !== advanceMissionId;
      });

      if (allArrived) {
        clearInterval(checkInterval);
        await this.advanceToSet(seqId);
      }
    }, 2000);

    // Safety timeout
    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
  }

  private async advanceToSet(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'advance') return;

    state.phase = 'set';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'SET phase — All followers in firing position, requesting authorization');
    this.publishUpdate(state);

    // Brief pause then create governance gate
    setTimeout(() => this.requestAuthorization(seqId), 3000);
  }

  private async requestAuthorization(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'set') return;

    state.phase = 'authorize';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'AUTHORIZE phase — Lethal force governance proposal submitted');

    const svc = getRobotMissionService();

    // Create lethal escalation gate using the detected threat
    const threatId = state.detectedThreats[0] ?? 'unknown-threat';
    const threatDesignation = state.detectedThreats.length > 1
      ? `${state.detectedThreats.length} hostile armored vehicles`
      : 'Hostile armored vehicle';

    // Use the leader's recon mission for context
    const contextMissionId = state.missions['recon_leader'] ?? randomUUID();

    try {
      const gateId = await svc.createLethalEscalationGate(
        contextMissionId,
        `team-${state.config.leaderId}`,
        threatId,
        threatDesignation,
        state.config.problemSetId,
      );

      state.gateId = gateId;
      this.logPhase(state, `Governance gate ${gateId.slice(0, 8)} created — awaiting commander decision`);
      this.publishUpdate(state);

      // Poll for gate resolution
      this.pollGateForEngagement(seqId, gateId);
    } catch (err) {
      this.logPhase(state, `Failed to create governance gate: ${err}`);
      state.error = String(err);
      this.publishUpdate(state);
    }
  }

  private pollGateForEngagement(seqId: string, gateId: string): void {
    const interval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state || state.phase !== 'authorize') {
        clearInterval(interval);
        return;
      }

      try {
        const gate = await gateService.getGateById(gateId);
        if (!gate) {
          clearInterval(interval);
          return;
        }

        if (gate.status === 'approved') {
          clearInterval(interval);
          await this.executeEngagement(seqId);
        } else if (gate.status === 'rejected') {
          clearInterval(interval);
          state.phase = 'complete';
          state.phaseStartedAt = new Date().toISOString();
          this.logPhase(state, 'Authorization DENIED — mission aborted');
          this.publishUpdate(state);
        }
      } catch (err) {
        console.error(`[MissionSequenceOrchestrator] Gate poll error:`, err);
      }
    }, 2000);

    // Safety timeout
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
  }

  private async executeEngagement(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'authorize') return;

    state.phase = 'engage';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'ENGAGE phase — Authorization APPROVED — engaging targets');

    const svc = getRobotMissionService();

    // Dispatch find_engage to each follower at their current position
    for (let i = 0; i < state.config.followerIds.length; i++) {
      const followerId = state.config.followerIds[i];
      const firingPos = state.config.firingPositions[i] ?? state.config.firingPositions[0];
      const missionId = randomUUID();

      state.missions[`engage_${followerId}`] = missionId;

      await svc.dispatchMission({
        mission_id: missionId,
        robot_id: followerId,
        command: 'find_engage',
        params: {
          target_location: firingPos, // Already at position
          speed: 60,
          autonomy_policy: { max_speed: 255, restricted_actions: [] },
        },
        issued_by: state.config.issuedBy,
        timestamp: new Date().toISOString(),
        problem_set_id: state.config.problemSetId,
      });

      this.logPhase(state, `Follower ${followerId} engaging target`);
    }

    this.publishUpdate(state);

    // The find_engage missions will enter awaiting_auth state.
    // Since the governance gate is already approved, auto-approve the
    // individual robot auth gates.
    setTimeout(() => this.autoApproveEngagementGates(seqId), 3000);
  }

  private async autoApproveEngagementGates(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'engage') return;

    const svc = getRobotMissionService();

    // For each follower's engage mission, approve the auth gate
    for (const followerId of state.config.followerIds) {
      const missionId = state.missions[`engage_${followerId}`];
      if (missionId) {
        try {
          await svc.handleGateResolution(missionId, true, 'governance-approved');
          this.logPhase(state, `Engagement authorized for ${followerId}`);
        } catch (err) {
          this.logPhase(state, `Auto-approve failed for ${followerId}: ${err}`);
        }
      }
    }

    this.publishUpdate(state);

    // Monitor for completion
    setTimeout(() => {
      if (state.phase === 'engage') {
        state.phase = 'complete';
        state.phaseStartedAt = new Date().toISOString();
        this.logPhase(state, 'COMPLETE — All targets engaged, mission sequence finished');
        this.publishUpdate(state);
      }
    }, 10000);
  }

  // ── Vision Event Subscription ──────────────────────────────────────────

  private subscribeToVisionEvents(): void {
    if (this.visionSubscribed) return;
    this.visionSubscribed = true;

    const messageBus = getMessageBus();

    // Subscribe to vision detection events on the robot:vision channel
    messageBus.subscribe('mission-sequence-orchestrator', {
      channels: ['robot:vision'],
      messageTypes: ['robot.vision.detection'],
      callback: async (msg) => {
        if (msg.messageType !== 'robot.vision.detection') return;

        const payload = msg.payload as Record<string, unknown>;
        const detections = (payload as Record<string, unknown>).detections as Array<{ class_desc: string; confidence: number }> | undefined;
        if (!detections || detections.length === 0) return;

        // Check if any detection is a threat class
        const threatClasses = ['t-90', 't90', 'chn-99g', 'chn99g', 'tank', 'military vehicle',
          'armored vehicle', 't-99', 'zbd-04', 'zbd04', 'btr-82', 'btr82', 'type99', 'ztz99'];

        const threats = detections.filter((d) =>
          threatClasses.includes(d.class_desc.toLowerCase().replace(/[^a-z0-9 -]/g, '')),
        );
        if (threats.length === 0) return;

        const robotId = (payload as Record<string, unknown>).robot_id as string;

        // Find active sequences where this robot is the leader in recon/contact
        for (const [seqId, state] of this.sequences) {
          if (
            state.config.leaderId === robotId &&
            (state.phase === 'recon' || state.phase === 'contact')
          ) {
            for (const threat of threats) {
              const entityId = `DET-${threat.class_desc.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
              this.handleThreatDetection(seqId, entityId, threat.class_desc);
            }
          }
        }
      },
    });

    console.log('[MissionSequenceOrchestrator] Subscribed to vision detection events');
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private logPhase(state: SequenceState, msg: string): void {
    const entry = { ts: new Date().toISOString(), msg };
    state.log.push(entry);
    console.log(`[MissionSequence:${state.id.slice(0, 8)}] [${state.phase.toUpperCase()}] ${msg}`);
  }

  private publishUpdate(state: SequenceState): void {
    try {
      const messageBus = getMessageBus();
      messageBus.publish({
        sourceDid: 'system:mission-orchestrator',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'mission:sequence_update',
        messageType: 'mission.sequence.update',
        payload: {
          sequenceId: state.id,
          phase: state.phase,
          phaseStartedAt: state.phaseStartedAt,
          detectedThreats: state.detectedThreats,
          gateId: state.gateId,
          missions: state.missions,
          log: state.log.slice(-10), // Last 10 entries
        },
      }).catch(() => { /* non-fatal */ });
    } catch { /* non-fatal */ }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _orchestrator: MissionSequenceOrchestrator | undefined;

export function getMissionSequenceOrchestrator(): MissionSequenceOrchestrator {
  if (!_orchestrator) {
    _orchestrator = new MissionSequenceOrchestrator();
  }
  return _orchestrator;
}

export type { SequenceConfig, SequenceState };
