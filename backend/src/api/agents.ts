/**
 * Agent API Routes
 *
 * REST API endpoints for AI governance agents:
 * - Agent registry (list, get, register, deactivate)
 * - Delegation management (create, list, revoke)
 * - Capability execution
 * - Action audit log
 */

import { Router, Request, Response } from 'express';
import { getAgentRegistry } from '../agents/registry.js';
import { getAgentExecutor } from '../agents/executor.js';
import {
  AgentCapability,
  AgentPhase,
  AutonomyLevel,
  DelegationScope,
  ProposalKind,
} from '../agents/types.js';

const router = Router();

// ==========================================================================
// Agent Registry Endpoints
// ==========================================================================

/**
 * GET /api/agents
 * List all agents, optionally filtered by phase.
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const phase = req.query.phase as AgentPhase | undefined;

    const agents = registry.listAgents(phase);

    res.json({
      success: true,
      data: agents.map((agent) => ({
        ...agent,
        createdAt: agent.createdAt.toISOString(),
      })),
      count: agents.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/agents/:agentId
 * Get a specific agent by ID.
 */
router.get('/:agentId', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const agentId = req.params.agentId as string;

    const agent = registry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ success: false, error: `Agent ${agentId} not found` });
      return;
    }

    res.json({
      success: true,
      data: {
        ...agent,
        createdAt: agent.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/agents
 * Register a new agent. Admin only in production.
 */
router.post('/', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const {
      agentId,
      name,
      description,
      phase,
      capabilities,
      maxAutonomy,
      allowedProposalKinds,
      requiresHumanApproval,
      createdBy,
    } = req.body;

    // Validate required fields
    if (!agentId || !name || !phase || !capabilities || !createdBy) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: agentId, name, phase, capabilities, createdBy',
      });
      return;
    }

    // Validate phase
    if (!Object.values(AgentPhase).includes(phase)) {
      res.status(400).json({
        success: false,
        error: `Invalid phase. Must be one of: ${Object.values(AgentPhase).join(', ')}`,
      });
      return;
    }

    // Validate capabilities
    for (const cap of capabilities) {
      if (!Object.values(AgentCapability).includes(cap)) {
        res.status(400).json({
          success: false,
          error: `Invalid capability: ${cap}`,
        });
        return;
      }
    }

    // Default values
    const safeProposalKinds = allowedProposalKinds || [
      ProposalKind.ConfigChange,
      ProposalKind.AddMember,
      ProposalKind.RemoveMember,
      ProposalKind.Transfer,
      ProposalKind.FunctionCall,
      ProposalKind.MissionOrder,
      ProposalKind.Custom,
    ];

    // Ensure strike auth is always in requiresHumanApproval
    const humanApprovalKinds = requiresHumanApproval || [];
    if (!humanApprovalKinds.includes(ProposalKind.StrikeAuthorization)) {
      humanApprovalKinds.push(ProposalKind.StrikeAuthorization);
    }

    registry.registerAgent({
      agentId,
      name,
      description: description || '',
      phase,
      capabilities,
      maxAutonomy: maxAutonomy || AutonomyLevel.SemiAutonomous,
      allowedProposalKinds: safeProposalKinds,
      requiresHumanApproval: humanApprovalKinds,
      createdAt: new Date(),
      createdBy,
      active: true,
    });

    res.status(201).json({
      success: true,
      message: `Agent ${agentId} registered successfully`,
      data: { agentId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * PUT /api/agents/:agentId/deactivate
 * Deactivate an agent.
 */
router.put('/:agentId/deactivate', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const agentId = req.params.agentId as string;

    registry.deactivateAgent(agentId);

    res.json({
      success: true,
      message: `Agent ${agentId} deactivated`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ==========================================================================
// Delegation Endpoints
// ==========================================================================

/**
 * GET /api/agents/:agentId/delegations
 * Get delegations for a specific agent.
 */
router.get('/:agentId/delegations', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const agentId = req.params.agentId as string;

    const delegations = registry.getDelegationsForAgent(agentId);

    res.json({
      success: true,
      data: delegations.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        expiresAt: d.expiresAt?.toISOString(),
      })),
      count: delegations.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/agents/:agentId/delegations
 * Create a delegation for an agent.
 */
router.post('/:agentId/delegations', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const agentId = req.params.agentId as string;
    const { delegatorDID, daoId, scope, maxAutonomy, expiresAt } = req.body;

    // Validate required fields
    if (!delegatorDID || !daoId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: delegatorDID, daoId',
      });
      return;
    }

    // Build scope with safe defaults
    const delegationScope: DelegationScope = {
      proposalKinds: scope?.proposalKinds || [
        ProposalKind.ConfigChange,
        ProposalKind.AddMember,
        ProposalKind.RemoveMember,
        ProposalKind.Transfer,
        ProposalKind.FunctionCall,
        ProposalKind.MissionOrder,
        ProposalKind.Custom,
      ],
      maxClassification: scope?.maxClassification || 'Public',
      excludeStrikeAuth: true, // Always true
    };

    // Ensure strike auth is never in scope
    delegationScope.proposalKinds = delegationScope.proposalKinds.filter(
      (k: ProposalKind) => k !== ProposalKind.StrikeAuthorization
    );

    const delegationId = registry.createDelegation({
      agentId,
      delegatorDID,
      daoId,
      scope: delegationScope,
      maxAutonomy: maxAutonomy || AutonomyLevel.SemiAutonomous,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Delegation created successfully',
      data: { delegationId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/agents/delegations/:delegationId
 * Revoke a delegation.
 */
router.delete('/delegations/:delegationId', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const delegationId = req.params.delegationId as string;

    registry.revokeDelegation(delegationId);

    res.json({
      success: true,
      message: `Delegation ${delegationId} revoked`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ==========================================================================
// Execution Endpoints
// ==========================================================================

/**
 * POST /api/agents/:agentId/execute
 * Execute an agent capability.
 */
router.post('/:agentId/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const executor = getAgentExecutor();
    const agentId = req.params.agentId as string;
    const { capability, daoId, proposalId, input, userDID } = req.body;

    // Validate required fields
    if (!capability || !daoId || !userDID) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: capability, daoId, userDID',
      });
      return;
    }

    // Validate capability
    if (!Object.values(AgentCapability).includes(capability)) {
      res.status(400).json({
        success: false,
        error: `Invalid capability: ${capability}`,
      });
      return;
    }

    const result = await executor.executeCapability(
      agentId,
      capability,
      daoId,
      proposalId ?? null,
      input || {},
      userDID
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/agents/:agentId/analyze-all
 * Analyze all active proposals in a DAO.
 */
router.post('/:agentId/analyze-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const executor = getAgentExecutor();
    const agentId = req.params.agentId as string;
    const { daoId, userDID } = req.body;

    // Validate required fields
    if (!daoId || !userDID) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: daoId, userDID',
      });
      return;
    }

    const results = await executor.analyzeAllActiveProposals(agentId, daoId, userDID);

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================================================
// Action Log Endpoints
// ==========================================================================

/**
 * GET /api/agents/:agentId/actions
 * Get action history for an agent.
 */
router.get('/:agentId/actions', (req: Request, res: Response): void => {
  try {
    const registry = getAgentRegistry();
    const agentId = req.params.agentId as string;
    const limit = parseInt(req.query.limit as string) || 100;

    const actions = registry.getActionsForAgent(agentId, limit);

    res.json({
      success: true,
      data: actions.map((a) => ({
        ...a,
        timestamp: a.timestamp.toISOString(),
      })),
      count: actions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================================================
// Governance Copilot Endpoints
// ==========================================================================

/**
 * GET /api/agents/governance-copilot/analyze
 * Get full copilot analysis for a proposal.
 * Returns summary, context, and voting guidance.
 */
router.get('/governance-copilot/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const daoId = req.query.daoId as string;
    const proposalId = parseInt(req.query.proposalId as string);

    // Validate required parameters
    if (!daoId || isNaN(proposalId)) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: daoId, proposalId',
      });
      return;
    }

    // Import governanceCopilot and DAOService
    const { governanceCopilot } = await import('../agents/copilot.js');
    const { getDAOService } = await import('../dao/dao-service.js');
    const daoService = getDAOService();

    // Get DAO and proposal
    const dao = await daoService.getDAO(daoId);
    if (!dao) {
      res.status(404).json({
        success: false,
        error: `DAO ${daoId} not found`,
      });
      return;
    }

    const proposal = await daoService.getProposal(daoId, proposalId);
    if (!proposal) {
      res.status(404).json({
        success: false,
        error: `Proposal ${proposalId} not found in DAO ${daoId}`,
      });
      return;
    }

    // Get related proposals for context
    const allProposals = await daoService.listProposals(daoId, 0, 20);
    const relatedProposals = allProposals.filter((p) => p.id !== proposalId);

    // Get user info from headers (if available)
    const _userDID = req.headers['x-did'] as string | undefined;
    const userRoles = (req.query.userRoles as string)?.split(',') || [];
    const userParty = req.query.userParty as string | undefined;

    // Run full copilot analysis
    const analysis = await governanceCopilot.analyze(
      proposal,
      dao,
      relatedProposals,
      userRoles,
      userParty
    );

    res.json({
      success: true,
      data: {
        summary: analysis.summary,
        context: analysis.context,
        guidance: analysis.guidance,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
