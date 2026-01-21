/**
 * Strategy Document Review Agent Executor
 *
 * Implements the review workflow for strategic documents.
 * Uses MCP tools to analyze objectives and generate review reports.
 */

import { randomUUID } from 'crypto';
import {
  STRATEGY_REVIEWER_MANIFEST,
  type StrategyReviewReport,
  type CategoryAssessment,
  type PriorityAssessment,
  type DocumentSummary,
  createEmptyCategoryDistribution,
} from './strategy-reviewer.js';
import { getMidlifeCategorizer } from '../tools/midlife-categorizer.js';
import { getDomainPrioritizer } from '../tools/domain-prioritizer.js';
import { objectiveStore } from '../objectives/index.js';
import type { MidlifeCategory } from '../schemas/dime.js';
import { executeStrategyReview } from '../../agents/langgraph/graphs/strategy-reviewer-graph.js';
import { configService } from '../config/service.js';

/**
 * Review options for execution.
 */
export interface ReviewOptions {
  /** Confidence threshold below which to flag for human review */
  confidenceThreshold?: number;
  /** Domain for prioritization (default: strategic) */
  prioritizationDomain?: 'strategic' | 'operational' | 'tactical' | 'resource';
  /** Whether to only review objectives without existing MIDLIFE category */
  onlyUncategorized?: boolean;
  /** Use LangGraph-based review (with LLM reasoning) instead of rule-based */
  useLangGraph?: boolean;
}

/**
 * Default review options.
 */
const DEFAULT_OPTIONS: ReviewOptions = {
  confidenceThreshold: 0.7,
  prioritizationDomain: 'strategic',
  onlyUncategorized: false,
  useLangGraph: false, // Default to rule-based for backward compatibility
};

/**
 * Strategy Reviewer Executor
 *
 * Executes the document review workflow:
 * 1. Load document and its objectives
 * 2. For each objective, call categorize-midlife tool
 * 3. Call prioritize-domain on all objectives
 * 4. Generate review report with suggestions
 */
export class StrategyReviewerExecutor {
  private readonly agentId = STRATEGY_REVIEWER_MANIFEST.agentId;
  private readonly agentDID: string;

  constructor(agentDID?: string) {
    this.agentDID = agentDID || `did:near:agent:${this.agentId}`;
  }

  /**
   * Review a document and generate a review report.
   *
   * Supports two modes:
   * - Rule-based (default): Uses deterministic tools directly
   * - LangGraph (useLangGraph: true): Uses LLM-powered graph with reasoning
   */
  async reviewDocument(
    documentId: string,
    options: ReviewOptions = {}
  ): Promise<StrategyReviewReport> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Check if LangGraph mode should be used
    // Either explicitly requested or enabled in config
    const llmConfig = await configService.getLLMConfig();
    const useLangGraph = opts.useLangGraph || llmConfig.useLangGraphReview;

    if (useLangGraph) {
      return this.reviewDocumentWithLangGraph(documentId, opts);
    }

