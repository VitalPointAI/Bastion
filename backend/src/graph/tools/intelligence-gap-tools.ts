/**
 * Intelligence Gap MCP Tools
 *
 * MCP tool definitions and handlers for intelligence gap monitoring,
 * parent-context-aware gap detection, gap filler status reporting,
 * and targeted research dispatch. Used by Ironclaw to monitor and
 * manage the intelligence gap lifecycle.
 */

import type { MCPToolInput } from '../../agents/character-schema.js';
import { brainStore } from '../../brain/brain-store.js';
import { gapFillerService } from '../../ironclaw/gap-filler-service.js';
import { pirStore } from '../../design/pir-store.js';
import { designStore } from '../../design/design-store.js';

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

export const pirToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'get_priority_intel_requirements',
    name: 'Get Priority Intel Requirements',
    description:
      'List active PIRs/CCIRs for a problem set, ordered by priority. ' +
      'Returns all types: CCIR, PIR, FFIR, EEFI.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to list PIRs for',
        },
        type: {
          type: 'string',
          enum: ['CCIR', 'PIR', 'FFIR', 'EEFI'],
          description: 'Optional filter by requirement type',
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'ANSWERED', 'SUPERSEDED', 'CANCELLED'],
          description: 'Optional filter by status (default: all)',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_priority_intel_requirements'],
    isEnabled: true,
  },
  {
    toolId: 'create_pir_from_assumption',
    name: 'Create PIR from Assumption',
    description:
      'Create a Priority Intelligence Requirement linked to a specific ' +
      'assumption from the operational design. The PIR tracks the intelligence ' +
      'needed to validate or invalidate the assumption.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID',
        },
        assumptionId: {
          type: 'string',
          description: 'ID of the assumption to link',
        },
        assumptionText: {
          type: 'string',
          description: 'Text of the assumption (used to generate PIR description)',
        },
        type: {
          type: 'string',
          enum: ['CCIR', 'PIR', 'FFIR', 'EEFI'],
          description: 'Requirement type (default: PIR)',
        },
        priority: {
          type: 'number',
          description: 'Priority (1=highest, default: 1)',
        },
      },
      required: ['problemSetId', 'assumptionText'],
    },
    handler: 'builtin',
    permissions: ['tool:create_pir_from_assumption'],
    isEnabled: true,
  },
  {
    toolId: 'answer_pir',
    name: 'Answer PIR',
    description:
      'Mark a PIR as answered with the answer text. Changes status to ANSWERED ' +
      'and records who answered it and when.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        pirId: {
          type: 'string',
          description: 'ID of the PIR to answer',
        },
        answer: {
          type: 'string',
          description: 'The answer text with supporting evidence',
        },
        answeredBy: {
          type: 'string',
          description: 'Who is providing the answer (agent name or user DID)',
        },
      },
      required: ['pirId', 'answer'],
    },
    handler: 'builtin',
    permissions: ['tool:answer_pir'],
    isEnabled: true,
  },
  {
    toolId: 'derive_pirs_from_design',
    name: 'Derive PIRs from Design',
    description:
      'Analyze the operational design (CoG analysis, lines of effort, ' +
      'assumptions, problem framing) for a problem set and generate ' +
      'recommended PIRs. Returns suggestions without creating them so ' +
      'the commander can review and approve.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to derive PIRs from',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:derive_pirs_from_design'],
    isEnabled: true,
  },
];

