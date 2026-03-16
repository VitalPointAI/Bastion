/**
 * Intel Overlay Sub-Agent (J2)
 *
 * Extracts enemy positions, threat assessments, and enemy COAs from
 * intelligence documents. Symbols are primarily hostile/unknown affiliation.
 *
 * SIDC codes are ALWAYS generated via buildSIDCFromEntity -- never by LLM.
 */

import { createLLMForAgent } from '../../../agents/langgraph/llm-factory.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { buildSIDCFromEntity } from '../../svg/sidc-builder.js';
import { suggestCCOClass } from '../../cco/cco-validator.js';
import { copEventBus } from '../../messaging/event-bus.js';
import type { COPLayerSpec, COPSymbolSpec } from '../../layers/layer-types.js';
import type { SubAgentInput } from './sub-agent-types.js';
import { createEmptyLayerSpec, getEntityAffiliation } from './sub-agent-types.js';
import { getConfidenceTier } from '../../../graph/provenance-types.js';

const AGENT_ID = 'cop-intel-001';
const TIMEOUT_MS = 30_000;

/**
 * Extracted threat entity from intelligence documents.
 */
interface ExtractedThreat {
  entityId: string;
  designation: string;
  type: string;
  echelon: string;
  affiliation: string;
  position: { lat: number; lng: number };
  sourceAuthority: string;
  sourceDocumentId: string;
}

const SYSTEM_PROMPT = `You are an intelligence analyst extracting enemy positions and threat assessments from intelligence documents.

Extract all adversary/threat entities with their:
- entityId: unique identifier slug (e.g. "en-82-mrd", "threat-sa-battery-1")
- designation: full designation (e.g. "82nd Motor Rifle Division", "SA-11 Battery Alpha")
- type: unit type from this list ONLY: infantry, armor, artillery, air_defense, engineer, signal, logistics, medical, military_intel, reconnaissance, aviation, special_operations, chemical, military_police, civil_affairs, electronic_warfare, fire_support, air_assault, airborne, headquarters
- echelon: from this list ONLY: team, squad, section, platoon, company, battalion, regiment, brigade, division, corps, army, unspecified
- affiliation: "hostile" for confirmed enemy, "suspect" for suspected, "unknown" if unclear
- position: { lat, lng } coordinates if known, otherwise estimate or use { lat: 0, lng: 0 }
- sourceAuthority: intelligence source type: "SIGINT", "HUMINT", "IMINT", or "OSINT"
- sourceDocumentId: the document ID this was extracted from

Respond ONLY with a JSON array of extracted threats. No explanation text.`;

/**
 * Intel Overlay sub-agent.
 *
 * Extracts enemy positions, threat assessments, and enemy COAs from
 * intelligence documents. Produces hostile/unknown symbols.
 */
