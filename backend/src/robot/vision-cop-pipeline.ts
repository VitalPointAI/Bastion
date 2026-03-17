/**
 * Vision → COP + Knowledge Graph Pipeline
 *
 * When the robot reports vision detections (robot:vision messages),
 * this pipeline:
 *   1. Identifies threat detections (tanks, military vehicles, etc.)
 *   2. Creates/updates adversary COP layer symbols with proper military SIDC
 *   3. Adds hostile actor nodes to the Neo4j knowledge graph
 *   4. Links detections to the detecting robot for provenance
 *
 * Wired into RobotMissionService.handleVisionMsg() as a post-processor.
 */

import { randomUUID } from 'crypto';
import type { RobotVisionMsg } from './robot-types.js';
import type { COPLayerSpec, COPSymbolSpec, COPAnnotationSpec, Affiliation } from '../cop/layers/layer-types.js';
import { getConfidenceTier } from '../graph/provenance-types.js';
import { SOURCE_WEIGHTS } from '../graph/confidence-calculator.js';
import { entityResolutionService } from '../graph/resolution/resolution-service.js';

const BASTION_CONTEXT = 'https://bastion.vitalpoint.ai/ontology/context.jsonld';
const VISION_ASSERTED_BY = 'system:yolov8-detector';
const VISION_SOURCE_WEIGHT = SOURCE_WEIGHTS['vision_pipeline']; // 0.70
// Vision detections are highly perishable: 1-day half-life
const VISION_HALF_LIFE_DAYS = 1;

// ── Threat Classification ──────────────────────────────────────────────────

/** Map detection class names to threat categories and military symbology */
const THREAT_CLASS_MAP: Record<string, {
  category: 'ground_vehicle' | 'aircraft' | 'naval' | 'personnel' | 'installation';
  affiliation: 'hostile' | 'unknown' | 'neutral';
  echelon: string;
  designation: string;
  symbolSet: string;  // MIL-STD-2525D symbol set
  entity: string;     // Entity code
}> = {
  // Bastion-trained tank classes (from robot/vision/training/)
  't-90': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'T-90 Main Battle Tank', symbolSet: '10', entity: '120100',
  },
  't90': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'T-90 Main Battle Tank', symbolSet: '10', entity: '120100',
  },
  'chn-99g': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Type 99G Main Battle Tank (ZTZ-99G)', symbolSet: '10', entity: '120100',
  },
  'chn99g': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Type 99G Main Battle Tank (ZTZ-99G)', symbolSet: '10', entity: '120100',
  },
  // Other known tank types
  't72': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'T-72 Main Battle Tank', symbolSet: '10', entity: '120100',
  },
  'ztz99': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'ZTZ-99 Main Battle Tank', symbolSet: '10', entity: '120100',
  },
  'type99': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Type 99 Main Battle Tank', symbolSet: '10', entity: '120100',
  },
  // Phase 48 additions — adversary classes for Taiwan contingency training
  't-99': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Type 99 Main Battle Tank', symbolSet: '10', entity: '120100',
  },
  'zbd-04': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'ZBD-04 Infantry Fighting Vehicle', symbolSet: '10', entity: '120200',
  },
  'zbd04': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'ZBD-04 Infantry Fighting Vehicle', symbolSet: '10', entity: '120200',
  },
  'btr-82': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'BTR-82 Armored Personnel Carrier', symbolSet: '10', entity: '120200',
  },
  'btr82': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'BTR-82 Armored Personnel Carrier', symbolSet: '10', entity: '120200',
  },
  // Generic YOLO classes that map to threats
  'tank': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Unknown Tank', symbolSet: '10', entity: '120100',
  },
  'military vehicle': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Military Vehicle', symbolSet: '10', entity: '120000',
  },
  'armored vehicle': {
    category: 'ground_vehicle', affiliation: 'hostile', echelon: 'unit',
    designation: 'Armored Vehicle', symbolSet: '10', entity: '120200',
  },
  'truck': {
    category: 'ground_vehicle', affiliation: 'unknown', echelon: 'unit',
    designation: 'Truck', symbolSet: '10', entity: '140000',
  },
  'airplane': {
    category: 'aircraft', affiliation: 'unknown', echelon: 'unit',
    designation: 'Fixed Wing Aircraft', symbolSet: '01', entity: '110000',
  },
  'helicopter': {
    category: 'aircraft', affiliation: 'unknown', echelon: 'unit',
    designation: 'Rotary Wing Aircraft', symbolSet: '01', entity: '110100',
  },
  'boat': {
    category: 'naval', affiliation: 'unknown', echelon: 'unit',
    designation: 'Surface Vessel', symbolSet: '30', entity: '120000',
  },
  'person': {
    category: 'personnel', affiliation: 'unknown', echelon: 'individual',
    designation: 'Personnel', symbolSet: '10', entity: '110000',
  },
};

