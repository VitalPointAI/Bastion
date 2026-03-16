/**
 * Force Disposition Sub-Agent (J3)
 *
 * Extracts unit positions, task organizations, and movement plans from
 * OPORDs/FRAGOs. Generates friendly force symbols with correct echelon
 * and branch SIDC codes.
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

const AGENT_ID = 'cop-force-disposition-001';
const TIMEOUT_MS = 30_000;

/**
 * Structured entity extracted by LLM from OPORD/FRAGO documents.
 */
interface ExtractedUnit {
  entityId: string;
  designation: string;
  type: string;
  echelon: string;
  affiliation: string;
  position: { lat: number; lng: number };
  movementPath?: Array<{ phase: number; position: { lat: number; lng: number } }>;
  sourceDocumentId: string;
}

/**
 * System prompt constraining the LLM to structured extraction only.
 */
const SYSTEM_PROMPT = `You are a military intelligence analyst extracting unit positions from operational documents.

Extract all military units mentioned in the document with their:
- entityId: a unique identifier (use unit designation slug, e.g. "1-bde-101-abn")
- designation: full unit designation (e.g. "1st Brigade Combat Team, 101st Airborne Division")
- type: unit type from this list ONLY: infantry, armor, artillery, air_defense, engineer, signal, logistics, medical, military_intel, reconnaissance, aviation, special_operations, chemical, military_police, civil_affairs, electronic_warfare, fire_support, air_assault, airborne, headquarters
- echelon: from this list ONLY: team, squad, section, platoon, company, battalion, regiment, brigade, division, corps, army, unspecified
- affiliation: "friendly" for own forces, "hostile" for enemy, "neutral" for neutral, "unknown" if unclear
- position: { lat, lng } coordinates if mentioned, otherwise estimate from context or use { lat: 0, lng: 0 }
- movementPath: array of { phase, position } if movement phases are described
- sourceDocumentId: the document ID this was extracted from

Respond ONLY with a JSON array of extracted units. No explanation text.`;

/**
 * Force Disposition sub-agent.
 *
 * Extracts unit positions and task organizations from operational documents,
 * generates MIL-STD-2525D SIDC codes deterministically, and validates CCO
 * classes for each entity.
 */
export async function forceDispositionAgent(
  input: SubAgentInput,
): Promise<COPLayerSpec> {
  copEventBus.emit('agent:activity', {
    agentId: AGENT_ID,
    action: 'extraction:start',
    detail: `Extracting force disposition from ${input.documents.length} documents`,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Filter relevant documents (OPORDs, FRAGOs, task org documents)
    const relevantDocs = input.documents.filter(
      d => ['opord', 'frago', 'task_org', 'annex_a', 'general'].includes(d.type),
    );

    if (relevantDocs.length === 0 && input.graphEntities.length === 0) {
      return createEmptyLayerSpec(input, 'force_disposition', AGENT_ID, 'No relevant documents or entities found');
    }

    // Extract entities from documents via LLM
    const extractedUnits = await extractUnitsFromDocuments(relevantDocs);

    // Also include graph entities that represent friendly military units
    // Filter by semantic jsonldType (CCO/JC3IEDM ontology classes) and friendly affiliation
    const FRIENDLY_JSONLD_TYPES = ['cco:MilitaryOrganization', 'jc3:Unit'];
    const graphUnits = input.graphEntities
      .filter(e =>
        FRIENDLY_JSONLD_TYPES.some(t => e.jsonldType.toLowerCase().includes(t.toLowerCase().replace(':', ''))) &&
        ['friendly', 'friend'].includes(getEntityAffiliation(e)),
      )
      .map(e => ({
        entityId: e.id,
        designation: e.name,
        type: (e.properties.attributes_unitType as string) || (e.properties.unitType as string) || 'infantry',
        echelon: (e.properties.attributes_echelon as string) || (e.properties.echelon as string) || 'unspecified',
        affiliation: (e.properties.attributes_affiliation as string) || (e.properties.affiliation as string) || 'friendly',
        position: {
          lat: (e.properties.lat as number) || 0,
          lng: (e.properties.lng as number) || 0,
        },
        movementPath: undefined as ExtractedUnit['movementPath'],
        sourceDocumentId: 'raft-graph',
        confidence: e.confidence,
        assertedVia: e.provenance.assertedVia,
      }));

    const allUnits = [...extractedUnits, ...graphUnits];

    // Generate symbols with deterministic SIDC codes
    const symbols: COPSymbolSpec[] = allUnits.map(unit => {
      const sidc = buildSIDCFromEntity({
        type: unit.type,
        affiliation: unit.affiliation,
        echelon: unit.echelon,
        status: 'present',
      });

      const ccoClass = suggestCCOClass(unit.type, {
        designation: unit.designation,
        echelon: unit.echelon,
      });

      const unitWithMeta = unit as typeof unit & { confidence?: number; assertedVia?: string };
      const confidence: number = unitWithMeta.confidence ?? (unit.sourceDocumentId === 'raft-graph' ? 0.9 : 0.8);
      const assertedVia: string | undefined = unitWithMeta.assertedVia;
      const sourceAuthority = unit.sourceDocumentId === 'raft-graph' ? 'RAFT' : 'DOCEX';

      return {
        entityId: unit.entityId,
        sidc,
        position: unit.position,
        designation: unit.designation,
        affiliation: unit.affiliation as COPSymbolSpec['affiliation'],
        movementPath: unit.movementPath,
        linkedEntities: [],
        ccoClass,
        confidence,
        sourceAuthority,
        confidenceTier: getConfidenceTier(confidence),
        assertedVia,
        provenanceSummary: assertedVia
          ? `Source: ${sourceAuthority} via ${assertedVia} (confidence: ${Math.round(confidence * 100)}%)`
          : `Source: ${sourceAuthority} (confidence: ${Math.round(confidence * 100)}%)`,
      };
    });

    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:complete',
      detail: `Extracted ${symbols.length} unit positions`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return {
      layerId: `force_disposition-${input.sectionId}-${Date.now()}`,
      layerType: 'force_disposition',
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
      detail: `Force disposition extraction failed: ${message}`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return createEmptyLayerSpec(input, 'force_disposition', AGENT_ID, message);
  }
}

/**
 * Extract military units from documents using LLM.
 * Has a 30-second timeout.
 */
async function extractUnitsFromDocuments(
  documents: SubAgentInput['documents'],
): Promise<ExtractedUnit[]> {
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

    // Strip potential code fences
    const cleaned = content
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    const parsed = JSON.parse(cleaned) as ExtractedUnit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
