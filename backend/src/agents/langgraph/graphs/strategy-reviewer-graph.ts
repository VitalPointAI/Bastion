/**
 * Strategy Document Reviewer - LangGraph Implementation
 *
 * A state machine that reviews strategic documents using:
 * 1. MIDLIFE categorization for each objective
 * 2. Domain prioritization across objectives
 * 3. Report generation with human-in-the-loop approval
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';

import {
  StrategyReviewerState,
  type StrategyReviewerStateType,
  type CategoryAssessment,
  type PriorityAssessment,
  createEmptyCategoryDistribution,
} from '../state.js';
import { createLLMForAgent } from '../llm-factory.js';
import { categorizeMidlifeTool, prioritizeDomainTool } from '../tools/index.js';
import { objectiveStore } from '../../../strategic/objectives/index.js';
import type { MidlifeCategory } from '../../../strategic/schemas/dime.js';
import type { Priority } from '../../../strategic/schemas/strategic-objective.js';

// ============================================================================
// Agent Configuration
// ============================================================================

const AGENT_ID = 'strategy-document-reviewer';

// System prompt for the reviewer
const REVIEWER_SYSTEM_PROMPT = `You are a Strategy Document Reviewer, an expert in national security strategy analysis.

Your role is to:
1. Analyze strategic objectives using the MIDLIFE framework
2. Assess priority levels based on domain-specific criteria
3. Flag objectives requiring human review

MIDLIFE Framework Categories:
- MILITARY: Armed forces, defense capabilities, force posture, combat operations
- INFORMATION: Communications, media, cyber operations, influence, narrative
- DIPLOMATIC: Foreign relations, treaties, alliances, international cooperation
- LEGAL: International law, domestic law, rules of engagement, jurisdictional matters
- INTELLIGENCE: Collection, analysis, counterintelligence, ISR, reconnaissance
- FINANCIAL: Banking, sanctions, monetary policy, currency, financial warfare
- ECONOMIC: Trade, resources, industrial base, supply chains, economic statecraft

Key Distinctions:
- FINANCIAL vs ECONOMIC: Financial = banking/money; Economic = trade/production
- LEGAL vs DIPLOMATIC: Legal = binding rules; Diplomatic = relationships
- INFORMATION vs INTELLIGENCE: Information = influence; Intelligence = knowledge

Be methodical, precise, and transparent about uncertainty. Always explain your reasoning.`;

// ============================================================================
// Node Functions
// ============================================================================

/**
 * Load objectives from the document.
 */
async function loadObjectives(
  state: StrategyReviewerStateType
): Promise<Partial<StrategyReviewerStateType>> {
  try {
    const objectives = await objectiveStore.getObjectivesForDocument(state.documentId);

    if (objectives.length === 0) {
      return {
        status: 'error',
        error: 'No objectives found in document',
      };
    }

    return {
      objectives: objectives.map(obj => ({
        id: obj.id,
        description: obj.description,
        primaryInstrument: obj.primaryInstrument,
        currentMidlifeCategory: obj.midlifeCategory,
        currentPriority: obj.priority,
        status: obj.status,
      })),
      totalObjectives: objectives.length,
      status: 'analyzing',
      messages: [
        new HumanMessage(`Analyzing document ${state.documentId} with ${objectives.length} objectives.`),
      ],
    };
  } catch (error) {
    return {
      status: 'error',
      error: `Failed to load objectives: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Analyze current objective with MIDLIFE categorization.
 */
async function analyzeObjective(
  state: StrategyReviewerStateType
): Promise<Partial<StrategyReviewerStateType>> {
  const { objectives, currentObjectiveIndex, messages } = state;
  const objective = objectives[currentObjectiveIndex];

  if (!objective) {
    return {
      status: 'prioritizing',
      messages: [new AIMessage('Completed analyzing all objectives. Moving to prioritization.')],
    };
  }

  try {
    // Get LLM for this agent
    const llm = await createLLMForAgent({ agentId: AGENT_ID });

    // Bind the categorization tool (if supported)
    const modelWithTools = 'bindTools' in llm && typeof llm.bindTools === 'function'
      ? llm.bindTools([categorizeMidlifeTool])
      : llm;

    // Create analysis prompt
    const analysisPrompt = `Analyze the following strategic objective and categorize it using the MIDLIFE framework.

Objective ID: ${objective.id}
Description: ${objective.description}
${objective.primaryInstrument ? `Current Instrument: ${objective.primaryInstrument}` : ''}
${objective.currentMidlifeCategory ? `Current MIDLIFE Category: ${objective.currentMidlifeCategory}` : ''}

Use the categorize_midlife tool to analyze this objective. Provide clear reasoning for your categorization.`;

    // Get LLM response with tool call
    const response = await modelWithTools.invoke([
      { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
      ...messages.slice(-5), // Last 5 messages for context
      { role: 'user', content: analysisPrompt },
    ]);

    // Process tool calls if any
    let assessment: CategoryAssessment | null = null;
    const newMessages: (AIMessage | ToolMessage)[] = [response];

    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === 'categorize_midlife') {
          // Execute the tool with the objective data
          const toolInput = {
            objectiveId: objective.id,
            description: objective.description,
            context: objective.primaryInstrument ? { dimeCategory: objective.primaryInstrument } : undefined,
          };
          const toolResult = await categorizeMidlifeTool.invoke(toolInput);
          const parsed = JSON.parse(toolResult);

          // Create assessment
          assessment = {
            objectiveId: objective.id,
            suggestedCategory: parsed.category as MidlifeCategory,
            currentCategory: objective.currentMidlifeCategory,
            confidence: parsed.confidence,
            rationale: parsed.rationale,
            requiresHumanReview: parsed.confidence < 0.7 ||
              (objective.currentMidlifeCategory !== undefined && parsed.category !== objective.currentMidlifeCategory),
          };

          newMessages.push(
            new ToolMessage({
              content: toolResult,
              tool_call_id: toolCall.id || randomUUID(),
            })
          );
        }
      }
    }

    // Fallback if no tool call: create basic assessment from response
    if (!assessment) {
      assessment = {
        objectiveId: objective.id,
        suggestedCategory: objective.currentMidlifeCategory || 'DIPLOMATIC' as MidlifeCategory,
        currentCategory: objective.currentMidlifeCategory,
        confidence: 0.5,
        rationale: 'Unable to determine category - requires human review',
        requiresHumanReview: true,
      };
    }

    return {
      currentObjectiveIndex: currentObjectiveIndex + 1,
      categoryAssessments: [assessment],
      messages: newMessages,
    };
  } catch (error) {
    // On error, create a requires-review assessment and continue
    const assessment: CategoryAssessment = {
      objectiveId: objective.id,
      suggestedCategory: objective.currentMidlifeCategory || 'DIPLOMATIC' as MidlifeCategory,
      currentCategory: objective.currentMidlifeCategory,
      confidence: 0,
      rationale: `Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      requiresHumanReview: true,
    };

    return {
      currentObjectiveIndex: currentObjectiveIndex + 1,
      categoryAssessments: [assessment],
      messages: [
        new AIMessage(`Error analyzing objective ${objective.id}, flagging for human review.`),
      ],
    };
  }
}

