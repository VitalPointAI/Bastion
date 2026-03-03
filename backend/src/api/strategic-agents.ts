/**
 * Strategic Agents API
 * Endpoints for OSINT collection, threat monitoring, and intelligence fusion
 */

import express from 'express';
import {
  agentOrchestrator,
  fusionAgent,
  threatMonitor,
  type OSINTCollectionRequest,
  type ThreatMonitorRequest,
  type ThreatType,
  type ThreatSeverity,
} from '../strategic/agents/index.js';
import { requireAuth } from '../auth/auth-instance.js';

const router = express.Router();

/**
 * Build DID from NEAR account ID
 */
function buildDID(nearAccountId: string): string {
  return `did:near:${nearAccountId}`;
}

// ============================================================================
// OSINT COLLECTION ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/agents/osint/collect
 * Trigger OSINT collection from configured sources
 *
 * Body:
 * - keywords: string[] - Keywords to search for
 * - regions: string[] - Geographic regions to focus on
 * - sourceIds?: string[] - Specific source IDs to use (optional)
 * - maxResults?: number - Maximum results to return (default: 100)
 */
router.post('/osint/collect', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { keywords, regions, sourceIds, maxResults } = req.body;

    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'keywords array required' });
    }
    if (!Array.isArray(regions)) {
      return res.status(400).json({ error: 'regions array required' });
    }

    const request: OSINTCollectionRequest = {
      keywords,
      regions,
      sourceIds,
      maxResults,
    };

    console.log(`OSINT collection triggered by ${userDID}: ${keywords.join(', ')}`);

    const result = await agentOrchestrator.collectOSINT(request);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('OSINT collection failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// THREAT MONITORING ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/agents/threats/monitor
 * Trigger threat monitoring analysis
 *
 * Body:
 * - regions: string[] - Geographic regions to monitor
 * - threatTypes?: ThreatType[] - Specific threat types to look for (optional)
 * - severityThreshold?: ThreatSeverity - Minimum severity to report (default: 'LOW')
 * - osintReports?: OSINTReport[] - Reports to analyze (optional, uses recent collection if not provided)
 */
router.post('/threats/monitor', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { regions, threatTypes, severityThreshold, osintReports } = req.body;

    if (!Array.isArray(regions)) {
      return res.status(400).json({ error: 'regions array required' });
    }

    // Validate threat types if provided
    const validThreatTypes: ThreatType[] = [
      'MILITARY_ACTIVITY',
      'POLITICAL_INSTABILITY',
      'ECONOMIC_PRESSURE',
      'CYBER_THREAT',
      'INFORMATION_OPS',
    ];
    if (threatTypes && !threatTypes.every((t: string) => validThreatTypes.includes(t as ThreatType))) {
      return res.status(400).json({
        error: `Invalid threatTypes. Valid values: ${validThreatTypes.join(', ')}`,
      });
    }

    // Validate severity threshold if provided
    const validSeverities: ThreatSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (severityThreshold && !validSeverities.includes(severityThreshold)) {
      return res.status(400).json({
        error: `Invalid severityThreshold. Valid values: ${validSeverities.join(', ')}`,
      });
    }

    const request: ThreatMonitorRequest = {
      regions,
      threatTypes,
      severityThreshold,
    };

    console.log(`Threat monitoring triggered by ${userDID}: regions=${regions.join(', ')}`);

    // Use provided reports or empty array (would trigger collection in full implementation)
    const reports = osintReports || [];
    const result = await agentOrchestrator.analyzeThreats(reports, request);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Threat monitoring failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/agents/threats/alerts
 * Get pending threat alerts
 *
 * Query params:
 * - acknowledged: boolean - Filter by acknowledged status (optional)
 */
router.get('/threats/alerts', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const acknowledged = req.query.acknowledged === 'true' ? true :
                         req.query.acknowledged === 'false' ? false : undefined;

    const alerts = threatMonitor.getAlerts(acknowledged);

    res.json({
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get alerts failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/agents/threats/alerts/:alertId/acknowledge
 * Acknowledge a threat alert
 */
router.post('/threats/alerts/:alertId/acknowledge', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const alertId = req.params.alertId as string;

    const success = agentOrchestrator.acknowledgeAlert(alertId, userDID);

    if (!success) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ acknowledged: true, alertId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Acknowledge alert failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// FUSION ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/agents/fuse
 * Trigger intelligence fusion
 *
 * Body:
 * - osintReports?: OSINTReport[] - OSINT reports to fuse
 * - threatIndicators?: ThreatIndicator[] - Threat indicators to include
 * - context?: string - Additional document context
 */
router.post('/fuse', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { osintReports, threatIndicators, context } = req.body;

    const reports = osintReports || [];
    const indicators = threatIndicators || [];

    if (reports.length === 0 && indicators.length === 0) {
      return res.status(400).json({
        error: 'At least one of osintReports or threatIndicators must be provided',
      });
    }

    console.log(`Intelligence fusion triggered by ${userDID}: ${reports.length} reports, ${indicators.length} indicators`);

    const result = await agentOrchestrator.fuseIntelligence(reports, indicators, context);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Intelligence fusion failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/agents/cycle
 * Run full intelligence cycle (OSINT -> Threats -> Fusion)
 *
 * Body:
 * - osintRequest: OSINTCollectionRequest - OSINT collection parameters
 * - threatRequest: ThreatMonitorRequest - Threat monitoring parameters
 * - documentContext?: string - Additional document context
 */
router.post('/cycle', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { osintRequest, threatRequest, documentContext } = req.body;

    if (!osintRequest || !osintRequest.keywords || !osintRequest.regions) {
      return res.status(400).json({
        error: 'osintRequest with keywords and regions required',
      });
    }
    if (!threatRequest || !threatRequest.regions) {
      return res.status(400).json({
        error: 'threatRequest with regions required',
      });
    }

    console.log(`Full intelligence cycle triggered by ${userDID}`);

    const result = await agentOrchestrator.runIntelligenceCycle(
      osintRequest,
      threatRequest,
      documentContext
    );

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Intelligence cycle failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/agents/fused/:id
 * Get a fused intelligence product by ID
 */
router.get('/fused/:id', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const id = req.params.id as string;

    const product = fusionAgent.getProduct(id);

    if (!product) {
      return res.status(404).json({ error: 'Fused product not found' });
    }

    res.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get fused product failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/agents/fused
 * List fused intelligence products
 *
 * Query params:
 * - status: 'PENDING' | 'REVIEWED' | 'APPROVED' - Filter by review status
 */
router.get('/fused', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const status = req.query.status as 'PENDING' | 'REVIEWED' | 'APPROVED' | undefined;

    const validStatuses = ['PENDING', 'REVIEWED', 'APPROVED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
      });
    }

    const products = fusionAgent.listProducts(status);

    res.json({
      count: products.length,
      products,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List fused products failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/agents/fused/:id/review
 * Review a fused intelligence product
 *
 * Body:
 * - approved: boolean - Whether to approve the product
 * - notes?: string - Review notes
 */
router.post('/fused/:id/review', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const id = req.params.id as string;
    const { approved, notes } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved field required (boolean)' });
    }

    const success = agentOrchestrator.reviewFusedProduct(id, userDID, approved, notes);

    if (!success) {
      return res.status(404).json({ error: 'Fused product not found' });
    }

    const product = fusionAgent.getProduct(id);

    res.json({
      reviewStatus: product?.reviewStatus,
      reviewedBy: product?.reviewedBy,
      reviewedAt: product?.reviewedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Review fused product failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// CHECKPOINT ENDPOINTS
// ============================================================================

/**
 * GET /api/strategic/agents/checkpoints
 * List pending human checkpoints
 *
 * Query params:
 * - status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' - Filter by status
 */
router.get('/checkpoints', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const status = req.query.status as 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | undefined;

    const validStatuses = ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
      });
    }

    const checkpoints = fusionAgent.getCheckpoints(status);

    res.json({
      count: checkpoints.length,
      checkpoints,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get checkpoints failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/agents/checkpoints/:id/resolve
 * Resolve a human checkpoint
 *
 * Body:
 * - action: 'APPROVE' | 'REJECT' | 'REVISE' - Decision action
 * - rationale: string - Reason for decision
 */
router.post('/checkpoints/:id/resolve', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const id = req.params.id as string;
    const { action, rationale } = req.body;

    const validActions = ['APPROVE', 'REJECT', 'REVISE'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Valid values: ${validActions.join(', ')}`,
      });
    }
    if (!rationale || typeof rationale !== 'string') {
      return res.status(400).json({ error: 'rationale string required' });
    }

    const success = agentOrchestrator.resolveCheckpoint(id, userDID, action, rationale);

    if (!success) {
      return res.status(404).json({ error: 'Checkpoint not found' });
    }

    res.json({ resolved: true, checkpointId: id, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Resolve checkpoint failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// STATUS ENDPOINTS
// ============================================================================

/**
 * GET /api/strategic/agents/status
 * Get agent status and configuration
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const agentStatus = await agentOrchestrator.getAgentStatus();
    const executionHistory = agentOrchestrator.getExecutionHistory();
    const pendingCheckpoints = agentOrchestrator.getPendingCheckpoints();
    const pendingAlerts = agentOrchestrator.getPendingAlerts();

    res.json({
      agents: agentStatus,
      recentExecutions: executionHistory.slice(-10),
      pendingCheckpoints: pendingCheckpoints.length,
      pendingAlerts: pendingAlerts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent status failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
