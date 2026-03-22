/**
 * OSINT → COP Layer Pipeline
 *
 * Creates per-category COP intelligence layers from OSINT events.
 * Each event category (military, cyber, maritime, political, etc.) gets
 * its own layer so users can toggle visibility per category — similar
 * to WorldMonitor's multi-layer approach.
 *
 * Military events use MIL-STD-2525D SIDC codes rendered via milsymbol.
 * Non-military events use descriptive category icons (emoji-based markers).
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

// ── OSINT category classification ────────────────────────────────────────

interface OSINTCategory {
  type: string;
  /** Human-readable layer display name */
  label: string;
  /** True = use milsymbol SIDC, false = use descriptive icon */
  military: boolean;
  /** SIDC parts for military categories */
  symbolSet?: string;
  entity?: string;
  /** Icon emoji for non-military categories */
  icon?: string;
  /** Background color for the icon marker */
  color?: string;
}

function classifyEvent(text: string): OSINTCategory {
  const lower = text.toLowerCase();

  // ── Military categories → rendered as MIL-STD-2525D symbols ──
  if (/naval|warship|fleet|carrier|destroyer|frigate|submarine|amphibious/.test(lower))
    return { type: 'naval', label: 'Naval Activity', military: true, symbolSet: '30', entity: '120000' };
  if (/aircraft|fighter|bomber|drone|uav|sortie|airspace|no.fly/.test(lower))
    return { type: 'air', label: 'Air Activity', military: true, symbolSet: '01', entity: '110000' };
  if (/tank|armor|mechaniz|infantry|brigade|battalion|regiment|division|corps(?:\s|$)/.test(lower))
    return { type: 'ground', label: 'Ground Forces', military: true, symbolSet: '10', entity: '121100' };
  if (/missile|rocket|icbm|ballistic|launch/.test(lower))
    return { type: 'missile', label: 'Missile / Launch', military: true, symbolSet: '10', entity: '110300' };

  // ── Non-military categories → rendered with descriptive icons ──
  if (/cyber|hack|malware|intrusion|ransomware|data\s?breach/.test(lower))
    return { type: 'cyber', label: 'Cyber Threats', military: false, icon: '💻', color: '#7c3aed' };
  if (/piracy|pirate|hijack|smuggl|traffick|cartel|criminal/.test(lower))
    return { type: 'criminal', label: 'Criminal Activity', military: false, icon: '🏴‍☠️', color: '#1f2937' };
  if (/terror|extremis|insurg|militant|jihad/.test(lower))
    return { type: 'terrorism', label: 'Terrorism', military: false, icon: '💥', color: '#dc2626' };
  if (/explosion|ied|detona|blast/.test(lower))
    return { type: 'explosion', label: 'Explosions', military: false, icon: '💥', color: '#ea580c' };
  if (/protest|riot|unrest|demonstrat|uprising|civil\s?unrest/.test(lower))
    return { type: 'civil_unrest', label: 'Civil Unrest', military: false, icon: '✊', color: '#d97706' };
  if (/fire|wildfire|forest\s?fire|blaze|burn/.test(lower))
    return { type: 'fire', label: 'Fires', military: false, icon: '🔥', color: '#dc2626' };
  if (/earthquake|seismic|tremor|quake/.test(lower))
    return { type: 'earthquake', label: 'Earthquakes', military: false, icon: '🌍', color: '#92400e' };
  if (/flood|tsunami|typhoon|hurricane|cyclone|storm/.test(lower))
    return { type: 'natural_disaster', label: 'Natural Disasters', military: false, icon: '🌊', color: '#0369a1' };
  if (/humanitarian|refugee|displaced|famine|aid\s?worker/.test(lower))
    return { type: 'humanitarian', label: 'Humanitarian', military: false, icon: '🏥', color: '#dc2626' };
  if (/nuclear|wmd|chemical\s?weapon|biological\s?weapon|radiolog/.test(lower))
    return { type: 'wmd', label: 'WMD / Nuclear', military: false, icon: '☢️', color: '#facc15' };
  if (/ship|vessel|maritime|tanker|cargo|shipping|sea\s?lane/.test(lower))
    return { type: 'maritime', label: 'Maritime', military: false, icon: '🚢', color: '#0284c7' };
  if (/port|harbor|dock|wharf/.test(lower))
    return { type: 'ports', label: 'Ports', military: false, icon: '⚓', color: '#0369a1' };
  if (/sanction|embargo|export\s?control|tariff|trade\s?war/.test(lower))
    return { type: 'sanctions', label: 'Sanctions', military: false, icon: '🚫', color: '#b91c1c' };
  if (/trade|econom|gdp|inflation|recession|market/.test(lower))
    return { type: 'economic', label: 'Economic', military: false, icon: '📊', color: '#059669' };
  if (/diplom|treaty|summit|negotiat|ambassador|embassy|foreign\s?minister/.test(lower))
    return { type: 'diplomatic', label: 'Diplomatic', military: false, icon: '🤝', color: '#2563eb' };
  if (/election|government|parliament|legislat|political|coup|regime/.test(lower))
    return { type: 'political', label: 'Political', military: false, icon: '🏛️', color: '#4f46e5' };
  if (/energy|oil|gas|pipeline|opec|petroleum|lng/.test(lower))
    return { type: 'energy', label: 'Energy', military: false, icon: '⛽', color: '#ca8a04' };
  if (/space|satellite|orbit|rocket\s?launch/.test(lower))
    return { type: 'space', label: 'Space', military: false, icon: '🛰️', color: '#1e3a5f' };
  if (/gps\s?jam|signal\s?jam|electronic\s?warfare|spoofing/.test(lower))
    return { type: 'ew', label: 'Electronic Warfare', military: false, icon: '📡', color: '#7c3aed' };

  // Default: generic intelligence report
  return { type: 'intel_report', label: 'Intelligence Reports', military: false, icon: '📰', color: '#6b7280' };
}

