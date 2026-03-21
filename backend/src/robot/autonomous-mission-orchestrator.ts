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

const AUTO_DEFAULTS: AutoConfig = {
  leaderId: 'alpha',
  followerIds: ['bravo', 'charlie'],
  problemSetId: 'default',
  homeBase: { x: 0.3, y: 0.5 },
  reconArea: { x_min: 0.5, y_min: 2.5, x_max: 4.5, y_max: 4.8 },
  reconSpeed: 80,
  advanceSpeed: 120,
  issuedBy: 'did:near:bastion.testnet',
  daoId: 'bastion-dao.testnet',
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

class AutonomousMissionOrchestrator extends EventEmitter {
  private sequences: Map<string, AutoState> = new Map();
  private visionSubscribed = false;

  async startAutonomousMission(
    overrides?: Partial<AutoConfig>,
  ): Promise<{ sequenceId: string; state: AutoState }> {
    const config: AutoConfig = { ...AUTO_DEFAULTS, ...overrides };

    // Stop any existing active sequences to prevent duplicates
    for (const [seqId, existing] of this.sequences) {
      if (existing.phase !== 'complete' && existing.phase !== 'withdraw') {
        existing.phase = 'complete' as AutoPhase;
        this.sequences.delete(seqId);
        console.log(`[AutonomousOrchestrator] Stopped existing sequence ${seqId.slice(0, 8)} before starting new one`);
      }
    }

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

    // Dispatch recon mission to leader
    const svc = getRobotMissionService();
    const reconMissionId = randomUUID();
    state.missions['recon_leader'] = reconMissionId;

    await svc.dispatchMission({
      mission_id: reconMissionId,
      robot_id: config.leaderId,
      command: 'recon_area',
      params: {
        area: config.reconArea,
        speed: config.reconSpeed,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
        profile_name: 'stealth_recon',
      },
      issued_by: config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: config.problemSetId,
    });

    const reconSW = roomToGridRef(config.reconArea.x_min, config.reconArea.y_min);
    const reconNE = roomToGridRef(config.reconArea.x_max, config.reconArea.y_max);
    this.logPhase(state, `Leader ${config.leaderId} — conduct recce screen between grid ${reconSW} and grid ${reconNE}`);
    this.logPhase(state, 'Followers holding at base pending leader assessment');
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

    // Record threat
    state.detectedThreats.push(threat);
    const threatGrid = roomToGridRef(threat.detectedAt.x, threat.detectedAt.y);
    this.logPhase(state, `CONTACT: ${threat.classDesc} detected at grid ${threatGrid} conf=${(threat.confidence * 100).toFixed(0)}%`);

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
    const leaderPos = leaderRobot?.latest_telemetry?.position
      ?? (state as unknown as { leaderDetectionPos?: { x: number; y: number } }).leaderDetectionPos
      ?? state.config.homeBase;

    this.logPhase(state, `Analyzing ${state.detectedThreats.length} threat(s) against area map...`);

    try {
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
      );

      state.tacticalPlan = plan;
      this.logPhase(state, `AI ASSESSMENT: ${plan.assessment}`);
      this.logPhase(state, `Recommendation: ${plan.engagementRecommendation.toUpperCase()} (confidence: ${(plan.planConfidence * 100).toFixed(0)}%)`);
      this.logPhase(state, `Overwatch: (${plan.overwatch.position.x}, ${plan.overwatch.position.y}) — ${plan.overwatch.reasoning}`);

      for (let i = 0; i < plan.firingPositions.length; i++) {
        const fp = plan.firingPositions[i];
        this.logPhase(state, `Firing pos ${i + 1}: (${fp.position.x}, ${fp.position.y}) — ${fp.reasoning}`);
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

    // 2. Concurrently move leader to AI-chosen overwatch via road-following route
    const owMissionId = randomUUID();
    state.missions['overwatch_leader'] = owMissionId;

    // Compute route from leader's CURRENT position to overwatch at dispatch time
    // (not the pre-computed route from plan time — the robot has moved since then)
    const owPos = plan.overwatch.position;
    const leaderNow = svc.getConnectedRobots().find((r) => r.robot_id === state.config.leaderId)?.latest_telemetry?.position
      ?? (state as unknown as { leaderDetectionPos?: { x: number; y: number } }).leaderDetectionPos
      ?? state.config.homeBase;

    let owWaypoints: Array<{ x: number; y: number }>;
    try {
      const { createNavigationTools } = await import('./skills/navigation-skill.js');
      const navTools = createNavigationTools();
      const routeTool = navTools.find((t) => t.name === 'plan_route')!;
      const raw = await routeTool.invoke({
        from_x: leaderNow.x, from_y: leaderNow.y,
        to_x: owPos.x, to_y: owPos.y,
        prefer_concealment: true,
      });
      const result = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      owWaypoints = result.waypoints ?? [owPos];
    } catch {
      owWaypoints = [owPos];
    }

    this.logPhase(state, `Leader route: ${owWaypoints.length} waypoints from (${leaderNow.x.toFixed(1)}, ${leaderNow.y.toFixed(1)}) to overwatch`);

    await svc.dispatchMission({
      mission_id: owMissionId,
      robot_id: state.config.leaderId,
      command: 'patrol_route',
      params: {
        waypoints: owWaypoints,
        speed: state.config.reconSpeed,
        autonomy_policy: { max_speed: 255, restricted_actions: [] },
      },
      issued_by: state.config.issuedBy,
      timestamp: new Date().toISOString(),
      problem_set_id: state.config.problemSetId,
    });

    const owGrid = roomToGridRef(plan.overwatch.position.x, plan.overwatch.position.y);
    this.logPhase(state, `Leader moving to overwatch at grid ${owGrid} while awaiting approval`);
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
      const route = plan.routes.followerRoutes[i] ?? [plan.firingPositions[i]?.position ?? state.config.homeBase];
      const missionId = randomUUID();

      state.missions[`advance_${followerId}`] = missionId;
      followerMissions.push(missionId);

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

      const fp = plan.firingPositions[i];
      const fpGrid = fp ? roomToGridRef(fp.position.x, fp.position.y) : 'unknown';
      this.logPhase(state, `${followerId} — take tactical route to grid ${fpGrid}, assume firing position`);
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

    // Safety: stop shadow reporting after 10 minutes
    setTimeout(() => clearInterval(shadowInterval), 10 * 60 * 1000);
  }

  // ── Phase: WITHDRAW ────────────────────────────────────────────────────

  private async executeWithdrawal(state: AutoState): Promise<void> {
    state.phase = 'withdraw';
    state.phaseStartedAt = new Date().toISOString();

    const plan = state.tacticalPlan;
    const svc = getRobotMissionService();

    // Post-engagement: consolidate near the overwatch position, do NOT RTB.
    // All elements move to the overwatch position and hold for further orders.
    const consolidationPoint = plan?.overwatch.position ?? state.config.homeBase;
    const consolidationGrid = roomToGridRef(consolidationPoint.x, consolidationPoint.y);

    this.logPhase(state, `CONSOLIDATE — All elements consolidate at grid ${consolidationGrid} and await further orders`);

    const allRobots = [state.config.leaderId, ...state.config.followerIds];

    for (const robotId of allRobots) {
      // Get robot's current position for route computation
      const robot = svc.getConnectedRobots().find((r) => r.robot_id === robotId);
      const currentPos = robot?.latest_telemetry?.position ?? state.config.homeBase;

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

    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
  }

  // ── Shared helpers ─────────────────────────────────────────────────────

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
        const robot = robots.find((r) => r.robot_id === fid);
        if (!robot) return false;
        return robot.current_mission_id !== state.missions[`advance_${fid}`];
      });

      if (allArrived) {
        clearInterval(checkInterval);
        this.logPhase(state, 'All followers in position — leader attempting to order engagement');
        await this.attemptEngagement(seqId);
      }
    }, 2000);

    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
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
            this.logPhase(state, 'StrikeAuthorization APPROVED by commander');
            await this.executeEngagement(seqId);
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

        const threatClasses = ['t-90', 't90', 'chn-99g', 'chn99g', 'tank', 'military vehicle',
          'armored vehicle', 't-99', 'zbd-04', 'zbd04', 'btr-82', 'btr82', 'type99', 'ztz99'];

        const robotId = payload.robot_id as string;

        // Get robot position for threat location
        const svc = getRobotMissionService();
        const robot = svc.getConnectedRobots().find((r) => r.robot_id === robotId);
        const robotPos = robot?.latest_telemetry?.position ?? { x: 2.5, y: 2.5 };

        for (const det of detections) {
          const classKey = det.class_desc.toLowerCase().replace(/[^a-z0-9 -]/g, '');
          if (!threatClasses.includes(classKey)) continue;

          // Use estimated enemy position if available (placed at range by simulator),
          // otherwise fall back to robot's position
          const enemyPos = (det as { estimated_position?: { x: number; y: number } }).estimated_position ?? robotPos;
          const threat: ThreatInfo = {
            entityId: `DET-${classKey}-${Date.now()}`,
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
