/**
 * Wargaming Service
 *
 * Service layer for managing wargaming sessions, move submission, and what-if analysis.
 * Provides the API interface for MDMP Phase 4 (COA Analysis/Wargaming) functionality.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WargamingConfig,
  WargamingSession,
  WargamingMove,
  WhatIfAdjustment,
} from './types.js';
import { WargamingEngine } from './wargaming-engine.js';

/**
 * Wargaming Service
 *
 * Manages wargaming sessions following the hybrid model from CONTEXT:
 * 1. AI runs automated scenarios first (auto_running state)
 * 2. Commander explores what-if adjustments interactively (interactive state)
 * 3. Session completes with outcomes summary (completed state)
 */
export class WargamingService {
  /**
   * In-memory session storage.
   *
   * TODO: Migrate to PostgreSQL persistence for production.
   * Current in-memory implementation supports development and testing.
   */
  private sessions: Map<string, WargamingSession> = new Map();

  /**
   * Create a new wargaming session.
   *
   * Initializes a session in 'configuring' state. Commander must call startAutoRun()
   * to begin automated cycle generation.
   *
   * @param config Wargaming configuration (COAs, adversary COAs, cycle depth, etc.)
   * @param userDID User DID of the session creator
   * @returns Created session
   */
  async createSession(config: WargamingConfig, userDID: string): Promise<WargamingSession> {
    const sessionId = uuidv4();
    const now = Date.now();

    const session: WargamingSession = {
      id: sessionId,
      config,
      state: 'configuring',
      cycles: [],
      currentCycle: 0,
      moveLog: [],
      whatIfAdjustments: [],
      allDecisionPoints: [],
      createdAt: now,
      updatedAt: now,
      createdBy: userDID,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a wargaming session by ID.
   *
   * @param sessionId Session identifier
   * @returns Session or null if not found
   */
  async getSession(sessionId: string): Promise<WargamingSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Start automated scenario run.
   *
   * Transitions session from 'configuring' to 'auto_running' and executes
   * the configured number of action-reaction-counteraction cycles using AI.
   *
   * Per CONTEXT hybrid model: This is phase 1 (automated scenarios).
   * After completion, session transitions to 'interactive' for what-if exploration.
   *
   * @param sessionId Session identifier
   * @returns Updated session with completed automated cycles
   */
  async startAutoRun(sessionId: string): Promise<WargamingSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.state !== 'configuring') {
      throw new Error(
        `Cannot start auto-run: session is in state '${session.state}' (must be 'configuring')`
      );
    }

    session.state = 'auto_running';
    session.updatedAt = Date.now();

    const engine = new WargamingEngine(session.config);
    const cycles = await engine.runAutomatedCycles();

    session.cycles = cycles;
    session.currentCycle = cycles.length;

    // Flatten cycles into move log
    session.moveLog = [];
    for (const cycle of cycles) {
      session.moveLog.push(cycle.action);
      session.moveLog.push(cycle.reaction);
      session.moveLog.push(cycle.counteraction);
    }

    // Extract decision points
    session.allDecisionPoints = engine.extractDecisionPoints(cycles);

    // Transition to interactive mode if autoRunFirst is true
    if (session.config.autoRunFirst) {
      session.state = 'interactive';
    }

    session.updatedAt = Date.now();
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Submit a friendly move in interactive mode.
   *
   * Allows commander to submit custom friendly actions during interactive wargaming.
   * Engine generates adversary reaction and friendly counteraction in response.
   *
   * Per CONTEXT hybrid model: This is phase 2 (interactive exploration).
   *
   * @param sessionId Session identifier
   * @param action Description of the friendly action
   * @param domains DIME domains for the action
   * @param resources Resources committed
   * @returns Updated session with new cycle
   */
  async submitFriendlyMove(
    sessionId: string,
    action: string,
    domains: string[],
    resources: string[]
  ): Promise<WargamingSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.state !== 'interactive') {
      throw new Error(
        `Cannot submit move: session is in state '${session.state}' (must be 'interactive')`
      );
    }

    const engine = new WargamingEngine(session.config);
    const cycleNumber = session.currentCycle + 1;

