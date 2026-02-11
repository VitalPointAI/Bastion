/**
 * MDMP REST API Routes
 *
 * Exposes MDMP workflow operations via HTTP endpoints.
 *
 * Endpoints:
 * - POST /api/mdmp/workflows - Create new workflow
 * - GET /api/mdmp/workflows/:missionId - Get workflow state
 * - POST /api/mdmp/workflows/:missionId/gates - Register phase gates
 * - PUT /api/mdmp/workflows/:missionId/gates/:gateId - Satisfy a gate
 * - POST /api/mdmp/workflows/:missionId/transitions - Request phase transition
 * - GET /api/mdmp/workflows/:missionId/assumptions - Get assumptions
 * - POST /api/mdmp/workflows/:missionId/assumptions - Register assumption
 * - PUT /api/mdmp/workflows/:missionId/assumptions/:id/accept - Accept assumption
 * - GET /api/mdmp/activities - Get all activities
 * - GET /api/mdmp/activities/:id - Get activity by ID
 * - GET /api/mdmp/phases/:phase/statistics - Get phase statistics
 */

import { Router, type Request, type Response } from 'express';
import { mdmpWorkflowService } from '../mdmp/workflow-service.js';
import { getActivityById, ALL_ACTIVITIES, getPhaseStatistics } from '../mdmp/activity-registry.js';
import { MDMPPhase } from '../mdmp/types.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/mdmp/workflows
 * Create a new MDMP workflow
 */
router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const { missionId, daoId, createdBy } = req.body;

    if (!missionId || !daoId || !createdBy) {
      return res.status(400).json({
        error: 'Missing required fields: missionId, daoId, createdBy',
      });
    }

    const workflow = await mdmpWorkflowService.createWorkflow({
      missionId,
      daoId,
      createdBy,
    });

    res.status(201).json({
      success: true,
      workflow: {
        missionId: workflow.missionId,
        daoId: workflow.daoId,
        currentPhase: workflow.currentPhase,
        createdAt: workflow.createdAt,
        createdBy: workflow.createdBy,
      },
    });
  } catch (error) {
    console.error('[MDMP API] Error creating workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create workflow',
    });
  }
});

/**
 * GET /api/mdmp/workflows/:missionId
 * Get workflow state
 */
router.get('/workflows/:missionId', async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;

    const workflow = await mdmpWorkflowService.getWorkflowState(missionId);

    if (!workflow) {
      return res.status(404).json({
        error: `Workflow not found for mission ${missionId}`,
      });
    }

    // Convert Map to object for JSON serialization
    const phaseGates: Record<string, any> = {};
    workflow.phaseGates.forEach((gate, gateId) => {
      phaseGates[gateId] = gate;
    });

    res.json({
      success: true,
      workflow: {
        missionId: workflow.missionId,
        daoId: workflow.daoId,
        currentPhase: workflow.currentPhase,
        createdAt: workflow.createdAt,
        createdBy: workflow.createdBy,
        phaseGates,
        assumptions: workflow.assumptions,
        phaseTransitions: workflow.phaseTransitions,
      },
    });
  } catch (error) {
    console.error('[MDMP API] Error getting workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get workflow',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Gate Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/mdmp/workflows/:missionId/gates
 * Register phase gates
 */
router.post('/workflows/:missionId/gates', async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    const { phase } = req.body;

    if (!phase) {
      return res.status(400).json({
        error: 'Missing required field: phase',
      });
    }

    await mdmpWorkflowService.registerPhaseGates(missionId, phase as MDMPPhase);

    res.json({
      success: true,
      message: `Gates registered for phase ${phase}`,
    });
  } catch (error) {
    console.error('[MDMP API] Error registering gates:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to register gates',
    });
  }
});

/**
 * PUT /api/mdmp/workflows/:missionId/gates/:gateId
 * Satisfy a gate
 */
