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
import { extractLocation } from './osint-graph-sync.js';
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
  /** Icon emoji */
  icon: string;
  /** Background color for the icon marker */
  color: string;
}

function classifyEvent(text: string, sourceName?: string): OSINTCategory {
  const lower = text.toLowerCase();
  const sourceL = (sourceName ?? '').toLowerCase();

  // All OSINT uses descriptive icons — MIL-STD-2525D reserved for operational/tactical overlays

  // ── Source-level classification (overrides content) ──
  // Feeds like Ransomware.live don't include "ransomware" in item text
  if (/ransomware|hacker\s?news|dark\s?reading|krebs|schneier/.test(sourceL))
    return { type: 'cyber', label: 'Cyber Threats', icon: '💻', color: '#7c3aed' };

  // ── Military/defense reporting ──
  if (/naval|warship|fleet|carrier|destroyer|frigate|submarine|amphibious/.test(lower))
    return { type: 'naval', label: 'Naval Activity', icon: '⚓', color: '#1e3a5f' };
  if (/aircraft|fighter|bomber|drone|uav|sortie|airspace|no.fly/.test(lower))
    return { type: 'air', label: 'Air Activity', icon: '✈️', color: '#1e40af' };
  if (/tank|armor|mechaniz|infantry|brigade|battalion|regiment|division|corps(?:\s|$)/.test(lower))
    return { type: 'ground', label: 'Ground Forces', icon: '🎖️', color: '#365314' };
  if (/missile|rocket|icbm|ballistic/.test(lower))
    return { type: 'missile', label: 'Missile / Launch', icon: '🚀', color: '#7f1d1d' };
  if (/military|defense|defence|armed\s?force|pentagon|ministry.*defen/.test(lower))
    return { type: 'defense', label: 'Defense', icon: '🛡️', color: '#1e3a5f' };

  // ── Non-military categories ──
  // "victim" + "published" is a ransomware pattern even without the word ransomware
  if (/cyber|hack|malware|intrusion|ransomware|data\s?breach|victim.*publish|publish.*victim/.test(lower))
    return { type: 'cyber', label: 'Cyber Threats', icon: '💻', color: '#7c3aed' };
  if (/piracy|pirate|hijack|smuggl|traffick|cartel|criminal/.test(lower))
    return { type: 'criminal', label: 'Criminal Activity', icon: '🏴‍☠️', color: '#1f2937' };
  if (/terror|extremis|insurg|militant|jihad/.test(lower))
    return { type: 'terrorism', label: 'Terrorism', icon: '💥', color: '#dc2626' };
  if (/explosion|ied|detona|blast/.test(lower))
    return { type: 'explosion', label: 'Explosions', icon: '💥', color: '#ea580c' };
  if (/protest|riot|unrest|demonstrat|uprising|civil\s?unrest/.test(lower))
    return { type: 'civil_unrest', label: 'Civil Unrest', icon: '✊', color: '#d97706' };
  if (/fire|wildfire|forest\s?fire|blaze|burn/.test(lower))
    return { type: 'fire', label: 'Fires', icon: '🔥', color: '#dc2626' };
  if (/earthquake|seismic|tremor|quake/.test(lower))
    return { type: 'earthquake', label: 'Earthquakes', icon: '🌍', color: '#92400e' };
  if (/flood|tsunami|typhoon|hurricane|cyclone|storm/.test(lower))
    return { type: 'natural_disaster', label: 'Natural Disasters', icon: '🌊', color: '#0369a1' };
  if (/humanitarian|refugee|displaced|famine|aid\s?worker/.test(lower))
    return { type: 'humanitarian', label: 'Humanitarian', icon: '🏥', color: '#dc2626' };
  if (/nuclear|wmd|chemical\s?weapon|biological\s?weapon|radiolog/.test(lower))
    return { type: 'wmd', label: 'WMD / Nuclear', icon: '☢️', color: '#facc15' };
  if (/ship|vessel|maritime|tanker|cargo|shipping|sea\s?lane/.test(lower))
    return { type: 'maritime', label: 'Maritime', icon: '🚢', color: '#0284c7' };
  if (/port|harbor|dock|wharf/.test(lower))
    return { type: 'ports', label: 'Ports', icon: '⚓', color: '#0369a1' };
  if (/sanction|embargo|export\s?control|tariff|trade\s?war/.test(lower))
    return { type: 'sanctions', label: 'Sanctions', icon: '🚫', color: '#b91c1c' };
  if (/trade|econom|gdp|inflation|recession|market/.test(lower))
    return { type: 'economic', label: 'Economic', icon: '📊', color: '#059669' };
  if (/diplom|treaty|summit|negotiat|ambassador|embassy|foreign\s?minister/.test(lower))
    return { type: 'diplomatic', label: 'Diplomatic', icon: '🤝', color: '#2563eb' };
  if (/election|government|parliament|legislat|political|coup|regime/.test(lower))
    return { type: 'political', label: 'Political', icon: '🏛️', color: '#4f46e5' };
  if (/energy|oil|gas|pipeline|opec|petroleum|lng/.test(lower))
    return { type: 'energy', label: 'Energy', icon: '⛽', color: '#ca8a04' };
  if (/space|satellite|orbit|rocket\s?launch/.test(lower))
    return { type: 'space', label: 'Space', icon: '🛰️', color: '#1e3a5f' };
  if (/gps\s?jam|signal\s?jam|electronic\s?warfare|spoofing/.test(lower))
    return { type: 'ew', label: 'Electronic Warfare', icon: '📡', color: '#7c3aed' };

  // Default: generic intelligence report
  return { type: 'intel_report', label: 'Intelligence Reports', icon: '📰', color: '#6b7280' };
}

