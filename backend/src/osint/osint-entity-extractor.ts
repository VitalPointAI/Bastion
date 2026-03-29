/**
 * OSINT Entity & Tension Extractor
 *
 * Uses LLM to extract structured entities, relationships, and tensions
 * from OSINT event content. Creates proper Neo4j Actor nodes and
 * Relationship edges so the knowledge graph reflects real-world dynamics.
 *
 * Flow:
 *   OSINT event text → LLM extraction → Neo4j nodes + edges
 *
 * Extracted data:
 *   - Actors (nations, organizations, individuals, groups)
 *   - Relationships (allied, adversarial, competing, cooperating, neutral)
 *   - Tensions (conflict points with intensity scores)
 *   - Locations mentioned (with coordinates if extractable)
 */

/**
 * @deprecated Phase 63: This module is superseded by osint-agent-bridge.ts.
 * All OSINT events now route through the doc-intelligence agent pipeline.
 * This file is retained temporarily for the reextract-osint-actors.ts script.
 * Remove entirely once reextract script is updated or no longer needed.
 */

// randomUUID removed — using deterministic relationship IDs
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import { geocodingService, type GeoLocation } from '../lib/geocoding-service.js';
import { performWebSearch } from '../doc-intelligence/web-search.js';
import type { OSINTEvent } from '../graph/osint/types.js';
import { normalizeActorName } from '../graph/resolution/name-normalizer.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface ExtractedActor {
  name: string;
  type: 'nation' | 'organization' | 'individual' | 'non_state_actor' | 'military_unit' | 'group';
  aliases?: string[];
  description?: string;
}

interface ExtractedRelationship {
  source: string;  // actor name
  target: string;  // actor name
  type: 'allied_with' | 'adversarial' | 'competing' | 'cooperating' | 'neutral' | 'supports' | 'opposes' | 'threatens';
  strength: number; // 0-1
  description: string;
}

interface ExtractedTension {
  actors: string[];  // 2+ actor names involved
  description: string;
  intensity: number;  // 0-1
  domain: 'military' | 'diplomatic' | 'economic' | 'informational' | 'cyber' | 'territorial' | 'other';
}

interface ExtractionResult {
  actors: ExtractedActor[];
  relationships: ExtractedRelationship[];
  tensions: ExtractedTension[];
  locations: GeoLocation[];
}

// ── Actor Description Enrichment ──────────────────────────────────────────

/** Cache enriched descriptions to avoid repeated lookups for the same actor */
const enrichmentCache = new Map<string, string>();

/**
 * Enrich an actor's description using web search + LLM summarization.
 * Returns a 1-3 sentence description of who/what the actor is.
 */
async function enrichActorDescription(
  actorName: string,
  actorType: string,
  contextSnippet: string,
): Promise<string> {
  const cacheKey = actorName.toLowerCase().trim();
  if (enrichmentCache.has(cacheKey)) return enrichmentCache.get(cacheKey)!;

  try {
    // 1. Web search for context about this actor
    const searchQuery = actorType === 'nation'
      ? `${actorName} country geopolitical overview`
      : `${actorName} ${actorType} who what`;
    const searchResults = await performWebSearch(searchQuery, 3);
    const searchContext = searchResults
      .map(r => `${r.title}: ${r.snippet}`)
      .join('\n')
      .slice(0, 2000);

    // 2. LLM summarization into a concise description
    const { createLLMForAgent: createLLM } = await import('../agents/langgraph/llm-factory.js');
    const llm = await createLLM({
      agentId: 'actor-enrichment',
      overrides: { temperature: 0, maxTokens: 256 },
    });

    const result = await Promise.race([
      llm.invoke([
        { role: 'system', content: `You are a military intelligence analyst. Write a concise 1-3 sentence description of this entity for a knowledge graph node. Include what it is, its significance, and any known affiliations or capabilities. Be factual and specific. Return ONLY the description text, no quotes or labels.` },
        { role: 'user', content: `Entity: ${actorName}\nType: ${actorType}\nContext from OSINT report: ${contextSnippet.slice(0, 500)}\n\nWeb search results:\n${searchContext}` },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Enrichment timed out')), 15_000),
      ),
    ]);

    const description = (typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content)
    ).trim();

    if (description.length > 10) {
      enrichmentCache.set(cacheKey, description);
      return description;
    }
  } catch (err) {
    console.warn(`[OSINT-Enrich] Failed to enrich "${actorName}":`, err instanceof Error ? err.message : err);
  }

  // Fallback: use whatever context we have
  const fallback = `${actorType === 'nation' ? 'Nation' : actorType.charAt(0).toUpperCase() + actorType.slice(1)} referenced in OSINT reporting.`;
  enrichmentCache.set(cacheKey, fallback);
  return fallback;
}

