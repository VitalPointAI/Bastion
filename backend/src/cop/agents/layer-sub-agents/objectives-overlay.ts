/**
 * Objectives Overlay Sub-Agent (J35)
 *
 * Extracts named objectives, areas of interest (NAIs, TAIs, DAs),
 * and objective markers from planning documents. Produces objective
 * symbols and control measure areas.
 *
 * SIDC codes are ALWAYS generated via buildSIDCFromEntity -- never by LLM.
 */

import { createLLMForAgent } from '../../../agents/langgraph/llm-factory.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { buildSIDCFromEntity } from '../../svg/sidc-builder.js';
import { suggestCCOClass } from '../../cco/cco-validator.js';
import { copEventBus } from '../../messaging/event-bus.js';
import type {
  COPLayerSpec,
  COPSymbolSpec,
  COPControlMeasureSpec,
} from '../../layers/layer-types.js';
import type { SubAgentInput } from './sub-agent-types.js';
import { createEmptyLayerSpec, matchesEntityType } from './sub-agent-types.js';

const AGENT_ID = 'cop-objectives-001';
const TIMEOUT_MS = 30_000;

/**
 * Extracted objective from documents.
 */
interface ExtractedObjective {
  entityId: string;
  name: string;
  type: 'objective' | 'nai' | 'tai' | 'da' | 'area_of_interest';
  position: { lat: number; lng: number };
  area?: Array<{ lat: number; lng: number }>;
  description: string;
  sourceDocumentId: string;
}

const SYSTEM_PROMPT = `You are a military planning analyst extracting objectives and areas of interest from operational documents.

Extract all objectives and areas of interest with their:
- entityId: a unique identifier slug (e.g. "obj-alpha", "nai-1", "tai-2")
- name: designation (e.g. "OBJ ALPHA", "NAI 1", "TAI 2", "DA 1")
- type: one of "objective", "nai", "tai", "da", "area_of_interest"
- position: { lat, lng } center point
- area: array of { lat, lng } polygon vertices if area is defined, omit otherwise
- description: brief description of the objective/area purpose
- sourceDocumentId: the document ID this was extracted from

Respond ONLY with a JSON array of extracted objectives. No explanation text.`;

/**
 * Objectives Overlay sub-agent.
 *
 * Extracts objectives, NAIs, TAIs, and decision areas from planning documents.
 * Produces both symbol markers and control measure areas as polygons.
 */
export async function objectivesOverlayAgent(
  input: SubAgentInput,
): Promise<COPLayerSpec> {
  copEventBus.emit('agent:activity', {
    agentId: AGENT_ID,
    action: 'extraction:start',
    detail: `Extracting objectives from ${input.documents.length} documents`,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    timestamp: new Date().toISOString(),
  });

  try {
    const relevantDocs = input.documents.filter(
      d => ['opord', 'frago', 'annex_c', 'annex_d', 'general'].includes(d.type),
    );

    if (relevantDocs.length === 0 && input.graphEntities.length === 0) {
      return createEmptyLayerSpec(input, 'objectives', AGENT_ID, 'No relevant documents or entities found');
    }

    const extractedObjectives = await extractObjectivesFromDocuments(relevantDocs);

    // Also include graph entities that represent objectives/areas
    const graphObjectives = input.graphEntities
      .filter(e => matchesEntityType(e, ['objective', 'nai', 'tai', 'area_of_interest', 'geospatialregion']))
      .map(e => ({
        entityId: e.id,
        name: e.name,
        type: (
          (e.properties['type'] as string) ||
          (e.jsonldType.includes('nai') ? 'nai' :
            e.jsonldType.includes('tai') ? 'tai' :
            e.jsonldType.includes('objective') ? 'objective' : 'area_of_interest')
        ) as ExtractedObjective['type'],
        position: {
          lat: (e.properties.lat as number) || 0,
          lng: (e.properties.lng as number) || 0,
        },
        area: e.properties.area as Array<{ lat: number; lng: number }> | undefined,
        description: (e.properties.description as string) || '',
        sourceDocumentId: 'raft-graph',
      }));

    const allObjectives = [...extractedObjectives, ...graphObjectives];

    // Generate symbols for objectives
    const symbols: COPSymbolSpec[] = allObjectives.map(obj => {
      const sidc = buildSIDCFromEntity({
        type: 'headquarters', // Objectives use activity symbol set
        affiliation: 'friendly',
        status: 'planned',
      });

      const ccoClass = suggestCCOClass(obj.type, {
        name: obj.name,
        description: obj.description,
      });

      return {
        entityId: obj.entityId,
        sidc,
        position: obj.position,
        designation: obj.name,
        affiliation: 'friendly' as const,
        linkedEntities: [],
        ccoClass,
        confidence: obj.sourceDocumentId === 'raft-graph' ? 0.9 : 0.8,
        sourceAuthority: obj.sourceDocumentId === 'raft-graph' ? 'RAFT' : 'DOCEX',
      };
    });

    // Generate control measures for objectives with areas
    const controlMeasures: COPControlMeasureSpec[] = allObjectives
      .filter(obj => obj.area && obj.area.length >= 3)
      .map(obj => ({
        id: `cm-${obj.entityId}`,
        type: 'objective_area' as const,
        points: obj.area!,
        label: obj.name,
        style: {
          color: obj.type === 'tai' ? '#ff6600' : obj.type === 'nai' ? '#0066ff' : '#00cc00',
          weight: '2',
          fillOpacity: '0.15',
        },
      }));

    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:complete',
      detail: `Extracted ${symbols.length} objectives, ${controlMeasures.length} areas`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return {
      layerId: `objectives-${input.sectionId}-${Date.now()}`,
      layerType: 'objectives',
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      symbols,
      controlMeasures,
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
      detail: `Objectives extraction failed: ${message}`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return createEmptyLayerSpec(input, 'objectives', AGENT_ID, message);
  }
}

async function extractObjectivesFromDocuments(
  documents: SubAgentInput['documents'],
): Promise<ExtractedObjective[]> {
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

    const parsed = JSON.parse(cleaned) as ExtractedObjective[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
