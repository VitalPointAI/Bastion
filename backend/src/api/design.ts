/**
 * Operational Design REST API
 *
 * Phase 25 Plan 01: Express routes for /api/design/*
 * CRUD operations for operational design data per problem set.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { designStore } from '../design/design-store.js';
import type { CoGAnalysis, LineOfEffort, OperationalApproach, OperationalDesign } from '../design/types.js';
import { getAgentRegistry } from '../agents/registry.js';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import { listDocuments } from '../strategic/ingestion/document-store.js';
import { ObjectiveStore } from '../strategic/objectives/store.js';
import { notifyCOPChange } from '../cop/index.js';

const router = Router();

const VALID_SECTIONS = ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'];

const objectiveStore = new ObjectiveStore();

/**
 * Fetch strategic context (documents + objectives) for a problem set.
 * Returns a text summary suitable for inclusion in agent prompts.
 */
async function getStrategicContext(problemSetId: string): Promise<string> {
  try {
    // Fetch documents for this problem set (workspaceId = problemSetId)
    const docs = await listDocuments('', 50, 0, problemSetId);
    if (docs.length === 0) return '';

    const parts: string[] = ['## Strategic Context from Uploaded Documents\n'];

    for (const doc of docs) {
      parts.push(`### ${doc.title} (${doc.level}, ${doc.classification})`);

      // Fetch objectives for this document
      try {
        const objectives = await objectiveStore.getObjectivesForDocument(doc.id);
        if (objectives.length > 0) {
          parts.push(`Extracted Objectives (${objectives.length}):`);
          for (const obj of objectives.slice(0, 20)) {
            const instrument = obj.primaryInstrument || 'unknown';
            const priority = obj.priority || 'MEDIUM';
            parts.push(`- [${instrument}/${priority}] ${obj.description}`);
            if (obj.assumptions?.length) {
              parts.push(`  Assumptions: ${obj.assumptions.join('; ')}`);
            }
            if (obj.risks?.length) {
              parts.push(`  Risks: ${obj.risks.join('; ')}`);
            }
            if (obj.constraints?.length) {
              parts.push(`  Constraints: ${obj.constraints.join('; ')}`);
            }
          }
          if (objectives.length > 20) {
            parts.push(`  ... and ${objectives.length - 20} more objectives`);
          }
        } else {
          parts.push('(No objectives extracted yet)');
        }
      } catch {
        // Objectives table may not exist yet
      }

      parts.push('');
    }

    const result = parts.join('\n');
    // Cap at ~6000 chars to leave room in context window
    return result.length > 6000 ? result.substring(0, 6000) + '\n...(truncated)' : result;
  } catch (err) {
    console.warn('[design] Failed to fetch strategic context:', err);
    return '';
  }
}

/**
 * Build progressive design context from prior sections.
 * Each section benefits from completed prior sections:
 * - cog-analysis receives problem framing
 * - lines-of-effort receives problem framing + CoG analysis
 * - operational-approach receives all prior sections
 */
