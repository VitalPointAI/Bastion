/**
 * C2 (Command & Control) Overlay Sub-Agent
 *
 * Extracts command posts, headquarters, and command relationships
 * from operational documents. Produces HQ markers and command
 * relationship annotations.
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
  COPAnnotationSpec,
} from '../../layers/layer-types.js';
import type { SubAgentInput } from './sub-agent-types.js';
import { createEmptyLayerSpec } from './sub-agent-types.js';
import { getConfidenceTier } from '../../../graph/provenance-types.js';

const AGENT_ID = 'cop-c2-001';
const TIMEOUT_MS = 30_000;

/**
 * Extracted command post from documents.
 */
interface ExtractedCommandPost {
  entityId: string;
  designation: string;
  echelon: string;
  position: { lat: number; lng: number };
  commandRelationships: Array<{
    relatedEntityId: string;
    relationshipType: 'opcon' | 'tacon' | 'support' | 'attached';
  }>;
  sourceDocumentId: string;
}

const SYSTEM_PROMPT = `You are a command and control analyst extracting command posts and command relationships from operational documents.

Extract all command posts and headquarters with:
- entityId: unique identifier slug (e.g. "cp-1-bde", "hq-div-main")
- designation: full designation (e.g. "1st Brigade CP", "Division Main HQ")
- echelon: from this list ONLY: team, squad, section, platoon, company, battalion, regiment, brigade, division, corps, army, unspecified
- position: { lat, lng } coordinates
- commandRelationships: array of { relatedEntityId, relationshipType } where relationshipType is one of: "opcon", "tacon", "support", "attached"
- sourceDocumentId: the document ID this was extracted from

Respond ONLY with a JSON array of extracted command posts. No explanation text.`;

/**
 * C2 Overlay sub-agent.
 *
 * Extracts command posts, headquarters, and command relationships.
 * Produces HQ symbols and SVG annotation fragments for C2 relationships.
 */
export async function c2OverlayAgent(
  input: SubAgentInput,
): Promise<COPLayerSpec> {
  copEventBus.emit('agent:activity', {
    agentId: AGENT_ID,
    action: 'extraction:start',
    detail: `Extracting C2 overlay from ${input.documents.length} documents`,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    timestamp: new Date().toISOString(),
  });

  try {
    const relevantDocs = input.documents.filter(
      d => ['opord', 'frago', 'annex_a', 'annex_j', 'task_org', 'general'].includes(d.type),
    );

    if (relevantDocs.length === 0 && input.graphEntities.length === 0) {
      return createEmptyLayerSpec(input, 'c2', AGENT_ID, 'No relevant documents or entities found');
    }

    const extractedCPs = await extractCommandPostsFromDocuments(relevantDocs);

    // Include graph entities for HQs/CPs
    // Filter by jsonldType for command/headquarters entity types
    // Normalize by lowercasing and stripping colons/underscores for comparison
    const C2_JSONLD_TYPES = ['headquarters', 'commandpost', 'hq', 'militaryunit', 'cco:militaryorganization'];
    const normalizeType = (s: string) => s.toLowerCase().replace(/[:\s_]/g, '');
    const graphCPs = input.graphEntities
      .filter(e =>
        C2_JSONLD_TYPES.some(t => normalizeType(e.jsonldType).includes(normalizeType(t))),
      )
      .map(e => ({
        entityId: e.id,
        designation: e.name,
        echelon: (e.properties.attributes_echelon as string) || (e.properties.echelon as string) || 'unspecified',
        position: {
          lat: (e.properties.lat as number) || 0,
          lng: (e.properties.lng as number) || 0,
        },
        commandRelationships: (e.properties.attributes_commandRelationships as ExtractedCommandPost['commandRelationships']) || (e.properties.commandRelationships as ExtractedCommandPost['commandRelationships']) || [],
        sourceDocumentId: 'raft-graph',
        confidence: e.confidence,
        assertedVia: e.provenance.assertedVia,
      }));

    const allCPs = [...extractedCPs, ...graphCPs];

    // Generate HQ symbols with hqTfFd='hq'
    const symbols: COPSymbolSpec[] = allCPs.map(cp => {
      const sidc = buildSIDCFromEntity({
        type: 'headquarters',
        affiliation: 'friendly',
        echelon: cp.echelon,
        status: 'present',
      });

      const ccoClass = suggestCCOClass('headquarters', {
        designation: cp.designation,
        echelon: cp.echelon,
      });

      const cpWithMeta = cp as typeof cp & { confidence?: number; assertedVia?: string };
      const confidence: number = cpWithMeta.confidence ?? (cp.sourceDocumentId === 'raft-graph' ? 0.9 : 0.8);
      const assertedVia: string | undefined = cpWithMeta.assertedVia;
      const sourceAuthority = cp.sourceDocumentId === 'raft-graph' ? 'RAFT' : 'DOCEX';

      return {
        entityId: cp.entityId,
        sidc,
        position: cp.position,
        designation: cp.designation,
        affiliation: 'friendly' as const,
        linkedEntities: cp.commandRelationships.map(r => r.relatedEntityId),
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

    // Generate command relationship annotations as SVG fragments
    const customAnnotations: COPAnnotationSpec[] = [];
    for (const cp of allCPs) {
      for (const rel of cp.commandRelationships) {
        const relatedCP = allCPs.find(other => other.entityId === rel.relatedEntityId);
        if (!relatedCP) continue;

        const lineColor = rel.relationshipType === 'opcon' ? '#000000'
          : rel.relationshipType === 'tacon' ? '#0000ff'
          : rel.relationshipType === 'support' ? '#00aa00'
          : '#666666';

        const dashArray = rel.relationshipType === 'tacon' ? 'stroke-dasharray="8,4"'
          : rel.relationshipType === 'support' ? 'stroke-dasharray="4,4"'
          : '';

        const svgFragment = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <line x1="10" y1="50" x2="90" y2="50" stroke="${lineColor}" stroke-width="2" ${dashArray}/>
  <text x="50" y="45" text-anchor="middle" font-size="8" fill="${lineColor}">${rel.relationshipType.toUpperCase()}</text>
</svg>`;

        customAnnotations.push({
          id: `c2-rel-${cp.entityId}-${rel.relatedEntityId}`,
          svgFragment,
          position: {
            lat: (cp.position.lat + relatedCP.position.lat) / 2,
            lng: (cp.position.lng + relatedCP.position.lng) / 2,
          },
          bounds: {
            topLeft: {
              lat: Math.max(cp.position.lat, relatedCP.position.lat),
              lng: Math.min(cp.position.lng, relatedCP.position.lng),
            },
            bottomRight: {
              lat: Math.min(cp.position.lat, relatedCP.position.lat),
              lng: Math.max(cp.position.lng, relatedCP.position.lng),
            },
          },
          generatedBy: AGENT_ID,
          description: `${rel.relationshipType.toUpperCase()} relationship: ${cp.designation} -> ${relatedCP.designation}`,
        });
      }
    }

    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:complete',
      detail: `Extracted ${symbols.length} command posts, ${customAnnotations.length} relationships`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return {
      layerId: `c2-${input.sectionId}-${Date.now()}`,
      layerType: 'c2',
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      symbols,
      controlMeasures: [],
      customAnnotations,
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
      detail: `C2 overlay extraction failed: ${message}`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return createEmptyLayerSpec(input, 'c2', AGENT_ID, message);
  }
}

async function extractCommandPostsFromDocuments(
  documents: SubAgentInput['documents'],
): Promise<ExtractedCommandPost[]> {
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

    const parsed = JSON.parse(cleaned) as ExtractedCommandPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
