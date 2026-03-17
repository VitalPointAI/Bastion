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
  | 'bda'
  | 'withdraw'
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

  // ── All positions mapped to actual Taipei Zhongzheng District streets ──
  // Room 5×5m → geo via calibration-profiles.json (25.042-25.048°N, 121.512-121.518°E)
  //
  // Road grid (room coords):
  //   N-S: Hengyang Rd x=0.3, Xiangyang Rd x=1.4, Guanqian Rd x=2.5,
  //        Chongqing S Rd x=1.1, Chengde Rd x=3.4, Gongyuan Rd x=4.4
  //   E-W: Wuchang St y=1.7, Nanyang St y=2.0, Hankou St y=2.6,
  //        Xuchang St y=2.9, Kaifeng St y=3.3, Zhongxiao W Rd y=4.4
  //
  // Enemy tanks advancing south on Zhongxiao West Rd (y≈4.4):
  //   T1 on Chengde Rd (3.4, 4.4), T2 on Chongqing S Rd (1.1, 4.4)

  // Home base: Hengyang Road south end
  homeBase: { x: 0.3, y: 0.5 },

  // Recon area: northern half — sweep streets where tanks are expected
  reconArea: { x_min: 0.5, y_min: 2.5, x_max: 4.5, y_max: 4.8 },

  // Overwatch: Changyang Parking Tower on Guanqian Rd — multi-storey ELEVATED
  // position with sight lines north to Zhongxiao West Rd
  // Fire line check:
  //   F1 (1.4,2.0)→T2 (1.1,4.4): at OW y=2.9 → x≈1.27, OW x=2.1 → 0.8m clear ✓
  //   F2 (3.4,3.3)→T1 (3.4,4.4): at OW y=2.9 → x=3.4,  OW x=2.1 → 1.3m clear ✓
  overwatchPosition: { x: 2.1, y: 2.9 },

  // Firing positions: on real intersections, flanking the enemy axis
  //   F1: Xiangyang Rd / Nanyang St intersection — fires N toward T2
  //   F2: Chengde Rd / Kaifeng St intersection — fires N toward T1
  //   Spacing: 2.3m (different streets, mutual defilade)
  //   Neither firing corridor passes through overwatch
  firingPositions: [
    { x: 1.4, y: 2.0 },  // F1 (bravo)  — Xiangyang/Nanyang, fires N up corridor
    { x: 3.4, y: 3.3 },  // F2 (charlie) — Chengde/Kaifeng, fires N up Chengde
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

      const result = await svc.dispatchMission({
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

      if (!result.success) {
        this.logPhase(state, `WARNING: Follower ${followerId} dispatch failed — ${result.error}`);
      } else {
        this.logPhase(state, `Follower ${followerId} holding at base (mission ${missionId.slice(0, 8)})`);
      }
    }

    // Dispatch recon_area to leader
    const reconMissionId = randomUUID();
    state.missions['recon_leader'] = reconMissionId;

    const reconResult = await svc.dispatchMission({
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

    if (!reconResult.success) {
      this.logPhase(state, `CRITICAL: Leader recon dispatch failed — ${reconResult.error}`);
      state.error = reconResult.error;
    } else {
      this.logPhase(state, `Leader ${state.config.leaderId} dispatched for recon (mission ${reconMissionId.slice(0, 8)})`);
    }
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
    this.logPhase(state, 'ADVANCE phase — Followers moving to firing positions via road routes');

    const svc = getRobotMissionService();

    // Road-following waypoint routes (room coords mapped to real Taipei streets)
    // Followers start at home base (0.3, 0.5) on Hengyang Road
    //
    // F1 (bravo) route → Xiangyang/Nanyang intersection (1.4, 2.0):
    //   Home → N on Hengyang Rd → E on Wuchang St → N on Xiangyang → Nanyang St
    //
    // F2 (charlie) route → Chengde/Kaifeng intersection (3.4, 3.3):
    //   Home → N on Hengyang Rd → E on Hankou St → N on Guanqian → E on Kaifeng → Chengde
    const advanceRoutes: Array<Array<{ x: number; y: number }>> = [
      // F1: Home → Hengyang/Wuchang → Xiangyang/Wuchang → Xiangyang/Nanyang
      [
        { x: 0.3, y: 1.7 },  // N on Hengyang to Wuchang St
        { x: 1.4, y: 1.7 },  // E on Wuchang to Xiangyang Rd
        { x: 1.4, y: 2.0 },  // N on Xiangyang to Nanyang St — FIRING POS
      ],
      // F2: Home → Hengyang/Wuchang → Hankou → Guanqian/Hankou → Guanqian/Kaifeng → Chengde/Kaifeng
      [
        { x: 0.3, y: 1.7 },  // N on Hengyang to Wuchang St
        { x: 0.3, y: 2.6 },  // N on Hengyang to Hankou St
        { x: 2.5, y: 2.6 },  // E on Hankou to Guanqian Rd
        { x: 2.5, y: 3.3 },  // N on Guanqian to Kaifeng St
        { x: 3.4, y: 3.3 },  // E on Kaifeng to Chengde Rd — FIRING POS
      ],
    ];

    const followerMissions: string[] = [];

    for (let i = 0; i < state.config.followerIds.length; i++) {
      const followerId = state.config.followerIds[i];
      const route = advanceRoutes[i] ?? advanceRoutes[0];
      const firingPos = state.config.firingPositions[i] ?? state.config.firingPositions[0];
      const missionId = randomUUID();

      state.missions[`advance_${followerId}`] = missionId;
      followerMissions.push(missionId);

      const advResult = await svc.dispatchMission({
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

      if (!advResult.success) {
        this.logPhase(state, `WARNING: Follower ${followerId} advance dispatch failed — ${advResult.error}`);
      } else {
        this.logPhase(state, `Follower ${followerId} advancing via road route to (${firingPos.x}, ${firingPos.y})`);
      };
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

    // After engagement effects complete (red LED flash ~5s), advance to BDA
    setTimeout(() => this.executeBDA(seqId), 8000);
  }

  private async executeBDA(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'engage') return;

    state.phase = 'bda';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'BDA phase — Leader conducting battle damage assessment');

    // Update adversary COP symbols to destroyed status (SIDC position 7 = '5')
    await this.markThreatsDestroyed(state);

    // Log BDA report
    const threatCount = state.detectedThreats.length;
    this.logPhase(state, `BDA REPORT: ${threatCount} enemy armored vehicle(s) destroyed`);
    this.logPhase(state, 'All targets neutralized — area clear');
    this.publishUpdate(state);

    // Advance to withdrawal after BDA report
    setTimeout(() => this.executeWithdrawal(seqId), 5000);
  }

  /**
   * Update adversary COP layer symbols to destroyed status.
   * Changes SIDC position 7 from '0' (present) to '5' (destroyed).
   */
  private async markThreatsDestroyed(state: SequenceState): Promise<void> {
    try {
      const { layerStore } = await import('../cop/layers/layer-store.js');

      // Find the vision-generated adversary layer
      const layers = await layerStore.queryLayers({
        workspaceId: state.config.problemSetId || 'default',
        layerType: 'force_disposition',
      });

      for (const layer of layers) {
        const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
        if (meta?.generatedBy !== 'vision-detection-pipeline') continue;

        const symbols = layer.spec?.symbols;
        if (!symbols || !Array.isArray(symbols)) continue;

        // Update each hostile symbol's SIDC: change position 7 from '0' to '5' (destroyed)
        let updated = false;
        for (const sym of symbols) {
          if (sym.sidc && sym.sidc.length === 20 && sym.affiliation === 'enemy') {
            const chars = sym.sidc.split('');
            chars[6] = '5'; // Position 7 (0-indexed: 6) = destroyed
            sym.sidc = chars.join('');
            sym.designation = `${sym.designation} [DESTROYED]`;
            updated = true;
          }
        }

        if (updated) {
          const updatedMeta = { ...(meta ?? {}), generatedBy: 'vision-detection-pipeline', generatedAt: new Date().toISOString(), sourceDocumentIds: (meta?.sourceDocumentIds ?? []) as string[], ccoValidated: false };
          await layerStore.updateLayerSpec(layer.id, {
            ...layer.spec!,
            symbols,
            metadata: updatedMeta,
          });
          this.logPhase(state, `COP updated — enemy symbols marked DESTROYED`);
        }
      }
    } catch (err) {
      this.logPhase(state, `Failed to update COP symbols: ${err}`);
    }
  }

  private async executeWithdrawal(seqId: string): Promise<void> {
    const state = this.sequences.get(seqId);
    if (!state || state.phase !== 'bda') return;

    state.phase = 'withdraw';
    state.phaseStartedAt = new Date().toISOString();
    this.logPhase(state, 'WITHDRAW phase — All elements returning to home base');

    const svc = getRobotMissionService();
    const home = state.config.homeBase;

    // Withdrawal routes (reverse of advance, following roads)
    // F1 at Xiangyang/Nanyang (1.4, 2.0) → Wuchang → Hengyang → Home
    // F2 at Chengde/Kaifeng (3.4, 3.3) → Kaifeng → Guanqian → Hankou → Hengyang → Home
    // Leader at Parking Tower (2.1, 2.9) → Guanqian → Hankou → Hengyang → Home
    const withdrawalRoutes: Record<string, Array<{ x: number; y: number }>> = {
      [state.config.leaderId]: [
        { x: 2.5, y: 2.6 },  // S on Guanqian to Hankou St
        { x: 0.3, y: 2.6 },  // W on Hankou to Hengyang Rd
        { x: 0.3, y: 0.5 },  // S on Hengyang to home
      ],
      [state.config.followerIds[0]]: [
        { x: 1.4, y: 1.7 },  // S on Xiangyang to Wuchang St
        { x: 0.3, y: 1.7 },  // W on Wuchang to Hengyang Rd
        { x: 0.3, y: 0.5 },  // S on Hengyang to home
      ],
      [state.config.followerIds[1]]: [
        { x: 2.5, y: 3.3 },  // W on Kaifeng to Guanqian Rd
        { x: 2.5, y: 2.6 },  // S on Guanqian to Hankou St
        { x: 0.3, y: 2.6 },  // W on Hankou to Hengyang Rd
        { x: 0.3, y: 0.5 },  // S on Hengyang to home
      ],
    };

    // Dispatch patrol_route for all three robots to return home
    const allRobots = [state.config.leaderId, ...state.config.followerIds];
    for (const robotId of allRobots) {
      const route = withdrawalRoutes[robotId] ?? [home];
      const missionId = randomUUID();
      state.missions[`withdraw_${robotId}`] = missionId;

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

      this.logPhase(state, `${robotId} withdrawing to home base via road route`);
    }

    this.publishUpdate(state);

    // Monitor for all robots to complete withdrawal
    this.monitorWithdrawal(seqId, allRobots);
  }

  private monitorWithdrawal(seqId: string, robotIds: string[]): void {
    const checkInterval = setInterval(async () => {
      const state = this.sequences.get(seqId);
      if (!state || state.phase !== 'withdraw') {
        clearInterval(checkInterval);
        return;
      }

      const svc = getRobotMissionService();
      const robots = svc.getConnectedRobots();

      const allHome = robotIds.every((rid) => {
        const robot = robots.find((r) => r.robot_id === rid);
        if (!robot) return false;
        const withdrawMissionId = state.missions[`withdraw_${rid}`];
        return robot.current_mission_id !== withdrawMissionId;
      });

      if (allHome) {
        clearInterval(checkInterval);
        state.phase = 'complete';
        state.phaseStartedAt = new Date().toISOString();
        this.logPhase(state, 'COMPLETE — All elements at home base, mission sequence finished');
        this.logPhase(state, `BDA: ${state.detectedThreats.length} enemy destroyed, 0 friendly casualties`);
        this.publishUpdate(state);
      }
    }, 2000);

    // Safety timeout
    setTimeout(() => {
      const state = this.sequences.get(seqId);
      if (state && state.phase === 'withdraw') {
        clearInterval(checkInterval);
        state.phase = 'complete';
        state.phaseStartedAt = new Date().toISOString();
        this.logPhase(state, 'COMPLETE — Withdrawal timeout, mission sequence finished');
        this.publishUpdate(state);
      }
    }, 3 * 60 * 1000);
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
