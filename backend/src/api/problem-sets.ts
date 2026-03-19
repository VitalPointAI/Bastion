/**
 * Problem Set API
 * REST endpoints for problem set CRUD, membership, invites, roles, and activity.
 *
 * Phase 23: Problem Set Model & Workspace Rename
 *
 * All on-chain DAO operations (create_dao, add_member, remove_member, assign_role)
 * are triggered from these routes via signAndSubmitFunctionCall.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { problemSetStore } from '../problem-set/problem-set-store.js';
import { problemSetMemberStore } from '../problem-set/problem-set-member-store.js';
import { problemSetInviteStore } from '../problem-set/problem-set-invite-store.js';
import { problemSetActivityStore } from '../problem-set/problem-set-activity-store.js';
import { problemSetRoleStore } from '../problem-set/problem-set-role-store.js';
import { problemSetCompartmentStore } from '../problem-set/problem-set-compartment-store.js';
import { problemSetPanelConfigStore } from '../problem-set/problem-set-panel-config-store.js';
import { problemSetSubscriptionStore } from '../problem-set/problem-set-subscription-store.js';
import { problemSetEscalationStore } from '../problem-set/problem-set-escalation-store.js';
import { signAndSubmitFunctionCall } from '../near/tx-signer.js';
import { clearanceSufficient, validateEchelonHierarchy } from '../problem-set/types.js';
import type { AppMode, Echelon, ProblemSetClassification } from '../problem-set/types.js';
import { ScenarioStore } from '../exercise/scenario-store.js';
import { PositionStore, initPositionTables } from '../exercise/position-store.js';
import { modeMiddleware } from '../middleware/mode-context.js';
import { inheritanceService } from '../inheritance/inheritance-service.js';

const DAO_CONTRACT_ID = process.env.DAO_CONTRACT_ID || 'dao-registry.testnet';
const scenarioStore = new ScenarioStore();
const positionStore = new PositionStore();

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateProblemSetSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  echelon: z.enum(['strategic', 'operational', 'tactical']),
  classification: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']).default('UNCLASSIFIED'),
  parentProblemSetId: z.string().optional(),
  inviteMode: z.enum(['open', 'gated']).default('gated'),
  discoverability: z.enum(['discoverable', 'private']).default('private'),
  mode: z.enum(['training', 'operational']).optional(),
});

const CreateInviteSchema = z.object({
  role: z.string().min(1),
  daoRole: z.string().default('member'),
  inviteeEmail: z.string().email().optional(),
  inviteeDid: z.string().optional(),
  expiresInHours: z.number().min(1).max(720).default(72),
});

const UpdateRoleSchema = z.object({
  newRole: z.string().min(1),
  newDaoRole: z.string().min(1),
});

const CreateCompartmentSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
});

const AssignMemberCompartmentSchema = z.object({
  memberDid: z.string().min(1),
});

const PanelConfigSchema = z.object({
  panelVisibility: z.record(z.string(), z.array(z.string())),
  defaultTab: z.string().optional(),
});

const CreateSubscriptionSchema = z.object({
  publisherProblemSetId: z.string().min(1),
  dataTypes: z.array(z.string()),
});

const UpdateSubscriptionStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

const EscalationRuleSchema = z.object({
  ruleType: z.string(),
  proposalKind: z.string(),
  thresholdConfig: z.record(z.string(), z.unknown()).optional(),
  votingMechanism: z.enum(['autocratic', 'democratic']).default('democratic'),
  autoRouteTo: z.string().optional(),
});

const EscalateSchema = z.object({
  proposalKind: z.string(),
  description: z.string().min(1).max(2000),
  urgency: z.enum(['urgent', 'standard']).default('standard'),
  data: z.record(z.string(), z.unknown()).optional(),
});

const CreateFromScenarioSchema = z.object({
  scenarioId: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  echelon: z.enum(['strategic', 'operational', 'tactical']).optional(),
  classification: z.string().optional(),
  inviteMode: z.string().optional(),
  discoverability: z.string().optional(),
  problemStatement: z.string().max(2000).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build DID from NEAR account ID
 */
function buildDID(nearAccountId: string): string {
  return `did:near:${nearAccountId}`;
}

/**
 * Derive user secret from account ID (deterministic, server-side)
 * Uses a simple derivation for problem set operations -- same approach as existing code.
 */
function deriveUserSecret(accountId: string): Uint8Array {
  const encoder = new TextEncoder();
  const seed = process.env.DID_SECRET_SEED || 'bastion-default-seed';
  const combined = encoder.encode(`${seed}:${accountId}`);
  // Pad or truncate to 32 bytes
  const result = new Uint8Array(32);
  result.set(combined.slice(0, Math.min(combined.length, 32)));
  return result;
}

/**
 * Check if a user has a given permission in a problem set.
 * Throws an error with HTTP status 403 if permission is missing.
 */
