/**
 * Discovery REST API Router
 *
 * Phase 32 Plan 06: Express router for scanner control, device management,
 * access list CRUD, and Ironclaw callback. Mounted at /api/discovery.
 *
 * Static routes registered BEFORE parametric routes (Phase 19 pattern).
 * All request bodies validated with zod. Responses follow project pattern:
 * success -> JSON data, error -> { error: string }.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { discoveryStore } from './discovery-store.js';
import { AcceptanceGate } from './acceptance-gate.js';
import { getPool } from '../lib/database.js';
import { EMCollector } from './em-spectrum/em-collector.js';
import { NetworkTopology } from './network-topology.js';
import type {
  DeviceState,
  TransportType,
  AccessListType,
  MatchType,
  DiscoveredDevice,
} from './types.js';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const StartScanSchema = z.object({
  scope: z.string().optional(),
  origin: z.enum(['server', 'client', 'remote']).optional(),
});

const AddScanTargetSchema = z.object({
  address: z.string().min(1),
  portRange: z.string().optional(),
  protocol: z.enum(['tcp', 'udp', 'icmp']).default('tcp'),
  label: z.string().min(1),
  enabled: z.boolean().default(true),
});

const UpdateScanTargetSchema = z.object({
  address: z.string().min(1).optional(),
  portRange: z.string().optional(),
  protocol: z.enum(['tcp', 'udp', 'icmp']).optional(),
  label: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const ClientDiscoverySchema = z.object({
  transportType: z.enum(['ble', 'wifi', 'usb', 'tak']),
  rawIdentifier: z.string().min(1),
  signalStrength: z.number().optional(),
  rawData: z.record(z.string(), z.unknown()).default({}),
});

const ScannerConfigSchema = z.object({
  intervalMs: z.number().int().positive(),
  enabled: z.boolean(),
  interfaceFilter: z.array(z.string()).optional(),
});

const EmergencyDisconnectSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const AddAccessEntrySchema = z.object({
  listType: z.enum(['allow', 'block']),
  scope: z.string().default('global'),
  matchType: z.enum(['mac', 'vendor_id', 'product_id', 'cot_type', 'fingerprint_hash']),
  matchValue: z.string().min(1),
  displayName: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const IronclawResultSchema = z.object({
  deviceId: z.string().uuid(),
  approved: z.boolean(),
  analysis: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserDid(req: Request): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  if (anyReq.zeroTrust?.did) return anyReq.zeroTrust.did as string;
  if (anyReq.user?.did) return anyReq.user.did as string;
  return (req.headers['x-did'] as string) || 'did:near:anonymous';
}

/**
 * DiscoveryService facade (created in Plan 05).
 * Uses a lazy getter so this module compiles before the service exists.
 */
interface DiscoveryServiceFacade {
  getStatus: () => Record<string, unknown>;
  start: (scope?: string, origin?: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setScannerConfig: (transport: string, config: Record<string, unknown>) => void;
  ingestClientDiscovery: (event: Record<string, unknown>) => Promise<void>;
}

let _cachedService: DiscoveryServiceFacade | null | undefined;

async function getDiscoveryServiceSafe(): Promise<DiscoveryServiceFacade | null> {
  if (_cachedService !== undefined) return _cachedService;
  try {
    // Dynamic import avoids compile-time resolution of Plan 05 module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await (Function('return import("./discovery-service.js")')());
    if (mod?.getDiscoveryService) {
      _cachedService = mod.getDiscoveryService() as DiscoveryServiceFacade;
      return _cachedService;
    }
  } catch {
    // discovery-service.ts not yet created (Plan 05)
  }
  _cachedService = null;
  return null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const discoveryRouter = Router();

// All discovery routes require authentication
discoveryRouter.use(requireAuth);

// ==========================================================================
// Scanner Control (static routes first)
// ==========================================================================

/**
 * GET /status
 * Return current discovery scanner status.
 */
discoveryRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const svc = await getDiscoveryServiceSafe();
    if (!svc) {
      return res.json({
        state: 'unavailable',
        message: 'Discovery service not initialized',
      });
    }
    res.json(svc.getStatus());
  } catch (err) {
    console.error('[discovery-router] GET /status error:', err);
    res.status(500).json({ error: 'Failed to get discovery status' });
  }
});

/**
 * POST /start
 * Start scanning. Optional body: { scope?: string }
 */
discoveryRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const parsed = StartScanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const svc = await getDiscoveryServiceSafe();
    if (!svc) {
      return res.status(503).json({ error: 'Discovery service not initialized' });
    }

    // Validate legal consent before starting scan
    const userDid = getUserDid(req);
    const origin = parsed.data.origin ?? 'server';
    try {
      const { validateConsent } = await import('./legal-consent.js');
      const hasConsent = await validateConsent(userDid, origin);
      if (!hasConsent) {
        return res.status(451).json({
          error: 'Legal consent required before scanning',
          origin,
          consentEndpoint: `/api/discovery/legal-consent/${origin}`,
        });
      }
    } catch {
      // If consent module fails, log but don't block (graceful degradation)
      console.warn('[discovery-router] Legal consent validation failed, proceeding');
    }

    svc.start(parsed.data.scope, origin);
    res.json({ ok: true, message: 'Scanning started', origin });
  } catch (err) {
    console.error('[discovery-router] POST /start error:', err);
    res.status(500).json({ error: 'Failed to start scanning' });
  }
});

/**
 * POST /stop
 * Stop scanning.
 */
discoveryRouter.post('/stop', async (_req: Request, res: Response) => {
  try {
    const svc = await getDiscoveryServiceSafe();
    if (!svc) {
      return res.status(503).json({ error: 'Discovery service not initialized' });
    }

    svc.stop();
    res.json({ ok: true, message: 'Scanning stopped' });
  } catch (err) {
    console.error('[discovery-router] POST /stop error:', err);
    res.status(500).json({ error: 'Failed to stop scanning' });
  }
});

/**
 * POST /pause
 * Pause scanning.
 */
discoveryRouter.post('/pause', async (_req: Request, res: Response) => {
  try {
    const svc = await getDiscoveryServiceSafe();
    if (!svc) {
      return res.status(503).json({ error: 'Discovery service not initialized' });
    }

    svc.pause();
    res.json({ ok: true, message: 'Scanning paused' });
  } catch (err) {
    console.error('[discovery-router] POST /pause error:', err);
    res.status(500).json({ error: 'Failed to pause scanning' });
  }
});

/**
 * POST /resume
 * Resume scanning.
 */
discoveryRouter.post('/resume', async (_req: Request, res: Response) => {
  try {
    const svc = await getDiscoveryServiceSafe();
    if (!svc) {
      return res.status(503).json({ error: 'Discovery service not initialized' });
    }

    svc.resume();
    res.json({ ok: true, message: 'Scanning resumed' });
  } catch (err) {
    console.error('[discovery-router] POST /resume error:', err);
    res.status(500).json({ error: 'Failed to resume scanning' });
  }
});

// ==========================================================================
// Access List (static routes — before parametric device routes)
// ==========================================================================

/**
 * GET /access-list
 * List access entries. Query params: scope?, listType?
 */
discoveryRouter.get('/access-list', async (req: Request, res: Response) => {
  try {
    const scope = String(req.query.scope || 'global');
    const listType = String(req.query.listType || 'allow') as AccessListType;

    const entries = await discoveryStore.getAccessList(scope, listType);
    res.json({ entries, count: entries.length });
  } catch (err) {
    console.error('[discovery-router] GET /access-list error:', err);
    res.status(500).json({ error: 'Failed to list access entries' });
  }
});

/**
 * POST /access-list
 * Add an access entry. Creates DAO gate for approval on sensitive changes.
 */
