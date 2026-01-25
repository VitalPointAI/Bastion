import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { coaStore } from '../stores/coa-store.js';
import { planStore } from '../stores/plan-store.js';
import { COAComparisonScore } from '../types.js';

export class GetAllCOAsTool extends StructuredTool {
  name = 'get_all_coas';
  description = 'Get all COAs for a plan with their details and red team results';
  schema = z.object({
    planId: z.string().describe('The operational plan ID'),
  });

  async _call({ planId }: { planId: string }) {
    const coas = await coaStore.findByPlan(planId);

    return JSON.stringify(coas.map(coa => ({
      id: coa.id,
      number: coa.number,
      name: coa.name,
      description: coa.description,
      scheme: coa.scheme,
      decisiveOperation: coa.decisiveOperation,
      shapingOperations: coa.shaping,
      tasks: coa.tasks,
      risks: coa.risks,
      redTeamResults: coa.redTeamResults,
    })));
  }
}

export class GetMissionCriteriaTool extends StructuredTool {
  name = 'get_mission_criteria';
  description = 'Get mission criteria and commander guidance for comparison';
  schema = z.object({
    planId: z.string().describe('The operational plan ID'),
  });

  async _call({ planId }: { planId: string }) {
    const plan = await planStore.findById(planId);
    if (!plan) return JSON.stringify({ error: 'Plan not found' });

    return JSON.stringify({
      mission: plan.mission,
      commandersIntent: plan.execution?.commandersIntent,
      constraints: plan.execution?.coordinatingInstructions,
      objectives: plan.objectiveIds,
      classification: plan.classification,
    });
  }
}

export class SaveComparisonScoreTool extends StructuredTool {
  name = 'save_comparison_score';
  description = 'Save comparison scores for a COA';
  schema = z.object({
    coaId: z.string().describe('The COA ID being scored'),
    feasibility: z.object({
      score: z.number().min(0).max(10).describe('Feasibility score 0-10'),
      rationale: z.string().describe('Explanation for feasibility score'),
    }),
    acceptability: z.object({
      score: z.number().min(0).max(10).describe('Acceptability score 0-10'),
      rationale: z.string().describe('Explanation for acceptability score'),
    }),
    suitability: z.object({
      score: z.number().min(0).max(10).describe('Suitability score 0-10'),
      rationale: z.string().describe('Explanation for suitability score'),
    }),
    distinguishability: z.object({
      score: z.number().min(0).max(10).describe('Distinguishability score 0-10'),
      rationale: z.string().describe('How distinct from other COAs'),
    }),
    completeness: z.object({
      score: z.number().min(0).max(10).describe('Completeness score 0-10'),
      rationale: z.string().describe('Explanation for completeness score'),
    }),
    ranking: z.number().min(1).describe('Overall ranking among COAs (1 = best)'),
    overallAssessment: z.string().describe('Summary assessment of this COA'),
  });

  private agentId: string;

  constructor(agentId: string) {
    super();
    this.agentId = agentId;
  }

  async _call(input: z.infer<typeof this.schema>) {
    try {
      // Calculate overall score (weighted average)
      const overallScore = (
        input.feasibility.score * 0.25 +
        input.acceptability.score * 0.25 +
        input.suitability.score * 0.30 +
        input.distinguishability.score * 0.10 +
        input.completeness.score * 0.10
      );

      const score: COAComparisonScore = {
        feasibility: input.feasibility,
        acceptability: input.acceptability,
        suitability: input.suitability,
        distinguishability: input.distinguishability,
        completeness: input.completeness,
        overallScore: Math.round(overallScore * 10), // 0-100 scale
        ranking: input.ranking,
        comparedAt: new Date(),
        agentId: this.agentId,
      };

      await coaStore.updateComparisonScore(input.coaId, score);

      return JSON.stringify({
        success: true,
        message: `Comparison score saved for COA ${input.coaId}`,
        overallScore: score.overallScore,
        ranking: input.ranking,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save score',
      });
    }
  }
}

export function getCOAComparatorTools(agentId: string): StructuredTool[] {
  return [
    new GetAllCOAsTool(),
    new GetMissionCriteriaTool(),
    new SaveComparisonScoreTool(agentId),
  ];
}
