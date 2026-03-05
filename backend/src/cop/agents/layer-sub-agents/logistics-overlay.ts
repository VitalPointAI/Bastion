/**
 * Logistics Overlay Sub-Agent (J4)
 *
 * Extracts supply routes (MSRs, ASRs), lines of communication,
 * and logistics nodes/facilities from operational documents.
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
import { createEmptyLayerSpec } from './sub-agent-types.js';

const AGENT_ID = 'cop-logistics-001';
const TIMEOUT_MS = 30_000;

/**
 * Extracted logistics entity from documents.
 */
interface ExtractedLogisticsEntity {
  entityId: string;
  name: string;
  type: 'facility' | 'route';
  facilityType?: string;
  routeType?: 'msr' | 'asr' | 'loc';
  position?: { lat: number; lng: number };
  points?: Array<{ lat: number; lng: number }>;
  sourceDocumentId: string;
}

const SYSTEM_PROMPT = `You are a logistics analyst extracting supply routes and logistics facilities from operational documents.

Extract all logistics entities with:
- entityId: unique identifier slug (e.g. "msr-tampa", "fsp-alpha", "asr-michigan")
- name: designation (e.g. "MSR TAMPA", "FSP ALPHA", "ASR MICHIGAN")
- type: "facility" for logistics nodes or "route" for supply routes
- facilityType: if type is "facility", one of: "logistics", "medical", "headquarters" (for supply/fuel/ammo points, medical facilities, support HQ)
- routeType: if type is "route", one of: "msr" (main supply route), "asr" (alternate supply route), "loc" (line of communication)
- position: { lat, lng } for facilities
- points: array of { lat, lng } waypoints for routes
- sourceDocumentId: the document ID this was extracted from

Respond ONLY with a JSON array of extracted entities. No explanation text.`;

/**
 * Logistics Overlay sub-agent.
 *
 * Extracts supply routes, MSRs, ASRs, logistics nodes and facilities.
 * Produces both symbols (facilities) and control measures (routes).
 */
export async function logisticsOverlayAgent(
  input: SubAgentInput,
): Promise<COPLayerSpec> {
  copEventBus.emit('agent:activity', {
    agentId: AGENT_ID,
    action: 'extraction:start',
    detail: `Extracting logistics overlay from ${input.documents.length} documents`,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    timestamp: new Date().toISOString(),
  });

  try {
    const relevantDocs = input.documents.filter(
      d => ['opord', 'frago', 'annex_f', 'annex_i', 'logistics', 'general'].includes(d.type),
    );

    if (relevantDocs.length === 0 && input.graphEntities.length === 0) {
      return createEmptyLayerSpec(input, 'logistics', AGENT_ID, 'No relevant documents or entities found');
    }

    const extracted = await extractLogisticsFromDocuments(relevantDocs);

    // Include graph entities for logistics
    const graphEntities = input.graphEntities
      .filter(e => ['logistics_node', 'supply_route', 'facility'].includes(e.type))
      .map(e => ({
        entityId: e.id,
        name: e.name,
        type: (e.properties.entityType === 'route' ? 'route' : 'facility') as 'facility' | 'route',
        facilityType: (e.properties.facilityType as string) || 'logistics',
        routeType: (e.properties.routeType as 'msr' | 'asr' | 'loc') || undefined,
        position: e.properties.lat
          ? { lat: e.properties.lat as number, lng: e.properties.lng as number }
          : undefined,
        points: (e.properties.points as Array<{ lat: number; lng: number }>) || undefined,
        sourceDocumentId: 'raft-graph',
      }));

    const allEntities = [...extracted, ...graphEntities];

    // Separate facilities (symbols) from routes (control measures)
    const facilities = allEntities.filter(e => e.type === 'facility');
    const routes = allEntities.filter(e => e.type === 'route');

    const symbols: COPSymbolSpec[] = facilities.map(fac => {
      const sidc = buildSIDCFromEntity({
        type: fac.facilityType || 'logistics',
        affiliation: 'friendly',
        status: 'present',
      });

      const ccoClass = suggestCCOClass(fac.facilityType || 'logistics', {
        name: fac.name,
      });

      return {
        entityId: fac.entityId,
        sidc,
        position: fac.position || { lat: 0, lng: 0 },
        designation: fac.name,
        affiliation: 'friendly' as const,
        linkedEntities: [],
        ccoClass,
        confidence: fac.sourceDocumentId === 'raft-graph' ? 0.9 : 0.8,
        sourceAuthority: fac.sourceDocumentId === 'raft-graph' ? 'RAFT' : 'DOCEX',
      };
    });

    const ROUTE_STYLES: Record<string, Record<string, string>> = {
      msr: { color: '#8B0000', weight: '3' },
      asr: { color: '#B8860B', weight: '2', dashArray: '10,5' },
      loc: { color: '#556B2F', weight: '2', dashArray: '5,5' },
    };

    const controlMeasures: COPControlMeasureSpec[] = routes.map(route => ({
      id: `cm-${route.entityId}`,
      type: 'route' as const,
      points: route.points || [],
      label: route.name,
      style: ROUTE_STYLES[route.routeType || 'msr'] || ROUTE_STYLES.msr,
    }));

    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:complete',
      detail: `Extracted ${symbols.length} facilities, ${controlMeasures.length} routes`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return {
      layerId: `logistics-${input.sectionId}-${Date.now()}`,
      layerType: 'logistics',
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
      detail: `Logistics overlay extraction failed: ${message}`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return createEmptyLayerSpec(input, 'logistics', AGENT_ID, message);
  }
}

async function extractLogisticsFromDocuments(
  documents: SubAgentInput['documents'],
): Promise<ExtractedLogisticsEntity[]> {
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

    const parsed = JSON.parse(cleaned) as ExtractedLogisticsEntity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