async function checkPermission(
  problemSetId: string,
  userDid: string,
  permission: string,
): Promise<void> {
  const member = await problemSetMemberStore.getMember(problemSetId, userDid);
  if (!member) {
    const err = new Error('Not a member of this problem set');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
  if (member.status === 'suspended') {
    const err = new Error('Your membership is suspended');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }

  const roles = await problemSetRoleStore.getRolesForProblemSet(problemSetId);
  const memberRole = roles.find((r) => r.militaryLabel === member.role);
  if (!memberRole || !memberRole.permissions.includes(permission)) {
    const err = new Error(`Missing permission: ${permission}`);
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
}

/**
 * Determine the hierarchy level of a problem set (0 = root, 1 = child, 2 = grandchild).
 * Used to enforce max 3-level hierarchy.
 */
async function getProblemSetDepth(problemSetId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = problemSetId;

  while (currentId) {
    const ps = await problemSetStore.getProblemSet(currentId);
    if (!ps || !ps.parentProblemSetId) break;
    depth++;
    currentId = ps.parentProblemSetId;
    if (depth > 3) break; // Safety: avoid infinite loop on circular ref
  }

  return depth;
}

/**
 * Check if a user is commander or XO (council-level role) in a problem set.
 * Returns the member record if authorized, throws 403 otherwise.
 */
async function requireCommanderOrXo(
  problemSetId: string,
  userDid: string,
): Promise<void> {
  const member = await problemSetMemberStore.getMember(problemSetId, userDid);
  if (!member) {
    const err = new Error('Not a member of this problem set');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
  if (member.status === 'suspended') {
    const err = new Error('Your membership is suspended');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
  if (member.role !== 'commander' && member.role !== 'xo') {
    const err = new Error('Commander or XO role required');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
}

/**
 * Handle permission errors with consistent HTTP codes.
 */
function handleError(res: Response, error: unknown): void {
  const err = error as NodeJS.ErrnoException;
  const message = err instanceof Error ? err.message : 'Unknown error';

  if (err.code === '403') {
    res.status(403).json({ error: message });
    return;
  }
  if (message.includes('not found') || message.includes('Not found')) {
    res.status(404).json({ error: message });
    return;
  }
  res.status(500).json({ error: message });
}

// ============================================================================
// Problem Set CRUD Endpoints
// ============================================================================

/**
 * POST /api/problem-sets - Create a new problem set
 *
 * Creates off-chain record + triggers on-chain DAO creation.
 * Auto-initializes military role templates and adds creator as commander.
 * Validates echelon hierarchy when parent is specified.
 */
router.post('/', requireAuth, modeMiddleware, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);

    let body: z.infer<typeof CreateProblemSetSchema>;
    try {
      body = CreateProblemSetSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    // Validate hierarchy depth and echelon if parent specified
    let parentDaoId: string | undefined;
    if (body.parentProblemSetId) {
      const parent = await problemSetStore.getProblemSet(body.parentProblemSetId);
      if (!parent) {
        return res.status(404).json({ error: 'Parent problem set not found' });
      }
      parentDaoId = parent.daoId;

      // Validate echelon hierarchy (strategic > operational > tactical)
      if (!validateEchelonHierarchy(parent.echelon, body.echelon)) {
        return res.status(400).json({
          error: `Invalid echelon hierarchy: ${parent.echelon} cannot contain ${body.echelon}`,
        });
      }

      // Check depth -- max 3 levels (strategic > operational > tactical)
      const parentDepth = await getProblemSetDepth(body.parentProblemSetId);
      if (parentDepth >= 2) {
        return res.status(400).json({ error: 'Maximum problem set hierarchy depth (3 levels) exceeded' });
      }
    } else {
      // Top-level must be strategic
      if (!validateEchelonHierarchy(null, body.echelon)) {
        return res.status(400).json({
          error: 'Top-level problem sets must be strategic echelon',
        });
      }
    }

    // Resolve mode: prefer body param, fall back to middleware-injected userMode, default 'operational'
    const mode = (body.mode ?? (req as unknown as Record<string, unknown>).userMode ?? 'operational') as AppMode;

    // Create off-chain problem set record (generates daoId)
    const problemSet = await problemSetStore.createProblemSet(
      {
        name: body.name,
        description: body.description,
        echelon: body.echelon as Echelon,
        classification: body.classification as ProblemSetClassification,
        parentProblemSetId: body.parentProblemSetId,
        inviteMode: body.inviteMode,
        discoverability: body.discoverability,
        mode,
      },
      userDid,
    );

    // On-chain: create DAO
    const createDaoResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'create_dao',
      {
        dao_id: problemSet.daoId,
        name: problemSet.name,
        description: problemSet.description ?? '',
        classification: problemSet.classification,
      },
    );

    let txHash = createDaoResult.txHash;

    // On-chain: set parent DAO if problem set is a child
    if (parentDaoId) {
      const setParentResult = await signAndSubmitFunctionCall(
        userSecret,
        DAO_CONTRACT_ID,
        'set_dao_parent',
        {
          dao_id: problemSet.daoId,
          parent_dao_id: parentDaoId,
        },
      );
      if (setParentResult.txHash) txHash = setParentResult.txHash;
    }

    // Initialize military role templates
    await problemSetRoleStore.initRolesForProblemSet(problemSet.id, problemSet.echelon);

    // Add creator as commander (council DAO role)
    await problemSetMemberStore.addMember(problemSet.id, userDid, 'commander', 'council', userDid);

    // Auto-create inheritance subscriptions if child PS has a parent
    if (body.parentProblemSetId) {
      try {
        await inheritanceService.createInheritanceChain(problemSet.id, body.parentProblemSetId, userDid);
        console.log(`Inheritance chain created for ${problemSet.id} -> ${body.parentProblemSetId}`);
      } catch (inheritError) {
        // Log but don't fail PS creation if inheritance setup fails
        console.warn('Auto-inheritance setup failed:', inheritError instanceof Error ? inheritError.message : inheritError);
      }
    }

    // Log activity
    await problemSetActivityStore.log(
      problemSet.id,
      'problem_set_created',
      userDid,
      null,
      { echelon: problemSet.echelon, daoId: problemSet.daoId },
      txHash,
    );

    console.log(`Problem set created: ${problemSet.id} (DAO: ${problemSet.daoId})`);
    res.status(201).json(problemSet);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create problem set failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/from-scenario - Create a training problem set from an exercise scenario
 *
 * Always creates problem set with mode='training' regardless of user's current mode.
 * Pre-populates problem set with scenario snapshot data.
 */
router.post('/from-scenario', requireAuth, modeMiddleware, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);

    let body: z.infer<typeof CreateFromScenarioSchema>;
    try {
      body = CreateFromScenarioSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    // Load scenario
    const scenario = await scenarioStore.findById(body.scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    // Create problem set in training mode (scenarios are inherently training)
    const problemSetName = body.name ?? scenario.name;
    const problemSet = await problemSetStore.createProblemSet(
      {
        name: problemSetName,
        description: body.description ?? `Training problem set based on ${scenario.name}`,
        echelon: (body.echelon ?? 'strategic') as Echelon,
        classification: (body.classification ?? 'UNCLASSIFIED') as ProblemSetClassification,
        inviteMode: (body.inviteMode ?? 'gated') as 'open' | 'gated',
        discoverability: (body.discoverability ?? 'private') as 'discoverable' | 'private',
        problemStatement: body.problemStatement,
        mode: 'training' as AppMode,
      },
      userDid,
    );

    // On-chain: create DAO
    const createDaoResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'create_dao',
      {
        dao_id: problemSet.daoId,
        name: problemSet.name,
        description: problemSet.description ?? '',
        classification: problemSet.classification,
      },
    );

    // Initialize military role templates
    await problemSetRoleStore.initRolesForProblemSet(problemSet.id, problemSet.echelon);

    // Add creator as commander
    await problemSetMemberStore.addMember(problemSet.id, userDid, 'commander', 'council', userDid);

    // Log scenario load activity
    await problemSetActivityStore.log(
      problemSet.id,
      'scenario_loaded',
      userDid,
      null,
      {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        designation: scenario.designation,
        exercisePhases: scenario.exercisePhases,
        currentPhaseIndex: scenario.currentPhaseIndex,
        status: scenario.status,
        daoId: problemSet.daoId,
      },
      createDaoResult.txHash,
    );

    // Link scenario to the newly created problem set
    await scenarioStore.updateProblemSetLink(body.scenarioId, problemSet.id);

    console.log(`Training problem set created from scenario: ${problemSet.id} (scenario: ${scenario.id})`);
    res.status(201).json(problemSet);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create problem set from scenario failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/me - List user's problem set memberships (enriched)
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const mode = req.query.mode as AppMode | undefined;
    const userMode = (req as unknown as Record<string, unknown>).userMode as AppMode | undefined;

    const memberships = await problemSetMemberStore.listMemberships(userDid);

    // Enrich each membership with problem set name and echelon
    const enriched = await Promise.all(
      memberships.map(async (membership) => {
        const problemSet = await problemSetStore.getProblemSet(membership.problemSetId);
        return {
          ...membership,
          name: problemSet?.name ?? 'Unknown',
          echelon: problemSet?.echelon ?? 'strategic',
          classification: problemSet?.classification ?? 'UNCLASSIFIED',
          mode: problemSet?.mode ?? 'operational',
        };
      }),
    );

    // Filter by mode if query parameter provided
    const filtered = mode
      ? enriched.filter((m) => m.mode === mode)
      : enriched;

    res.json({
      memberships: filtered,
      count: filtered.length,
      _meta: { mode: userMode ?? 'operational' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List memberships failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/problem-sets/me/primary - Set primary problem set
 *
 * Body: { problemSetId: string }
 */
router.put('/me/primary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const { problemSetId } = req.body;

    if (!problemSetId || typeof problemSetId !== 'string') {
      return res.status(400).json({ error: 'problemSetId is required' });
    }

    // Verify membership exists
    const member = await problemSetMemberStore.getMember(problemSetId, userDid);
    if (!member) {
      return res.status(404).json({ error: 'You are not a member of this problem set' });
    }

    await problemSetMemberStore.setPrimary(userDid, problemSetId);

    res.json({ success: true, problemSetId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Set primary problem set failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/invite/code/:code - Look up invite by short code
 * Returns the raw token so the frontend can redirect to the accept flow.
 */
router.get('/invite/code/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    const invite = await problemSetInviteStore.getInviteByShortCode(code);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }
    // We need the raw token for the accept flow, but we only store the hash.
    // Return the invite ID + short code; the frontend will use the short code
    // accept endpoint instead.
    res.json({ inviteId: invite.id, problemSetId: invite.problemSetId, shortCode: invite.shortCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Short code lookup failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/invite/accept-by-code - Accept invite using short code
 * Body: { code: string }
 */
router.post('/invite/accept-by-code', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }

    const invite = await problemSetInviteStore.getInviteByShortCode(code);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found, expired, or already used' });
    }

    // Verify invitee matches if targeted
    if (invite.inviteeDid && invite.inviteeDid !== userDid) {
      return res.status(403).json({ error: 'This invite is for a different user' });
    }

    // Check if user is already a member
    const existingMember = await problemSetMemberStore.getMember(invite.problemSetId, userDid);
    if (existingMember) {
      return res.status(409).json({ error: 'You are already a member of this problem set' });
    }

    // Get problem set for clearance and mode checks
    const problemSet = await problemSetStore.getProblemSet(invite.problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    // Clearance gate
    const userClearance = (req.anonUser as unknown as Record<string, unknown>)?.clearance as string | undefined;
    if (!clearanceSufficient(userClearance ?? 'UNCLASSIFIED', problemSet.classification)) {
      return res.status(403).json({
        error: `Insufficient clearance. Problem set requires ${problemSet.classification}`,
      });
    }

    // Gated mode: if not yet approved, return 202
    if (problemSet.inviteMode === 'gated' && !invite.approvedAt) {
      return res.status(202).json({
        status: 'pending_approval',
        message: 'Your membership request is awaiting approval from a problem set administrator',
        inviteId: invite.id,
      });
    }

    // On-chain: add member to DAO
    const addMemberResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'add_member',
      {
        dao_id: problemSet.daoId,
        member_id: userDid,
        role: invite.daoRole,
      },
    );

    // Off-chain: add member record
    const member = await problemSetMemberStore.addMember(
      invite.problemSetId,
      userDid,
      invite.role,
      invite.daoRole,
      invite.createdBy,
    );

    // Mark invite accepted
    await problemSetInviteStore.markAccepted(invite.id);

    // Log activity
    await problemSetActivityStore.log(
      invite.problemSetId,
      'member_joined',
      userDid,
      userDid,
      { inviteId: invite.id, role: invite.role, daoRole: invite.daoRole, viaShortCode: code },
      addMemberResult.txHash,
    );

    console.log(`User ${userDid} accepted invite to problem set ${invite.problemSetId} via code ${code}`);
    res.json({ member, txHash: addMemberResult.txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Accept by code failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/invite/accept - Accept a problem set invite
 *
 * Body: { token: string }
 * Handles clearance validation and gated approval flow.
 */
router.post('/invite/accept', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);

    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }

    // Look up invite by raw token
    const invite = await problemSetInviteStore.getInviteByToken(token);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found, expired, or already accepted' });
    }

    // Verify invitee matches if targeted
    if (invite.inviteeDid && invite.inviteeDid !== userDid) {
      return res.status(403).json({ error: 'This invite is for a different user' });
    }

    // Get problem set for clearance and mode checks
    const problemSet = await problemSetStore.getProblemSet(invite.problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    // Clearance gate: check user clearance against problem set classification
    const userClearance = (req.anonUser as unknown as Record<string, unknown>)?.clearance as string | undefined;
    if (!clearanceSufficient(userClearance ?? 'UNCLASSIFIED', problemSet.classification)) {
      return res.status(403).json({
        error: `Insufficient clearance. Problem set requires ${problemSet.classification}`,
      });
    }

    // Gated mode: if problemSet.inviteMode === 'gated' and invite not yet approved, return 202
    if (problemSet.inviteMode === 'gated' && !invite.approvedAt) {
      return res.status(202).json({
        status: 'pending_approval',
        message: 'Your membership request is awaiting approval from a problem set administrator',
        inviteId: invite.id,
      });
    }

    // On-chain: add member to DAO
    const addMemberResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'add_member',
      {
        dao_id: problemSet.daoId,
        member_id: userDid,
        role: invite.daoRole,
      },
    );

    // Off-chain: add member record
    const member = await problemSetMemberStore.addMember(
      invite.problemSetId,
      userDid,
      invite.role,
      invite.daoRole,
      invite.createdBy,
    );

    // Mark invite accepted
    await problemSetInviteStore.markAccepted(invite.id);

    // Log activity
    await problemSetActivityStore.log(
      invite.problemSetId,
      'member_joined',
      userDid,
      userDid,
      { inviteId: invite.id, role: invite.role, daoRole: invite.daoRole },
      addMemberResult.txHash,
    );

    console.log(`User ${userDid} accepted invite to problem set ${invite.problemSetId}`);
    res.json({ member, txHash: addMemberResult.txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Accept invite failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/notifications/counts - Get unread activity counts
 *
 * Body: { lastSeenMap: Record<string, string> } (problemSetId -> ISO timestamp)
 */
router.post('/notifications/counts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const { lastSeenMap } = req.body;

    if (!lastSeenMap || typeof lastSeenMap !== 'object') {
      return res.status(400).json({ error: 'lastSeenMap is required' });
    }

    const counts = await problemSetActivityStore.getUnreadCountsForUser(userDid, lastSeenMap);

    res.json({ counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get unread counts failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Scenario Linkage Endpoints (before /:id to avoid param conflict)
// ============================================================================

/**
 * GET /api/problem-sets/scenario-usage-counts - Get usage counts for each scenario
 * Returns a map of scenarioId -> number of problem sets created from it.
 */
router.get('/scenario-usage-counts', requireAuth, async (_req: Request, res: Response) => {
  try {
    const counts = await scenarioStore.getUsageCounts();
    res.json(counts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get scenario usage counts failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Agent / Team Listing (read-only, any authenticated user)
// Used by TeamRoster dropdowns — avoids requiring admin access.
// MUST be before /:id routes to avoid Express treating "agents" as an id param.
// ============================================================================

/**
 * GET /api/problem-sets/agents/list - List active agents (no admin required)
 */
router.get('/agents/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const { getAgentRegistry } = await import('../agents/registry.js');
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const agents = registry.listAgents().filter((a) => a.active);
    res.json(agents.map((a) => ({
      agentId: a.agentId,
      name: a.name,
      description: a.description,
      agentDID: a.agentDID,
      active: a.active,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List agents (public) failed:', message);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

/**
 * GET /api/problem-sets/teams/list - List enabled teams (no admin required)
 */
router.get('/teams/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const { getTeamRegistry } = await import('../agents/team-registry.js');
    const registry = getTeamRegistry();
    await registry.ensureInitialized();
    const teams = registry.listTeams().filter((t: { isEnabled: boolean }) => t.isEnabled);
    res.json(teams.map((t) => ({
      teamId: t.teamId,
      name: t.name,
      description: t.description,
      teamDID: t.teamDID,
      isEnabled: t.isEnabled,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List teams (public) failed:', message);
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

// ============================================================================
// Per-Problem-Set Endpoints (/:id prefix)
// ============================================================================

/**
 * GET /api/problem-sets/:id/linked-scenario - Get the scenario linked to a problem set
 */
router.get('/:id/linked-scenario', requireAuth, async (req: Request, res: Response) => {
  try {
    const scenario = await scenarioStore.findByProblemSetId(req.params.id as string);
    if (!scenario) {
      return res.status(404).json({ error: 'No linked scenario' });
    }
    res.json(scenario);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get linked scenario failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/scenario - Create a scenario and link it to this problem set
 * Only works for training-mode problem sets with no existing linked scenario.
 */
router.post('/:id/scenario', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    // Verify problem set exists and caller is a member
    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }
    const member = await problemSetMemberStore.getMember(problemSetId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this problem set' });
    }

    // Check no scenario already linked
    const existing = await scenarioStore.findByProblemSetId(problemSetId);
    if (existing) {
      return res.status(409).json({ error: 'Problem set already has a linked scenario', scenario: existing });
    }

    // Parse input
    const schema = z.object({
      name: z.string().min(2).max(100),
      designation: z.enum(['training/exercise', 'operational']).default('training/exercise'),
      exercisePhases: z.array(z.string()).optional(),
      enabledRoles: z.array(z.string()).optional(),
    });
    const body = schema.parse(req.body);

    // Create scenario
    const scenario = await scenarioStore.create({
      name: body.name,
      designation: body.designation,
      exercisePhases: body.exercisePhases ?? [],
      currentPhaseIndex: 0,
      status: 'draft',
      enabledRoles: body.enabledRoles,
      createdBy: userDid,
    });

    // Link to problem set
    await scenarioStore.updateProblemSetLink(scenario.id, problemSetId);

    // Log activity
    await problemSetActivityStore.log(
      problemSetId,
      'scenario_loaded',
      userDid,
      null,
      {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        designation: scenario.designation,
        action: 'created_and_linked',
      },
    );

    console.log(`Scenario created and linked: ${scenario.id} → problem set ${problemSetId}`);
    res.status(201).json(scenario);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create linked scenario failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id - Get problem set details
 * Caller must be a member.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    // Verify caller is a member
    const member = await problemSetMemberStore.getMember(problemSetId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this problem set' });
    }

    const memberCount = await problemSetMemberStore.getMemberCount(problemSetId);

    res.json({ ...problemSet, memberCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get problem set failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/problem-sets/:id - Update problem set settings
 * Requires manage_workspace permission.
 */
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    try {
      await checkPermission(problemSetId, userDid, 'manage_workspace');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const { name, description, problemStatement, inviteMode, discoverability } = req.body;
    const updated = await problemSetStore.updateProblemSet(problemSetId, {
      name,
      description,
      problemStatement,
      inviteMode,
      discoverability,
    });

    await problemSetActivityStore.log(
      problemSetId,
      'problem_set_updated',
      userDid,
      null,
      { changes: { name, description, problemStatement, inviteMode, discoverability } },
    );

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update problem set failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/problem-sets/:id - Delete a problem set (creator only)
 *
 * Cascades to all child tables (members, invites, activity, roles, etc.).
 * Only the original creator (created_by) can delete.
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    // Allow creator, any commander, or platform admin to delete
    const member = await problemSetMemberStore.getMember(problemSetId, userDid);
    const isCreator = problemSet.createdBy === userDid;
    const isCommander = member?.role === 'commander';
    const adminDids = (process.env.ADMIN_DIDS || '').split(',').map((d) => d.trim()).filter(Boolean);
    const isAdmin = adminDids.includes(userDid);
    if (!isCreator && !isCommander && !isAdmin) {
      return res.status(403).json({ error: 'Only the creator, a commander, or a platform admin can delete a problem set' });
    }

    // Check for child problem sets — prevent deletion if children exist
    const children = await problemSetStore.listChildProblemSets(problemSetId);
    if (children.length > 0) {
      return res.status(400).json({ error: 'Cannot delete a problem set that has child problem sets. Delete children first.' });
    }

    // Clear FK references that lack ON DELETE CASCADE
    const { getPool } = await import('../lib/database.js');
    const pool = getPool();
    await pool.query('UPDATE exercise_scenarios SET problem_set_id = NULL WHERE problem_set_id = $1', [problemSetId]);

    await problemSetStore.deleteProblemSet(problemSetId);

    console.log(`Problem set deleted: ${problemSetId} by ${userDid}`);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete problem set failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/hierarchy - Get full problem set hierarchy tree
 */
router.get('/:id/hierarchy', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;

    const hierarchy = await problemSetStore.getHierarchy(problemSetId);

    // Enrich each problem set with member count
    const enriched = await Promise.all(
      hierarchy.map(async (ps) => {
        const memberCount = await problemSetMemberStore.getMemberCount(ps.id);
        return { ...ps, memberCount };
      }),
    );

    res.json({ hierarchy: enriched, count: enriched.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get hierarchy failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Member Endpoints
// ============================================================================

/**
 * GET /api/problem-sets/:id/members - List problem set members
 */
router.get('/:id/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;

    const members = await problemSetMemberStore.listMembers(problemSetId);

    // Enrich with display names from user_profiles
    const displayNames: Record<string, string> = {};
    const nearIds = members.map((m) => m.userDid.replace(/^did:near:/, '')).filter(Boolean);
    if (nearIds.length > 0) {
      try {
        const { getPool } = await import('../lib/database.js');
        const pool = getPool();
        const result = await pool.query(
          `SELECT near_account_id, display_name FROM user_profiles WHERE near_account_id = ANY($1::text[])`,
          [nearIds],
        );
        for (const row of result.rows as { near_account_id: string; display_name: string }[]) {
          displayNames[`did:near:${row.near_account_id}`] = row.display_name;
        }
      } catch {
        // Non-fatal — display names just won't be enriched
      }
    }

    const enriched = members.map((m) => ({
      ...m,
      displayName: displayNames[m.userDid] || null,
    }));

    res.json({ members: enriched, count: enriched.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List members failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/members/:memberDid/role - Change member role
 * Requires manage_roles permission.
 */
router.post('/:id/members/:memberDid/role', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const memberDid = req.params.memberDid as string;

    let body: z.infer<typeof UpdateRoleSchema>;
    try {
      body = UpdateRoleSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    try {
      await checkPermission(problemSetId, userDid, 'manage_roles');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Get current member state for activity log metadata
    const currentMember = await problemSetMemberStore.getMember(problemSetId, memberDid);
    if (!currentMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    // On-chain: assign new role
    const assignRoleResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'assign_role',
      {
        dao_id: problemSet.daoId,
        member_id: memberDid,
        role: body.newDaoRole,
      },
    );

    // Off-chain: update role
    const updated = await problemSetMemberStore.updateRole(
      problemSetId,
      memberDid,
      body.newRole,
      body.newDaoRole,
    );

    await problemSetActivityStore.log(
      problemSetId,
      'role_changed',
      userDid,
      memberDid,
      {
        oldRole: currentMember.role,
        newRole: body.newRole,
        oldDaoRole: currentMember.daoRole,
        newDaoRole: body.newDaoRole,
      },
      assignRoleResult.txHash,
    );

    console.log(`Role updated for ${memberDid} in problem set ${problemSetId}`);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Change role failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/problem-sets/:id/members/:memberDid/suspend - Suspend member
 * Requires manage_members permission.
 */
router.post('/:id/members/:memberDid/suspend', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const memberDid = req.params.memberDid as string;

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const suspended = await problemSetMemberStore.suspendMember(problemSetId, memberDid, userDid);

    await problemSetActivityStore.log(
      problemSetId,
      'member_suspended',
      userDid,
      memberDid,
      { suspendedBy: userDid },
    );

    console.log(`Member ${memberDid} suspended in problem set ${problemSetId}`);
    res.json(suspended);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Suspend member failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/problem-sets/:id/members/:memberDid/unsuspend - Unsuspend member
 * Requires manage_members permission.
 */
router.post('/:id/members/:memberDid/unsuspend', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const memberDid = req.params.memberDid as string;

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const unsuspended = await problemSetMemberStore.unsuspendMember(problemSetId, memberDid);

    await problemSetActivityStore.log(
      problemSetId,
      'member_unsuspended',
      userDid,
      memberDid,
      { unsuspendedBy: userDid },
    );

    console.log(`Member ${memberDid} unsuspended in problem set ${problemSetId}`);
    res.json(unsuspended);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unsuspend member failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/problem-sets/:id/members/:memberDid - Remove member
 * Requires manage_members permission.
 */
router.delete('/:id/members/:memberDid', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const memberDid = req.params.memberDid as string;

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    // On-chain: remove member from DAO
    const removeMemberResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'remove_member',
      {
        dao_id: problemSet.daoId,
        member_id: memberDid,
      },
    );

    // Off-chain: remove member record
    await problemSetMemberStore.removeMember(problemSetId, memberDid);

    await problemSetActivityStore.log(
      problemSetId,
      'member_removed',
      userDid,
      memberDid,
      { removedBy: userDid },
      removeMemberResult.txHash,
    );

    console.log(`Member ${memberDid} removed from problem set ${problemSetId}`);
    res.json({ success: true, memberDid });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Remove member failed:', message);
    handleError(res, error);
  }
});

// ============================================================================
// Invite Endpoints
// ============================================================================

/**
 * POST /api/problem-sets/:id/invite - Create an invite
 * Requires manage_members permission.
 */
router.post('/:id/invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    let body: z.infer<typeof CreateInviteSchema>;
    try {
      body = CreateInviteSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const { invite, rawToken } = await problemSetInviteStore.createInvite(
      problemSetId,
      body.role,
      body.daoRole,
      userDid,
      {
        inviteeEmail: body.inviteeEmail,
        inviteeDid: body.inviteeDid,
        expiresInHours: body.expiresInHours,
      },
    );

    await problemSetActivityStore.log(
      problemSetId,
      'invite_sent',
      userDid,
      body.inviteeDid ?? null,
      { role: body.role, daoRole: body.daoRole, inviteId: invite.id },
    );

    console.log(`Invite created for problem set ${problemSetId}: ${invite.id}`);
    // Return invite with raw token (only time it's visible)
    res.status(201).json({ ...invite, token: rawToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create invite failed:', message);
    handleError(res, error);
  }
});

/**
 * GET /api/problem-sets/:id/invites - List pending invites
 */
router.get('/:id/invites', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;

    const invites = await problemSetInviteStore.listPendingInvites(problemSetId);

    // Filter out raw token from response (security)
    const sanitized = invites.map((inv) => ({
      id: inv.id,
      problemSetId: inv.problemSetId,
      inviteeEmail: inv.inviteeEmail,
      inviteeDid: inv.inviteeDid,
      role: inv.role,
      daoRole: inv.daoRole,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      approvedAt: inv.approvedAt,
      approvedBy: inv.approvedBy,
      createdBy: inv.createdBy,
      createdAt: inv.createdAt,
    }));

    res.json({ invites: sanitized, count: sanitized.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List invites failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/invites/:inviteId/approve - Approve a gated invite
 * Requires manage_members permission.
 */
router.post('/:id/invites/:inviteId/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const inviteId = req.params.inviteId as string;

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await problemSetInviteStore.markApproved(inviteId, userDid);

    await problemSetActivityStore.log(
      problemSetId,
      'invite_approved',
      userDid,
      null,
      { inviteId, approvedBy: userDid },
    );

    console.log(`Invite ${inviteId} approved by ${userDid}`);
    res.json({ success: true, inviteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Approve invite failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/problem-sets/:id/invites/:inviteId - Cancel invite
 * Requires manage_members permission.
 */
router.delete('/:id/invites/:inviteId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const inviteId = req.params.inviteId as string;

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await problemSetInviteStore.cancelInvite(inviteId);

    await problemSetActivityStore.log(
      problemSetId,
      'invite_cancelled',
      userDid,
      null,
      { inviteId, cancelledBy: userDid },
    );

    console.log(`Invite ${inviteId} cancelled`);
    res.json({ success: true, inviteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cancel invite failed:', message);
    handleError(res, error);
  }
});

// ============================================================================
// Roles Endpoint
// ============================================================================

/**
 * GET /api/problem-sets/:id/roles - List problem set roles
 */
router.get('/:id/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;

    const roles = await problemSetRoleStore.getRolesForProblemSet(problemSetId);

    res.json({ roles, count: roles.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List roles failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Activity Endpoint
// ============================================================================

/**
 * GET /api/problem-sets/:id/activity - List problem set activity
 *
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - types: comma-separated activity types filter
 */
router.get('/:id/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const typesRaw = req.query.types as string | undefined;
    const types = typesRaw ? typesRaw.split(',').map((t) => t.trim()) : undefined;

    const activities = await problemSetActivityStore.listActivities(problemSetId, {
      limit,
      offset,
      types,
    });

    // Batch-lookup display names for all DIDs referenced in this page of activity
    const didSet = new Set<string>();
    for (const a of activities) {
      if (a.actorDid) didSet.add(a.actorDid);
      if (a.subjectDid) didSet.add(a.subjectDid);
    }
    const displayNames: Record<string, string> = {};
    if (didSet.size > 0) {
      try {
        const { getPool } = await import('../lib/database.js');
        const pool = getPool();
        const nearIds = [...didSet].map((d) => d.replace(/^did:near:/, ''));
        const result = await pool.query(
          `SELECT near_account_id, display_name FROM user_profiles WHERE near_account_id = ANY($1::text[])`,
          [nearIds],
        );
        for (const row of result.rows as { near_account_id: string; display_name: string }[]) {
          displayNames[`did:near:${row.near_account_id}`] = row.display_name;
        }
      } catch {
        // Non-fatal -- just omit display names
      }
    }

    res.json({ activities, displayNames, count: activities.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List activity failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Compartment Endpoints
// ============================================================================

/**
 * GET /api/problem-sets/:id/compartments - List all compartments with members
 * Caller must be a member.
 */
router.get('/:id/compartments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    // Verify caller is a member
    const member = await problemSetMemberStore.getMember(problemSetId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this problem set' });
    }

    const compartments = await problemSetCompartmentStore.listCompartmentsWithMembers(problemSetId);

    res.json({ compartments, count: compartments.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List compartments failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/compartments - Create a compartment
 * Requires manage_workspace or manage_members permission.
 */
router.post('/:id/compartments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    let body: z.infer<typeof CreateCompartmentSchema>;
    try {
      body = CreateCompartmentSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    // Require manage_workspace permission
    try {
      await checkPermission(problemSetId, userDid, 'manage_workspace');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const compartment = await problemSetCompartmentStore.createCompartment(
      problemSetId,
      body.name,
      body.description ?? null,
      userDid,
    );

    await problemSetActivityStore.log(
      problemSetId,
      'compartment_created',
      userDid,
      null,
      { compartmentId: compartment.id, name: compartment.name },
    );

    console.log(`Compartment created: ${compartment.id} (${compartment.name}) in problem set ${problemSetId}`);
    res.status(201).json(compartment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create compartment failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/problem-sets/:id/compartments/:cid - Delete a compartment
 * Requires manage_workspace permission.
 */
router.delete('/:id/compartments/:cid', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const compartmentId = req.params.cid as string;

    try {
      await checkPermission(problemSetId, userDid, 'manage_workspace');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Verify compartment belongs to this problem set
    const compartment = await problemSetCompartmentStore.getCompartment(compartmentId);
    if (!compartment || compartment.problemSetId !== problemSetId) {
      return res.status(404).json({ error: 'Compartment not found' });
    }

    await problemSetCompartmentStore.deleteCompartment(compartmentId);

    await problemSetActivityStore.log(
      problemSetId,
      'compartment_deleted',
      userDid,
      null,
      { compartmentId, name: compartment.name },
    );

    console.log(`Compartment ${compartmentId} deleted from problem set ${problemSetId}`);
    res.json({ success: true, compartmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete compartment failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/problem-sets/:id/compartments/:cid/members - Assign member to compartment
 * Requires manage_workspace or manage_members permission.
 * Body: { memberDid: string }
 */
router.post('/:id/compartments/:cid/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const compartmentId = req.params.cid as string;

    let body: z.infer<typeof AssignMemberCompartmentSchema>;
    try {
      body = AssignMemberCompartmentSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Verify compartment belongs to this problem set
    const compartment = await problemSetCompartmentStore.getCompartment(compartmentId);
    if (!compartment || compartment.problemSetId !== problemSetId) {
      return res.status(404).json({ error: 'Compartment not found' });
    }

    // Verify the member being assigned is a problem set member
    const member = await problemSetMemberStore.getMember(problemSetId, body.memberDid);
    if (!member) {
      return res.status(404).json({ error: 'Member not found in problem set' });
    }

    await problemSetCompartmentStore.assignMember(problemSetId, body.memberDid, compartmentId, userDid);

    await problemSetActivityStore.log(
      problemSetId,
      'compartment_member_assigned',
      userDid,
      body.memberDid,
      { compartmentId, compartmentName: compartment.name },
    );

    console.log(`Member ${body.memberDid} assigned to compartment ${compartmentId}`);
    res.json({ success: true, memberDid: body.memberDid, compartmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Assign compartment member failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/problem-sets/:id/compartments/:cid/members/:mid - Remove member from compartment
 * Requires manage_members permission.
 */
router.delete('/:id/compartments/:cid/members/:mid', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const compartmentId = req.params.cid as string;
    const memberDid = req.params.mid as string;

    try {
      await checkPermission(problemSetId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Verify compartment belongs to this problem set
    const compartment = await problemSetCompartmentStore.getCompartment(compartmentId);
    if (!compartment || compartment.problemSetId !== problemSetId) {
      return res.status(404).json({ error: 'Compartment not found' });
    }

    await problemSetCompartmentStore.removeMember(problemSetId, memberDid, compartmentId);

    await problemSetActivityStore.log(
      problemSetId,
      'compartment_member_removed',
      userDid,
      memberDid,
      { compartmentId, compartmentName: compartment.name },
    );

    console.log(`Member ${memberDid} removed from compartment ${compartmentId}`);
    res.json({ success: true, memberDid, compartmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Remove compartment member failed:', message);
    handleError(res, error);
  }
});

/**
 * GET /api/problem-sets/:id/members/:did/compartments - Get compartments for a specific member
 */
router.get('/:id/members/:did/compartments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const targetDid = req.params.did as string;

    // Must be a member to query
    const callerMember = await problemSetMemberStore.getMember(problemSetId, userDid);
    if (!callerMember) {
      return res.status(403).json({ error: 'Not a member of this problem set' });
    }

    const compartmentIds = await problemSetCompartmentStore.listCompartmentsForMember(problemSetId, targetDid);

    res.json({ compartmentIds, count: compartmentIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get member compartments failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Panel Config Endpoints
// ============================================================================

/**
 * GET /api/problem-sets/:id/panel-config - Get role->tab visibility for a problem set
 * Caller must be a member of the problem set.
 */
router.get('/:id/panel-config', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    // Verify caller is a member
    const member = await problemSetMemberStore.getMember(problemSetId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this problem set' });
    }

    const config = await problemSetPanelConfigStore.getOrCreateDefault(problemSetId, problemSet.echelon);

    res.json({ panelVisibility: config.panelVisibility, defaultTab: config.defaultTab });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get panel config failed:', message);
    handleError(res, error);
  }
});

/**
 * PUT /api/problem-sets/:id/panel-config - Update panel visibility
 * Requires commander or XO role.
 */
router.put('/:id/panel-config', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    let body: z.infer<typeof PanelConfigSchema>;
    try {
      body = PanelConfigSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    const config = await problemSetPanelConfigStore.upsertConfig(
      problemSetId,
      body.panelVisibility as Record<string, string[]>,
      body.defaultTab,
    );

    await problemSetActivityStore.log(
      problemSetId,
      'panel_config_updated',
      userDid,
      null,
      { defaultTab: config.defaultTab },
    );

    console.log(`Panel config updated for problem set ${problemSetId}`);
    res.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update panel config failed:', message);
    handleError(res, error);
  }
});

// ============================================================================
// Subscription Endpoints
// ============================================================================

/**
 * POST /api/problem-sets/:id/subscriptions - Request subscription to another problem set's data
 * Caller must be commander or XO of the subscriber problem set (:id).
 */
router.post('/:id/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    let body: z.infer<typeof CreateSubscriptionSchema>;
    try {
      body = CreateSubscriptionSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    // Get publisher problem set for clearance check
    const publisherProblemSet = await problemSetStore.getProblemSet(body.publisherProblemSetId);
    if (!publisherProblemSet) {
      return res.status(404).json({ error: 'Publisher problem set not found' });
    }

    // Classification check: subscriber must have sufficient clearance for publisher
    if (!clearanceSufficient(problemSet.classification, publisherProblemSet.classification)) {
      return res.status(403).json({
        error: `Insufficient clearance. Publisher problem set requires ${publisherProblemSet.classification}`,
      });
    }

    const subscription = await problemSetSubscriptionStore.createSubscription({
      subscriberProblemSetId: problemSetId,
      publisherProblemSetId: body.publisherProblemSetId,
      dataTypes: body.dataTypes,
      requestedBy: userDid,
    });

    // Log activity in both problem sets
    await problemSetActivityStore.log(
      problemSetId,
      'subscription_requested',
      userDid,
      null,
      { subscriptionId: subscription.id, publisherProblemSetId: body.publisherProblemSetId, dataTypes: body.dataTypes },
    );
    await problemSetActivityStore.log(
      body.publisherProblemSetId,
      'subscription_requested',
      userDid,
      null,
      { subscriptionId: subscription.id, subscriberProblemSetId: problemSetId, dataTypes: body.dataTypes },
    );

    console.log(`Subscription requested: ${subscription.id} (${problemSetId} -> ${body.publisherProblemSetId})`);
    res.status(201).json(subscription);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create subscription failed:', message);
    handleError(res, error);
  }
});

/**
 * GET /api/problem-sets/:id/subscriptions - List subscriptions (as subscriber and publisher)
 * Caller must be a member of the problem set.
 */
router.get('/:id/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    // Verify caller is a member
    const member = await problemSetMemberStore.getMember(problemSetId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this problem set' });
    }

    const [asSubscriber, asPublisher] = await Promise.all([
      problemSetSubscriptionStore.listBySubscriber(problemSetId),
      problemSetSubscriptionStore.listByPublisher(problemSetId),
    ]);

    res.json({ asSubscriber, asPublisher });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List subscriptions failed:', message);
    handleError(res, error);
  }
});

/**
 * PATCH /api/problem-sets/:id/subscriptions/:subId - Approve or reject a subscription
 * Caller must be commander or XO of the PUBLISHER problem set (not the subscriber).
 */
router.patch('/:id/subscriptions/:subId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const subId = req.params.subId as string;

    // Get subscription to confirm this problem set is the publisher
    const subscription = await problemSetSubscriptionStore.getSubscription(subId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    if (subscription.publisherProblemSetId !== problemSetId) {
      return res.status(403).json({ error: 'Only the publisher problem set can approve or reject subscriptions' });
    }

    // Caller must be commander/xo of the PUBLISHER problem set
    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    let body: z.infer<typeof UpdateSubscriptionStatusSchema>;
    try {
      body = UpdateSubscriptionStatusSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    const updated = await problemSetSubscriptionStore.updateApprovalStatus(subId, body.status, userDid);

    const activityType = body.status === 'approved' ? 'subscription_approved' : 'subscription_rejected';
    await problemSetActivityStore.log(
      problemSetId,
      activityType,
      userDid,
      null,
      { subscriptionId: subId, subscriberProblemSetId: subscription.subscriberProblemSetId },
    );

    console.log(`Subscription ${subId} ${body.status} by ${userDid}`);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update subscription status failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/problem-sets/:id/subscriptions/:subId - Cancel a subscription
 * Caller must be commander or XO of the SUBSCRIBER problem set.
 */
router.delete('/:id/subscriptions/:subId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const subId = req.params.subId as string;

    // Get subscription to confirm this problem set is the subscriber
    const subscription = await problemSetSubscriptionStore.getSubscription(subId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    if (subscription.subscriberProblemSetId !== problemSetId) {
      return res.status(403).json({ error: 'Only the subscriber problem set can cancel subscriptions' });
    }

    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await problemSetSubscriptionStore.deleteSubscription(subId);

    console.log(`Subscription ${subId} cancelled by ${userDid}`);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete subscription failed:', message);
    handleError(res, error);
  }
});

// ============================================================================
// Escalation Rule Endpoints
// ============================================================================

/**
 * GET /api/problem-sets/:id/escalation-rules - List escalation rules for problem set
 * Requires commander or XO role.
 */
router.get('/:id/escalation-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const rules = await problemSetEscalationStore.listRulesForProblemSet(problemSetId);

    res.json({ rules, count: rules.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List escalation rules failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/problem-sets/:id/escalation-rules - Create an escalation rule
 * Requires commander or XO role.
 */
router.post('/:id/escalation-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    let body: z.infer<typeof EscalationRuleSchema>;
    try {
      body = EscalationRuleSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    const rule = await problemSetEscalationStore.createRule({
      problemSetId,
      ruleType: body.ruleType,
      proposalKind: body.proposalKind,
      thresholdConfig: body.thresholdConfig ?? null,
      votingMechanism: body.votingMechanism,
      autoRouteTo: body.autoRouteTo ?? null,
    });

    console.log(`Escalation rule created: ${rule.id} for problem set ${problemSetId}`);
    res.status(201).json(rule);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create escalation rule failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/problem-sets/:id/escalation-rules/:ruleId - Delete an escalation rule
 * Requires commander or XO role.
 */
router.delete('/:id/escalation-rules/:ruleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;
    const ruleId = req.params.ruleId as string;

    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await problemSetEscalationStore.deleteRule(ruleId);

    console.log(`Escalation rule ${ruleId} deleted from problem set ${problemSetId}`);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete escalation rule failed:', message);
    handleError(res, error);
  }
});

// ============================================================================
// Escalation Trigger Endpoint
// ============================================================================

/**
 * POST /api/problem-sets/:id/escalate - Escalate a decision to parent problem set
 *
 * Creates off-chain activity records in both source and parent problem sets.
 * On-chain proposal creation is deferred until commander credential delegation is implemented.
 *
 * Requires commander or XO role.
 */
router.post('/:id/escalate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const problemSetId = req.params.id as string;

    const problemSet = await problemSetStore.getProblemSet(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }

    try {
      await requireCommanderOrXo(problemSetId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    let body: z.infer<typeof EscalateSchema>;
    try {
      body = EscalateSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    // Verify problem set has a parent to escalate to
    if (!problemSet.parentProblemSetId) {
      return res.status(400).json({ error: 'No parent problem set to escalate to' });
    }

    const parentProblemSet = await problemSetStore.getProblemSet(problemSet.parentProblemSetId);
    if (!parentProblemSet) {
      return res.status(404).json({ error: 'Parent problem set not found' });
    }

    // Look up escalation rules for this proposal kind
    const rules = await problemSetEscalationStore.getRulesForKind(problemSetId, body.proposalKind);
    const matchingRule = rules[0] ?? null;

    // Determine voting mechanism: urgent -> autocratic, else use rule or default democratic
    const votingMechanism =
      body.urgency === 'urgent'
        ? 'autocratic'
        : (matchingRule?.votingMechanism ?? 'democratic');

    // Voting period: autocratic = 1 hour, democratic = 7 days (nanoseconds)
    const votingPeriod = votingMechanism === 'autocratic' ? '3600000000000' : '604800000000000';

    // Create off-chain escalation record in source problem set
    const sourceActivity = await problemSetActivityStore.log(
      problemSetId,
      'decision_escalated',
      userDid,
      null,
      {
        proposalKind: body.proposalKind,
        description: body.description,
        urgency: body.urgency,
        votingMechanism,
        votingPeriod,
        parentProblemSetId: problemSet.parentProblemSetId,
        data: body.data ?? null,
      },
    );

    // Create off-chain escalation record in parent problem set
    await problemSetActivityStore.log(
      problemSet.parentProblemSetId,
      'escalation_received',
      userDid,
      null,
      {
        sourceProblemSetId: problemSetId,
        proposalKind: body.proposalKind,
        description: body.description,
        urgency: body.urgency,
        votingMechanism,
        votingPeriod,
        escalationActivityId: sourceActivity.id,
        data: body.data ?? null,
      },
    );

    console.log(`Decision escalated from ${problemSetId} to ${problemSet.parentProblemSetId} (${body.proposalKind})`);
    res.status(201).json({
      escalationId: sourceActivity.id,
      parentProblemSetId: problemSet.parentProblemSetId,
      votingMechanism,
      votingPeriod,
      status: 'escalated',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Escalate decision failed:', message);
    handleError(res, error);
  }
});

// ============================================================================
// Exercise Position Endpoints (Quick Task 9)
// ============================================================================

const CreatePositionSchema = z.object({
  side: z.enum(['blue', 'red', 'neutral', 'green']),
  title: z.string().min(1).max(200),
  duties: z.string().optional(),
  sortOrder: z.number().int().optional(),
  assignedTo: z.string().max(200).optional(),
  phaseMappings: z.array(z.object({
    exercisePhase: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    duties: z.string().optional(),
  })).optional(),
});

const UpdatePositionSchema = z.object({
  side: z.enum(['blue', 'red', 'neutral', 'green']).optional(),
  title: z.string().min(1).max(200).optional(),
  duties: z.string().optional(),
  sortOrder: z.number().int().optional(),
  assignedTo: z.string().max(200).nullable().optional(),
});

const PhaseMappingsSchema = z.object({
  mappings: z.array(z.object({
    exercisePhase: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    duties: z.string().optional(),
  })),
});

const BulkCreatePositionsSchema = z.object({
  positions: z.array(CreatePositionSchema),
});

/**
 * GET /api/problem-sets/:id/positions - List all positions for a problem set
 */
router.get('/:id/positions', requireAuth, async (req: Request, res: Response) => {
  try {
    await initPositionTables();
    const problemSetId = req.params.id as string;
    const positions = await positionStore.findByProblemSet(problemSetId);
    res.json({ positions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List positions failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/problem-sets/:id/positions - Create a new position
 */
router.post('/:id/positions', requireAuth, async (req: Request, res: Response) => {
  try {
    await initPositionTables();
    const problemSetId = req.params.id as string;

    let body: z.infer<typeof CreatePositionSchema>;
    try {
      body = CreatePositionSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    const position = await positionStore.create(problemSetId, body);
    res.status(201).json({ position });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create position failed:', message);
    handleError(res, error);
  }
});

/**
 * PATCH /api/problem-sets/:id/positions/:positionId - Update a position
 */
router.patch('/:id/positions/:positionId', requireAuth, async (req: Request, res: Response) => {
  try {
    await initPositionTables();
    const positionId = req.params.positionId as string;

    let body: z.infer<typeof UpdatePositionSchema>;
    try {
      body = UpdatePositionSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    const position = await positionStore.update(positionId, body);
    res.json({ position });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update position failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/problem-sets/:id/positions/:positionId - Delete a position
 */
router.delete('/:id/positions/:positionId', requireAuth, async (req: Request, res: Response) => {
  try {
    await initPositionTables();
    const positionId = req.params.positionId as string;
    await positionStore.delete(positionId);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete position failed:', message);
    handleError(res, error);
  }
});

/**
 * PUT /api/problem-sets/:id/positions/:positionId/phase-mappings - Replace phase mappings
 */
router.put('/:id/positions/:positionId/phase-mappings', requireAuth, async (req: Request, res: Response) => {
  try {
    await initPositionTables();
    const positionId = req.params.positionId as string;

    let body: z.infer<typeof PhaseMappingsSchema>;
    try {
      body = PhaseMappingsSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    const mappings = await positionStore.setPhaseMappings(positionId, body.mappings);
    res.json({ mappings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Set phase mappings failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/problem-sets/:id/positions/bulk - Bulk create positions (for template loading)
 */
router.post('/:id/positions/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    await initPositionTables();
    const problemSetId = req.params.id as string;

    let body: z.infer<typeof BulkCreatePositionsSchema>;
    try {
      body = BulkCreatePositionsSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    const positions = await positionStore.bulkCreate(problemSetId, body.positions);
    res.status(201).json({ positions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bulk create positions failed:', message);
    handleError(res, error);
  }
});

// ============================================================================
// ORBAT Reporting Relationships
// ============================================================================

import { memberReportingStore } from '../problem-set/member-reporting-store.js';

/**
 * GET /api/problem-sets/:problemSetId/reporting
 * Get all reporting relationships for a problem set.
 */
router.get('/:problemSetId/reporting', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const relationships = await memberReportingStore.getByProblemSet(problemSetId);
    res.json({ relationships });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * PUT /api/problem-sets/:problemSetId/reporting
 * Replace all reporting relationships for a problem set.
 * Body: { relationships: Array<{ superior_did, subordinate_did, relationship_type }> }
 */
router.put('/:problemSetId/reporting', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const actorDid = (req.headers['x-did'] as string) || undefined;
    const { relationships } = req.body as {
      relationships?: Array<{
        superior_did: string;
        subordinate_did: string;
        relationship_type: 'direct' | 'dotted';
      }>;
    };

    if (!Array.isArray(relationships)) {
      res.status(400).json({ error: 'relationships array is required' });
      return;
    }

    // Validate relationship types
    for (const rel of relationships) {
      if (!rel.superior_did || !rel.subordinate_did) {
        res.status(400).json({ error: 'superior_did and subordinate_did are required' });
        return;
      }
      if (rel.relationship_type !== 'direct' && rel.relationship_type !== 'dotted') {
        res.status(400).json({ error: 'relationship_type must be "direct" or "dotted"' });
        return;
      }
    }

    const result = await memberReportingStore.replaceAll(problemSetId, relationships, actorDid);
    res.json({ relationships: result });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