export const intelligenceGapToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'get_intelligence_gaps',
    name: 'Get Intelligence Gaps',
    description:
      'Return current intelligence gaps for a problem set, including ' +
      'suggestions from the parent graph for actors that may help fill gaps.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to check for gaps',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_intelligence_gaps'],
    isEnabled: true,
  },
  {
    toolId: 'get_gap_filler_status',
    name: 'Get Gap Filler Status',
    description:
      'Return the gap filler service state for a problem set: last run ' +
      'time, gaps processed, active cooldowns, and next scheduled run.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to check status for',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_gap_filler_status'],
    isEnabled: true,
  },
  {
    toolId: 'prioritize_gap_research',
    name: 'Prioritize Gap Research',
    description:
      'Bump a specific intelligence gap to high priority by clearing ' +
      'its cooldown and optionally triggering immediate research.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID the gap belongs to',
        },
        gapNodeId: {
          type: 'string',
          description: 'Node ID of the gap to prioritize',
        },
        reason: {
          type: 'string',
          description: 'Reason for prioritization (logged for audit)',
        },
      },
      required: ['problemSetId', 'gapNodeId', 'reason'],
    },
    handler: 'builtin',
    permissions: ['tool:prioritize_gap_research'],
    isEnabled: true,
  },
  {
    toolId: 'request_targeted_research',
    name: 'Request Targeted Research',
    description:
      'Request research on a specific topic or entity via the researcher ' +
      'specialist. Creates a pg-boss job for async processing.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to scope the research',
        },
        query: {
          type: 'string',
          description: 'Research topic or entity to investigate',
        },
        context: {
          type: 'string',
          description: 'Additional context for the research (why this matters)',
        },
      },
      required: ['problemSetId', 'query', 'context'],
    },
    handler: 'builtin',
    permissions: ['tool:request_targeted_research'],
    isEnabled: true,
  },
];

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

export const intelligenceGapToolHandlers: Record<
  string,
  (args: Record<string, unknown>) => Promise<Record<string, unknown>>
