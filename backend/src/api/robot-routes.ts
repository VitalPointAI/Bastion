/**
 * Robot REST API Routes
 *
 * Phase 06 Plan 03: Mock DAO trigger, mission status, and manual auth endpoints.
 * Provides REST interface for triggering robot missions, querying status,
 * and sending manual authorization responses.
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MissionJSONSchema } from '../robot/robot-types.js';
import { getRobotMissionService } from '../robot/robot-mission-service.js';
import { getMissionSequenceOrchestrator } from '../robot/mission-sequence-orchestrator.js';
import { getAutonomousOrchestrator } from '../robot/autonomous-mission-orchestrator.js';
import { startSimulation } from '../robot/mission-simulator.js';
import { loadCoalitionProfiles } from '../robot/coalition-caveat-service.js';

// Calibration profile storage (file-based for MVP)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CALIBRATION_DIR = join(__dirname, '../../data');
const CALIBRATION_FILE = join(CALIBRATION_DIR, 'calibration-profiles.json');

interface CalibrationProfile {
  room_width: number;
  room_height: number;
  map_bounds: { north: number; south: number; east: number; west: number };
}

function loadProfiles(): Record<string, CalibrationProfile> {
  if (!existsSync(CALIBRATION_FILE)) {
    const defaults: Record<string, CalibrationProfile> = {
      default: {
        room_width: 5,
        room_height: 5,
        map_bounds: { north: 25.0480, south: 25.0420, east: 121.5180, west: 121.5120 },
      },
    };
    if (!existsSync(CALIBRATION_DIR)) mkdirSync(CALIBRATION_DIR, { recursive: true });
    writeFileSync(CALIBRATION_FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return JSON.parse(readFileSync(CALIBRATION_FILE, 'utf-8'));
}

function saveProfiles(profiles: Record<string, CalibrationProfile>): void {
  if (!existsSync(CALIBRATION_DIR)) mkdirSync(CALIBRATION_DIR, { recursive: true });
  writeFileSync(CALIBRATION_FILE, JSON.stringify(profiles, null, 2));
}

export const robotRouter = Router();

// ---------------------------------------------------------------------------
// POST /missions/trigger — Mock DAO event trigger
// ---------------------------------------------------------------------------

robotRouter.post('/missions/trigger', async (req, res) => {
  try {
    const { robot_id, command, params, problem_set_id } = req.body;

    if (!command) {
      res.status(400).json({ error: 'command is required' });
      return;
    }

    const mission_id = randomUUID();
    const now = new Date().toISOString();

    // Build normalized MissionJSON matching real DAO proposal shape
    const missionPayload = {
      mission_id,
      robot_id: robot_id || 'alpha',
      command,
      params: {
        ...params,
        speed: params?.speed ?? 100,
        autonomy_policy: params?.autonomy_policy ?? {
          autonomous_actions: ['patrol_route'],
          restricted_actions: ['find_engage'],
          max_speed: 200,
          lethal_effects_permitted: false,
        },
      },
      issued_by: `did:near:bastion-dao:${problem_set_id || 'demo'}`,
      timestamp: now,
      auth_token: 'demo-token',
      problem_set_id: problem_set_id || undefined,
    };

    // Validate with MissionJSONSchema
    const parseResult = MissionJSONSchema.safeParse(missionPayload);
    if (!parseResult.success) {
      const errors = parseResult.error.flatten().fieldErrors;
      res.status(400).json({ error: 'Invalid mission payload', details: errors });
      return;
    }

    // Policy validation: check speed against authority limit
    const { speed, autonomy_policy } = parseResult.data.params;
    if (speed > autonomy_policy.max_speed) {
      res.status(403).json({
        error: 'Policy violation',
        reason: `speed (${speed}) exceeds authority limit (${autonomy_policy.max_speed})`,
      });
      return;
    }

    // Dispatch to connected robot
    const result = await getRobotMissionService().dispatchMission(parseResult.data);
    if (!result.success) {
      res.status(422).json({ error: result.error });
      return;
    }

    res.status(201).json({ mission_id, status: 'dispatched' });
  } catch (err) {
    console.error('[robot-routes] POST /missions/trigger error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /missions/:missionId — Get mission status
// ---------------------------------------------------------------------------

robotRouter.get('/missions/:missionId', async (req, res) => {
  try {
    const status = await getRobotMissionService().getMissionStatus(req.params.missionId);
    if (!status) {
      res.status(404).json({ error: 'Mission not found' });
      return;
    }
    res.json(status);
  } catch (err) {
    console.error('[robot-routes] GET /missions/:missionId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /robots — List connected robots
// ---------------------------------------------------------------------------

robotRouter.get('/robots', (_req, res) => {
  const robots = getRobotMissionService().getConnectedRobots();
  res.json(
    robots.map((r) => ({
      robot_id: r.robot_id,
      did: r.did,
      capabilities: r.capabilities,
      state: r.state,
      current_mission_id: r.current_mission_id,
      last_heartbeat: r.last_heartbeat,
      latest_telemetry: r.latest_telemetry,
      network: r.network,
      latest_vision: r.latest_vision ? {
        timestamp: r.latest_vision.timestamp,
        mission_id: r.latest_vision.mission_id,
        detections: r.latest_vision.detections,
        scene_description: r.latest_vision.scene_description,
        keyframe_jpeg_b64: r.latest_vision.keyframe_jpeg_b64,
      } : undefined,
    })),
  );
});

// ---------------------------------------------------------------------------
// POST /robots/:robotId/nudge — Manual D-pad nudge control
// ---------------------------------------------------------------------------

robotRouter.post('/robots/:robotId/nudge', (req, res) => {
  const { robotId } = req.params;
  const { heading, speed, duration_sec } = req.body;

  if (typeof heading !== 'number' || typeof speed !== 'number') {
    res.status(400).json({ error: 'heading (number) and speed (number) are required' });
    return;
  }

  const service = getRobotMissionService();
  const result = service.sendManualCommand(robotId, {
    type: 'robot:manual_nudge',
    robot_id: robotId,
    heading: Math.round(heading) % 360,
    speed: Math.max(0, Math.min(255, Math.round(speed))),
    duration_sec: typeof duration_sec === 'number' ? duration_sec : 1.0,
  });

  if (!result.success) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ status: 'sent' });
});

// ---------------------------------------------------------------------------
// POST /robots/:robotId/navigate — Click-to-navigate (map target point)
// ---------------------------------------------------------------------------

robotRouter.post('/robots/:robotId/navigate', (req, res) => {
  const { robotId } = req.params;
  const { x, y, speed } = req.body;

  if (typeof x !== 'number' || typeof y !== 'number') {
    res.status(400).json({ error: 'x (number) and y (number) are required' });
    return;
  }

  const service = getRobotMissionService();
  const result = service.sendManualCommand(robotId, {
    type: 'robot:manual_navigate',
    robot_id: robotId,
    target_x: x,
    target_y: y,
    speed: typeof speed === 'number' ? Math.max(0, Math.min(255, Math.round(speed))) : 100,
  });

  if (!result.success) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ status: 'sent' });
});

// ---------------------------------------------------------------------------
// POST /robots/:robotId/stop — Emergency stop
// ---------------------------------------------------------------------------

robotRouter.post('/robots/:robotId/stop', (req, res) => {
  const { robotId } = req.params;
  const service = getRobotMissionService();
  const result = service.sendManualCommand(robotId, {
    type: 'robot:manual_stop',
    robot_id: robotId,
  });

  if (!result.success) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ status: 'sent' });
});

// ---------------------------------------------------------------------------
// POST /missions/:missionId/auth — Manual auth response (backup for gate flow)
// ---------------------------------------------------------------------------

robotRouter.post('/missions/:missionId/auth', async (req, res) => {
  try {
    const { approved, decided_by } = req.body;
    if (typeof approved !== 'boolean' || !decided_by) {
      res.status(400).json({ error: 'approved (boolean) and decided_by (string) are required' });
      return;
    }

    const service = getRobotMissionService();
    await service.handleGateResolution(req.params.missionId, approved, decided_by);

    res.json({ status: approved ? 'approved' : 'denied', mission_id: req.params.missionId });
  } catch (err) {
    console.error('[robot-routes] POST /missions/:missionId/auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Calibration profile CRUD
// ---------------------------------------------------------------------------

robotRouter.get('/calibration/profiles', (_req, res) => {
  const profiles = loadProfiles();
  res.json(Object.keys(profiles));
});

robotRouter.get('/calibration/profiles/:name', (req, res) => {
  const profiles = loadProfiles();
  const profile = profiles[req.params.name];
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json(profile);
});

robotRouter.put('/calibration/profiles/:name', (req, res) => {
  const { room_width, room_height, map_bounds } = req.body;
  if (!room_width || !room_height || !map_bounds) {
    res.status(400).json({ error: 'room_width, room_height, and map_bounds are required' });
    return;
  }

  const profiles = loadProfiles();
  profiles[req.params.name] = { room_width, room_height, map_bounds };
  saveProfiles(profiles);
  res.json({ saved: req.params.name });
});

// ---------------------------------------------------------------------------
// Coalition profiles (Phase 48)
// ---------------------------------------------------------------------------

/** GET /coalition-profiles — Return all coalition profiles (DID → policy) */
robotRouter.get('/coalition-profiles', (_req, res) => {
  try {
    const profiles = loadCoalitionProfiles();
    res.json(profiles);
  } catch (err) {
    console.error('[robot-routes] GET /coalition-profiles error:', err);
    res.status(500).json({ error: 'Failed to load coalition profiles' });
  }
});

