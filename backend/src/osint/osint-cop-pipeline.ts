/**
 * OSINT → COP Layer Pipeline
 *
 * Creates COP intelligence layers directly from OSINT events that have
 * location data or extracted actors. Runs immediately when events are
 * ingested (no LLM coordinator dependency).
 *
 * Similar to the vision-cop-pipeline for robot detections — deterministic,
 * fast, and reliable.
 */

import type { OSINTEvent } from '../graph/osint/types.js';
import type { COPLayerSpec, COPSymbolSpec, COPAnnotationSpec, Affiliation } from '../cop/layers/layer-types.js';
import { getConfidenceTier } from '../graph/provenance-types.js';

// ── Affiliation heuristics ─────────────────────────────────────────────────

const HOSTILE_KEYWORDS = [
  'hostile', 'enemy', 'adversar', 'threat', 'attack', 'aggress',
  'pla ', 'prc', 'north korea', 'dprk', 'wagner', 'militia',
  'strike', 'missile', 'incursion', 'invasion', 'bomb',
];
const FRIENDLY_KEYWORDS = [
  'allied', 'nato', 'partner', 'coalition', 'us ', 'united states',
  'japan', 'australia', 'south korea', 'rok', 'philippines',
];

function inferAffiliation(text: string): Affiliation {
  const lower = text.toLowerCase();
  if (HOSTILE_KEYWORDS.some((k) => lower.includes(k))) return 'enemy';
  if (FRIENDLY_KEYWORDS.some((k) => lower.includes(k))) return 'friendly';
  return 'unknown';
}

// ── Symbol set heuristics ──────────────────────────────────────────────────

function inferSymbolSet(text: string): { symbolSet: string; entity: string; type: string } {
  const lower = text.toLowerCase();
  if (/naval|ship|fleet|carrier|destroyer|frigate|submarine/.test(lower))
    return { symbolSet: '30', entity: '120000', type: 'naval' };
  if (/air|aircraft|fighter|bomber|drone|uav/.test(lower))
    return { symbolSet: '01', entity: '110000', type: 'air' };
  if (/cyber|hack|malware|intrusion/.test(lower))
    return { symbolSet: '60', entity: '110000', type: 'cyber' };
  if (/tank|armor|mechaniz|infantry|brigade|battalion|regiment|division|corps|army/.test(lower))
    return { symbolSet: '10', entity: '120100', type: 'ground' };
  // Default: ground unit
  return { symbolSet: '10', entity: '110000', type: 'ground' };
}

const AFFILIATION_CODE: Record<string, string> = {
  enemy: '6',
  unknown: '1',
  neutral: '4',
  friendly: '3',
};

// ── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Create or update COP intel layer from OSINT events that have locations.
 * Only events with valid lat/lng produce symbols.
 */
export async function updateOSINTCOPLayer(
  workspaceId: string,
  events: OSINTEvent[],
): Promise<void> {
  // Filter to events with location data
  const geoEvents = events.filter((e) => {
    const loc = e.location as { latitude?: number; longitude?: number } | null;
    return loc && loc.latitude && loc.longitude &&
      !(loc.latitude === 0 && loc.longitude === 0);
  });

  if (geoEvents.length === 0) {
    console.log(`[OSINT→COP] No geo-located events to create COP symbols from`);
    return;
  }

  try {
    const { layerStore } = await import('../cop/layers/layer-store.js');

    // Find existing OSINT intel layer
    const existingLayers = await layerStore.queryLayers({
      workspaceId,
      layerType: 'intel',
    });

    let layerId: string | null = null;
    for (const layer of existingLayers) {
      const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
      if (meta?.generatedBy === 'osint-feed-pipeline') {
        layerId = layer.id;
        break;
      }
    }

    // Build symbols from geo-located events
    const symbols: COPSymbolSpec[] = [];
    const annotations: COPAnnotationSpec[] = [];

    for (const evt of geoEvents) {
      const loc = evt.location as { latitude: number; longitude: number; name?: string };
      const text = `${evt.title ?? ''} ${evt.description ?? ''}`;
      const affiliation = inferAffiliation(text);
      const { symbolSet, entity, type } = inferSymbolSet(text);
      const affiliationCode = AFFILIATION_CODE[affiliation] ?? '1';
      const sidc = `10${affiliationCode}${symbolSet}0000${entity}0000`;
      const entityId = `OSINT-${evt.id.slice(0, 12)}`;
      const confidence = 0.65; // OSINT source weight

      symbols.push({
        entityId,
        designation: evt.title ?? 'OSINT Report',
        affiliation,
        sidc,
        position: { lat: loc.latitude, lng: loc.longitude },
        linkedEntities: [],
        ccoClass: type,
        confidence,
        sourceAuthority: `${evt.sourceName ?? 'OSINT'} (${evt.sourceType ?? 'feed'})`,
        confidenceTier: getConfidenceTier(confidence),
        assertedVia: 'osint_feed_pipeline',
        provenanceSummary: `${evt.sourceName ?? 'OSINT'} feed — ${evt.title ?? 'report'}`,
      });

      annotations.push({
        id: entityId,
        svgFragment: '',
        position: { lat: loc.latitude, lng: loc.longitude },
        generatedBy: 'osint-feed-pipeline',
        description: `${evt.title ?? 'OSINT'} — ${(evt.actors ?? []).join(', ')}`,
      });
    }

    const spec: COPLayerSpec = {
      layerId: layerId ?? `osint-intel-${Date.now()}`,
      layerType: 'intel',
      workspaceId,
      sectionId: 'osint-intelligence',
      symbols,
      controlMeasures: [],
      customAnnotations: annotations,
      temporalPhases: [],
      metadata: {
        generatedBy: 'osint-feed-pipeline',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: geoEvents.map((e) => e.id),
        ccoValidated: false,
      },
    };

    if (layerId) {
      await layerStore.updateLayerSpec(layerId, spec);
    } else {
      await layerStore.createLayer({
        workspaceId,
        sectionId: 'osint-intelligence',
        layerType: 'intel',
        spec,
      });
    }

    console.log(`[OSINT→COP] Updated intel layer with ${symbols.length} OSINT symbol(s) for workspace=${workspaceId}`);

    // Notify frontend via message bus
    try {
      const { getMessageBus } = await import('../messaging/message-bus.js');
      const messageBus = getMessageBus();
      await messageBus.publish({
        sourceDid: 'system:osint-pipeline',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'cop:layer_updated',
        messageType: 'cop.layer.updated',
        payload: {
          workspaceId,
          layerType: 'intel',
          symbolCount: symbols.length,
          source: 'osint-feed-pipeline',
        },
      });
    } catch { /* non-fatal */ }

  } catch (err) {
    console.error('[OSINT→COP] Failed to update COP layer:', err);
  }
}