> = {
  get_intelligence_gaps: async (args) => {
    const problemSetId = args.problemSetId as string;
    if (!problemSetId) return { success: false, error: 'problemSetId is required' };

    const report = await brainStore.getIntelligenceGapsWithParentContext(problemSetId);
    return {
      success: true,
      localGaps: report.gaps,
      parentSuggestions: report.parentSuggestions,
      totalLocalGaps: report.gaps.length,
      totalParentSuggestions: report.parentSuggestions.length,
    };
  },

  get_gap_filler_status: async (args) => {
    const problemSetId = args.problemSetId as string;
    if (!problemSetId) return { success: false, error: 'problemSetId is required' };

    const status = gapFillerService.getStatus(problemSetId);
    return { success: true, ...status };
  },

  prioritize_gap_research: async (args) => {
    const problemSetId = args.problemSetId as string;
    const gapNodeId = args.gapNodeId as string;
    const reason = args.reason as string;
    if (!problemSetId || !gapNodeId || !reason) {
      return { success: false, error: 'problemSetId, gapNodeId, and reason are required' };
    }

    // Clear cooldown so the gap is eligible for immediate research
    gapFillerService.prioritizeGap(gapNodeId);

    // Trigger an immediate fill cycle for this problem set
    try {
      const results = await gapFillerService.fillGapsForProblemSet(problemSetId);
      const filled = results.find((r) => r.gapId === gapNodeId);
      return {
        success: true,
        prioritized: true,
        gapNodeId,
        reason,
        immediateResearchResult: filled
          ? {
              actorName: filled.actorName,
              searchResultCount: filled.searchResultCount,
              actorsCreated: filled.actorsCreated,
              relationshipsCreated: filled.relationshipsCreated,
            }
          : null,
        note: filled
          ? 'Gap was researched immediately'
          : 'Gap cooldown cleared; gap will be researched on next eligible cycle',
      };
    } catch (err) {
      return {
        success: true,
        prioritized: true,
        gapNodeId,
        reason,
        immediateResearchResult: null,
        note: `Cooldown cleared but immediate research failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },

  request_targeted_research: async (args) => {
    const problemSetId = args.problemSetId as string;
    const query = args.query as string;
    const context = args.context as string;
    if (!problemSetId || !query) {
      return { success: false, error: 'problemSetId and query are required' };
    }

    try {
      const { Researcher } = await import(
        '../../doc-intelligence/specialists/researcher.js'
      );
      const researcher = new Researcher();
      const gapDescription = `${query} -- Context: ${context || 'none'}`;
      await researcher.triggerGapResearch(
        problemSetId,
        [gapDescription],
        0,
        'ironclaw-targeted-research',
      );

      const jobId = `targeted-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        jobId,
        problemSetId,
        query,
        context: context || null,
        status: 'queued',
        note: 'Research job queued via pg-boss. Results will appear as strategic documents.',
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to queue research: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// PIR Tool Handlers
// ---------------------------------------------------------------------------

export const pirToolHandlers: Record<
  string,
  (args: Record<string, unknown>) => Promise<Record<string, unknown>>
> = {
  get_priority_intel_requirements: async (args) => {
    const problemSetId = args.problemSetId as string;
    if (!problemSetId) return { success: false, error: 'problemSetId is required' };

    const filters: { type?: string; status?: string } = {};
    if (args.type) filters.type = args.type as string;
    if (args.status) filters.status = args.status as string;

    const pirs = await pirStore.listPIRs(
      problemSetId,
      filters as { type?: 'CCIR' | 'PIR' | 'FFIR' | 'EEFI'; status?: 'ACTIVE' | 'ANSWERED' | 'SUPERSEDED' | 'CANCELLED' },
    );

    return {
      success: true,
      pirs,
      totalCount: pirs.length,
      activeCount: pirs.filter((p) => p.status === 'ACTIVE').length,
      answeredCount: pirs.filter((p) => p.status === 'ANSWERED').length,
    };
  },

  create_pir_from_assumption: async (args) => {
    const problemSetId = args.problemSetId as string;
    const assumptionText = args.assumptionText as string;
    if (!problemSetId || !assumptionText) {
      return { success: false, error: 'problemSetId and assumptionText are required' };
    }

    const pirType = (args.type as string) || 'PIR';
    const priority = (args.priority as number) || 1;
    const assumptionId = args.assumptionId as string | undefined;

    // Generate a PIR description from the assumption text
    const description =
      `Validate assumption: "${assumptionText}" -- Determine whether this ` +
      `assumption holds true under current operational conditions and identify ` +
      `indicators that would confirm or deny it.`;

    const pir = await pirStore.createPIR({
      problemSetId,
      type: pirType as 'CCIR' | 'PIR' | 'FFIR' | 'EEFI',
      description,
      priority,
      sourceType: 'assumption',
      sourceId: assumptionId,
      linkedAssumptionIds: assumptionId ? [assumptionId] : [],
      createdBy: 'ironclaw',
    });

    return {
      success: true,
      pir,
      note: `Created ${pirType} linked to assumption. Commander should review and adjust priority.`,
    };
  },

  answer_pir: async (args) => {
    const pirId = args.pirId as string;
    const answer = args.answer as string;
    if (!pirId || !answer) {
      return { success: false, error: 'pirId and answer are required' };
    }

    const answeredBy = (args.answeredBy as string) || 'ironclaw';

    const pir = await pirStore.updatePIR(pirId, {
      answer,
      answeredBy,
      status: 'ANSWERED',
    });

    if (!pir) {
      return { success: false, error: `PIR ${pirId} not found` };
    }

    return {
      success: true,
      pir,
      note: 'PIR marked as ANSWERED. Commander should validate the answer.',
    };
  },

  derive_pirs_from_design: async (args) => {
    const problemSetId = args.problemSetId as string;
    if (!problemSetId) return { success: false, error: 'problemSetId is required' };

    try {
      const design = await designStore.getByProblemSetId(problemSetId);
      const suggestions: Array<{
        type: string;
        description: string;
        priority: number;
        sourceType: string;
        sourceLabel: string;
        rationale: string;
      }> = [];

      let priorityCounter = 1;

      // 1. Derive PIRs from assumptions
      const assumptions = design.problemFraming.assumptions ?? [];
      for (const assumption of assumptions) {
        if (typeof assumption === 'string' && assumption.trim().length > 0) {
          suggestions.push({
            type: 'PIR',
            description: `Validate assumption: "${assumption}" -- Identify indicators and collection assets to confirm or deny.`,
            priority: priorityCounter++,
            sourceType: 'assumption',
            sourceLabel: assumption,
            rationale: 'Unvalidated assumptions create planning risk. Intelligence collection should confirm or deny key planning assumptions.',
          });
        }
      }

      // 2. Derive CCIRs from adversary CoG analysis
      const advCoG = design.cogAnalysis?.adversary?.root;
      if (advCoG) {
        suggestions.push({
          type: 'CCIR',
          description: `Confirm adversary center of gravity: "${advCoG.label}" -- What is the current status, capability, and vulnerability of this CoG?`,
          priority: 1,
          sourceType: 'cog_node',
          sourceLabel: `Adversary CoG: ${advCoG.label}`,
          rationale: 'Understanding adversary CoG status is critical for targeting and sequencing operations.',
        });

        // Derive from critical vulnerabilities
        const cvNodes = (advCoG.children ?? []).flatMap((cc) =>
          (cc.children ?? []).flatMap((cr) =>
            (cr.children ?? []).filter((cv) => cv.type === 'critical-vulnerability')
          )
        );
        for (const cv of cvNodes) {
          suggestions.push({
            type: 'PIR',
            description: `Assess adversary critical vulnerability: "${cv.label}" -- Current exploitability, defensive measures, and access.`,
            priority: priorityCounter++,
            sourceType: 'cog_node',
            sourceLabel: `CV: ${cv.label}`,
            rationale: 'Critical vulnerabilities inform targeting priorities and operational sequencing.',
          });
        }
      }

      // 3. Derive FFIRs from friendly CoG analysis
      const friendlyCoG = design.cogAnalysis?.friendly?.root;
      if (friendlyCoG) {
        const frCVNodes = (friendlyCoG.children ?? []).flatMap((cc) =>
          (cc.children ?? []).flatMap((cr) =>
            (cr.children ?? []).filter((cv) => cv.type === 'critical-vulnerability')
          )
        );
        for (const cv of frCVNodes) {
          suggestions.push({
            type: 'FFIR',
            description: `Monitor friendly vulnerability: "${cv.label}" -- Status of protective measures and risk level.`,
            priority: priorityCounter++,
            sourceType: 'cog_node',
            sourceLabel: `Friendly CV: ${cv.label}`,
            rationale: 'Friendly force vulnerabilities must be monitored to protect our own center of gravity.',
          });
        }
      }

      // 4. Derive from lines of effort decisive points
      const loes = design.linesOfEffort ?? [];
      for (const loe of loes) {
        const dps = loe.decisivePoints ?? [];
        for (const dp of dps) {
          suggestions.push({
            type: 'PIR',
            description: `Intelligence support for decisive point "${dp.label}" (LOE: ${loe.name}) -- What conditions must be met and what indicators show progress?`,
            priority: priorityCounter++,
            sourceType: 'decisive_point',
            sourceLabel: `${loe.name} > ${dp.label}`,
            rationale: 'Decisive points require intelligence to determine when conditions are set for action.',
          });
        }
      }

      // 5. Derive EEFI from problem framing constraints
      const constraints = design.problemFraming.constraints ?? [];
      for (const constraint of constraints) {
        if (typeof constraint === 'string' && constraint.trim().length > 0) {
          suggestions.push({
            type: 'EEFI',
            description: `Protect information related to constraint: "${constraint}" -- Identify what the adversary must not learn about our limitations.`,
            priority: priorityCounter++,
            sourceType: 'constraint',
            sourceLabel: constraint,
            rationale: 'Constraints reveal limitations the adversary could exploit. Related information should be protected.',
          });
        }
      }

      // Check existing PIRs to flag potential duplicates
      const existingPIRs = await pirStore.listPIRs(problemSetId);
      const existingDescriptions = existingPIRs.map((p) => p.description.toLowerCase());

      const annotatedSuggestions = suggestions.map((s) => {
        const possibleDuplicate = existingDescriptions.some((d) =>
          d.includes(s.sourceLabel.toLowerCase().slice(0, 30))
        );
        return { ...s, possibleDuplicate };
      });

      return {
        success: true,
        suggestions: annotatedSuggestions,
        totalSuggestions: annotatedSuggestions.length,
        existingPIRCount: existingPIRs.length,
        sources: {
          assumptions: assumptions.length,
          cogNodes: (advCoG ? 1 : 0) + (friendlyCoG ? 1 : 0),
          decisivePoints: loes.reduce((sum, l) => sum + (l.decisivePoints?.length ?? 0), 0),
          constraints: constraints.length,
        },
        note: 'These are recommended PIRs derived from the operational design. Review and approve before creating.',
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to derive PIRs: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