router.put('/workflows/:missionId/gates/:gateId', async (req: Request, res: Response) => {
  try {
    const { missionId, gateId } = req.params;
    const { satisfiedBy, proposalId } = req.body;

    if (!satisfiedBy) {
      return res.status(400).json({
        error: 'Missing required field: satisfiedBy',
      });
    }

    await mdmpWorkflowService.satisfyGate({
      missionId,
      gateId,
      satisfiedBy,
      proposalId,
    });

    res.json({
      success: true,
      message: `Gate ${gateId} satisfied`,
    });
  } catch (error) {
    console.error('[MDMP API] Error satisfying gate:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to satisfy gate',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase Transitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/mdmp/workflows/:missionId/transitions
 * Request phase transition
 */
router.post('/workflows/:missionId/transitions', async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    const { toPhase, requestedBy, proposalId } = req.body;

    if (!toPhase || !requestedBy) {
      return res.status(400).json({
        error: 'Missing required fields: toPhase, requestedBy',
      });
    }

    const result = await mdmpWorkflowService.requestPhaseTransition({
      missionId,
      toPhase: toPhase as MDMPPhase,
      requestedBy,
      proposalId,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: `Transitioned to phase ${toPhase}`,
    });
  } catch (error) {
    console.error('[MDMP API] Error transitioning phase:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to transition phase',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Assumption Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/mdmp/workflows/:missionId/assumptions
 * Get all assumptions for a workflow
 */
router.get('/workflows/:missionId/assumptions', async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;

    const assumptions = await mdmpWorkflowService.getAssumptions(missionId);

    res.json({
      success: true,
      assumptions,
    });
  } catch (error) {
    console.error('[MDMP API] Error getting assumptions:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get assumptions',
    });
  }
});

/**
 * POST /api/mdmp/workflows/:missionId/assumptions
 * Register a new assumption
 */
router.post('/workflows/:missionId/assumptions', async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    const { description, source } = req.body;

    if (!description || !source) {
      return res.status(400).json({
        error: 'Missing required fields: description, source',
      });
    }

    const assumption = await mdmpWorkflowService.registerAssumption({
      missionId,
      description,
      source,
    });

    res.status(201).json({
      success: true,
      assumption,
    });
  } catch (error) {
    console.error('[MDMP API] Error registering assumption:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to register assumption',
    });
  }
});

/**
 * PUT /api/mdmp/workflows/:missionId/assumptions/:id/accept
 * Accept an assumption
 */
router.put('/workflows/:missionId/assumptions/:id/accept', async (req: Request, res: Response) => {
  try {
    const { missionId, id } = req.params;
    const { acceptedBy, riskOwner } = req.body;

    if (!acceptedBy || !riskOwner) {
      return res.status(400).json({
        error: 'Missing required fields: acceptedBy, riskOwner',
      });
    }

    await mdmpWorkflowService.acceptAssumption({
      missionId,
      assumptionId: id,
      acceptedBy,
      riskOwner,
    });

    res.json({
      success: true,
      message: `Assumption ${id} accepted`,
    });
  } catch (error) {
    console.error('[MDMP API] Error accepting assumption:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to accept assumption',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Activity Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/mdmp/activities
 * Get all activities
 */
router.get('/activities', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      activities: ALL_ACTIVITIES,
      total: ALL_ACTIVITIES.length,
    });
  } catch (error) {
    console.error('[MDMP API] Error getting activities:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get activities',
    });
  }
});

/**
 * GET /api/mdmp/activities/:id
 * Get activity by ID
 */
router.get('/activities/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activity = getActivityById(id);

    if (!activity) {
      return res.status(404).json({
        error: `Activity not found: ${id}`,
      });
    }

    res.json({
      success: true,
      activity,
    });
  } catch (error) {
    console.error('[MDMP API] Error getting activity:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get activity',
    });
  }
});

/**
 * GET /api/mdmp/phases/:phase/statistics
 * Get phase statistics
 */
router.get('/phases/:phase/statistics', async (req: Request, res: Response) => {
  try {
    const { phase } = req.params;

    const statistics = getPhaseStatistics(phase as MDMPPhase);

    res.json({
      success: true,
      phase,
      statistics,
    });
  } catch (error) {
    console.error('[MDMP API] Error getting phase statistics:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get phase statistics',
    });
  }
});

export default router;
