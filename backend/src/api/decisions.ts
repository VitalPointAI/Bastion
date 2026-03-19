/**
 * Decisions REST API
 *
 * Phase 53 Plan 04: REST endpoints for decision management and RACI matrix.
 * Consumed by the Decide tab (Plan 05) and Ironclaw proactive surfacing (Plan 05).
 *
 * All routes require authentication. RACI enforcement is handled by decisionService.
 * Actor DID is read from the X-DID request header (set by the frontend).
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../auth/auth-instance.js';
import { decisionService } from '../decisions/decision-service.js';
import { decisionStore } from '../decisions/decision-store.js';
import { raciStore } from '../decisions/raci-store.js';
import type { DecisionStatus, RACIRole } from '../decisions/decision-types.js';

const router = Router();

// All decision routes require authentication
router.use(requireAuth);

// ============================================================================
// Decision endpoints
// ============================================================================

/**
 * GET /api/decisions/:problemSetId
 * List decisions for a problem set. Query params: ?status=pending&decision_type=mission_approval
 */
router.get('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { status, decision_type } = req.query as {
      status?: DecisionStatus;
      decision_type?: string;
    };

    const decisions = await decisionStore.getByProblemSet(problemSetId, {
      status,
      decision_type,
    });

    res.json({ decisions });
  } catch (err) {
    console.error('[decisions] GET /:problemSetId error:', err);
    res.status(500).json({ error: 'Failed to list decisions' });
  }
});

/**
 * GET /api/decisions/:problemSetId/summary
 * Dashboard summary: counts by status and recent decisions.
 * Must be before /:problemSetId/:decisionId to avoid route collision.
 */
router.get('/:problemSetId/summary', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const summary = await decisionService.getDashboardSummary(problemSetId);
    res.json(summary);
  } catch (err) {
    console.error('[decisions] GET /:problemSetId/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch decision summary' });
  }
});

/**
 * GET /api/decisions/:problemSetId/pending/:position
 * Get pending decisions for a specific staff position.
 */
router.get('/:problemSetId/pending/:position', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const position = req.params.position as string;
    const decisions = await decisionService.getPendingForPosition(problemSetId, position);
    res.json({ decisions });
  } catch (err) {
    console.error('[decisions] GET /:problemSetId/pending/:position error:', err);
    res.status(500).json({ error: 'Failed to fetch pending decisions for position' });
  }
});

/**
 * POST /api/decisions/:problemSetId
 * Create a new decision request.
 * Body: { decision_type, title, description?, context_json? }
 */
