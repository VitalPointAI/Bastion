/**
 * Extraction Service
 * LLM-powered extraction of strategic objectives with multi-provider support
 *
 * Supports: Anthropic Claude, OpenAI, NEAR AI, Ollama, LocalAI, vLLM, Azure OpenAI, Bedrock
 * Uses tool_use/function_calling for structured output extraction.
 */

import {
  ChunkExtractionResultSchema,
} from './schemas.js';
import type {
  ChunkExtractionResult,
  DocumentExtractionResult,
  ExtractionAuditEntry,
  ExtractionConfig,
  ExtractionResult,
  ExtractedObjective,
  ExtractionProgressCallback,
  ExtractionProgress,
} from './types.js';
import { DocumentParser } from '../ingestion/document-parser.js';
import { createProvider, getDefaultConfig } from './providers/index.js';
import type { LLMProvider, LLMCompletionRequest, LLMToolDefinition } from './providers/types.js';

/**
 * Default extraction configuration
 */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  chunkSize: 8000,
};

/**
 * System prompt for strategic objective extraction
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a strategic planning analyst extracting strategic objectives, goals, and aims from strategic and planning documents of all types (national security strategies, research proposals, project proposals, policy papers, operational plans, etc.).

First, identify the document type (national security strategy, research proposal, project proposal, policy paper, operational plan, or other). Adapt your extraction approach accordingly. For non-military documents, map content to DIME/MIDLIFE categories on a best-effort basis using the closest applicable category.

Objectives can take many forms depending on document type:
- National security documents: Strategic objectives, national interests, defense priorities
- Research proposals: Research goals, research objectives, expected outcomes, deliverables
- Project proposals: Project goals, milestones, deliverables, success criteria
- Policy papers: Policy goals, recommended actions, desired outcomes
- General: Any stated goal, aim, objective, outcome, or deliverable

Apply the DIME framework to categorize each objective:
- DIPLOMATIC: Foreign policy, alliances, negotiations, treaties, international cooperation
- INFORMATIONAL: Communications, influence, information warfare, public diplomacy, strategic messaging
- MILITARY: Armed forces, defense operations, military capabilities, force posture
- ECONOMIC: Trade, sanctions, financial instruments, economic statecraft

Apply the MIDLIFE framework (expanded categorization) for each objective:
- MILITARY: Armed forces, defense capabilities, military operations, force posture
- INFORMATION: Communications, media, cyber operations, public affairs, influence
- DIPLOMATIC: Foreign relations, treaties, alliances, negotiations, international cooperation
- LEGAL: International law, domestic law, rules of engagement, legal frameworks
- INTELLIGENCE: Collection, analysis, counterintelligence, reconnaissance
- FINANCIAL: Banking, sanctions, monetary policy, financial instruments
- ECONOMIC: Trade, resources, development, industrial base, economic statecraft

MIDLIFE Categorization Guidance:
- Legal: Look for mentions of law, legal authority, treaties as binding documents, rules of engagement
- Intelligence: Look for collection, surveillance, reconnaissance, analysis, counterintelligence
- Financial: Look for banking, sanctions specifically for financial instruments, monetary policy
- When DIME category is ECONOMIC, distinguish between Financial (banking/monetary) and Economic (trade/resources)
- When DIME category is INFORMATIONAL, map to INFORMATION in MIDLIFE
- Provide confidence score (0-1) for MIDLIFE categorization based on clarity of language

Apply Ends-Ways-Means doctrine:
- Ends: The desired outcome or end state - what success looks like
- Ways: Strategies, concepts, methods to achieve the ends - how we get there
- Means: Resources (forces, materiel, funding) required - what we need

Rules:
1. Extract objectives that are clearly stated or strongly implied by the document's structure and language. Include goals, aims, research questions (reframed as objectives), deliverables, and desired outcomes. Do NOT fabricate objectives that have no textual basis.
2. Provide exact source reference (page, section, paragraph) for traceability
3. Assess priority based on document language ("critical", "vital", "essential", "important") and positioning
4. Note constraints and assumptions as stated in the document
5. If uncertain about DIME category, choose most applicable based on primary focus
6. Assign sequential IDs in format OBJ-001, OBJ-002, etc.
7. Be thorough but precise - capture all stated objectives, avoid fabrication
8. For MIDLIFE, choose the most specific category - Legal, Intelligence, Financial if clearly applicable

If the document does not contain traditional strategic objectives, extract the document's stated goals, aims, outcomes, or deliverables as objectives. Use the DIME category that best fits each item, defaulting to INFORMATIONAL for academic/research goals that don't clearly map to another category.

You MUST use the extract_objectives tool to provide your response in the required structured format. If tool use is not available, respond with ONLY a valid JSON object matching this exact structure (no markdown, no explanation):
{"objectives": [...], "chunkSummary": "...", "extractionConfidence": 0.0}`;

/**
 * ExtractionService handles LLM-powered extraction of strategic objectives
 */
