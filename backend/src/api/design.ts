/**
 * Operational Design REST API
 *
 * Phase 25 Plan 01: Express routes for /api/design/*
 * CRUD operations for operational design data per problem set.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { designStore } from '../design/design-store.js';
import type { CoGAnalysis, LineOfEffort, OperationalApproach } from '../design/types.js';
import { getAgentRegistry } from '../agents/registry.js';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';

const router = Router();

const VALID_SECTIONS = ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'];

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

    // ── Primary section analysis ──────────────────────────────────────────
    let primaryOutput: Record<string, unknown>;

    if (section === 'problem-framing') {
      const { generateFramings } = await import('../agents/problem-framing.js');
      const output = await generateFramings(
        (context?.currentState as string) || '',
        (context?.problemStatement as string) || '',
        (context?.desiredEndState as string) || '',
        (context?.assumptions as string[]) || []
      );
      const framings = [output.defaultFraming, ...output.alternativeFramings];
      primaryOutput = { framings };
    } else if (section === 'cog-analysis') {
      const { analyzeCenterOfGravity } = await import('../agents/cog-analysis.js');
      const cogData = context as unknown as CoGAnalysis;
      primaryOutput = await analyzeCenterOfGravity(cogData) as unknown as Record<string, unknown>;
    } else if (section === 'lines-of-effort') {
      const { analyzeLOEGaps } = await import('../agents/loe-gap-analysis.js');
      const loeData = ((context as Record<string, unknown>)?.loes as LineOfEffort[]) || [];
      const cogData = ((context as Record<string, unknown>)?.cogAnalysis as CoGAnalysis) || { friendly: { root: null }, adversary: { root: null } };
      primaryOutput = await analyzeLOEGaps(loeData, cogData) as unknown as Record<string, unknown>;
    } else if (section === 'operational-approach') {
      const { synthesizeNarrative } = await import('../agents/narrative-synthesis.js');
      const design = await designStore.getByProblemSetId(req.params.problemSetId as string);
      primaryOutput = await synthesizeNarrative({
        problemFraming: design.problemFraming,
        cogAnalysis: design.cogAnalysis,
        linesOfEffort: design.linesOfEffort,
        operationalApproach: design.operationalApproach,
      }) as unknown as Record<string, unknown>;
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
        req.params.problemSetId as string,
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

      const userPrompt = `Provide your supplementary analysis for this ${sectionLabel} section.

Problem Set ID: ${problemSetId}

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
