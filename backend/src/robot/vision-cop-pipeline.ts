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
import { buildSIDC } from '../cop/svg/sidc-builder.js';

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
  // Custom trained tank types (add your class names here after training)
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

    // Find or create the adversary detection layer
    const existingLayers = await layerStore.queryLayers({
      workspaceId,
      layerType: 'force_disposition',
    });

    // Look for an existing "Adversary Detections" layer
    let layerId: string | null = null;
    for (const layer of existingLayers) {
      const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
      if (meta?.generatedBy === 'vision-detection-pipeline') {
        layerId = layer.id;
        break;
      }
    }

    const spec = {
      layerId: layerId ?? `vision-adversary-${Date.now()}`,
      layerType: 'force_disposition' as const,
      workspaceId,
      sectionId: 'default',
      symbols: symbols.map(s => ({
        entityId: s.entityId,
        designation: s.designation,
        type: s.type,
        echelon: s.echelon,
        affiliation: s.affiliation,
        sidc: s.sidc,
        position: s.position,
        sourceDocumentId: s.sourceDocumentId,
        sourceAuthority: s.sourceAuthority,
      })),
      controlMeasures: [],
      customAnnotations: symbols.map(s => ({
        id: s.entityId,
        type: 'detection' as const,
        text: `${s.designation} detected by ${s.detectedBy} (${(s.confidence * 100).toFixed(0)}% confidence)`,
        position: s.position,
        style: { color: '#ef4444' },
      })),
      temporalPhases: [],
      metadata: {
        generatedBy: 'vision-detection-pipeline',
        generatedAt: new Date().toISOString(),
        layerName: 'Adversary Detections',
        detectionCount: symbols.length,
      },
    };

    if (layerId) {
      // Update existing layer
      await layerStore.updateLayerSpec(layerId, spec);
    } else {
      // Create new layer
      await layerStore.createLayer({
        workspaceId,
        sectionId: 'default',
        layerType: 'force_disposition',
        createdBy: 'vision-detection-pipeline',
        spec,
      });
    }

    console.log(`[Vision→COP] Updated adversary layer with ${symbols.length} detection(s)`);
  } catch (err) {
    console.warn('[Vision→COP] Failed to update COP layer:', err);
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

      // Create/update hostile actor node
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
          a.updatedAt = $now
        ON MATCH SET
          a.attributes = $attributes,
          a.updatedAt = $now
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
          r.updatedAt = $now
      `, {
        robotId: robotActorId,
        robotName: robotId,
        workspaceId,
        now,
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
          rel.updatedAt = $now
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
      });
    }

    console.log(`[Vision→Graph] Added ${symbols.length} threat detection(s) to knowledge graph`);
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

  console.log(`[Vision Pipeline] ${symbols.length} threat(s) detected by ${msg.robot_id}`);

  // Run COP and graph updates concurrently
  const wsId = workspaceId ?? 'default';
  await Promise.all([
    updateAdversaryCOPLayer(wsId, symbols),
    updateKnowledgeGraph(wsId, symbols, msg.robot_id),
  ]);
}