discoveryRouter.post('/access-list', async (req: Request, res: Response) => {
  try {
    const parsed = AddAccessEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const userDid = getUserDid(req);
    const entry = await discoveryStore.addAccessEntry({
      listType: parsed.data.listType as AccessListType,
      scope: parsed.data.scope,
      matchType: parsed.data.matchType as MatchType,
      matchValue: parsed.data.matchValue,
      displayName: parsed.data.displayName,
      addedBy: userDid,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error('[discovery-router] POST /access-list error:', err);
    res.status(500).json({ error: 'Failed to add access entry' });
  }
});

/**
 * DELETE /access-list/:id
 * Remove an access entry.
 */
discoveryRouter.delete('/access-list/:id', async (req: Request, res: Response) => {
  try {
    const removed = await discoveryStore.removeAccessEntry(String(req.params.id));
    if (!removed) {
      return res.status(404).json({ error: 'Access entry not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[discovery-router] DELETE /access-list/:id error:', err);
    res.status(500).json({ error: 'Failed to remove access entry' });
  }
});

// ==========================================================================
// Legal Consent (Phase 32 Plan 12)
// ==========================================================================

/**
 * GET /legal-consent/:origin
 * Get required legal text and consent status for a scan origin.
 */
discoveryRouter.get('/legal-consent/:origin', async (req: Request, res: Response) => {
  try {
    const origin = String(req.params.origin);
    const userDid = getUserDid(req);
    const targetId = req.query.targetId ? String(req.query.targetId) : undefined;
    const isMilitary = req.query.military === 'true';

    const { getRequiredConsent } = await import('./legal-consent.js');
    const requirement = await getRequiredConsent(origin, userDid, targetId, isMilitary);
    res.json(requirement);
  } catch (err) {
    console.error('[discovery-router] GET /legal-consent/:origin error:', err);
    res.status(500).json({ error: 'Failed to get legal consent requirement' });
  }
});

/**
 * POST /legal-consent
 * Record user's acceptance of legal consent.
 */
discoveryRouter.post('/legal-consent', async (req: Request, res: Response) => {
  try {
    const consentSchema = z.object({
      consentType: z.enum(['server_local', 'client_device', 'remote_network', 'military_network']),
      legalTextHash: z.string().min(1),
      targetId: z.string().uuid().optional(),
    });
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const userDid = getUserDid(req);
    const ip = req.ip || req.socket.remoteAddress || undefined;

    const { acceptConsent } = await import('./legal-consent.js');
    const result = await acceptConsent(
      userDid,
      parsed.data.consentType,
      parsed.data.legalTextHash,
      parsed.data.targetId,
      ip,
    );

    res.json({ ok: true, expiresAt: result.expiresAt });
  } catch (err) {
    console.error('[discovery-router] POST /legal-consent error:', err);
    res.status(500).json({ error: 'Failed to record legal consent' });
  }
});

// ==========================================================================
// Ironclaw Callback (static route)
// ==========================================================================

/**
 * POST /ironclaw-result
 * Receive Ironclaw analysis result for a device.
 */
discoveryRouter.post('/ironclaw-result', async (req: Request, res: Response) => {
  try {
    const parsed = IronclawResultSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { deviceId, approved, analysis } = parsed.data;

    // Update device with ironclaw analysis
    const newState: DeviceState = approved ? 'pending_dao' : 'quarantined';
    const extra: Partial<DiscoveredDevice> = {
      ironclawAnalysis: analysis ?? { approved },
    };
    if (!approved) {
      extra.quarantineReason = 'Ironclaw analysis rejected device';
    }

    await discoveryStore.updateDeviceState(deviceId, newState, extra as never);

    res.json({ ok: true, deviceId, newState });
  } catch (err) {
    console.error('[discovery-router] POST /ironclaw-result error:', err);
    res.status(500).json({ error: 'Failed to process ironclaw result' });
  }
});

// ==========================================================================
// Device Routes (parametric routes AFTER static routes)
// ==========================================================================

/**
 * GET /devices
 * List devices. Query params: state?, transport?, limit?, offset?
 */
discoveryRouter.get('/devices', async (req: Request, res: Response) => {
  try {
    const { state, transport, limit, offset } = req.query;
    const pool = getPool();

    // Build dynamic query
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (state) {
      conditions.push(`state = $${paramIdx++}`);
      params.push(state);
    }
    if (transport) {
      conditions.push(`transport_type = $${paramIdx++}`);
      params.push(transport);
    }

    const where = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    const limitVal = Math.min(Number(limit) || 50, 200);
    const offsetVal = Number(offset) || 0;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM discovered_devices ${where}`,
      params,
    );

    const result = await pool.query(
      `SELECT * FROM discovered_devices ${where}
       ORDER BY last_seen DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limitVal, offsetVal],
    );

    // Map rows using store's format
    const devices = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      transportType: row.transport_type,
      rawIdentifier: row.raw_identifier,
      fingerprint: row.fingerprint ?? null,
      state: row.state,
      deviceDid: row.device_did ?? undefined,
      resourceId: row.resource_id ?? undefined,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      signalStrength: row.signal_strength ?? undefined,
      location: row.location ?? undefined,
      ironclawAnalysis: row.ironclaw_analysis ?? undefined,
      gateId: row.gate_id ?? undefined,
      quarantineReason: row.quarantine_reason ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      devices,
      total: Number(countResult.rows[0].count),
      limit: limitVal,
      offset: offsetVal,
    });
  } catch (err) {
    console.error('[discovery-router] GET /devices error:', err);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

/**
 * GET /devices/:id
 * Get a single device by ID.
 */
discoveryRouter.get('/devices/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM discovered_devices WHERE id = $1`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      transportType: row.transport_type,
      rawIdentifier: row.raw_identifier,
      fingerprint: row.fingerprint ?? null,
      state: row.state,
      deviceDid: row.device_did ?? undefined,
      resourceId: row.resource_id ?? undefined,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      signalStrength: row.signal_strength ?? undefined,
      location: row.location ?? undefined,
      ironclawAnalysis: row.ironclaw_analysis ?? undefined,
      gateId: row.gate_id ?? undefined,
      quarantineReason: row.quarantine_reason ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('[discovery-router] GET /devices/:id error:', err);
    res.status(500).json({ error: 'Failed to get device' });
  }
});

/**
 * POST /devices/:id/emergency-disconnect
 * Emergency disconnect a device. Admin role required.
 */
discoveryRouter.post(
  '/devices/:id/emergency-disconnect',
  async (req: Request, res: Response) => {
    try {
      const parsed = EmergencyDisconnectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const adminDid = getUserDid(req);

      // Create AcceptanceGate instance for emergency disconnect
      const gate = new AcceptanceGate(discoveryStore);
      await gate.handleEmergencyDisconnect(
        String(req.params.id),
        adminDid,
        parsed.data.reason,
      );

      res.json({
        ok: true,
        message: `Device ${req.params.id} emergency disconnected`,
        deviceId: req.params.id,
      });
    } catch (err) {
      console.error('[discovery-router] POST /devices/:id/emergency-disconnect error:', err);
      res.status(500).json({ error: 'Failed to emergency disconnect device' });
    }
  },
);

// ==========================================================================
// Scanner Config (parametric route)
// ==========================================================================

/**
 * PUT /scanner/:transport/config
 * Update scanner configuration for a transport type.
 */
discoveryRouter.put(
  '/scanner/:transport/config',
  async (req: Request, res: Response) => {
    try {
      const parsed = ScannerConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const svc = await getDiscoveryServiceSafe();
      if (!svc) {
        return res.status(503).json({ error: 'Discovery service not initialized' });
      }

      svc.setScannerConfig(
        req.params.transport as TransportType,
        parsed.data as unknown as Record<string, unknown>,
      );

      res.json({ ok: true, transport: req.params.transport });
    } catch (err) {
      console.error('[discovery-router] PUT /scanner/:transport/config error:', err);
      res.status(500).json({ error: 'Failed to update scanner config' });
    }
  },
);

// ==========================================================================
// Scan Targets CRUD (Phase 32 Plan 10)
// ==========================================================================

/**
 * GET /scan-targets
 * List configured remote scan targets.
 */
discoveryRouter.get('/scan-targets', async (_req: Request, res: Response) => {
  try {
    const targets = await discoveryStore.listScanTargets();
    res.json({ targets, count: targets.length });
  } catch (err) {
    console.error('[discovery-router] GET /scan-targets error:', err);
    res.status(500).json({ error: 'Failed to list scan targets' });
  }
});

/**
 * POST /scan-targets
 * Add a new remote scan target.
 */
discoveryRouter.post('/scan-targets', async (req: Request, res: Response) => {
  try {
    const parsed = AddScanTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const userDid = getUserDid(req);
    const target = await discoveryStore.addScanTarget({
      address: parsed.data.address,
      portRange: parsed.data.portRange,
      protocol: parsed.data.protocol,
      label: parsed.data.label,
      enabled: parsed.data.enabled,
      createdBy: userDid,
    });

    res.status(201).json(target);
  } catch (err) {
    console.error('[discovery-router] POST /scan-targets error:', err);
    res.status(500).json({ error: 'Failed to add scan target' });
  }
});

/**
 * PUT /scan-targets/:id
 * Update a scan target.
 */
discoveryRouter.put('/scan-targets/:id', async (req: Request, res: Response) => {
  try {
    const parsed = UpdateScanTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const target = await discoveryStore.updateScanTarget(
      String(req.params.id),
      parsed.data,
    );

    if (!target) {
      return res.status(404).json({ error: 'Scan target not found' });
    }

    res.json(target);
  } catch (err) {
    console.error('[discovery-router] PUT /scan-targets/:id error:', err);
    res.status(500).json({ error: 'Failed to update scan target' });
  }
});

/**
 * DELETE /scan-targets/:id
 * Remove a scan target.
 */
discoveryRouter.delete('/scan-targets/:id', async (req: Request, res: Response) => {
  try {
    const removed = await discoveryStore.removeScanTarget(String(req.params.id));
    if (!removed) {
      return res.status(404).json({ error: 'Scan target not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[discovery-router] DELETE /scan-targets/:id error:', err);
    res.status(500).json({ error: 'Failed to remove scan target' });
  }
});

// ==========================================================================
// Client Discovery (Phase 32 Plan 10)
// ==========================================================================

/**
 * POST /client-discovery
 * Accept browser-reported device discoveries (origin='client').
 */
discoveryRouter.post('/client-discovery', async (req: Request, res: Response) => {
  try {
    const parsed = ClientDiscoverySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const svc = await getDiscoveryServiceSafe();
    if (!svc) {
      return res.status(503).json({ error: 'Discovery service not initialized' });
    }

    const now = Date.now();
    const event = {
      transportType: parsed.data.transportType as TransportType,
      rawIdentifier: parsed.data.rawIdentifier,
      signalStrength: parsed.data.signalStrength,
      firstSeen: now,
      lastSeen: now,
      rawData: parsed.data.rawData,
    };

    await svc.ingestClientDiscovery(event);
    res.json({ ok: true, message: 'Client discovery ingested' });
  } catch (err) {
    console.error('[discovery-router] POST /client-discovery error:', err);
    res.status(500).json({ error: 'Failed to ingest client discovery' });
  }
});

// ==========================================================================
// EM Spectrum Awareness (Phase 32 Plan 07)
// ==========================================================================

/** Shared EM collector instance (lazy singleton) */
let _emCollector: EMCollector | null = null;
function getEMCollector(): EMCollector {
  if (!_emCollector) {
    _emCollector = new EMCollector();
    _emCollector.start();
  }
  return _emCollector;
}

/**
 * GET /em/snapshot
 * Return current EM picture with per-band summaries.
 */
discoveryRouter.get('/em/snapshot', async (_req: Request, res: Response) => {
  try {
    const collector = getEMCollector();
    res.json(collector.getSnapshot());
  } catch (err) {
    console.error('[discovery-router] GET /em/snapshot error:', err);
    res.status(500).json({ error: 'Failed to get EM snapshot' });
  }
});

/**
 * GET /em/own-footprint
 * Return Bastion's own electromagnetic emissions for OPSEC awareness.
 */
discoveryRouter.get('/em/own-footprint', async (_req: Request, res: Response) => {
  try {
    const collector = getEMCollector();
    res.json({ emissions: collector.getOwnFootprint() });
  } catch (err) {
    console.error('[discovery-router] GET /em/own-footprint error:', err);
    res.status(500).json({ error: 'Failed to get own EM footprint' });
  }
});

// ==========================================================================
// Network Topology (Phase 32 Plan 07)
// ==========================================================================

/** Shared NetworkTopology instance (lazy singleton) */
let _topology: NetworkTopology | null = null;
async function getTopology(): Promise<NetworkTopology> {
  if (!_topology) {
    _topology = new NetworkTopology();
    await _topology.load();
  }
  return _topology;
}

/**
 * GET /topology
 * Return full network topology graph with stats.
 */
discoveryRouter.get('/topology', async (_req: Request, res: Response) => {
  try {
    const topo = await getTopology();
    const graph = topo.getGraph();
    res.json({
      nodes: Array.from(graph.nodes.values()),
      edges: graph.edges,
      networks: Array.from(graph.networks.values()),
      stats: topo.getStats(),
      hoppingEnabled: topo.hoppingEnabled,
    });
  } catch (err) {
    console.error('[discovery-router] GET /topology error:', err);
    res.status(500).json({ error: 'Failed to get network topology' });
  }
});

/**
 * GET /topology/stats
 * Return topology statistics only.
 */
discoveryRouter.get('/topology/stats', async (_req: Request, res: Response) => {
  try {
    const topo = await getTopology();
    res.json(topo.getStats());
  } catch (err) {
    console.error('[discovery-router] GET /topology/stats error:', err);
    res.status(500).json({ error: 'Failed to get topology stats' });
  }
});

/**
 * GET /topology/path/:from/:to
 * Find shortest path between two nodes via BFS.
 */
discoveryRouter.get('/topology/path/:from/:to', async (req: Request, res: Response) => {
  try {
    const topo = await getTopology();
    const path = topo.getPath(String(req.params.from), String(req.params.to));
    res.json({ path, hops: path.length > 0 ? path.length - 1 : 0 });
  } catch (err) {
    console.error('[discovery-router] GET /topology/path error:', err);
    res.status(500).json({ error: 'Failed to find topology path' });
  }
});
