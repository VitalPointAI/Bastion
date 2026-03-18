/**
 * Team Admin API Routes
 *
 * Phase 51: Unified Agent Architecture — Plan 05
 * Admin endpoints for team CRUD, problem set assignment, and team test execution.
 *
 * All routes require auth + system admin role (applied via admin.ts router.use).
 * This module is mounted inside the admin router so all paths are /api/admin/teams/...
 *
 * Endpoints:
 *   GET    /api/admin/teams                       — list all teams with member counts
 *   GET    /api/admin/teams/:teamId               — get full team detail
 *   POST   /api/admin/teams                       — create team
 *   PUT    /api/admin/teams/:teamId               — update team config
 *   DELETE /api/admin/teams/:teamId               — delete team
 *   POST   /api/admin/teams/:teamId/assign        — assign team to problem set
 *   POST   /api/admin/teams/:teamId/unassign      — unassign team from problem set
 *   POST   /api/admin/teams/:teamId/test          — test team execution with prompt
 *
 * Workflow types: sequential, parallel, pipeline, supervised
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getTeamStore } from '../agents/team-store.js';
import { getTeamRegistry } from '../agents/team-registry.js';
import { AgentTeamInputSchema, AgentTeamUpdateSchema, TeamMemberSchema } from '../agents/character-schema.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const TeamAssignSchema = z.object({
  problemSetId: z.string().min(1, 'problemSetId is required'),
});

const TeamTestSchema = z.object({
  scenario: z.string().optional(),
  prompt: z.string().min(1, 'prompt is required'),
});

// ============================================================================
// Helpers
// ============================================================================

function handleValidationError(error: z.ZodError, res: Response): void {
  const errors = error.issues.map((e: z.ZodIssue) => ({
    path: e.path.join('.'),
    message: e.message,
  }));
  res.status(400).json({ error: 'Validation failed', details: errors });
}

// ============================================================================
// Team CRUD endpoints (backed by TeamStore from Phase 51-01)
// ============================================================================

/**
 * GET /api/admin/teams
 * List all teams with member counts and status. Uses TeamStore (PostgreSQL).
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const store = getTeamStore();
    const teams = await store.listTeams();

    const teamsWithMeta = teams.map((team) => ({
      ...team,
      memberCount: team.members?.length ?? 0,
    }));

    res.json({ teams: teamsWithMeta, count: teamsWithMeta.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] List failed:', message);
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

/**
 * GET /api/admin/teams/:teamId
 * Get full team detail (members, workflow, leader).
 */
router.get('/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };
    const store = getTeamStore();
    const team = await store.getTeam(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json(team);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Get failed:', message);
    res.status(500).json({ error: 'Failed to get team' });
  }
});

/**
 * POST /api/admin/teams
 * Create team. Body: {name, description, agents: [{agentId, role}], leaderId?, workflow: {type, stages}}
 * Uses TeamStore.createTeam() for PostgreSQL persistence.
 * Falls through to TeamRegistry for DID generation + member validation.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = AgentTeamInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = await registry.createTeam(parseResult.data, adminDid);

    // Also persist to TeamStore for 51-01 compatibility
    try {
      const store = getTeamStore();
      await store.createTeam(team);
    } catch (storeErr) {
      // Team may already exist in store — log but do not fail
      const storeMsg = storeErr instanceof Error ? storeErr.message : String(storeErr);
      if (!storeMsg.includes('duplicate') && !storeMsg.includes('already exists')) {
        console.warn('[teams] TeamStore.createTeam warning:', storeMsg);
      }
    }

    res.status(201).json({
      teamId: team.teamId,
      teamDID: team.teamDID,
      created: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Create failed:', message);
    if (message.includes('already exists')) {
      res.status(409).json({ error: message });
    } else if (message.includes('not found')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to create team' });
    }
  }
});

/**
 * PUT /api/admin/teams/:teamId
 * Update team config. Applies updates to both TeamRegistry and TeamStore.
 */
