import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { coaStore } from '../stores/coa-store.js';
import { planStore } from '../stores/plan-store.js';
import { RedTeamResult } from '../types.js';

export class GetCOADetailsTool extends StructuredTool {
  name = 'get_coa_details';
  description = 'Get full details of a Course of Action for analysis';
  schema = z.object({
    coaId: z.string().describe('The COA ID to analyze'),
  });

  async _call({ coaId }: { coaId: string }) {
    const coa = await coaStore.findById(coaId);
    if (!coa) return JSON.stringify({ error: 'COA not found' });

    return JSON.stringify({
      name: coa.name,
      description: coa.description,
      scheme: coa.scheme,
      decisiveOperation: coa.decisiveOperation,
      shapingOperations: coa.shaping,
      sustainingOperations: coa.sustainingOperations,
      tasks: coa.tasks,
      commandersIntent: coa.commandersIntent,
    });
  }
}

export class GetSituationTool extends StructuredTool {
  name = 'get_situation';
  description = 'Get enemy and terrain situation for adversary analysis';
  schema = z.object({
    planId: z.string().describe('The operational plan ID'),
  });

  async _call({ planId }: { planId: string }) {
    const plan = await planStore.findById(planId);
    if (!plan) return JSON.stringify({ error: 'Plan not found' });

    return JSON.stringify({
      enemyForces: plan.situation?.enemyForces || 'Unknown',
      terrain: plan.situation?.areaOfOperations || 'Unknown',
      civilConsiderations: plan.situation?.civilConsiderations || 'Unknown',
      areaOfInterest: plan.situation?.areaOfInterest || 'Unknown',
    });
  }
}

export class SaveRedTeamResultsTool extends StructuredTool {
  name = 'save_red_team_results';
  description = 'Save red team simulation results for a COA';
  schema = z.object({
    coaId: z.string().describe('The COA ID that was analyzed'),
    adversaryActions: z.array(z.string()).describe('Likely adversary actions in response'),
    vulnerabilities: z.array(z.string()).describe('Identified vulnerabilities in the COA'),
    counterActions: z.array(z.string()).describe('Specific counter-actions enemy could take'),
    outcomeAssessment: z.string().describe('Overall assessment of likely outcome'),
    confidenceScore: z.number().min(0).max(100).describe('Confidence in this analysis (0-100)'),
  });

  private agentId: string;

  constructor(agentId: string) {
    super();
    this.agentId = agentId;
  }

  async _call(input: z.infer<typeof this.schema>) {
    try {
      const results: RedTeamResult = {
        adversaryActions: input.adversaryActions,
        vulnerabilities: input.vulnerabilities,
        counterActions: input.counterActions,
        outcomeAssessment: input.outcomeAssessment,
        confidenceScore: input.confidenceScore,
        simulatedAt: new Date(),
        agentId: this.agentId,
      };

      await coaStore.updateRedTeamResults(input.coaId, results);

      return JSON.stringify({
        success: true,
        message: `Red team results saved for COA ${input.coaId}`,
        vulnerabilityCount: input.vulnerabilities.length,
        counterActionCount: input.counterActions.length,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save results',
      });
    }
  }
}

export function getRedTeamTools(agentId: string): StructuredTool[] {
  return [
    new GetCOADetailsTool(),
    new GetSituationTool(),
    new SaveRedTeamResultsTool(agentId),
  ];
}