// ---------------------------------------------------------------------------
// Swarm endpoints (Phase 46)
// ---------------------------------------------------------------------------

/** GET /swarms — List all active swarms with current state */
robotRouter.get('/swarms', (_req, res) => {
  const swarms = getRobotMissionService().getActiveSwarms();
  res.json(
    swarms.map((s) => ({
      swarm_id: s.swarm_id,
      leader_id: s.leader_id,
      state: s.state,
      formation: s.formation,
      member_count: s.member_count,
      center_of_mass: s.center_of_mass,
      heading: s.heading,
      members: s.members.map((m) => ({
        robot_id: m.robot_id,
        role: m.role,
        position: m.position,
        heading: m.heading,
        battery_pct: m.battery_pct,
        slot_index: m.slot_index,
      })),
      timestamp: s.timestamp,
    })),
  );
});

/** GET /swarms/:swarmId — Get a specific swarm's state */
robotRouter.get('/swarms/:swarmId', (req, res) => {
  const swarm = getRobotMissionService().getSwarmState(req.params.swarmId);
  if (!swarm) {
    res.status(404).json({ error: 'Swarm not found' });
    return;
  }
  res.json(swarm);
});

/** POST /swarms/:leaderId/add-resource — DAO directive to add a resource to a swarm */
robotRouter.post('/swarms/:leaderId/add-resource', (req, res) => {
  const { robot_id, resource_type, did, capabilities, dao_proposal_id } = req.body;
  if (!robot_id) {
    res.status(400).json({ error: 'robot_id is required' });
    return;
  }

  const success = getRobotMissionService().sendSwarmAddResource(
    req.params.leaderId,
    robot_id,
    resource_type || 'rvr_plus',
    did,
    capabilities || [],
    dao_proposal_id,
  );

  if (!success) {
    res.status(422).json({ error: `Leader ${req.params.leaderId} not connected` });
    return;
  }

  res.json({ status: 'add_resource_sent', leader_id: req.params.leaderId, robot_id });
});

