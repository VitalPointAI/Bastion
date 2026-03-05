/**
 * COP API Routes
 *
 * Phase 21 Plan 07: Express router mounting all COP API endpoints.
 * Follows the existing strategic.ts pattern for route structure and auth middleware.
 *
 * Endpoints:
 *   Layer CRUD:        POST/GET /layers, GET/PUT /layers/:id, POST /layers/:id/transition
 *   Version browsing:  GET /layers/:id/versions, GET /layers/:id/versions/:version
 *   Agent control:     POST /agents/trigger, POST /agents/polling/start|stop, GET /agents/activity
 *   Linkage review:    GET /linkages/pending, POST /linkages/:id/review, GET /linkages/entity/:entityId
 *   Conflict detection: GET /conflicts
 */
import express from 'express';
import { requireAuth } from '../../auth/auth-instance.js';
import {
  statusHandlers,
  layerHandlers,
  versionHandlers,
  agentHandlers,
  linkageHandlers,
  conflictHandlers,
} from './cop-handlers.js';

const router = express.Router();

// =========================================================================
// Status
// =========================================================================

router.get('/status', requireAuth, (req, res) => statusHandlers.getStatus(req, res));

// =========================================================================
// Layer CRUD & Lifecycle
// =========================================================================

router.post('/layers', requireAuth, (req, res) => layerHandlers.createLayer(req, res));
router.get('/layers', requireAuth, (req, res) => layerHandlers.queryLayers(req, res));
router.get('/layers/:id', requireAuth, (req, res) => layerHandlers.getLayer(req, res));
router.put('/layers/:id/spec', requireAuth, (req, res) => layerHandlers.updateLayerSpec(req, res));
router.post('/layers/:id/transition', requireAuth, (req, res) => layerHandlers.transitionLayer(req, res));
router.post('/layers/:id/feedback', requireAuth, (req, res) => layerHandlers.addReviewFeedback(req, res));
router.post('/layers/:id/recall', requireAuth, (req, res) => layerHandlers.recallLayer(req, res));

// =========================================================================
// Version Browsing
// =========================================================================

router.get('/layers/:id/versions', requireAuth, (req, res) => versionHandlers.listSnapshots(req, res));
router.get('/layers/:id/versions/:version', requireAuth, (req, res) => versionHandlers.getSnapshot(req, res));
router.get('/layers/:id/versions/:version/spec', requireAuth, (req, res) => versionHandlers.getSpecAtVersion(req, res));

// =========================================================================
// Agent Control
// =========================================================================

router.post('/agents/trigger', requireAuth, (req, res) => agentHandlers.manualTrigger(req, res));
router.post('/agents/polling/start', requireAuth, (req, res) => agentHandlers.startPolling(req, res));
router.post('/agents/polling/stop', requireAuth, (req, res) => agentHandlers.stopPolling(req, res));
router.get('/agents/activity', requireAuth, (req, res) => agentHandlers.getActivity(req, res));

// =========================================================================
// Entity Linkage Review
// =========================================================================

router.get('/linkages/pending', requireAuth, (req, res) => linkageHandlers.getPendingReviews(req, res));
router.post('/linkages/:id/review', requireAuth, (req, res) => linkageHandlers.reviewLinkage(req, res));
router.get('/linkages/entity/:entityId', requireAuth, (req, res) => linkageHandlers.getLinkagesForEntity(req, res));

// =========================================================================
// Conflict Detection
// =========================================================================

router.get('/conflicts', requireAuth, (req, res) => conflictHandlers.getConflicts(req, res));

export { router as copRouter };
export default router;