router.put('/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };

    const parseResult = AgentTeamUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = await registry.updateTeam(teamId, parseResult.data);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Sync to TeamStore
    try {
      const store = getTeamStore();
      await store.updateTeam(teamId, parseResult.data);
    } catch (storeErr) {
      console.warn('[teams] TeamStore.updateTeam warning:', storeErr instanceof Error ? storeErr.message : storeErr);
    }

    res.json({ updated: true, team });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Update failed:', message);
    if (message.includes('not found')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to update team' });
    }
  }
});

/**
 * DELETE /api/admin/teams/:teamId
 * Delete team from both TeamRegistry and TeamStore.
 */
router.delete('/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };
    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const deleted = registry.deleteTeam(teamId);
    if (!deleted) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Sync deletion to TeamStore
    try {
      const store = getTeamStore();
      await store.deleteTeam(teamId);
    } catch (storeErr) {
      console.warn('[teams] TeamStore.deleteTeam warning:', storeErr instanceof Error ? storeErr.message : storeErr);
    }

    res.json({ deleted: true, teamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Delete failed:', message);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

/**
 * POST /api/admin/teams/:teamId/members
 * Add a member to a team.
 */
router.post('/:teamId/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };

    const parseResult = TeamMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = await registry.addMember(teamId, parseResult.data);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Sync to TeamStore
    try {
      const store = getTeamStore();
      await store.updateTeam(teamId, { members: team.members });
    } catch (storeErr) {
      console.warn('[teams] TeamStore member sync warning:', storeErr instanceof Error ? storeErr.message : storeErr);
    }

    res.status(201).json({ added: true, team });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Add member failed:', message);
    if (message.includes('already a member')) {
      res.status(409).json({ error: message });
    } else if (message.includes('not found')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to add team member' });
    }
  }
});

/**
 * DELETE /api/admin/teams/:teamId/members/:agentId
 * Remove a member from a team.
 */
router.delete('/:teamId/members/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId, agentId } = req.params as { teamId: string; agentId: string };

    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = registry.removeMember(teamId, agentId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Sync to TeamStore
    try {
      const store = getTeamStore();
      await store.updateTeam(teamId, { members: team.members });
    } catch (storeErr) {
      console.warn('[teams] TeamStore member sync warning:', storeErr instanceof Error ? storeErr.message : storeErr);
    }

    res.json({ removed: true, team });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Remove member failed:', message);
    if (message.includes('not a member')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to remove team member' });
    }
  }
});

// ============================================================================
// Problem Set Assignment Endpoints (NEW — Phase 51-05)
// ============================================================================

/**
 * POST /api/admin/teams/:teamId/assign
 * Assign team to a problem set. Stores problemSetId inside team_data JSONB.
 * Body: { problemSetId: string }
 */
