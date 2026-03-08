/**
 * AI Suggestion Service
 *
 * Phase 37 Plan 06: LLM-based AAR observation and METL rating suggestions.
 * Uses inline LLM calls (simpler than full staff agent pipeline) to:
 * 1. Suggest sustain/improve observations for AARs based on planned vs actual
 * 2. Suggest T/P/U METL ratings based on linked AAR observations
 */

import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import type { StructuredAAR, AARObservation, METLTask } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ObservationSuggestion {
  observationType: 'sustain' | 'improve';
  content: string;
  metlTaskId: string;
}

export interface RatingSuggestion {
  metlTaskId: string;
  suggestedRating: 'T' | 'P' | 'U';
  rationale: string;
}

// ============================================================================
// Prompts
// ============================================================================

function buildObservationPrompt(aar: StructuredAAR, metlTasks: METLTask[]): string {
  const taskList = metlTasks
    .map((t) => `- ID: ${t.id} | Name: ${t.taskName}${t.competencyArea ? ` | Area: ${t.competencyArea}` : ''}`)
    .join('\n');

  return `Analyze this After-Action Review and generate sustain and improve observations.

## AAR Context

**Training Event:** ${aar.trainingEventName}

**What Was Planned:**
${aar.whatWasPlanned || '(not provided)'}

**What Happened:**
${aar.whatHappened || '(not provided)'}

**Why (Analysis):**
${aar.why || '(not provided)'}

## METL Tasks
${taskList || '(no tasks defined)'}

## Instructions
Based on the planned vs actual outcomes, generate sustain (things done well) and improve (things needing improvement) observations. Each observation MUST be linked to a specific METL task ID from the list above. If no METL tasks are defined, use an empty string for metlTaskId.

Generate 2-4 sustain and 2-4 improve observations. Each observation should be concise (1-2 sentences) and actionable.

Respond ONLY with a JSON array in this exact format:
[
  { "observationType": "sustain", "content": "...", "metlTaskId": "METL-..." },
  { "observationType": "improve", "content": "...", "metlTaskId": "METL-..." }
]`;
}

function buildRatingPrompt(metlTasks: METLTask[], observations: AARObservation[]): string {
  const taskList = metlTasks
    .map((t) => `- ID: ${t.id} | Name: ${t.taskName}${t.competencyArea ? ` | Area: ${t.competencyArea}` : ''}`)
    .join('\n');

  const obsList = observations
    .map((o) => `- [${o.observationType.toUpperCase()}] ${o.content}${o.metlTaskId ? ` (linked to ${o.metlTaskId})` : ''}`)
    .join('\n');

  return `Based on these AAR observations linked to METL tasks, suggest a proficiency rating for each task.

## METL Tasks
${taskList}

## AAR Observations
${obsList || '(no observations)'}

## Instructions
For each METL task, suggest a proficiency rating:
- T = Trained (fully meets standard, tasks executed to standard with minimal deviation)
- P = Practiced (partially meets standard, some tasks completed but with notable shortfalls)
- U = Untrained (does not meet standard, significant gaps in execution)

Consider both sustain and improve observations linked to each task. Tasks with mostly sustain observations trend toward T; tasks with mostly improve observations trend toward U.

Respond ONLY with a JSON array in this exact format:
[
  { "metlTaskId": "METL-...", "suggestedRating": "T", "rationale": "Brief explanation..." }
]`;
}

// ============================================================================
// Service
// ============================================================================

const OBSERVATION_SYSTEM_PROMPT =
  'You are a military Observer/Controller analyzing an After-Action Review. ' +
  'Based on the planned vs actual outcomes, generate sustain and improve observations. ' +
  'Each observation MUST be linked to a specific METL task ID. Format as JSON array.';

const RATING_SYSTEM_PROMPT =
  'Based on these AAR observations linked to METL tasks, suggest a proficiency rating ' +
  '(T=Trained/fully meets standard, P=Practiced/partially meets standard, U=Untrained/does not meet standard) ' +
  'for each task. Provide brief rationale.';

class AISuggestionService {
  /**
   * Suggest sustain/improve observations for an AAR based on its content and METL tasks.
   */
  async suggestObservations(
    aar: StructuredAAR,
    metlTasks: METLTask[],
  ): Promise<ObservationSuggestion[]> {
    const llm = await this.getLLM();
    const prompt = buildObservationPrompt(aar, metlTasks);

    try {
      const response = await llm.invoke([
        { role: 'system', content: OBSERVATION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ]);

      const text = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const suggestions = this.parseJSONArray<ObservationSuggestion>(text);

      // Validate each suggestion
      const validTaskIds = new Set(metlTasks.map((t) => t.id));
      return suggestions.filter((s) => {
        const validType = s.observationType === 'sustain' || s.observationType === 'improve';
        const hasContent = typeof s.content === 'string' && s.content.trim().length > 0;
        const validTaskRef = !s.metlTaskId || s.metlTaskId === '' || validTaskIds.has(s.metlTaskId);
        return validType && hasContent && validTaskRef;
      });
    } catch (error) {
      console.error('[ai-suggestion] Failed to generate observation suggestions:', error);
      return [];
    }
  }

  /**
   * Suggest T/P/U ratings for METL tasks based on linked AAR observations.
   */
  async suggestRatings(
    metlTasks: METLTask[],
    observations: AARObservation[],
  ): Promise<RatingSuggestion[]> {
    const llm = await this.getLLM();
    const prompt = buildRatingPrompt(metlTasks, observations);

    try {
      const response = await llm.invoke([
        { role: 'system', content: RATING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ]);

      const text = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const suggestions = this.parseJSONArray<RatingSuggestion>(text);

      // Validate each suggestion
      const validTaskIds = new Set(metlTasks.map((t) => t.id));
      const validRatings = new Set(['T', 'P', 'U']);
      return suggestions.filter((s) => {
        return (
          validTaskIds.has(s.metlTaskId) &&
          validRatings.has(s.suggestedRating) &&
          typeof s.rationale === 'string' &&
          s.rationale.trim().length > 0
        );
      });
    } catch (error) {
      console.error('[ai-suggestion] Failed to generate rating suggestions:', error);
      return [];
    }
  }

  /**
   * Get LLM instance for assessment AI.
   * Falls back gracefully if 'assessment-observer' agent config doesn't exist.
   */
  private async getLLM() {
    try {
      return await createLLMForAgent({
        agentId: 'assessment-observer',
        overrides: { temperature: 0.3, maxTokens: 2048 },
      });
    } catch (error) {
      console.warn(
        '[ai-suggestion] Could not create LLM for assessment-observer agent, using default config:',
        error,
      );
      // Fallback: try with a generic agent ID that uses global defaults
      return await createLLMForAgent({
        agentId: 'default',
        overrides: { temperature: 0.3, maxTokens: 2048 },
      });
    }
  }

  /**
   * Parse a JSON array from LLM text response, handling markdown code blocks.
   */
  private parseJSONArray<T>(text: string): T[] {
    // Strip markdown code blocks if present
    let cleaned = text.trim();
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
      console.warn('[ai-suggestion] LLM response was not an array:', typeof parsed);
      return [];
    } catch {
      console.error('[ai-suggestion] Failed to parse LLM JSON response:', cleaned.substring(0, 200));
      return [];
    }
  }
}

/** Singleton AI suggestion service */
export const aiSuggestionService = new AISuggestionService();