/** Affiliation code for MIL-STD-2525D */
const AFFILIATION_CODE: Record<string, string> = {
  hostile: '6',    // Hostile
  unknown: '1',    // Unknown
  neutral: '4',    // Neutral
  friendly: '3',   // Friendly
};

// ── COP Symbol Generation ──────────────────────────────────────────────────

interface COPSymbol {
  entityId: string;
  designation: string;
  type: string;
  echelon: string;
  affiliation: string;
  sidc: string;
  position: { lat: number; lng: number };
  sourceDocumentId: string;
  sourceAuthority: number;
  detectedBy: string;
  detectedAt: string;
  confidence: number;
}

/**
 * Process vision detections and return COP symbols for threats.
 */
export function extractThreatSymbols(
  msg: RobotVisionMsg,
  robotPosition: { lat: number; lng: number } | null,
): COPSymbol[] {
  const symbols: COPSymbol[] = [];

  for (const detection of msg.detections) {
    const classKey = detection.class_desc.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const threat = THREAT_CLASS_MAP[classKey];
    if (!threat) continue;

    // Use robot's position as the detection location
    // (future: triangulate from camera angle + distance estimation)
    const position = robotPosition ?? { lat: 0, lng: 0 };

    // Build MIL-STD-2525D SIDC
    const affiliationCode = AFFILIATION_CODE[threat.affiliation] ?? '1';
    // SIDC format: Version(2) + Context(1) + Affiliation(1) + SymbolSet(2) + Status(1) + HQTFD(1) + Amplifier(2) + Entity(6) + Modifier(4)
    const sidc = `10${affiliationCode}${threat.symbolSet}0000${threat.entity}0000`;

    symbols.push({
      entityId: `DET-${randomUUID().slice(0, 8)}`,
      designation: threat.designation,
      type: threat.category,
      echelon: threat.echelon,
      affiliation: threat.affiliation,
      sidc,
      position,
      sourceDocumentId: msg.mission_id ?? msg.robot_id,
      sourceAuthority: detection.confidence,
      detectedBy: msg.robot_id,
      detectedAt: new Date().toISOString(),
      confidence: detection.confidence,
    });
  }

  return symbols;
}

// ── Multi-Robot Corroboration ──────────────────────────────────────────────

const VISION_PIPELINE_WEIGHT = 0.70;

/**
 * Fuse confidence scores from multiple robot detections of the same threat.
 *
 * Uses the Phase 47 weighted complementary probability formula:
 *   fused = 1 - product(1 - d.confidence * VISION_PIPELINE_WEIGHT)
 *
 * Confidence increases as more independent sources corroborate a detection.
 */
export function fuseDetectionConfidence(
  detections: Array<{ confidence: number }>,
): number {
  const product = detections.reduce(
    (prod, d) => prod * (1 - d.confidence * VISION_PIPELINE_WEIGHT),
    1,
  );
  return 1 - product;
}

/**
 * Determine corroboration status for visual encoding on the COP.
 *
 * - ghosted: single-source or low confidence (< 0.5) — semi-transparent symbol
 * - low:     partially corroborated (0.5–0.85) — muted symbol
 * - solid:   multi-source corroborated (> 0.85) — full opacity symbol
 */
export function corroborationStatus(
  confidence: number,
): 'ghosted' | 'low' | 'solid' {
  if (confidence < 0.5) return 'ghosted';
  if (confidence <= 0.85) return 'low';
  return 'solid';
}

/**
 * Check if two detections are of the same threat.
 * Matches on class category and position within 50m radius.
 */
