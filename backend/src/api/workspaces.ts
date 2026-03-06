/**
 * Workspace API
 * REST endpoints for workspace CRUD, membership, invites, roles, and activity.
 *
 * Phase 19 Plan 03: Workspace REST API
 *
 * All on-chain DAO operations (create_dao, add_member, remove_member, assign_role)
 * are triggered from these routes via signAndSubmitFunctionCall.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { workspaceStore } from '../workspace/workspace-store.js';
import { workspaceMemberStore } from '../workspace/workspace-member-store.js';
import { workspaceInviteStore } from '../workspace/workspace-invite-store.js';
import { workspaceActivityStore } from '../workspace/workspace-activity-store.js';
import { workspaceRoleStore } from '../workspace/workspace-role-store.js';
import { workspaceCompartmentStore } from '../workspace/workspace-compartment-store.js';
import { workspacePanelConfigStore } from '../workspace/workspace-panel-config-store.js';
import { workspaceSubscriptionStore } from '../workspace/workspace-subscription-store.js';
import { workspaceEscalationStore } from '../workspace/workspace-escalation-store.js';
import { signAndSubmitFunctionCall } from '../near/tx-signer.js';
import { clearanceSufficient } from '../workspace/types.js';
import type { AppMode, WorkspaceType } from '../workspace/types.js';
import { ScenarioStore } from '../exercise/scenario-store.js';
import { modeMiddleware } from '../middleware/mode-context.js';

const DAO_CONTRACT_ID = process.env.DAO_CONTRACT_ID || 'dao-registry.testnet';
const scenarioStore = new ScenarioStore();

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  workspaceType: z.enum(['Organization', 'Unit', 'Team']),
  classification: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']).default('UNCLASSIFIED'),
  parentWorkspaceId: z.string().optional(),
  inviteMode: z.enum(['open', 'gated']).default('gated'),
  discoverability: z.enum(['discoverable', 'private']).default('private'),
  mode: z.enum(['training', 'operational']).default('operational'),
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
  publisherWorkspaceId: z.string().min(1),
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
 * Uses a simple derivation for workspace operations — same approach as existing code.
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
 * Check if a user has a given permission in a workspace.
 * Throws an error with HTTP status 403 if permission is missing.
 */