export async function intelOverlayAgent(
  input: SubAgentInput,
): Promise<COPLayerSpec> {
  copEventBus.emit('agent:activity', {
    agentId: AGENT_ID,
    action: 'extraction:start',
    detail: `Extracting intel overlay from ${input.documents.length} documents`,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    timestamp: new Date().toISOString(),
  });

  try {
    const relevantDocs = input.documents.filter(
      d => ['intsum', 'ipb', 'annex_b', 'threat_assessment', 'sigint', 'osint', 'general'].includes(d.type),
    );

    if (relevantDocs.length === 0 && input.graphEntities.length === 0) {
      return createEmptyLayerSpec(input, 'intel', AGENT_ID, 'No relevant documents or entities found');
    }

    const extractedThreats = await extractThreatsFromDocuments(relevantDocs);

    // Include graph entities representing hostile/unknown forces
    // Filter by semantic jsonldType (CCO/JC3IEDM ontology classes) and affiliation
    // Normalize by lowercasing and stripping colons/underscores for comparison
    const HOSTILE_JSONLD_TYPES = ['cco:militaryorganization', 'jc3:unit', 'jc3:facility', 'cco:organization'];
    const normalizeType = (s: string) => s.toLowerCase().replace(/[:\s_]/g, '');
    const graphThreats = input.graphEntities
      .filter(e =>
        HOSTILE_JSONLD_TYPES.some(t => normalizeType(e.jsonldType).includes(normalizeType(t))) &&
        ['hostile', 'enemy', 'suspect', 'unknown'].includes(getEntityAffiliation(e)),
      )
      .map(e => ({
        entityId: e.id,
        designation: e.name,
        type: (e.properties.attributes_unitType as string) || (e.properties.unitType as string) || 'infantry',
        echelon: (e.properties.attributes_echelon as string) || (e.properties.echelon as string) || 'unspecified',
        affiliation: (e.properties.attributes_affiliation as string) || (e.properties.affiliation as string) || 'hostile',
        position: {
          lat: (e.properties.lat as number) || 0,
          lng: (e.properties.lng as number) || 0,
        },
        sourceAuthority: (e.properties.attributes_sourceAuthority as string) || (e.properties.sourceAuthority as string) || 'OSINT',
        sourceDocumentId: 'raft-graph',
        confidence: e.confidence,
        assertedVia: e.provenance.assertedVia,
      }));

    const allThreats = [...extractedThreats, ...graphThreats];

    const symbols: COPSymbolSpec[] = allThreats.map(threat => {
      const sidc = buildSIDCFromEntity({
        type: threat.type,
        affiliation: threat.affiliation,
        echelon: threat.echelon,
        status: 'present',
      });

      const ccoClass = suggestCCOClass(threat.type, {
        designation: threat.designation,
        echelon: threat.echelon,
      });

      const threatWithMeta = threat as typeof threat & { confidence?: number; assertedVia?: string };
      const confidence: number = threatWithMeta.confidence ?? (threat.sourceDocumentId === 'raft-graph' ? 0.9 : 0.7);
      const assertedVia: string | undefined = threatWithMeta.assertedVia;

      return {
        entityId: threat.entityId,
        sidc,
        position: threat.position,
        designation: threat.designation,
        affiliation: (threat.affiliation === 'suspect' ? 'unknown' : threat.affiliation) as COPSymbolSpec['affiliation'],
        linkedEntities: [],
        ccoClass,
        confidence,
        sourceAuthority: threat.sourceAuthority,
        confidenceTier: getConfidenceTier(confidence),
        assertedVia,
        provenanceSummary: assertedVia
          ? `Source: ${threat.sourceAuthority} via ${assertedVia} (confidence: ${Math.round(confidence * 100)}%)`
          : `Source: ${threat.sourceAuthority} (confidence: ${Math.round(confidence * 100)}%)`,
      };
    });

    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:complete',
      detail: `Extracted ${symbols.length} threat positions`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return {
      layerId: `intel-${input.sectionId}-${Date.now()}`,
      layerType: 'intel',
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      symbols,
      controlMeasures: [],
      customAnnotations: [],
      temporalPhases: [],
      metadata: {
        generatedBy: AGENT_ID,
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: input.documents.map(d => d.id),
        ccoValidated: true,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:error',
      detail: `Intel overlay extraction failed: ${message}`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return createEmptyLayerSpec(input, 'intel', AGENT_ID, message);
  }
}

async function extractThreatsFromDocuments(
  documents: SubAgentInput['documents'],
): Promise<ExtractedThreat[]> {
  if (documents.length === 0) return [];

  const llm = await createLLMForAgent({ agentId: AGENT_ID });

  const combinedContent = documents
    .map(d => `[Document: ${d.id} (${d.type})]\n${d.content}`)
    .join('\n\n---\n\n');

  const result = await Promise.race([
    llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(combinedContent),
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM extraction timed out')), TIMEOUT_MS),
    ),
  ]);

  try {
    const content = typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content);

    const cleaned = content
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    const parsed = JSON.parse(cleaned) as ExtractedThreat[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