function isSameThreat(
  existing: COPSymbol,
  incoming: COPSymbol,
): boolean {
  if (existing.type !== incoming.type) return false;
  if (existing.affiliation !== incoming.affiliation) return false;

  // Approximate 50m radius check (1 degree lat ≈ 111km, 50m ≈ 0.00045 deg)
  const LAT_DEG_PER_METER = 1 / 111000;
  const latDiff = Math.abs(existing.position.lat - incoming.position.lat);
  const lngDiff = Math.abs(existing.position.lng - incoming.position.lng);
  const distApprox = Math.sqrt(latDiff ** 2 + lngDiff ** 2) / LAT_DEG_PER_METER;

  return distApprox < 50;
}

/**
 * Corroborate incoming symbols against existing symbols.
 *
 * When a new detection matches an existing one (same class + within 50m),
 * fuses confidence instead of creating a duplicate symbol.
 * Returns de-duplicated list with fused confidence on corroborated threats.
 */
export function corroborateDetections(
  incoming: COPSymbol[],
  existing: COPSymbol[],
): COPSymbol[] {
  const result: COPSymbol[] = [...existing];

  for (const symbol of incoming) {
    const matchIdx = result.findIndex(e => isSameThreat(e, symbol));
    if (matchIdx >= 0) {
      // Corroborate: fuse confidence from both sources
      const fused = fuseDetectionConfidence([
        { confidence: result[matchIdx].confidence },
        { confidence: symbol.confidence },
      ]);
      result[matchIdx] = {
        ...result[matchIdx],
        confidence: fused,
        detectedBy: `${result[matchIdx].detectedBy},${symbol.detectedBy}`,
        detectedAt: symbol.detectedAt,
      };
    } else {
      // New detection — apply single-source weight
      result.push({
        ...symbol,
        confidence: fuseDetectionConfidence([{ confidence: symbol.confidence }]),
      });
    }
  }

  return result;
}

// ── COP Layer Update ───────────────────────────────────────────────────────

/**
 * Add threat detection symbols to the adversary COP layer.
 * Creates the layer if it doesn't exist.
 */
export async function updateAdversaryCOPLayer(
  workspaceId: string,
  symbols: COPSymbol[],
): Promise<void> {
  if (symbols.length === 0) return;

  try {
    const { layerStore } = await import('../cop/layers/layer-store.js');

    // Find or create the adversary detection layer (tactical level)
    // Uses dedicated sectionId to avoid dedup collision with strategic seed layers
    const visionSectionId = 'vision-detections';
    const existingLayers = await layerStore.queryLayers({
      workspaceId,
      layerType: 'force_disposition',
    });

    // Look for an existing vision-generated adversary layer
    let layerId: string | null = null;
    for (const layer of existingLayers) {
      const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
      if (meta?.generatedBy === 'vision-detection-pipeline') {
        layerId = layer.id;
        break;
      }
    }

    const copSymbols: COPSymbolSpec[] = symbols.map(s => ({
      entityId: s.entityId,
      designation: s.designation,
      affiliation: (s.affiliation === 'hostile' ? 'enemy' : s.affiliation) as Affiliation,
      sidc: s.sidc,
      position: s.position,
      linkedEntities: [] as string[],
      ccoClass: s.type,
      confidence: s.confidence,
      sourceAuthority: `${s.detectedBy} (vision detection)`,
      confidenceTier: getConfidenceTier(s.confidence),
      assertedVia: 'vision_pipeline',
      provenanceSummary: `${s.detectedBy} vision detection (confidence: ${Math.round(s.confidence * 100)}%)`,
    }));

    const copAnnotations: COPAnnotationSpec[] = symbols.map(s => ({
      id: s.entityId,
      svgFragment: '',
      position: s.position,
      generatedBy: 'vision-detection-pipeline',
      description: `${s.designation} detected by ${s.detectedBy} (${(s.confidence * 100).toFixed(0)}% confidence)`,
    }));

    const spec: COPLayerSpec = {
      layerId: layerId ?? `vision-adversary-${Date.now()}`,
      layerType: 'force_disposition',
      workspaceId,
      sectionId: visionSectionId,
      symbols: copSymbols,
      controlMeasures: [],
      customAnnotations: copAnnotations,
      temporalPhases: [],
      metadata: {
        generatedBy: 'vision-detection-pipeline',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: symbols.map(s => s.entityId),
        ccoValidated: false,
      },
    };

    if (layerId) {
      await layerStore.updateLayerSpec(layerId, spec);
    } else {
      await layerStore.createLayer({
        workspaceId,
        sectionId: visionSectionId,
        layerType: 'force_disposition',
        spec,
      });
    }

    console.log(`[Vision→COP] Updated adversary layer in workspace=${workspaceId} with ${symbols.length} detection(s)`);

    // Notify frontend to refresh COP layers
    try {
      const { getMessageBus } = await import('../messaging/message-bus.js');
      const messageBus = getMessageBus();
      await messageBus.publish({
        sourceDid: 'system:vision-pipeline',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'cop:layer_updated',
        messageType: 'cop.layer.updated',
        payload: {
          workspaceId,
          layerType: 'force_disposition',
          symbolCount: symbols.length,
          source: 'vision-detection-pipeline',
        },
      });
    } catch { /* non-fatal */ }
  } catch (err) {
    console.error('[Vision→COP] Failed to update COP layer:', err);
  }
}

