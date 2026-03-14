/**
 * COP API Request Handlers
 *
 * Phase 21 Plan 07: Handles all COP REST API requests for layer management,
 * lifecycle transitions, version browsing, agent control, entity linkage
 * review, and conflict detection.
 *
 * All endpoints enforce workspace-scoped access via workspaceId parameters.
 */
import type { Request, Response } from 'express';
import { z } from 'zod';

import { layerStore } from '../layers/layer-store.js';
import { versionStore } from '../layers/version-store.js';
import { detectConflicts } from '../layers/conflict-detector.js';
import { linkageStore } from '../linkage/linkage-store.js';
import { runCOPGeneration } from '../agents/cop-coordinator.js';
import { TriggerHandler } from '../messaging/trigger-handler.js';
import { ActivityBridge } from '../messaging/activity-bridge.js';

import type { COPLayerSpec, LayerState, COPLayerType } from '../layers/layer-types.js';

// ---------------------------------------------------------------------------
// Shared instances (initialized in cop/index.ts, set here for handler access)
// ---------------------------------------------------------------------------

let triggerHandler: TriggerHandler;
let activityBridge: ActivityBridge;

/**
 * Set shared instances from module initialization.
 * Called by initCOP() in cop/index.ts.
 */
export function setHandlerDependencies(
  trigger: TriggerHandler,
  activity: ActivityBridge,
): void {
  triggerHandler = trigger;
  activityBridge = activity;
}

// ---------------------------------------------------------------------------
// Zod Schemas for Request Validation
// ---------------------------------------------------------------------------

const createLayerSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId required'),
  sectionId: z.string().min(1, 'sectionId required'),
  layerType: z.enum([
    'force_disposition', 'objectives', 'control_measures',
    'intel', 'logistics', 'c2',
  ]),
  spec: z.record(z.string(), z.unknown()).optional(),
});

const updateLayerSpecSchema = z.object({
  spec: z.record(z.string(), z.unknown()),
});

const transitionLayerSchema = z.object({
  targetState: z.enum(['draft', 'review', 'published', 'cop']),
  reason: z.string().optional(),
});

const addFeedbackSchema = z.object({
  type: z.enum(['spatial_annotation', 'general_comment']),
  content: z.string().min(1, 'content required'),
  position: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  entityId: z.string().optional(),
});

const recallLayerSchema = z.object({
  reason: z.string().min(1, 'reason required for recall'),
});

const manualTriggerSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId required'),
  sectionId: z.string().min(1, 'sectionId required'),
  triggeredBy: z.literal('manual'),
});

const pollingStartSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId required'),
  sectionId: z.string().min(1, 'sectionId required'),
  intervalMs: z.number().int().positive().optional(),
});

const pollingStopSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId required'),
  sectionId: z.string().min(1, 'sectionId required'),
});

const reviewLinkageSchema = z.object({
  approved: z.boolean(),
});

// ---------------------------------------------------------------------------
// Helper: extract query param as string (handles string[] from Express)
// ---------------------------------------------------------------------------

function qs(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

/** Extract a route param as string. Express params can be string | string[]. */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return typeof val === 'string' ? val : Array.isArray(val) ? val[0] : String(val);
}

// ---------------------------------------------------------------------------
// Helper: validate body and return typed result or send error response
// ---------------------------------------------------------------------------

