/**
 * Decision Gate REST API Routes
 *
 * Phase 28 Plan 01: Express router for gate CRUD and lifecycle operations.
 */

import { Router } from 'express';
import { gateService } from './gate-service.js';
import type { CreateGateParams, GateProposalContext } from './gate-types.js';

export const gateRoutes = Router();

// ---------------------------------------------------------------------------
// GET /api/gates/:problemSetId — all gates for a problem set
// ---------------------------------------------------------------------------
gateRoutes.get('/:problemSetId', async (req, res) => {
  try {
    const gates = await gateService.getGatesForProblemSet(req.params.problemSetId);
    res.json(gates);
  } catch (error) {
    console.error('[gates] Error fetching gates:', error);
    res.status(500).json({ error: 'Failed to fetch gates' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/gates/:problemSetId/:tab — gates filtered by tab
// ---------------------------------------------------------------------------
gateRoutes.get('/:problemSetId/:tab', async (req, res) => {
  try {
    const gates = await gateService.getGatesByTab(req.params.problemSetId, req.params.tab);
    res.json(gates);
  } catch (error) {
    console.error('[gates] Error fetching gates by tab:', error);
    res.status(500).json({ error: 'Failed to fetch gates' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/gates — create a new gate
// ---------------------------------------------------------------------------
gateRoutes.post('/', async (req, res) => {
  try {
    const params: CreateGateParams = req.body;
    if (!params.problem_set_id || !params.gate_type || !params.target_item_id || !params.target_item_type) {
      res.status(400).json({ error: 'Missing required fields: problem_set_id, gate_type, target_item_id, target_item_type' });
      return;
    }
    const gate = await gateService.createGate(params);
    res.status(201).json(gate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create gate';
    console.error('[gates] Error creating gate:', error);
    res.status(400).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/gates/:gateId/submit — submit for approval
// ---------------------------------------------------------------------------
gateRoutes.post('/:gateId/submit', async (req, res) => {
  try {
    const { submittedBy, context } = req.body as { submittedBy: string; context: GateProposalContext };
    if (!submittedBy || !context) {
      res.status(400).json({ error: 'Missing required fields: submittedBy, context' });
      return;
    }
    const gate = await gateService.submitForApproval(req.params.gateId, submittedBy, context);
    res.json(gate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit gate';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/gates/:gateId/approve — approve gate
// ---------------------------------------------------------------------------
gateRoutes.post('/:gateId/approve', async (req, res) => {
  try {
    const { decidedBy } = req.body as { decidedBy: string };
    if (!decidedBy) {
      res.status(400).json({ error: 'Missing required field: decidedBy' });
      return;
    }
    const gate = await gateService.approveGate(req.params.gateId, decidedBy);
    res.json(gate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve gate';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/gates/:gateId/reject — reject gate
// ---------------------------------------------------------------------------
gateRoutes.post('/:gateId/reject', async (req, res) => {
  try {
    const { decidedBy, reason } = req.body as { decidedBy: string; reason: string };
    if (!decidedBy || !reason) {
      res.status(400).json({ error: 'Missing required fields: decidedBy, reason' });
      return;
    }
    const gate = await gateService.rejectGate(req.params.gateId, decidedBy, reason);
    res.json(gate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject gate';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/gates/:gateId/override — override soft-warning gate
// ---------------------------------------------------------------------------
gateRoutes.post('/:gateId/override', async (req, res) => {
  try {
    const { overriddenBy, justification } = req.body as { overriddenBy: string; justification: string };
    if (!overriddenBy || !justification) {
      res.status(400).json({ error: 'Missing required fields: overriddenBy, justification' });
      return;
    }
    const gate = await gateService.overrideGate(req.params.gateId, overriddenBy, justification);
    res.json(gate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to override gate';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/gates/:gateId/escalate — escalate gate
// ---------------------------------------------------------------------------
gateRoutes.post('/:gateId/escalate', async (req, res) => {
  try {
    const { escalatedBy, reason } = req.body as { escalatedBy: string; reason: string };
    if (!escalatedBy || !reason) {
      res.status(400).json({ error: 'Missing required fields: escalatedBy, reason' });
      return;
    }
    const gate = await gateService.escalateGate(req.params.gateId, escalatedBy, reason);
    res.json(gate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to escalate gate';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/gates/:gateId/config — update gate configuration
// ---------------------------------------------------------------------------
gateRoutes.patch('/:gateId/config', async (req, res) => {
  try {
    const { enforcement, deadlineAt, timeoutBehavior } = req.body as {
      enforcement: string;
      deadlineAt?: string;
      timeoutBehavior?: string;
    };
    if (!enforcement) {
      res.status(400).json({ error: 'Missing required field: enforcement' });
      return;
    }
    const deadline = deadlineAt ? new Date(deadlineAt) : undefined;
    const gate = await gateService.updateGateConfig(req.params.gateId, enforcement, deadline, timeoutBehavior);
    res.json(gate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update gate config';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});
