/**
 * Extraction Service
 * LLM-powered extraction of strategic objectives using Anthropic Claude with tool_use
 *
 * Uses native Anthropic tool_use for structured output instead of Instructor-JS,
 * as the Anthropic SDK provides better control and reliability for structured extraction.
 */

import Anthropic from '@anthropic-ai/sdk';
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
} from './types.js';
import { DocumentParser } from '../ingestion/document-parser.js';

/**
 * Default extraction configuration
 */
const DEFAULT_CONFIG: Required<ExtractionConfig> = {
  model: 'claude-sonnet-4-20250514',
  maxRetries: 3,
  chunkSize: 8000,
};

/**
 * System prompt for strategic objective extraction
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a strategic planning analyst extracting objectives from national security documents.

Apply the DIME framework to categorize each objective:
- DIPLOMATIC: Foreign policy, alliances, negotiations, treaties, international cooperation
- INFORMATIONAL: Communications, influence, information warfare, public diplomacy, strategic messaging
- MILITARY: Armed forces, defense operations, military capabilities, force posture
- ECONOMIC: Trade, sanctions, financial instruments, economic statecraft

Apply Ends-Ways-Means doctrine:
- Ends: The desired outcome or end state - what success looks like
- Ways: Strategies, concepts, methods to achieve the ends - how we get there
- Means: Resources (forces, materiel, funding) required - what we need

Rules:
1. Only extract explicitly stated objectives, not inferred or implied ones
2. Provide exact source reference (page, section, paragraph) for traceability
3. Assess priority based on document language ("critical", "vital", "essential", "important") and positioning
4. Note constraints and assumptions as stated in the document
5. If uncertain about DIME category, choose most applicable based on primary focus
6. Assign sequential IDs in format OBJ-001, OBJ-002, etc.
7. Be thorough but precise - capture all stated objectives, avoid fabrication

You MUST use the extract_objectives tool to provide your response in the required structured format.`;

/**
 * ExtractionService handles LLM-powered extraction of strategic objectives
 */
export class ExtractionService {
  private anthropic: Anthropic;
  private config: Required<ExtractionConfig>;
  private documentParser: DocumentParser;
  private extractionTool: Anthropic.Tool;

  constructor(config: ExtractionConfig = {}) {
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Merge config with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Document parser for chunking
    this.documentParser = new DocumentParser();

    // Create the extraction tool from Zod schema
    this.extractionTool = this.createExtractionTool();
  }

  /**
   * Create the Anthropic tool definition with JSON Schema
   * Manually defined to avoid Zod 4.x compatibility issues with zod-to-json-schema
   */
  private createExtractionTool(): Anthropic.Tool {
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
                'priority',
                'constraints',
                'assumptions',
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
      // Call Anthropic with tool_use
      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        tools: [this.extractionTool],
        tool_choice: { type: 'tool', name: 'extract_objectives' },
        messages: [
          {
            role: 'user',
            content: `Extract all strategic objectives from the following text chunk (chunk ${chunkIndex + 1}).

Note the source reference as "Chunk ${chunkIndex + 1}: [paragraph or section info]" for traceability.

TEXT:
${chunkText}`,
          },
        ],
      });

      // Find the tool_use block in the response
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (!toolUseBlock) {
        throw new Error('No tool_use block in response');
      }

      // Parse and validate the response
      const parsed = ChunkExtractionResultSchema.safeParse(toolUseBlock.input);

      if (!parsed.success) {
        console.error(`Validation failed for chunk ${chunkIndex}:`, parsed.error);
        throw new Error(`Validation failed: ${parsed.error.message}`);
      }

      // Get tokens used from response
      const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

      return {
        result: parsed.data,
        tokensUsed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to extract from chunk ${chunkIndex}:`, message);

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
   * @returns Complete extraction result with audit log
   */
  async extractFromDocument(documentText: string): Promise<ExtractionResult> {
    const auditLog: ExtractionAuditEntry[] = [];
    const chunkResults: ChunkExtractionResult[] = [];

    // Chunk the document
    const chunks = this.documentParser.chunkDocument(documentText, this.config.chunkSize);

    if (chunks.length === 0) {
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
      const { result, tokensUsed } = await this.extractFromChunk(chunk, i);

      chunkResults.push(result);
      auditLog.push({
        chunkIndex: i,
        timestamp: new Date(),
        model: this.config.model,
        tokensUsed,
        objectivesFound: result.objectives.length,
      });

      // Small delay between chunks to be respectful of rate limits
      if (i < chunks.length - 1) {
        await this.delay(500);
      }
    }

    // Consolidate results
    const consolidated = this.consolidateChunks(chunkResults);

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