function buildPriorDesignContext(section: string, design: OperationalDesign): string {
  const parts: string[] = [];

  const pf = design.problemFraming;
  const hasProblemFraming = pf && (pf.currentState || pf.problemStatement || pf.desiredEndState);

  // CoG, LOE, and Operational Approach all benefit from problem framing
  if (section !== 'problem-framing' && hasProblemFraming) {
    parts.push('## Prior Design Context: Problem Framing');
    if (pf.currentState) parts.push(`Current State: ${pf.currentState}`);
    if (pf.problemStatement) parts.push(`Problem Statement: ${pf.problemStatement}`);
    if (pf.desiredEndState) parts.push(`Desired End State: ${pf.desiredEndState}`);
    if (pf.keyTensions?.length) parts.push(`Key Tensions: ${pf.keyTensions.join('; ')}`);
    if (pf.obstacles?.length) parts.push(`Obstacles: ${pf.obstacles.join('; ')}`);
    if (pf.opportunities?.length) parts.push(`Opportunities: ${pf.opportunities.join('; ')}`);
    if (pf.assumptions?.length) parts.push(`Assumptions: ${pf.assumptions.join('; ')}`);
    if (pf.constraints?.length) parts.push(`Constraints: ${pf.constraints.join('; ')}`);
    parts.push('');
  }

  const cog = design.cogAnalysis;
  const hasCog = cog && (cog.friendly?.root || cog.adversary?.root);

  // LOE and Operational Approach benefit from CoG analysis
  if ((section === 'lines-of-effort' || section === 'operational-approach') && hasCog) {
    parts.push('## Prior Design Context: Center of Gravity Analysis');
    if (cog.friendly?.root) {
      parts.push(`Friendly CoG: ${cog.friendly.root.label}${cog.friendly.root.description ? ` — ${cog.friendly.root.description}` : ''}`);
      const fCCs = cog.friendly.root.children?.filter(c => c.type === 'critical-capability') || [];
      if (fCCs.length) parts.push(`  Critical Capabilities: ${fCCs.map(c => c.label).join(', ')}`);
    }
    if (cog.adversary?.root) {
      parts.push(`Adversary CoG: ${cog.adversary.root.label}${cog.adversary.root.description ? ` — ${cog.adversary.root.description}` : ''}`);
      const aCCs = cog.adversary.root.children?.filter(c => c.type === 'critical-capability') || [];
      if (aCCs.length) parts.push(`  Critical Capabilities: ${aCCs.map(c => c.label).join(', ')}`);
    }
    parts.push('');
  }

  const loes = design.linesOfEffort;
  const hasLOEs = loes && loes.length > 0;

  // Operational Approach benefits from LOE data
  if (section === 'operational-approach' && hasLOEs) {
    parts.push('## Prior Design Context: Lines of Effort');
    for (const loe of loes) {
      parts.push(`- LOE: ${loe.name}${loe.description ? ` — ${loe.description}` : ''}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * GET /api/design/:problemSetId
 * Returns full OperationalDesign (auto-creates if none exists).
 */
router.get('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const design = await designStore.getByProblemSetId(problemSetId);
    res.json(design);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/status
 * Returns just section statuses.
 */
router.get('/:problemSetId/status', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const status = await designStore.getStatus(problemSetId);
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId}/status failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/design/:problemSetId/:section
 * Updates one section. Body = section data.
 * Section must be: problem-framing, cog-analysis, lines-of-effort, operational-approach.
 */
router.patch('/:problemSetId/:section', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const section = req.params.section as string;

    if (!VALID_SECTIONS.includes(section)) {
      res.status(400).json({
        error: `Invalid section: ${section}. Must be one of: ${VALID_SECTIONS.join(', ')}`,
      });
      return;
    }

    const updated = await designStore.updateSection(problemSetId, section, req.body);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] PATCH /${req.params.problemSetId}/${req.params.section} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/handoff
 * Returns DesignHandoffPayload for Plan tab consumption.
 */
router.get('/:problemSetId/handoff', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const payload = await designStore.getHandoffPayload(problemSetId);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId}/handoff failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/design/:problemSetId/push-handoff
 * Packages handoff payload and persists it in the database.
 */
router.post('/:problemSetId/push-handoff', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const result = await designStore.pushHandoff(problemSetId);
    notifyCOPChange(problemSetId, 'design-handoff');
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] POST /${req.params.problemSetId}/push-handoff failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/design/:problemSetId/analyze
 * AI analysis for a design section.
 * Body = { section: string, context: object, additionalAgents?: string[] }.
 *
 * When additionalAgents are provided, each agent runs a supplementary analysis
 * in parallel with the primary section agent. Results are merged into the response
 * as an `agentContributions` array alongside the primary output.
 */
router.post('/:problemSetId/analyze', async (req: Request, res: Response) => {
  try {
    const section = req.body.section as string;
    const context = req.body.context as Record<string, unknown>;
    const additionalAgents = (req.body.additionalAgents as string[]) || [];

    if (!section) {
      res.status(400).json({ error: 'Missing required field: section' });
      return;
    }

    // ── Fetch strategic context from Understand tab documents ─────────────
    const problemSetId = req.params.problemSetId as string;
    const strategicContext = await getStrategicContext(problemSetId);
    if (strategicContext) {
      console.log(`[design] Injecting strategic context (${strategicContext.length} chars) into ${section} analysis`);
    }

    // ── Fetch current design state for progressive context enrichment ────
    // Each section benefits from prior sections: problem-framing → cog → LOE → narrative
    const design = await designStore.getByProblemSetId(problemSetId);
    const priorContext = buildPriorDesignContext(section, design);
    const fullContext = [strategicContext, priorContext].filter(Boolean).join('\n\n');

    // ── Primary section analysis ──────────────────────────────────────────
    let primaryOutput: Record<string, unknown>;

    if (section === 'problem-framing') {
      const { generateFramings } = await import('../agents/problem-framing.js');
      // Prepend strategic context to situation description
      const situationWithContext = fullContext
        ? `${fullContext}\n\n## Current Situation Assessment\n${(context?.currentState as string) || ''}`
        : (context?.currentState as string) || '';
      const output = await generateFramings(
        situationWithContext,
        (context?.problemStatement as string) || '',
        (context?.desiredEndState as string) || '',
        (context?.assumptions as string[]) || []
      );
      const framings = [output.defaultFraming, ...output.alternativeFramings];
      primaryOutput = { framings };
    } else if (section === 'cog-analysis') {
      const { analyzeCenterOfGravity } = await import('../agents/cog-analysis.js');
      const cogData = context as unknown as CoGAnalysis;
      primaryOutput = await analyzeCenterOfGravity(cogData, fullContext) as unknown as Record<string, unknown>;
    } else if (section === 'lines-of-effort') {
      const { analyzeLOEGaps } = await import('../agents/loe-gap-analysis.js');
      const loeData = ((context as Record<string, unknown>)?.loes as LineOfEffort[]) || [];
      const cogData = ((context as Record<string, unknown>)?.cogAnalysis as CoGAnalysis) || { friendly: { root: null }, adversary: { root: null } };
      primaryOutput = await analyzeLOEGaps(loeData, cogData, fullContext) as unknown as Record<string, unknown>;
    } else if (section === 'operational-approach') {
      const { synthesizeNarrative } = await import('../agents/narrative-synthesis.js');
      primaryOutput = await synthesizeNarrative({
        problemFraming: design.problemFraming,
        cogAnalysis: design.cogAnalysis,
        linesOfEffort: design.linesOfEffort,
        operationalApproach: design.operationalApproach,
      }, fullContext) as unknown as Record<string, unknown>;
    } else {
      res.status(400).json({ error: `Unsupported analysis section: ${section}` });
      return;
    }

    // ── Additional agent contributions (parallel) ─────────────────────────
    if (additionalAgents.length > 0) {
      const contributions = await getAgentContributions(
        additionalAgents,
        section,
        context,
        problemSetId,
        strategicContext,
      );
      primaryOutput.agentContributions = contributions;
    }

    res.json(primaryOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] POST /${req.params.problemSetId}/analyze failed:`, message);
    res.status(500).json({ error: message });
  }
});

// ─── Supplementary Agent Contributions ─────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  'problem-framing': 'Problem Framing',
  'cog-analysis': 'Center of Gravity Analysis',
  'lines-of-effort': 'Lines of Effort / Gap Analysis',
  'operational-approach': 'Operational Approach / Narrative Synthesis',
};

interface AgentContribution {
  agentId: string;
  agentName: string;
  analysis: string;
  confidence: number;
  keyPoints: string[];
}

/**
 * Run supplementary analysis with additional agents in parallel.
 * Each agent uses its own character/persona to provide a unique perspective
 * on the given design section data.
 */
async function getAgentContributions(
  agentIds: string[],
  section: string,
  context: Record<string, unknown>,
  problemSetId: string,
  strategicContext?: string,
): Promise<AgentContribution[]> {
  const registry = getAgentRegistry();
  await registry.ensureInitialized();

  const sectionLabel = SECTION_LABELS[section] || section;

  // Build a concise summary of the section data for the supplementary prompt
  const contextSummary = JSON.stringify(context, null, 2).substring(0, 3000);

  const promises = agentIds.map(async (agentId): Promise<AgentContribution | null> => {
    try {
      const agent = registry.getAgent(agentId);
      if (!agent) {
        console.warn(`[design] Additional agent ${agentId} not found in registry`);
        return null;
      }

      // Build system prompt from agent character
      const character = agent.character;
      const bioText = character?.bio?.map((b) => `- ${b}`).join('\n') || '';
      const knowledgeText = character?.knowledge?.map((k) => `- ${k}`).join('\n') || '';
      const styleText = character?.style?.all?.map((s) => `- ${s}`).join('\n') || '';

      const systemPrompt = `You are ${agent.name} — ${agent.description}.

${bioText ? `Your background:\n${bioText}\n` : ''}
${knowledgeText ? `Your knowledge:\n${knowledgeText}\n` : ''}
${styleText ? `Your style:\n${styleText}\n` : ''}
You have been asked to contribute a supplementary analysis to the "${sectionLabel}" section of an operational design. Provide your unique perspective based on your expertise.

CRITICAL: Respond ONLY with a JSON object: { "analysis": "your analysis paragraph", "confidence": 0.0-1.0, "keyPoints": ["point1", "point2", ...] }`;

      const strategicCtxBlock = strategicContext
        ? `\n\nStrategic Context (from uploaded documents):\n${strategicContext.substring(0, 2000)}\n`
        : '';

      const userPrompt = `Provide your supplementary analysis for this ${sectionLabel} section.

Problem Set ID: ${problemSetId}
${strategicCtxBlock}
Section Data:
${contextSummary}

Based on your expertise, what insights, risks, blind spots, or alternative considerations should the planning team be aware of? Focus on what the primary analyst might miss given your specialized perspective.`;

      const llm = await createLLMForAgent({
        agentId,
        overrides: { temperature: 0.4, maxTokens: 1500 },
      });

      const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const text = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse JSON response
      let cleaned = text.trim();
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(cleaned) as {
          analysis?: string;
          confidence?: number;
          keyPoints?: string[];
        };
        return {
          agentId,
          agentName: agent.name,
          analysis: parsed.analysis || text,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        };
      } catch {
        // If JSON parse fails, use raw text
        return {
          agentId,
          agentName: agent.name,
          analysis: text,
          confidence: 0.5,
          keyPoints: [],
        };
      }
    } catch (err) {
      console.error(`[design] Additional agent ${agentId} analysis failed:`, err);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((r): r is AgentContribution => r !== null);
}

export default router;