/**
 * Prioritize objectives using domain prioritization.
 */
async function prioritizeObjectives(
  state: StrategyReviewerStateType
): Promise<Partial<StrategyReviewerStateType>> {
  const { objectives, messages } = state;

  try {
    // Get LLM for this agent
    const llm = await createLLMForAgent({ agentId: AGENT_ID });
    const modelWithTools = 'bindTools' in llm && typeof llm.bindTools === 'function'
      ? llm.bindTools([prioritizeDomainTool])
      : llm;

    // Prepare objectives for prioritization
    const objectivesForPrioritize = objectives.map(obj => ({
      id: obj.id,
      description: obj.description,
      currentPriority: obj.currentPriority,
      metadata: { instrument: obj.primaryInstrument },
    }));

    const prioritizePrompt = `Prioritize the following ${objectives.length} strategic objectives using the strategic domain criteria.

Consider:
- Impact on strategic goals
- Urgency and time-sensitivity
- Feasibility of achievement
- Risk factors
- Dependencies between objectives

Use the prioritize_domain tool with domain='strategic' to analyze these objectives.`;

    // Get LLM response
    const response = await modelWithTools.invoke([
      { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
      ...messages.slice(-5),
      { role: 'user', content: prioritizePrompt },
    ]);

    // Process tool calls
    let priorityAssessments: PriorityAssessment[] = [];
    const newMessages: (AIMessage | ToolMessage)[] = [response];

    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === 'prioritize_domain') {
          // Execute tool with prepared objectives
          const toolInput = {
            objectives: objectivesForPrioritize,
            domain: 'strategic' as const,
          };
          const toolResult = await prioritizeDomainTool.invoke(toolInput);
          const parsed = JSON.parse(toolResult);

          // Map results to assessments
          if (parsed.rankedObjectives) {
            priorityAssessments = parsed.rankedObjectives.map((ranked: {
              id: string;
              score: number;
              priority: Priority;
              rationale: string;
            }) => {
              const original = objectives.find(o => o.id === ranked.id);
              return {
                objectiveId: ranked.id,
                suggestedPriority: ranked.priority || mapScoreToPriority(ranked.score),
                currentPriority: original?.currentPriority || ('ROUTINE' as Priority),
                score: ranked.score,
                rationale: ranked.rationale || `Priority score: ${ranked.score}`,
              };
            });
          }

          newMessages.push(
            new ToolMessage({
              content: toolResult,
              tool_call_id: toolCall.id || randomUUID(),
            })
          );
        }
      }
    }

    // Fallback if no assessments from tool
    if (priorityAssessments.length === 0) {
      priorityAssessments = objectives.map(obj => ({
        objectiveId: obj.id,
        suggestedPriority: obj.currentPriority || ('MEDIUM' as Priority),
        currentPriority: obj.currentPriority || ('MEDIUM' as Priority),
        score: 0.5,
        rationale: 'Unable to prioritize - requires human review',
      }));
    }

    return {
      status: 'building_report',
      priorityAssessments,
      messages: newMessages,
    };
  } catch (error) {
    // On error, create default assessments
    const priorityAssessments = objectives.map(obj => ({
      objectiveId: obj.id,
      suggestedPriority: obj.currentPriority || ('MEDIUM' as Priority),
      currentPriority: obj.currentPriority || ('MEDIUM' as Priority),
      score: 0,
      rationale: `Prioritization error: ${error instanceof Error ? error.message : 'Unknown'}`,
    }));

    return {
      status: 'building_report',
      priorityAssessments,
      messages: [
        new AIMessage(`Error during prioritization, using current priorities.`),
      ],
    };
  }
}

