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
        map_bounds: { north: 25.001, south: 25.0, east: 121.501, west: 121.5 },
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
      issued_by: `dao:${problem_set_id || 'demo'}`,
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
    })),
  );
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