async function checkPermission(
  workspaceId: string,
  userDid: string,
  permission: string,
): Promise<void> {
  const member = await workspaceMemberStore.getMember(workspaceId, userDid);
  if (!member) {
    const err = new Error('Not a member of this workspace');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
  if (member.status === 'suspended') {
    const err = new Error('Your membership is suspended');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }

  const roles = await workspaceRoleStore.getRolesForWorkspace(workspaceId);
  const memberRole = roles.find((r) => r.militaryLabel === member.role);
  if (!memberRole || !memberRole.permissions.includes(permission)) {
    const err = new Error(`Missing permission: ${permission}`);
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
}

/**
 * Determine the hierarchy level of a workspace (0 = root, 1 = child, 2 = grandchild).
 * Used to enforce max 3-level hierarchy.
 */
async function getWorkspaceDepth(workspaceId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = workspaceId;

  while (currentId) {
    const ws = await workspaceStore.getWorkspace(currentId);
    if (!ws || !ws.parentWorkspaceId) break;
    depth++;
    currentId = ws.parentWorkspaceId;
    if (depth > 3) break; // Safety: avoid infinite loop on circular ref
  }

  return depth;
}

/**
 * Check if a user is commander or XO (council-level role) in a workspace.
 * Returns the member record if authorized, throws 403 otherwise.
 */
async function requireCommanderOrXo(
  workspaceId: string,
  userDid: string,
): Promise<void> {
  const member = await workspaceMemberStore.getMember(workspaceId, userDid);
  if (!member) {
    const err = new Error('Not a member of this workspace');
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
// Workspace CRUD Endpoints
// ============================================================================

/**
 * POST /api/workspaces - Create a new workspace
 *
 * Creates off-chain record + triggers on-chain DAO creation.
 * Auto-initializes military role templates and adds creator as commander.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);

    let body: z.infer<typeof CreateWorkspaceSchema>;
    try {
      body = CreateWorkspaceSchema.parse(req.body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (validationError as z.ZodError).issues });
      }
      throw validationError;
    }

    // Validate hierarchy depth if parent specified
    let parentDaoId: string | undefined;
    if (body.parentWorkspaceId) {
      const parent = await workspaceStore.getWorkspace(body.parentWorkspaceId);
      if (!parent) {
        return res.status(404).json({ error: 'Parent workspace not found' });
      }
      parentDaoId = parent.daoId;

      // Check depth — max 3 levels (Organization → Unit → Team)
      const parentDepth = await getWorkspaceDepth(body.parentWorkspaceId);
      if (parentDepth >= 2) {
        return res.status(400).json({ error: 'Maximum workspace hierarchy depth (3 levels) exceeded' });
      }
    }

    // Resolve mode: prefer body param, fall back to middleware-injected userMode, default 'operational'
    const mode = (body.mode ?? (req as unknown as Record<string, unknown>).userMode ?? 'operational') as AppMode;

    // Create off-chain workspace record (generates daoId)
    const workspace = await workspaceStore.createWorkspace(
      {
        name: body.name,
        description: body.description,
        workspaceType: body.workspaceType as WorkspaceType,
        classification: body.classification,
        parentWorkspaceId: body.parentWorkspaceId,
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
        dao_id: workspace.daoId,
        name: workspace.name,
        description: workspace.description ?? '',
        classification: workspace.classification,
      },
    );

    let txHash = createDaoResult.txHash;

    // On-chain: set parent DAO if workspace is a child
    if (parentDaoId) {
      const setParentResult = await signAndSubmitFunctionCall(
        userSecret,
        DAO_CONTRACT_ID,
        'set_dao_parent',
        {
          dao_id: workspace.daoId,
          parent_dao_id: parentDaoId,
        },
      );
      if (setParentResult.txHash) txHash = setParentResult.txHash;
    }

    // Initialize military role templates
    await workspaceRoleStore.initRolesForWorkspace(workspace.id, workspace.workspaceType);

    // Add creator as commander (council DAO role)
    await workspaceMemberStore.addMember(workspace.id, userDid, 'commander', 'council', userDid);

    // Log activity
    await workspaceActivityStore.log(
      workspace.id,
      'workspace_created',
      userDid,
      null,
      { workspaceType: workspace.workspaceType, daoId: workspace.daoId },
      txHash,
    );

    console.log(`✓ Workspace created: ${workspace.id} (DAO: ${workspace.daoId})`);
    res.status(201).json(workspace);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create workspace failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/workspaces/from-scenario - Create a training workspace from an exercise scenario
 *
 * Always creates workspace with mode='training' regardless of user's current mode.
 * Pre-populates workspace with scenario snapshot data.
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

    // Create workspace in training mode (scenarios are inherently training)
    const workspaceName = body.name ?? scenario.name;
    const workspace = await workspaceStore.createWorkspace(
      {
        name: workspaceName,
        description: `Training workspace created from scenario: ${scenario.name}`,
        workspaceType: 'Team' as WorkspaceType,
        classification: 'UNCLASSIFIED',
        inviteMode: 'gated',
        discoverability: 'private',
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
        dao_id: workspace.daoId,
        name: workspace.name,
        description: workspace.description ?? '',
        classification: workspace.classification,
      },
    );

    // Initialize military role templates
    await workspaceRoleStore.initRolesForWorkspace(workspace.id, workspace.workspaceType);

    // Add creator as commander
    await workspaceMemberStore.addMember(workspace.id, userDid, 'commander', 'council', userDid);

    // Log scenario load activity
    await workspaceActivityStore.log(
      workspace.id,
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
        daoId: workspace.daoId,
      },
      createDaoResult.txHash,
    );

    console.log(`✓ Training workspace created from scenario: ${workspace.id} (scenario: ${scenario.id})`);
    res.status(201).json(workspace);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create workspace from scenario failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/workspaces/me - List user's workspace memberships (enriched)
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const mode = req.query.mode as AppMode | undefined;
    const userMode = (req as unknown as Record<string, unknown>).userMode as AppMode | undefined;

    const memberships = await workspaceMemberStore.listMemberships(userDid);

    // Enrich each membership with workspace name and type
    const enriched = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await workspaceStore.getWorkspace(membership.workspaceId);
        return {
          ...membership,
          name: workspace?.name ?? 'Unknown',
          workspaceType: workspace?.workspaceType ?? 'Organization',
          classification: workspace?.classification ?? 'UNCLASSIFIED',
          mode: workspace?.mode ?? 'operational',
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
 * PUT /api/workspaces/me/primary - Set primary workspace
 *
 * Body: { workspaceId: string }
 */
router.put('/me/primary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const { workspaceId } = req.body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    // Verify membership exists
    const member = await workspaceMemberStore.getMember(workspaceId, userDid);
    if (!member) {
      return res.status(404).json({ error: 'You are not a member of this workspace' });
    }

    await workspaceMemberStore.setPrimary(userDid, workspaceId);

    res.json({ success: true, workspaceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Set primary workspace failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/workspaces/invite/accept - Accept a workspace invite
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
    const invite = await workspaceInviteStore.getInviteByToken(token);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found, expired, or already accepted' });
    }

    // Verify invitee matches if targeted
    if (invite.inviteeDid && invite.inviteeDid !== userDid) {
      return res.status(403).json({ error: 'This invite is for a different user' });
    }

    // Get workspace for clearance and mode checks
    const workspace = await workspaceStore.getWorkspace(invite.workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Clearance gate: check user clearance against workspace classification
    // For now, we treat the user's DID scope as UNCLASSIFIED unless profile says otherwise.
    // A future user-profile integration can provide the actual clearance level.
    const userClearance = (req.anonUser as unknown as Record<string, unknown>)?.clearance as string | undefined;
    if (!clearanceSufficient(userClearance ?? 'UNCLASSIFIED', workspace.classification)) {
      return res.status(403).json({
        error: `Insufficient clearance. Workspace requires ${workspace.classification}`,
      });
    }

    // Gated mode: if workspace.inviteMode === 'gated' and invite not yet approved, return 202
    if (workspace.inviteMode === 'gated' && !invite.approvedAt) {
      return res.status(202).json({
        status: 'pending_approval',
        message: 'Your membership request is awaiting approval from a workspace administrator',
        inviteId: invite.id,
      });
    }

    // On-chain: add member to DAO
    const addMemberResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'add_member',
      {
        dao_id: workspace.daoId,
        member_id: userDid,
        role: invite.daoRole,
      },
    );

    // Off-chain: add member record
    const member = await workspaceMemberStore.addMember(
      invite.workspaceId,
      userDid,
      invite.role,
      invite.daoRole,
      invite.createdBy,
    );

    // Mark invite accepted
    await workspaceInviteStore.markAccepted(invite.id);

    // Log activity
    await workspaceActivityStore.log(
      invite.workspaceId,
      'member_joined',
      userDid,
      userDid,
      { inviteId: invite.id, role: invite.role, daoRole: invite.daoRole },
      addMemberResult.txHash,
    );

    console.log(`✓ User ${userDid} accepted invite to workspace ${invite.workspaceId}`);
    res.json({ member, txHash: addMemberResult.txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Accept invite failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/workspaces/notifications/counts - Get unread activity counts
 *
 * Body: { lastSeenMap: Record<string, string> } (workspaceId → ISO timestamp)
 */
router.post('/notifications/counts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const { lastSeenMap } = req.body;

    if (!lastSeenMap || typeof lastSeenMap !== 'object') {
      return res.status(400).json({ error: 'lastSeenMap is required' });
    }

    const counts = await workspaceActivityStore.getUnreadCountsForUser(userDid, lastSeenMap);

    res.json({ counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get unread counts failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Per-Workspace Endpoints (/:id prefix)
// ============================================================================

/**
 * GET /api/workspaces/:id - Get workspace details
 * Caller must be a member.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Verify caller is a member
    const member = await workspaceMemberStore.getMember(workspaceId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const memberCount = await workspaceMemberStore.getMemberCount(workspaceId);

    res.json({ ...workspace, memberCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get workspace failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/workspaces/:id - Update workspace settings
 * Requires manage_workspace permission.
 */
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    try {
      await checkPermission(workspaceId, userDid, 'manage_workspace');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const { name, description, inviteMode, discoverability } = req.body;
    const updated = await workspaceStore.updateWorkspace(workspaceId, {
      name,
      description,
      inviteMode,
      discoverability,
    });

    await workspaceActivityStore.log(
      workspaceId,
      'workspace_updated',
      userDid,
      null,
      { changes: { name, description, inviteMode, discoverability } },
    );

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update workspace failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/workspaces/:id/hierarchy - Get full workspace hierarchy tree
 */
router.get('/:id/hierarchy', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    const hierarchy = await workspaceStore.getHierarchy(workspaceId);

    // Enrich each workspace with member count
    const enriched = await Promise.all(
      hierarchy.map(async (ws) => {
        const memberCount = await workspaceMemberStore.getMemberCount(ws.id);
        return { ...ws, memberCount };
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
 * GET /api/workspaces/:id/members - List workspace members
 */
router.get('/:id/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;

    const members = await workspaceMemberStore.listMembers(workspaceId);

    res.json({ members, count: members.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List members failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/workspaces/:id/members/:memberDid/role - Change member role
 * Requires manage_roles permission.
 */
router.post('/:id/members/:memberDid/role', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
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
      await checkPermission(workspaceId, userDid, 'manage_roles');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Get current member state for activity log metadata
    const currentMember = await workspaceMemberStore.getMember(workspaceId, memberDid);
    if (!currentMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // On-chain: assign new role
    const assignRoleResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'assign_role',
      {
        dao_id: workspace.daoId,
        member_id: memberDid,
        role: body.newDaoRole,
      },
    );

    // Off-chain: update role
    const updated = await workspaceMemberStore.updateRole(
      workspaceId,
      memberDid,
      body.newRole,
      body.newDaoRole,
    );

    await workspaceActivityStore.log(
      workspaceId,
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

    console.log(`✓ Role updated for ${memberDid} in workspace ${workspaceId}`);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Change role failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/workspaces/:id/members/:memberDid/suspend - Suspend member
 * Requires manage_members permission.
 */
router.post('/:id/members/:memberDid/suspend', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const memberDid = req.params.memberDid as string;

    try {
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const suspended = await workspaceMemberStore.suspendMember(workspaceId, memberDid, userDid);

    await workspaceActivityStore.log(
      workspaceId,
      'member_suspended',
      userDid,
      memberDid,
      { suspendedBy: userDid },
    );

    console.log(`✓ Member ${memberDid} suspended in workspace ${workspaceId}`);
    res.json(suspended);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Suspend member failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/workspaces/:id/members/:memberDid/unsuspend - Unsuspend member
 * Requires manage_members permission.
 */
router.post('/:id/members/:memberDid/unsuspend', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const memberDid = req.params.memberDid as string;

    try {
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const unsuspended = await workspaceMemberStore.unsuspendMember(workspaceId, memberDid);

    await workspaceActivityStore.log(
      workspaceId,
      'member_unsuspended',
      userDid,
      memberDid,
      { unsuspendedBy: userDid },
    );

    console.log(`✓ Member ${memberDid} unsuspended in workspace ${workspaceId}`);
    res.json(unsuspended);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unsuspend member failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/workspaces/:id/members/:memberDid - Remove member
 * Requires manage_members permission.
 */
router.delete('/:id/members/:memberDid', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const memberDid = req.params.memberDid as string;

    try {
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // On-chain: remove member from DAO
    const removeMemberResult = await signAndSubmitFunctionCall(
      userSecret,
      DAO_CONTRACT_ID,
      'remove_member',
      {
        dao_id: workspace.daoId,
        member_id: memberDid,
      },
    );

    // Off-chain: remove member record
    await workspaceMemberStore.removeMember(workspaceId, memberDid);

    await workspaceActivityStore.log(
      workspaceId,
      'member_removed',
      userDid,
      memberDid,
      { removedBy: userDid },
      removeMemberResult.txHash,
    );

    console.log(`✓ Member ${memberDid} removed from workspace ${workspaceId}`);
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
 * POST /api/workspaces/:id/invite - Create an invite
 * Requires manage_members permission.
 */
router.post('/:id/invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

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
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const { invite, rawToken } = await workspaceInviteStore.createInvite(
      workspaceId,
      body.role,
      body.daoRole,
      userDid,
      {
        inviteeEmail: body.inviteeEmail,
        inviteeDid: body.inviteeDid,
        expiresInHours: body.expiresInHours,
      },
    );

    await workspaceActivityStore.log(
      workspaceId,
      'invite_sent',
      userDid,
      body.inviteeDid ?? null,
      { role: body.role, daoRole: body.daoRole, inviteId: invite.id },
    );

    console.log(`✓ Invite created for workspace ${workspaceId}: ${invite.id}`);
    // Return invite with raw token (only time it's visible)
    res.status(201).json({ ...invite, token: rawToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create invite failed:', message);
    handleError(res, error);
  }
});

/**
 * GET /api/workspaces/:id/invites - List pending invites
 */
router.get('/:id/invites', requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;

    const invites = await workspaceInviteStore.listPendingInvites(workspaceId);

    // Filter out raw token from response (security)
    const sanitized = invites.map((inv) => ({
      id: inv.id,
      workspaceId: inv.workspaceId,
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
 * POST /api/workspaces/:id/invites/:inviteId/approve - Approve a gated invite
 * Requires manage_members permission.
 */
router.post('/:id/invites/:inviteId/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const inviteId = req.params.inviteId as string;

    try {
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await workspaceInviteStore.markApproved(inviteId, userDid);

    await workspaceActivityStore.log(
      workspaceId,
      'invite_approved',
      userDid,
      null,
      { inviteId, approvedBy: userDid },
    );

    console.log(`✓ Invite ${inviteId} approved by ${userDid}`);
    res.json({ success: true, inviteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Approve invite failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/workspaces/:id/invites/:inviteId - Cancel invite
 * Requires manage_members permission.
 */
router.delete('/:id/invites/:inviteId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const inviteId = req.params.inviteId as string;

    try {
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await workspaceInviteStore.cancelInvite(inviteId);

    await workspaceActivityStore.log(
      workspaceId,
      'invite_cancelled',
      userDid,
      null,
      { inviteId, cancelledBy: userDid },
    );

    console.log(`✓ Invite ${inviteId} cancelled`);
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
 * GET /api/workspaces/:id/roles - List workspace roles
 */
router.get('/:id/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;

    const roles = await workspaceRoleStore.getRolesForWorkspace(workspaceId);

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
 * GET /api/workspaces/:id/activity - List workspace activity
 *
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - types: comma-separated activity types filter
 */
router.get('/:id/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const typesRaw = req.query.types as string | undefined;
    const types = typesRaw ? typesRaw.split(',').map((t) => t.trim()) : undefined;

    const activities = await workspaceActivityStore.listActivities(workspaceId, {
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
        // Non-fatal — just omit display names
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
 * GET /api/workspaces/:id/compartments - List all compartments with members
 * Caller must be a member.
 */
router.get('/:id/compartments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    // Verify caller is a member
    const member = await workspaceMemberStore.getMember(workspaceId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const compartments = await workspaceCompartmentStore.listCompartmentsWithMembers(workspaceId);

    res.json({ compartments, count: compartments.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List compartments failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/workspaces/:id/compartments - Create a compartment
 * Requires manage_workspace or manage_members permission.
 */
router.post('/:id/compartments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

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
      await checkPermission(workspaceId, userDid, 'manage_workspace');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const compartment = await workspaceCompartmentStore.createCompartment(
      workspaceId,
      body.name,
      body.description ?? null,
      userDid,
    );

    await workspaceActivityStore.log(
      workspaceId,
      'compartment_created',
      userDid,
      null,
      { compartmentId: compartment.id, name: compartment.name },
    );

    console.log(`✓ Compartment created: ${compartment.id} (${compartment.name}) in workspace ${workspaceId}`);
    res.status(201).json(compartment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create compartment failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/workspaces/:id/compartments/:cid - Delete a compartment
 * Requires manage_workspace permission.
 */
router.delete('/:id/compartments/:cid', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const compartmentId = req.params.cid as string;

    try {
      await checkPermission(workspaceId, userDid, 'manage_workspace');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Verify compartment belongs to this workspace
    const compartment = await workspaceCompartmentStore.getCompartment(compartmentId);
    if (!compartment || compartment.workspaceId !== workspaceId) {
      return res.status(404).json({ error: 'Compartment not found' });
    }

    await workspaceCompartmentStore.deleteCompartment(compartmentId);

    await workspaceActivityStore.log(
      workspaceId,
      'compartment_deleted',
      userDid,
      null,
      { compartmentId, name: compartment.name },
    );

    console.log(`✓ Compartment ${compartmentId} deleted from workspace ${workspaceId}`);
    res.json({ success: true, compartmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete compartment failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/workspaces/:id/compartments/:cid/members - Assign member to compartment
 * Requires manage_workspace or manage_members permission.
 * Body: { memberDid: string }
 */
router.post('/:id/compartments/:cid/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
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
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Verify compartment belongs to this workspace
    const compartment = await workspaceCompartmentStore.getCompartment(compartmentId);
    if (!compartment || compartment.workspaceId !== workspaceId) {
      return res.status(404).json({ error: 'Compartment not found' });
    }

    // Verify the member being assigned is a workspace member
    const member = await workspaceMemberStore.getMember(workspaceId, body.memberDid);
    if (!member) {
      return res.status(404).json({ error: 'Member not found in workspace' });
    }

    await workspaceCompartmentStore.assignMember(workspaceId, body.memberDid, compartmentId, userDid);

    await workspaceActivityStore.log(
      workspaceId,
      'compartment_member_assigned',
      userDid,
      body.memberDid,
      { compartmentId, compartmentName: compartment.name },
    );

    console.log(`✓ Member ${body.memberDid} assigned to compartment ${compartmentId}`);
    res.json({ success: true, memberDid: body.memberDid, compartmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Assign compartment member failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/workspaces/:id/compartments/:cid/members/:mid - Remove member from compartment
 * Requires manage_members permission.
 */
router.delete('/:id/compartments/:cid/members/:mid', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const compartmentId = req.params.cid as string;
    const memberDid = req.params.mid as string;

    try {
      await checkPermission(workspaceId, userDid, 'manage_members');
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    // Verify compartment belongs to this workspace
    const compartment = await workspaceCompartmentStore.getCompartment(compartmentId);
    if (!compartment || compartment.workspaceId !== workspaceId) {
      return res.status(404).json({ error: 'Compartment not found' });
    }

    await workspaceCompartmentStore.removeMember(workspaceId, memberDid, compartmentId);

    await workspaceActivityStore.log(
      workspaceId,
      'compartment_member_removed',
      userDid,
      memberDid,
      { compartmentId, compartmentName: compartment.name },
    );

    console.log(`✓ Member ${memberDid} removed from compartment ${compartmentId}`);
    res.json({ success: true, memberDid, compartmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Remove compartment member failed:', message);
    handleError(res, error);
  }
});

/**
 * GET /api/workspaces/:id/members/:did/compartments - Get compartments for a specific member
 */
router.get('/:id/members/:did/compartments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const targetDid = req.params.did as string;

    // Must be a member to query
    const callerMember = await workspaceMemberStore.getMember(workspaceId, userDid);
    if (!callerMember) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const compartmentIds = await workspaceCompartmentStore.listCompartmentsForMember(workspaceId, targetDid);

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
 * GET /api/workspaces/:id/panel-config - Get role→tab visibility for a workspace
 * Caller must be a member of the workspace.
 */
router.get('/:id/panel-config', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Verify caller is a member
    const member = await workspaceMemberStore.getMember(workspaceId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const config = await workspacePanelConfigStore.getOrCreateDefault(workspaceId, workspace.workspaceType);

    res.json({ panelVisibility: config.panelVisibility, defaultTab: config.defaultTab });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get panel config failed:', message);
    handleError(res, error);
  }
});

/**
 * PUT /api/workspaces/:id/panel-config - Update panel visibility
 * Requires commander or XO role.
 */
router.put('/:id/panel-config', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    try {
      await requireCommanderOrXo(workspaceId, userDid);
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

    const config = await workspacePanelConfigStore.upsertConfig(
      workspaceId,
      body.panelVisibility as Record<string, string[]>,
      body.defaultTab,
    );

    await workspaceActivityStore.log(
      workspaceId,
      'panel_config_updated',
      userDid,
      null,
      { defaultTab: config.defaultTab },
    );

    console.log(`✓ Panel config updated for workspace ${workspaceId}`);
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
 * POST /api/workspaces/:id/subscriptions - Request subscription to another workspace's data
 * Caller must be commander or XO of the subscriber workspace (:id).
 */
router.post('/:id/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    try {
      await requireCommanderOrXo(workspaceId, userDid);
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

    // Get publisher workspace for clearance check
    const publisherWorkspace = await workspaceStore.getWorkspace(body.publisherWorkspaceId);
    if (!publisherWorkspace) {
      return res.status(404).json({ error: 'Publisher workspace not found' });
    }

    // Classification check: subscriber must have sufficient clearance for publisher
    if (!clearanceSufficient(workspace.classification, publisherWorkspace.classification)) {
      return res.status(403).json({
        error: `Insufficient clearance. Publisher workspace requires ${publisherWorkspace.classification}`,
      });
    }

    const subscription = await workspaceSubscriptionStore.createSubscription({
      subscriberWorkspaceId: workspaceId,
      publisherWorkspaceId: body.publisherWorkspaceId,
      dataTypes: body.dataTypes,
      requestedBy: userDid,
    });

    // Log activity in both workspaces
    await workspaceActivityStore.log(
      workspaceId,
      'subscription_requested',
      userDid,
      null,
      { subscriptionId: subscription.id, publisherWorkspaceId: body.publisherWorkspaceId, dataTypes: body.dataTypes },
    );
    await workspaceActivityStore.log(
      body.publisherWorkspaceId,
      'subscription_requested',
      userDid,
      null,
      { subscriptionId: subscription.id, subscriberWorkspaceId: workspaceId, dataTypes: body.dataTypes },
    );

    console.log(`✓ Subscription requested: ${subscription.id} (${workspaceId} → ${body.publisherWorkspaceId})`);
    res.status(201).json(subscription);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create subscription failed:', message);
    handleError(res, error);
  }
});

/**
 * GET /api/workspaces/:id/subscriptions - List subscriptions (as subscriber and publisher)
 * Caller must be a member of the workspace.
 */
router.get('/:id/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    // Verify caller is a member
    const member = await workspaceMemberStore.getMember(workspaceId, userDid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const [asSubscriber, asPublisher] = await Promise.all([
      workspaceSubscriptionStore.listBySubscriber(workspaceId),
      workspaceSubscriptionStore.listByPublisher(workspaceId),
    ]);

    res.json({ asSubscriber, asPublisher });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List subscriptions failed:', message);
    handleError(res, error);
  }
});

/**
 * PATCH /api/workspaces/:id/subscriptions/:subId - Approve or reject a subscription
 * Caller must be commander or XO of the PUBLISHER workspace (not the subscriber).
 */
router.patch('/:id/subscriptions/:subId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const subId = req.params.subId as string;

    // Get subscription to confirm this workspace is the publisher
    const subscription = await workspaceSubscriptionStore.getSubscription(subId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    if (subscription.publisherWorkspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Only the publisher workspace can approve or reject subscriptions' });
    }

    // Caller must be commander/xo of the PUBLISHER workspace
    try {
      await requireCommanderOrXo(workspaceId, userDid);
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

    const updated = await workspaceSubscriptionStore.updateApprovalStatus(subId, body.status, userDid);

    const activityType = body.status === 'approved' ? 'subscription_approved' : 'subscription_rejected';
    await workspaceActivityStore.log(
      workspaceId,
      activityType,
      userDid,
      null,
      { subscriptionId: subId, subscriberWorkspaceId: subscription.subscriberWorkspaceId },
    );

    console.log(`✓ Subscription ${subId} ${body.status} by ${userDid}`);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update subscription status failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/workspaces/:id/subscriptions/:subId - Cancel a subscription
 * Caller must be commander or XO of the SUBSCRIBER workspace.
 */
router.delete('/:id/subscriptions/:subId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const subId = req.params.subId as string;

    // Get subscription to confirm this workspace is the subscriber
    const subscription = await workspaceSubscriptionStore.getSubscription(subId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    if (subscription.subscriberWorkspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Only the subscriber workspace can cancel subscriptions' });
    }

    try {
      await requireCommanderOrXo(workspaceId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await workspaceSubscriptionStore.deleteSubscription(subId);

    console.log(`✓ Subscription ${subId} cancelled by ${userDid}`);
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
 * GET /api/workspaces/:id/escalation-rules - List escalation rules for workspace
 * Requires commander or XO role.
 */
router.get('/:id/escalation-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    try {
      await requireCommanderOrXo(workspaceId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    const rules = await workspaceEscalationStore.listRulesForWorkspace(workspaceId);

    res.json({ rules, count: rules.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List escalation rules failed:', message);
    handleError(res, error);
  }
});

/**
 * POST /api/workspaces/:id/escalation-rules - Create an escalation rule
 * Requires commander or XO role.
 */
router.post('/:id/escalation-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    try {
      await requireCommanderOrXo(workspaceId, userDid);
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

    const rule = await workspaceEscalationStore.createRule({
      workspaceId,
      ruleType: body.ruleType,
      proposalKind: body.proposalKind,
      thresholdConfig: body.thresholdConfig ?? null,
      votingMechanism: body.votingMechanism,
      autoRouteTo: body.autoRouteTo ?? null,
    });

    console.log(`✓ Escalation rule created: ${rule.id} for workspace ${workspaceId}`);
    res.status(201).json(rule);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create escalation rule failed:', message);
    handleError(res, error);
  }
});

/**
 * DELETE /api/workspaces/:id/escalation-rules/:ruleId - Delete an escalation rule
 * Requires commander or XO role.
 */
router.delete('/:id/escalation-rules/:ruleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;
    const ruleId = req.params.ruleId as string;

    try {
      await requireCommanderOrXo(workspaceId, userDid);
    } catch (permErr) {
      const msg = permErr instanceof Error ? permErr.message : 'Forbidden';
      return res.status(403).json({ error: msg });
    }

    await workspaceEscalationStore.deleteRule(ruleId);

    console.log(`✓ Escalation rule ${ruleId} deleted from workspace ${workspaceId}`);
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
 * POST /api/workspaces/:id/escalate - Escalate a decision to parent workspace
 *
 * Creates off-chain activity records in both source and parent workspaces.
 * On-chain proposal creation is deferred until commander credential delegation is implemented.
 *
 * Requires commander or XO role.
 */
router.post('/:id/escalate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userDid = buildDID(req.anonUser!.nearAccountId);
    const workspaceId = req.params.id as string;

    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    try {
      await requireCommanderOrXo(workspaceId, userDid);
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

    // Verify workspace has a parent to escalate to
    if (!workspace.parentWorkspaceId) {
      return res.status(400).json({ error: 'No parent workspace to escalate to' });
    }

    const parentWorkspace = await workspaceStore.getWorkspace(workspace.parentWorkspaceId);
    if (!parentWorkspace) {
      return res.status(404).json({ error: 'Parent workspace not found' });
    }

    // Look up escalation rules for this proposal kind
    const rules = await workspaceEscalationStore.getRulesForKind(workspaceId, body.proposalKind);
    const matchingRule = rules[0] ?? null;

    // Determine voting mechanism: urgent → autocratic, else use rule or default democratic
    const votingMechanism =
      body.urgency === 'urgent'
        ? 'autocratic'
        : (matchingRule?.votingMechanism ?? 'democratic');

    // Voting period: autocratic = 1 hour, democratic = 7 days (nanoseconds)
    const votingPeriod = votingMechanism === 'autocratic' ? '3600000000000' : '604800000000000';

    // Create off-chain escalation record in source workspace
    const sourceActivity = await workspaceActivityStore.log(
      workspaceId,
      'decision_escalated',
      userDid,
      null,
      {
        proposalKind: body.proposalKind,
        description: body.description,
        urgency: body.urgency,
        votingMechanism,
        votingPeriod,
        parentWorkspaceId: workspace.parentWorkspaceId,
        data: body.data ?? null,
      },
    );

    // Create off-chain escalation record in parent workspace
    await workspaceActivityStore.log(
      workspace.parentWorkspaceId,
      'escalation_received',
      userDid,
      null,
      {
        sourceWorkspaceId: workspaceId,
        proposalKind: body.proposalKind,
        description: body.description,
        urgency: body.urgency,
        votingMechanism,
        votingPeriod,
        escalationActivityId: sourceActivity.id,
        data: body.data ?? null,
      },
    );

    console.log(`✓ Decision escalated from ${workspaceId} to ${workspace.parentWorkspaceId} (${body.proposalKind})`);
    res.status(201).json({
      escalationId: sourceActivity.id,
      parentWorkspaceId: workspace.parentWorkspaceId,
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

export default router;