export class ExtractionService {
  private provider: LLMProvider;
  private maxRetries: number;
  private chunkSize: number;
  private documentParser: DocumentParser;
  private extractionTool: LLMToolDefinition;

  constructor(config: ExtractionConfig = {}) {
    // Create provider from config or use Anthropic as default
    const providerConfig = config.provider || getDefaultConfig('anthropic');
    this.provider = createProvider(providerConfig);

    // Set config with defaults
    this.maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
    this.chunkSize = config.chunkSize ?? DEFAULT_CONFIG.chunkSize;

    // Document parser for chunking
    this.documentParser = new DocumentParser();

    // Create the extraction tool
    this.extractionTool = this.createExtractionTool();
  }

  /**
   * Create the extraction tool definition with JSON Schema
   * Manually defined to avoid Zod 4.x compatibility issues with zod-to-json-schema
   */
  private createExtractionTool(): LLMToolDefinition {
    return {
      name: 'extract_objectives',
      description:
        'Extract strategic objectives from document text. Use this tool to provide structured extraction results.',
      input_schema: {
        type: 'object',
        required: ['objectives', 'chunkSummary', 'extractionConfidence'],
        properties: {
          objectives: {
            type: 'array',
            description: 'All strategic objectives found in this chunk',
            items: {
              type: 'object',
              required: [
                'id',
                'description',
                'ends',
                'ways',
                'means',
                'dimeCategory',
                'midlifeCategory',
                'midlifeConfidence',
                'priority',
                'constraints',
                'assumptions',
                'risks',
                'sourceReference',
              ],
              properties: {
                id: {
                  type: 'string',
                  description: 'Unique identifier for this objective, format: OBJ-{sequential number starting from 001}',
                },
                description: {
                  type: 'string',
                  description: 'Full text of the strategic objective as stated in the document',
                },
                ends: {
                  type: 'object',
                  description: 'The desired outcome (Ends) - what we want to achieve',
                  required: ['description', 'conditions'],
                  properties: {
                    description: { type: 'string', description: 'The desired end state or outcome' },
                    conditions: { type: 'array', items: { type: 'string' }, description: 'Conditions for success' },
                    timeframe: { type: 'string', description: 'When this should be achieved' },
                  },
                },
                ways: {
                  type: 'object',
                  description: 'The approach (Ways) - how we will achieve the ends',
                  required: ['strategies', 'concepts', 'keyTasks'],
                  properties: {
                    strategies: { type: 'array', items: { type: 'string' }, description: 'Broad strategies' },
                    concepts: { type: 'array', items: { type: 'string' }, description: 'Operational concepts' },
                    keyTasks: { type: 'array', items: { type: 'string' }, description: 'Specific tasks' },
                  },
                },
                means: {
                  type: 'object',
                  description: 'The resources (Means) - what we need',
                  required: ['forces', 'capabilities', 'resources'],
                  properties: {
                    forces: { type: 'array', items: { type: 'string' }, description: 'Military or personnel forces' },
                    capabilities: { type: 'array', items: { type: 'string' }, description: 'Required capabilities' },
                    resources: { type: 'array', items: { type: 'string' }, description: 'Material/financial resources' },
                  },
                },
                dimeCategory: {
                  type: 'string',
                  enum: ['DIPLOMATIC', 'INFORMATIONAL', 'MILITARY', 'ECONOMIC'],
                  description: 'Primary DIME category',
                },
                supportingDIME: {
                  type: 'array',
                  items: { type: 'string', enum: ['DIPLOMATIC', 'INFORMATIONAL', 'MILITARY', 'ECONOMIC'] },
                  description: 'Secondary DIME instruments',
                  default: [],
                },
                midlifeCategory: {
                  type: 'string',
                  enum: ['MILITARY', 'INFORMATION', 'DIPLOMATIC', 'LEGAL', 'INTELLIGENCE', 'FINANCIAL', 'ECONOMIC'],
                  description: 'MIDLIFE category: MILITARY (armed forces), INFORMATION (comms, cyber), DIPLOMATIC (foreign relations), LEGAL (law, rules), INTELLIGENCE (collection, analysis), FINANCIAL (banking, sanctions), ECONOMIC (trade, resources)',
                },
                midlifeConfidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Confidence score (0-1) for MIDLIFE categorization. Higher when language clearly indicates category.',
                },
                priority: {
                  type: 'string',
                  enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
                  description: 'Assessed priority',
                },
                constraints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Stated limitations or restrictions',
                },
                assumptions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Stated or implied assumptions',
                },
                risks: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Identified risks to achieving this objective',
                },
                sourceReference: {
                  type: 'string',
                  description: 'Exact location in document for traceability',
                },
              },
            },
          },
          chunkSummary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of what this chunk covers',
          },
          extractionConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence in extraction quality (0=low, 1=high)',
          },
        },
      },
    };
  }

  /**
   * Extract objectives from a single text chunk
   * @param chunkText - Text content of the chunk
   * @param chunkIndex - Index of this chunk (for reference in extracted objectives)
   * @returns Extraction result for this chunk
   */
  async extractFromChunk(
    chunkText: string,
    chunkIndex: number
  ): Promise<{ result: ChunkExtractionResult; tokensUsed: number }> {
    try {
      // Build provider-agnostic request
      const request: LLMCompletionRequest = {
        messages: [
          {
            role: 'system',
            content: EXTRACTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Extract all strategic objectives from the following text chunk (chunk ${chunkIndex + 1}).

Note the source reference as "Chunk ${chunkIndex + 1}: [paragraph or section info]" for traceability.

If this text is from a research proposal, project proposal, or non-military document, extract its goals, aims, deliverables, and desired outcomes as objectives.

TEXT:
${chunkText}`,
          },
        ],
        tools: [this.extractionTool],
        tool_choice: { type: 'tool', name: 'extract_objectives' },
        max_tokens: 4096,
      };

      // Call provider
      const response = await this.provider.complete(request);

      // Try tool_use first, then fall back to parsing JSON from text content
      let extractionInput: unknown;

      if (response.tool_use) {
        extractionInput = response.tool_use.input;
      } else if (response.content) {
        // Many models (Qwen, Llama, etc.) don't support tool_use — parse JSON from text
        console.log(`[extraction] Chunk ${chunkIndex}: No tool_use in response, attempting JSON fallback parse from text content`);
        extractionInput = this.parseJsonFromText(response.content);
        if (!extractionInput) {
          throw new Error('No tool_use in response and could not parse JSON from text content');
        }
      } else {
        throw new Error('No tool_use and no text content in response');
      }

      // Parse and validate the response
      const parsed = ChunkExtractionResultSchema.safeParse(extractionInput);

      if (!parsed.success) {
        console.error(`Validation failed for chunk ${chunkIndex}:`, parsed.error);
        throw new Error(`Validation failed: ${parsed.error.message}`);
      }

      // Get tokens used from response
      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

      console.log(`[extraction] Chunk ${chunkIndex}: ${parsed.data.objectives.length} objectives found, confidence: ${parsed.data.extractionConfidence}, summary: "${parsed.data.chunkSummary.substring(0, 100)}"`);

      return {
        result: parsed.data,
        tokensUsed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[extraction] Chunk ${chunkIndex} extraction failed or returned no tool_use. Error: ${message}. This may indicate the LLM provider does not support tool_use/function_calling, or the document content doesn't match the extraction prompt.`);

      // Return empty result with low confidence on error
      return {
        result: {
          objectives: [],
          chunkSummary: `Extraction failed for chunk ${chunkIndex + 1}: ${message}`,
          extractionConfidence: 0,
        },
        tokensUsed: 0,
      };
    }
  }

  /**
   * Consolidate results from multiple chunks
   * Deduplicates objectives and merges supporting DIME categories
   * @param chunkResults - Results from each chunk extraction
   * @returns Consolidated document extraction result
   */
  consolidateChunks(chunkResults: ChunkExtractionResult[]): DocumentExtractionResult {
    const allObjectives: ExtractedObjective[] = [];
    const seenDescriptions: Map<string, number> = new Map();

    // Collect and deduplicate objectives
    for (const chunkResult of chunkResults) {
      for (const objective of chunkResult.objectives) {
        // Check for duplicates using normalized description
        const normalizedDesc = this.normalizeDescription(objective.description);
        const existingIndex = this.findSimilarObjective(normalizedDesc, seenDescriptions);

        if (existingIndex !== undefined) {
          // Merge supporting DIME arrays
          const existing = allObjectives[existingIndex];
          const mergedSupporting = new Set([
            ...existing.supportingDIME,
            ...objective.supportingDIME,
          ]);
          // Add the duplicate's primary as supporting if different
          if (objective.dimeCategory !== existing.dimeCategory) {
            mergedSupporting.add(objective.dimeCategory);
          }
          existing.supportingDIME = Array.from(mergedSupporting);

          // Keep the higher priority version
          if (this.comparePriority(objective.priority, existing.priority) > 0) {
            existing.priority = objective.priority;
          }
        } else {
          // Add new objective
          seenDescriptions.set(normalizedDesc, allObjectives.length);
          allObjectives.push(objective);
        }
      }
    }

    // Renumber objectives to be sequential
    allObjectives.forEach((obj, index) => {
      obj.id = `OBJ-${String(index + 1).padStart(3, '0')}`;
    });

    // Calculate overall confidence as weighted average
    const totalConfidence = chunkResults.reduce(
      (sum, r) => sum + r.extractionConfidence * r.objectives.length,
      0
    );
    const totalObjectives = chunkResults.reduce((sum, r) => sum + r.objectives.length, 0);
    const overallConfidence = totalObjectives > 0 ? totalConfidence / totalObjectives : 0;

    // Generate document summary from chunk summaries
    const documentSummary = chunkResults
      .map((r) => r.chunkSummary)
      .filter((s) => s && !s.startsWith('Extraction failed'))
      .slice(0, 3) // Take first 3 chunk summaries
      .join(' ');

    // Infer document level from content
    const documentLevel = this.inferDocumentLevel(allObjectives, documentSummary);

    return {
      objectives: allObjectives,
      documentSummary: documentSummary || 'Document processed with no summary available.',
      documentLevel,
      overallConfidence,
    };
  }

  /**
   * Extract strategic objectives from a full document
   * @param documentText - Full text content of the document
   * @param onProgress - Optional callback for progress updates
   * @returns Complete extraction result with audit log
   */
  async extractFromDocument(
    documentText: string,
    onProgress?: ExtractionProgressCallback
  ): Promise<ExtractionResult> {
    const auditLog: ExtractionAuditEntry[] = [];
    const chunkResults: ChunkExtractionResult[] = [];
    let totalObjectivesFound = 0;

    // Chunk the document
    const chunks = this.documentParser.chunkDocument(documentText, this.chunkSize);

    // Report chunking phase
    if (onProgress) {
      onProgress({
        phase: 'chunking',
        currentChunk: 0,
        totalChunks: chunks.length,
        percentComplete: 0,
        objectivesFound: 0,
      });
    }

    if (chunks.length === 0) {
      if (onProgress) {
        onProgress({
          phase: 'complete',
          currentChunk: 0,
          totalChunks: 0,
          percentComplete: 100,
          objectivesFound: 0,
        });
      }
      return {
        objectives: [],
        documentSummary: 'Empty or unprocessable document.',
        extractionConfidence: 0,
        chunkCount: 0,
        auditLog: [],
        documentLevel: 'OTHER',
      };
    }

    // Process chunks sequentially (to respect rate limits)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Report starting extraction for this chunk
      if (onProgress) {
        onProgress({
          phase: 'extracting',
          currentChunk: i + 1,
          totalChunks: chunks.length,
          percentComplete: Math.round((i / chunks.length) * 90), // 0-90% for extraction
          objectivesFound: totalObjectivesFound,
        });
      }

      const { result, tokensUsed } = await this.extractFromChunk(chunk, i);

      chunkResults.push(result);
      totalObjectivesFound += result.objectives.length;

      auditLog.push({
        chunkIndex: i,
        timestamp: new Date(),
        model: this.provider.name,
        tokensUsed,
        objectivesFound: result.objectives.length,
      });

      // Report chunk completion with preview
      if (onProgress) {
        const latestObjective = result.objectives[result.objectives.length - 1];
        onProgress({
          phase: 'extracting',
          currentChunk: i + 1,
          totalChunks: chunks.length,
          percentComplete: Math.round(((i + 1) / chunks.length) * 90),
          objectivesFound: totalObjectivesFound,
          latestObjectivePreview: latestObjective
            ? latestObjective.description.substring(0, 150) + (latestObjective.description.length > 150 ? '...' : '')
            : undefined,
          chunkSummary: result.chunkSummary,
        });
      }

      // Small delay between chunks to be respectful of rate limits
      if (i < chunks.length - 1) {
        await this.delay(500);
      }
    }

    // Report consolidation phase
    if (onProgress) {
      onProgress({
        phase: 'consolidating',
        currentChunk: chunks.length,
        totalChunks: chunks.length,
        percentComplete: 95,
        objectivesFound: totalObjectivesFound,
      });
    }

    // Consolidate results
    const consolidated = this.consolidateChunks(chunkResults);

    if (consolidated.objectives.length === 0) {
      console.warn(`[extraction] WARNING: 0 objectives extracted from ${chunks.length} chunks. Document may not contain extractable objectives, or the LLM may not be responding with tool_use. Chunk summaries: ${chunkResults.map(r => r.chunkSummary).join(' | ')}`);
    }

    // Report completion
    if (onProgress) {
      onProgress({
        phase: 'complete',
        currentChunk: chunks.length,
        totalChunks: chunks.length,
        percentComplete: 100,
        objectivesFound: consolidated.objectives.length, // Use deduplicated count
      });
    }

    return {
      objectives: consolidated.objectives,
      documentSummary: consolidated.documentSummary,
      extractionConfidence: consolidated.overallConfidence,
      chunkCount: chunks.length,
      auditLog,
      documentLevel: consolidated.documentLevel,
    };
  }

  /**
   * Parse JSON from text content (fallback for models without tool_use support)
   * Handles raw JSON, markdown code blocks, and JSON embedded in text
   */
  private parseJsonFromText(text: string): unknown | null {
    // Strip thinking tags (Qwen3 thinking mode, DeepSeek, etc.)
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Try direct parse first (model returned pure JSON)
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && 'objectives' in parsed) {
        return parsed;
      }
    } catch {
      // Not pure JSON, try extraction
    }

    // Try extracting from markdown code blocks: ```json ... ``` or ``` ... ```
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed && typeof parsed === 'object' && 'objectives' in parsed) {
          return parsed;
        }
      } catch {
        // Code block content wasn't valid JSON
      }
    }

    // Try finding JSON object in text (greedy match from first { to last })
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === 'object' && 'objectives' in parsed) {
          return parsed;
        }
      } catch {
        // Couldn't parse extracted JSON
      }
    }

    console.warn(`[extraction] Could not parse JSON from text response (${text.length} chars). First 200 chars: ${text.substring(0, 200)}`);
    return null;
  }

  /**
   * Normalize description for comparison
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find similar objective using Jaccard similarity
   * @returns Index of similar objective if found (>80% match)
   */
  private findSimilarObjective(
    normalizedDesc: string,
    seenDescriptions: Map<string, number>
  ): number | undefined {
    const words = new Set(normalizedDesc.split(' '));

    for (const [existingDesc, index] of seenDescriptions) {
      const existingWords = new Set(existingDesc.split(' '));

      // Calculate Jaccard similarity
      const intersection = new Set([...words].filter((w) => existingWords.has(w)));
      const union = new Set([...words, ...existingWords]);
      const similarity = intersection.size / union.size;

      if (similarity > 0.8) {
        return index;
      }
    }

    return undefined;
  }

  /**
   * Compare priority levels
   * @returns >0 if a > b, <0 if a < b, 0 if equal
   */
  private comparePriority(
    a: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    b: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  ): number {
    const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return order[a] - order[b];
  }

  /**
   * Infer document hierarchy level from content
   */
  private inferDocumentLevel(
    objectives: ExtractedObjective[],
    summary: string
  ): 'NSS' | 'NDS' | 'NMS' | 'GEF' | 'JSCP' | 'CAMPAIGN_PLAN' | 'OTHER' {
    const text = (summary + ' ' + objectives.map((o) => o.description).join(' ')).toLowerCase();

    if (text.includes('national security strategy') || text.includes('nss')) {
      return 'NSS';
    }
    if (text.includes('national defense strategy') || text.includes('nds')) {
      return 'NDS';
    }
    if (text.includes('national military strategy') || text.includes('nms')) {
      return 'NMS';
    }
    if (text.includes('guidance for employment') || text.includes('gef')) {
      return 'GEF';
    }
    if (text.includes('joint strategic capabilities') || text.includes('jscp')) {
      return 'JSCP';
    }
    if (text.includes('campaign plan') || text.includes('operation plan') || text.includes('oplan')) {
      return 'CAMPAIGN_PLAN';
    }

    return 'OTHER';
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