    // Create friendly action move
    const friendlyMove: WargamingMove = {
      id: `move-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      cycle: cycleNumber,
      sequenceInCycle: 1,
      actor: 'friendly',
      action,
      reasoning: 'Commander-specified action in interactive mode',
      domains,
      resourcesCommitted: resources,
      expectedOutcome: 'Outcome to be simulated',
      source: 'commander_interactive',
      timestamp: Date.now(),
    };

    // Generate adversary reaction
    const adversaryReaction = await engine.generateAdversaryReaction(friendlyMove);

    // Generate friendly counteraction
    const friendlyCounter = await engine.generateCounterAction(adversaryReaction);

    // Simulate outcome
    friendlyMove.simulatedOutcome = `Action executed. ${friendlyCounter.action}`;

    // Create cycle
    const cycle = {
      cycleNumber,
      action: friendlyMove,
      reaction: adversaryReaction,
      counteraction: friendlyCounter,
      cycleSummary: `Interactive cycle ${cycleNumber}: ${action}`,
      decisionPoints: [
        {
          description: `Commander-initiated action at cycle ${cycleNumber}`,
          trigger: 'Interactive wargaming exploration',
          options: ['Continue current approach', 'Adjust based on adversary reaction', 'Try alternative action'],
        },
      ],
    };

    session.cycles.push(cycle);
    session.currentCycle = cycleNumber;
    session.moveLog.push(friendlyMove, adversaryReaction, friendlyCounter);
    session.allDecisionPoints.push({
      cycleNumber,
      ...cycle.decisionPoints[0],
    });

    session.updatedAt = Date.now();
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Apply what-if adjustment and replay cycles.
   *
   * Allows commander to adjust parameters (friendly actions, adversary responses,
   * force ratios, environment, escalation posture) and see alternative outcomes.
   *
   * Per CONTEXT: Supports all 5 parameter types for interactive exploration.
   *
   * @param sessionId Session identifier
   * @param adjustment What-if adjustment parameters
   * @returns Updated session with replayed cycles
   */
  async applyWhatIf(sessionId: string, adjustment: WhatIfAdjustment): Promise<WargamingSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.state !== 'interactive') {
      throw new Error(
        `Cannot apply what-if: session is in state '${session.state}' (must be 'interactive')`
      );
    }

    const engine = new WargamingEngine(session.config);

    // Store the adjustment
    session.whatIfAdjustments.push(adjustment);

    // Replay cycles from adjustment point
    const _replayedCycles = await engine.applyWhatIf(adjustment);

    // TODO: Replace cycles from adjustment point forward with replayed cycles
    // Current implementation logs the adjustment for tracking

    session.updatedAt = Date.now();
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Complete wargaming session and generate outcomes.
   *
   * Transitions session to 'completed' state and generates comprehensive
   * outcomes summary (strengths, weaknesses, critical decision points, COA modifications).
   *
   * @param sessionId Session identifier
   * @returns Completed session with outcomes
   */
  async completeSession(sessionId: string): Promise<WargamingSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.state === 'completed') {
      return session; // Already completed
    }

    const engine = new WargamingEngine(session.config);
    session.outcomes = engine.generateOutcomes(session);
    session.state = 'completed';
    session.updatedAt = Date.now();

    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Get chronological move log for a session.
   *
   * Returns flat timeline view of all moves (action, reaction, counteraction)
   * across all cycles in chronological order. Supports UI timeline rendering.
   *
   * @param sessionId Session identifier
   * @returns Chronological move log
   */
  getMoveLog(sessionId: string): WargamingMove[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.moveLog;
  }

  /**
   * Get extracted decision points for a session.
   *
   * Returns all decision points identified across wargaming cycles.
   * Feeds branch and sequel planning in MDMP.
   *
   * @param sessionId Session identifier
   * @returns Extracted decision points with cycle context
   */
  getDecisionPoints(sessionId: string): WargamingSession['allDecisionPoints'] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.allDecisionPoints;
  }
}

/**
 * Singleton wargaming service instance.
 *
 * Export for use across the application.
 */
export const wargamingService = new WargamingService();
