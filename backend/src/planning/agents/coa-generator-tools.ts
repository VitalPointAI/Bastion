/**
 * COA Generator Tools
 *
 * Phase 05 Plan 05: LangChain StructuredTools for COA generation
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { coaStore } from '../stores/coa-store.js';
import { planStore } from '../stores/plan-store.js';
import type { RiskAssessment } from '../types.js';

export class GetMissionContextTool extends StructuredTool {
  name = 'get_mission_context';
  description = 'Get the mission analysis and situation from an operational plan';
  schema = z.object({
    planId: z.string().describe('The operational plan ID'),
  });

  async _call({ planId }: { planId: string }) {
    const plan = await planStore.findById(planId);
    if (!plan) return JSON.stringify({ error: 'Plan not found' });

    return JSON.stringify({
      mission: plan.mission,
      situation: plan.situation,
      objectives: plan.objectiveIds,
      constraints: plan.execution?.coordinatingInstructions || [],
    });
  }
}

export class SaveCOATool extends StructuredTool {
  name = 'save_coa';
  description = 'Save a generated Course of Action to the database';
  schema = z.object({
    planId: z.string().describe('The operational plan ID'),
    name: z.string().describe('COA name (e.g., "COA 1: Direct Assault")'),
    description: z.string().describe('Brief description of the COA'),
    scheme: z.string().describe('Scheme of maneuver'),
    commandersIntent: z.object({
      purpose: z.string(),
      keyTasks: z.array(z.string()),
      endState: z.string(),
      context: z.string().optional().default(''),
      constraints: z.array(z.string()).optional().default([]),
      criticalFactors: z.array(z.string()).optional().default([]),
      antigoals: z.array(z.string()).optional().default([]),
    }).describe('Commander intent for this COA'),
    tasks: z.array(z.object({
      unitId: z.string(),
      task: z.string(),
      purpose: z.string(),
      supportingEfforts: z.array(z.string()).optional(),
    })).describe('Tasks to subordinate units'),
    decisiveOperation: z.string().describe('The decisive operation'),
    shapingOperations: z.string().describe('Shaping operations'),
    sustainingOperations: z.string().describe('Sustaining operations'),
    risks: z.array(z.object({
      category: z.enum(['operational', 'political', 'strategic', 'tactical']),
      description: z.string(),
      likelihood: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high']),
      mitigation: z.string().optional(),
    })).describe('Identified risks'),
    confidenceScore: z.number().min(0).max(100).describe('Confidence in this COA (0-100)'),
  });

  private agentId: string;

  constructor(agentId: string) {
    super();
    this.agentId = agentId;
  }

  async _call(input: z.infer<typeof this.schema>) {
    try {
      // Get current COA count for numbering
      const existingCount = await coaStore.countByPlan(input.planId);

      // Map risks to include IDs
      const risks: RiskAssessment[] = input.risks.map((r, i) => ({
        id: `RISK-${existingCount + 1}-${i + 1}`,
        category: r.category,
        description: r.description,
        likelihood: r.likelihood,
        impact: r.impact,
        mitigation: r.mitigation,
      }));

      const coa = await coaStore.create({
        planId: input.planId,
        number: existingCount + 1,
        name: input.name,
        description: input.description,
        scheme: input.scheme,
        commandersIntent: {
          purpose: input.commandersIntent.purpose,
          keyTasks: input.commandersIntent.keyTasks,
          endState: input.commandersIntent.endState,
          context: input.commandersIntent.context || '',
          constraints: input.commandersIntent.constraints || [],
          criticalFactors: input.commandersIntent.criticalFactors || [],
          antigoals: input.commandersIntent.antigoals || [],
        },
        tasks: input.tasks.map((t, i) => ({
          id: `TASK-${existingCount + 1}-${i + 1}`,
          unitId: t.unitId,
          task: t.task,
          purpose: t.purpose,
          supportingEfforts: t.supportingEfforts,
        })),
        risks,
        supportingEfforts: [],
        decisiveOperation: input.decisiveOperation,
        shaping: input.shapingOperations,
        sustainingOperations: input.sustainingOperations,
      }, this.agentId);

      return JSON.stringify({
        success: true,
        coaId: coa.id,
        coaNumber: coa.number,
        confidenceScore: input.confidenceScore,
        message: `COA ${coa.number} saved successfully`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save COA',
      });
    }
  }
}

export class GetExistingCOAsTool extends StructuredTool {
  name = 'get_existing_coas';
  description = 'Get existing COAs for a plan to ensure new ones are distinct';
  schema = z.object({
    planId: z.string().describe('The operational plan ID'),
  });

  async _call({ planId }: { planId: string }) {
    const coas = await coaStore.findByPlan(planId);
    return JSON.stringify(coas.map(c => ({
      number: c.number,
      name: c.name,
      description: c.description,
      scheme: c.scheme,
    })));
  }
}

export function getCOAGeneratorTools(agentId: string): StructuredTool[] {
  return [
    new GetMissionContextTool(),
    new SaveCOATool(agentId),
    new GetExistingCOAsTool(),
  ];
}
