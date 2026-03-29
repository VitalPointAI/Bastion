/**
 * Document Intelligence → COP Layer Pipeline
 *
 * Phase 50 Gap Plan 06
 *
 * Creates COP intelligence layers from geocoded locations extracted during
 * doc-intelligence processing. Mirrors the OSINT COP pipeline pattern
 * (osint-cop-pipeline.ts) but sources data from document reports instead
 * of OSINT events.
 *
 * Each document produces a uniquely-named layer section so analysts can
 * distinguish between sources on the COP.
 */

import type { DocumentIntelligenceReport, ExtractedFact } from './types.js';
import type { COPLayerSpec, COPSymbolSpec, COPAnnotationSpec, Affiliation } from '../cop/layers/layer-types.js';
import type { GeoLocation } from '../lib/geocoding-service.js';
import { getConfidenceTier } from '../graph/provenance-types.js';
import { randomUUID } from 'crypto';

// ── Affiliation heuristics (shared with osint-cop-pipeline) ──────────────

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

// ── Symbol set heuristics ────────────────────────────────────────────────

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
  return { symbolSet: '10', entity: '110000', type: 'ground' };
}

const AFFILIATION_CODE: Record<string, string> = {
  enemy: '6',
  unknown: '1',
  neutral: '4',
  friendly: '3',
};

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a descriptive layer section ID from document metadata.
 * e.g. "intel-pacific-strategy-assessment-2026-03"
 */
function buildLayerSectionId(report: DocumentIntelligenceReport, metadata?: Record<string, unknown>): string {
  const docType = report.triage?.documentType?.toLowerCase() ?? 'intel';
  const title = (metadata?.title as string)
    ?? (metadata?.originalName as string)
    ?? report.summary?.slice(0, 50)
    ?? 'document';

  const slug = title
    .replace(/\.[^.]+$/, '') // strip file extension
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);

  const date = new Date().toISOString().slice(0, 7); // YYYY-MM
  return `${docType}-${slug}-${date}`;
}

/**
 * Build a human-readable layer display name.
 * e.g. "INTEL_ESTIMATE: Theater Assessment (Mar 2026)"
 */
