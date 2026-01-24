/**
 * Mission API
 * REST endpoints for mission CRUD, participants, and invites
 *
 * Phase 4.4 Plan 02: Mission management API
 */

import { Router, type Request, type Response } from 'express';
import { missionStore } from '../mission/mission-store.js';
import { participantStore } from '../mission/participant-store.js';
import { inviteStore } from '../mission/invite-store.js';
import { MissionInputSchema } from '../mission/schemas.js';
import type { MissionState, ParticipantRole } from '../mission/types.js';

const router = Router();

/**
 * Extract user DID from request headers
 * Supports: X-DID header, Authorization Bearer token
 */
function getUserDID(req: Request): string | null {
  // Check X-DID header
  const xDid = req.headers['x-did'];
  if (typeof xDid === 'string' && xDid.trim()) {
    return xDid.trim();
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  return null;
}

/**
 * Helper to extract string value from query param (handles arrays)
 */
function getQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

// =====================
// MISSION CRUD ENDPOINTS
// =====================

/**
 * POST /api/missions - Create a new mission
 *
 * Body: MissionInput (name, description, classification, areaOfOps, workspaceId)
 * Requires: X-DID header for createdBy tracking
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required. Provide DID via X-DID header or Authorization Bearer',
      });
    }

    const input = MissionInputSchema.parse(req.body);
    const mission = await missionStore.createMission(input, userDID);

    console.log(`✓ Mission created: ${mission.id}`);
    res.status(201).json(mission);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create mission failed:', message);
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/missions - List missions with optional filters
 *
 * Query params:
 * - state: MissionState (planning, active, complete, archived)
 * - classification: UNCLASS | SECRET | TOPSECRET
 * - workspaceId: string
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const state = getQueryString(req.query.state) as MissionState | undefined;
    const workspaceId = getQueryString(req.query.workspaceId);

    const missions = await missionStore.listMissions({
      state,
      workspaceId,
    });

    res.json({ missions, count: missions.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List missions failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/missions/:id - Get single mission
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    res.json(mission);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get mission failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/missions/:id - Update mission
 *
 * Body: Partial mission fields (name, description, areaOfOps)
 * Cannot change workspaceId or state (use state transition endpoints)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const updated = await missionStore.updateMission(missionId, req.body);

    if (!updated) {
      return res.status(500).json({ error: 'Failed to update mission' });
    }

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update mission failed:', message);
    res.status(400).json({ error: message });
  }
});

// =====================
// STATE TRANSITION ENDPOINTS
// =====================

/**
 * POST /api/missions/:id/activate - Transition from planning to active
 */
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const activated = await missionStore.transitionState(missionId, 'active');

    console.log(`✓ Mission ${missionId} activated`);
    res.json(activated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Activate mission failed:', message);
    res.status(409).json({ error: message });
  }
});

/**
 * POST /api/missions/:id/complete - Transition from active to complete
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const completed = await missionStore.transitionState(missionId, 'complete');

    console.log(`✓ Mission ${missionId} completed`);
    res.json(completed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Complete mission failed:', message);
    res.status(409).json({ error: message });
  }
});

/**
 * POST /api/missions/:id/archive - Transition from complete to archived
 */
router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const archived = await missionStore.transitionState(missionId, 'archived');

    console.log(`✓ Mission ${missionId} archived`);
    res.json(archived);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Archive mission failed:', message);
    res.status(409).json({ error: message });
  }
});

// =====================
// PARTICIPANT ENDPOINTS
// =====================

/**
 * GET /api/missions/:id/participants - List mission participants
 */
router.get('/:id/participants', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const participants = await participantStore.listParticipants(missionId);

    res.json({ missionId, participants, count: participants.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List participants failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/missions/:id/participants/:participantId - Remove participant
 */
router.delete('/:id/participants/:participantId', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const participantId = req.params.participantId as string;

    // Verify mission exists
    const mission = await missionStore.getMission(missionId);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    // Verify participant exists
    const participant = await participantStore.getParticipant(participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Verify participant belongs to this mission
    if (participant.missionId !== missionId) {
      return res.status(400).json({ error: 'Participant does not belong to this mission' });
    }

    const removed = await participantStore.removeParticipant(participantId);

    if (!removed) {
      return res.status(500).json({ error: 'Failed to remove participant' });
    }

    console.log(`✓ Participant ${participantId} removed from mission ${missionId}`);
    res.json({ success: true, participantId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Remove participant failed:', message);
    res.status(500).json({ error: message });
  }
});

// =====================
// INVITE ENDPOINTS
// =====================

/**
 * POST /api/missions/:id/invites - Create mission invite
 *
 * Body:
 * - role: ParticipantRole (required)
 * - inviteeEmail?: string (optional)
 * - inviteeDid?: string (optional)
 * - expirationHours?: number (default: 72)
 */
router.post('/:id/invites', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const { role, inviteeEmail, inviteeDid, expirationHours } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    const validRoles: ParticipantRole[] = ['commander', 'staff', 'observer'];
    if (!validRoles.includes(role as ParticipantRole)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    const { invite, rawToken } = await inviteStore.createInvite(
      missionId,
      role as ParticipantRole,
      userDID,
      inviteeEmail,
      inviteeDid,
      expirationHours || 72
    );

    console.log(`✓ Invite created for mission ${missionId}: ${invite.id}`);

    // Return invite with raw token (only time it's visible)
    res.status(201).json({
      ...invite,
      token: rawToken, // Override hashed token with raw token for sharing
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create invite failed:', message);
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/missions/:id/invites - List pending invites for mission
 */
router.get('/:id/invites', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const mission = await missionStore.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const invites = await inviteStore.listInvites(missionId);

    // Filter out tokens from response (security)
    const sanitizedInvites = invites.map((invite) => ({
      id: invite.id,
      missionId: invite.missionId,
      inviteeEmail: invite.inviteeEmail,
      inviteeDid: invite.inviteeDid,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt,
    }));

    res.json({ missionId, invites: sanitizedInvites, count: sanitizedInvites.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List invites failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/missions/:id/invites/:inviteId - Cancel invite
 */
router.delete('/:id/invites/:inviteId', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const missionId = req.params.id as string;
    const inviteId = req.params.inviteId as string;

    // Verify mission exists
    const mission = await missionStore.getMission(missionId);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    // For now, cancel = delete from database
    // In production, might want soft delete or status field
    const { getPool } = await import('../lib/database.js');
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM mission_invites WHERE id = $1 AND mission_id = $2',
      [inviteId, missionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    console.log(`✓ Invite ${inviteId} cancelled`);
    res.json({ success: true, inviteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cancel invite failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/missions/accept-invite - Accept an invite and join mission
 *
 * Body:
 * - token: string (required) - The raw invite token
 */
router.post('/accept-invite', async (req: Request, res: Response) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }

    const acceptedInvite = await inviteStore.acceptInvite(token, userDID);

    if (!acceptedInvite) {
      return res.status(410).json({
        error: 'Invite not found, expired, or already accepted',
      });
    }

    console.log(`✓ User ${userDID} accepted invite to mission ${acceptedInvite.missionId}`);

    res.json({
      success: true,
      missionId: acceptedInvite.missionId,
      role: acceptedInvite.role,
      joinedAt: acceptedInvite.acceptedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Accept invite failed:', message);

    // Check for targeted invite mismatch
    if (message.includes('different user')) {
      return res.status(403).json({ error: message });
    }

    res.status(400).json({ error: message });
  }
});

export default router;