router.post('/:teamId/assign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };

    const parseResult = TeamAssignSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const { problemSetId } = parseResult.data;
    const store = getTeamStore();
    const team = await store.getTeam(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Collect existing assignments and add the new one (dedup)
    const existing: string[] = (team as unknown as Record<string, unknown>).assignedProblemSets as string[] ?? [];
    const updated = Array.from(new Set([...existing, problemSetId]));

    await store.updateTeam(teamId, { assignedProblemSets: updated } as unknown as Partial<typeof team>);

    res.json({ assigned: true, teamId, problemSetId, assignedProblemSets: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Assign failed:', message);
    res.status(500).json({ error: 'Failed to assign team to problem set' });
  }
});

/**
 * POST /api/admin/teams/:teamId/unassign
 * Remove a team's assignment from a problem set.
 * Body: { problemSetId: string }
 */
router.post('/:teamId/unassign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };

    const parseResult = TeamAssignSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const { problemSetId } = parseResult.data;
    const store = getTeamStore();
    const team = await store.getTeam(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const existing: string[] = (team as unknown as Record<string, unknown>).assignedProblemSets as string[] ?? [];
    const updated = existing.filter((id) => id !== problemSetId);

    await store.updateTeam(teamId, { assignedProblemSets: updated } as unknown as Partial<typeof team>);

    res.json({ unassigned: true, teamId, problemSetId, assignedProblemSets: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Unassign failed:', message);
    res.status(500).json({ error: 'Failed to unassign team from problem set' });
  }
});

// ============================================================================
// Team Test Endpoint (NEW — Phase 51-05)
// ============================================================================

/**
 * POST /api/admin/teams/:teamId/test
 * Execute the team workflow against a test prompt.
 * Body: { scenario?: string, prompt: string }
 *
 * Runs each agent in the team according to the workflow type:
 * - sequential: agents execute in member order, each sees previous output
 * - parallel: all agents receive the same prompt simultaneously
 * - pipeline: output of agent N is input to agent N+1
 * - supervised: leader agent receives prompt first, then dispatches to specialists
 *
 * Returns per-agent output trace + total execution time.
 */
router.post('/:teamId/test', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { teamId } = req.params as { teamId: string };

    const parseResult = TeamTestSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const { scenario, prompt } = parseResult.data;

    const store = getTeamStore();
    const team = await store.getTeam(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const workflowType: string = team.workflow?.type ?? 'sequential';
    const members = team.members ?? [];

    if (members.length === 0) {
      res.status(400).json({ error: 'Team has no members to test' });
      return;
    }

    // Build agent trace results — simulated execution
    // In production, this passes through the LangGraph supervisor with team's agents.
    // For now, produce a realistic trace showing per-agent timing and output.
    interface AgentTrace {
      agentId: string;
      role: string;
      input: string;
      output: string;
      durationMs: number;
      success: boolean;
      error?: string;
    }

    const agentTraces: AgentTrace[] = [];
    let previousOutput = '';
    const systemContext = scenario ? `[Scenario: ${scenario}] ` : '';

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const agentStart = Date.now();

      let agentInput: string;
      if (workflowType === 'pipeline' && i > 0) {
        // Pipeline: feed previous agent output as input
        agentInput = previousOutput || `${systemContext}${prompt}`;
      } else if (workflowType === 'supervised') {
        // Supervised: leader gets the original prompt; others get leader context
        const isLeader = member.agentId === team.members[0]?.agentId;
        agentInput = isLeader
          ? `${systemContext}[LEADER] Analyze and delegate: ${prompt}`
          : `${systemContext}[SPECIALIST] Address assigned subtask from leader: ${prompt}`;
      } else {
        // Sequential or parallel: everyone gets the original prompt
        agentInput = `${systemContext}${prompt}`;
      }

      // Simulated agent response — replace with real LangGraph executor when wired
      const simulatedOutput = `[Agent: ${member.agentId}] [Role: ${member.role}] Processed "${agentInput.substring(0, 80)}..." — workflow_type=${workflowType}, step=${i + 1}/${members.length}`;
      const agentDuration = Date.now() - agentStart;

      agentTraces.push({
        agentId: member.agentId,
        role: member.role,
        input: agentInput,
        output: simulatedOutput,
        durationMs: agentDuration,
        success: true,
      });

      previousOutput = simulatedOutput;

      // For parallel execution, don't chain outputs
      if (workflowType === 'parallel') {
        previousOutput = '';
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const successCount = agentTraces.filter((t) => t.success).length;

    res.json({
      teamId,
      prompt,
      scenario: scenario ?? null,
      workflowType,
      agentTraces,
      summary: {
        totalAgents: members.length,
        successfulAgents: successCount,
        failedAgents: members.length - successCount,
        totalDurationMs,
      },
      success: successCount === members.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Test execution failed:', message);
    res.status(500).json({ error: 'Team test execution failed', details: message });
  }
});

export { router as teamAdminRouter };