export function buildLayerDisplayName(report: DocumentIntelligenceReport, metadata?: Record<string, unknown>): string {
  const docType = report.triage?.documentType ?? 'DOCUMENT';
  const title = (metadata?.title as string)
    ?? (metadata?.originalName as string)
    ?? `Document ${report.documentId.slice(0, 8)}`;

  // Strip file extension for display
  const cleanTitle = title.replace(/\.[^.]+$/, '');
  const date = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${docType}: ${cleanTitle} (${date})`;
}

/**
 * Find facts whose entities or geospatialContext mention a location name.
 */
function findFactsNearLocation(facts: ExtractedFact[], locationName: string): ExtractedFact[] {
  const lower = locationName.toLowerCase();
  return facts.filter((f) => {
    const inEntities = f.entities?.some((e) => e.toLowerCase().includes(lower));
    const inGeo = f.geospatialContext?.toLowerCase().includes(lower);
    const inClaim = f.claim?.toLowerCase().includes(lower);
    return inEntities || inGeo || inClaim;
  });
}

// ── Pipeline ─────────────────────────────────────────────────────────────

/**
 * Create or update a COP intel layer from doc-intelligence geocoded locations.
 *
 * @param problemSetId  Workspace scoping
 * @param report        Completed DocumentIntelligenceReport
 * @param locations     Geocoded locations from geocodingService.extractLocations()
 * @param metadata      Document metadata (title, originalName, etc.)
 */
export async function updateDocIntelCOPLayer(
  problemSetId: string,
  report: DocumentIntelligenceReport,
  locations: GeoLocation[],
  metadata?: Record<string, unknown>,
): Promise<{ symbolCount: number; layerSectionId: string } | null> {
  // Filter to locations with valid coordinates
  const validLocations = locations.filter(
    (loc) => loc.latitude && loc.longitude && !(loc.latitude === 0 && loc.longitude === 0),
  );

  if (validLocations.length === 0) {
    console.log(`[DocIntel→COP] No valid geo-located data for document ${report.documentId}`);
    return null;
  }

  try {
    const { layerStore } = await import('../cop/layers/layer-store.js');

    const sectionId = buildLayerSectionId(report, metadata);
    const displayName = buildLayerDisplayName(report, metadata);

    // Build symbols from locations cross-referenced with extracted facts
    const symbols: COPSymbolSpec[] = [];
    const annotations: COPAnnotationSpec[] = [];

    for (const loc of validLocations) {
      const relatedFacts = findFactsNearLocation(report.facts ?? [], loc.name);
      const entityId = `DOCINT-${report.documentId.slice(0, 8)}-${randomUUID().slice(0, 4)}`;

      if (relatedFacts.length > 0) {
        // Location has associated entities/facts — create COP symbol with SIDC
        const factText = relatedFacts.map((f) => f.claim).join(' ');
        const entityNames = relatedFacts.flatMap((f) => f.entities ?? []);
        const affiliation = inferAffiliation(factText);
        const { symbolSet, entity, type } = inferSymbolSet(factText);
        const affiliationCode = AFFILIATION_CODE[affiliation] ?? '1';
        const sidc = `10${affiliationCode}${symbolSet}0000${entity}0000`;
        const confidence = Math.max(...relatedFacts.map((f) => f.confidence ?? 0.5));

        symbols.push({
          entityId,
          designation: entityNames.length > 0
            ? `${entityNames[0]} (${loc.name})`
            : `${loc.name} — ${relatedFacts[0].claim.slice(0, 40)}`,
          affiliation,
          sidc,
          position: { lat: loc.latitude, lng: loc.longitude },
          linkedEntities: entityNames,
          ccoClass: type,
          confidence,
          sourceAuthority: displayName,
          confidenceTier: getConfidenceTier(confidence),
          assertedVia: 'doc_intelligence_pipeline',
          provenanceSummary: `${displayName} — ${relatedFacts.length} related fact(s)`,
        });
      }

      // Always create annotation (even if no SIDC symbol — shows location marker)
      annotations.push({
        id: entityId,
        svgFragment: '',
        position: { lat: loc.latitude, lng: loc.longitude },
        generatedBy: 'doc-intelligence-pipeline',
        description: `${displayName}: ${loc.name}${loc.region ? `, ${loc.region}` : ''}`,
      });
    }

    const layerId = `docint-${report.documentId.slice(0, 12)}-${Date.now()}`;

    const spec: COPLayerSpec = {
      layerId,
      layerType: 'intel',
      workspaceId: problemSetId,
      sectionId,
      symbols,
      controlMeasures: [],
      customAnnotations: annotations,
      temporalPhases: [],
      metadata: {
        generatedBy: 'doc-intelligence-pipeline',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: [report.documentId],
        ccoValidated: false,
        displayName, // extra field for COP UI to show descriptive name
      } as COPLayerSpec['metadata'] & { displayName: string },
    };

    await layerStore.createLayer({
      workspaceId: problemSetId,
      sectionId,
      layerType: 'intel',
      spec,
    });

    console.log(
      `[DocIntel→COP] Created intel layer "${displayName}" with ${symbols.length} symbol(s) and ${annotations.length} annotation(s) for workspace=${problemSetId}`,
    );

    // Notify frontend via message bus
    try {
      const { getMessageBus } = await import('../messaging/message-bus.js');
      const messageBus = getMessageBus();
      await messageBus.publish({
        sourceDid: 'system:doc-intelligence-pipeline',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'cop:layer_updated',
        messageType: 'cop.layer.updated',
        payload: {
          workspaceId: problemSetId,
          layerType: 'intel',
          symbolCount: symbols.length,
          annotationCount: annotations.length,
          source: 'doc-intelligence-pipeline',
          displayName,
          documentId: report.documentId,
        },
      });
    } catch { /* non-fatal */ }

    return { symbolCount: symbols.length, layerSectionId: sectionId };
  } catch (err) {
    console.error('[DocIntel→COP] Failed to update COP layer:', err);
    return null;
  }
}