    return this.reviewDocumentRuleBased(documentId, opts);
  }

  /**
   * Review using LangGraph-powered agent with LLM reasoning.
   */
  private async reviewDocumentWithLangGraph(
    documentId: string,
    opts: ReviewOptions
  ): Promise<StrategyReviewReport> {
    console.log(`[${this.agentId}] Starting LangGraph review of document ${documentId}`);

    try {
      const result = await executeStrategyReview(documentId);

      if (result.status === 'error') {
        console.error(`[${this.agentId}] LangGraph review failed: ${result.error}`);
        // Fallback to rule-based if LangGraph fails
        console.log(`[${this.agentId}] Falling back to rule-based review`);
        return this.reviewDocumentRuleBased(documentId, opts);
      }

      if (result.report) {
        console.log(`[${this.agentId}] LangGraph review complete. Report ID: ${result.report.id}`);
        return result.report;
      }

      // If no report but no error, generate one from state
      const reportId = randomUUID();
      const report: StrategyReviewReport = {
        id: reportId,
        documentId,
        reviewedAt: new Date(),
        reviewedBy: this.agentDID,
        categoryAssessments: result.categoryAssessments || [],
        priorityAssessments: result.priorityAssessments || [],
        documentSummary: {
          totalObjectives: result.totalObjectives || 0,
          categoryDistribution: createEmptyCategoryDistribution(),
          coherenceScore: 0,
          flags: ['Review completed without full report - check logs'],
        },
        status: 'pending_review',
      };

      return report;
    } catch (error) {
      console.error(`[${this.agentId}] LangGraph error:`, error);
      console.log(`[${this.agentId}] Falling back to rule-based review`);
      return this.reviewDocumentRuleBased(documentId, opts);
    }
  }

  /**
   * Review using deterministic rule-based tools (original implementation).
   */
  private async reviewDocumentRuleBased(
    documentId: string,
    opts: ReviewOptions
  ): Promise<StrategyReviewReport> {
    const reportId = randomUUID();

    console.log(`[${this.agentId}] Starting rule-based review of document ${documentId}`);

    // Load objectives for the document
    const objectives = await objectiveStore.getObjectivesForDocument(documentId);

    if (objectives.length === 0) {
      console.log(`[${this.agentId}] No objectives found for document ${documentId}`);
      return this.createEmptyReport(reportId, documentId);
    }

    console.log(`[${this.agentId}] Found ${objectives.length} objectives to review`);

    // Filter objectives if only reviewing uncategorized
    const objectivesToReview = opts.onlyUncategorized
      ? objectives.filter(obj => !obj.midlifeCategory || obj.midlifeConfidence === undefined || obj.midlifeConfidence < opts.confidenceThreshold!)
      : objectives;

    // Run MIDLIFE categorization on each objective
    const categoryAssessments: CategoryAssessment[] = [];
    const categorizer = getMidlifeCategorizer();

    for (const objective of objectivesToReview) {
      const result = categorizer.categorize({
        objectiveId: objective.id,
        description: objective.description,
        context: {
          dimeCategory: objective.primaryInstrument,
        },
      });

      const assessment: CategoryAssessment = {
        objectiveId: objective.id,
        suggestedCategory: result.category,
        currentCategory: objective.midlifeCategory,
        confidence: result.confidence,
        rationale: result.rationale,
        requiresHumanReview: result.confidence < opts.confidenceThreshold!,
      };

      categoryAssessments.push(assessment);

      console.log(
        `[${this.agentId}] Categorized ${objective.id}: ${result.category} (${Math.round(result.confidence * 100)}% confidence)`
      );
    }

    // Run domain prioritization on all objectives
    const prioritizer = getDomainPrioritizer();
    const prioritizeInput = {
      objectives: objectives.map(obj => ({
        id: obj.id,
        description: obj.description,
        currentPriority: obj.priority,
        metadata: {
          primaryInstrument: obj.primaryInstrument,
          status: obj.status,
        },
      })),
      domain: opts.prioritizationDomain!,
    };

    const priorityResult = prioritizer.prioritize(prioritizeInput);

    const priorityAssessments: PriorityAssessment[] = priorityResult.rankedObjectives.map(ranked => {
      const original = objectives.find(o => o.id === ranked.id);
      return {
        objectiveId: ranked.id,
        suggestedPriority: ranked.recommendedPriority,
        currentPriority: original?.priority || 'MEDIUM',
        score: ranked.score,
        rationale: ranked.rationale,
      };
    });

    // Build document summary
    const documentSummary = this.buildDocumentSummary(
      objectives,
      categoryAssessments,
      priorityAssessments,
      opts.confidenceThreshold!
    );

    // Create and return report
    const report: StrategyReviewReport = {
      id: reportId,
      documentId,
      reviewedAt: new Date(),
      reviewedBy: this.agentDID,
      categoryAssessments,
      priorityAssessments,
      documentSummary,
      status: 'pending_review',
    };

    console.log(`[${this.agentId}] Review complete. Report ID: ${reportId}`);
    console.log(
      `[${this.agentId}] Summary: ${documentSummary.totalObjectives} objectives, ` +
      `coherence score: ${documentSummary.coherenceScore}, ` +
      `${documentSummary.flags.length} flags`
    );

    return report;
  }

  /**
   * Build document summary from assessments.
   */
  private buildDocumentSummary(
    objectives: Array<{ id: string; midlifeCategory?: MidlifeCategory }>,
    categoryAssessments: CategoryAssessment[],
    priorityAssessments: PriorityAssessment[],
    confidenceThreshold: number
  ): DocumentSummary {
    // Count category distribution (using suggested categories)
    const categoryDistribution = createEmptyCategoryDistribution();
    for (const assessment of categoryAssessments) {
      categoryDistribution[assessment.suggestedCategory]++;
    }

    // Also count existing categories for objectives not in review
    for (const obj of objectives) {
      const wasReviewed = categoryAssessments.some(a => a.objectiveId === obj.id);
      if (!wasReviewed && obj.midlifeCategory) {
        categoryDistribution[obj.midlifeCategory]++;
      }
    }

    // Calculate coherence score
    // Higher diversity of categories = lower coherence (too broad)
    // Single dominant category = higher coherence
    const totalCategorized = Object.values(categoryDistribution).reduce((a, b) => a + b, 0);
    const maxCategory = Math.max(...Object.values(categoryDistribution));
    const dominance = totalCategorized > 0 ? maxCategory / totalCategorized : 0;

    // Count how many categories have objectives
    const activeCategories = Object.values(categoryDistribution).filter(c => c > 0).length;

    // Coherence: balance between having focus (dominance) but not too narrow (need some diversity)
    // Score 100 if one dominant category with 1-2 supporting
    // Score lower if too scattered or too narrow
    let coherenceScore: number;
    if (totalCategorized === 0) {
      coherenceScore = 0;
    } else if (activeCategories === 1) {
      coherenceScore = 70; // Too narrow
    } else if (activeCategories === 2) {
      coherenceScore = dominance > 0.6 ? 90 : 80;
    } else if (activeCategories <= 4) {
      coherenceScore = dominance > 0.5 ? 85 : 70;
    } else {
      coherenceScore = dominance > 0.4 ? 60 : 40; // Too scattered
    }

    // Build flags
    const flags: string[] = [];

    // Flag low confidence assessments
    const lowConfidenceCount = categoryAssessments.filter(
      a => a.confidence < confidenceThreshold
    ).length;
    if (lowConfidenceCount > 0) {
      flags.push(`${lowConfidenceCount} objectives have low confidence categorization (< ${confidenceThreshold * 100}%)`);
    }

    // Flag category changes
    const categoryChanges = categoryAssessments.filter(
      a => a.currentCategory && a.currentCategory !== a.suggestedCategory
    ).length;
    if (categoryChanges > 0) {
      flags.push(`${categoryChanges} objectives have suggested category changes`);
    }

    // Flag priority changes
    const priorityChanges = priorityAssessments.filter(
      a => a.currentPriority !== a.suggestedPriority
    ).length;
    if (priorityChanges > 0) {
      flags.push(`${priorityChanges} objectives have suggested priority changes`);
    }

    // Flag if too scattered
    if (activeCategories > 5 && totalCategorized > 3) {
      flags.push('Document objectives span many categories - consider if this is intentional');
    }

    // Flag if missing key categories
    if (categoryDistribution.MILITARY === 0 && categoryDistribution.DIPLOMATIC === 0) {
      flags.push('No MILITARY or DIPLOMATIC objectives - unusual for strategic documents');
    }

    return {
      totalObjectives: objectives.length,
      categoryDistribution,
      coherenceScore: Math.round(coherenceScore),
      flags,
    };
  }

  /**
   * Create an empty report when no objectives exist.
   */
  private createEmptyReport(reportId: string, documentId: string): StrategyReviewReport {
    return {
      id: reportId,
      documentId,
      reviewedAt: new Date(),
      reviewedBy: this.agentDID,
      categoryAssessments: [],
      priorityAssessments: [],
      documentSummary: {
        totalObjectives: 0,
        categoryDistribution: createEmptyCategoryDistribution(),
        coherenceScore: 0,
        flags: ['No objectives found in document'],
      },
      status: 'pending_review',
    };
  }

  /**
   * Get agent ID.
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get agent DID.
   */
  getAgentDID(): string {
    return this.agentDID;
  }
}

// Singleton instance
let executorInstance: StrategyReviewerExecutor | null = null;

/**
 * Get or create the strategy reviewer executor singleton.
 */
export function getStrategyReviewerExecutor(agentDID?: string): StrategyReviewerExecutor {
  if (!executorInstance) {
    executorInstance = new StrategyReviewerExecutor(agentDID);
  }
  return executorInstance;
}