/** POST /swarms/:leaderId/remove-resource — DAO directive to remove a resource from a swarm */
robotRouter.post('/swarms/:leaderId/remove-resource', (req, res) => {
  const { robot_id, reason, dao_proposal_id } = req.body;
  if (!robot_id) {
    res.status(400).json({ error: 'robot_id is required' });
    return;
  }

  const success = getRobotMissionService().sendSwarmRemoveResource(
    req.params.leaderId,
    robot_id,
    reason || 'dao_directive',
    dao_proposal_id,
  );

  if (!success) {
    res.status(422).json({ error: `Leader ${req.params.leaderId} not connected` });
    return;
  }

  res.json({ status: 'remove_resource_sent', leader_id: req.params.leaderId, robot_id });
});

// ---------------------------------------------------------------------------
// POST /scenarios/iron-bastion — Start Iron Bastion mission sequence
// ---------------------------------------------------------------------------

robotRouter.post('/scenarios/iron-bastion', async (req, res) => {
  const overrides = req.body ?? {};
  const simulate = req.query.simulate === 'true' || req.body?.simulate === true;

  try {
    // Start virtual robots if simulate mode
    if (simulate) {
      const leaderId = overrides.leaderId ?? 'alpha';
      const followerIds = overrides.followerIds ?? ['bravo', 'charlie'];
      startSimulation({
        robotIds: [leaderId, ...followerIds],
        leaderId,
        homeBase: overrides.homeBase ?? { x: 0.3, y: 0.5 },
        reconArea: overrides.reconArea ?? { x_min: 0.5, y_min: 2.5, x_max: 4.5, y_max: 4.8 },
        threatClasses: ['CHN-99G', 'T-90'],
      });
    }

    const orchestrator = getMissionSequenceOrchestrator();
    const { sequenceId, state } = await orchestrator.startIronBastion(overrides);

    res.json({
      sequenceId,
      phase: state.phase,
      startedAt: state.startedAt,
      simulate,
    });
  } catch (err) {
    console.error('[robot-routes] Failed to start Iron Bastion scenario:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /scenarios/:sequenceId — Get mission sequence status
// ---------------------------------------------------------------------------

robotRouter.get('/scenarios/:sequenceId', (req, res) => {
  const orchestrator = getMissionSequenceOrchestrator();
  let state: unknown = orchestrator.getState(req.params.sequenceId);

  if (!state) {
    // Check autonomous orchestrator
    const autoOrch = getAutonomousOrchestrator();
    state = autoOrch.getState(req.params.sequenceId);
  }

  if (!state) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }

  res.json(state);
});

// ---------------------------------------------------------------------------
// GET /scenarios — List all mission sequences
// ---------------------------------------------------------------------------

robotRouter.get('/scenarios', (_req, res) => {
  const orchestrator = getMissionSequenceOrchestrator();
  const sequences = orchestrator.listSequences();

  // Merge scripted + autonomous sequences
  const autoOrch = getAutonomousOrchestrator();
  const autoSequences = autoOrch.listSequences();

  const all = [
    ...sequences.map((s) => ({
      id: s.id, type: 'scripted' as const, phase: s.phase, startedAt: s.startedAt,
      phaseStartedAt: s.phaseStartedAt, detectedThreats: s.detectedThreats.length, logEntries: s.log.length,
    })),
    ...autoSequences.map((s) => ({
      id: s.id, type: 'autonomous' as const, phase: s.phase, startedAt: s.startedAt,
      phaseStartedAt: s.phaseStartedAt, detectedThreats: s.detectedThreats.length, logEntries: s.log.length,
    })),
  ];

  res.json(all);
});

// ---------------------------------------------------------------------------
// POST /scenarios/autonomous — Start autonomous AI-driven mission
// ---------------------------------------------------------------------------

robotRouter.post('/scenarios/autonomous', async (req, res) => {
  const overrides = req.body ?? {};
  const simulate = req.query.simulate === 'true' || req.body?.simulate === true;

  try {
    if (simulate) {
      const leaderId = overrides.leaderId ?? 'alpha';
      const followerIds = overrides.followerIds ?? ['bravo', 'charlie'];
      startSimulation({
        robotIds: [leaderId, ...followerIds],
        leaderId,
        homeBase: overrides.homeBase ?? { x: 0.3, y: 0.5 },
        reconArea: overrides.reconArea ?? { x_min: 0.5, y_min: 2.5, x_max: 4.5, y_max: 4.8 },
        threatClasses: ['CHN-99G', 'T-90'],
      });
    }

    const orchestrator = getAutonomousOrchestrator();
    const { sequenceId, state } = await orchestrator.startAutonomousMission(overrides);

    res.json({
      sequenceId,
      phase: state.phase,
      startedAt: state.startedAt,
      type: 'autonomous',
      simulate,
    });
  } catch (err) {
    console.error('[robot-routes] Failed to start autonomous mission:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /scenarios/:sequenceId/return-to-base — Commander orders withdrawal (shadow mode)
// ---------------------------------------------------------------------------

robotRouter.post('/scenarios/:sequenceId/return-to-base', async (req, res) => {
  const orchestrator = getAutonomousOrchestrator();
  const success = await orchestrator.orderReturnToBase(req.params.sequenceId);

  if (!success) {
    res.status(404).json({ error: 'Sequence not found or not in shadow mode' });
    return;
  }

  res.json({ status: 'withdrawal_ordered' });
});