router.post('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { decision_type, title, description, context_json } = req.body as {
      decision_type?: string;
      title?: string;
      description?: string;
      context_json?: Record<string, unknown>;
    };

    if (!decision_type || !title) {
      res.status(400).json({ error: 'decision_type and title are required' });
      return;
    }

    // requested_by = authenticated user's DID from X-DID header
    const requested_by = (req.headers['x-did'] as string) || undefined;

    const decision = await decisionService.createDecision({
      problem_set_id: problemSetId,
      decision_type,
      title,
      description,
      context_json,
      requested_by,
    });

    res.status(201).json({ decision });
  } catch (err) {
    console.error('[decisions] POST /:problemSetId error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create decision';
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/decisions/:problemSetId/:decisionId/audit
 * Get the full audit trail for a decision: decision + linked DAO proposal + votes.
 * Must be defined before /:decisionId to avoid route collision.
 */
router.get('/:problemSetId/:decisionId/audit', async (req: Request, res: Response) => {
  try {
    const decisionId = req.params.decisionId as string;
    const auditTrail = await decisionService.getDecisionAuditTrail(decisionId);
    res.json(auditTrail);
  } catch (err) {
    console.error('[decisions] GET /:problemSetId/:decisionId/audit error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch decision audit trail';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

/**
 * PATCH /api/decisions/:problemSetId/:decisionId
 * Act on a decision: approve, reject, defer, or request info.
 * Body: { action: 'approved'|'rejected'|'deferred'|'info_requested', actor_position }
 */
router.patch('/:problemSetId/:decisionId', async (req: Request, res: Response) => {
  try {
    const decisionId = req.params.decisionId as string;
    const { action, actor_position } = req.body as {
      action?: DecisionStatus;
      actor_position?: string;
    };

    const validActions: DecisionStatus[] = ['approved', 'rejected', 'deferred', 'info_requested'];
    if (!action || !validActions.includes(action)) {
      res.status(400).json({
        error: `action must be one of: ${validActions.join(', ')}`,
      });
      return;
    }

    if (!actor_position) {
      res.status(400).json({ error: 'actor_position is required' });
      return;
    }

    const actorDid = (req.headers['x-did'] as string) || 'unknown';

    const decision = await decisionService.actOnDecision(decisionId, action, actorDid, actor_position);
    res.json({ decision });
  } catch (err) {
    console.error('[decisions] PATCH /:problemSetId/:decisionId error:', err);
    const message = err instanceof Error ? err.message : 'Failed to act on decision';
    res.status(400).json({ error: message });
  }
});

// ============================================================================
// RACI endpoints
// ============================================================================

/**
 * GET /api/decisions/:problemSetId/raci
 * Get RACI matrix (auto-seeds if empty).
 */
router.get('/:problemSetId/raci', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const assignments = await decisionService.getRACIMatrix(problemSetId);
    res.json({ assignments });
  } catch (err) {
    console.error('[decisions] GET /:problemSetId/raci error:', err);
    res.status(500).json({ error: 'Failed to fetch RACI matrix' });
  }
});

/**
 * PUT /api/decisions/:problemSetId/raci
 * Update a RACI assignment. Body: { decision_type, position, raci_role, actor_position }
 * Only commander/xo may update.
 */
router.put('/:problemSetId/raci', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { decision_type, position, raci_role, actor_position } = req.body as {
      decision_type?: string;
      position?: string;
      raci_role?: RACIRole;
      actor_position?: string;
    };

    if (!decision_type || !position || !raci_role || !actor_position) {
      res.status(400).json({
        error: 'decision_type, position, raci_role, and actor_position are required',
      });
      return;
    }

    const validRoles: RACIRole[] = ['R', 'A', 'C', 'I'];
    if (!validRoles.includes(raci_role)) {
      res.status(400).json({ error: `raci_role must be one of: ${validRoles.join(', ')}` });
      return;
    }

    const assignment = await decisionService.updateRACIAssignment(
      problemSetId,
      decision_type,
      position,
      raci_role,
      actor_position,
    );

    res.json({ assignment });
  } catch (err) {
    console.error('[decisions] PUT /:problemSetId/raci error:', err);
    const message = err instanceof Error ? err.message : 'Failed to update RACI assignment';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/decisions/:problemSetId/raci/delegate
 * Delegate authority for a RACI assignment.
 * Body: { decision_type, position, to_did, reason, delegation_type, expires_at?, actor_position }
 * Only commander/xo may delegate.
 */
router.post('/:problemSetId/raci/delegate', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const {
      decision_type,
      position,
      to_did,
      reason,
      delegation_type,
      expires_at,
      actor_position,
    } = req.body as {
      decision_type?: string;
      position?: string;
      to_did?: string;
      reason?: string;
      delegation_type?: 'permanent' | 'temporary';
      expires_at?: string;
      actor_position?: string;
    };

    if (!decision_type || !position || !to_did || !reason || !delegation_type) {
      res.status(400).json({
        error: 'decision_type, position, to_did, reason, and delegation_type are required',
      });
      return;
    }

    // Only commander/xo may delegate
    const authorizedPositions = ['commander', 'xo'];
    const actorPos = actor_position ?? '';
    if (!authorizedPositions.includes(actorPos.toLowerCase())) {
      res.status(403).json({ error: 'Only commander or xo may delegate authority' });
      return;
    }

    // Find the assignment to delegate
    const assignments = await raciStore.getByDecisionType(problemSetId, decision_type);
    const assignment = assignments.find((a) => a.position === position);
    if (!assignment) {
      res.status(404).json({
        error: `No RACI assignment found for position '${position}' and decision_type '${decision_type}'`,
      });
      return;
    }

    const byDid = (req.headers['x-did'] as string) || 'unknown';

    const updated = await raciStore.delegate(
      assignment.id,
      to_did,
      byDid,
      reason,
      delegation_type,
      expires_at,
    );

    res.json({ assignment: updated });
  } catch (err) {
    console.error('[decisions] POST /:problemSetId/raci/delegate error:', err);
    const message = err instanceof Error ? err.message : 'Failed to delegate authority';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/decisions/:problemSetId/raci/revoke
 * Revoke a delegation. Body: { assignment_id }
 * Only the delegator or commander may revoke.
 */
router.post('/:problemSetId/raci/revoke', async (req: Request, res: Response) => {
  try {
    const { assignment_id } = req.body as { assignment_id?: string };

    if (!assignment_id) {
      res.status(400).json({ error: 'assignment_id is required' });
      return;
    }

    const byDid = (req.headers['x-did'] as string) || 'unknown';

    const updated = await raciStore.revokeDelegation(assignment_id, byDid);
    res.json({ assignment: updated });
  } catch (err) {
    console.error('[decisions] POST /:problemSetId/raci/revoke error:', err);
    const message = err instanceof Error ? err.message : 'Failed to revoke delegation';
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/decisions/:problemSetId/raci/delegations
 * Get all active delegations for a problem set.
 */
router.get('/:problemSetId/raci/delegations', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const delegations = await raciStore.getActiveDelegations(problemSetId);
    res.json({ delegations });
  } catch (err) {
    console.error('[decisions] GET /:problemSetId/raci/delegations error:', err);
    res.status(500).json({ error: 'Failed to fetch active delegations' });
  }
});

/**
 * GET /api/decisions/:problemSetId/raci/:assignmentId/history
 * Get the delegation audit trail for a specific assignment.
 */
router.get('/:problemSetId/raci/:assignmentId/history', async (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.assignmentId as string;
    const history = await raciStore.getDelegationHistory(assignmentId);
    res.json({ history });
  } catch (err) {
    console.error('[decisions] GET /:problemSetId/raci/:assignmentId/history error:', err);
    res.status(500).json({ error: 'Failed to fetch delegation history' });
  }
});

export default router;