// ── Directional location extraction ──────────────────────────────────────

/**
 * Detect origin→target directionality in OSINT event text.
 * Patterns like "X attacks/sanctions/threatens/invades Y" produce
 * animated arrows on the COP from origin to target.
 */
function extractDirectionalLocations(
  text: string,
  extractLocationFn: (t: string) => { latitude: number; longitude: number } | null,
): { origin: { lat: number; lng: number } | null; target: { lat: number; lng: number } | null } {
  const none = { origin: null, target: null };
  if (!text || text.length < 20) return none;

  // Directional verbs: "X <verb> Y" where X is origin and Y is target
  const dirPatterns = [
    /(.{3,40})\s+(?:attack(?:s|ed)?|strike(?:s|d)?|bomb(?:s|ed)?|shell(?:s|ed)?|invade[sd]?)\s+(.{3,40})/i,
    /(.{3,40})\s+(?:sanction(?:s|ed)?|embargo(?:s|ed)?|block(?:s|ed)?)\s+(.{3,40})/i,
    /(.{3,40})\s+(?:threaten(?:s|ed)?|warn(?:s|ed)?|confront(?:s|ed)?)\s+(.{3,40})/i,
    /(.{3,40})\s+(?:send(?:s)?|deploy(?:s|ed)?|dispatch(?:es|ed)?|ship(?:s|ped)?)\s+.*?\s+(?:to)\s+(.{3,40})/i,
    /(.{3,40})\s+(?:export(?:s|ed)?|deliver(?:s|ed)?|suppl(?:y|ies|ied))\s+.*?\s+(?:to)\s+(.{3,40})/i,
    /(.{3,40})\s+(?:launch(?:es|ed)?)\s+.*?\s+(?:at|toward(?:s)?|against)\s+(.{3,40})/i,
    /(.{3,40})\s+(?:aid(?:s|ed)?|assist(?:s|ed)?|support(?:s|ed)?)\s+(.{3,40})/i,
  ];

  for (const pattern of dirPatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const originLoc = extractLocationFn(match[1]);
    const targetLoc = extractLocationFn(match[2]);

    if (originLoc && targetLoc) {
      // Ensure they're actually different locations
      const dist = Math.abs(originLoc.latitude - targetLoc.latitude) +
                   Math.abs(originLoc.longitude - targetLoc.longitude);
      if (dist > 1) {
        return {
          origin: { lat: originLoc.latitude, lng: originLoc.longitude },
          target: { lat: targetLoc.latitude, lng: targetLoc.longitude },
        };
      }
    }
  }

  return none;
}

// ── Icon HTML generator ──────────────────────────────────────────────────

/**
 * Build a small styled HTML marker for a non-military OSINT event.
 * Small 18px dot with emoji — one per event, WorldMonitor-style density.
 */
function buildOSINTIconHtml(icon: string, color: string, _affiliation: Affiliation): string {
  return `<div style="
    display:flex;align-items:center;justify-content:center;
    width:22px;height:22px;border-radius:50%;
    background:rgba(255,255,255,0.92);border:2.5px solid ${color};
    font-size:13px;line-height:1;
    box-shadow:0 1px 4px rgba(0,0,0,0.5);
    cursor:pointer;
  ">${icon}</div>`;
}

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
      const category = classifyEvent(text, evt.sourceName);
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

        // Truncate description for popup (first 200 chars)
        const descSnippet = (evt.description ?? '').length > 200
          ? (evt.description ?? '').slice(0, 197) + '...'
          : (evt.description ?? '');

        const symbolSpec: COPSymbolSpec = {
          entityId,
          designation: evt.title ?? 'OSINT Report',
          affiliation,
          sidc: '',
          position: { lat: loc.latitude, lng: loc.longitude },
          linkedEntities: [],
          ccoClass: category.type,
          description: descSnippet,
          sourceUrl: evt.sourceUrl,
          actors: evt.actors ?? [],
          confidence,
          sourceAuthority: `${evt.sourceName ?? 'OSINT'} (${evt.sourceType ?? 'feed'})`,
          confidenceTier: getConfidenceTier(confidence),
          assertedVia: 'osint_feed_pipeline',
          provenanceSummary: `${evt.sourceName ?? 'OSINT'} feed — ${evt.title ?? 'report'}`,
        };

        // All OSINT uses descriptive icons — no SIDC
        symbolSpec.sidc = '10010000000000000000'; // placeholder, not rendered
        symbolSpec.iconHtml = buildOSINTIconHtml(
          category.icon,
          category.color,
          affiliation,
        );

        // Extract directional origin→target for animated arrows
        const dir = extractDirectionalLocations(text, (t) => extractLocation(t));
        if (dir.origin && dir.target) {
          symbolSpec.originPosition = dir.origin;
          symbolSpec.targetPosition = dir.target;
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
        // Merge new symbols into existing layer instead of overwriting
        const existingLayer = await layerStore.getLayer(layerId);
        if (existingLayer?.spec?.symbols) {
          const symbolMap = new Map<string, COPSymbolSpec>();
          for (const s of existingLayer.spec.symbols) {
            symbolMap.set(s.entityId, s);
          }
          for (const s of symbols) {
            const prev = symbolMap.get(s.entityId);
            if (!prev || s.confidence > prev.confidence) {
              symbolMap.set(s.entityId, s);
            }
          }
          spec.symbols = [...symbolMap.values()];
        }
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