// ── LLM Extraction ─────────────────────────────────────────────────────────

const AGENT_ID = 'osint-entity-extractor';

const SYSTEM_PROMPT = `You are a military intelligence analyst building a knowledge graph of geopolitically significant actors for a C2 planning platform. Extract ONLY entities relevant to strategic, operational, or tactical analysis.

For each report, extract:

1. **actors** — ONLY uniquely identifiable, geopolitically significant entities that a military planner or intelligence analyst would track. Every actor must be identifiable enough that it could appear in another report and be recognized as the same entity.

   INCLUDE:
   - Nation-states and governments (e.g., "China", "United States", "Russia")
   - Military units and commands (e.g., "7th Fleet", "PLA Eastern Theater Command")
   - Named political leaders and commanders (e.g., "Xi Jinping", "President Marcos")
   - International organizations (e.g., "NATO", "ASEAN", "United Nations")
   - Significant corporations in defense/strategic sectors (e.g., "Lockheed Martin", "TSMC")
   - Non-state armed groups and terrorist organizations (e.g., "Houthis", "Wagner Group")
   - Intelligence agencies and law enforcement bodies (e.g., "CIA", "FSB", "Interpol")

   RESOLVE ROLE REFERENCES — when the article mentions a title/role without a name, use the article's context (country, city, date, topic) and your knowledge to resolve it to the actual person:
   - "the Housing Minister" in an article about India → extract as "Manohar Lal Khattar" (India's Housing Minister) with alias "India Housing Minister"
   - "the Defense Secretary" in an article about the Philippines → extract as "Gilberto Teodoro" with alias "Philippine Defense Secretary"
   - "the commander" in an article about CENTCOM operations → extract as the named CENTCOM commander
   - If you cannot confidently resolve the role to a specific person, include it as "[Country]'s [Role]" (e.g., "Turkey's Defense Minister") so it can be cross-referenced and resolved later
   - Partial names: "General Kim" is worth including if context makes them identifiable; "a general" is not

   DO NOT INCLUDE:
   - Truly unidentifiable entities — generic descriptions that could never be linked across reports
   - Journalists, reporters, or article authors
   - News agencies or media outlets (Reuters, AP, BBC) — these are sources, not actors
   - Unnamed/generic people ("10-year-old boy", "12 suspects", "victims", "witnesses", "officials")
   - Age-described individuals ("14-year-old girl", "elderly woman")
   - Numbered groups of anonymous people ("15 women professionals", "101 persons")
   - Courts, judges, or prosecutors handling routine cases
   - Athletes, celebrities, or entertainment figures (unless geopolitically significant)
   - Email addresses or social media handles
   - Production credits or bylines
   - Local businesses, restaurants, or venues with no strategic relevance

   Each actor has: name (proper noun, canonical form — must be specific enough to deduplicate across reports), type (nation|organization|individual|non_state_actor|military_unit|group), aliases (optional), description (optional brief).

2. **relationships** — connections between extracted actors.
   Each relationship has: source (actor name), target (actor name), type (allied_with|adversarial|competing|cooperating|neutral|supports|opposes|threatens), strength (0.0-1.0), description (one sentence).

3. **tensions** — conflict points, disputes, or friction between actors.
   Each tension has: actors (2+ names), description (one sentence), intensity (0.0-1.0 where 1.0 = active conflict), domain (military|diplomatic|economic|informational|cyber|territorial|other).

4. **locations** — geographic locations mentioned with coordinates.
   Each location has: name (string), latitude (number), longitude (number), region (optional), country (optional).
   Use your knowledge to provide accurate lat/lng for every location worldwide.

Rules:
- Quality over quantity — 3 high-confidence actors are better than 15 low-quality ones
- Use canonical names (e.g., "China" not "PRC", "United States" not "US")
- Individuals MUST be named (first + last name or title + name). No unnamed/anonymous actors.
- RESOLVE before extracting: use the article's geographic context, date, and your world knowledge to resolve role references to real named people. Put the role as an alias.
- If the article is about a local crime, traffic accident, sports event, or celebrity news with no geopolitical dimension, return empty arrays
- Strength/intensity should reflect the text's tone (threats=high, cooperation=low tension)
- For locations, ALWAYS include latitude and longitude
- Return valid JSON only, no explanation text

Respond with ONLY a JSON object matching this schema:
{
  "actors": [...],
  "relationships": [...],
  "tensions": [...],
  "locations": [{"name": "...", "latitude": 0.0, "longitude": 0.0, "region": "...", "country": "..."}]
}`;

