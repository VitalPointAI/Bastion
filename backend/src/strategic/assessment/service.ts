/**
 * Risk Assessment Service
 * AI-assisted risk assessment generation with human review workflow
 *
 * Uses LLM to generate risk assessments following military doctrine (5x5 matrix),
 * then saves to database for human review and approval.
 */

import { randomUUID } from 'crypto';
import type { StrategicObjective } from '../schemas/strategic-objective.js';
import type {
  RiskAssessment,
  RiskLevel,
  Likelihood,
  Impact,
  AIRiskAssessment,
  AIRiskInput,
  AutoFlag,
} from './types.js';
import {
  calculateRiskLevel,
  getRiskDecisionAuthority,
  combineRiskLevels,
  shouldAutoFlag,
} from './risk-calculator.js';
import { RiskAssessmentStore, riskAssessmentStore } from './store.js';
import { createProvider, getDefaultConfig } from '../extraction/providers/index.js';
import type {
  LLMProvider,
  LLMCompletionRequest,
  LLMToolDefinition,
  ProviderConfig,
} from '../extraction/providers/types.js';

/**
 * System prompt for AI risk assessment generation
 */
const RISK_ASSESSMENT_SYSTEM_PROMPT = `You are a military risk assessment analyst evaluating strategic objectives.

Use the 5x5 Risk Matrix:
- Likelihood: RARE, UNLIKELY, POSSIBLE, LIKELY, ALMOST_CERTAIN
- Impact: NEGLIGIBLE, MARGINAL, MODERATE, CRITICAL, CATASTROPHIC

Assess two risk dimensions:
1. Risk-to-Mission: Probability and impact of failing to achieve the objective
2. Risk-to-Force: Probability and impact of harm to forces, resources, or capabilities

For each risk dimension:
- Assess likelihood based on historical precedent, threat capability, and environmental factors
- Assess impact based on consequences to mission success or force protection
- Identify specific contributing factors

For mitigations:
- Propose concrete, actionable measures to reduce risk
- Assess effectiveness (HIGH, MEDIUM, LOW) based on how much risk would be reduced
- Assess resource cost (HIGH, MEDIUM, LOW) based on effort, time, and materiel required

Be conservative: when uncertain, assess higher risk.
Document all assumptions and areas of uncertainty honestly.
Always include questions for human reviewers to validate your assessment.

You MUST use the assess_risk tool to provide your response in the required structured format.`;

/**
 * Service configuration
 */
export interface RiskAssessmentServiceConfig {
  provider?: ProviderConfig;
}

/**
 * Risk Assessment Service
 * Generates AI-assisted risk assessments and manages the review workflow
 */
export class RiskAssessmentService {
  private provider: LLMProvider;
  private store: RiskAssessmentStore;
  private assessmentTool: LLMToolDefinition;

  constructor(config: RiskAssessmentServiceConfig = {}) {
    // Create provider from config or use Anthropic as default
    const providerConfig = config.provider || getDefaultConfig('anthropic');
    this.provider = createProvider(providerConfig);

    // Use the singleton store
    this.store = riskAssessmentStore;

    // Create the assessment tool
    this.assessmentTool = this.createAssessmentTool();
  }