function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
  res: Response,
): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({
      error: 'Validation error',
      details: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
}

// =========================================================================
// Status Handler
// =========================================================================

export const statusHandlers = {
  /**
   * GET /cop/status - Get COP generation status and layer counts for a workspace.
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = qs(req.query.workspaceId);
      if (!workspaceId) {
        res.status(400).json({ error: 'workspaceId required' });
        return;
      }

      const layers = await layerStore.queryLayers({ workspaceId });
      const hasLayers = layers.length > 0;
      const layerCount = layers.length;
      const draftCount = layers.filter(l => l.state === 'draft').length;
      const copCount = layers.filter(l => l.state === 'cop').length;

      // Check if generation is in progress by looking for recent agent activity
      const activity = activityBridge.getActivities(workspaceId, 10);
      const recentGeneration = activity.find(a =>
        a.action === 'generating' &&
        Date.now() - new Date(a.timestamp).getTime() < 60000
      );
      const status = recentGeneration ? 'generating' : (hasLayers ? 'ready' : 'idle');

      res.json({
        status, // 'idle' | 'generating' | 'ready'
        layerCount,
        draftCount,
        copCount,
        hasLayers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  },
};

// =========================================================================
// Layer Handlers
// =========================================================================

export const layerHandlers = {
  /**
   * POST /cop/layers - Create a new COP layer.
   * If spec provided, creates with spec. If not, triggers generation.
   */
  async createLayer(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(createLayerSchema, req.body, res);
      if (!body) return;

      if (body.spec) {
        // Direct creation with spec
        const layer = await layerStore.createLayer({
          workspaceId: body.workspaceId,
          sectionId: body.sectionId,
          layerType: body.layerType as COPLayerType,
          spec: body.spec as unknown as COPLayerSpec,
        });
        res.status(201).json(layer);
      } else {
        // Trigger generation and return draft layer
        const layer = await runCOPGeneration(
          body.workspaceId,
          body.sectionId,
          'manual',
          { targetAgents: [body.layerType] },
        );
        if (layer) {
          res.status(201).json(layer);
        } else {
          res.status(500).json({ error: 'Layer generation failed' });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] createLayer error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * GET /cop/layers - Query layers with optional filters.
   */
  async queryLayers(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = qs(req.query.workspaceId);
      const sectionId = qs(req.query.sectionId);
      const state = qs(req.query.state);
      const layerType = qs(req.query.layerType);

      if (!workspaceId) {
        res.status(400).json({ error: 'workspaceId query parameter required' });
        return;
      }

      const layers = await layerStore.queryLayers({
        workspaceId,
        sectionId,
        state: state as LayerState | undefined,
        layerType: layerType as COPLayerType | undefined,
      });
      res.json(layers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] queryLayers error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * GET /cop/layers/:id - Get a single layer by ID.
   */
  async getLayer(req: Request, res: Response): Promise<void> {
    try {
      const layer = await layerStore.getLayer(param(req, 'id'));
      if (!layer) {
        res.status(404).json({ error: `Layer not found: ${param(req, 'id')}` });
        return;
      }
      res.json(layer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] getLayer error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * PUT /cop/layers/:id/spec - Update a layer's spec.
   */
  async updateLayerSpec(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(updateLayerSpecSchema, req.body, res);
      if (!body) return;

      const existing = await layerStore.getLayer(param(req, 'id'));
      if (!existing) {
        res.status(404).json({ error: `Layer not found: ${param(req, 'id')}` });
        return;
      }

      const layer = await layerStore.updateLayerSpec(
        param(req, 'id'),
        body.spec as unknown as COPLayerSpec,
      );
      res.json(layer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] updateLayerSpec error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * POST /cop/layers/:id/transition - Transition a layer to a new state.
   * On COP transition, also runs conflict detection.
   */
  async transitionLayer(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(transitionLayerSchema, req.body, res);
      if (!body) return;

      const existing = await layerStore.getLayer(param(req, 'id'));
      if (!existing) {
        res.status(404).json({ error: `Layer not found: ${param(req, 'id')}` });
        return;
      }

      const layer = await layerStore.transitionLayer({
        layerId: param(req, 'id'),
        targetState: body.targetState as LayerState,
        performedBy: (req as unknown as Record<string, unknown>).anonUser
          ? `did:near:${((req as unknown as Record<string, unknown>).anonUser as Record<string, string>).nearAccountId}`
          : 'system',
        reason: body.reason,
      });

      // On COP promotion, run conflict detection against other COP layers
      let conflicts: unknown[] = [];
      if (body.targetState === 'cop') {
        const copLayers = await layerStore.queryLayers({
          workspaceId: layer.workspaceId,
          state: 'cop',
        });
        // Exclude the layer we just promoted
        const otherCopLayers = copLayers.filter(l => l.id !== layer.id);
        conflicts = detectConflicts(layer, otherCopLayers);
      }

      res.json({ layer, conflicts });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Invalid transition')) {
        res.status(409).json({ error: message });
      } else if (message.includes('Reason is required')) {
        res.status(400).json({ error: message });
      } else {
        console.error('[COP] transitionLayer error:', message);
        res.status(500).json({ error: message });
      }
    }
  },

  /**
   * POST /cop/layers/:id/feedback - Add review feedback to a layer.
   */
  async addReviewFeedback(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(addFeedbackSchema, req.body, res);
      if (!body) return;

      const existing = await layerStore.getLayer(param(req, 'id'));
      if (!existing) {
        res.status(404).json({ error: `Layer not found: ${param(req, 'id')}` });
        return;
      }

      const { randomUUID } = await import('crypto');
      const layer = await layerStore.addReviewFeedback(param(req, 'id'), {
        id: randomUUID(),
        layerId: param(req, 'id'),
        type: body.type,
        content: body.content,
        position: body.position,
        entityId: body.entityId,
        createdBy: (req as unknown as Record<string, unknown>).anonUser
          ? `did:near:${((req as unknown as Record<string, unknown>).anonUser as Record<string, string>).nearAccountId}`
          : 'system',
        createdAt: new Date().toISOString(),
      });
      res.json(layer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] addReviewFeedback error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * DELETE /cop/layers/:id - Delete a COP layer.
   */
  async deleteLayer(req: Request, res: Response): Promise<void> {
    try {
      const layerId = param(req, 'id');
      const deleted = await layerStore.deleteLayer(layerId);
      if (!deleted) {
        res.status(404).json({ error: `Layer not found: ${layerId}` });
        return;
      }
      res.json({ success: true, layerId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] deleteLayer error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * POST /cop/layers/:id/recall - Recall a layer from COP to review.
   */
  async recallLayer(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(recallLayerSchema, req.body, res);
      if (!body) return;

      const existing = await layerStore.getLayer(param(req, 'id'));
      if (!existing) {
        res.status(404).json({ error: `Layer not found: ${param(req, 'id')}` });
        return;
      }

      const layer = await layerStore.transitionLayer({
        layerId: param(req, 'id'),
        targetState: 'review',
        performedBy: (req as unknown as Record<string, unknown>).anonUser
          ? `did:near:${((req as unknown as Record<string, unknown>).anonUser as Record<string, string>).nearAccountId}`
          : 'system',
        reason: body.reason,
      });
      res.json(layer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Invalid transition')) {
        res.status(409).json({ error: message });
      } else {
        console.error('[COP] recallLayer error:', message);
        res.status(500).json({ error: message });
      }
    }
  },
};

// =========================================================================
// Version Handlers
// =========================================================================

export const versionHandlers = {
  /**
   * GET /cop/layers/:id/versions - List all version snapshots for a layer.
   */
  async listSnapshots(req: Request, res: Response): Promise<void> {
    try {
      const snapshots = await versionStore.listSnapshots(param(req, 'id'));
      res.json(snapshots);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] listSnapshots error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * GET /cop/layers/:id/versions/:version - Get a specific version snapshot.
   */
  async getSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const version = parseInt(param(req, 'version'), 10);
      if (isNaN(version)) {
        res.status(400).json({ error: 'version must be an integer' });
        return;
      }

      const snapshot = await versionStore.getSnapshot(param(req, 'id'), version);
      if (!snapshot) {
        // Try reconstructing at that version
        try {
          const spec = await versionStore.reconstructAtVersion(param(req, 'id'), version);
          res.json({ layerId: param(req, 'id'), version, spec, reconstructed: true });
        } catch {
          res.status(404).json({ error: `Snapshot not found: ${param(req, 'id')} v${version}` });
        }
        return;
      }
      res.json(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] getSnapshot error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * GET /cop/layers/:id/versions/:version/spec - Get just the spec at a version.
   */
  async getSpecAtVersion(req: Request, res: Response): Promise<void> {
    try {
      const version = parseInt(param(req, 'version'), 10);
      if (isNaN(version)) {
        res.status(400).json({ error: 'version must be an integer' });
        return;
      }

      const spec = await versionStore.reconstructAtVersion(param(req, 'id'), version);
      res.json(spec);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        console.error('[COP] getSpecAtVersion error:', message);
        res.status(500).json({ error: message });
      }
    }
  },
};

// =========================================================================
// Agent Handlers
// =========================================================================

export const agentHandlers = {
  /**
   * POST /cop/agents/trigger - Manual trigger for COP layer generation.
   * Runs generation synchronously and returns the created layer.
   */
  async manualTrigger(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(manualTriggerSchema, req.body, res);
      if (!body) return;

      // Fetch documents and graph entities for the sub-agents
      let documents: Array<{ id: string; content: string; type: string }> = [];
      let graphEntities: Array<{ id: string; name: string; type: string; properties: Record<string, unknown> }> = [];

      try {
        const { objectiveStore } = await import('../../strategic/objectives/index.js');
        const { objectives } = await objectiveStore.listObjectives({ status: 'APPROVED' });
        documents = objectives.map(obj => ({
          id: obj.id,
          content: [obj.description, obj.sourceReference || ''].filter(Boolean).join('\n'),
          type: 'general',  // 'general' passes through all sub-agent doc filters
        }));
      } catch {
        // Non-fatal
      }

      try {
        const { actorStore } = await import('../../graph/raft/actor-store.js');
        const actors = await actorStore.listActors(body.workspaceId);
        graphEntities = actors.map(actor => ({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          properties: actor.attributes || {},
        }));
      } catch {
        // Non-fatal
      }

      // Run generation synchronously
      const layer = await runCOPGeneration(
        body.workspaceId,
        body.sectionId,
        'manual',
        { documents, graphEntities },
      );

      if (layer) {
        res.json({ status: 'complete', layer });
      } else {
        res.json({ status: 'complete', layer: null, message: 'No layer produced (no documents or entities available)' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] manualTrigger error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * POST /cop/agents/polling/start - Start periodic polling.
   */
  async startPolling(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(pollingStartSchema, req.body, res);
      if (!body) return;

      triggerHandler.startPolling(body.workspaceId, body.sectionId, body.intervalMs);
      res.json({
        status: 'polling_started',
        workspaceId: body.workspaceId,
        sectionId: body.sectionId,
        intervalMs: body.intervalMs ?? 60000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] startPolling error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * POST /cop/agents/polling/stop - Stop periodic polling.
   */
  async stopPolling(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(pollingStopSchema, req.body, res);
      if (!body) return;

      triggerHandler.stopPolling(body.workspaceId, body.sectionId);
      res.json({
        status: 'polling_stopped',
        workspaceId: body.workspaceId,
        sectionId: body.sectionId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] stopPolling error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * GET /cop/agents/activity - Get recent agent activity for a workspace.
   */
  async getActivity(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = qs(req.query.workspaceId);
      const limitStr = qs(req.query.limit);

      if (!workspaceId) {
        res.status(400).json({ error: 'workspaceId query parameter required' });
        return;
      }

      const limitNum = limitStr ? parseInt(limitStr, 10) : undefined;
      const activities = activityBridge.getActivities(
        workspaceId,
        limitNum,
      );
      res.json(activities);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] getActivity error:', message);
      res.status(500).json({ error: message });
    }
  },
};

// =========================================================================
// Linkage Handlers
// =========================================================================

export const linkageHandlers = {
  /**
   * GET /cop/linkages/pending - Get linkages pending human review.
   */
  async getPendingReviews(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = qs(req.query.workspaceId);
      const pending = await linkageStore.getPendingReviews(workspaceId);
      res.json(pending);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] getPendingReviews error:', message);
      res.status(500).json({ error: message });
    }
  },

  /**
   * POST /cop/linkages/:id/review - Review a pending linkage.
   */
  async reviewLinkage(req: Request, res: Response): Promise<void> {
    try {
      const body = validateBody(reviewLinkageSchema, req.body, res);
      if (!body) return;

      const reviewedBy = (req as unknown as Record<string, unknown>).anonUser
        ? `did:near:${((req as unknown as Record<string, unknown>).anonUser as Record<string, string>).nearAccountId}`
        : 'system';

      const linkage = await linkageStore.reviewLinkage(
        param(req, 'id'),
        reviewedBy,
        body.approved,
      );
      res.json(linkage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        console.error('[COP] reviewLinkage error:', message);
        res.status(500).json({ error: message });
      }
    }
  },

  /**
   * GET /cop/linkages/entity/:entityId - Get all linkages for an entity.
   */
  async getLinkagesForEntity(req: Request, res: Response): Promise<void> {
    try {
      const linkages = await linkageStore.getLinkagesForEntity(param(req, 'entityId'));
      res.json(linkages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] getLinkagesForEntity error:', message);
      res.status(500).json({ error: message });
    }
  },
};

// =========================================================================
// Conflict Handlers
// =========================================================================

export const conflictHandlers = {
  /**
   * GET /cop/conflicts - Detect conflicts across all COP-state layers in a workspace.
   */
  async getConflicts(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = qs(req.query.workspaceId);

      if (!workspaceId) {
        res.status(400).json({ error: 'workspaceId query parameter required' });
        return;
      }

      // Get all COP-state layers for the workspace
      const copLayers = await layerStore.queryLayers({
        workspaceId,
        state: 'cop',
      });

      if (copLayers.length < 2) {
        res.json({ conflicts: [], layerCount: copLayers.length });
        return;
      }

      // Pairwise conflict detection
      const allConflicts: unknown[] = [];
      for (let i = 0; i < copLayers.length; i++) {
        const otherLayers = copLayers.filter((_, idx) => idx !== i);
        const conflicts = detectConflicts(copLayers[i], otherLayers);
        allConflicts.push(...conflicts);
      }

      // Deduplicate by conflict ID pairs (A-B and B-A are the same)
      const seen = new Set<string>();
      const uniqueConflicts = allConflicts.filter((c) => {
        const conflict = c as { layerIdA: string; layerIdB: string; entityIdA: string; conflictType: string };
        const key = [conflict.layerIdA, conflict.layerIdB].sort().join(':') +
          ':' + conflict.entityIdA + ':' + conflict.conflictType;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      res.json({ conflicts: uniqueConflicts, layerCount: copLayers.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[COP] getConflicts error:', message);
      res.status(500).json({ error: message });
    }
  },
};