/**
 * Extract entities, relationships, and tensions from an OSINT event using LLM.
 */
export async function extractEntitiesFromEvent(event: OSINTEvent): Promise<ExtractionResult> {
  const empty: ExtractionResult = { actors: [], relationships: [], tensions: [], locations: [] };

  // Skip events with very short content
  const text = `${event.title}\n${event.description ?? ''}`.trim();
  if (text.length < 50) return empty;

  try {
    const llm = await createLLMForAgent({
      agentId: AGENT_ID,
      overrides: { temperature: 0.1, maxTokens: 2048 },
    });

    const result = await Promise.race([
      llm.invoke([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Extract entities, relationships, and tensions from this OSINT report:\n\nTitle: ${event.title}\nSource: ${event.sourceName ?? 'unknown'}\nDate: ${event.publishedAt?.toISOString() ?? 'unknown'}\nTags: ${(event.tags ?? []).join(', ')}\n\nContent:\n${event.description ?? ''}` },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM extraction timed out')), 45_000),
      ),
    ]);

    const content = typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content);

    // Parse JSON with resilience
    const parsed = parseJsonResponse(content);
    if (!parsed || typeof parsed !== 'object') return empty;

    const obj = parsed as Record<string, unknown>;

    // Parse locations — handle both string[] and structured object[] formats
    const locations: GeoLocation[] = [];
    if (Array.isArray(obj.locations)) {
      for (const loc of obj.locations as unknown[]) {
        if (typeof loc === 'string') {
          // Plain name — geocode via shared service
          const geocoded = await geocodingService.geocode(loc);
          if (geocoded) locations.push(geocoded);
        } else if (loc && typeof loc === 'object') {
          const l = loc as Record<string, unknown>;
          const name = (l.name as string)?.trim();
          if (!name) continue;
          const lat = Number(l.latitude) || 0;
          const lng = Number(l.longitude) || 0;
          if (lat !== 0 && lng !== 0) {
            locations.push({ name, latitude: lat, longitude: lng, region: l.region as string, country: l.country as string });
          } else {
            // LLM returned 0,0 — try Nominatim
            const geocoded = await geocodingService.geocode(name);
            if (geocoded) locations.push(geocoded);
          }
        }
      }
    }

    // Post-extraction quality filter — catch junk the LLM still lets through
    const rawActors = Array.isArray(obj.actors) ? obj.actors as ExtractedActor[] : [];
    const filteredActors = rawActors.filter(a => {
      const name = (a.name ?? '').trim();
      if (name.length < 2) return false;
      // Reject age-described unnamed people
      if (/\d+-(?:year|month|week|day)-old/i.test(name)) return false;
      // Reject numeric-prefixed generic groups ("12 suspects", "101 persons")
      if (/^\d+\s+(?:suspect|victim|person|detainee|arrest|people|woman|man|child|student|boy|girl|officer)/i.test(name)) return false;
      // Reject email addresses
      if (name.includes('@')) return false;
      // Reject production credits
      if (/^(?:presented|produced|edited|written|reported) by/i.test(name)) return false;
      // Reject single generic words
      if (/^(?:Unnamed|Unknown|Anonymous|Unidentified|Suspect|Victim|Witness)$/i.test(name)) return false;
      return true;
    });

    // Filter relationships and tensions to only reference surviving actors
    const actorNames = new Set(filteredActors.map(a => a.name));
    const filteredRels = (Array.isArray(obj.relationships) ? obj.relationships as ExtractedRelationship[] : [])
      .filter(r => actorNames.has(r.source) && actorNames.has(r.target));
    const filteredTensions = (Array.isArray(obj.tensions) ? obj.tensions as ExtractedTension[] : [])
      .filter(t => t.actors.every(a => actorNames.has(a)));

    return {
      actors: filteredActors,
      relationships: filteredRels,
      tensions: filteredTensions,
      locations,
    };
  } catch (err) {
    console.warn(`[OSINT-Extract] LLM extraction failed for "${event.title}":`, err instanceof Error ? err.message : err);
    return empty;
  }
}

// ── Graph Sync ─────────────────────────────────────────────────────────────

/**
 * Full pipeline: extract entities from OSINT event, then sync to Neo4j graph.
 * Creates actor nodes, relationship edges, and tension edges.
 *
 * @deprecated Phase 63: Use processOSINTEventThroughAgents from osint-agent-bridge.ts instead.
 */
export async function extractAndSyncToGraph(event: OSINTEvent): Promise<{
  actorsCreated: number;
  relationshipsCreated: number;
  tensionsCreated: number;
}> {
  const stats = { actorsCreated: 0, relationshipsCreated: 0, tensionsCreated: 0 };

  const extraction = await extractEntitiesFromEvent(event);
  if (extraction.actors.length === 0) return stats;

  // Backfill event location in PostgreSQL if we extracted one and it was missing
  const primaryLocation = extraction.locations.find(l => l.latitude !== 0 && l.longitude !== 0);
  if (primaryLocation && !event.location) {
    try {
      const { getPool } = await import('../lib/database.js');
      await getPool().query(
        `UPDATE osint_events SET location = $1 WHERE id = $2`,
        [JSON.stringify(primaryLocation), event.id],
      );

      // Update event in-memory so COP refresh picks up the new location
      event.location = primaryLocation;

      // Trigger COP layer refresh now that we have a location
      if (event.workspaceId) {
        const { updateOSINTCOPLayer } = await import('./osint-cop-pipeline.js');
        updateOSINTCOPLayer(event.workspaceId, [event]).catch(err =>
          console.warn(`[OSINT-Extract] COP refresh after location backfill failed:`, err),
        );
      }
    } catch (err) {
      console.warn(`[OSINT-Extract] Failed to update event location:`, err);
    }
  }

  try {
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');
    const now = new Date().toISOString();

    // Map actor names to stable IDs
    const actorIdMap = new Map<string, string>();

    // 1. Create/merge actor nodes — MERGE on name to prevent duplicates
    for (const actor of extraction.actors) {
      // Strip whitespace variants and normalize to canonical name
      const trimmedName = normalizeActorName(
        (actor.name ?? '').replace(/[\r\n\t]+/g, ' ').trim().replace(/\s{2,}/g, ' ')
      );
      if (!trimmedName || trimmedName.length < 2) continue;

      const stableId = `ACT-${trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
      actorIdMap.set(actor.name, stableId);

      // Determine actor type mapping
      const typeMap: Record<string, string> = {
        nation: 'state',
        organization: 'organization',
        individual: 'individual',
        non_state_actor: 'non_state',
        military_unit: 'military',
        group: 'organization',
      };
      const graphType = typeMap[actor.type] ?? 'organization';

      // Enrich description if LLM extraction gave us nothing useful
      let description = actor.description ?? '';
      if (description.length < 20) {
        const contextSnippet = `${event.title}\n${(event.description ?? '').slice(0, 300)}`;
        description = await enrichActorDescription(trimmedName, actor.type, contextSnippet);
      }

      await executeWriteQuery(`
        MERGE (a:Actor {name: $name})
        ON CREATE SET
          a.id = $id,
          a.type = $type,
          a.aliases = $aliases,
          a.attributes = $attributes,
          a.workspaceId = $workspaceId,
          a.sourceDocumentIds = [$docId],
          a.containerIds = CASE WHEN $workspaceId IS NOT NULL THEN [$workspaceId] ELSE [] END,
          a.assertedVia = 'osint',
          a.confidence = 0.65,
          a.halfLifeDays = 90,
          a.createdAt = $now,
          a.updatedAt = $now
        ON MATCH SET
          a.updatedAt = $now,
          a.validFrom = $now,
          a.validTo = null,
          a.attributes = CASE
            WHEN size($description) > size(
              COALESCE((a.attributes), '{}')
            ) THEN $attributes
            ELSE a.attributes
          END,
          a.sourceDocumentIds = CASE
            WHEN NOT $docId IN a.sourceDocumentIds
            THEN a.sourceDocumentIds + $docId
            ELSE a.sourceDocumentIds
          END,
          a.containerIds = CASE
            WHEN $workspaceId IS NOT NULL AND NOT $workspaceId IN a.containerIds
            THEN a.containerIds + $workspaceId
            ELSE a.containerIds
          END
      `, {
        id: stableId,
        name: trimmedName,
        type: graphType,
        aliases: actor.aliases ?? [],
        description,
        attributes: JSON.stringify({
          source: 'osint',
          description,
          extractedFrom: event.id,
        }),
        workspaceId: event.workspaceId ?? null,
        docId: event.id,
        now,
      });

      stats.actorsCreated++;
    }

    // Event nodes are NOT created in the graph — they live in PostgreSQL.
    // Only actor nodes + inter-actor relationships go into Neo4j.

    // 2. Create relationship edges between actors
    for (const rel of extraction.relationships) {
      const sourceId = actorIdMap.get(rel.source);
      const targetId = actorIdMap.get(rel.target);
      if (!sourceId || !targetId) continue;

      await executeWriteQuery(`
        MATCH (s:Actor {id: $sourceId})
        MATCH (t:Actor {id: $targetId})
        MERGE (s)-[r:RELATES_TO {type: $relType}]->(t)
        ON CREATE SET
          r.id = $relId,
          r.type = $relType,
          r.strength = $strength,
          r.description = $desc,
          r.evidence = $evidence,
          r.sourceDocumentIds = [$docId],
          r.createdAt = $now,
          r.updatedAt = $now
        ON MATCH SET
          r.strength = CASE WHEN $strength > r.strength THEN $strength ELSE r.strength END,
          r.updatedAt = $now,
          r.validFrom = $now,
          r.validTo = null,
          r.sourceDocumentIds = CASE
            WHEN NOT $docId IN r.sourceDocumentIds
            THEN r.sourceDocumentIds + $docId
            ELSE r.sourceDocumentIds
          END
      `, {
        sourceId,
        targetId,
        relType: rel.type,
        relId: `REL-${sourceId}-${targetId}-${rel.type}`,
        strength: Math.max(0, Math.min(1, rel.strength)),
        desc: rel.description,
        evidence: event.sourceUrl ?? '',
        docId: event.id,
        now,
      });

      stats.relationshipsCreated++;
    }

    // 5. Create tension edges (special relationship type)
    for (const tension of extraction.tensions) {
      if (tension.actors.length < 2) continue;

      // Create pairwise tension edges for all actors involved
      for (let i = 0; i < tension.actors.length - 1; i++) {
        for (let j = i + 1; j < tension.actors.length; j++) {
          const aId = actorIdMap.get(tension.actors[i]);
          const bId = actorIdMap.get(tension.actors[j]);
          if (!aId || !bId) continue;

          await executeWriteQuery(`
            MATCH (a:Actor {id: $aId})
            MATCH (b:Actor {id: $bId})
            MERGE (a)-[r:RELATES_TO {type: 'tension'}]->(b)
            ON CREATE SET
              r.id = $relId,
              r.type = 'tension',
              r.strength = $intensity,
              r.description = $desc,
              r.evidence = $evidence,
              r.sourceDocumentIds = [$docId],
              r.domain = $domain,
              r.createdAt = $now,
              r.updatedAt = $now
            ON MATCH SET
              r.strength = CASE WHEN $intensity > r.strength THEN $intensity ELSE r.strength END,
              r.description = $desc,
              r.domain = $domain,
              r.updatedAt = $now,
              r.validFrom = $now,
              r.validTo = null,
              r.sourceDocumentIds = CASE
                WHEN NOT $docId IN r.sourceDocumentIds
                THEN r.sourceDocumentIds + $docId
                ELSE r.sourceDocumentIds
              END
          `, {
            aId,
            bId,
            relId: `REL-tension-${aId}-${bId}`,
            intensity: Math.max(0, Math.min(1, tension.intensity)),
            desc: tension.description,
            evidence: event.sourceUrl ?? '',
            docId: event.id,
            domain: tension.domain,
            now,
          });

          stats.tensionsCreated++;
        }
      }
    }

    console.log(
      `[OSINT-Extract] "${event.title}" → ${stats.actorsCreated} actors, ` +
      `${stats.relationshipsCreated} relationships, ${stats.tensionsCreated} tensions`,
    );
  } catch (err) {
    console.warn(`[OSINT-Extract] Graph sync failed for "${event.title}":`, err);
  }

  return stats;
}

// ── JSON Parsing Helper ────────────────────────────────────────────────────

function parseJsonResponse(content: string): unknown {
  // Strip thinking tags (Qwen3, DeepSeek)
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Try direct parse
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Try markdown code block
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch { /* continue */ }
  }

  // Try finding JSON object
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]); } catch { /* continue */ }
  }

  return null;
}