  /**
   * Create the risk assessment tool definition with JSON Schema
   */
  private createAssessmentTool(): LLMToolDefinition {
    return {
      name: 'assess_risk',
      description:
        'Generate a risk assessment for a strategic objective. Use this tool to provide structured risk analysis.',
      input_schema: {
        type: 'object',
        required: [
          'riskToMission',
          'riskToForce',
          'mitigations',
          'assumptions',
          'uncertainties',
          'questionsForReviewer',
          'confidenceScore',
        ],
        properties: {
          riskToMission: {
            type: 'object',
            description: 'Risk of failing to achieve the mission objective',
            required: ['likelihood', 'impact', 'factors'],
            properties: {
              likelihood: {
                type: 'string',
                enum: ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'],
                description: 'Probability of risk occurrence',
              },
              impact: {
                type: 'string',
                enum: ['NEGLIGIBLE', 'MARGINAL', 'MODERATE', 'CRITICAL', 'CATASTROPHIC'],
                description: 'Severity of consequences',
              },
              factors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Contributing factors to this risk',
              },
            },
          },
          riskToForce: {
            type: 'object',
            description: 'Risk of harm to forces, resources, or personnel',
            required: ['likelihood', 'impact', 'factors'],
            properties: {
              likelihood: {
                type: 'string',
                enum: ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'],
                description: 'Probability of risk occurrence',
              },
              impact: {
                type: 'string',
                enum: ['NEGLIGIBLE', 'MARGINAL', 'MODERATE', 'CRITICAL', 'CATASTROPHIC'],
                description: 'Severity of consequences',
              },
              factors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Contributing factors to this risk',
              },
            },
          },
          mitigations: {
            type: 'array',
            description: 'Proposed risk mitigation measures',
            items: {
              type: 'object',
              required: ['description', 'effectiveness', 'resourceCost'],
              properties: {
                description: {
                  type: 'string',
                  description: 'Description of the mitigation measure',
                },
                effectiveness: {
                  type: 'string',
                  enum: ['HIGH', 'MEDIUM', 'LOW'],
                  description: 'Expected effectiveness of mitigation',
                },
                resourceCost: {
                  type: 'string',
                  enum: ['HIGH', 'MEDIUM', 'LOW'],
                  description: 'Resource cost to implement',
                },
              },
            },
          },
          assumptions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Assumptions underlying this assessment',
          },
          uncertainties: {
            type: 'array',
            items: { type: 'string' },
            description: 'Areas of uncertainty that may affect assessment accuracy',
          },
          questionsForReviewer: {
            type: 'array',
            items: { type: 'string' },
            description: 'Questions for human reviewer to consider when validating this assessment',
          },
          confidenceScore: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence in assessment quality (0=low, 1=high)',
          },
        },
      },
    };
  }

  /**
   * Generate an AI-assisted risk assessment for an objective
   * @param objective - The strategic objective to assess
   * @param additionalContext - Optional additional context for the assessment
   * @returns AI-generated risk assessment
   */
  async generateAIAssessment(
    objective: StrategicObjective,
    additionalContext?: string
  ): Promise<AIRiskAssessment> {
    // Build the objective description for the LLM
    const objectiveDescription = this.formatObjectiveForAssessment(objective);

    // Build provider-agnostic request
    const request: LLMCompletionRequest = {
      messages: [
        {
          role: 'system',
          content: RISK_ASSESSMENT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Assess the risks for the following strategic objective:

${objectiveDescription}

${additionalContext ? `Additional Context:\n${additionalContext}` : ''}

Generate a comprehensive risk assessment covering risk-to-mission and risk-to-force.`,
        },
      ],
      tools: [this.assessmentTool],
      tool_choice: { type: 'tool', name: 'assess_risk' },
      max_tokens: 4096,
    };

    // Call provider
    const response = await this.provider.complete(request);

    if (!response.tool_use) {
      throw new Error('No tool_use in response - LLM did not use the assess_risk tool');
    }

    // Parse the AI input (cast through unknown for type safety)
    const aiInput = response.tool_use.input as unknown as AIRiskInput;

    // Calculate derived fields using the risk matrix
    const riskToMissionLevel = calculateRiskLevel(
      aiInput.riskToMission.likelihood as Likelihood,
      aiInput.riskToMission.impact as Impact
    );
    const riskToForceLevel = calculateRiskLevel(
      aiInput.riskToForce.likelihood as Likelihood,
      aiInput.riskToForce.impact as Impact
    );
    const residualRisk = combineRiskLevels(riskToMissionLevel, riskToForceLevel);
    const riskDecisionAuthority = getRiskDecisionAuthority(residualRisk);

    // Generate auto-flags
    const autoFlags = this.generateAutoFlags(residualRisk, aiInput);

    // Build the complete AI risk assessment
    const assessment: AIRiskAssessment = {
      id: `RISK-${randomUUID().slice(0, 8)}`,
      objectiveId: objective.id,
      riskToMission: {
        likelihood: aiInput.riskToMission.likelihood as Likelihood,
        impact: aiInput.riskToMission.impact as Impact,
        riskLevel: riskToMissionLevel,
        factors: aiInput.riskToMission.factors,
      },
      riskToForce: {
        likelihood: aiInput.riskToForce.likelihood as Likelihood,
        impact: aiInput.riskToForce.impact as Impact,
        riskLevel: riskToForceLevel,
        factors: aiInput.riskToForce.factors,
      },
      mitigations: aiInput.mitigations.map((m) => ({
        description: m.description,
        effectiveness: m.effectiveness,
        resourceCost: m.resourceCost,
        accepted: false, // Mitigations need human acceptance
      })),
      riskDecision: 'MITIGATE', // Default decision, human can change
      riskDecisionAuthority,
      residualRisk,
      assessedBy: 'AI_AGENT',
      assessedAt: new Date(),
      generatedBy: 'AI_AGENT',
      confidenceScore: aiInput.confidenceScore,
      questionsForReviewer: aiInput.questionsForReviewer,
      autoFlags,
      assumptions: aiInput.assumptions,
      uncertainties: aiInput.uncertainties,
    };

    return assessment;
  }

  /**
   * Create a risk assessment (either AI-generated or from manual input)
   * @param objectiveId - ID of the objective being assessed
   * @param assessedBy - Who is creating the assessment
   * @param input - Optional partial assessment input (if not provided, generates via AI)
   * @returns Complete saved risk assessment
   */
  async createAssessment(
    objectiveId: string,
    assessedBy: string,
    input?: Partial<RiskAssessment>
  ): Promise<RiskAssessment> {
    let assessment: RiskAssessment;

    if (input && input.riskToMission && input.riskToForce) {
      // Use provided input
      const residualRisk = combineRiskLevels(
        input.riskToMission.riskLevel,
        input.riskToForce.riskLevel
      );

      assessment = {
        id: `RISK-${randomUUID().slice(0, 8)}`,
        objectiveId,
        riskToMission: input.riskToMission,
        riskToForce: input.riskToForce,
        mitigations: input.mitigations || [],
        riskDecision: input.riskDecision || 'MITIGATE',
        riskDecisionAuthority: input.riskDecisionAuthority || getRiskDecisionAuthority(residualRisk),
        residualRisk,
        assessedBy,
        assessedAt: new Date(),
      };
    } else {
      // Would need the full objective to generate via AI
      // For now, throw an error - caller should use generateAIAssessment with full objective
      throw new Error(
        'Manual assessment requires riskToMission and riskToForce. For AI generation, use generateAIAssessment.'
      );
    }

    // Save to database
    await this.store.saveAssessment(assessment);

    return assessment;
  }

  /**
   * Save an AI-generated assessment to the database
   * @param assessment - AI-generated assessment
   */
  async saveAIAssessment(assessment: AIRiskAssessment): Promise<void> {
    // Extract AI metadata
    const aiMetadata: Partial<AIRiskAssessment> = {
      generatedBy: assessment.generatedBy,
      confidenceScore: assessment.confidenceScore,
      questionsForReviewer: assessment.questionsForReviewer,
      autoFlags: assessment.autoFlags,
      assumptions: assessment.assumptions,
      uncertainties: assessment.uncertainties,
    };

    await this.store.saveAssessment(assessment, aiMetadata);
  }

  /**
   * Review and optionally modify an assessment
   * @param assessmentId - ID of the assessment to review
   * @param reviewerId - Who is reviewing
   * @param approved - Whether the assessment is approved
   * @param modifications - Optional modifications to apply
   * @returns Updated assessment
   */
  async reviewAssessment(
    assessmentId: string,
    reviewerId: string,
    approved: boolean,
    modifications?: Partial<RiskAssessment>
  ): Promise<RiskAssessment> {
    // Load existing assessment
    const existing = await this.store.getAssessment(assessmentId);
    if (!existing) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }

    // Apply modifications if provided
    let updated = { ...existing };
    if (modifications) {
      updated = {
        ...updated,
        ...modifications,
        id: existing.id, // Preserve ID
        objectiveId: existing.objectiveId, // Preserve objective link
        assessedBy: existing.assessedBy, // Preserve original assessor
        assessedAt: existing.assessedAt, // Preserve original assessment time
      };

      // Recalculate derived fields if risk dimensions changed
      if (modifications.riskToMission || modifications.riskToForce) {
        const riskToMissionLevel = updated.riskToMission.riskLevel;
        const riskToForceLevel = updated.riskToForce.riskLevel;
        updated.residualRisk = combineRiskLevels(riskToMissionLevel, riskToForceLevel);
        updated.riskDecisionAuthority = getRiskDecisionAuthority(updated.residualRisk);
      }
    }

    // Mark as reviewed
    updated.reviewedBy = reviewerId;
    updated.reviewedAt = new Date();

    // Save updated assessment
    await this.store.saveAssessment(updated);

    return updated;
  }

  /**
   * Get an assessment by ID
   */
  async getAssessment(id: string): Promise<RiskAssessment | null> {
    return this.store.getAssessment(id);
  }

  /**
   * Get all assessments for an objective
   */
  async getAssessmentsForObjective(objectiveId: string): Promise<RiskAssessment[]> {
    return this.store.getAssessmentsForObjective(objectiveId);
  }

  /**
   * Get all HIGH/EXTREME risk assessments
   */
  async getHighRiskAssessments(): Promise<RiskAssessment[]> {
    return this.store.getHighRiskAssessments();
  }

  /**
   * Get all unreviewed assessments
   */
  async getUnreviewedAssessments(): Promise<RiskAssessment[]> {
    return this.store.getUnreviewedAssessments();
  }

  /**
   * Format an objective for the assessment prompt
   */
  private formatObjectiveForAssessment(objective: StrategicObjective): string {
    const { ends, ways, means } = objective.endsWaysMeans;
    const parts = [
      `**Objective:** ${objective.description}`,
      '',
      '**Ends (Desired Outcome):**',
      `- ${ends.description}`,
      ends.conditions.length > 0
        ? `- Conditions: ${ends.conditions.join(', ')}`
        : null,
      ends.timeframe ? `- Timeframe: ${ends.timeframe}` : null,
      '',
      '**Ways (Approach):**',
      ...ways.strategies.map((s: string) => `- Strategy: ${s}`),
      ...ways.concepts.map((c: string) => `- Concept: ${c}`),
      ...ways.keyTasks.map((t: string) => `- Key Task: ${t}`),
      '',
      '**Means (Resources):**',
      ...means.forces.map((f: string) => `- Force: ${f}`),
      ...means.capabilities.map((c: string) => `- Capability: ${c}`),
      ...means.resources.map((r: string) => `- Resource: ${r}`),
      '',
      `**DIME Category:** ${objective.primaryInstrument}`,
      objective.supportingInstruments.length > 0
        ? `**Supporting Instruments:** ${objective.supportingInstruments.join(', ')}`
        : null,
      '',
      '**Constraints:**',
      ...objective.constraints.map((c: string) => `- ${c}`),
      '',
      '**Assumptions:**',
      ...objective.assumptions.map((a: string) => `- ${a}`),
    ];

    return parts.filter((p) => p !== null).join('\n');
  }

  /**
   * Generate auto-flags for the assessment
   */
  private generateAutoFlags(residualRisk: RiskLevel, aiInput: AIRiskInput): AutoFlag[] {
    const flags: AutoFlag[] = [];

    // Flag HIGH/EXTREME risk
    if (shouldAutoFlag({ residualRisk })) {
      flags.push({
        flag: 'HIGH_RISK',
        reason: `Residual risk level is ${residualRisk} - requires senior leadership review`,
        severity: residualRisk === 'EXTREME' ? 'CRITICAL' : 'WARNING',
      });
    }

    // Flag low confidence
    if (aiInput.confidenceScore < 0.5) {
      flags.push({
        flag: 'LOW_CONFIDENCE',
        reason: `AI confidence is ${(aiInput.confidenceScore * 100).toFixed(0)}% - manual review strongly recommended`,
        severity: 'WARNING',
      });
    }

    // Flag many uncertainties
    if (aiInput.uncertainties.length >= 3) {
      flags.push({
        flag: 'MULTIPLE_UNCERTAINTIES',
        reason: `${aiInput.uncertainties.length} areas of uncertainty identified - assessment may need additional intelligence`,
        severity: 'INFO',
      });
    }

    // Flag no mitigations proposed
    if (aiInput.mitigations.length === 0 && residualRisk !== 'LOW') {
      flags.push({
        flag: 'NO_MITIGATIONS',
        reason: 'No mitigations proposed for non-LOW risk - consider risk acceptance or avoidance',
        severity: 'WARNING',
      });
    }

    // Flag catastrophic impact
    if (
      aiInput.riskToMission.impact === 'CATASTROPHIC' ||
      aiInput.riskToForce.impact === 'CATASTROPHIC'
    ) {
      flags.push({
        flag: 'CATASTROPHIC_IMPACT',
        reason: 'Catastrophic impact identified - commander notification may be required',
        severity: 'CRITICAL',
      });
    }

    return flags;
  }
}

// Lazy-initialized singleton
let _riskAssessmentService: RiskAssessmentService | null = null;

/**
 * Get the singleton RiskAssessmentService instance
 * Lazy initialization to allow API key configuration via environment
 */
export function getRiskAssessmentService(config?: RiskAssessmentServiceConfig): RiskAssessmentService {
  if (!_riskAssessmentService) {
    _riskAssessmentService = new RiskAssessmentService(config);
  }
  return _riskAssessmentService;
}