/**
 * Build the final review report.
 */
async function buildReport(
  state: StrategyReviewerStateType
): Promise<Partial<StrategyReviewerStateType>> {
  const { documentId, categoryAssessments, priorityAssessments, objectives } = state;

  // Calculate category distribution
  const distribution = createEmptyCategoryDistribution();
  for (const assessment of categoryAssessments) {
    distribution[assessment.suggestedCategory]++;
  }

  // Calculate coherence score (percentage of high-confidence categorizations)
  const highConfidenceCount = categoryAssessments.filter(a => a.confidence >= 0.7).length;
  const coherenceScore = Math.round((highConfidenceCount / categoryAssessments.length) * 100);

  // Generate flags
  const flags: string[] = [];
  const humanReviewNeeded = categoryAssessments.filter(a => a.requiresHumanReview);
  if (humanReviewNeeded.length > 0) {
    flags.push(`${humanReviewNeeded.length} objectives require human review`);
  }
  const categoryChanges = categoryAssessments.filter(
    a => a.currentCategory && a.suggestedCategory !== a.currentCategory
  );
  if (categoryChanges.length > 0) {
    flags.push(`${categoryChanges.length} category change suggestions`);
  }
  const priorityChanges = priorityAssessments.filter(
    a => a.suggestedPriority !== a.currentPriority
  );
  if (priorityChanges.length > 0) {
    flags.push(`${priorityChanges.length} priority change suggestions`);
  }

  const report = {
    id: randomUUID(),
    documentId,
    reviewedAt: new Date(),
    reviewedBy: `did:agent:${AGENT_ID}`,
    categoryAssessments,
    priorityAssessments,
    documentSummary: {
      totalObjectives: objectives.length,
      categoryDistribution: distribution,
      coherenceScore,
      flags,
    },
    status: 'pending_review' as const,
  };

  return {
    report,
    status: 'complete',
    messages: [
      new AIMessage(
        `Review complete. Analyzed ${objectives.length} objectives. ` +
        `${humanReviewNeeded.length} require human review. Coherence score: ${coherenceScore}%.`
      ),
    ],
  };
}

/**
 * Map numeric score to Priority enum.
 */
function mapScoreToPriority(score: number): Priority {
  if (score >= 0.8) return 'CRITICAL';
  if (score >= 0.6) return 'HIGH';
  if (score >= 0.4) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// Routing Functions
// ============================================================================

/**
 * Route after loading objectives.
 */
function routeAfterLoad(state: StrategyReviewerStateType): string {
  if (state.status === 'error') {
    return END;
  }
  return 'analyze_objective';
}

/**
 * Route after analyzing an objective.
 */
function routeAfterAnalyze(state: StrategyReviewerStateType): string {
  if (state.currentObjectiveIndex >= state.totalObjectives) {
    return 'prioritize';
  }
  return 'analyze_objective';
}

/**
 * Route after prioritization.
 */
function _routeAfterPrioritize(_state: StrategyReviewerStateType): string {
  return 'build_report';
}

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Create the Strategy Reviewer LangGraph.
 */
export function createStrategyReviewerGraph() {
  const workflow = new StateGraph(StrategyReviewerState)
    // Add nodes
    .addNode('load_objectives', loadObjectives)
    .addNode('analyze_objective', analyzeObjective)
    .addNode('prioritize', prioritizeObjectives)
    .addNode('build_report', buildReport)

    // Add edges
    .addEdge(START, 'load_objectives')
    .addConditionalEdges('load_objectives', routeAfterLoad)
    .addConditionalEdges('analyze_objective', routeAfterAnalyze)
    .addEdge('prioritize', 'build_report')
    .addEdge('build_report', END);

  return workflow.compile();
}

/**
 * Execute a strategy review for a document.
 */
export async function executeStrategyReview(documentId: string) {
  const graph = createStrategyReviewerGraph();

  const initialState = {
    documentId,
    objectives: [],
    messages: [],
    categoryAssessments: [],
    priorityAssessments: [],
    currentObjectiveIndex: 0,
    totalObjectives: 0,
    report: null,
    status: 'loading' as const,
    error: null,
  };

  const result = await graph.invoke(initialState);
  return result;
}