// ── Icon HTML generator ──────────────────────────────────────────────────

/**
 * Build a styled HTML marker for a non-military OSINT event.
 * Renders as a colored circle with an emoji icon inside.
 */
function buildOSINTIconHtml(icon: string, color: string, affiliation: Affiliation): string {
  // Border color encodes affiliation (like milsymbol frame colors)
  const borderColor =
    affiliation === 'enemy' ? '#dc2626' :
    affiliation === 'friendly' ? '#2563eb' :
    affiliation === 'neutral' ? '#16a34a' :
    '#9ca3af';

  return `<div style="
    display:flex;align-items:center;justify-content:center;
    width:32px;height:32px;border-radius:50%;
    background:${color};border:2.5px solid ${borderColor};
    font-size:16px;line-height:1;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
    cursor:pointer;
  ">${icon}</div>`;
}

// ── SIDC construction for military categories ────────────────────────────

// MIL-STD-2525D identity codes are 2 digits (positions 3-4)
const AFFILIATION_CODE: Record<string, string> = {
  enemy: '06',
  unknown: '01',
  neutral: '04',
  friendly: '03',
};

// ── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Create or update per-category COP intel layers from OSINT events.
 * Each event category gets its own toggleable layer.
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

    // Load existing OSINT layers to find ones we can update
    const existingLayers = await layerStore.queryLayers({
      workspaceId,
      layerType: 'intel',
    });

    // Index existing layers by category type
    const existingLayersByCategory = new Map<string, string>();
    for (const layer of existingLayers) {
      const meta = layer.spec?.metadata as Record<string, unknown> | undefined;
      if (meta?.generatedBy === 'osint-feed-pipeline' && typeof meta?.osintCategory === 'string') {
        existingLayersByCategory.set(meta.osintCategory as string, layer.id);
      }
    }

    // Group events by category
    const eventsByCategory = new Map<string, Array<{
      evt: OSINTEvent;
      category: OSINTCategory;
    }>>();

    for (const evt of geoEvents) {
      const text = `${evt.title ?? ''} ${evt.description ?? ''}`;
      const category = classifyEvent(text);
      const group = eventsByCategory.get(category.type) ?? [];
      group.push({ evt, category });
      eventsByCategory.set(category.type, group);
    }

    // Create/update a layer per category
    let totalSymbols = 0;

    for (const [categoryType, items] of eventsByCategory) {
      const { category } = items[0]; // All items share same category
      const layerId = existingLayersByCategory.get(categoryType) ?? null;

      const symbols: COPSymbolSpec[] = [];
      const annotations: COPAnnotationSpec[] = [];

      for (const { evt } of items) {
        const loc = evt.location as { latitude: number; longitude: number; name?: string };
        const text = `${evt.title ?? ''} ${evt.description ?? ''}`;
        const affiliation = inferAffiliation(text);
        const entityId = `OSINT-${evt.id.slice(0, 12)}`;
        const confidence = 0.65;

        const symbolSpec: COPSymbolSpec = {
          entityId,
          designation: evt.title ?? 'OSINT Report',
          affiliation,
          sidc: '',
          position: { lat: loc.latitude, lng: loc.longitude },
          linkedEntities: [],
          ccoClass: category.type,
          confidence,
          sourceAuthority: `${evt.sourceName ?? 'OSINT'} (${evt.sourceType ?? 'feed'})`,
          confidenceTier: getConfidenceTier(confidence),
          assertedVia: 'osint_feed_pipeline',
          provenanceSummary: `${evt.sourceName ?? 'OSINT'} feed — ${evt.title ?? 'report'}`,
        };

        if (category.military) {
          const affiliationCode = AFFILIATION_CODE[affiliation] ?? '01';
          symbolSpec.sidc = `10${affiliationCode}${category.symbolSet}0000${category.entity}0000`;
        } else {
          symbolSpec.sidc = '10010000000000000000';
          symbolSpec.iconHtml = buildOSINTIconHtml(
            category.icon ?? '📰',
            category.color ?? '#6b7280',
            affiliation,
          );
        }

        symbols.push(symbolSpec);

        annotations.push({
          id: entityId,
          svgFragment: '',
          position: { lat: loc.latitude, lng: loc.longitude },
          generatedBy: 'osint-feed-pipeline',
          description: `${evt.title ?? 'OSINT'} — ${(evt.actors ?? []).join(', ')}`,
        });
      }

      totalSymbols += symbols.length;

      // Layer display name includes the category icon for quick identification
      const iconPrefix = category.icon ? `${category.icon} ` : '';
      const displayName = `${iconPrefix}OSINT: ${category.label}`;

      const spec: COPLayerSpec = {
        layerId: layerId ?? `osint-${categoryType}-${Date.now()}`,
        layerType: 'intel',
        workspaceId,
        sectionId: `osint-${categoryType}`,
        symbols,
        controlMeasures: [],
        customAnnotations: annotations,
        temporalPhases: [],
        metadata: {
          generatedBy: 'osint-feed-pipeline',
          generatedAt: new Date().toISOString(),
          sourceDocumentIds: items.map(i => i.evt.id),
          ccoValidated: false,
          osintCategory: categoryType,
          displayName,
        } as COPLayerSpec['metadata'] & { osintCategory: string; displayName: string },
      };

      if (layerId) {
        await layerStore.updateLayerSpec(layerId, spec);
      } else {
        await layerStore.createLayer({
          workspaceId,
          sectionId: `osint-${categoryType}`,
          layerType: 'intel',
          spec,
        });
      }
    }

    console.log(
      `[OSINT→COP] Updated ${eventsByCategory.size} category layer(s) with ${totalSymbols} total symbol(s) for workspace=${workspaceId}`,
    );

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
          symbolCount: totalSymbols,
          categoryCount: eventsByCategory.size,
          source: 'osint-feed-pipeline',
        },
      });
    } catch { /* non-fatal */ }

  } catch (err) {
    console.error('[OSINT→COP] Failed to update COP layer:', err);
  }
}