// ── Knowledge Graph Update ─────────────────────────────────────────────────

/**
 * Add detected threats to the Neo4j knowledge graph as hostile actor nodes.
 */
export async function updateKnowledgeGraph(
  workspaceId: string,
  symbols: COPSymbol[],
  robotId: string,
): Promise<void> {
  if (symbols.length === 0) return;

  try {
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');
    const now = new Date().toISOString();

    for (const symbol of symbols) {
      const actorId = `ACT-det-${symbol.designation.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
      const derivedFrom = JSON.stringify([symbol.entityId, symbol.sourceDocumentId]);

      // Map detection category to CCO JSON-LD type
      const jsonldType = symbol.type === 'personnel'
        ? 'cco:Person'
        : 'jc3:Equipment'; // tanks, vehicles, aircraft, naval

      // Create/update hostile actor node with JSON-LD provenance
      await executeWriteQuery(`
        MERGE (a:Actor {id: $id})
        ON CREATE SET
          a.name = $name,
          a.type = 'military',
          a.aliases = [],
          a.attributes = $attributes,
          a.workspaceId = $workspaceId,
          a.sourceDocumentIds = [$docId],
          a.containerIds = [],
          a.createdAt = $now,
          a.updatedAt = $now,
          a.jsonldType = $jsonldType,
          a.jsonldContext = $jsonldContext,
          a.assertedBy = $assertedBy,
          a.assertedVia = 'vision_pipeline',
          a.derivedFrom = $derivedFrom,
          a.confidence = $confidence,
          a.sourceWeight = $sourceWeight,
          a.validFrom = $validFrom,
          a.validTo = null,
          a.halfLifeDays = $halfLifeDays,
          a.attributes_affiliation = $affiliation,
          a.attributes_lat = $lat,
          a.attributes_lng = $lng
        ON MATCH SET
          a.attributes = $attributes,
          a.updatedAt = $now,
          a.confidence = $confidence,
          a.derivedFrom = $derivedFrom,
          a.attributes_lat = $lat,
          a.attributes_lng = $lng
      `, {
        id: actorId,
        name: symbol.designation,
        attributes: JSON.stringify({
          source: 'vision_detection',
          affiliation: symbol.affiliation,
          sidc: symbol.sidc,
          position: symbol.position,
          confidence: symbol.confidence,
          detectedBy: robotId,
          detectedAt: symbol.detectedAt,
          category: symbol.type,
        }),
        workspaceId,
        docId: `detection-${symbol.entityId}`,
        now,
        // JSON-LD provenance fields
        jsonldType,
        jsonldContext: BASTION_CONTEXT,
        assertedBy: VISION_ASSERTED_BY,
        derivedFrom,
        confidence: symbol.confidence * VISION_SOURCE_WEIGHT, // scale by source reliability
        sourceWeight: VISION_SOURCE_WEIGHT,
        validFrom: symbol.detectedAt,
        halfLifeDays: VISION_HALF_LIFE_DAYS,
        affiliation: symbol.affiliation,
        lat: symbol.position.lat,
        lng: symbol.position.lng,
      });

      // Create DETECTED_BY relationship to the robot
      const robotActorId = `ACT-robot-${robotId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;

      await executeWriteQuery(`
        MERGE (r:Actor {id: $robotId})
        ON CREATE SET
          r.name = $robotName,
          r.type = 'autonomous_system',
          r.aliases = [],
          r.attributes = '{}',
          r.workspaceId = $workspaceId,
          r.sourceDocumentIds = [],
          r.containerIds = [],
          r.createdAt = $now,
          r.updatedAt = $now,
          r.jsonldType = 'cco:Agent',
          r.jsonldContext = $jsonldContext,
          r.assertedBy = $assertedBy,
          r.assertedVia = 'vision_pipeline',
          r.derivedFrom = '[]',
          r.confidence = 1.0,
          r.sourceWeight = $sourceWeight,
          r.validFrom = $now,
          r.validTo = null,
          r.halfLifeDays = 3650
      `, {
        robotId: robotActorId,
        robotName: robotId,
        workspaceId,
        now,
        jsonldContext: BASTION_CONTEXT,
        assertedBy: VISION_ASSERTED_BY,
        sourceWeight: VISION_SOURCE_WEIGHT,
      });

      await executeWriteQuery(`
        MATCH (r:Actor {id: $robotId})
        MATCH (t:Actor {id: $threatId})
        MERGE (r)-[rel:RELATES_TO {type: 'detected'}]->(t)
        ON CREATE SET
          rel.id = $relId,
          rel.type = 'detected',
          rel.strength = $confidence,
          rel.description = $desc,
          rel.evidence = $evidence,
          rel.sourceDocumentIds = [$docId],
          rel.createdAt = $now,
          rel.updatedAt = $now,
          rel.jsonldType = 'cco:ActOfRelating',
          rel.jsonldContext = $jsonldContext,
          rel.assertedBy = $assertedBy,
          rel.assertedVia = 'vision_pipeline',
          rel.derivedFrom = $derivedFrom,
          rel.confidence = $confidence,
          rel.sourceWeight = $sourceWeight,
          rel.validFrom = $validFrom,
          rel.validTo = null,
          rel.halfLifeDays = $halfLifeDays
        ON MATCH SET
          rel.strength = $confidence,
          rel.updatedAt = $now
      `, {
        robotId: robotActorId,
        threatId: actorId,
        relId: `REL-${randomUUID()}`,
        confidence: symbol.confidence,
        desc: `${robotId} detected ${symbol.designation} at ${symbol.detectedAt}`,
        evidence: `Vision detection, confidence: ${(symbol.confidence * 100).toFixed(0)}%`,
        docId: `detection-${symbol.entityId}`,
        now,
        jsonldContext: BASTION_CONTEXT,
        assertedBy: VISION_ASSERTED_BY,
        derivedFrom,
        sourceWeight: VISION_SOURCE_WEIGHT,
        validFrom: symbol.detectedAt,
        halfLifeDays: VISION_HALF_LIFE_DAYS,
      });
    }

    console.log(`[Vision→Graph] Added ${symbols.length} threat detection(s) to knowledge graph`);

    // Trigger entity resolution after writes to check for duplicates with other sources
    try {
      const resolution = await entityResolutionService.findDuplicates(workspaceId);
      if (resolution.autoMerge.length > 0) {
        await entityResolutionService.autoMergeDuplicates(resolution);
      }
    } catch (resolutionErr) {
      // Non-fatal: entity resolution failure should not block vision pipeline
      console.warn('[Vision→Graph] Entity resolution failed after writes:', resolutionErr);
    }
  } catch (err) {
    console.warn('[Vision→Graph] Failed to update knowledge graph:', err);
  }
}

// ── Main Pipeline Entry Point ──────────────────────────────────────────────

/**
 * Process a robot vision message through the full pipeline:
 * detect threats → COP layer → knowledge graph.
 *
 * Call this from RobotMissionService.handleVisionMsg().
 */
export async function processVisionDetections(
  msg: RobotVisionMsg,
  workspaceId: string | undefined,
  robotPosition: { lat: number; lng: number } | null,
): Promise<void> {
  if (!msg.detections || msg.detections.length === 0) return;

  const symbols = extractThreatSymbols(msg, robotPosition);
  if (symbols.length === 0) return;

  console.log(`[Vision Pipeline] ${symbols.length} threat(s) detected by ${msg.robot_id}, workspace=${workspaceId ?? 'default'}`);

  // Run COP update first (critical), then graph (best-effort)
  const wsId = workspaceId ?? 'default';
  await updateAdversaryCOPLayer(wsId, symbols);

  // Graph update is best-effort — don't let it block or mask COP errors
  updateKnowledgeGraph(wsId, symbols, msg.robot_id).catch((err) =>
    console.warn('[Vision Pipeline] Graph update failed (non-fatal):', err),
  );
}
